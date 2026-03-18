import express from "express";

const router = express.Router();

/**
 * Google Calendar Integration (Per-User Access Tokens)
 *
 * Each user's Google OAuth access token is stored in Firestore
 * and passed with API requests. No static service account needed.
 *
 * Client ID: Configured in Firebase Console
 * Scopes: calendar.events (requested during Google Sign-In)
 */

// ─── Helper: Create OAuth2 client from user's access token ──
const getCalendarClient = async (accessToken) => {
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: "v3", auth: oauth2Client });
};

// ─── Create Calendar Event ───────────────────────────────
router.post("/create-event", async (req, res) => {
    try {
        const { summary, description, startTime, endTime, patientEmail, doctorEmail, therapy, accessToken } = req.body;

        if (!accessToken) {
            // Stub mode — no access token provided
            console.log(`[Google Calendar Stub] Event: ${summary || therapy}`);
            console.log(`  Start: ${startTime}, End: ${endTime}`);
            console.log(`  Patient: ${patientEmail}, Doctor: ${doctorEmail}`);
            return res.json({
                success: true,
                eventId: `stub_${Date.now()}`,
                message: "Calendar event logged (no access token provided). Sign in with Google to enable calendar sync.",
                stub: true,
            });
        }

        const calendar = await getCalendarClient(accessToken);

        // Build attendees list
        const attendees = [];
        if (patientEmail) attendees.push({ email: patientEmail });
        if (doctorEmail) attendees.push({ email: doctorEmail });

        const event = {
            summary: summary || `🌿 [AyurSutra] ${therapy} Session`,
            description: description || `Panchakarma therapy session: ${therapy}\n\nBooked via AyurSutra - Ancient Wisdom, Modern Healing`,
            start: {
                dateTime: new Date(startTime).toISOString(),
                timeZone: "Asia/Kolkata",
            },
            end: {
                dateTime: new Date(endTime || new Date(startTime).getTime() + 90 * 60000).toISOString(),
                timeZone: "Asia/Kolkata",
            },
            attendees,
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "email", minutes: 24 * 60 }, // 1 day before
                    { method: "popup", minutes: 60 },      // 1 hour before
                    { method: "popup", minutes: 15 },      // 15 min before
                ],
            },
            colorId: "2", // Sage green
        };

        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
            sendUpdates: "all",
        });

        res.json({
            success: true,
            eventId: response.data.id,
            htmlLink: response.data.htmlLink,
            message: "Calendar event created on your Google Calendar!",
        });
    } catch (error) {
        console.error("Calendar event error:", error?.message || error);
        // If token expired / invalid
        if (error?.code === 401 || error?.response?.status === 401) {
            return res.status(401).json({
                success: false,
                error: "Google access token expired. Please sign in again.",
                tokenExpired: true,
            });
        }
        res.status(500).json({ success: false, error: "Failed to create calendar event" });
    }
});

// ─── List Calendar Events (AyurSutra only) ───────────────
router.get("/list-events", async (req, res) => {
    try {
        const accessToken = req.headers.authorization?.replace("Bearer ", "");

        if (!accessToken) {
            return res.json({
                success: true,
                events: [],
                message: "No access token — sign in with Google to see calendar events.",
                stub: true,
            });
        }

        const calendar = await getCalendarClient(accessToken);

        // Fetch upcoming events from the next 30 days that contain [AyurSutra]
        const now = new Date();
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const response = await calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: thirtyDaysFromNow.toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: "startTime",
            q: "[AyurSutra]", // Only fetch events with our tag
        });

        const events = (response.data.items || []).map((event) => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            htmlLink: event.htmlLink,
            attendees: (event.attendees || []).map((a) => ({
                email: a.email,
                responseStatus: a.responseStatus,
            })),
            status: event.status,
            created: event.created,
        }));

        res.json({
            success: true,
            events,
            count: events.length,
        });
    } catch (error) {
        console.error("Calendar list error:", error?.message || error);
        if (error?.code === 401 || error?.response?.status === 401) {
            return res.status(401).json({
                success: false,
                error: "Google access token expired. Please sign in again.",
                tokenExpired: true,
            });
        }
        res.status(500).json({ success: false, error: "Failed to list calendar events" });
    }
});

// ─── Delete Calendar Event ───────────────────────────────
router.delete("/delete-event/:eventId", async (req, res) => {
    try {
        const { eventId } = req.params;
        const accessToken = req.headers.authorization?.replace("Bearer ", "");

        if (!accessToken) {
            return res.json({ success: true, message: "Event delete logged (no token — stub mode)" });
        }

        const calendar = await getCalendarClient(accessToken);
        await calendar.events.delete({ calendarId: "primary", eventId });

        res.json({ success: true, message: "Calendar event deleted" });
    } catch (error) {
        console.error("Calendar delete error:", error?.message || error);
        if (error?.code === 401 || error?.response?.status === 401) {
            return res.status(401).json({
                success: false,
                error: "Google access token expired. Please sign in again.",
                tokenExpired: true,
            });
        }
        res.status(500).json({ success: false, error: "Failed to delete calendar event" });
    }
});

export default router;
