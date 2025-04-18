import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import { setTimeout } from "timers/promises";

// Load environment variables
dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Rate limiting configuration
const rateLimitConfig = {
    maxRetries: 3,
    baseDelay: 1000, // 1 second
    maxRequests: 60,  // Gemini's default rate limit is 60 requests per minute
    interval: 60000  // 1 minute interval
};

// Rate limiting state
let requestCount = 0;
let lastResetTime = Date.now();

// Reset rate limit counter
const resetRateLimit = () => {
    const now = Date.now();
    if (now - lastResetTime >= rateLimitConfig.interval) {
        requestCount = 0;
        lastResetTime = now;
    }
};

// Check rate limit
const checkRateLimit = () => {
    resetRateLimit();
    if (requestCount >= rateLimitConfig.maxRequests) {
        const waitTime = rateLimitConfig.interval - (Date.now() - lastResetTime);
        throw new Error(`Rate limit exceeded. Please wait ${Math.ceil(waitTime / 1000)} seconds.`);
    }
    requestCount++;
};

// Exponential backoff retry logic
const retryWithBackoff = async (fn, retries = rateLimitConfig.maxRetries) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await fn();
        } catch (error) {
            if (i === retries - 1) throw error;

            // Check for rate limit errors or quota exceeded
            if (error.message.includes('quota') || error.message.includes('rate')) {
                const delay = rateLimitConfig.baseDelay * Math.pow(2, i);
                console.log(`Rate limited. Retrying in ${delay / 1000} seconds...`);
                await setTimeout(delay);
            } else {
                throw error;
            }
        }
    }
};

// Chat function implementation with rate limiting
const chat = async (userMessage, systemPrompt = "You are a helpful assistant.") => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    return retryWithBackoff(async () => {
        checkRateLimit();

        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: "model",
                    parts: [{ text: "I understand. I'll act as a helpful assistant." }]
                }
            ]
        });

        const result = await chat.sendMessage([{ text: userMessage }]);
        const response = await result.response;
        return response.text();
    });
};

// Chat function with conversation history
const chatWithHistory = async (messages) => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

    return retryWithBackoff(async () => {
        checkRateLimit();

        // Convert messages to Gemini format
        const history = messages.map(msg => ({
            role: msg.role === "assistant" ? "model" : "user",
            parts: [{ text: msg.content }]
        }));

        const chat = model.startChat({ history });
        const lastMessage = messages[messages.length - 1].content;
        const result = await chat.sendMessage([{ text: lastMessage }]);
        const response = await result.response;
        return response.text();
    });
};

// Example usage with better error handling
const example = async () => {
    try {
        // Single message example
        const response = await chat("What is the meaning of life?");
        console.log("AI Response:", response);

        // Conversation with history example
        const conversationHistory = [
            {
                role: "system",
                content: "You are a helpful assistant."
            },
            {
                role: "user",
                content: "Tell me about artificial intelligence."
            },
            {
                role: "assistant",
                content: "Artificial intelligence is a branch of computer science..."
            },
            {
                role: "user",
                content: "What are its main applications?"
            }
        ];

        const historyResponse = await chatWithHistory(conversationHistory);
        console.log("AI Response with history:", historyResponse);
    } catch (error) {
        console.error("Error occurred:", {
            message: error.message,
            name: error.name,
            stack: error.stack
        });

        if (error.message.includes('quota')) {
            console.error("Please check your Google AI API quota and billing status.");
        }
    }
};

export { chat, chatWithHistory };

// If running directly
if (import.meta.url === new URL(import.meta.url).href) {
    example();
}