import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { validate } from "../middleware/validate";
import {
  reportDataSchema,
  createDispatchCommandSchema,
  ackAlertSchema,
  resolveAlertSchema,
} from "../validation/device";
import {
  reportDeviceData,
  getMyDevices,
  getDeviceDetail,
  getDeviceHistory,
  createDispatchCommand,
  executeCommand,
  getDispatchCommands,
  getAlerts,
  acknowledgeAlert,
  resolveAlert,
  updateDeviceRisk,
} from "../controllers/deviceController";
import { UserRole } from "../entities/User";

const router = Router();

router.post("/data/report", validate(reportDataSchema), reportDeviceData);

router.use(authMiddleware());

router.get("/", getMyDevices);
router.get("/:id", getDeviceDetail);
router.get("/:id/history", getDeviceHistory);
router.post("/:id/update-risk", updateDeviceRisk);

router.post("/dispatch-commands", validate(createDispatchCommandSchema), createDispatchCommand);
router.get("/dispatch-commands", getDispatchCommands);
router.post("/dispatch-commands/:id/execute", executeCommand);

router.get("/alerts", getAlerts);
router.post("/alerts/:id/acknowledge", validate(ackAlertSchema), acknowledgeAlert);
router.post("/alerts/:id/resolve", validate(resolveAlertSchema), resolveAlert);

export default router;
