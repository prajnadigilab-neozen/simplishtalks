
const supabaseUrl = 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb21wbXZvbHhubHFxcW5od2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg2NzAsImV4cCI6MjA4ODQ5NDY3MH0.Nmvtyn3yjNZiVUdk09iTlSugZ8OmmE35aoUsynesLHc';

async function testScenarioChat() {
    try {
        const response = await fetch(`${supabaseUrl}/functions/v1/scenario-chat`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            },
            body: JSON.stringify({
                message: "Hello",
                history: [],
                systemInstruction: "You are a helpful assistant."
            })
        });

        console.log('Status:', response.status);
        const text = await response.text();
        console.log('Response:', text);
    } catch (e) {
        console.error('Error:', e);
    }
}

testScenarioChat();
