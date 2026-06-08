import { Repository } from "typeorm";
import { AppDataSource } from "../config/data-source";
import { DemandResponse, ResponseType, ResponseStatus } from "../entities/DemandResponse";
import { DemandResponseTask, TaskStatus } from "../entities/DemandResponseTask";
import { User, UserRole } from "../entities/User";
import { logger } from "../utils/logger";
import { generateOrderNo, roundTo } from "../utils/helpers";
import { sendToUser, sendToRole } from "./notificationService";
import { NotificationType, NotificationSeverity } from "../entities/Notification";

export class DemandResponseService {
  private drRepo: Repository<DemandResponse>;
  private taskRepo: Repository<DemandResponseTask>;
  private userRepo: Repository<User>;

  constructor() {
    this.drRepo = AppDataSource.getRepository(DemandResponse);
    this.taskRepo = AppDataSource.getRepository(DemandResponseTask);
    this.userRepo = AppDataSource.getRepository(User);
  }

  async createDemandResponse(data: any, operatorId: string) {
    const dr = this.drRepo.create({
      ...data,
      responseNo: generateOrderNo("DR"),
      status: ResponseStatus.DRAFT,
      createdBy: operatorId,
    }) as any;

    await this.drRepo.save(dr);
    logger.info(`创建需求响应事件: ${dr.id} - ${dr.name}`);
    return dr;
  }

  async publishDemandResponse(drId: string, operatorId: string) {
    const dr = await this.drRepo.findOne({ where: { id: drId } });
    if (!dr) {
      throw new Error("需求响应事件不存在");
    }

    const eligibleUsers = await this.findEligibleUsers(dr);
    if (eligibleUsers.length === 0) {
      throw new Error("没有符合条件的参与用户");
    }

    const tasks = await this.assignTasks(dr, eligibleUsers);

    dr.status = ResponseStatus.PUBLISHED;
    dr.publishedBy = operatorId;
    dr.publishedAt = new Date();
    await this.drRepo.save(dr);

    for (const task of tasks) {
      sendToUser(task.userId, NotificationType.DEMAND_RESPONSE, {
        title: "需求响应任务邀请",
        content: `您被邀请参与「${dr.name}」需求响应，预计可获得激励 ${roundTo(task.incentiveAmount || 0, 2)} 元`,
        severity: NotificationSeverity.INFO,
        task,
        demandResponse: dr,
      });
    }

    sendToRole(UserRole.OPERATOR, NotificationType.DEMAND_RESPONSE, {
      title: "需求响应已发布",
      content: `「${dr.name}」已发布，共邀请 ${tasks.length} 个用户参与`,
      demandResponse: dr,
    });

    logger.info(`发布需求响应: ${drId}, 邀请 ${tasks.length} 用户`);
    return { dr, tasks };
  }

  private async findEligibleUsers(dr: DemandResponse) {
    const queryBuilder = this.userRepo
      .createQueryBuilder("user")
      .where("user.demandResponseEnabled = :enabled", { enabled: true })
      .andWhere("user.isActive = :active", { active: true })
      .andWhere("user.maxInterruptibleLoad >= :minLoad", {
        minLoad: dr.eligibilityCriteria?.minLoad || 10,
      });

    if (dr.eligibilityCriteria?.userTypes?.length) {
      queryBuilder.andWhere("user.userType IN (:...userTypes)", {
        userTypes: dr.eligibilityCriteria.userTypes,
      });
    }

    if (dr.eligibilityCriteria?.regions?.length) {
      queryBuilder.andWhere("user.region IN (:...regions)", {
        regions: dr.eligibilityCriteria.regions,
      });
    } else if (dr.region) {
      queryBuilder.andWhere("user.region = :region", { region: dr.region });
    }

    queryBuilder.orderBy("user.demandResponsePriority", "DESC");

    return queryBuilder.getMany();
  }

  private async assignTasks(dr: DemandResponse, users: User[]) {
    const tasks: DemandResponseTask[] = [];
    let remainingTarget = dr.targetLoadReduction;

    for (const user of users) {
      if (remainingTarget <= 0) break;

      const assignedLoad = Math.min(user.maxInterruptibleLoad, remainingTarget);
      const incentiveAmount = assignedLoad * dr.incentivePrice;

      const task = this.taskRepo.create({
        demandResponseId: dr.id,
        userId: user.id,
        assignedLoadReduction: assignedLoad,
        incentiveAmount: roundTo(incentiveAmount, 2),
        baselineLoad: user.currentLoad,
        status: TaskStatus.PENDING,
      });

      tasks.push(task);
      remainingTarget -= assignedLoad;
    }

    return this.taskRepo.save(tasks);
  }

  async acceptTask(taskId: string, userId: string) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
      relations: ["demandResponse"],
    });

    if (!task) {
      throw new Error("任务不存在或无权访问");
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new Error("任务状态不允许接受");
    }

    task.status = TaskStatus.ACCEPTED;
    task.acceptedAt = new Date();
    await this.taskRepo.save(task);

    if (task.demandResponse) {
      const dr = task.demandResponse;
      if (dr.status === ResponseStatus.PUBLISHED) {
        dr.status = ResponseStatus.IN_PROGRESS;
        await this.drRepo.save(dr);
      }
    }

    sendToUser(userId, NotificationType.DEMAND_RESPONSE, {
      title: "需求响应任务已接受",
      content: `您已接受「${task.demandResponse?.name}」任务，请在指定时间内完成负荷削减`,
      task,
    });

    return task;
  }

  async rejectTask(taskId: string, userId: string, rejectionReason: string) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
      relations: ["demandResponse"],
    });

    if (!task) {
      throw new Error("任务不存在或无权访问");
    }

    if (task.status !== TaskStatus.PENDING) {
      throw new Error("任务状态不允许拒绝");
    }

    task.status = TaskStatus.REJECTED;
    task.rejectionReason = rejectionReason;
    await this.taskRepo.save(task);

    this.reassignTask(task);

    return task;
  }

  private async reassignTask(rejectedTask: DemandResponseTask) {
    const dr = await this.drRepo.findOne({
      where: { id: rejectedTask.demandResponseId },
    });
    if (!dr) return;

    const existingUserIds = await this.taskRepo
      .createQueryBuilder("task")
      .where("task.demandResponseId = :drId", { drId: dr.id })
      .select("task.userId")
      .getRawMany()
      .then((rows) => rows.map((r) => r.task_userId));

    const queryBuilder = this.userRepo
      .createQueryBuilder("user")
      .where("user.demandResponseEnabled = :enabled", { enabled: true })
      .andWhere("user.isActive = :active", { active: true })
      .andWhere("user.maxInterruptibleLoad >= :load", {
        load: rejectedTask.assignedLoadReduction,
      })
      .andWhere("user.id NOT IN (:...ids)", { ids: existingUserIds })
      .orderBy("user.demandResponsePriority", "DESC");

    const newUser = await queryBuilder.getOne();
    if (newUser) {
      const newTask = this.taskRepo.create({
        demandResponseId: dr.id,
        userId: newUser.id,
        assignedLoadReduction: rejectedTask.assignedLoadReduction,
        incentiveAmount: rejectedTask.incentiveAmount,
        baselineLoad: newUser.currentLoad,
        status: TaskStatus.PENDING,
      });

      await this.taskRepo.save(newTask);

      sendToUser(newUser.id, NotificationType.DEMAND_RESPONSE, {
        title: "需求响应任务邀请",
        content: `您被邀请参与「${dr.name}」需求响应`,
        task: newTask,
        demandResponse: dr,
      });
    }
  }

  async startTask(taskId: string, userId: string) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
      relations: ["demandResponse"],
    });

    if (!task) {
      throw new Error("任务不存在或无权访问");
    }

    if (task.status !== TaskStatus.ACCEPTED) {
      throw new Error("任务状态不允许开始");
    }

    task.status = TaskStatus.IN_PROGRESS;
    task.startedAt = new Date();
    await this.taskRepo.save(task);

    return task;
  }

  async completeTask(taskId: string, userId: string, actualLoadReduction: number, remark?: string) {
    const task = await this.taskRepo.findOne({
      where: { id: taskId, userId },
      relations: ["demandResponse"],
    });

    if (!task) {
      throw new Error("任务不存在或无权访问");
    }

    if (task.status !== TaskStatus.IN_PROGRESS) {
      throw new Error("任务状态不允许完成");
    }

    const performanceRatio = actualLoadReduction / task.assignedLoadReduction;
    const finalIncentive = roundTo((task.incentiveAmount || 0) * Math.min(performanceRatio, 1), 2);

    task.status = TaskStatus.COMPLETED;
    task.actualLoadReduction = actualLoadReduction;
    task.completedAt = new Date();
    task.incentiveAmount = finalIncentive;
    task.remark = remark || "";
    await this.taskRepo.save(task);

    await this.checkDemandResponseCompletion(task.demandResponseId);

    sendToUser(userId, NotificationType.DEMAND_RESPONSE, {
      title: "需求响应任务已完成",
      content: `您完成负荷削减 ${roundTo(actualLoadReduction, 2)} kW，获得激励 ${finalIncentive} 元`,
      severity: NotificationSeverity.INFO,
      task,
    });

    return task;
  }

  private async checkDemandResponseCompletion(drId: string) {
    const tasks = await this.taskRepo.find({
      where: { demandResponseId: drId },
    });

    const allCompleted = tasks.every(
      (t) => t.status === TaskStatus.COMPLETED || t.status === TaskStatus.SETTLED || t.status === TaskStatus.REJECTED || t.status === TaskStatus.FAILED
    );

    if (allCompleted) {
      const dr = await this.drRepo.findOne({ where: { id: drId } });
      if (dr) {
        dr.status = ResponseStatus.COMPLETED;
        dr.actualLoadReduction = tasks.reduce(
          (sum, t) => sum + (t.actualLoadReduction || 0),
          0
        );
        await this.drRepo.save(dr);
      }
    }
  }

  async settleDemandResponse(drId: string, settledBy: string, remark?: string) {
    const dr = await this.drRepo.findOne({ where: { id: drId } });
    if (!dr) {
      throw new Error("需求响应事件不存在");
    }

    const tasks = await this.taskRepo.find({
      where: { demandResponseId: drId, status: TaskStatus.COMPLETED },
    });

    let totalIncentive = 0;
    for (const task of tasks) {
      task.status = TaskStatus.SETTLED;
      task.settledAt = new Date();
      totalIncentive += task.incentiveAmount || 0;

      const user = await this.userRepo.findOne({ where: { id: task.userId } });
      if (user) {
        user.balance = roundTo((user.balance || 0) + (task.incentiveAmount || 0), 2);
        await this.userRepo.save(user);

        sendToUser(task.userId, NotificationType.DEMAND_RESPONSE, {
          title: "需求响应激励已发放",
          content: `您获得需求响应激励 ${roundTo(task.incentiveAmount || 0, 2)} 元，已发放到账户余额`,
          amount: task.incentiveAmount,
        });
      }
    }

    await this.taskRepo.save(tasks);

    dr.status = ResponseStatus.SETTLED;
    dr.totalIncentive = roundTo(totalIncentive, 2);
    dr.settledBy = settledBy;
    dr.settledAt = new Date();
    dr.remark = remark || "";
    await this.drRepo.save(dr);

    sendToRole(UserRole.OPERATOR, NotificationType.DEMAND_RESPONSE, {
      title: "需求响应已结算",
      content: `「${dr.name}」已完成结算，总激励金额 ${roundTo(totalIncentive, 2)} 元`,
      demandResponse: dr,
    });

    return { dr, tasks, totalIncentive };
  }

  async getDemandResponses(status?: ResponseStatus, page: number = 1, pageSize: number = 20) {
    const where: any = {};
    if (status) where.status = status;

    const [items, total] = await this.drRepo.findAndCount({
      where,
      relations: ["tasks"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async getMyTasks(userId: string, status?: TaskStatus, page: number = 1, pageSize: number = 20) {
    const where: any = { userId };
    if (status) where.status = status;

    const [items, total] = await this.taskRepo.findAndCount({
      where,
      relations: ["demandResponse"],
      order: { createdAt: "DESC" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    });

    return { items, total };
  }

  async getTaskDetail(taskId: string, userId?: string) {
    const where: any = { id: taskId };
    if (userId) where.userId = userId;

    return this.taskRepo.findOne({
      where,
      relations: ["demandResponse", "user"],
    });
  }

  async getDemandResponseDetail(drId: string) {
    const dr = await this.drRepo.findOne({
      where: { id: drId },
      relations: ["tasks", "tasks.user"],
    });
    return dr;
  }
}

export const demandResponseService = new DemandResponseService();
