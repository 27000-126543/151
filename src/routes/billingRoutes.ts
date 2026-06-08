import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UserRole } from "../entities/User";
import {
  generateBillsSchema,
  payBillSchema,
  issueLimitOrderSchema,
} from "../validation/billing";
import {
  generateMonthlyBills,
  issueBill,
  payBill,
  checkOverdueBills,
  issueLimitPowerOrder,
  restorePower,
  getBills,
  getMyBills,
  getBillDetail,
  getLimitOrders,
} from "../controllers/billingController";

const router = Router();

router.use(authMiddleware());

router.post(
  "/generate",
  authMiddleware(UserRole.ADMIN),
  validate(generateBillsSchema),
  generateMonthlyBills
);
router.post(
  "/check-overdue",
  authMiddleware(UserRole.ADMIN, UserRole.COLLECTOR),
  checkOverdueBills
);
router.post(
  "/:id/issue",
  authMiddleware(UserRole.ADMIN),
  issueBill
);
router.post(
  "/:id/pay",
  validate(payBillSchema),
  payBill
);
router.post(
  "/limit-orders/:id/issue",
  authMiddleware(UserRole.ADMIN),
  validate(issueLimitOrderSchema),
  issueLimitPowerOrder
);
router.post(
  "/limit-orders/:id/restore",
  authMiddleware(UserRole.ADMIN, UserRole.COLLECTOR),
  restorePower
);
router.get("/", authMiddleware(UserRole.ADMIN, UserRole.COLLECTOR), getBills);
router.get("/my", getMyBills);
router.get("/:id", getBillDetail);
router.get(
  "/limit-orders",
  authMiddleware(UserRole.ADMIN, UserRole.COLLECTOR),
  getLimitOrders
);

export default router;
