import express from "express";

const router = express.Router();
const PYTHON_CHATBOT_URL = process.env.PYTHON_CHATBOT_URL || "http://localhost:8000";

// ─── Chat with Digital Vaidya (Ayurvedic AI Assistant) ───
router.post("/chat", async (req, res) => {
    try {
        const { message, language = "en" } = req.body;

        console.log(`[Chatbot] Calling Python service: ${PYTHON_CHATBOT_URL}/chat`);
        console.log(`[Chatbot] Message: "${message}", Language: ${language}`);

        // Call Python chatbot service
        const response = await fetch(`${PYTHON_CHATBOT_URL}/chat`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                language,
            }),
        });

        console.log(`[Chatbot] Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Chatbot] Python service error: ${response.statusText}`, errorText);
            throw new Error(`Python service error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[Chatbot] Response received:`, data);

        res.json({
            success: true,
            reply: data.bot_response,
            language: data.language,
        });
    } catch (error) {
        console.error("[Chatbot] Error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to get response from AyurVaidya",
        });
    }
});

// ─── Generate Speech from Text ───
router.post("/generate-speech", async (req, res) => {
    try {
        const { message, language = "en" } = req.body;

        console.log(`[Speech] Calling Python service: ${PYTHON_CHATBOT_URL}/generate-speech`);

        const response = await fetch(`${PYTHON_CHATBOT_URL}/generate-speech`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                message,
                language,
            }),
        });

        console.log(`[Speech] Response status: ${response.status}`);

        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[Speech] Python service error: ${response.statusText}`, errorText);
            throw new Error(`Python service error: ${response.statusText}`);
        }

        const data = await response.json();
        console.log(`[Speech] Response received:`, data);

        res.json(data);
    } catch (error) {
        console.error("[Speech] Error:", error.message);
        res.status(500).json({
            success: false,
            error: "Failed to generate speech",
        });
    }
});


export default router;
