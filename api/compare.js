import { gsmCompare } from '../lib/gsm.js';
import { getRootInfo } from '../lib/rootInfo.js';
import { rateLimit }   from '../middleware/rateLimit.js';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
    if (!rateLimit(req, res)) return;

    const { id1, id2 } = req.query;
    if (!id1 || !id2) return res.status(400).json({ error: 'id1 and id2 required' });

    try {
        const { a, b } = await gsmCompare(id1, id2);
        const rootA = getRootInfo(a.name, a.flat?.chipset || '', id1.split('_')[0]);
        const rootB = getRootInfo(b.name, b.flat?.chipset || '', id2.split('_')[0]);

        res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
        return res.status(200).json({ success: true, a: { ...a, rootInfo: rootA }, b: { ...b, rootInfo: rootB } });
    } catch (err) {
        return res.status(500).json({ error: err.message || 'Compare failed' });
    }
}
