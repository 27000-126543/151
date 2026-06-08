import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UserRole } from "../entities/User";
import {
  createWorkOrderSchema,
  createFromAlertSchema,
  completeWorkOrderSchema,
  verifyWorkOrderSchema,
} from "../validation/workOrder";
import {
  createWorkOrderFromAlert,
  createManualWorkOrder,
  dispatchWorkOrder,
  startWorkOrder,
  completeWorkOrder,
  verifyWorkOrder,
  closeWorkOrder,
  getWorkOrders,
  getWorkOrderDetail,
  getRepairTeams,
} from "../controllers/workOrderController";

const router = Router();

router.use(authMiddleware());

router.post(
  "/from-alert",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  validate(createFromAlertSchema),
  createWorkOrderFromAlert
);
router.post(
  "/",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  validate(createWorkOrderSchema),
  createManualWorkOrder
);
router.post(
  "/:id/dispatch",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  dispatchWorkOrder
);
router.post(
  "/:id/start",
  authMiddleware(UserRole.MAINTENANCE, UserRole.ADMIN),
  startWorkOrder
);
router.post(
  "/:id/complete",
  authMiddleware(UserRole.MAINTENANCE, UserRole.ADMIN),
  validate(completeWorkOrderSchema),
  completeWorkOrder
);
router.post(
  "/:id/verify",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  validate(verifyWorkOrderSchema),
  verifyWorkOrder
);
router.post(
  "/:id/close",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  closeWorkOrder
);
router.get("/", authMiddleware(UserRole.OPERATOR, UserRole.MAINTENANCE, UserRole.ADMIN), getWorkOrders);
router.get("/teams", authMiddleware(UserRole.OPERATOR, UserRole.ADMIN), getRepairTeams);
router.get("/:id", authMiddleware(UserRole.OPERATOR, UserRole.MAINTENANCE, UserRole.ADMIN), getWorkOrderDetail);

export default router;
