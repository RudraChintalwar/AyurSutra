import express from "express";
import { verifyFirebaseIdToken } from "../middleware/firebaseAuth.js";
import * as sessionsController from "../controllers/sessionsController.js";

const router = express.Router();
router.use(verifyFirebaseIdToken);

router.patch("/:id/complete", sessionsController.complete);
router.patch("/:id/cancel", sessionsController.cancel);
router.patch("/:id/reschedule-request", sessionsController.rescheduleRequest);
router.patch("/:id/patient-feedback", sessionsController.patientFeedback);
router.delete("/:id", sessionsController.removeSession);

export default router;
