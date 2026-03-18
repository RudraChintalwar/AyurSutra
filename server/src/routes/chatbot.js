import express from "express";
import Groq from "groq-sdk";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Chat with Digital Vaidya (Ayurvedic AI Assistant) ───
router.post("/chat", async (req, res) => {
    try {
        const { message, conversationHistory = [], userProfile } = req.body;

        const systemPrompt = `You are "AyurVaidya", a knowledgeable and compassionate AI Ayurvedic health assistant for AyurSutra platform. You have deep expertise in:

1. **Ayurvedic Medicine**: Tridosha theory (Vata, Pitta, Kapha), Prakriti assessment, and balancing techniques
2. **Panchakarma Therapies**: Vamana, Virechana, Basti, Nasya, Raktamokshana — their indications, contraindications, and post-care
3. **Herbal Remedies**: Ashwagandha, Turmeric, Brahmi, Triphala, Shatavari, and classical formulations
4. **Diet & Lifestyle**: Dinacharya (daily routines), Ritucharya (seasonal routines), and dosha-specific dietary advice
5. **Yoga & Pranayama**: Therapeutic yoga sequences and breathing techniques for various conditions

${userProfile ? `Patient Profile:
- Name: ${userProfile.name}
- Dosha: ${userProfile.dosha || "Not assessed"}
- Health Score: ${userProfile.healthScore || "Not assessed"}` : ""}

Guidelines:
- Provide compassionate, evidence-informed Ayurvedic guidance
- Always recommend consulting a qualified Vaidya (Ayurvedic doctor) for serious conditions
- Keep responses concise but informative (2-3 paragraphs max)
- Include practical tips the user can act on immediately
- Use simple language, explain Sanskrit/Ayurvedic terms when used
- NEVER provide emergency medical advice — direct to emergency services if needed`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...conversationHistory.slice(-10),
            { role: "user", content: message },
        ];

        const completion = await groq.chat.completions.create({
            messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_tokens: 600,
        });

        const reply = completion.choices[0]?.message?.content || "";

        res.json({ success: true, reply });
    } catch (error) {
        console.error("Chatbot error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get response from AyurVaidya",
        });
    }
});

export default router;
