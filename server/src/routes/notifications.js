import express from "express";
import nodemailer from "nodemailer";

const router = express.Router();

// Gmail SMTP transporter (configure with app password)
const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
        user: process.env.EMAIL_USER || "",
        pass: process.env.EMAIL_PASS || "",
    },
});

// ─── Send email notification ─────────────────────────────
router.post("/send-email", async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;

        if (!process.env.EMAIL_USER) {
            console.log(`[Email] To: ${to}, Subject: ${subject}`);
            return res.json({
                success: true,
                message: "Email logged (SMTP not configured)",
            });
        }

        await transporter.sendMail({
            from: `"AyurSutra" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html: html || undefined,
            text: text || undefined,
        });

        res.json({ success: true, message: "Email sent successfully" });
    } catch (error) {
        console.error("Email error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to send email",
        });
    }
});

// ─── Send session reminder ───────────────────────────────
router.post("/session-reminder", async (req, res) => {
    try {
        const { patientEmail, patientName, therapy, datetime, precautions } =
            req.body;

        const formattedDate = new Date(datetime).toLocaleString("en-IN", {
            weekday: "long",
            day: "numeric",
            month: "long",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "Asia/Kolkata",
        });

        const html = `
      <div style="font-family: 'Inter', Arial, sans-serif; max-width: 600px; margin: 0 auto; background: #FFF8F0; padding: 32px; border-radius: 16px;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #2C6E49; font-size: 28px; margin: 0;">🌿 AyurSutra</h1>
          <p style="color: #8B6F47; margin: 4px 0;">Session Reminder</p>
        </div>
        <div style="background: white; padding: 24px; border-radius: 12px; border: 1px solid #e5e7eb;">
          <p style="color: #374151; font-size: 16px;">Namaste ${patientName},</p>
          <p style="color: #6b7280;">Your <strong style="color: #2C6E49;">${therapy}</strong> session is scheduled for:</p>
          <div style="background: #f0fdf4; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
            <p style="font-size: 18px; font-weight: 600; color: #2C6E49; margin: 0;">${formattedDate}</p>
          </div>
          ${precautions?.length
                ? `<div style="margin-top: 16px;">
              <p style="font-weight: 600; color: #374151;">Pre-session Guidelines:</p>
              <ul style="color: #6b7280; padding-left: 20px;">
                ${precautions.map((p) => `<li>${p}</li>`).join("")}
              </ul>
            </div>`
                : ""
            }
          <p style="color: #6b7280; font-size: 14px; margin-top: 24px;">May your healing journey be blessed. 🙏</p>
        </div>
      </div>
    `;

        if (!process.env.EMAIL_USER) {
            console.log(
                `[Session Reminder] To: ${patientEmail}, Therapy: ${therapy}, Date: ${formattedDate}`
            );
            return res.json({
                success: true,
                message: "Reminder logged (SMTP not configured)",
            });
        }

        await transporter.sendMail({
            from: `"AyurSutra" <${process.env.EMAIL_USER}>`,
            to: patientEmail,
            subject: `🌿 Session Reminder: ${therapy} on ${formattedDate}`,
            html,
        });

        res.json({ success: true, message: "Reminder sent" });
    } catch (error) {
        console.error("Reminder error:", error);
        res.status(500).json({ success: false, error: "Failed to send reminder" });
    }
});

export default router;
