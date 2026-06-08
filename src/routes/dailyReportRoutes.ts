import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { UserRole } from "../entities/User";
import {
  generateReportSchema,
  exportReportSchema,
} from "../validation/dailyReport";
import {
  generateDailyReport,
  getReports,
  getReportDetail,
  exportReport,
} from "../controllers/dailyReportController";

const router = Router();

router.use(authMiddleware());

router.post(
  "/generate",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  validate(generateReportSchema),
  generateDailyReport
);
router.get("/", authMiddleware(UserRole.OPERATOR, UserRole.ADMIN), getReports);
router.get("/:id", authMiddleware(UserRole.OPERATOR, UserRole.ADMIN), getReportDetail);
router.post(
  "/:id/export",
  authMiddleware(UserRole.OPERATOR, UserRole.ADMIN),
  validate(exportReportSchema),
  exportReport
);

export default router;
