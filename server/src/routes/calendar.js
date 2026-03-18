import express from "express";

const router = express.Router();

/**
 * Google Calendar Integration
 * 
 * To enable:
 * 1. Create a Google Cloud project
 * 2. Enable Google Calendar API
 * 3. Create OAuth2 credentials or a service account
 * 4. Set environment variables:
 *    - GOOGLE_CALENDAR_CLIENT_ID
 *    - GOOGLE_CALENDAR_CLIENT_SECRET
 *    - GOOGLE_CALENDAR_REDIRECT_URI
 *    - GOOGLE_CALENDAR_REFRESH_TOKEN
 */

const GOOGLE_CREDS = {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    redirectUri: process.env.GOOGLE_CALENDAR_REDIRECT_URI,
    refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN,
};

const isConfigured = () => Boolean(GOOGLE_CREDS.clientId && GOOGLE_CREDS.clientSecret);

// ─── Create Calendar Event ───────────────────────────────
router.post("/create-event", async (req, res) => {
    try {
        const { summary, description, startTime, endTime, patientEmail, therapy } = req.body;

        if (!isConfigured()) {
            // Stub mode — log the event
            console.log(`[Google Calendar Stub] Event: ${summary || therapy}`);
            console.log(`  Start: ${startTime}, End: ${endTime}`);
            console.log(`  Patient: ${patientEmail}`);
            return res.json({
                success: true,
                eventId: `stub_${Date.now()}`,
                message: "Calendar event logged (Google Calendar API not configured). Set GOOGLE_CALENDAR_CLIENT_ID and GOOGLE_CALENDAR_CLIENT_SECRET to enable.",
                stub: true,
            });
        }

        // Real Google Calendar API integration
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(
            GOOGLE_CREDS.clientId,
            GOOGLE_CREDS.clientSecret,
            GOOGLE_CREDS.redirectUri
        );
        oauth2Client.setCredentials({ refresh_token: GOOGLE_CREDS.refreshToken });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });

        const event = {
            summary: summary || `🌿 AyurSutra: ${therapy} Session`,
            description: description || `Panchakarma therapy session: ${therapy}`,
            start: {
                dateTime: new Date(startTime).toISOString(),
                timeZone: "Asia/Kolkata",
            },
            end: {
                dateTime: new Date(endTime || new Date(startTime).getTime() + 90 * 60000).toISOString(),
                timeZone: "Asia/Kolkata",
            },
            attendees: patientEmail ? [{ email: patientEmail }] : [],
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "email", minutes: 24 * 60 }, // 1 day before
                    { method: "popup", minutes: 60 },      // 1 hour before
                ],
            },
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
            message: "Calendar event created successfully",
        });
    } catch (error) {
        console.error("Calendar event error:", error);
        res.status(500).json({ success: false, error: "Failed to create calendar event" });
    }
});

// ─── Delete Calendar Event ───────────────────────────────
router.delete("/delete-event/:eventId", async (req, res) => {
    try {
        const { eventId } = req.params;

        if (!isConfigured()) {
            return res.json({ success: true, message: "Event delete logged (stub mode)" });
        }

        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(
            GOOGLE_CREDS.clientId,
            GOOGLE_CREDS.clientSecret,
            GOOGLE_CREDS.redirectUri
        );
        oauth2Client.setCredentials({ refresh_token: GOOGLE_CREDS.refreshToken });

        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        await calendar.events.delete({ calendarId: "primary", eventId });

        res.json({ success: true, message: "Calendar event deleted" });
    } catch (error) {
        console.error("Calendar delete error:", error);
        res.status(500).json({ success: false, error: "Failed to delete calendar event" });
    }
});

export default router;
