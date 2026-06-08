import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  calculateEmissionsSchema,
  generateReportSchema,
  transferCreditsSchema,
} from "../validation/carbon";
import {
  calculateDailyEmissions,
  getEmissions,
  getCarbonCredits,
  generateCarbonReport,
  transferCredits,
  getMonthSummary,
} from "../controllers/carbonController";

const router = Router();

router.use(authMiddleware());

router.post(
  "/calculate",
  validate(calculateEmissionsSchema),
  calculateDailyEmissions
);
router.get("/", getEmissions);
router.get("/credits", getCarbonCredits);
router.post(
  "/report",
  validate(generateReportSchema),
  generateCarbonReport
);
router.post(
  "/transfer",
  validate(transferCreditsSchema),
  transferCredits
);
router.get("/summary", getMonthSummary);

export default router;
