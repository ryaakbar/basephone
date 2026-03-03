/**
 * Root compatibility intelligence
 * Returns root info based on device name / chipset / brand
 */

// Brand-level bootloader policy
const BRAND_POLICY = {
    samsung:  { unlockable: 'varies', note: 'Samsung locks bootloader on carrier models. Exynos variants easier. Knox trips permanently.' },
    xiaomi:   { unlockable: true,  note: 'Official Mi Unlock Tool available. 7-day waiting period required.' },
    poco:     { unlockable: true,  note: 'Uses Mi Unlock Tool. Most POCO devices are developer-friendly.' },
    redmi:    { unlockable: true,  note: 'Uses Mi Unlock Tool. Some carrier models may be restricted.' },
    oneplus:  { unlockable: true,  note: 'Bootloader unlock officially supported. fastboot oem unlock command.' },
    oppo:     { unlockable: false, note: 'OPPO officially does not support bootloader unlock on most devices.' },
    realme:   { unlockable: 'varies', note: 'Some Realme devices support unlock via deeptest account.' },
    vivo:     { unlockable: false, note: 'Vivo does not officially support bootloader unlock.' },
    huawei:   { unlockable: false, note: 'Huawei stopped providing unlock codes since 2018. Exploit-only methods.' },
    honor:    { unlockable: false, note: 'Similar to Huawei — no official unlock support.' },
    google:   { unlockable: true,  note: 'Google Pixel has the best root support. fastboot flashing unlock.' },
    motorola: { unlockable: true,  note: 'Motorola provides official unlock via motorola.com/unlockr.' },
    nokia:    { unlockable: 'varies', note: 'HMD Global unlockable on some models but limited custom ROM support.' },
    sony:     { unlockable: true,  note: 'Sony provides official unlock via developer.sony.com. DRM keys lost.' },
    asus:     { unlockable: true,  note: 'ASUS provides official unlock. ROG Phone series well supported.' },
    lg:       { unlockable: 'varies', note: 'LG discontinued. Most older LG devices have good root support.' },
    htc:      { unlockable: true,  note: 'HTC provides official unlock via htcdev.com.' },
    lenovo:   { unlockable: 'varies', note: 'Lenovo/ZUK varies by model. Some have official unlock.' },
    nothing:  { unlockable: true,  note: 'Nothing Phone supports bootloader unlock officially.' },
    fairphone: { unlockable: true, note: 'Fairphone champions repairability and official unlock support.' },
};

// Chipset-specific notes
const CHIPSET_NOTES = {
    'snapdragon': 'Qualcomm Snapdragon — generally good root support. EDL mode available as fallback.',
    'dimensity':  'MediaTek Dimensity — root possible but fewer custom ROMs vs Snapdragon.',
    'helio':      'MediaTek Helio — root possible. SP Flash Tool for MediaTek recovery.',
    'exynos':     'Samsung Exynos — root via Magisk but Knox trips. Limited custom ROM.',
    'kirin':      'HiSilicon Kirin (Huawei) — extremely difficult to root. No official support.',
    'tensor':     'Google Tensor — excellent root support. First-party Pixel.',
    'apple':      'Apple Silicon — iOS jailbreak only, not traditional Android root.',
    'unisoc':     'UNISOC — limited root support. SP Flash Tool method sometimes works.',
};

// Root methods
const ROOT_METHODS = {
    magisk: {
        name: 'Magisk',
        icon: '🔮',
        desc: 'Most popular systemless root. Supports modules, MagiskHide, Zygisk.',
        link: 'https://github.com/topjohnwu/Magisk',
        recommended: true,
    },
    kernelsu: {
        name: 'KernelSU',
        icon: '⚡',
        desc: 'Kernel-based root solution. More secure than Magisk. Requires kernel support.',
        link: 'https://kernelsu.org',
        recommended: true,
    },
    apatch: {
        name: 'APatch',
        icon: '🔧',
        desc: 'Android Patching System. Kernel-level root, newer alternative to KernelSU.',
        link: 'https://github.com/bmax121/APatch',
        recommended: false,
    },
    twrp: {
        name: 'TWRP Recovery',
        icon: '🛡️',
        desc: 'Custom recovery needed to flash Magisk ZIP. Required for most root workflows.',
        link: 'https://twrp.me/Devices/',
        recommended: true,
    },
};

// Tools
const ROOT_TOOLS = [
    { name: 'ADB & Fastboot',  desc: 'Essential tools for bootloader unlock & flashing', link: 'https://developer.android.com/tools/releases/platform-tools', icon: '🖥️' },
    { name: 'Mi Unlock Tool',   desc: 'Official Xiaomi bootloader unlock tool',           link: 'https://en.miui.com/unlock/',                                icon: '🔓' },
    { name: 'Odin',             desc: 'Samsung firmware flashing tool (Windows)',          link: 'https://odindownload.com',                                   icon: '⚙️' },
    { name: 'SP Flash Tool',    desc: 'MediaTek device flashing & recovery',              link: 'https://spflashtool.com',                                    icon: '📱' },
    { name: 'Motorola Unlock',  desc: 'Official Motorola bootloader unlock portal',       link: 'https://motorola-global-portal.custhelp.com/app/standalone/bootloader/unlock-your-device-a', icon: '🔑' },
    { name: 'Sony Unlock',      desc: 'Official Sony bootloader unlock portal',           link: 'https://developer.sony.com/open-source/aosp-on-xperia-open-devices/get-started/unlock-bootloader', icon: '🔑' },
];

// Risks
const RISKS = [
    { level: 'high',   icon: '🔴', text: 'Warranty void immediately upon bootloader unlock' },
    { level: 'high',   icon: '🔴', text: 'Knox/security fuse trips permanently (Samsung)' },
    { level: 'medium', icon: '🟡', text: 'Brick risk if wrong firmware flashed' },
    { level: 'medium', icon: '🟡', text: 'OTA updates may be blocked or break root' },
    { level: 'medium', icon: '🟡', text: 'Banking apps (Gcash, Gojek) may detect root' },
    { level: 'low',    icon: '🟢', text: 'Data will be wiped during bootloader unlock' },
    { level: 'low',    icon: '🟢', text: 'DRM keys may be lost (Sony, affects Netflix HD)' },
];

/**
 * Get root info for a device
 * @param {string} deviceName
 * @param {string} chipset
 * @param {string} brand - extracted from device name/id
 */
export function getRootInfo(deviceName, chipset = '', brand = '') {
    const nameLower     = (deviceName || '').toLowerCase();
    const chipsetLower  = (chipset || '').toLowerCase();
    const brandLower    = (brand || '').toLowerCase();

    // Detect brand from name if not provided
    let detectedBrand = brandLower;
    if (!detectedBrand) {
        for (const b of Object.keys(BRAND_POLICY)) {
            if (nameLower.startsWith(b)) { detectedBrand = b; break; }
        }
    }

    const policy = BRAND_POLICY[detectedBrand] || {
        unlockable: 'unknown',
        note: 'Bootloader unlock status unknown for this brand. Check XDA Developers.',
    };

    // Detect chipset note
    let chipsetNote = null;
    for (const [key, note] of Object.entries(CHIPSET_NOTES)) {
        if (chipsetLower.includes(key)) { chipsetNote = note; break; }
    }

    // Determine root status
    let rootStatus, rootColor, rootLabel;
    if (policy.unlockable === true) {
        rootStatus = 'rootable';
        rootColor  = 'green';
        rootLabel  = 'Rootable ✓';
    } else if (policy.unlockable === false) {
        rootStatus = 'not-rootable';
        rootColor  = 'red';
        rootLabel  = 'Not Rootable ✗';
    } else {
        rootStatus = 'varies';
        rootColor  = 'amber';
        rootLabel  = 'Varies by Model';
    }

    // Recommended methods based on brand
    let recommendedMethods = [ROOT_METHODS.magisk, ROOT_METHODS.twrp];
    if (['google', 'oneplus', 'motorola', 'xiaomi', 'poco', 'redmi'].includes(detectedBrand)) {
        recommendedMethods = [ROOT_METHODS.magisk, ROOT_METHODS.kernelsu, ROOT_METHODS.twrp];
    }

    // XDA link
    const xdaQuery = encodeURIComponent(deviceName || brand);
    const xdaLink  = `https://forum.xda-developers.com/search/q/${xdaQuery}`;

    return {
        rootStatus,
        rootColor,
        rootLabel,
        brand: detectedBrand || 'unknown',
        policy,
        chipsetNote,
        recommendedMethods,
        tools: ROOT_TOOLS,
        risks: RISKS,
        xdaLink,
        disclaimer: 'Rooting voids warranty and may brick your device. Proceed at your own risk. Always backup data first.',
    };
}
