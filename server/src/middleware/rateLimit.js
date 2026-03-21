import rateLimit from 'express-rate-limit';

// Global API Limiter (fallback)
export const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per window
    message: { success: false, error: 'Too many requests, please try again later.' }
});

// Limiter for LLM routes (Predict, Chatbot, Feedback)
export const llmLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 10, // 10 requests per minute
    message: { success: false, error: 'AI rate limit exceeded. Please wait a moment.' }
});

// Limiter for Email notifications
export const emailLimiter = rateLimit({
    windowMs: 60 * 1000, // 1 minute
    max: 3, // 3 emails per minute
    message: { success: false, error: 'Email rate limit exceeded. Please wait a moment.' }
});
