import express from "express";
import * as doctorsController from "../controllers/doctorsController.js";
import { verifyFirebaseIdToken } from "../middleware/firebaseAuth.js";
import { requireDoctor } from "../middleware/requireDoctor.js";
import { requirePatient } from "../middleware/requirePatient.js";

const router = express.Router();

/** POST /api/doctors/register — onboarding */
router.post("/register", verifyFirebaseIdToken, requireDoctor, doctorsController.register);

/** GET /api/doctors/search — proximity + therapy (use ?broad=1 if therapy not in Firestore array) */
router.get("/search", doctorsController.search);

/** POST /api/doctors/book — pending appointment + priority bump */
router.post("/book", verifyFirebaseIdToken, requirePatient, doctorsController.book);
/** POST /api/doctors/book-by-doctor — doctor books on behalf of patient */
router.post("/book-by-doctor", verifyFirebaseIdToken, requireDoctor, doctorsController.bookByDoctor);

export default router;
