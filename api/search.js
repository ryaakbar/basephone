import { gsmSearch } from '../lib/gsm.js';
import { rateLimit }  from '../middleware/rateLimit.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!rateLimit(req, res)) return;

    const { q } = req.query;
    if (!q || q.trim().length < 1) return res.status(400).json({ error: 'Query required' });

    try {
        const results = await gsmSearch(q.trim());
        res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate');
        return res.status(200).json({ success: true, count: results.length, results });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Search failed' });
    }
}
