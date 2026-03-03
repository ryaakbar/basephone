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

function renderCompareTable(a, b) {
    const fa = a.flat || {}, fb = b.flat || {};

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
            ['Root Status', a.rootInfo?.rootLabel, b.rootInfo?.rootLabel],
            ['Brand Policy', a.rootInfo?.policy?.note?.slice(0,80)+'…', b.rootInfo?.policy?.note?.slice(0,80)+'…'],
        ]},
    ];

    let html = `
    <div class="compare-table-wrap">
        <div class="ct-header">
            <div class="ct-label">Specification</div>
            <div class="ct-device"><div class="ct-dname">${escHtml(a.name)}</div></div>
            <div class="ct-device"><div class="ct-dname">${escHtml(b.name)}</div></div>
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
