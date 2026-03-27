import express from "express";
import crypto from "crypto";
import { admin } from "../middleware/auth.js";
import {
    insertAyurSutraCalendarEventForUser,
    insertAyurSutraCalendarEventWithAccessToken,
    listAyurSutraEventsForUser,
    removeSessionCalendarEventsFromGoogle,
} from "../utils/googleCalendarUser.js";

const router = express.Router();
const db = admin.firestore();

/**
 * Google Calendar — Phase 2/3
 * - OAuth web flow stores refresh_token in users/{uid}/integrations/calendar (Admin-only path).
 * - Events are created on each user's primary calendar only (their notifications / reminders).
 */

async function verifyFirebaseIdToken(req, res, next) {
    try {
        const h = req.headers.authorization;
        if (!h?.startsWith("Bearer ")) {
            return res.status(401).json({ success: false, error: "Missing Authorization Bearer token" });
        }
        const decoded = await admin.auth().verifyIdToken(h.slice(7));
        req.firebaseUid = decoded.uid;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, error: "Invalid or expired Firebase ID token" });
    }
}

// ═══════════════════════════════════════════════════════════
// OAuth2 — link Google Calendar (offline refresh token)
// ═══════════════════════════════════════════════════════════

router.get("/oauth/start", verifyFirebaseIdToken, async (req, res) => {
    try {
        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
        if (!clientId || !redirectUri) {
            return res.status(503).json({
                success: false,
                error: "Server missing GOOGLE_OAUTH_CLIENT_ID or GOOGLE_OAUTH_REDIRECT_URI",
            });
        }

        const state = crypto.randomBytes(24).toString("hex");
        await db.collection("calendarOAuthStates").doc(state).set({
            uid: req.firebaseUid,
            createdAt: new Date().toISOString(),
            expiresAt: Date.now() + 10 * 60 * 1000,
        });

        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/calendar.events",
            access_type: "offline",
            prompt: "consent",
            include_granted_scopes: "true",
            state,
        });

        const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
        res.json({ success: true, authUrl });
    } catch (e) {
        console.error("oauth/start error:", e);
        res.status(500).json({ success: false, error: "Failed to start OAuth" });
    }
});

router.get("/oauth/callback", async (req, res) => {
    const frontend = process.env.PUBLIC_APP_URL || "http://localhost:5173";
    const redirectErr = (code) => res.redirect(`${frontend}/dashboard?calendar_error=${encodeURIComponent(code)}`);

    try {
        const { code, state, error: googleError } = req.query;
        if (googleError) return redirectErr(String(googleError));
        if (!code || !state) return redirectErr("missing_code_or_state");

        const stateRef = db.collection("calendarOAuthStates").doc(String(state));
        const stateSnap = await stateRef.get();
        if (!stateSnap.exists) return redirectErr("invalid_state");
        const { uid, expiresAt } = stateSnap.data();
        if (expiresAt < Date.now()) {
            await stateRef.delete();
            return redirectErr("expired_state");
        }
        await stateRef.delete();

        const clientId = process.env.GOOGLE_OAUTH_CLIENT_ID;
        const clientSecret = process.env.GOOGLE_OAUTH_CLIENT_SECRET;
        const redirectUri = process.env.GOOGLE_OAUTH_REDIRECT_URI;
        if (!clientId || !clientSecret || !redirectUri) {
            return redirectErr("server_oauth_misconfigured");
        }

        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
        const { tokens } = await oauth2Client.getToken(String(code));

        const integRef = db.collection("users").doc(uid).collection("integrations").doc("calendar");
        await integRef.set(
            {
                refreshToken: tokens.refresh_token || null,
                accessToken: tokens.access_token || null,
                accessTokenExpiresAt: tokens.expiry_date
                    ? new Date(tokens.expiry_date).toISOString()
                    : null,
                scope: tokens.scope || null,
                updatedAt: new Date().toISOString(),
            },
            { merge: true }
        );

        const connected =
            Boolean(tokens.refresh_token) ||
            Boolean(tokens.access_token);
        await db.collection("users").doc(uid).set(
            {
                calendarSyncConnected: connected,
                calendarSyncConnectedAt: connected ? new Date().toISOString() : null,
                googleAccessToken: null,
            },
            { merge: true }
        );

        return res.redirect(`${frontend}/dashboard?calendar_linked=1`);
    } catch (e) {
        console.error("oauth/callback error:", e);
        return redirectErr("token_exchange_failed");
    }
});

// ─── Helper: Create OAuth2 client from user's access token ──
const getCalendarClient = async (accessToken) => {
    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2();
    oauth2Client.setCredentials({ access_token: accessToken });
    return google.calendar({ version: "v3", auth: oauth2Client });
};

// ─── Create Calendar Event ───────────────────────────────
router.post("/create-event", verifyFirebaseIdToken, async (req, res) => {
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

// ─── List Calendar Events (linked account via refresh token) ─────────
/** Disconnect Google Calendar integration (tokens removed server-side). */
router.post("/disconnect", verifyFirebaseIdToken, async (req, res) => {
    try {
        const uid = req.firebaseUid;
        await db.collection("users").doc(uid).collection("integrations").doc("calendar").delete();
        await db.collection("users").doc(uid).set(
            {
                calendarSyncConnected: false,
                calendarSyncDisconnectedAt: new Date().toISOString(),
            },
            { merge: true }
        );
        res.json({ success: true, message: "Google Calendar unlinked from AyurSutra." });
    } catch (e) {
        console.error("calendar disconnect error:", e);
        res.status(500).json({ success: false, error: "Failed to disconnect calendar" });
    }
});

/**
 * Remove AyurSutra events from doctor + patient Google calendars and clear stored event ids on the session.
 * Caller must be the session's practitioner or patient.
 */
router.post("/session-events/remove", verifyFirebaseIdToken, async (req, res) => {
    try {
        const sessionId = req.body?.sessionId;
        if (!sessionId || typeof sessionId !== "string") {
            return res.status(400).json({ success: false, error: "sessionId is required" });
        }
        const sessionRef = db.collection("sessions").doc(sessionId);
        const snap = await sessionRef.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();
        const uid = req.firebaseUid;
        if (s.practitioner_id !== uid && s.patient_id !== uid) {
            return res.status(403).json({ success: false, error: "Not authorized for this session" });
        }
        if (!s.gcal_event_id_doctor && !s.gcal_event_id_patient) {
            return res.json({ success: true, message: "No calendar events linked to this session." });
        }

        let doctorLegacy = null;
        let patientLegacy = null;
        if (s.practitioner_id) {
            const dSnap = await db.collection("users").doc(s.practitioner_id).get();
            doctorLegacy = dSnap.exists ? dSnap.data()?.googleAccessToken : null;
        }
        if (s.patient_id) {
            const pSnap = await db.collection("users").doc(s.patient_id).get();
            patientLegacy = pSnap.exists ? pSnap.data()?.googleAccessToken : null;
        }

        await removeSessionCalendarEventsFromGoogle(s, {
            doctorLegacyToken: doctorLegacy,
            patientLegacyToken: patientLegacy,
        });

        const FieldValue = admin.firestore.FieldValue;
        await sessionRef.update({
            gcal_event_id_doctor: FieldValue.delete(),
            gcal_event_id_patient: FieldValue.delete(),
            gcal_html_link_doctor: FieldValue.delete(),
            gcal_html_link_patient: FieldValue.delete(),
        });

        res.json({ success: true, message: "Session calendar events removed." });
    } catch (e) {
        console.error("session-events/remove error:", e);
        res.status(500).json({ success: false, error: "Failed to remove calendar events" });
    }
});

/**
 * Resync (delete + recreate) a session's existing AyurSutra Google events
 * after its `datetime` changes. Does NOT change session status.
 *
 * Intended for doctor-side emergency bump flows.
 */
router.post("/session-events/resync", verifyFirebaseIdToken, async (req, res) => {
    try {
        const sessionId = req.body?.sessionId;
        if (!sessionId || typeof sessionId !== "string") {
            return res.status(400).json({ success: false, error: "sessionId is required" });
        }

        const sessionRef = db.collection("sessions").doc(sessionId);
        const snap = await sessionRef.get();
        if (!snap.exists) {
            return res.status(404).json({ success: false, error: "Session not found" });
        }
        const s = snap.data();

        const uid = req.firebaseUid;
        const doctorId = s?.practitioner_id || s?.doctorId || null;
        const patientId = s?.patient_id || s?.patientId || null;

        // Legacy compatibility: some sessions may store doctor/patient fields under different keys.
        if (!doctorId || doctorId !== uid) {
            return res.status(403).json({ success: false, error: "Not authorized to resync this session" });
        }

        const datetimeIsoSource = s?.datetime || s?.scheduled_date || s?.slotDatetime || null;
        if (!datetimeIsoSource) {
            return res.status(400).json({ success: false, error: "Session missing datetime field" });
        }

        // Only attempt resync when events were previously created.
        if (!s.gcal_event_id_doctor && !s.gcal_event_id_patient) {
            return res.json({ success: true, skipped: true, message: "No linked Google events to resync." });
        }

        const therapy = s?.therapy || "Panchakarma";
        const durationMin =
            Number(s?.duration_minutes ?? s?.durationMinutes) ||
            (String(therapy).includes("Vamana") ? 120 : 90);

        const startMs = new Date(datetimeIsoSource).getTime();
        if (!Number.isFinite(startMs)) {
            return res.status(400).json({ success: false, error: "Invalid session datetime" });
        }
        const finalDatetimeIso = new Date(startMs).toISOString();
        const endIso = new Date(startMs + durationMin * 60000).toISOString();
        const finalTherapy = therapy;

        // Legacy tokens (older popup flow) are still supported for event delete/insert fallbacks.
        const doctorUserSnap = await db.collection("users").doc(doctorId).get();
        const doctorLegacyToken = doctorUserSnap.exists ? doctorUserSnap.data()?.googleAccessToken : null;

        let patientLegacyToken = null;
        if (patientId) {
            const patientUserSnap = await db.collection("users").doc(patientId).get();
            patientLegacyToken = patientUserSnap.exists ? patientUserSnap.data()?.googleAccessToken : null;
        }

        const sessionForCalendarOps = { ...s, practitioner_id: doctorId, patient_id: patientId };

        // 1) Delete old events by stored ids.
        await removeSessionCalendarEventsFromGoogle(sessionForCalendarOps, {
            doctorLegacyToken,
            patientLegacyToken,
        });

        // 2) Recreate on doctor + patient calendars.
        const doctorPayload = {
            summary: `${finalTherapy} — ${s.patient_name || "Patient"}`,
            description:
                `Your clinic session.\nPatient: ${s.patient_name || "Patient"}\n` +
                `Therapy: ${finalTherapy}\n` +
                `This event is only on your Google Calendar — you will get reminders from Google.`,
            startIso: finalDatetimeIso,
            endIso,
        };

        const patientPayload = s.patient_id
            ? {
                  summary: `${finalTherapy} — Dr. ${s.doctor_name || "Practitioner"}`,
                  description:
                      `Your AyurSutra session.\n` +
                      `Therapy: ${finalTherapy}\n` +
                      `Practitioner: Dr. ${s.doctor_name || "your practitioner"}\n` +
                      `This event is only on your Google Calendar — you will get reminders from Google.`,
                  startIso: finalDatetimeIso,
                  endIso,
              }
            : null;

        let doctorEv = await insertAyurSutraCalendarEventForUser(doctorId, doctorPayload);
        if (doctorEv?.stub && doctorLegacyToken) {
            doctorEv = await insertAyurSutraCalendarEventWithAccessToken(doctorLegacyToken, doctorPayload);
        }

        let patientEv = { eventId: null, htmlLink: null, stub: true };
        if (patientPayload && patientId) {
            patientEv = await insertAyurSutraCalendarEventForUser(patientId, patientPayload);
            if (patientEv?.stub && patientLegacyToken) {
                patientEv = await insertAyurSutraCalendarEventWithAccessToken(patientLegacyToken, patientPayload);
            }
        }

        // 3) Store fresh event ids for future deletes.
        await sessionRef.update({
            gcal_event_id_doctor: doctorEv?.eventId || null,
            gcal_html_link_doctor: doctorEv?.htmlLink || null,
            ...(patientId
                ? {
                      gcal_event_id_patient: patientEv?.eventId || null,
                      gcal_html_link_patient: patientEv?.htmlLink || null,
                  }
                : {}),
            calendar_resynced_at: new Date().toISOString(),
        });

        return res.json({
            success: true,
            resynced: true,
            doctor: { eventId: doctorEv?.eventId || null },
            patient: { eventId: patientEv?.eventId || null },
        });
    } catch (e) {
        console.error("session-events/resync error:", e);
        return res.status(500).json({ success: false, error: "Failed to resync calendar events" });
    }
});

router.get("/list-events/me", verifyFirebaseIdToken, async (req, res) => {
    try {
        const { events, stub, error } = await listAyurSutraEventsForUser(req.firebaseUid);
        res.json({
            success: true,
            events,
            stub: stub || false,
            count: events.length,
            error: error || undefined,
            message: stub
                ? "Connect Google Calendar in Settings to see synced sessions here."
                : undefined,
        });
    } catch (e) {
        console.error("list-events/me error:", e);
        res.status(500).json({ success: false, error: "Failed to list calendar events" });
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
        // Gracefully fail instead of returning 500 so frontend doesn't crash
        return res.status(200).json({
            success: true,
            events: [],
            stub: true,
            error: "Google Calendar access token invalid or expired. Please sign in again."
        });
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
