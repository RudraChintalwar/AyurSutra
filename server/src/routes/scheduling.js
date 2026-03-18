import express from "express";
import Groq from "groq-sdk";
import { calculatePriorityScore, buildPriorityQueue, bumpAndReschedule, MaxHeap } from "../utils/priorityQueue.js";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// ─── Get ML prediction for Panchakarma therapy ───────────
router.post("/predict", async (req, res) => {
    try {
        const { symptoms, dosha, age, gender, reason } = req.body;

        // 1. Call ML service for therapy prediction
        let mlPrediction = null;
        try {
            const mlResponse = await fetch(`${ML_SERVICE_URL}/predict`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    symptoms: symptoms.map((s) => s.name).join(", "),
                    dosha: dosha || "Unknown",
                    age: age || 35,
                    gender: gender || "Unknown",
                }),
            });
            mlPrediction = await mlResponse.json();
        } catch (err) {
            console.log("ML service unavailable, using Groq fallback:", err.message);
        }

        // 2. Use Groq LLM for comprehensive recommendation
        const symptomText = symptoms
            .map((s) => `${s.name} (severity: ${s.score}/10)`)
            .join(", ");

        const prompt = `You are an expert Ayurvedic Panchakarma physician. Based on the following patient data, provide a treatment recommendation.

Patient Data:
- Dosha Constitution: ${dosha || "Unknown"}
- Age: ${age || "Not specified"}
- Gender: ${gender || "Not specified"}
- Symptoms: ${symptomText}
- Reason for visit: ${reason || "General wellness"}
${mlPrediction ? `- ML Model Prediction: ${JSON.stringify(mlPrediction.predictions)}` : ""}

Respond in this exact JSON format:
{
  "therapy": "<primary Panchakarma therapy name>",
  "sessions_recommended": <number between 2-7>,
  "spacing_days": <number between 3-10>,
  "priority_score": <number between 30-100>,
  "explanation": "<2-3 sentence explanation of why this therapy is recommended>",
  "confidence": <number between 70-95>,
  "precautions_pre": ["<pre-procedure precaution 1>", "<precaution 2>", "<precaution 3>"],
  "precautions_post": ["<post-procedure care 1>", "<care 2>", "<care 3>"]
}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 500,
            response_format: { type: "json_object" },
        });

        const recommendation = JSON.parse(
            completion.choices[0]?.message?.content || "{}"
        );

        res.json({
            success: true,
            recommendation,
            mlPrediction: mlPrediction?.predictions || null,
        });
    } catch (error) {
        console.error("Prediction error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate recommendation",
        });
    }
});

// ─── Process post-session feedback ───────────────────────
router.post("/feedback", async (req, res) => {
    try {
        const { sessionId, patientName, therapy, feedback, currentPlan } = req.body;

        const prompt = `You are an Ayurvedic physician reviewing post-session feedback. Based on the patient's response, determine if the treatment plan should be adjusted.

Session Details:
- Patient: ${patientName}
- Therapy: ${therapy}
- Current Plan: ${JSON.stringify(currentPlan)}

Patient Feedback:
- Symptom Scores: ${JSON.stringify(feedback.symptomScores)}
- Notes: ${feedback.notes}
- Side Effects: ${feedback.sideEffects?.join(", ") || "None reported"}

Respond in this exact JSON format:
{
  "action": "<one of: no_change, add_session, modify_spacing, increase_priority, decrease_priority>",
  "explanation": "<brief explanation for the patient and doctor>",
  "updated_priority_score": <number or null>,
  "additional_sessions": <number or 0>,
  "new_spacing_days": <number or null>,
  "care_instructions": ["<instruction 1>", "<instruction 2>"]
}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 400,
            response_format: { type: "json_object" },
        });

        const result = JSON.parse(
            completion.choices[0]?.message?.content || "{}"
        );

        res.json({ success: true, result });
    } catch (error) {
        console.error("Feedback processing error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to process feedback",
        });
    }
});

// ─── Generate available time slots ───────────────────────
router.post("/slots", async (req, res) => {
    try {
        const { practitionerId, spacingDays, sessionsNeeded, startDate } = req.body;

        const slots = [];
        const start = new Date(startDate || Date.now());
        start.setDate(start.getDate() + 1);

        for (let i = 0; i < sessionsNeeded * 2; i++) {
            const morningSlot = new Date(start);
            morningSlot.setDate(morningSlot.getDate() + i * (spacingDays || 3));
            morningSlot.setHours(9, 0, 0, 0);

            const afternoonSlot = new Date(morningSlot);
            afternoonSlot.setHours(14, 0, 0, 0);

            if (morningSlot > new Date()) {
                slots.push(morningSlot.toISOString());
                slots.push(afternoonSlot.toISOString());
            }
        }

        res.json({ success: true, slots });
    } catch (error) {
        console.error("Slot generation error:", error);
        res.status(500).json({ success: false, error: "Failed to generate slots" });
    }
});

// ─── Calculate weighted priority score ───────────────────
router.post("/calculate-priority", async (req, res) => {
    try {
        const { severityScore, feedbackEscalation, feedbackMultiplier, dosha, slotDatetime, createdAt } = req.body;

        // Optionally call RF Classifier for severity if not provided
        let severity = severityScore;
        if (!severity && req.body.symptoms) {
            try {
                const rfResponse = await fetch(`${ML_SERVICE_URL}/classify-severity`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ symptoms: req.body.symptoms, dosha: dosha || "Unknown" }),
                });
                const rfData = await rfResponse.json();
                severity = rfData.severity_score || 5;
            } catch (e) {
                console.log("RF Classifier unavailable, using default severity:", e.message);
                severity = 5;
            }
        }

        const result = calculatePriorityScore({
            severityScore: severity || 5,
            feedbackEscalation: feedbackEscalation || false,
            feedbackMultiplier: feedbackMultiplier || 1.0,
            dosha: dosha || "",
            slotDatetime: slotDatetime || null,
            createdAt: createdAt || null,
        });

        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Priority calculation error:", error);
        res.status(500).json({ success: false, error: "Failed to calculate priority" });
    }
});

// ─── Build priority queue from sessions ──────────────────
router.post("/priority-queue", async (req, res) => {
    try {
        const { sessions, patients } = req.body;

        if (!sessions || !Array.isArray(sessions)) {
            return res.status(400).json({ success: false, error: "Sessions array required" });
        }

        const heap = buildPriorityQueue(sessions, patients || []);
        const sortedQueue = heap.toSortedArray();

        res.json({
            success: true,
            queue: sortedQueue,
            stats: {
                total: sortedQueue.length,
                highPriority: sortedQueue.filter((s) => s.priorityScore >= 80).length,
                mediumPriority: sortedQueue.filter((s) => s.priorityScore >= 60 && s.priorityScore < 80).length,
                lowPriority: sortedQueue.filter((s) => s.priorityScore < 60).length,
            },
        });
    } catch (error) {
        console.error("Priority queue build error:", error);
        res.status(500).json({ success: false, error: "Failed to build priority queue" });
    }
});

// ─── Bump & reschedule high-priority patient ─────────────
router.post("/bump", async (req, res) => {
    try {
        const { highPrioritySession, scheduledSessions, availableSlots } = req.body;

        if (!highPrioritySession || !scheduledSessions) {
            return res.status(400).json({ success: false, error: "highPrioritySession and scheduledSessions required" });
        }

        const result = bumpAndReschedule(highPrioritySession, scheduledSessions, availableSlots || []);

        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Bump error:", error);
        res.status(500).json({ success: false, error: "Failed to bump/reschedule" });
    }
});

// ─── Get RF Classifier severity + RF Regressor sessions ──
router.post("/ml-analysis", async (req, res) => {
    try {
        const { symptoms, dosha, age, gender } = req.body;
        let severityResult = null;
        let sessionPrediction = null;

        // 1. Call RF Classifier for severity
        try {
            const sevResponse = await fetch(`${ML_SERVICE_URL}/classify-severity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symptoms, dosha: dosha || "Unknown" }),
            });
            severityResult = await sevResponse.json();
        } catch (e) {
            console.log("RF Classifier unavailable:", e.message);
        }

        // 2. Call RF Regressor for session prediction
        try {
            const sessResponse = await fetch(`${ML_SERVICE_URL}/predict-sessions`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    severity: severityResult?.severity_score || 5,
                    dosha: dosha || "Unknown",
                    age: age || 35,
                    gender: gender || "Unknown",
                }),
            });
            sessionPrediction = await sessResponse.json();
        } catch (e) {
            console.log("RF Regressor unavailable:", e.message);
        }

        res.json({
            success: true,
            severity: severityResult,
            sessionPrediction,
        });
    } catch (error) {
        console.error("ML analysis error:", error);
        res.status(500).json({ success: false, error: "ML analysis failed" });
    }
});

export default router;
