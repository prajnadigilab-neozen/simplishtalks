
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '.env.local');

let apiKey = '';
try {
    const envContent = fs.readFileSync(envPath, 'utf8');
    const match = envContent.match(/VITE_GEMINI_API_KEY=(.*)/);
    if (match && match[1]) {
        apiKey = match[1].trim();
    }
} catch (err) {
    console.error("Could not read .env.local", err);
}

if (!apiKey) {
    console.error("❌ VITE_GEMINI_API_KEY not found in .env.local");
    process.exit(1);
}

async function listModels() {
    console.log("📡 Listing available Gemini models...");
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        if (data.models) {
            console.log("✅ Models found:");
            data.models.forEach(model => {
                if (model.name.includes("gemini")) {
                    console.log(`- ${model.name.replace('models/', '')}`);
                    console.log(`  Methods: ${model.supportedGenerationMethods.join(', ')}`);
                }
            });
        } else {
            console.error("❌ No models found or error in response:", data);
        }

    } catch (error) {
        console.error("❌ Failed to list models!");
        console.error("Error Details:", error.message || error);
    }
}

listModels();
