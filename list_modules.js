
const supabaseUrl = 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb21wbXZvbHhubHFxcW5od2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg2NzAsImV4cCI6MjA4ODQ5NDY3MH0.Nmvtyn3yjNZiVUdk09iTlSugZ8OmmE35aoUsynesLHc';

async function listModules() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/modules?select=*`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`
            }
        });
        const data = await response.json();
        console.log('Current Modules:', JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error fetching modules:', e);
    }
}

listModules();
