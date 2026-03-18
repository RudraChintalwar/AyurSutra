import "dotenv/config";
import express from "express";
import cors from "cors";

import schedulingRoutes from "./routes/scheduling.js";
import chatbotRoutes from "./routes/chatbot.js";
import notificationRoutes from "./routes/notifications.js";

const app = express();
const PORT = process.env.PORT || 3001;

// ─── Middleware ───────────────────────────────────────────
app.use(cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
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
});
