
const supabaseUrl = 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb21wbXZvbHhubHFxcW5od2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg2NzAsImV4cCI6MjA4ODQ5NDY3MH0.Nmvtyn3yjNZiVUdk09iTlSugZ8OmmE35aoUsynesLHc';

async function checkUsage() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/user_usage?select=count`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'count=exact'
            }
        });
        console.log('User Usage Status:', response.status);
        if (response.status === 200 || response.status === 206) {
            const count = response.headers.get('content-range')?.split('/')?.[1];
            console.log('User Usage Count:', count);
        } else {
            const text = await response.text();
            console.log('User Usage Error Text:', text);
        }
    } catch (e) {
        console.error('Error fetching usage:', e);
    }
}

checkUsage();
