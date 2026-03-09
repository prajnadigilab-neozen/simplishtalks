
const supabaseUrl = 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb21wbXZvbHhubHFxcW5od2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg2NzAsImV4cCI6MjA4ODQ5NDY3MH0.Nmvtyn3yjNZiVUdk09iTlSugZ8OmmE35aoUsynesLHc';

async function checkModules() {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/modules?select=count`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'count=exact'
            }
        });
        const count = response.headers.get('content-range')?.split('/')?.[1];
        console.log('Modules Count:', count);

        const lessonsResponse = await fetch(`${supabaseUrl}/rest/v1/lessons?select=count`, {
            headers: {
                'apikey': supabaseKey,
                'Authorization': `Bearer ${supabaseKey}`,
                'Prefer': 'count=exact'
            }
        });
        const lessonsCount = lessonsResponse.headers.get('content-range')?.split('/')?.[1];
        console.log('Lessons Count:', lessonsCount);
    } catch (e) {
        console.error('Error fetching count:', e);
    }
}

checkModules();
