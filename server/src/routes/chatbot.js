import express from "express";
import Groq from "groq-sdk";

const router = express.Router();
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

const OUT_OF_SCOPE_REPLY_EN =
    "I specialize in Ayurveda and wellness. Please ask a question related to Ayurveda, Panchakarma, herbs, diet, dosha, yoga, or lifestyle healing.";
const OUT_OF_SCOPE_REPLY_HI =
    "मैं आयुर्वेद और वेलनेस से जुड़े प्रश्नों में विशेषज्ञ हूं। कृपया आयुर्वेद, पंचकर्म, जड़ी-बूटियां, आहार, दोष, योग या जीवनशैली उपचार से जुड़ा प्रश्न पूछें।";

const AYURVEDA_KEYWORDS = [
    "ayurveda",
    "ayurvedic",
    "panchakarma",
    "dosha",
    "vata",
    "pitta",
    "kapha",
    "agni",
    "ama",
    "dinacharya",
    "ritucharya",
    "rasayana",
    "abhyanga",
    "nasya",
    "basti",
    "vamana",
    "virechana",
    "triphala",
    "ashwagandha",
    "chyawanprash",
    "giloy",
    "tulsi",
    "herb",
    "herbal",
    "pranayama",
    "yoga",
    "meditation",
    "wellness",
    "digestion",
    "constipation",
    "acidity",
    "sleep",
    "stress",
    "anxiety",
    "immunity",
];

function normalizeText(value = "") {
    return String(value).toLowerCase().trim();
}

function isAyurvedaQuery(message = "") {
    const text = normalizeText(message);
    if (!text) return false;
    return AYURVEDA_KEYWORDS.some((k) => text.includes(k));
}

function normalizeHistory(history = []) {
    if (!Array.isArray(history)) return [];
    return history
        .map((m) => ({
            role: m?.role === "assistant" ? "assistant" : "user",
            content: safeText(m?.content).trim(),
        }))
        .filter((m) => m.content);
}

function looksLikeFollowup(message = "") {
    const text = normalizeText(message);
    if (!text) return false;
    // Typical short follow-up prompts that rely on prior context.
    const followupSignals = [
        "what about",
        "and this",
        "is it safe",
        "safe?",
        "how long",
        "how often",
        "dosage",
        "dose",
        "when should",
        "can i",
        "should i",
        "then what",
        "next step",
        "why",
        "how",
        "ok then",
        "what now",
        "in hindi",
        "in marathi",
    ];
    if (text.length <= 42) return true;
    return followupSignals.some((s) => text.includes(s));
}

function hasRecentAyurvedaContext(history = []) {
    const normalized = normalizeHistory(history);
    // Look at recent user+assistant turns to decide if chat is currently in domain.
    const recent = normalized.slice(-6);
    return recent.some((m) => isAyurvedaQuery(m.content));
}

function safeText(v, fallback = "") {
    return typeof v === "string" ? v : fallback;
}

function normalizeLocale(value = "") {
    const v = normalizeText(value);
    return v.startsWith("hi") ? "hi" : "en";
}

function normalizeStructuredReply(raw) {
    const obj = raw && typeof raw === "object" ? raw : {};
    const title = safeText(obj.title, "AyurVaidya Guidance");
    const summary = safeText(obj.summary, "");
    const tip = safeText(obj.tip, "");
    const sectionsRaw = Array.isArray(obj.sections) ? obj.sections : [];
    const sections = sectionsRaw
        .map((s) => {
            if (!s || typeof s !== "object") return null;
            const type = safeText(s.type);
            const heading = safeText(s.heading);
            if (type === "text") {
                return { type, heading, content: safeText(s.content) };
            }
            if (type === "list" || type === "steps") {
                const items = Array.isArray(s.items) ? s.items.map((x) => safeText(x)).filter(Boolean) : [];
                return { type, heading, items };
            }
            if (type === "table") {
                const rows = Array.isArray(s.rows)
                    ? s.rows
                          .map((r) => ({
                              label: safeText(r?.label),
                              value: safeText(r?.value),
                          }))
                          .filter((r) => r.label || r.value)
                    : [];
                return { type, heading, rows };
            }
            return null;
        })
        .filter(Boolean);
    return { title, summary, sections, tip };
}

// ─── Chat with Digital Vaidya (Ayurvedic AI Assistant) ───
router.post("/chat", async (req, res) => {
    try {
        const { message, conversationHistory = [], userProfile, locale } = req.body;
        const lang = normalizeLocale(locale);
        const isHindi = lang === "hi";
        const userMessage = safeText(message).trim();
        if (!userMessage) {
            return res.status(400).json({ success: false, error: "message is required" });
        }

        const history = normalizeHistory(conversationHistory);
        const inDomainNow = isAyurvedaQuery(userMessage);
        const contextFollowup = looksLikeFollowup(userMessage) && hasRecentAyurvedaContext(history);

        // Context-aware domain guard:
        // - allow explicit Ayurveda queries
        // - allow short follow-ups if recent context is already Ayurveda
        if (!inDomainNow && !contextFollowup) {
            return res.json({
                success: true,
                inScope: false,
                reply: isHindi ? OUT_OF_SCOPE_REPLY_HI : OUT_OF_SCOPE_REPLY_EN,
                structured: {
                    title: isHindi ? "आयुर्वैद्य दायरा सूचना" : "AyurVaidya Scope Notice",
                    summary: isHindi ? OUT_OF_SCOPE_REPLY_HI : OUT_OF_SCOPE_REPLY_EN,
                    sections: [],
                    tip: isHindi
                        ? "दोष संतुलन, आहार, जड़ी-बूटियों, पंचकर्म, योग, पाचन, नींद या तनाव के बारे में पूछें।"
                        : "Try asking about dosha balance, diet, herbs, Panchakarma, yoga, digestion, sleep, or stress.",
                },
            });
        }

        const systemPrompt = `You are "AyurVaidya", a knowledgeable and compassionate AI Ayurvedic health assistant for AyurSutra platform. You are trained on classical Ayurvedic texts and provide authentic guidance.

**Classical Text Knowledge (Charaka Samhita & Sushruta Samhita):**
- Charaka Samhita: The foundational text of Ayurveda covering 8 branches (Ashtanga Ayurveda). Key concepts: Tridosha Siddhanta, Saptadhatu, Panchamahabhoota, Dinacharya, Ritucharya, Sadvritta.
- Sushruta Samhita: The surgical text of Ayurveda. Key references: Shalya Tantra, Marma points, wound healing, Panchakarma detoxification procedures.
- Ashtanga Hridaya: Vagbhata's compilation combining both Charaka and Sushruta traditions.

**Core Expertise:**
1. **Tridosha Theory**: Vata (वात), Pitta (पित्त), Kapha (कफ) — assessment, imbalance detection, and balancing techniques
2. **Panchakarma Therapies**: Vamana (वमन), Virechana (विरेचन), Basti (बस्ति), Nasya (नस्य), Raktamokshana (रक्तमोक्षण) — as per Charaka Samhita Siddhisthana
3. **Herbal Remedies (Dravyaguna Shastra)**: Classical formulations like Triphala, Chyawanprash, Dashamoola, Mahanarayan Taila
4. **Diet & Lifestyle (Ahara & Vihara)**: Dinacharya (दिनचर्या - daily routines), Ritucharya (ऋतुचर्या - seasonal routines), Pathya-Apathya (dietary do's & don'ts)
5. **Yoga & Pranayama**: Therapeutic sequences per Patanjali Yoga Sutras

**Multilingual Support:**
- You understand and can respond with Hindi (हिंदी) and Sanskrit (संस्कृत) Ayurvedic terms with translations
- When using Ayurvedic terms, always provide: Sanskrit name → Hindi equivalent → English translation
- Example: "Agni (अग्नि) refers to the digestive fire that governs metabolism"
- You can interpret prescriptions written in Hindi, Sanskrit, or transliterated forms

${userProfile ? `Patient Profile:
- Name: ${userProfile.name}
- Dosha: ${userProfile.dosha || "Not assessed"}
- Health Score: ${userProfile.healthScore || "Not assessed"}` : ""}

Guidelines:
- Provide compassionate, evidence-informed Ayurvedic guidance rooted in classical texts
- Reference specific classical texts when giving recommendations (e.g., "As described in Charaka Samhita, Chikitsasthana Ch.15...")
- Always recommend consulting a qualified Vaidya (Ayurvedic doctor) for serious conditions
- Keep responses concise and practical
- Include practical tips the user can act on immediately
- Use simple language, explain Sanskrit/Ayurvedic terms when used
- Support multilingual queries in Hindi and English
- IMPORTANT: Respond in ${isHindi ? "Hindi (hi-IN)" : "English (en-IN)"} for this user unless explicitly asked to switch language.
- NEVER provide emergency medical advice — direct to emergency services if needed

VERY IMPORTANT OUTPUT FORMAT:
Return ONLY valid JSON in this exact schema:
{
  "title": "<short title>",
  "summary": "<1-2 sentence quick answer>",
  "sections": [
    { "heading": "Why this happens", "type": "text", "content": "<brief explanation>" },
    { "heading": "What to do now", "type": "steps", "items": ["<step 1>", "<step 2>", "<step 3>"] },
    { "heading": "Helpful options", "type": "list", "items": ["<item 1>", "<item 2>"] }
  ],
  "tip": "<single practical tip>"
}
Allowed section types are only: "text", "list", "table", "steps".
Do not include markdown. Do not include any text outside JSON.`;

        const messages = [
            { role: "system", content: systemPrompt },
            ...history.slice(-8),
            { role: "user", content: userMessage },
        ];

        const completion = await groq.chat.completions.create({
            messages,
            model: "llama-3.3-70b-versatile",
            temperature: 0.3,
            max_tokens: 600,
            response_format: { type: "json_object" },
        });

        const rawText = completion.choices[0]?.message?.content || "{}";
        let structuredRaw = {};
        try {
            structuredRaw = JSON.parse(rawText);
        } catch {
            structuredRaw = {
                title: isHindi ? "आयुर्वैद्य मार्गदर्शन" : "AyurVaidya Guidance",
                summary: safeText(
                    rawText,
                    isHindi
                        ? "मैं आयुर्वेद और वेलनेस से जुड़े प्रश्नों में मदद कर सकता हूं।"
                        : "I can help with Ayurveda and wellness questions."
                ),
                sections: [],
                tip: "",
            };
        }
        const structured = normalizeStructuredReply(structuredRaw);
        const plainReply = [structured.summary, structured.tip ? `${isHindi ? "सुझाव" : "Tip"}: ${structured.tip}` : ""]
            .filter(Boolean)
            .join("\n\n");

        res.json({
            success: true,
            inScope: true,
            reply: plainReply,
            structured,
        });
    } catch (error) {
        console.error("Chatbot error:", error);
        res.status(500).json({
            success: false,
            error: "Failed to get response from AyurVaidya",
        });
    }
});

export default router;
