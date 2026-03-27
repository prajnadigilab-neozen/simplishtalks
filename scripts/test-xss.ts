import { updateProfile } from '../services/authService';
import DOMPurify from 'dompurify';

async function testFrontendSanitization() {
    console.log("--- Testing DOMPurify Sanitization ---");
    
    const maliciousPayload = "<script>alert('Stealing Token!')</script> Ramesh";
    const cleanPlacePayload = "Bengaluru <img src=x onerror=alert(1)>";

    console.log("Original Input: ", maliciousPayload);
    
    // Simulate what the updateProfile does internally
    const sanitizedName = DOMPurify.sanitize(maliciousPayload);
    const sanitizedPlace = DOMPurify.sanitize(cleanPlacePayload);

    console.log("Sanitized Name: ", sanitizedName);
    console.log("Sanitized Place: ", sanitizedPlace);

    if (!sanitizedName.includes('<script>') && sanitizedName.includes('Ramesh')) {
        console.log("✅ XSS payload successfully neutralized! Legitimate string preserved.");
    } else {
        console.log("❌ Sanitization failed.");
    }
}

testFrontendSanitization();
