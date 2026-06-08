import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import { submitPlanSchema, selectPlanSchema } from "../validation/electricityPlan";
import {
  submitPlan,
  getMyPlans,
  getPlanDetail,
  selectRecommendedPlan,
} from "../controllers/electricityPlanController";

const router = Router();

router.use(authMiddleware());

router.post("/", validate(submitPlanSchema), submitPlan);
router.get("/", getMyPlans);
router.get("/:id", getPlanDetail);
router.post("/:id/select", validate(selectPlanSchema), selectRecommendedPlan);

export default router;
