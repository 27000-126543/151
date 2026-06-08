import { Server } from "socket.io";
import { Server as HttpServer } from "http";
import { logger } from "../utils/logger";
import { UserRole } from "../entities/User";
import { NotificationType } from "../entities/Notification";

let io: Server;
const userSockets = new Map<string, Set<string>>();
const roleSockets = new Map<UserRole, Set<string>>();

export const initWebSocket = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    logger.info(`WebSocket连接建立: ${socket.id}`);

    socket.on("register", (data: { userId: string; role: UserRole }) => {
      if (!userSockets.has(data.userId)) {
        userSockets.set(data.userId, new Set());
      }
      userSockets.get(data.userId)!.add(socket.id);

      if (!roleSockets.has(data.role)) {
        roleSockets.set(data.role, new Set());
      }
      roleSockets.get(data.role)!.add(socket.id);

      logger.info(`用户 ${data.userId} (${data.role}) 注册到WebSocket`);
    });

    socket.on("disconnect", () => {
      logger.info(`WebSocket连接断开: ${socket.id}`);
      userSockets.forEach((sockets) => sockets.delete(socket.id));
      roleSockets.forEach((sockets) => sockets.delete(socket.id));
    });
  });

  logger.info("WebSocket服务已初始化");
};

export const sendToUser = (userId: string, type: NotificationType, data: any) => {
  const sockets = userSockets.get(userId);
  if (sockets) {
    sockets.forEach((socketId) => {
      io.to(socketId).emit("notification", { type, data, timestamp: new Date() });
    });
    logger.info(`向用户 ${userId} 推送通知: ${type}`);
  }
};

export const sendToRole = (role: UserRole, type: NotificationType, data: any) => {
  const sockets = roleSockets.get(role);
  if (sockets) {
    sockets.forEach((socketId) => {
      io.to(socketId).emit("notification", { type, data, timestamp: new Date() });
    });
    logger.info(`向角色 ${role} 推送通知: ${type}`);
  }
};

export const broadcast = (type: NotificationType, data: any) => {
  io.emit("notification", { type, data, timestamp: new Date() });
  logger.info(`广播通知: ${type}`);
};

export const getIo = () => io;
