import express from "express";
import Groq from "groq-sdk";

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

export default router;
