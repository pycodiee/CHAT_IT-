import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from 'readline';

// Load environment variables
dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Create readline interface
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

// Function to get user input
const getUserInput = (prompt) => {
    return new Promise((resolve) => {
        rl.question(prompt, (input) => {
            resolve(input);
        });
    });
};

// Chat function
const chat = async () => {
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
    let chatHistory = [];

    console.log("\n=== Gemini Chat Interface ===");
    console.log("Type 'exit' to end the conversation\n");

    while (true) {
        try {
            // Get user input
            const userInput = await getUserInput("\nYou: ");

            // Check for exit command
            if (userInput.toLowerCase() === 'exit') {
                console.log("\nGoodbye! Have a great day!");
                rl.close();
                break;
            }

            // Create chat instance with history
            const chat = model.startChat({
                history: chatHistory.map(msg => ({
                    role: msg.role,
                    parts: [{ text: msg.content }]
                }))
            });

            // Send message and get response
            const result = await chat.sendMessage([{ text: userInput }]);
            const response = await result.response;
            const responseText = response.text();

            // Update chat history
            chatHistory.push(
                { role: "user", content: userInput },
                { role: "model", content: responseText }
            );

            // Display response
            console.log("\nAI: " + responseText + "\n");

        } catch (error) {
            console.error("\nError:", error.message);
            if (error.message.includes('quota')) {
                console.error("Please check your Google AI API quota and billing status.");
            }
        }
    }
};

// Start the chat if running directly
if (import.meta.url === new URL(import.meta.url).href) {
    chat();
}

export { chat };