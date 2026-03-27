// k6-load-test.js
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '1m', target: 50 },    // Ramp to 50 users
    { duration: '3m', target: 100 },   // Hold at 100
    { duration: '1m', target: 250 },   // Stress at 250
    { duration: '1m', target: 0 },     // Recovery
  ],
  thresholds: { 
    http_req_duration: ['p(95)<800'],  // 95% under 800ms (rural latency budget)
    http_req_failed: ['rate<0.05']     // < 5% error rate allowed under stress
  }
};

// Replace with your actual environment variables if running locally
const SUPABASE_URL = __ENV.VITE_SUPABASE_URL || 'https://ffompmvolxnlqqqnhwhd.supabase.co';
const ANON_KEY = __ENV.VITE_SUPABASE_ANON_KEY || '';

export default function () {
  // Simulate common dashboard data fetch
  const res = http.get(`${SUPABASE_URL}/rest/v1/snehi_scenarios?select=*`, {
    headers: { 
      'apikey': ANON_KEY, 
      'Authorization': `Bearer ${ANON_KEY}` 
    }
  });

  check(res, { 
    'status 200': (r) => r.status === 200, 
    'latency < 1s': (r) => r.timings.duration < 1000 
  });
  
  sleep(1);
}
