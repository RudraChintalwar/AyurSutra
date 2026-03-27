/**
 * Per-user Google.primary calendar via OAuth2 refresh tokens.
 * Firestore: users/{uid}/integrations/calendar — client access denied in rules.
 */
import { admin } from "../middleware/auth.js";

const db = () => admin.firestore();

function oauthEnvOk() {
    return Boolean(
        process.env.GOOGLE_OAUTH_CLIENT_ID &&
            process.env.GOOGLE_OAUTH_CLIENT_SECRET &&
            process.env.GOOGLE_OAUTH_REDIRECT_URI
    );
}

async function buildCalendarClientForUid(uid) {
    if (!uid || !oauthEnvOk()) return null;

    const integRef = db().collection("users").doc(uid).collection("integrations").doc("calendar");
    const integSnap = await integRef.get();
    if (!integSnap.exists) return null;

    const { refreshToken, accessToken, accessTokenExpiresAt } = integSnap.data();
    if (!refreshToken && !accessToken) return null;

    const { google } = await import("googleapis");
    const oauth2Client = new google.auth.OAuth2(
        process.env.GOOGLE_OAUTH_CLIENT_ID,
        process.env.GOOGLE_OAUTH_CLIENT_SECRET,
        process.env.GOOGLE_OAUTH_REDIRECT_URI
    );
    oauth2Client.setCredentials({
        refresh_token: refreshToken || undefined,
        access_token: accessToken || undefined,
        expiry_date: accessTokenExpiresAt ? new Date(accessTokenExpiresAt).getTime() : undefined,
    });

    oauth2Client.on("tokens", async (tokens) => {
        try {
            const patch = { updatedAt: new Date().toISOString() };
            if (tokens.access_token) patch.accessToken = tokens.access_token;
            if (tokens.expiry_date) patch.accessTokenExpiresAt = new Date(tokens.expiry_date).toISOString();
            if (tokens.refresh_token) patch.refreshToken = tokens.refresh_token;
            await integRef.set(patch, { merge: true });
        } catch (e) {
            console.warn("[Calendar] Token persist failed:", e.message);
        }
    });

    const calendar = google.calendar({ version: "v3", auth: oauth2Client });
    return { calendar, integRef, oauth2Client };
}

export async function listAyurSutraEventsForUser(uid) {
    const built = await buildCalendarClientForUid(uid);
    if (!built) {
        return { events: [], stub: true };
    }
    try {
        const now = new Date();
        const end = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
        const response = await built.calendar.events.list({
            calendarId: "primary",
            timeMin: now.toISOString(),
            timeMax: end.toISOString(),
            maxResults: 50,
            singleEvents: true,
            orderBy: "startTime",
            q: "[AyurSutra]",
        });
        const events = (response.data.items || []).map((event) => ({
            id: event.id,
            summary: event.summary,
            description: event.description,
            start: event.start?.dateTime || event.start?.date,
            end: event.end?.dateTime || event.end?.date,
            htmlLink: event.htmlLink,
            status: event.status,
        }));
        return { events, stub: false };
    } catch (err) {
        console.error("[Calendar] list failed for", uid, err?.message || err);
        return { events: [], stub: true, error: err?.message };
    }
}

export async function insertAyurSutraCalendarEventForUser(uid, { summary, description, startIso, endIso }) {
    if (!uid) {
        return { eventId: null, htmlLink: null, stub: true, reason: "no_uid" };
    }
    if (!oauthEnvOk()) {
        console.warn("[Calendar] Missing GOOGLE_OAUTH_* — skip insert.");
        return { eventId: null, htmlLink: null, stub: true, reason: "oauth_not_configured" };
    }

    const built = await buildCalendarClientForUid(uid);
    if (!built) {
        return { eventId: null, htmlLink: null, stub: true, reason: "not_linked" };
    }

    try {
        const event = {
            summary: summary.startsWith("[AyurSutra]") ? summary : `🌿 [AyurSutra] ${summary}`,
            description:
                (description || "") +
                "\n\n— AyurSutra · Notifications use your Google Calendar reminders below.",
            start: { dateTime: new Date(startIso).toISOString(), timeZone: "Asia/Kolkata" },
            end: { dateTime: new Date(endIso).toISOString(), timeZone: "Asia/Kolkata" },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "email", minutes: 24 * 60 },
                    { method: "popup", minutes: 120 },
                    { method: "popup", minutes: 15 },
                ],
            },
            colorId: "2",
        };

        const response = await built.calendar.events.insert({
            calendarId: "primary",
            resource: event,
            sendUpdates: "none",
        });

        return {
            eventId: response.data.id || null,
            htmlLink: response.data.htmlLink || null,
            stub: false,
        };
    } catch (err) {
        console.error("[Calendar] insert failed for user", uid, err?.message || err);
        return {
            eventId: null,
            htmlLink: null,
            stub: true,
            error: err?.message,
            reason: "api_error",
        };
    }
}

/** Legacy: short-lived access token from Firebase popup (stored on user doc — discouraged). */
export async function insertAyurSutraCalendarEventWithAccessToken(accessToken, payload) {
    if (!accessToken) {
        return { eventId: null, htmlLink: null, stub: true, reason: "no_token" };
    }
    try {
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        const event = {
            summary: payload.summary.startsWith("[AyurSutra]")
                ? payload.summary
                : `🌿 [AyurSutra] ${payload.summary}`,
            description: payload.description,
            start: { dateTime: new Date(payload.startIso).toISOString(), timeZone: "Asia/Kolkata" },
            end: { dateTime: new Date(payload.endIso).toISOString(), timeZone: "Asia/Kolkata" },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: "email", minutes: 24 * 60 },
                    { method: "popup", minutes: 120 },
                    { method: "popup", minutes: 15 },
                ],
            },
            colorId: "2",
        };
        const response = await calendar.events.insert({
            calendarId: "primary",
            resource: event,
            sendUpdates: "none",
        });
        return {
            eventId: response.data.id || null,
            htmlLink: response.data.htmlLink || null,
            stub: false,
        };
    } catch (err) {
        console.error("[Calendar] legacy token insert failed:", err?.message || err);
        return { eventId: null, htmlLink: null, stub: true, error: err?.message };
    }
}

async function safeDeleteEvent(calendar, eventId) {
    if (!eventId || !calendar) return;
    try {
        await calendar.events.delete({ calendarId: "primary", eventId, sendUpdates: "none" });
    } catch (err) {
        const status = err?.code || err?.response?.status;
        if (status === 404 || err?.errors?.[0]?.reason === "notFound") return;
        console.warn("[Calendar] delete event failed:", eventId, err?.message || err);
    }
}

/** Remove one event from a user's primary calendar (integration or legacy token). */
export async function deleteAyurSutraCalendarEventForUser(uid, eventId) {
    if (!uid || !eventId) return { ok: true, skipped: true };
    if (!oauthEnvOk()) return { ok: true, skipped: true, reason: "oauth_not_configured" };

    const built = await buildCalendarClientForUid(uid);
    if (built) {
        await safeDeleteEvent(built.calendar, eventId);
        return { ok: true };
    }
    return { ok: true, stub: true, reason: "not_linked" };
}

export async function deleteAyurSutraCalendarEventWithAccessToken(accessToken, eventId) {
    if (!accessToken || !eventId) return { ok: true, skipped: true };
    try {
        const { google } = await import("googleapis");
        const oauth2Client = new google.auth.OAuth2();
        oauth2Client.setCredentials({ access_token: accessToken });
        const calendar = google.calendar({ version: "v3", auth: oauth2Client });
        await safeDeleteEvent(calendar, eventId);
        return { ok: true };
    } catch (err) {
        console.warn("[Calendar] legacy delete failed:", err?.message || err);
        return { ok: false, error: err?.message };
    }
}

/**
 * Deletes doctor/patient AyurSutra events for a session (Google only; Firestore unchanged).
 * Uses per-user integration first; falls back to legacy tokens when provided.
 */
export async function removeSessionCalendarEventsFromGoogle(session, legacy = {}) {
    const doctorUid = session.practitioner_id || null;
    const patientUid = session.patient_id || null;
    const doctorEventId = session.gcal_event_id_doctor || null;
    const patientEventId = session.gcal_event_id_patient || null;

    const out = { doctor: null, patient: null };

    if (doctorUid && doctorEventId) {
        const r = await deleteAyurSutraCalendarEventForUser(doctorUid, doctorEventId);
        if (r.stub && legacy.doctorLegacyToken) {
            await deleteAyurSutraCalendarEventWithAccessToken(legacy.doctorLegacyToken, doctorEventId);
            out.doctor = "legacy";
        } else {
            out.doctor = r.stub ? "skipped" : "ok";
        }
    }

    if (patientUid && patientEventId) {
        const r = await deleteAyurSutraCalendarEventForUser(patientUid, patientEventId);
        if (r.stub && legacy.patientLegacyToken) {
            await deleteAyurSutraCalendarEventWithAccessToken(legacy.patientLegacyToken, patientEventId);
            out.patient = "legacy";
        } else {
            out.patient = r.stub ? "skipped" : "ok";
        }
    }

    return out;
}
