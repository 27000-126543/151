import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  createDemandResponseSchema,
  rejectTaskSchema,
  completeTaskSchema,
  settleDemandResponseSchema,
} from "../validation/demandResponse";
import {
  createDemandResponse,
  publishDemandResponse,
  getDemandResponses,
  getDemandResponseDetail,
  settleDemandResponse,
  getMyTasks,
  getTaskDetail,
  acceptTask,
  rejectTask,
  startTask,
  completeTask,
} from "../controllers/demandResponseController";
import { UserRole } from "../entities/User";

const router = Router();

router.use(authMiddleware());

router.get("/", getDemandResponses);
router.get("/:id", getDemandResponseDetail);

router.post(
  "/",
  authMiddleware(UserRole.OPERATOR),
  validate(createDemandResponseSchema),
  createDemandResponse
);

router.post(
  "/:id/publish",
  authMiddleware(UserRole.OPERATOR),
  publishDemandResponse
);

router.post(
  "/:id/settle",
  authMiddleware(UserRole.OPERATOR),
  validate(settleDemandResponseSchema),
  settleDemandResponse
);

router.get("/tasks/my", getMyTasks);
router.get("/tasks/:id", getTaskDetail);
router.post("/tasks/:id/accept", acceptTask);
router.post("/tasks/:id/reject", validate(rejectTaskSchema), rejectTask);
router.post("/tasks/:id/start", startTask);
router.post("/tasks/:id/complete", validate(completeTaskSchema), completeTask);

export default router;
