import express from "express";
import Groq from "groq-sdk";
import { calculatePriorityScore, buildPriorityQueue, bumpAndReschedule, MaxHeap } from "../utils/priorityQueue.js";
import { sendEmail } from "./notifications.js";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const ML_SERVICE_URL = process.env.ML_SERVICE_URL || "http://localhost:8000";

// ─── Asset Inventory (Mock physical constraint DB) ────────
const ASSET_INVENTORY = {
    "Virechana": { room: "Detox Room A", specializedTherapists: ["Dr. Sharma", "Dr. Iyer"] },
    "Vamana": { room: "Emesis Suite", specializedTherapists: ["Dr. Patel"] },
    "Basti": { room: "Enema Care Room", specializedTherapists: ["Dr. Verma", "Dr. Singh"] },
    "Nasya": { room: "Head & Neck Clinic", specializedTherapists: ["Dr. Rao"] },
    "Shirodhara": { room: "Relaxation Suite", specializedTherapists: ["Dr. Nair", "Dr. Menon"] },
    "Abhyanga": { room: "Massage Therapy Room", specializedTherapists: ["Dr. Kaur", "Dr. Das"] }
};

// ═══════════════════════════════════════════════════════════
// PHASE 1: PATIENT INTAKE — ML Prediction + Clinical Summary
// ═══════════════════════════════════════════════════════════

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

        // 2. Get RF Classifier severity score or dynamic symptom based severity
        let severityScore = 5;
        try {
            const sevResponse = await fetch(`${ML_SERVICE_URL}/classify-severity`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ symptoms: symptoms.map(s => s.name).join(", "), dosha: dosha || "Unknown" }),
            });
            const sevData = await sevResponse.json();
            severityScore = sevData.severity_score || 5;
        } catch (e) {
            console.log("RF Classifier unavailable, using dynamic severity from sliders:", e.message);
            if (symptoms && symptoms.length > 0) {
                 severityScore = Math.max(...symptoms.map(s => s.score || 5));
            }
        }

        // 3. Use Groq LLM for comprehensive recommendation
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
  "precautions_post": ["<post-procedure care 1>", "<care 2>", "<care 3>"],
  "clinical_summary": "<A 3-4 sentence professional clinical summary for the doctor reviewing this case. Include the key findings, symptom analysis, and rationale for the recommended therapy.>"
}`;

        const completion = await groq.chat.completions.create({
            messages: [{ role: "user", content: prompt }],
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 600,
            response_format: { type: "json_object" },
        });

        const recommendation = JSON.parse(
            completion.choices[0]?.message?.content || "{}"
        );

        // 4. Calculate initial priority score
        const priorityResult = calculatePriorityScore({
            severityScore: severityScore,
            feedbackEscalation: false,
            feedbackMultiplier: 1.0,
            dosha: dosha || "",
            slotDatetime: null,
            createdAt: new Date().toISOString(),
        });

        res.json({
            success: true,
            recommendation: {
                ...recommendation,
                severity_score: severityScore,
            },
            mlPrediction: mlPrediction?.predictions || null,
            priorityResult,
        });
    } catch (error) {
        console.error("Prediction error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to generate recommendation",
        });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 1: SLOT GENERATION with Asset Allocation
// ═══════════════════════════════════════════════════════════

router.post("/slots", async (req, res) => {
    try {
        const { practitionerId, spacingDays, sessionsNeeded, startDate, therapy, durationMinutes } = req.body;

        const slots = [];
        const start = new Date(startDate || Date.now());
        start.setDate(start.getDate() + 1);

        const therapyKey = therapy || "General";
        const requiredAssets = ASSET_INVENTORY[therapyKey] || { 
            room: "General Panchakarma Room", 
            specializedTherapists: ["Available General Staff"] 
        };

        let currentSlotTime = new Date(start);
        const actualSpacing = parseInt(spacingDays) || 3;
        const totalNeeded = parseInt(sessionsNeeded) || 3;

        while (slots.length < totalNeeded) {
            // Apply spacing after the first slot
            if (slots.length > 0) {
                currentSlotTime.setDate(currentSlotTime.getDate() + actualSpacing);
            }
            
            // Randomly assign morning or afternoon
            const isMorning = Math.random() > 0.5;
            const slotHour = isMorning ? 9 : 14;
            currentSlotTime.setHours(slotHour, 0, 0, 0);

            // Skip weekends completely
            if (currentSlotTime.getDay() === 0) { // Sunday
                currentSlotTime.setDate(currentSlotTime.getDate() + 1);
            }

            slots.push({
                datetime: currentSlotTime.toISOString(),
                allocatedRoom: requiredAssets.room,
                assignedTherapist: requiredAssets.specializedTherapists[Math.floor(Math.random() * requiredAssets.specializedTherapists.length)],
                durationBlocked: durationMinutes || 90
            });
        }

        res.json({ 
            success: true, 
            slots: slots.map(s => s.datetime),
            assetDetails: slots
        });
    } catch (error) {
        console.error("Slot generation error:", error);
        res.status(500).json({ success: false, error: "Failed to generate slots" });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 2: DOCTOR REVIEW — Approve / Modify / Reject
// ═══════════════════════════════════════════════════════════

router.post("/appointments/:id/review", async (req, res) => {
    try {
        const { id } = req.params;
        const { action, doctorId, doctorName, modifiedTherapy, modifiedDates, modifiedSessions } = req.body;

        if (!["approved", "modified", "rejected"].includes(action)) {
            return res.status(400).json({ success: false, error: "Invalid action. Use: approved, modified, rejected" });
        }

        const updateData = {
            doctor_approval: action,
            approved_at: new Date().toISOString(),
            approved_by: doctorId || "doctor",
            approved_by_name: doctorName || "Doctor",
            status: action === "rejected" ? "rejected" : "confirmed", // Set status based on action
        };

        if (action === "modified") {
            if (modifiedTherapy) updateData.therapy = modifiedTherapy;
            if (modifiedSessions) updateData.sessions_recommended = modifiedSessions;
            if (modifiedDatetime) updateData.datetime = new Date(modifiedDatetime).toISOString();
        }

        // Return the update payload — the frontend will apply it to Firestore
        res.json({
            success: true,
            sessionId: id,
            updateData,
            message: `Appointment ${action} successfully`,
        });
    } catch (error) {
        console.error("Review error:", error);
        res.status(500).json({ success: false, error: "Failed to process review" });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 3: CONFLICT CHECK & AUTO-BUMP
// ═══════════════════════════════════════════════════════════

router.post("/check-conflicts", async (req, res) => {
    try {
        const { highPrioritySession, allScheduledSessions, availableSlots } = req.body;

        if (!highPrioritySession) {
            return res.status(400).json({ success: false, error: "highPrioritySession required" });
        }

        // Calculate priority for the incoming session if not already done
        let priorityScore = highPrioritySession.totalPriorityScore || highPrioritySession.priority || 50;

        // If priority is > 85, attempt bump
        if (priorityScore > 85 && allScheduledSessions && allScheduledSessions.length > 0) {
            const result = bumpAndReschedule(
                { ...highPrioritySession, priorityScore },
                allScheduledSessions,
                availableSlots || []
            );

            if (result.bumped) {
                // Send dual notifications
                const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

                // 1. Notify bumped patient
                if (result.bumpedSession.patientEmail || result.bumpedSession.email) {
                    try {
                        await sendEmail({
                            to: result.bumpedSession.patientEmail || result.bumpedSession.email,
                            subject: "⚠️ Urgent: Your Session Has Been Rescheduled",
                            html: `<p>Namaste,</p>
                                <p>Your <b>${result.bumpedSession.therapy}</b> session has been rescheduled to accommodate an acute care requirement.</p>
                                <p><b>New Time:</b> ${result.bumpedSession.newDatetime ? formatDT(result.bumpedSession.newDatetime) : 'Please check your dashboard'}</p>
                                <p>We sincerely apologize for the inconvenience. 🙏</p>`
                        });
                    } catch (emailErr) {
                        console.error("Failed to email bumped patient:", emailErr.message);
                    }
                }

                // 2. Notify high-priority patient
                if (result.insertedSession.patientEmail || result.insertedSession.email) {
                    try {
                        await sendEmail({
                            to: result.insertedSession.patientEmail || result.insertedSession.email,
                            subject: "🌿 Emergency Priority Slot Confirmed",
                            html: `<p>Namaste,</p>
                                <p>An urgent priority slot has been secured for your <b>${result.insertedSession.therapy}</b> session.</p>
                                <p><b>Confirmed Time:</b> ${formatDT(result.insertedSession.datetime)}</p>
                                <p>Please arrive 15 minutes early. 🙏</p>`
                        });
                    } catch (emailErr) {
                        console.error("Failed to email high-priority patient:", emailErr.message);
                    }
                }
            }

            return res.json({ success: true, ...result });
        }

        res.json({ success: true, bumped: false, reason: "Priority not high enough for bump or no conflicts" });
    } catch (error) {
        console.error("Conflict check error:", error);
        res.status(500).json({ success: false, error: "Failed to check conflicts" });
    }
});

// ═══════════════════════════════════════════════════════════
// PHASE 4: FEEDBACK ESCALATION — Emergency Reschedule
// ═══════════════════════════════════════════════════════════

router.post("/feedback-escalation", async (req, res) => {
    try {
        const { sessionId, patientId, patientName, patientEmail, therapy, feedback, currentSeverity, dosha, allScheduledSessions, availableSlots } = req.body;

        // 1. Analyze feedback with LLM
        let llmAnalysis = null;
        try {
            const prompt = `You are an Ayurvedic physician reviewing urgent post-therapy feedback. The patient reports adverse effects.

Patient: ${patientName || "Patient"}
Therapy: ${therapy || "Panchakarma"}
Feedback: ${JSON.stringify(feedback)}

Determine the urgency and respond in this exact JSON format:
{
  "action": "<one of: emergency_followup, increase_priority, add_session, monitor>",
  "urgency_level": "<critical, high, moderate>",
  "explanation": "<1-2 sentence explanation for both patient and doctor>",
  "new_severity_score": <number 1-10>,
  "care_instructions": ["<instruction 1>", "<instruction 2>"]
}`;

            const completion = await groq.chat.completions.create({
                messages: [{ role: "user", content: prompt }],
                model: "llama-3.3-70b-versatile",
                temperature: 0.2,
                max_tokens: 300,
                response_format: { type: "json_object" },
            });

            llmAnalysis = JSON.parse(completion.choices[0]?.message?.content || "{}");
        } catch (err) {
            console.error("LLM analysis failed, using defaults:", err.message);
            llmAnalysis = {
                action: "emergency_followup",
                urgency_level: "high",
                explanation: "Adverse effects detected. Immediate follow-up recommended.",
                new_severity_score: 9,
                care_instructions: ["Rest immediately", "Contact doctor if symptoms worsen"]
            };
        }

        // 2. Recalculate priority with escalation
        const newSeverity = llmAnalysis.new_severity_score || Math.min((currentSeverity || 5) + 3, 10);
        const escalatedPriority = calculatePriorityScore({
            severityScore: newSeverity,
            feedbackEscalation: true,
            feedbackMultiplier: 2.5,
            dosha: dosha || "",
            slotDatetime: null,
            createdAt: new Date().toISOString(),
        });

        // 3. Build session update payload
        const sessionUpdate = {
            feedback_escalation: true,
            feedback_multiplier: 2.5,
            severity_score: newSeverity,
            totalPriorityScore: escalatedPriority.totalScore,
            priority: escalatedPriority.totalScore,
            escalation_reason: llmAnalysis.explanation,
            escalated_at: new Date().toISOString(),
        };

        // 4. Attempt emergency bump if score is critical
        let bumpResult = { bumped: false };
        if (escalatedPriority.totalScore > 85 && allScheduledSessions && allScheduledSessions.length > 0) {
            const emergencySession = {
                sessionId,
                patientId,
                patientName,
                patientEmail,
                therapy,
                datetime: new Date().toISOString(), // ASAP
                priorityScore: escalatedPriority.totalScore,
                email: patientEmail,
            };

            bumpResult = bumpAndReschedule(emergencySession, allScheduledSessions, availableSlots || []);

            if (bumpResult.bumped) {
                // Send dual notifications
                const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

                if (bumpResult.bumpedSession.patientEmail || bumpResult.bumpedSession.email) {
                    try {
                        await sendEmail({
                            to: bumpResult.bumpedSession.patientEmail || bumpResult.bumpedSession.email,
                            subject: "⚠️ Session Rescheduled — Emergency Protocol",
                            html: `<p>Namaste,</p><p>Your <b>${bumpResult.bumpedSession.therapy}</b> session has been rescheduled due to a medical emergency.</p>
                                <p><b>New Time:</b> ${bumpResult.bumpedSession.newDatetime ? formatDT(bumpResult.bumpedSession.newDatetime) : 'Check your dashboard'}</p>
                                <p>We apologize for the inconvenience. 🙏</p>`
                        });
                    } catch (e) { console.error("Bump email failed:", e.message); }
                }

                if (patientEmail) {
                    try {
                        await sendEmail({
                            to: patientEmail,
                            subject: "🚨 Emergency Follow-Up Scheduled",
                            html: `<p>Namaste ${patientName},</p>
                                <p>Based on your adverse reaction report, an <b>emergency follow-up</b> has been scheduled.</p>
                                <p><b>Time:</b> ${formatDT(bumpResult.insertedSession.datetime)}</p>
                                <p>${llmAnalysis.care_instructions?.join(". ") || ""}</p>
                                <p>Please arrive early. 🙏</p>`
                        });
                    } catch (e) { console.error("Emergency email failed:", e.message); }
                }
            }
        }

        res.json({
            success: true,
            sessionUpdate,
            llmAnalysis,
            escalatedPriority,
            bumpResult,
        });
    } catch (error) {
        console.error("Feedback escalation error:", error);
        res.status(500).json({ success: false, error: "Failed to process feedback escalation" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: Feedback Processing (non-emergency)
// ═══════════════════════════════════════════════════════════

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
        res.status(500).json({ success: false, error: "Failed to process feedback" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: Priority Score Calculator
// ═══════════════════════════════════════════════════════════

router.post("/calculate-priority", async (req, res) => {
    try {
        const { severityScore, feedbackEscalation, feedbackMultiplier, dosha, slotDatetime, createdAt } = req.body;

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

// ═══════════════════════════════════════════════════════════
// EXISTING: Priority Queue Builder
// ═══════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════
// EXISTING: Bump & Reschedule (direct call)
// ═══════════════════════════════════════════════════════════

router.post("/bump", async (req, res) => {
    try {
        const { highPrioritySession, scheduledSessions, availableSlots } = req.body;

        if (!highPrioritySession || !scheduledSessions) {
            return res.status(400).json({ success: false, error: "highPrioritySession and scheduledSessions required" });
        }

        const result = bumpAndReschedule(highPrioritySession, scheduledSessions, availableSlots || []);

        if (result.bumped) {
            const formatDT = (dt) => new Date(dt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", dateStyle: "medium", timeStyle: "short" });

            if (result.bumpedSession.patientEmail || result.bumpedSession.email) {
                try {
                    await sendEmail({
                        to: result.bumpedSession.patientEmail || result.bumpedSession.email,
                        subject: "⚠️ Urgent Update: Session Rescheduled",
                        html: `<p>Namaste,</p><p>Your session for <b>${result.bumpedSession.therapy}</b> has been rescheduled.</p>
                               <p><b>New Time:</b> ${result.bumpedSession.newDatetime ? formatDT(result.bumpedSession.newDatetime) : 'Check your dashboard'}</p>
                               <p>We apologize for the inconvenience. 🙏</p>`
                    });
                } catch (e) { console.error("Bump email failed:", e.message); }
            }

            if (result.insertedSession.patientEmail || result.insertedSession.email) {
                try {
                    await sendEmail({
                        to: result.insertedSession.patientEmail || result.insertedSession.email,
                        subject: "🌿 High-Priority Session Confirmed",
                        html: `<p>Namaste,</p><p>A priority slot has been secured for your <b>${result.insertedSession.therapy}</b> session.</p>
                               <p><b>Time:</b> ${formatDT(result.insertedSession.datetime)}</p><p>Please arrive 15 minutes early. 🙏</p>`
                    });
                } catch (e) { console.error("Priority email failed:", e.message); }
            }
        }

        res.json({ success: true, ...result });
    } catch (error) {
        console.error("Bump error:", error);
        res.status(500).json({ success: false, error: "Failed to bump/reschedule" });
    }
});

// ═══════════════════════════════════════════════════════════
// EXISTING: ML Analysis (Severity + Sessions)
// ═══════════════════════════════════════════════════════════

router.post("/ml-analysis", async (req, res) => {
    try {
        const { symptoms, dosha, age, gender } = req.body;
        let severityResult = null;
        let sessionPrediction = null;

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
