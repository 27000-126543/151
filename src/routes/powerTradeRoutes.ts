import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UserRole } from "../entities/User";
import {
  createTradeSchema,
  submitApprovalSchema,
  approveTradeSchema,
  rejectTradeSchema,
  submitTradeSchema,
  generateStrategySchema,
} from "../validation/powerTrade";
import {
  generateTradingStrategy,
  createTrade,
  submitForApproval,
  approveTrade,
  rejectTrade,
  submitTrade,
  settleTrade,
  getTrades,
  getMyTrades,
  getTradeDetail,
} from "../controllers/powerTradeController";

const router = Router();

router.use(authMiddleware());

router.post(
  "/strategy",
  authMiddleware(UserRole.TRADER),
  validate(generateStrategySchema),
  generateTradingStrategy
);
router.post(
  "/",
  authMiddleware(UserRole.TRADER),
  validate(createTradeSchema),
  createTrade
);
router.post(
  "/submit-approval",
  authMiddleware(UserRole.TRADER),
  validate(submitApprovalSchema),
  submitForApproval
);
router.post(
  "/:id/approve",
  authMiddleware(UserRole.ADMIN),
  validate(approveTradeSchema),
  approveTrade
);
router.post(
  "/:id/reject",
  authMiddleware(UserRole.ADMIN),
  validate(rejectTradeSchema),
  rejectTrade
);
router.post(
  "/:id/submit",
  authMiddleware(UserRole.TRADER),
  submitTrade
);
router.post(
  "/:id/settle",
  authMiddleware(UserRole.TRADER),
  settleTrade
);
router.get("/", authMiddleware(UserRole.TRADER, UserRole.ADMIN), getTrades);
router.get("/my", authMiddleware(UserRole.TRADER), getMyTrades);
router.get(
  "/:id",
  authMiddleware(UserRole.TRADER, UserRole.ADMIN),
  getTradeDetail
);

export default router;
