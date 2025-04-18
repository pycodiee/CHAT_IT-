import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import readline from 'readline';
import axios from 'axios';

// Load environment variables
dotenv.config();

// Initialize Gemini client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);

// Initialize API keys from environment variables
const WEATHER_API_KEY = process.env.WEATHER_API_KEY;
const NEWS_API_KEY = process.env.NEWS_API_KEY;

// Real-time data fetching functions
const RealTimeData = {
    // Weather data
    async getWeather(city) {
        try {
            const response = await axios.get(
                `https://api.openweathermap.org/data/2.5/weather?q=${city}&appid=${WEATHER_API_KEY}&units=metric`
            );
            return {
                temperature: response.data.main.temp,
                conditions: response.data.weather[0].description,
                humidity: response.data.main.humidity,
                windSpeed: response.data.wind.speed
            };
        } catch (error) {
            throw new Error(`Weather data fetch failed: ${error.message}`);
        }
    },

    // News data
    async getNews(topic) {
        try {
            const response = await axios.get(
                `https://newsapi.org/v2/everything?q=${topic}&apiKey=${NEWS_API_KEY}&pageSize=5`
            );
            return response.data.articles.map(article => ({
                title: article.title,
                description: article.description,
                source: article.source.name,
                url: article.url
            }));
        } catch (error) {
            throw new Error(`News data fetch failed: ${error.message}`);
        }
    },

    // Stock market data (using Alpha Vantage free API)
    async getStockPrice(symbol) {
        try {
            const response = await axios.get(
                `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${symbol}&apikey=${process.env.ALPHA_VANTAGE_API_KEY}`
            );
            return {
                price: response.data['Global Quote']['05. price'],
                change: response.data['Global Quote']['09. change'],
                changePercent: response.data['Global Quote']['10. change percent']
            };
        } catch (error) {
            throw new Error(`Stock data fetch failed: ${error.message}`);
        }
    },

    // Currency exchange rates
    async getExchangeRate(from, to) {
        try {
            const response = await axios.get(
                `https://api.exchangerate-api.com/v4/latest/${from}`
            );
            return {
                rate: response.data.rates[to],
                lastUpdated: response.data.date
            };
        } catch (error) {
            throw new Error(`Exchange rate fetch failed: ${error.message}`);
        }
    }
};

// Function to process commands for real-time data
const processCommand = async (input) => {
    const command = input.toLowerCase();
    try {
        // Weather command
        if (command.startsWith('/weather ')) {
            const city = command.replace('/weather ', '');
            const weatherData = await RealTimeData.getWeather(city);
            return `Weather in ${city}:\nTemperature: ${weatherData.temperature}°C\nConditions: ${weatherData.conditions}\nHumidity: ${weatherData.humidity}%\nWind Speed: ${weatherData.windSpeed} m/s`;
        }
        // News command
        else if (command.startsWith('/news ')) {
            const topic = command.replace('/news ', '');
            const news = await RealTimeData.getNews(topic);
            return `Latest news about ${topic}:\n${news.map((article, i) =>
                `${i + 1}. ${article.title}\n${article.description}\nSource: ${article.source}\n`
            ).join('\n')}`;
        }
        // Stock command
        else if (command.startsWith('/stock ')) {
            const symbol = command.replace('/stock ', '');
            const stockData = await RealTimeData.getStockPrice(symbol);
            return `Stock info for ${symbol}:\nPrice: $${stockData.price}\nChange: ${stockData.change} (${stockData.changePercent})`;
        }
        // Exchange rate command
        else if (command.startsWith('/exchange ')) {
            const [from, to] = command.replace('/exchange ', '').split(' ');
            const exchangeData = await RealTimeData.getExchangeRate(from, to);
            return `Exchange rate ${from} to ${to}: ${exchangeData.rate}\nLast updated: ${exchangeData.lastUpdated}`;
        }
        // Not a command - return null to process as normal chat
        return null;
    } catch (error) {
        return `Error: ${error.message}`;
    }
};

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

// Main chat function
const chat = async () => {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    let chatHistory = [];

    console.log("\n=== Gemini Chat Interface with Real-Time Data ===");
    console.log("Available commands:");
    console.log("/weather [city] - Get current weather");
    console.log("/news [topic] - Get latest news");
    console.log("/stock [symbol] - Get stock price");
    console.log("/exchange [from] [to] - Get exchange rate");
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

            // Check for real-time data commands
            const commandResponse = await processCommand(userInput);
            if (commandResponse) {
                console.log("\nAI: " + commandResponse + "\n");
                continue;
            }

            // Regular chat processing
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