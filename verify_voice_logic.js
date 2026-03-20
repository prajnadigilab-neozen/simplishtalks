
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb21wbXZvbHhubHFxcW5od2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg2NzAsImV4cCI6MjA4ODQ5NDY3MH0.Nmvtyn3yjNZiVUdk09iTlSugZ8OmmE35aoUsynesLHc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    const { count } = await supabase.from('profiles').select('*', { count: 'exact', head: true });
    console.log("Profile Count:", count);

    const { data: users } = await supabase.from('profiles')
        .select('full_name, package_type, agent_credits')
        .order('created_at', { ascending: false })
        .limit(10);
    
    users?.forEach(u => {
        console.log(`U: ${u.full_name} | PKG: ${u.package_type} | CR: ${u.agent_credits}`);
    });
}

check();
