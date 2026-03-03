import axios from 'axios';
import * as cheerio from 'cheerio';

const BASE = 'https://www.gsmarena.com';
const UA   = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

const http = axios.create({
    timeout: 30000,
    headers: {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Referer': 'https://www.gsmarena.com/',
    },
});

// ---- SEARCH ----
export async function gsmSearch(query) {
    const res = await http.get(`${BASE}/results.php3`, {
        params: { sQuickSearch: 'yes', sName: query },
    });
    const $ = cheerio.load(res.data);
    const results = [];

    $('.makers li').each((_, el) => {
        const a    = $(el).find('a');
        const img  = $(el).find('img');
        const href = a.attr('href') || '';
        const id   = href.replace('.php', '');
        const raw  = $(el).find('span').html() || '';
        const name = raw.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '').trim();
        const thumbnail   = img.attr('src') || '';
        const description = img.attr('title') || '';

        if (id && name) {
            results.push({ id, name, thumbnail, description });
        }
    });

    return results;
}

// ---- DETAIL ----
export async function gsmDetail(deviceId) {
    const url = `${BASE}/${deviceId}.php`;
    const res = await http.get(url);
    const $   = cheerio.load(res.data);

    // Basic info
    const name      = $('h1.specs-phone-name-title').text().trim();
    const thumbnail = $('#specs-list img').first().attr('src')
                   || $('.specs-photo-main img').attr('src')
                   || '';

    // Parse all spec tables
    const specs = {};
    $('#specs-list table').each((_, table) => {
        const category = $(table).find('th').first().text().trim();
        if (!category) return;
        specs[category] = {};
        $(table).find('tr').each((_, row) => {
            const key = $(row).find('td.ttl').text().trim();
            const val = $(row).find('td.nfo').text().replace(/\s+/g, ' ').trim();
            if (key && val) specs[category][key] = val;
        });
    });

    // Quick-access flat fields
    const flat = flattenSpecs(specs);

    return { id: deviceId, name, thumbnail, url, specs, flat };
}

// ---- COMPARE ----
export async function gsmCompare(id1, id2) {
    const [a, b] = await Promise.all([gsmDetail(id1), gsmDetail(id2)]);
    return { a, b };
}

// ---- FLATTEN SPECS ----
function flattenSpecs(specs) {
    const get = (cat, key) => {
        const c = specs[cat] || {};
        for (const k of Object.keys(c)) {
            if (k.toLowerCase().includes(key.toLowerCase())) return c[k];
        }
        return null;
    };

    return {
        // Network
        network:      get('Network', 'Technology') || get('Network', 'technology'),
        // Launch
        announced:    get('Launch', 'Announced'),
        status:       get('Launch', 'Status'),
        // Body
        dimensions:   get('Body', 'Dimensions'),
        weight:       get('Body', 'Weight'),
        build:        get('Body', 'Build'),
        sim:          get('Body', 'SIM'),
        // Display
        displayType:  get('Display', 'Type'),
        displaySize:  get('Display', 'Size'),
        displayRes:   get('Display', 'Resolution'),
        displayProt:  get('Display', 'Protection'),
        // Platform
        os:           get('Platform', 'OS'),
        chipset:      get('Platform', 'Chipset'),
        cpu:          get('Platform', 'CPU'),
        gpu:          get('Platform', 'GPU'),
        // Memory
        storage:      get('Memory', 'Internal'),
        cardSlot:     get('Memory', 'Card slot'),
        // Camera
        mainCamera:   get('Main Camera', 'Single') || get('Main Camera', 'Triple') || get('Main Camera', 'Quad') || get('Main Camera', 'Dual'),
        mainFeatures: get('Main Camera', 'Features'),
        mainVideo:    get('Main Camera', 'Video'),
        selfieCamera: get('Selfie camera', 'Single') || get('Selfie camera', 'Dual'),
        selfieVideo:  get('Selfie camera', 'Video'),
        // Sound
        loudspeaker:  get('Sound', 'Loudspeaker'),
        jack:         get('Sound', '3.5mm jack'),
        // Comms
        wlan:         get('Comms', 'WLAN'),
        bluetooth:    get('Comms', 'Bluetooth'),
        nfc:          get('Comms', 'NFC'),
        usb:          get('Comms', 'USB'),
        // Features
        sensors:      get('Features', 'Sensors'),
        // Battery
        batteryType:  get('Battery', 'Type'),
        batteryLife:  get('Battery', 'Stand-by') ? `Stand-by: ${get('Battery','Stand-by')}` : null,
        charging:     get('Battery', 'Charging'),
        // Misc
        colors:       get('Misc', 'Colors'),
        models:       get('Misc', 'Models'),
        sar:          get('Misc', 'SAR'),
        price:        get('Misc', 'Price'),
    };
}
