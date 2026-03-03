const store = new Map();
const WINDOW_MS   = 60 * 1000;
const MAX_REQUESTS = 30;

function getIp(req) {
    return req.headers['x-forwarded-for']?.split(',')[0]?.trim()
        || req.headers['x-real-ip']
        || 'unknown';
}

export function rateLimit(req, res) {
    const ip  = getIp(req);
    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || now > entry.resetAt) {
        store.set(ip, { count: 1, resetAt: now + WINDOW_MS });
        return true;
    }
    if (entry.count >= MAX_REQUESTS) {
        const retry = Math.ceil((entry.resetAt - now) / 1000);
        res.setHeader('Retry-After', retry);
        res.status(429).json({ error: 'Too many requests', retryAfter: retry });
        return false;
    }
    entry.count++;
    return true;
}
