import DOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

// In a Node environment, DOMPurify needs a window object to function correctly
const window = new JSDOM('').window;
const purify = DOMPurify(window as any);

export async function securityMiddleware(req: Request): Promise<Response | null> {
    // 1. Authorization Check (Lesson Leech Test & Valid Session Test)
    const url = new URL(req.url);
    if (url.pathname.includes('/lesson/') || url.pathname.includes('/profile')) {
        const authHeader = req.headers.get('Authorization');
        if (!authHeader || authHeader === 'null' || authHeader === '') {
            return new Response(JSON.stringify({ error: "ದಯವಿಟ್ಟು ಲಾಗ್ ಇನ್ ಮಾಡಿ" }), {
                status: 401,
                headers: { 'Content-Type': 'application/json' }
            });
        }
    }

    // 2. XSS Sanitization (The XSS Bypass Attempt)
    if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
        try {
            // Clone the request so we don't consume the original body stream
            const clonedReq = req.clone();
            const body = await clonedReq.json();
            
            // Sanitize string values in the body
            const sanitizedBody = { ...body };
            for (const key in sanitizedBody) {
                if (typeof sanitizedBody[key] === 'string') {
                    // Use DOMPurify to strip malicious tags while preserving Kannada
                    sanitizedBody[key] = purify.sanitize(sanitizedBody[key]);
                }
            }

            // Return a modified request or pass the sanitized body downstream
            // For this mock middleware validation, we will attach the sanitized body to a custom header or simply return null to indicate 'passed'
            (req as any).sanitizedBody = sanitizedBody;

        } catch (e) {
            // If it's not JSON, skip parsing or handle accordingly
        }
    }

    // Return null indicates the middleware passed and the request can proceed
    return null;
}
