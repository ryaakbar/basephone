// BasePhone — Complete Frontend Script

// ---- STATE ----
let bookmarks = lsGet('bp_bookmarks', '[]');
let currentDevice = null;
let currentView = 'search';
let compareA = null, compareB = null;
let searchTimeout;

// ---- INIT ----
document.addEventListener('DOMContentLoaded', () => {
    updateBookmarkBadge();
    initSlotSearch('A');
    initSlotSearch('B');
    initReveal();
    // Check URL params for deep link
    const params = new URLSearchParams(location.search);
    if (params.get('device')) openDevice(params.get('device'));
});

// ============================================
// VIEW ROUTING
// ============================================
function showView(name) {
    currentView = name;
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    document.getElementById('view-' + name)?.classList.add('active');
    document.getElementById('tab-' + name)?.classList.add('active');
    if (name === 'bookmarks') renderBookmarks();
}

function goHome() { showView('search'); }
function goBack() { showView('search'); }

// ============================================
// SEARCH
// ============================================
document.getElementById('searchInput')?.addEventListener('input', (e) => {
    clearTimeout(searchTimeout);
    const q = e.target.value.trim();
    if (q.length < 2) { hideSuggestions(); return; }
    searchTimeout = setTimeout(() => fetchSuggestions(q), 350);
});

document.getElementById('searchInput')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') doSearch();
    if (e.key === 'Escape') hideSuggestions();
});

async function doSearch() {
    const q = document.getElementById('searchInput').value.trim();
    if (!q) return;
    hideSuggestions();
    showSkeleton(true);
    document.getElementById('resultsWrap').classList.add('hidden');
    document.getElementById('searchError').classList.add('hidden');
    // Collapse hero to compact mode while showing results
    document.querySelector('.hero')?.classList.add('hero-compact');

    try {
        const data = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
        showSkeleton(false);
        if (!data.results?.length) {
            showSearchError(`No devices found for "${q}"`);
            return;
        }
        renderDeviceGrid(data.results);
    } catch (err) {
        showSkeleton(false);
        showSearchError(err.message || 'Search failed');
    }
}

function quickSearch(q) {
    document.getElementById('searchInput').value = q;
    doSearch();
}

function clearResults() {
    document.getElementById('resultsWrap').classList.add('hidden');
    document.getElementById('searchInput').value = '';
    document.getElementById('skeletonWrap').classList.add('hidden');
    document.getElementById('searchError').classList.add('hidden');
    // Restore hero to full mode
    document.querySelector('.hero')?.classList.remove('hero-compact');
}

async function fetchSuggestions(q) {
    try {
        const data = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
        if (data.results?.length) showSuggestions(data.results.slice(0, 6));
    } catch(e) {}
}

function showSuggestions(items) {
    const box = document.getElementById('suggestions');
    if (!box) return;
    box._items = items;
    box.innerHTML = items.map((d, i) => `
        <div class="sug-item" onclick="openDeviceFromSug(${i})">
            <img class="sug-img" src="${d.thumbnail || ''}" onerror="this.style.opacity=.2" alt="">
            <div class="sug-info">
                <div class="sug-name">${escHtml(d.name)}</div>
                <div class="sug-desc">${escHtml(d.description || '')}</div>
            </div>
        </div>`).join('');
    box.classList.remove('hidden');
}

function openDeviceFromSug(i) {
    const box = document.getElementById('suggestions');
    if (!box?._items) return;
    const d = box._items[i];
    hideSuggestions();
    openDevice(d.id, d);
}

function hideSuggestions() {
    document.getElementById('suggestions')?.classList.add('hidden');
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-box')) hideSuggestions();
});

function renderDeviceGrid(devices) {
    const wrap = document.getElementById('resultsWrap');
    const grid = document.getElementById('deviceGrid');
    document.getElementById('resultsTitle').textContent = `${devices.length} device${devices.length !== 1 ? 's' : ''} found`;

    grid.innerHTML = devices.map((d) => {
        const saved = bookmarks.some(b => b.id === d.id);
        return `
        <div class="device-card" onclick="openDevice('${escHtml(d.id)}', ${JSON.stringify({id:d.id,name:d.name,thumbnail:d.thumbnail,description:d.description}).replace(/"/g,'&quot;')})">
            <button class="dc-save ${saved ? 'saved' : ''}" onclick="event.stopPropagation();toggleBookmarkCard('${escHtml(d.id)}',this)" title="Save">
                <i class="fa-${saved ? 'solid' : 'regular'} fa-bookmark"></i>
            </button>
            <div class="dc-img-wrap">
                <img class="dc-img" src="${d.thumbnail || ''}" onerror="this.style.opacity=.15" alt="${escHtml(d.name)}" loading="lazy">
            </div>
            <div class="dc-name">${escHtml(d.name)}</div>
            <div class="dc-desc">${escHtml(d.description || '')}</div>
        </div>`;
    }).join('');

    wrap.classList.remove('hidden');
}

function showSkeleton(show) {
    document.getElementById('skeletonWrap').classList.toggle('hidden', !show);
}

function showSearchError(msg) {
    document.getElementById('searchErrorMsg').textContent = msg;
    document.getElementById('searchError').classList.remove('hidden');
}

// ============================================
// DEVICE DETAIL
// ============================================
async function openDevice(id, basicInfo = null) {
    showView('detail');
    document.getElementById('detailContent').classList.add('hidden');
    document.getElementById('detailError').classList.add('hidden');
    document.getElementById('detailSkeleton').style.display = 'block';

    try {
        const data = await apiFetch(`/api/device?id=${encodeURIComponent(id)}`);
        currentDevice = { ...data.device, rootInfo: data.rootInfo };
        document.getElementById('detailSkeleton').style.display = 'none';
        renderDetail(data.device, data.rootInfo);
    } catch (err) {
        document.getElementById('detailSkeleton').style.display = 'none';
        document.getElementById('detailErrorMsg').textContent = err.message || 'Failed to load device';
        document.getElementById('detailError').classList.remove('hidden');
    }
}

function renderDetail(device, rootInfo) {
    const { name, thumbnail, url, specs, flat } = device;

    // Extract brand from name
    const brand = name.split(' ')[0];
    document.getElementById('detailBrand').textContent = brand.toUpperCase();
    document.getElementById('detailName').textContent = name;
    document.getElementById('detailDesc').textContent = flat?.announced || flat?.status || '';
    document.getElementById('detailImg').src = thumbnail || '';
    document.getElementById('detailGsmLink').href = url || '#';

    // Quick stats chips
    const chips = [
        flat?.displaySize   && `📱 ${flat.displaySize}`,
        flat?.chipset       && `⚡ ${flat.chipset?.split(' ').slice(0,3).join(' ')}`,
        flat?.storage       && `💾 ${flat.storage?.split(' ')[0]}`,
        flat?.batteryType   && `🔋 ${flat.batteryType}`,
        flat?.os            && `🤖 ${flat.os?.split(';')[0]}`,
    ].filter(Boolean);

    document.getElementById('detailQuickStats').innerHTML =
        chips.map(c => `<div class="qs-chip">${c}</div>`).join('');

    // ---- SPECIAL FEATURES STRIP (in hero) ----
    const sf = device.specialFeatures || [];
    const stripEl = document.getElementById('detailSpecialStrip');
    if (stripEl) {
        if (sf.length) {
            // Show top 5 flagship/premium features as chips
            const top = sf.slice(0, 6);
            stripEl.innerHTML = top.map(f =>
                `<div class="sf-strip-chip ${f.tier}" title="${escHtml(f.description)}">
                    <span>${f.icon}</span><span>${escHtml(f.title)}</span>
                </div>`
            ).join('');
            stripEl.classList.remove('hidden');
        } else {
            stripEl.classList.add('hidden');
        }
    }

    // Bookmark button
    updateBookmarkBtn(device.id);

    // ---- ALL SPECS ----
    const catIcons = {
        'Network':'🌐','Launch':'🚀','Body':'📐','Display':'📺',
        'Platform':'⚡','Memory':'💾','Main Camera':'📷','Selfie camera':'🤳',
        'Sound':'🔊','Comms':'📡','Features':'✨','Battery':'🔋','Misc':'ℹ️',
    };

    const allSpecsHTML = Object.entries(specs).map(([cat, rows]) => {
        const icon = catIcons[cat] || '📋';
        const rowsHTML = Object.entries(rows).map(([k, v]) => `
            <div class="spec-row">
                <div class="spec-key">${escHtml(k)}</div>
                <div class="spec-val">${escHtml(v)}</div>
            </div>`).join('');
        return `
        <div class="spec-category">
            <div class="spec-cat-header">
                <div class="spec-cat-icon">${icon}</div>
                <div class="spec-cat-name">${escHtml(cat)}</div>
            </div>
            ${rowsHTML}
        </div>`;
    }).join('');
    document.getElementById('allSpecsContainer').innerHTML = allSpecsHTML || '<div class="empty-state"><i class="fa-solid fa-circle-info"></i><p>No specs data available</p></div>';

    // ---- SPECIAL FEATURES FULL SECTION ----
    renderSpecialFeatures(sf, device.name);

    // ---- DISPLAY TAB ----
    const displayRows = [
        ['Type',       flat?.displayType],
        ['Size',       flat?.displaySize],
        ['Resolution', flat?.displayRes],
        ['Protection', flat?.displayProt],
    ];
    document.getElementById('displayContainer').innerHTML = buildSpecCard('📺 Display & Design', [
        ...displayRows,
        ['Dimensions', flat?.dimensions],
        ['Weight',     flat?.weight],
        ['Build',      flat?.build],
        ['SIM',        flat?.sim],
        ['Colors',     flat?.colors],
    ]);

    // ---- CAMERA TAB ----
    document.getElementById('cameraContainer').innerHTML =
        buildSpecCard('📷 Main Camera', [
            ['Specs',    flat?.mainCamera],
            ['Features', flat?.mainFeatures],
            ['Video',    flat?.mainVideo],
        ]) +
        buildSpecCard('🤳 Selfie Camera', [
            ['Specs', flat?.selfieCamera],
            ['Video', flat?.selfieVideo],
        ]);

    // ---- PERFORMANCE TAB ----
    document.getElementById('performanceContainer').innerHTML = buildSpecCard('⚡ Platform', [
        ['OS',      flat?.os],
        ['Chipset', flat?.chipset],
        ['CPU',     flat?.cpu],
        ['GPU',     flat?.gpu],
        ['Storage', flat?.storage],
        ['Card Slot', flat?.cardSlot],
    ]);

    // ---- BATTERY TAB ----
    document.getElementById('batteryContainer').innerHTML = buildSpecCard('🔋 Battery', [
        ['Type',     flat?.batteryType],
        ['Charging', flat?.charging],
        ['Life',     flat?.batteryLife],
        ['WLAN',     flat?.wlan],
        ['Bluetooth', flat?.bluetooth],
        ['NFC',      flat?.nfc],
        ['USB',      flat?.usb],
    ]);

    // ---- ROOT TAB ----
    renderRootInfo(rootInfo, name);

    document.getElementById('detailContent').classList.remove('hidden');
    // Default tab
    switchSpecTab('specs');
}

function buildSpecCard(title, rows) {
    const validRows = rows.filter(([, v]) => v);
    if (!validRows.length) return '';
    const rowsHTML = validRows.map(([k, v]) => `
        <div class="spec-row">
            <div class="spec-key">${escHtml(k)}</div>
            <div class="spec-val">${escHtml(v)}</div>
        </div>`).join('');
    return `
    <div class="spec-category">
        <div class="spec-cat-header">
            <div class="spec-cat-icon">${title.split(' ')[0]}</div>
            <div class="spec-cat-name">${escHtml(title.replace(/^[^\s]+\s/, ''))}</div>
        </div>
        ${rowsHTML}
    </div>`;
}

function renderRootInfo(rootInfo, deviceName) {
    const {
        rootStatus, rootColor, rootLabel, policy,
        chipsetNote, recommendedMethods, tools, risks, xdaLink, disclaimer
    } = rootInfo;

    const methodsHTML = recommendedMethods.map(m => `
        <div class="root-method-card ${m.recommended ? 'recommended' : ''}">
            <div class="rmc-header">
                <span class="rmc-icon">${m.icon}</span>
                <span class="rmc-name">${m.name}</span>
                ${m.recommended ? '<span class="rmc-rec">RECOMMENDED</span>' : ''}
            </div>
            <div class="rmc-desc">${m.desc}</div>
            <a class="rmc-link" href="${m.link}" target="_blank" rel="noopener">
                <i class="fa-solid fa-arrow-up-right-from-square"></i> Learn More
            </a>
        </div>`).join('');

    const toolsHTML = tools.map(t => `
        <a class="tool-card" href="${t.link}" target="_blank" rel="noopener">
            <div class="tool-card-top">
                <span class="tool-icon">${t.icon}</span>
                <span class="tool-name">${t.name}</span>
            </div>
            <div class="tool-desc">${t.desc}</div>
        </a>`).join('');

    const risksHTML = risks.map(r => `
        <div class="risk-item">
            <span>${r.icon}</span>
            <span>${r.text}</span>
        </div>`).join('');

    document.getElementById('rootContainer').innerHTML = `
        <div class="root-status-banner ${rootColor}">
            <div class="root-status-icon">${rootColor === 'green' ? '🔓' : rootColor === 'red' ? '🔒' : '⚠️'}</div>
            <div>
                <div class="root-status-label">${rootLabel}</div>
                <div class="root-status-note">${policy.note}</div>
            </div>
        </div>

        ${chipsetNote ? `
        <div class="root-section">
            <div class="root-section-title">Chipset Note</div>
            <div class="risk-item"><span>💡</span><span>${chipsetNote}</span></div>
        </div>` : ''}

        <div class="root-section">
            <div class="root-section-title">Recommended Root Methods</div>
            <div class="root-methods-grid">${methodsHTML}</div>
        </div>

        <div class="root-section">
            <div class="root-section-title">Required Tools</div>
            <div class="tools-grid">${toolsHTML}</div>
        </div>

        <div class="root-section">
            <div class="root-section-title">Risks & Warnings</div>
            <div class="risk-list">${risksHTML}</div>
        </div>

        <div class="root-section">
            <div class="root-section-title">Community Resources</div>
            <a class="tool-card" href="${xdaLink}" target="_blank" rel="noopener" style="display:block;margin-bottom:8px">
                <div class="tool-card-top">
                    <span class="tool-icon">💬</span>
                    <span class="tool-name">XDA Developers — ${escHtml(deviceName)}</span>
                </div>
                <div class="tool-desc">Find device-specific guides, ROMs, and community support</div>
            </a>
        </div>

        <div class="root-disclaimer">
            <span>⚠️</span>
            <span>${disclaimer}</span>
        </div>`;
}

function switchSpecTab(tab) {
    document.querySelectorAll('.spec-tab').forEach((t, i) => {
        const tabs = ['specs','root','display','camera','performance','battery'];
        t.classList.toggle('active', tabs[i] === tab);
    });
    document.querySelectorAll('.spec-panel').forEach(p => p.classList.remove('active'));
    document.getElementById('panel-' + tab)?.classList.add('active');
}

// ============================================
// BOOKMARKS
// ============================================
function toggleBookmark() {
    if (!currentDevice) return;
    const id = currentDevice.id;
    const exists = bookmarks.findIndex(b => b.id === id);
    if (exists >= 0) {
        bookmarks.splice(exists, 1);
        showToast('Removed from Saved');
    } else {
        bookmarks.unshift({
            id: currentDevice.id,
            name: currentDevice.name,
            thumbnail: currentDevice.thumbnail,
            description: currentDevice.flat?.announced || '',
        });
        showToast('✅ Saved!');
    }
    lsSet('bp_bookmarks', bookmarks);
    updateBookmarkBtn(id);
    updateBookmarkBadge();
}

function toggleBookmarkCard(id, btn) {
    const exists = bookmarks.findIndex(b => b.id === id);
    if (exists >= 0) {
        bookmarks.splice(exists, 1);
        btn.classList.remove('saved');
        btn.innerHTML = '<i class="fa-regular fa-bookmark"></i>';
        showToast('Removed from Saved');
    } else {
        // We only have basic info here; add minimal
        bookmarks.unshift({ id });
        btn.classList.add('saved');
        btn.innerHTML = '<i class="fa-solid fa-bookmark"></i>';
        showToast('✅ Saved!');
    }
    lsSet('bp_bookmarks', bookmarks);
    updateBookmarkBadge();
}

function updateBookmarkBtn(id) {
    const btn = document.getElementById('bookmarkBtn');
    if (!btn) return;
    const saved = bookmarks.some(b => b.id === id);
    btn.innerHTML = saved
        ? '<i class="fa-solid fa-bookmark"></i> Saved'
        : '<i class="fa-regular fa-bookmark"></i> Save';
}

function updateBookmarkBadge() {
    const badge = document.getElementById('bookmarkBadge');
    if (badge) badge.textContent = bookmarks.length;
}

function renderBookmarks() {
    const list = document.getElementById('bookmarksList');
    const count = document.getElementById('bookmarkCount');
    count.textContent = `${bookmarks.length} device${bookmarks.length !== 1 ? 's' : ''} saved`;

    if (!bookmarks.length) {
        list.innerHTML = `<div class="empty-state"><i class="fa-regular fa-bookmark"></i><p>No saved devices yet</p><button class="btn-primary" onclick="showView('search')">Search Devices</button></div>`;
        return;
    }

    list.innerHTML = `<div class="bookmark-grid">${bookmarks.map((b, i) => `
        <div class="bm-card" onclick="openDevice('${escHtml(b.id)}')">
            <img class="bm-img" src="${b.thumbnail || ''}" onerror="this.style.opacity=.2" alt="">
            <div class="bm-info">
                <div class="bm-name">${escHtml(b.name || b.id)}</div>
                <div class="bm-desc">${escHtml(b.description || '')}</div>
            </div>
            <button class="bm-remove" onclick="event.stopPropagation();removeBookmark(${i})">
                <i class="fa-solid fa-xmark"></i>
            </button>
        </div>`).join('')}
    </div>`;
}

function removeBookmark(i) {
    bookmarks.splice(i, 1);
    lsSet('bp_bookmarks', bookmarks);
    updateBookmarkBadge();
    renderBookmarks();
}

// ============================================
// COMPARE
// ============================================
function addToCompare() {
    if (!currentDevice) return;
    const d = { id: currentDevice.id, name: currentDevice.name, thumbnail: currentDevice.thumbnail, description: currentDevice.flat?.announced || '' };
    if (!compareA) {
        compareA = d;
        document.getElementById('slotAInput').value = d.name;
        fillSlot('A', d);
    } else if (!compareB) {
        compareB = d;
        document.getElementById('slotBInput').value = d.name;
        fillSlot('B', d);
    } else {
        compareA = d;
        fillSlot('A', d);
    }
    document.getElementById('compareBtn').disabled = !(compareA && compareB);
    showView('compare');
    showToast('✅ Added to compare!');
}

function initSlotSearch(slot) {
    const input = document.getElementById(`slot${slot}Input`);
    const sugBox = document.getElementById(`slot${slot}Suggest`);
    if (!input || !sugBox) return;
    let t;

    input.addEventListener('input', () => {
        clearTimeout(t);
        const q = input.value.trim();
        if (q.length < 2) { sugBox.classList.add('hidden'); return; }
        t = setTimeout(async () => {
            try {
                const data = await apiFetch(`/api/search?q=${encodeURIComponent(q)}`);
                if (!data.results?.length) { sugBox.classList.add('hidden'); return; }
                sugBox._items = data.results.slice(0, 5);
                sugBox.innerHTML = data.results.slice(0, 5).map((d, i) => `
                    <div class="sug-item" onclick="selectSlot('${slot}', ${i})">
                        <img class="sug-img" src="${escHtml(d.thumbnail || '')}" onerror="this.style.opacity=.2" alt="">
                        <div class="sug-info">
                            <div class="sug-name">${escHtml(d.name)}</div>
                            <div class="sug-desc">${escHtml(d.description || '')}</div>
                        </div>
                    </div>`).join('');

                // On mobile, use fixed positioning relative to input
                if (window.innerWidth <= 768) {
                    const rect = input.getBoundingClientRect();
                    sugBox.style.top = (rect.bottom + 6) + 'px';
                    sugBox.style.position = 'fixed';
                } else {
                    sugBox.style.position = 'absolute';
                    sugBox.style.top = '';
                }

                sugBox.classList.remove('hidden');
            } catch(e) {}
        }, 350);
    });

    // Close on outside click
    document.addEventListener('click', (e) => {
        if (!e.target.closest(`#slot${slot}`) && !e.target.closest(`#slot${slot}Suggest`)) {
            sugBox.classList.add('hidden');
        }
    });
}

function selectSlot(slot, index) {
    const sugBox = document.getElementById(`slot${slot}Suggest`);
    if (!sugBox?._items) return;
    const d = sugBox._items[index];
    sugBox.classList.add('hidden');
    fillSlot(slot, d);
    if (slot === 'A') compareA = d; else compareB = d;
    document.getElementById('compareBtn').disabled = !(compareA && compareB);
}

function fillSlot(slot, d) {
    document.getElementById(`slot${slot}Empty`).classList.add('hidden');
    const filled = document.getElementById(`slot${slot}Filled`);
    filled.classList.remove('hidden');
    document.getElementById(`slot${slot}Img`).src = d.thumbnail || '';
    document.getElementById(`slot${slot}Name`).textContent = d.name;
    document.getElementById(`slot${slot}Desc`).textContent = d.description || '';
}

function removeCompare(slot) {
    if (slot === 'A') compareA = null; else compareB = null;
    document.getElementById(`slot${slot}Empty`).classList.remove('hidden');
    document.getElementById(`slot${slot}Filled`).classList.add('hidden');
    document.getElementById(`slot${slot}Input`).value = '';
    document.getElementById('compareBtn').disabled = true;
    document.getElementById('compareResults').classList.add('hidden');
}

async function runCompare() {
    if (!compareA || !compareB) return;
    document.getElementById('compareSkeleton').classList.remove('hidden');
    document.getElementById('compareResults').classList.add('hidden');

    try {
        const data = await apiFetch(`/api/compare?id1=${encodeURIComponent(compareA.id)}&id2=${encodeURIComponent(compareB.id)}`);
        document.getElementById('compareSkeleton').classList.add('hidden');
        renderCompareTable(data.a, data.b);
    } catch(err) {
        document.getElementById('compareSkeleton').classList.add('hidden');
        showToast('❌ Compare failed: ' + err.message);
    }
}

// ============================================
// SCORING ENGINE
// ============================================
function scoreDevices(a, b) {
    const fa = a.flat || {}, fb = b.flat || {};
    const sfA = a.specialFeatures || [], sfB = b.specialFeatures || [];

    // Helper: extract first number from string
    const num = (str) => parseFloat((str || '').replace(/,/g,'').match(/[\d.]+/)?.[0] || '0');

    // Helper: extract Hz
    const hz = (str) => {
        const m = (str || '').match(/(\d+)\s*Hz/i);
        return m ? parseInt(m[1]) : 0;
    };

    // Helper: extract MP
    const mp = (str) => {
        const m = (str || '').match(/(\d+)\s*MP/i);
        return m ? parseInt(m[1]) : 0;
    };

    // Helper: extract charging watts
    const watts = (str) => {
        const m = (str || '').match(/(\d+)\s*W/i);
        return m ? parseInt(m[1]) : 0;
    };

    // Helper: extract mAh
    const mah = (str) => {
        const m = (str || '').match(/(\d{3,5})\s*mAh/i);
        return m ? parseInt(m[1]) : 0;
    };

    // Helper: check keyword
    const hasKw = (str, ...kws) => kws.some(k => (str || '').toLowerCase().includes(k.toLowerCase()));

    // ── CATEGORY SCORES ──────────────────────────────────────
    // Each returns { scoreA: 0-100, scoreB: 0-100, breakdown: [] }

    function scoreDisplay() {
        let sA = 50, sB = 50;
        const notes = [];

        // Refresh rate (weight: 25)
        const hzA = hz(fa.displayType), hzB = hz(fb.displayType);
        if (hzA > hzB)      { sA += 15; notes.push(`${hzA}Hz vs ${hzB}Hz`); }
        else if (hzB > hzA) { sB += 15; notes.push(`${hzB}Hz vs ${hzA}Hz`); }

        // LTPO bonus
        if (hasKw(fa.displayType,'ltpo') && !hasKw(fb.displayType,'ltpo')) { sA += 10; }
        if (hasKw(fb.displayType,'ltpo') && !hasKw(fa.displayType,'ltpo')) { sB += 10; }

        // AMOLED bonus
        if (hasKw(fa.displayType,'amoled','oled') && !hasKw(fb.displayType,'amoled','oled')) { sA += 8; }
        if (hasKw(fb.displayType,'amoled','oled') && !hasKw(fa.displayType,'amoled','oled')) { sB += 8; }

        // HDR
        if (hasKw(fa.displayType,'hdr10+','dolby vision') && !hasKw(fb.displayType,'hdr10+','dolby vision')) { sA += 7; }
        if (hasKw(fb.displayType,'hdr10+','dolby vision') && !hasKw(fa.displayType,'hdr10+','dolby vision')) { sB += 7; }

        // Protection
        const protScore = (p) => {
            if (hasKw(p,'victus 2')) return 4;
            if (hasKw(p,'victus')) return 3;
            if (hasKw(p,'gorilla glass 7','gorilla glass 6','ceramic shield')) return 3;
            if (hasKw(p,'gorilla glass 5')) return 2;
            if (hasKw(p,'gorilla glass')) return 1;
            return 0;
        };
        const pA = protScore(fa.displayProt), pB = protScore(fb.displayProt);
        if (pA > pB) sA += 5; else if (pB > pA) sB += 5;

        return { scoreA: Math.min(100, sA), scoreB: Math.min(100, sB), notes };
    }

    function scorePerformance() {
        let sA = 50, sB = 50;
        const notes = [];

        // Chipset scoring table
        const chipRank = (c = '') => {
            c = c.toLowerCase();
            if (c.includes('snapdragon 8 elite')) return 100;
            if (c.includes('snapdragon 8 gen 3')) return 97;
            if (c.includes('a18')) return 96;
            if (c.includes('a17')) return 94;
            if (c.includes('snapdragon 8 gen 2')) return 93;
            if (c.includes('dimensity 9300')) return 92;
            if (c.includes('dimensity 9200')) return 89;
            if (c.includes('a16')) return 88;
            if (c.includes('snapdragon 8 gen 1')) return 87;
            if (c.includes('tensor g4')) return 85;
            if (c.includes('tensor g3')) return 83;
            if (c.includes('dimensity 9000')) return 82;
            if (c.includes('snapdragon 7')) return 75;
            if (c.includes('a15')) return 86;
            if (c.includes('dimensity 8300')) return 72;
            if (c.includes('dimensity 8200')) return 70;
            if (c.includes('snapdragon 6')) return 60;
            if (c.includes('helio g99')) return 58;
            if (c.includes('helio g96')) return 54;
            if (c.includes('snapdragon 4')) return 45;
            if (c.includes('dimensity 7')) return 65;
            if (c.includes('helio')) return 45;
            if (c.includes('unisoc')) return 35;
            return 50;
        };

        const rA = chipRank(fa.chipset), rB = chipRank(fb.chipset);
        const diff = Math.abs(rA - rB);
        if (rA > rB) { sA += Math.min(30, diff * 0.4); notes.push(`${fa.chipset?.split(' ').slice(0,4).join(' ')} wins`); }
        else if (rB > rA) { sB += Math.min(30, diff * 0.4); notes.push(`${fb.chipset?.split(' ').slice(0,4).join(' ')} wins`); }

        // UFS storage speed
        if (hasKw(fa.storage,'ufs 4') && !hasKw(fb.storage,'ufs 4')) { sA += 8; }
        if (hasKw(fb.storage,'ufs 4') && !hasKw(fa.storage,'ufs 4')) { sB += 8; }
        else if (hasKw(fa.storage,'ufs 3') && !hasKw(fb.storage,'ufs 4','ufs 3')) { sA += 4; }
        else if (hasKw(fb.storage,'ufs 3') && !hasKw(fa.storage,'ufs 4','ufs 3')) { sB += 4; }

        // RAM
        const ramA = num(fa.storage?.match(/(\d+)GB RAM/i)?.[0]), ramB = num(fb.storage?.match(/(\d+)GB RAM/i)?.[0]);
        if (ramA > ramB) sA += 5; else if (ramB > ramA) sB += 5;

        return { scoreA: Math.min(100, sA), scoreB: Math.min(100, sB), notes };
    }

    function scoreCamera() {
        let sA = 50, sB = 50;
        const notes = [];

        // Main camera MP
        const mpA = mp(fa.mainCamera), mpB = mp(fb.mainCamera);
        if (mpA >= 200 && mpB < 200) sA += 12;
        else if (mpB >= 200 && mpA < 200) sB += 12;
        else if (mpA >= 100 && mpB < 100) sA += 8;
        else if (mpB >= 100 && mpA < 100) sB += 8;
        else if (mpA > mpB + 10) sA += 5;
        else if (mpB > mpA + 10) sB += 5;
        if (mpA || mpB) notes.push(`${mpA || '?'}MP vs ${mpB || '?'}MP`);

        // Periscope
        if (hasKw(fa.mainCamera,'periscope') && !hasKw(fb.mainCamera,'periscope')) { sA += 15; notes.push('Periscope zoom: A only'); }
        if (hasKw(fb.mainCamera,'periscope') && !hasKw(fa.mainCamera,'periscope')) { sB += 15; notes.push('Periscope zoom: B only'); }

        // OIS
        if (hasKw(fa.mainFeatures,'ois') && !hasKw(fb.mainFeatures,'ois')) sA += 8;
        if (hasKw(fb.mainFeatures,'ois') && !hasKw(fa.mainFeatures,'ois')) sB += 8;

        // 8K video
        if (hasKw(fa.mainVideo,'8k') && !hasKw(fb.mainVideo,'8k')) { sA += 10; }
        if (hasKw(fb.mainVideo,'8k') && !hasKw(fa.mainVideo,'8k')) { sB += 10; }

        // 4K 60fps vs 4K 30fps
        if (hasKw(fa.mainVideo,'4k') && !hasKw(fb.mainVideo,'4k')) sA += 5;
        if (hasKw(fb.mainVideo,'4k') && !hasKw(fa.mainVideo,'4k')) sB += 5;

        // Special features camera count
        const camSfA = sfA.filter(f => f.category === 'Camera').length;
        const camSfB = sfB.filter(f => f.category === 'Camera').length;
        if (camSfA > camSfB) sA += 5; else if (camSfB > camSfA) sB += 5;

        return { scoreA: Math.min(100, sA), scoreB: Math.min(100, sB), notes };
    }

    function scoreBattery() {
        let sA = 50, sB = 50;
        const notes = [];

        // Battery size
        const mahA = mah(fa.batteryType), mahB = mah(fb.batteryType);
        if (mahA > mahB + 200) { sA += Math.min(20, (mahA - mahB) / 100); notes.push(`${mahA}mAh vs ${mahB}mAh`); }
        else if (mahB > mahA + 200) { sB += Math.min(20, (mahB - mahA) / 100); }

        // Charging speed
        const wA = watts(fa.charging), wB = watts(fb.charging);
        if (wA > wB + 5) { sA += Math.min(25, (wA - wB) / 5); notes.push(`${wA}W vs ${wB}W`); }
        else if (wB > wA + 5) { sB += Math.min(25, (wB - wA) / 5); }

        // Wireless charging
        if (hasKw(fa.charging,'wireless') && !hasKw(fb.charging,'wireless')) { sA += 8; }
        if (hasKw(fb.charging,'wireless') && !hasKw(fa.charging,'wireless')) { sB += 8; }

        // Reverse wireless
        if (hasKw(fa.charging,'reverse') && !hasKw(fb.charging,'reverse')) sA += 5;
        if (hasKw(fb.charging,'reverse') && !hasKw(fa.charging,'reverse')) sB += 5;

        return { scoreA: Math.min(100, sA), scoreB: Math.min(100, sB), notes };
    }

    function scoreConnectivity() {
        let sA = 50, sB = 50;

        // WiFi 7 > 6E > 6
        const wifiScore = (w = '') => {
            if (w.includes('wi-fi 7') || w.includes('802.11be')) return 3;
            if (w.includes('6e')) return 2;
            if (w.includes('wi-fi 6') || w.includes('802.11ax')) return 1;
            return 0;
        };
        const wA = wifiScore(fa.wlan?.toLowerCase()), wB = wifiScore(fb.wlan?.toLowerCase());
        if (wA > wB) sA += 12; else if (wB > wA) sB += 12;

        // UWB
        if (hasKw(fa.sensors,'ultra-wideband','uwb') && !hasKw(fb.sensors,'ultra-wideband','uwb')) sA += 8;
        if (hasKw(fb.sensors,'ultra-wideband','uwb') && !hasKw(fa.sensors,'ultra-wideband','uwb')) sB += 8;

        // 5G
        if (hasKw(fa.network,'5g') && !hasKw(fb.network,'5g')) sA += 10;
        if (hasKw(fb.network,'5g') && !hasKw(fa.network,'5g')) sB += 10;

        // USB 3 / Thunderbolt
        if (hasKw(fa.usb,'3.','thunderbolt','usb4') && !hasKw(fb.usb,'3.','thunderbolt','usb4')) sA += 8;
        if (hasKw(fb.usb,'3.','thunderbolt','usb4') && !hasKw(fa.usb,'3.','thunderbolt','usb4')) sB += 8;

        // Bluetooth version
        const btVer = (s = '') => parseFloat(s.match(/[\d.]+/)?.[0] || '0');
        const btA = btVer(fa.bluetooth), btB = btVer(fb.bluetooth);
        if (btA > btB) sA += 5; else if (btB > btA) sB += 5;

        return { scoreA: Math.min(100, sA), scoreB: Math.min(100, sB), notes: [] };
    }

    function scoreFeatures() {
        let sA = 50, sB = 50;

        // IP rating
        const ipScore = (specs) => {
            const t = JSON.stringify(specs).toLowerCase();
            if (t.includes('ip68')) return 3;
            if (t.includes('ip67')) return 2;
            if (t.includes('ip65')) return 1;
            return 0;
        };
        const ipA = ipScore(a), ipB = ipScore(b);
        if (ipA > ipB) sA += 12; else if (ipB > ipA) sB += 12;

        // Under-display fingerprint
        if (hasKw(JSON.stringify(a).toLowerCase(),'under-display','in-display') && !hasKw(JSON.stringify(b).toLowerCase(),'under-display','in-display')) sA += 8;
        if (hasKw(JSON.stringify(b).toLowerCase(),'under-display','in-display') && !hasKw(JSON.stringify(a).toLowerCase(),'under-display','in-display')) sB += 8;

        // Stylus
        if (hasKw(JSON.stringify(a),'s pen','stylus') && !hasKw(JSON.stringify(b),'s pen','stylus')) sA += 10;
        if (hasKw(JSON.stringify(b),'s pen','stylus') && !hasKw(JSON.stringify(a),'s pen','stylus')) sB += 10;

        // IR blaster
        if (hasKw(fa.sensors,'infrared') && !hasKw(fb.sensors,'infrared')) sA += 5;
        if (hasKw(fb.sensors,'infrared') && !hasKw(fa.sensors,'infrared')) sB += 5;

        // Special features count bonus
        const sfCountA = sfA.length, sfCountB = sfB.length;
        const sfDiff = Math.abs(sfCountA - sfCountB);
        if (sfCountA > sfCountB) sA += Math.min(10, sfDiff * 1.5);
        else if (sfCountB > sfCountA) sB += Math.min(10, sfDiff * 1.5);

        return { scoreA: Math.min(100, sA), scoreB: Math.min(100, sB), notes: [] };
    }

    // Run all categories
    const categories = [
        { key: 'display',      label: '📺 Display',      ...scoreDisplay()      },
        { key: 'performance',  label: '⚡ Performance',   ...scorePerformance()  },
        { key: 'camera',       label: '📷 Camera',        ...scoreCamera()       },
        { key: 'battery',      label: '🔋 Battery',       ...scoreBattery()      },
        { key: 'connectivity', label: '📡 Connectivity',  ...scoreConnectivity() },
        { key: 'features',     label: '✨ Features',      ...scoreFeatures()     },
    ];

    // Weighted overall score
    const weights = { display: 0.20, performance: 0.25, camera: 0.25, battery: 0.15, connectivity: 0.10, features: 0.05 };
    let overallA = 0, overallB = 0;
    categories.forEach(c => {
        overallA += c.scoreA * (weights[c.key] || 0.1);
        overallB += c.scoreB * (weights[c.key] || 0.1);
    });

    // Normalize to percentage (keep relative gap)
    const maxScore = Math.max(overallA, overallB, 1);
    const normA = Math.round((overallA / maxScore) * 100);
    const normB = Math.round((overallB / maxScore) * 100);
    // Make sure lower score is relative — floor at 60 for realistic display
    const floorScore = (s, max) => Math.max(60, Math.round(60 + (s / max) * 40));
    const finalA = floorScore(overallA, maxScore);
    const finalB = floorScore(overallB, maxScore);

    return { categories, overallA: finalA, overallB: finalB };
}

function renderCompareTable(a, b) {
    const fa = a.flat || {}, fb = b.flat || {};

    // ── COMPUTE SCORES ──────────────────────────────────────
    const { categories, overallA, overallB } = scoreDevices(a, b);
    const aWins = overallA >= overallB;

    const sections = [
        { title: '📋 General', rows: [
            ['Announced', fa.announced, fb.announced],
            ['Status',    fa.status,    fb.status],
            ['OS',        fa.os,        fb.os],
        ]},
        { title: '📐 Body', rows: [
            ['Dimensions', fa.dimensions, fb.dimensions],
            ['Weight',     fa.weight,     fb.weight],
            ['Build',      fa.build,      fb.build],
            ['SIM',        fa.sim,        fb.sim],
            ['Colors',     fa.colors,     fb.colors],
        ]},
        { title: '📺 Display', rows: [
            ['Type',       fa.displayType, fb.displayType],
            ['Size',       fa.displaySize, fb.displaySize],
            ['Resolution', fa.displayRes,  fb.displayRes],
            ['Protection', fa.displayProt, fb.displayProt],
        ]},
        { title: '⚡ Performance', rows: [
            ['Chipset', fa.chipset, fb.chipset],
            ['CPU',     fa.cpu,     fb.cpu],
            ['GPU',     fa.gpu,     fb.gpu],
            ['Storage', fa.storage, fb.storage],
        ]},
        { title: '📷 Camera', rows: [
            ['Main',   fa.mainCamera,   fb.mainCamera],
            ['Selfie', fa.selfieCamera, fb.selfieCamera],
            ['Video',  fa.mainVideo,    fb.mainVideo],
        ]},
        { title: '🔋 Battery', rows: [
            ['Battery',  fa.batteryType, fb.batteryType],
            ['Charging', fa.charging,    fb.charging],
            ['NFC',      fa.nfc,         fb.nfc],
            ['USB',      fa.usb,         fb.usb],
        ]},
        { title: '🔓 Root', rows: [
            ['Root Status',  a.rootInfo?.rootLabel,                          b.rootInfo?.rootLabel],
            ['Brand Policy', a.rootInfo?.policy?.note?.slice(0,80)+'…',      b.rootInfo?.policy?.note?.slice(0,80)+'…'],
        ]},
    ];

    // ── SCORE BARS (per category) ────────────────────────────
    const catBarsHTML = categories.map(c => {
        const aWinscat = c.scoreA >= c.scoreB;
        const barA = c.scoreA, barB = c.scoreB;
        return `
        <div class="ct-catbar-row">
            <div class="ct-catbar-label">${c.label}</div>
            <div class="ct-catbar-wrap">
                <div class="ct-catbar-a ${aWinscat ? 'win' : ''}" style="width:${barA}%">
                    <span>${barA}</span>
                </div>
                <div class="ct-catbar-b ${!aWinscat ? 'win' : ''}" style="width:${barB}%">
                    <span>${barB}</span>
                </div>
            </div>
        </div>`;
    }).join('');

    let html = `
    <div class="compare-score-header">
        <div class="cs-device ${aWins ? 'winner' : ''}">
            <div class="cs-name">${escHtml(a.name)}</div>
            <div class="cs-score-wrap">
                <div class="cs-score-ring ${aWins ? 'winner' : ''}">
                    <svg viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
                        <circle cx="40" cy="40" r="32" fill="none"
                            stroke="${aWins ? '#22c55e' : '#3b82f6'}"
                            stroke-width="6"
                            stroke-dasharray="${2 * Math.PI * 32}"
                            stroke-dashoffset="${2 * Math.PI * 32 * (1 - overallA / 100)}"
                            stroke-linecap="round"
                            transform="rotate(-90 40 40)"/>
                    </svg>
                    <div class="cs-score-num">${overallA}</div>
                </div>
            </div>
            ${aWins ? '<div class="cs-winner-badge">🏆 Winner</div>' : ''}
        </div>

        <div class="cs-vs">VS</div>

        <div class="cs-device ${!aWins ? 'winner' : ''}">
            <div class="cs-name">${escHtml(b.name)}</div>
            <div class="cs-score-wrap">
                <div class="cs-score-ring ${!aWins ? 'winner' : ''}">
                    <svg viewBox="0 0 80 80">
                        <circle cx="40" cy="40" r="32" fill="none" stroke="rgba(255,255,255,0.06)" stroke-width="6"/>
                        <circle cx="40" cy="40" r="32" fill="none"
                            stroke="${!aWins ? '#22c55e' : '#3b82f6'}"
                            stroke-width="6"
                            stroke-dasharray="${2 * Math.PI * 32}"
                            stroke-dashoffset="${2 * Math.PI * 32 * (1 - overallB / 100)}"
                            stroke-linecap="round"
                            transform="rotate(-90 40 40)"/>
                    </svg>
                    <div class="cs-score-num">${overallB}</div>
                </div>
            </div>
            ${!aWins ? '<div class="cs-winner-badge">🏆 Winner</div>' : ''}
        </div>
    </div>

    <div class="ct-catbars">
        <div class="ct-catbar-legend">
            <div class="ct-catbar-leg-a">▌ ${escHtml(a.name.split(' ').slice(0,3).join(' '))}</div>
            <div class="ct-catbar-leg-b">▌ ${escHtml(b.name.split(' ').slice(0,3).join(' '))}</div>
        </div>
        ${catBarsHTML}
    </div>

    <div class="compare-table-wrap">
        <div class="ct-header">
            <div class="ct-label">Specification</div>
            <div class="ct-device">
                <div class="ct-dname">${escHtml(a.name)}</div>
                <div class="ct-dscore ${aWins ? 'win' : ''}">${overallA}/100</div>
            </div>
            <div class="ct-device">
                <div class="ct-dname">${escHtml(b.name)}</div>
                <div class="ct-dscore ${!aWins ? 'win' : ''}">${overallB}/100</div>
            </div>
        </div>`;

    sections.forEach(sec => {
        const validRows = sec.rows.filter(([, v1, v2]) => v1 || v2);
        if (!validRows.length) return;
        html += `<div class="ct-section">${sec.title}</div>`;
        validRows.forEach(([key, v1, v2]) => {
            html += `
            <div class="ct-row">
                <div class="ct-key">${escHtml(key)}</div>
                <div class="ct-val">${escHtml(v1 || '—')}</div>
                <div class="ct-val">${escHtml(v2 || '—')}</div>
            </div>`;
        });
    });

    html += '</div>';
    document.getElementById('compareTable').innerHTML = html;
    document.getElementById('compareResults').classList.remove('hidden');
    // Animate score rings
    setTimeout(() => document.querySelectorAll('.cs-score-ring circle:last-child').forEach(c => c.style.transition = 'stroke-dashoffset 1s ease'), 50);
}

// ============================================
// UTILS
// ============================================
async function apiFetch(url) {
    const res = await fetch(url);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'API error');
    return data;
}

function lsGet(key, fallback = '[]') {
    try { return JSON.parse(localStorage.getItem(key) || fallback); }
    catch(e) { return JSON.parse(fallback); }
}

function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch(e) {}
}

function escHtml(str) {
    return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

let toastTimer;
function showToast(msg) {
    const el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.classList.remove('hidden');
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
}

function initReveal() {
    const obs = new IntersectionObserver(entries => {
        entries.forEach(e => { if(e.isIntersecting){ e.target.classList.add('visible'); obs.unobserve(e.target); }});
    }, { threshold: .1 });
    document.querySelectorAll('.reveal').forEach(el => obs.observe(el));
}

// ============================================================
// SPECIAL FEATURES RENDERER
// ============================================================
function renderSpecialFeatures(features, deviceName) {
    const container = document.getElementById('specialFeaturesSection');
    if (!container) return;

    if (!features || !features.length) {
        container.innerHTML = `
            <div class="sf-wrap">
                <div class="sf-header">
                    <div class="sf-title">✨ Special Features</div>
                </div>
                <div class="sf-empty">No special features detected for this device.</div>
            </div>`;
        return;
    }

    const tierLabel = { flagship: '🏆 Flagship', premium: '⭐ Premium', standard: '✓ Standard' };

    // Group by category for organized display
    const grouped = {};
    features.forEach(f => {
        if (!grouped[f.category]) grouped[f.category] = [];
        grouped[f.category].push(f);
    });

    const catOrder = ['Display','Camera','Performance','Battery','Connectivity','Security','AI','Audio','Features','Build'];
    const catIcons = {
        Display:'🖥️', Camera:'📷', Performance:'⚡', Battery:'🔋',
        Connectivity:'📡', Security:'🔒', AI:'🤖', Audio:'🎵',
        Features:'✨', Build:'⚙️',
    };

    // Stats line
    const flagshipCount = features.filter(f => f.tier === 'flagship').length;
    const premiumCount  = features.filter(f => f.tier === 'premium').length;

    let html = `
    <div class="sf-wrap">
        <div class="sf-header">
            <div class="sf-title">✨ Special Features</div>
            <div class="sf-count">${features.length} features</div>
            ${flagshipCount ? `<div class="sf-tier-badge flagship">🏆 ${flagshipCount} Flagship</div>` : ''}
            ${premiumCount  ? `<div class="sf-tier-badge premium">⭐ ${premiumCount} Premium</div>`  : ''}
        </div>`;

    // Render by category in logical order
    const orderedCats = [
        ...catOrder.filter(c => grouped[c]),
        ...Object.keys(grouped).filter(c => !catOrder.includes(c))
    ];

    orderedCats.forEach(cat => {
        const catFeatures = grouped[cat];
        if (!catFeatures?.length) return;
        html += `
        <div style="margin-bottom:20px">
            <div style="font-family:var(--fm);font-size:.65rem;color:var(--blue2);text-transform:uppercase;letter-spacing:.12em;margin-bottom:10px">
                ${catIcons[cat] || '◆'} ${cat}
            </div>
            <div class="sf-grid">`;

        catFeatures.forEach(f => {
            html += `
            <div class="sf-card ${f.tier}">
                <div class="sf-card-top">
                    <span class="sf-icon">${f.icon}</span>
                    <div class="sf-card-right">
                        <div class="sf-card-title">${escHtml(f.title)}</div>
                        <span class="sf-tier-badge ${f.tier}">${tierLabel[f.tier]}</span>
                    </div>
                </div>
                <div class="sf-desc">${escHtml(f.description)}</div>
            </div>`;
        });

        html += `</div></div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
}
