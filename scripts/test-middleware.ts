import { securityMiddleware } from '../src/middleware/securityMiddleware';

async function runSecurityTests() {
    console.log("🛡️ Starting Security Middleware Validation...\n");

    // ==========================================
    // Test 1: The XSS Bypass Attempt
    // ==========================================
    console.log("--- Test 1: The XSS Bypass Attempt ---");
    const maliciousPayload = {
        name: "ರಮೇಶ್ <img src=x onerror=alert(1)>",
        bio: "Test User",
        nested: {
            data: "Bad <script>alert(1)</script> data"
        }
    };

    // Need to mock a POST request with the malicious body
    const req1 = new Request('http://localhost:3000/api/profile', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer valid-token-123'
        },
        body: JSON.stringify(maliciousPayload)
    });

    try {
        const resultReq = await securityMiddleware(req1);
        let sanitizedBody: any = null;

        if (resultReq instanceof Request) {
            sanitizedBody = await resultReq.json();
            console.log("Original Input Name:", maliciousPayload.name);
            console.log("Sanitized Output Name:", sanitizedBody?.name);
            console.log("Original Nested Data:", maliciousPayload.nested.data);
            console.log("Sanitized Nested Data:", sanitizedBody?.nested?.data);

            if (sanitizedBody?.name === "ರಮೇಶ್ " && sanitizedBody?.nested?.data === "Bad alert(1) data") {
                 console.log("✅ Passed: XSS tags neutralized, deep nested objects sanitized, Kannada preserved.");
            } else {
                 console.log("❌ Failed: Suboptimal sanitization.", sanitizedBody);
            }
        } else {
             console.log("❌ Failed: Middleware did not return a new Request object.");
        }
    } catch (e: any) {
        console.log("❌ Failed with exception:", e.message);
    }

    console.log("\n");

    // ==========================================
    // Test 2: The "Lesson Leech" Test
    // ==========================================
    console.log("--- Test 2: The Lesson Leech Test ---");
    const req2 = new Request('http://localhost:3000/lesson/1', {
        method: 'GET',
        // Intentional: No Authorization header
    });

    const res2 = await securityMiddleware(req2);
    if (res2 instanceof Response && res2.status === 401) {
        const errorBody = await res2.json();
        console.log(`Status: ${res2.status} Unauthorized`);
        console.log(`Message: ${errorBody.error}`);
        if (errorBody.error === "ದಯವಿಟ್ಟು ಲಾಗ್ ಇನ್ ಮಾಡಿ") {
            console.log("✅ Passed: Lesson Leech blocked with correct Kannada error.");
        } else {
            console.log("❌ Failed: Incorrect error message.");
        }
    } else {
        console.log("❌ Failed: Request was not blocked. Status:", res2 instanceof Response ? res2.status : 'Passed through');
    }

    console.log("\n");

    // ==========================================
    // Test 3: The Valid Session Test
    // ==========================================
    console.log("--- Test 3: The Valid Session Test ---");
    const req3 = new Request('http://localhost:3000/lesson/1', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer valid-student-token-890'
        }
    });

    const res3 = await securityMiddleware(req3);
    if (res3 === null) {
        console.log("Status: Passed (200 OK equivalent)");
        console.log("✅ Passed: Legitimate session allowed through seamlessly.");
    } else {
        console.log("❌ Failed: Valid session was incorrectly manipulated.");
    }
}

runSecurityTests();
