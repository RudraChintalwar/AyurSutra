import "dotenv/config";
import express from "express";
import cors from "cors";

import schedulingRoutes from "./routes/scheduling.js";
import chatbotRoutes from "./routes/chatbot.js";
import notificationRoutes from "./routes/notifications.js";
import calendarRoutes from "./routes/calendar.js";
import doctorsRoutes from "./routes/doctors.js";
import sessionsRoutes from "./routes/sessions.js";
import { startNightlyScoringJob } from "./jobs/nightlyScoring.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────
const corsOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
app.use(cors({
    origin: corsOrigins,
    credentials: true,
}));
app.use(express.json({ limit: "10mb" }));

// ─── Health Check ────────────────────────────────────────
app.get("/api/health", (req, res) => {
    res.json({
        status: "ok",
        service: "AyurSutra API Server",
        timestamp: new Date().toISOString(),
    });
});

// ─── Routes ──────────────────────────────────────────────
app.use("/api/scheduling", schedulingRoutes);
app.use("/api/chatbot", chatbotRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/calendar", calendarRoutes);
app.use("/api/doctors", doctorsRoutes);
app.use("/api/sessions", sessionsRoutes);

// ─── Error Handler ───────────────────────────────────────
app.use((err, req, res, next) => {
    console.error("Server error:", err);
    res.status(500).json({
        error: "Internal Server Error",
        message: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
});

// ─── Start ───────────────────────────────────────────────
app.listen(PORT, () => {
    console.log(`🌿 AyurSutra API Server running on http://localhost:${PORT}`);
    const gcal =
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
        process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
        process.env.GOOGLE_OAUTH_REDIRECT_URI;
    if (gcal) {
        console.log("[Calendar] Google OAuth env complete — per-user calendar linking enabled.");
    } else {
        console.warn(
            "[Calendar] GOOGLE_OAUTH_CLIENT_ID / SECRET / REDIRECT_URI incomplete — calendar OAuth disabled."
        );
    }
    // Start nightly CRON for priority score recalculation
    try {
        startNightlyScoringJob();
        console.log('📊 Nightly scoring CRON job started (midnight IST)');
    } catch (err) {
        console.warn('⚠️ Failed to start nightly scoring CRON:', err.message);
    }
});
