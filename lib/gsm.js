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

    // Special features extraction engine
    const specialFeatures = extractSpecialFeatures(specs, flat, name);

    return { id: deviceId, name, thumbnail, url, specs, flat, specialFeatures };
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
        network:      get('Network', 'Technology') || get('Network', 'technology'),
        announced:    get('Launch', 'Announced'),
        status:       get('Launch', 'Status'),
        dimensions:   get('Body', 'Dimensions'),
        weight:       get('Body', 'Weight'),
        build:        get('Body', 'Build'),
        sim:          get('Body', 'SIM'),
        displayType:  get('Display', 'Type'),
        displaySize:  get('Display', 'Size'),
        displayRes:   get('Display', 'Resolution'),
        displayProt:  get('Display', 'Protection'),
        os:           get('Platform', 'OS'),
        chipset:      get('Platform', 'Chipset'),
        cpu:          get('Platform', 'CPU'),
        gpu:          get('Platform', 'GPU'),
        storage:      get('Memory', 'Internal'),
        cardSlot:     get('Memory', 'Card slot'),
        mainCamera:   get('Main Camera', 'Single') || get('Main Camera', 'Triple') || get('Main Camera', 'Quad') || get('Main Camera', 'Dual'),
        mainFeatures: get('Main Camera', 'Features'),
        mainVideo:    get('Main Camera', 'Video'),
        selfieCamera: get('Selfie camera', 'Single') || get('Selfie camera', 'Dual'),
        selfieVideo:  get('Selfie camera', 'Video'),
        loudspeaker:  get('Sound', 'Loudspeaker'),
        jack:         get('Sound', '3.5mm jack'),
        wlan:         get('Comms', 'WLAN'),
        bluetooth:    get('Comms', 'Bluetooth'),
        nfc:          get('Comms', 'NFC'),
        usb:          get('Comms', 'USB'),
        sensors:      get('Features', 'Sensors'),
        batteryType:  get('Battery', 'Type'),
        batteryLife:  get('Battery', 'Stand-by') ? `Stand-by: ${get('Battery','Stand-by')}` : null,
        charging:     get('Battery', 'Charging'),
        colors:       get('Misc', 'Colors'),
        models:       get('Misc', 'Models'),
        sar:          get('Misc', 'SAR'),
        price:        get('Misc', 'Price'),
    };
}

// ============================================================
// SPECIAL FEATURES EXTRACTION ENGINE
// Scans ALL spec fields for premium/special capabilities
// Returns array of { icon, title, description, tier, category }
// tier: 'flagship' | 'premium' | 'standard'
// ============================================================
function extractSpecialFeatures(specs, flat, deviceName) {
    const features = [];
    const name = (deviceName || '').toLowerCase();

    // Helper: concat all spec values into one searchable string
    const allText = Object.values(specs)
        .flatMap(cat => Object.values(cat))
        .join(' ')
        .toLowerCase();

    const has = (...keywords) => keywords.some(kw => allText.includes(kw.toLowerCase()));
    const getVal = (cat, key) => {
        const c = specs[cat] || {};
        for (const k of Object.keys(c)) {
            if (k.toLowerCase().includes(key.toLowerCase())) return c[k];
        }
        return null;
    };
    const valHas = (val, ...kws) => kws.some(kw => (val || '').toLowerCase().includes(kw.toLowerCase()));

    // ── DISPLAY ──────────────────────────────────────────────
    const dispType = flat.displayType || '';
    const dispSize = flat.displaySize || '';
    const dispRes  = flat.displayRes  || '';

    if (valHas(dispType, 'LTPO')) {
        const hz = dispType.match(/(\d+)Hz/)?.[1] || '120';
        features.push({ icon:'🔄', category:'Display', tier:'flagship',
            title: 'LTPO Adaptive Refresh Rate',
            description: `Dynamic refresh rate up to ${hz}Hz — saves battery by dropping to 1Hz when idle. Premium flagship feature.` });
    } else if (valHas(dispType, '144Hz','165Hz','120Hz')) {
        const hz = dispType.match(/(\d+)Hz/)?.[1] || '120';
        features.push({ icon:'⚡', category:'Display', tier:'premium',
            title: `${hz}Hz High Refresh Rate`,
            description: `${hz}Hz smooth scrolling and gaming. Animations feel significantly more fluid than standard 60Hz.` });
    }

    if (valHas(dispType, 'AMOLED','Super AMOLED','Dynamic AMOLED','OLED','ProMotion')) {
        const dtype = dispType.match(/(Super AMOLED|Dynamic AMOLED|ProMotion OLED|OLED|AMOLED)/i)?.[1] || 'AMOLED';
        features.push({ icon:'🖥️', category:'Display', tier:'premium',
            title: `${dtype} Display`,
            description: 'Self-lit pixels deliver true blacks, infinite contrast ratio, and vibrant colors. Superior to LCD in every condition.' });
    }

    if (valHas(dispType, 'HDR10+','HDR10','Dolby Vision')) {
        const hdr = dispType.match(/(Dolby Vision|HDR10\+|HDR10)/i)?.[1] || 'HDR';
        features.push({ icon:'🎨', category:'Display', tier:'premium',
            title: `${hdr} Support`,
            description: `Certified ${hdr} content playback. Streaming platforms like Netflix and Prime Video serve maximum quality HDR.` });
    }

    if (valHas(dispProt = flat.displayProt || '', 'Gorilla Glass Victus 2','Gorilla Glass Victus+')) {
        features.push({ icon:'🛡️', category:'Display', tier:'flagship',
            title: 'Corning Gorilla Glass Victus 2',
            description: 'Latest generation drop protection — survives falls up to 1m on rough surfaces. Most durable smartphone glass available.' });
    } else if (valHas(flat.displayProt || '', 'Gorilla Glass Victus','Gorilla Glass 7')) {
        features.push({ icon:'🛡️', category:'Display', tier:'premium',
            title: 'Corning Gorilla Glass Victus',
            description: 'Flagship-grade drop and scratch protection. Significantly tougher than standard Gorilla Glass.' });
    } else if (valHas(flat.displayProt || '', 'Ceramic Shield')) {
        features.push({ icon:'🛡️', category:'Display', tier:'flagship',
            title: 'Ceramic Shield',
            description: 'Apple\'s nano-ceramic crystal glass — 4x better drop performance than standard glass. Exclusive to iPhone.' });
    }

    if (has('always-on display','always on display','aod')) {
        features.push({ icon:'🕐', category:'Display', tier:'standard',
            title: 'Always-On Display (AOD)',
            description: 'Shows time, notifications and widgets without waking the screen. Minimal battery impact on AMOLED panels.' });
    }

    // ── CAMERA ───────────────────────────────────────────────
    const camText  = (getVal('Main Camera','Single') || getVal('Main Camera','Triple') || getVal('Main Camera','Quad') || getVal('Main Camera','Dual') || '').toLowerCase();
    const camFeat  = (flat.mainFeatures || '').toLowerCase();
    const camVideo = (flat.mainVideo || '').toLowerCase();

    // Periscope / telephoto zoom
    if (has('periscope')) {
        const zoom = allText.match(/(\d+)x optical/)?.[1];
        features.push({ icon:'🔭', category:'Camera', tier:'flagship',
            title: `Periscope Telephoto Lens${zoom ? ` (${zoom}x Optical)` : ''}`,
            description: `Folded periscope optics achieve extreme long-range zoom${zoom ? ` up to ${zoom}x` : ''} without a thick camera bump. Flagship-exclusive technology.` });
    } else if (has('3x optical','5x optical','10x optical','telephoto')) {
        const zoom = allText.match(/(\d+)x optical/)?.[1] || '';
        features.push({ icon:'🔭', category:'Camera', tier:'premium',
            title: `Telephoto Optical Zoom${zoom ? ` (${zoom}x)` : ''}`,
            description: `Dedicated telephoto lens for${zoom ? ` ${zoom}x` : ''} optical zoom — lossless quality at distance, unlike digital crop.` });
    }

    // Camera resolution
    const mpMatch = camText.match(/(\d{2,3})\s*mp/i);
    if (mpMatch) {
        const mp = parseInt(mpMatch[1]);
        if (mp >= 200) {
            features.push({ icon:'📸', category:'Camera', tier:'flagship',
                title: `${mp}MP Hyper-Resolution Camera`,
                description: `${mp} megapixel sensor captures extraordinary detail. Pixel-binning combines multiple pixels for low-light, full resolution for daylight.` });
        } else if (mp >= 100) {
            features.push({ icon:'📸', category:'Camera', tier:'premium',
                title: `${mp}MP High-Resolution Sensor`,
                description: `${mp}MP enables massive crops and extreme detail. Ideal for printing large format or zooming in post-capture.` });
        } else if (mp >= 50) {
            features.push({ icon:'📸', category:'Camera', tier:'standard',
                title: `${mp}MP Main Camera`,
                description: `${mp}MP sensor with pixel-binning for excellent detail in all lighting conditions.` });
        }
    }

    if (has('laser autofocus') || has('laser af')) {
        features.push({ icon:'🎯', category:'Camera', tier:'premium',
            title: 'Laser Autofocus',
            description: 'Dedicated laser module measures distance to subject — instant, accurate focus in complete darkness.' });
    }

    if (has('optical image stabilization','ois')) {
        features.push({ icon:'🎥', category:'Camera', tier:'premium',
            title: 'Optical Image Stabilization (OIS)',
            description: 'Physical lens shift compensates hand shake. Essential for sharp photos and smooth handheld video.' });
    }

    // Video
    if (valHas(camVideo, '8k')) {
        features.push({ icon:'🎬', category:'Camera', tier:'flagship',
            title: '8K Video Recording',
            description: '8K at 24/30fps — 4x the resolution of 4K. Future-proof cinema-grade footage from a smartphone.' });
    } else if (valHas(camVideo, '4k')) {
        const fps = camVideo.match(/4k[^,)]*?(\d+)fps/i)?.[1] || '';
        features.push({ icon:'🎬', category:'Camera', tier:'premium',
            title: `4K Video${fps ? ` @ ${fps}fps` : ''}`,
            description: `Ultra HD 4K recording${fps === '120' ? ' at 120fps — slow motion in 4K resolution' : fps === '60' ? ' at 60fps for buttery smooth footage' : ' for professional quality video'}.` });
    }

    if (has('night mode','night sight','nightography')) {
        features.push({ icon:'🌙', category:'Camera', tier:'standard',
            title: 'AI Night Mode',
            description: 'Computational multi-frame night photography — captures bright, detailed photos in near-total darkness.' });
    }

    if (has('pro video','log video','cinematic','dolby vision recording')) {
        features.push({ icon:'🎞️', category:'Camera', tier:'flagship',
            title: 'Pro / Cinematic Video Mode',
            description: 'Professional video tools with manual controls, LOG format, or Dolby Vision recording for filmmakers and creators.' });
    }

    if (has('lidar')) {
        features.push({ icon:'📡', category:'Camera', tier:'flagship',
            title: 'LiDAR Scanner',
            description: 'Apple\'s LiDAR sensor maps environment depth in real-time. Enables instant AR, professional 3D scanning, and faster night AF.' });
    }

    // ── PERFORMANCE ──────────────────────────────────────────
    const chipset = (flat.chipset || '').toLowerCase();
    const cpu     = (flat.cpu || '').toLowerCase();

    if (valHas(chipset, 'snapdragon 8 gen 3','snapdragon 8 elite')) {
        features.push({ icon:'🚀', category:'Performance', tier:'flagship',
            title: has('snapdragon 8 elite') ? 'Snapdragon 8 Elite' : 'Snapdragon 8 Gen 3',
            description: 'Qualcomm\'s most powerful mobile chip. Best-in-class CPU, GPU, and dedicated on-device AI processing (NPU). Flagship Android standard.' });
    } else if (valHas(chipset, 'snapdragon 8 gen 2','snapdragon 8 gen 1')) {
        features.push({ icon:'🚀', category:'Performance', tier:'flagship',
            title: chipset.includes('gen 2') ? 'Snapdragon 8 Gen 2' : 'Snapdragon 8 Gen 1',
            description: 'Top-tier Qualcomm flagship processor. Exceptional performance for gaming, AI tasks, and heavy multitasking.' });
    } else if (valHas(chipset, 'dimensity 9300','dimensity 9200','dimensity 9000')) {
        const chip = flat.chipset?.match(/Dimensity \d+/i)?.[0] || 'Dimensity 9000+';
        features.push({ icon:'🚀', category:'Performance', tier:'flagship',
            title: `MediaTek ${chip}`,
            description: 'MediaTek\'s flagship SoC — all-big-core architecture delivering extreme peak performance. Competitive with top Snapdragon chips.' });
    } else if (valHas(chipset, 'a18','a17','a16','a15 bionic','apple')) {
        const achip = flat.chipset?.match(/A\d+\s*\w*/i)?.[0] || 'Apple Silicon';
        features.push({ icon:'🍎', category:'Performance', tier:'flagship',
            title: `Apple ${achip} Chip`,
            description: 'Apple\'s custom silicon leads in single-core performance and efficiency. Designed specifically for iOS with Neural Engine for AI.' });
    } else if (valHas(chipset, 'tensor')) {
        const tensor = flat.chipset?.match(/Tensor \w+/i)?.[0] || 'Tensor';
        features.push({ icon:'🧠', category:'Performance', tier:'flagship',
            title: `Google ${tensor}`,
            description: 'Google\'s custom AI-first chip. Handles on-device AI, real-time translation, call screening, and speech processing locally.' });
    }

    if (has('ufs 4.0','ufs4.0')) {
        features.push({ icon:'⚡', category:'Performance', tier:'flagship',
            title: 'UFS 4.0 Storage',
            description: 'Latest generation storage standard — 2x faster than UFS 3.1. Apps install instantly, camera shoots to storage without lag.' });
    } else if (has('ufs 3.1','ufs3.1')) {
        features.push({ icon:'⚡', category:'Performance', tier:'premium',
            title: 'UFS 3.1 Storage',
            description: 'High-speed storage for fast app launches, quick camera saves, and smooth overall performance.' });
    }

    if (has('lpddr5x','lpddr5')) {
        const ram = has('lpddr5x') ? 'LPDDR5X' : 'LPDDR5';
        features.push({ icon:'💾', category:'Performance', tier: has('lpddr5x') ? 'flagship' : 'premium',
            title: `${ram} RAM`,
            description: `${ram} delivers ultra-fast memory bandwidth — critical for gaming, video editing, and heavy multitasking without stutter.` });
    }

    // ── BATTERY & CHARGING ───────────────────────────────────
    const charging = (flat.charging || '').toLowerCase();

    const wiredW = parseInt(charging.match(/(\d+)w/i)?.[1] || '0');
    if (wiredW >= 100) {
        features.push({ icon:'⚡', category:'Battery', tier:'flagship',
            title: `${wiredW}W HyperCharge / Flash Charging`,
            description: `${wiredW}W ultra-fast charging — 0 to 100% in under 20 minutes. Charges faster than most laptops. Industry-leading speed.` });
    } else if (wiredW >= 65) {
        features.push({ icon:'⚡', category:'Battery', tier:'premium',
            title: `${wiredW}W Fast Charging`,
            description: `${wiredW}W supercharge goes from 0 to 50% in approximately 15-20 minutes. No more long overnight charging waits.` });
    } else if (wiredW >= 30) {
        features.push({ icon:'⚡', category:'Battery', tier:'standard',
            title: `${wiredW}W Fast Charging`,
            description: `${wiredW}W fast charging provides a significant speed boost over standard 5W/10W chargers.` });
    }

    const wirelessW = charging.match(/(\d+)w wireless/i)?.[1] || charging.match(/wireless.*?(\d+)w/i)?.[1];
    if (wirelessW) {
        const w = parseInt(wirelessW);
        features.push({ icon:'🔋', category:'Battery', tier: w >= 50 ? 'flagship' : w >= 15 ? 'premium' : 'standard',
            title: `${w}W Wireless Charging`,
            description: `${w}W wireless charging${w >= 50 ? ' — nearly as fast as wired. Just set it down, fully charged in under an hour' : ' lets you charge cable-free on any Qi pad'}.` });
    }

    if (has('reverse wireless','reverse charging','powershare','magsafe','qi2')) {
        const type = has('magsafe') ? 'MagSafe' : has('qi2') ? 'Qi2' : 'Reverse Wireless';
        features.push({ icon:'🔄', category:'Battery', tier:'premium',
            title: `${type} Charging`,
            description: type === 'MagSafe'
                ? 'Apple MagSafe magnetically aligns for optimal wireless charging + snap-on accessories ecosystem.'
                : type === 'Qi2'
                ? 'Qi2 is the open standard for magnetic wireless charging — compatible with all Qi2 accessories.'
                : 'Use your phone as a wireless charger for earbuds, smartwatches, or other phones.' });
    }

    const batMatch = allText.match(/(\d{4,5})\s*mah/i);
    if (batMatch) {
        const mah = parseInt(batMatch[1]);
        if (mah >= 6000) {
            features.push({ icon:'🔋', category:'Battery', tier:'premium',
                title: `${mah}mAh Mega Battery`,
                description: `Massive ${mah}mAh cell — expect 2+ full days of mixed use between charges. Best for power users and travelers.` });
        } else if (mah >= 5000) {
            features.push({ icon:'🔋', category:'Battery', tier:'standard',
                title: `${mah}mAh Large Battery`,
                description: `${mah}mAh comfortably lasts a full day of heavy use with battery to spare overnight.` });
        }
    }

    // ── CONNECTIVITY ─────────────────────────────────────────
    const wlan    = (flat.wlan || '').toLowerCase();
    const usb     = (flat.usb || '').toLowerCase();
    const sensors = (flat.sensors || '').toLowerCase();
    const comms   = Object.values(specs['Comms'] || {}).join(' ').toLowerCase();

    if (has('wi-fi 7','wifi 7','802.11be')) {
        features.push({ icon:'📶', category:'Connectivity', tier:'flagship',
            title: 'Wi-Fi 7 (802.11be)',
            description: 'Latest Wi-Fi generation — up to 46Gbps theoretical throughput, ultra-low latency, multi-link operation. Future-proof wireless.' });
    } else if (has('wi-fi 6e','wifi 6e','802.11ax')) {
        features.push({ icon:'📶', category:'Connectivity', tier:'premium',
            title: 'Wi-Fi 6E (6GHz Band)',
            description: 'Wi-Fi 6E adds the uncrowded 6GHz band — fastest real-world Wi-Fi speeds with minimal interference in dense areas.' });
    }

    if (has('satellite')) {
        features.push({ icon:'🛰️', category:'Connectivity', tier:'flagship',
            title: 'Satellite Connectivity',
            description: 'Connect to emergency services and send messages via satellite — even in remote areas with zero cellular coverage. Could save your life.' });
    }

    if (has('5g')) {
        const sub6  = has('sub6','sub-6');
        const mmwave = has('mmwave','mm wave');
        features.push({ icon:'📡', category:'Connectivity', tier:'standard',
            title: `5G Connectivity${mmwave ? ' (Sub-6 + mmWave)' : ''}`,
            description: `5G capable${mmwave ? ' with mmWave for peak multi-Gbps speeds in dense urban areas' : ' for multi-Gbps downloads and ultra-low latency gaming'}.` });
    }

    if (valHas(usb, 'usb 3','usb3','thunderbolt','usb4')) {
        const usbType = usb.includes('thunderbolt') ? 'Thunderbolt' : usb.includes('usb4') ? 'USB4' : 'USB 3.x';
        features.push({ icon:'🔌', category:'Connectivity', tier:'premium',
            title: `${usbType} High-Speed Port`,
            description: `${usbType} enables high-speed file transfers, video output to external monitors, and powering accessories — far beyond USB 2.0.` });
    }

    if (has('ultra-wideband','uwb')) {
        features.push({ icon:'📍', category:'Connectivity', tier:'premium',
            title: 'Ultra-Wideband (UWB)',
            description: 'Centimeter-precise spatial awareness. Powers AirDrop direction, Apple AirTag precision finding, and secure digital car keys.' });
    }

    if (has('nfc') && !(flat.nfc || '').toLowerCase().includes('no')) {
        features.push({ icon:'💳', category:'Connectivity', tier:'standard',
            title: 'NFC (Tap to Pay)',
            description: 'Near-field communication for contactless payments, transit cards, and pairing accessories by tap.' });
    }

    // ── SENSORS & SECURITY ───────────────────────────────────
    if (has('under-display fingerprint','in-display fingerprint','under display fingerprint')) {
        const type = has('ultrasonic') ? 'Ultrasonic' : 'Optical';
        features.push({ icon:'👆', category:'Security', tier: type === 'Ultrasonic' ? 'flagship' : 'premium',
            title: `${type} Under-Display Fingerprint`,
            description: type === 'Ultrasonic'
                ? 'Qualcomm ultrasonic fingerprint works through water and light — faster and more secure than optical variants.'
                : 'In-display optical fingerprint reader — clean look with no physical button, scans through the screen glass.' });
    } else if (has('side-mounted fingerprint','side fingerprint')) {
        features.push({ icon:'👆', category:'Security', tier:'standard',
            title: 'Side-Mounted Fingerprint',
            description: 'Fast, reliable fingerprint reader integrated into the power button — ergonomic position for natural thumb placement.' });
    }

    if (has('face id','face recognition','face unlock','3d face')) {
        const type = has('face id','truedepth','structured light') ? 'Face ID (3D)' : 'Face Unlock (2D)';
        features.push({ icon:'👤', category:'Security', tier: type.includes('3D') ? 'flagship' : 'standard',
            title: type,
            description: type.includes('3D')
                ? 'Secure 3D face scan maps 30,000 invisible dots — cannot be fooled by photos. Apple Face ID is the gold standard.'
                : '2D front-camera face unlock — fast and convenient, though less secure than 3D or fingerprint.' });
    }

    if (has('ir blaster','infrared')) {
        features.push({ icon:'📺', category:'Features', tier:'standard',
            title: 'IR Blaster',
            description: 'Infrared transmitter turns your phone into a universal remote for TVs, ACs, and other home appliances.' });
    }

    if (has('stylus','s pen','pencil')) {
        const stylus = has('s pen') ? 'Samsung S Pen' : has('pencil') ? 'Apple Pencil' : 'Stylus';
        features.push({ icon:'✏️', category:'Features', tier:'flagship',
            title: `${stylus} Support`,
            description: `${stylus} enables precision handwriting, note-taking, drawing, and pixel-perfect navigation. Built-in storage means it's always with you.` });
    }

    if (has('satellite messaging','emergency sos via satellite')) {
        features.push({ icon:'🆘', category:'Features', tier:'flagship',
            title: 'Emergency SOS via Satellite',
            description: 'Send emergency alerts and messages to rescue services via satellite when no cellular signal is available. Can be life-saving.' });
    }

    if (has('water resistant','waterproof','ip68','ip67','ip65')) {
        const rating = allText.match(/ip\d{2}/i)?.[0]?.toUpperCase() || 'IP68';
        const depth  = allText.match(/(\d+)\s*m(?:eters?)?\s*(?:water|submersible)/i)?.[1] || '';
        features.push({ icon:'💧', category:'Features', tier: rating === 'IP68' ? 'premium' : 'standard',
            title: `${rating} Water Resistance${depth ? ` (${depth}m)` : ''}`,
            description: `${rating} rating${rating === 'IP68' ? ` — submersible up to ${depth || '1.5'}m for 30 minutes. Swim, shower, rain — no problem` : ' — splash and light rain protection for everyday accidents'}.` });
    }

    if (has('titanium')) {
        features.push({ icon:'⚙️', category:'Build', tier:'flagship',
            title: 'Titanium Frame',
            description: 'Aircraft-grade titanium frame — stronger and lighter than stainless steel. Premium material used in high-end watches and aerospace.' });
    } else if (has('stainless steel')) {
        features.push({ icon:'⚙️', category:'Build', tier:'premium',
            title: 'Stainless Steel Frame',
            description: 'Premium stainless steel construction gives a substantial, high-quality feel with excellent corrosion resistance.' });
    }

    if (has('ceramic','ceramic back','ceramic shield')) {
        features.push({ icon:'🏺', category:'Build', tier:'flagship',
            title: 'Ceramic Back',
            description: 'Ceramic is harder than glass, scratch-resistant, and has a luxurious cool-to-touch feel. Premium material found in high-end flagships.' });
    }

    // ── AI FEATURES ──────────────────────────────────────────
    if (has('galaxy ai','google ai','apple intelligence','ai features','on-device ai')) {
        const aiName = has('galaxy ai') ? 'Galaxy AI' : has('apple intelligence') ? 'Apple Intelligence' : has('google ai') ? 'Google AI' : 'On-Device AI';
        features.push({ icon:'🤖', category:'AI', tier:'flagship',
            title: `${aiName}`,
            description: `${aiName} — suite of on-device AI features including writing assistance, image editing, real-time translation, and intelligent suggestions.` });
    }

    if (has('ray tracing')) {
        features.push({ icon:'🎮', category:'Performance', tier:'flagship',
            title: 'Hardware Ray Tracing',
            description: 'GPU-level ray tracing support for physically accurate lighting in games. Console-quality visuals on mobile.' });
    }

    if (has('thermal','vapor chamber','cooling')) {
        features.push({ icon:'❄️', category:'Performance', tier:'premium',
            title: 'Advanced Thermal System',
            description: 'Vapor chamber or multi-layer cooling keeps the processor cool under sustained load — maintains peak performance longer during gaming.' });
    }

    if (has('dolby atmos','dolby audio')) {
        features.push({ icon:'🔊', category:'Audio', tier:'premium',
            title: 'Dolby Atmos Audio',
            description: 'Dolby Atmos processing delivers immersive 3D spatial audio through speakers and headphones — major upgrade over standard stereo.' });
    }

    if (has('hi-res audio','hi res audio','lossless audio','aptx lossless')) {
        features.push({ icon:'🎵', category:'Audio', tier:'premium',
            title: 'Hi-Res / Lossless Audio',
            description: 'Certified high-resolution audio playback — streams Apple Music Lossless, TIDAL Hi-Fi, or local FLAC files at full quality.' });
    }

    if (valHas(flat.jack || '', 'yes') || has('headphone jack','3.5mm jack')) {
        features.push({ icon:'🎧', category:'Audio', tier:'standard',
            title: '3.5mm Headphone Jack',
            description: 'Physical headphone jack for zero-latency wired audio — use any standard headphone without adapters or Bluetooth pairing.' });
    }

    // Sort: flagship first, then premium, then standard
    const tierOrder = { flagship: 0, premium: 1, standard: 2 };
    features.sort((a, b) => tierOrder[a.tier] - tierOrder[b.tier]);

    return features;
}
