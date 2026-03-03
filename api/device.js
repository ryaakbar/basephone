import { gsmDetail }  from '../lib/gsm.js';
import { getRootInfo } from '../lib/rootInfo.js';
import { rateLimit }   from '../middleware/rateLimit.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!rateLimit(req, res)) return;

    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Device ID required' });

    try {
        const device = await gsmDetail(id);
        // Extract brand from id (e.g. "samsung_galaxy_s24-12345" → "samsung")
        const brand = id.split('_')[0] || '';
        const rootInfo = getRootInfo(device.name, device.flat?.chipset || '', brand);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({ success: true, device, rootInfo });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Failed to fetch device' });
    }
}
