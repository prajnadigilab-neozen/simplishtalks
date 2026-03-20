
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZmb21wbXZvbHhubHFxcW5od2hkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5MTg2NzAsImV4cCI6MjA4ODQ5NDY3MH0.Nmvtyn3yjNZiVUdk09iTlSugZ8OmmE35aoUsynesLHc';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function check() {
    console.log("Fetching all profiles...");
    const { data: users, error } = await supabase.from('profiles').select('phone, full_name, package_type, agent_credits, topup_amount');
    
    if (error) console.error("Error:", error);
    
    console.log("ALL_USER_DATA_START");
    console.log(JSON.stringify(users, null, 2));
    console.log("ALL_USER_DATA_END");
}

check();
