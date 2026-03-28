// Deep Object Sanitizer for Edge execution
function sanitizeObject(obj: any): any {     
    if (typeof obj === 'string') {
        // Lightweight regex-based HTML tag stripper (suitable for Edge runtimes)
        return obj.replace(/<[^>]*>?/gm, '');
    }
    if (Array.isArray(obj)) {
        return obj.map(sanitizeObject);
    }
    if (typeof obj === 'object' && obj !== null) {
        return Object.keys(obj).reduce((acc, key) => {
            acc[key] = sanitizeObject(obj[key]);
            return acc;
        }, {} as Record<string, any>);
    }
    return obj;
}

export async function securityMiddleware(req: Request): Promise<Response | Request | null> {
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
            
            // Deep Sanitize all values in the body
            const sanitizedBody = sanitizeObject(body);

            // Reconstruct the request to pass the sanitized body downstream
            const newBodyStream = JSON.stringify(sanitizedBody);
            
            // Return a reconstructed Request overriding the dirty payload
            return new Request(req.url, {
                method: req.method,
                headers: req.headers,
                body: newBodyStream
            });
        } catch (e) {
            // If it's not JSON, skip parsing or handle accordingly
            console.error("Failed to parse or sanitize request body", e);
        }
    }

    // Return null indicates the middleware passed and the request can proceed unmodified
    return null;
}
