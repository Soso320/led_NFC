/* ═══════════════════════════════════════════════════════════════════════
   app.js — application entry point
   ═══════════════════════════════════════════════════════════════════════ */

import { N, TAU, getEffectById, EFFECTS, CATEGORIES, hsv2rgb } from './effects.js';
import { LED_POS, makeOffscreen, renderPanel, drawToVisible } from './panel.js';
import * as NFC from './nfc.js';

/* ═══════════════════════════════════════════════════════════════════════
   State
   ═══════════════════════════════════════════════════════════════════════ */
const STORE_KEY = 'lightControl';

const state = {
    selection: { type: 'effect', id: 'aurora' },
    brightness: 80,
    theme: 'dark',
    hsv: { h: 20, s: 1, v: 1 },
};

function loadState() {
    try {
        const raw = localStorage.getItem(STORE_KEY);
        if (!raw) return;
        const s = JSON.parse(raw);
        if (s.selection) state.selection = s.selection;
        if (typeof s.brightness === 'number') state.brightness = s.brightness;
        if (s.theme) state.theme = s.theme;
        if (s.hsv) state.hsv = s.hsv;
    } catch (e) { /* ignore */ }
}

function saveState() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) {}
}

/* ═══════════════════════════════════════════════════════════════════════
   Color helpers
   ═══════════════════════════════════════════════════════════════════════ */
function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(v => Math.max(0, Math.min(255, v|0))
                                     .toString(16).padStart(2, '0')).join('').toUpperCase();
}
function hexToRgb(hex) {
    return {
        r: parseInt(hex.slice(1, 3), 16),
        g: parseInt(hex.slice(3, 5), 16),
        b: parseInt(hex.slice(5, 7), 16),
    };
}
function rgbToHsv(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d !== 0) {
        if (max === r)      h = ((g - b) / d + 6) % 6;
        else if (max === g) h = (b - r) / d + 2;
        else                h = (r - g) / d + 4;
        h *= 60;
    }
    return { h, s: max === 0 ? 0 : d / max, v: max };
}

function currentHex() {
    const { h, s, v } = state.hsv;
    const [r, g, b] = hsv2rgb(h, (s * 255) | 0, (v * 255) | 0);
    return rgbToHex(r, g, b);
}

/* ═══════════════════════════════════════════════════════════════════════
   DOM handles
   ═══════════════════════════════════════════════════════════════════════ */
const el = {
    themeBtn:     document.getElementById('themeBtn'),
    themeIcon:    document.getElementById('themeIcon'),
    nfcBadge:     document.getElementById('nfcBadge'),
    nfcText:      document.getElementById('nfcText'),
    brightness:   document.getElementById('brightness'),
    brightnessVal:document.getElementById('brightnessVal'),
    catBar:       document.getElementById('catBar'),
    effectList:   document.getElementById('effectList'),
    colorCard:    document.getElementById('colorCard'),
    colorSwatch:  document.getElementById('colorSwatch'),
    colorHex:     document.getElementById('colorHex'),
    hueSlider:    document.getElementById('hueSlider'),
    svCanvas:     document.getElementById('svCanvas'),
    sendBtn:      document.getElementById('sendBtn'),
    syncModal:    document.getElementById('syncModal'),
    syncTitle:    document.getElementById('syncTitle'),
    syncMsg:      document.getElementById('syncMsg'),
    syncCancel:   document.getElementById('syncCancel'),
    toastContainer: document.getElementById('toast-container'),
};

const svCtx = el.svCanvas.getContext('2d');

/* ═══════════════════════════════════════════════════════════════════════
   Toast
   ═══════════════════════════════════════════════════════════════════════ */
function toast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    el.toastContainer.appendChild(t);
    setTimeout(() => t.remove(), 2500);
}

/* ═══════════════════════════════════════════════════════════════════════
   Panel previews
   ═══════════════════════════════════════════════════════════════════════ */
const previews = new Map();

function buildPreview(effect) {
    const row = document.createElement('div');
    row.className = 'list-item';
    row.dataset.id = effect.id;

    const thumb = document.createElement('div');
    thumb.className = 'thumb';
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 120;
    thumb.appendChild(canvas);

    const meta = document.createElement('div');
    meta.className = 'meta';
    meta.innerHTML =
        `<div class="meta-name">${effect.name}</div>` +
        `<div class="meta-desc">${effect.desc}</div>`;

    const check = document.createElement('div');
    check.className = 'check';
    check.textContent = '✓';

    row.appendChild(thumb);
    row.appendChild(meta);
    row.appendChild(check);

    const visCtx = canvas.getContext('2d', { alpha: false });
    const off = makeOffscreen();
    const buf = new Uint8Array(N * 3);

    const p = {
        row, visCtx, off, buf,
        fn: effect.fn, elapsed: 0, visible: false,
        lastFrame: performance.now(), visSize: 120,
    };

    row.addEventListener('click', () => selectEffect(effect.id));

    p.io = new IntersectionObserver(entries => {
        for (const e of entries) p.visible = e.isIntersecting;
    }, { rootMargin: '100px' });
    p.io.observe(row);

    return p;
}

function animationLoop(now) {
    const brightness = state.brightness / 100;

    for (const p of previews.values()) {
        if (!p.visible) continue;
        p.elapsed += now - p.lastFrame;
        p.lastFrame = now;
        p.fn(p.elapsed, p.buf);
        renderPanel(p.buf, p.off.img, brightness);
        drawToVisible(p.visCtx, p.off, p.visSize);
    }
    requestAnimationFrame(animationLoop);
}

/* ═══════════════════════════════════════════════════════════════════════
   Selection
   ═══════════════════════════════════════════════════════════════════════ */
function updateSelectionVisuals() {
    for (const [id, p] of previews.entries()) {
        const isSel = state.selection.type === 'effect' && state.selection.id === id;
        p.row.classList.toggle('selected', isSel);
    }
    el.colorCard.classList.toggle('selected', state.selection.type === 'color');
}

function selectEffect(id) {
    state.selection = { type: 'effect', id };
    saveState();
    updateSelectionVisuals();
}

function selectColor() {
    state.selection = { type: 'color', hex: currentHex() };
    saveState();
    updateSelectionVisuals();
}

/* ═══════════════════════════════════════════════════════════════════════
   Color picker
   ═══════════════════════════════════════════════════════════════════════ */
function drawSvSquare() {
    const W = el.svCanvas.width;
    const H = el.svCanvas.height;

    const [r, g, b] = hsv2rgb(state.hsv.h, 255, 255);
    svCtx.fillStyle = `rgb(${r},${g},${b})`;
    svCtx.fillRect(0, 0, W, H);

    let grad = svCtx.createLinearGradient(0, 0, W, 0);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    svCtx.fillStyle = grad;
    svCtx.fillRect(0, 0, W, H);

    grad = svCtx.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,1)');
    svCtx.fillStyle = grad;
    svCtx.fillRect(0, 0, W, H);

    const mx = state.hsv.s * W;
    const my = (1 - state.hsv.v) * H;
    const rad = Math.max(6, W * 0.025);

    svCtx.beginPath();
    svCtx.arc(mx, my, rad, 0, TAU);
    svCtx.strokeStyle = 'rgba(0,0,0,0.75)';
    svCtx.lineWidth = 3;
    svCtx.stroke();
    svCtx.beginPath();
    svCtx.arc(mx, my, rad, 0, TAU);
    svCtx.strokeStyle = '#fff';
    svCtx.lineWidth = 1.5;
    svCtx.stroke();
}

function syncColorUI() {
    const hex = currentHex();
    el.colorSwatch.style.backgroundColor = hex;
    el.colorHex.textContent = hex;
    el.hueSlider.value = state.hsv.h;
}

function pickSvAt(clientX, clientY) {
    const rect = el.svCanvas.getBoundingClientRect();
    let x = (clientX - rect.left) / rect.width;
    let y = (clientY - rect.top) / rect.height;
    x = Math.max(0, Math.min(1, x));
    y = Math.max(0, Math.min(1, y));
    state.hsv.s = x;
    state.hsv.v = 1 - y;
    drawSvSquare();
    syncColorUI();
    selectColor();
}

/* ═══════════════════════════════════════════════════════════════════════
   Theme
   ═══════════════════════════════════════════════════════════════════════ */
function applyTheme() {
    document.documentElement.dataset.theme = state.theme;
    el.themeIcon.innerHTML = state.theme === 'dark'
        ? '<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>'
        : '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/>';
}

/* ═══════════════════════════════════════════════════════════════════════
   Category filter
   ═══════════════════════════════════════════════════════════════════════ */
let activeCat = 'all';

function buildCategoryBar() {
    el.catBar.innerHTML = '';
    for (const c of CATEGORIES) {
        const btn = document.createElement('button');
        btn.className = 'cat-pill' + (c.id === activeCat ? ' active' : '');
        btn.textContent = c.label;
        btn.dataset.cat = c.id;
        btn.addEventListener('click', () => {
            activeCat = c.id;
            el.catBar.querySelectorAll('.cat-pill').forEach(b =>
                b.classList.toggle('active', b.dataset.cat === c.id));
            applyFilter();
        });
        el.catBar.appendChild(btn);
    }
}

function applyFilter() {
    for (const [id, p] of previews.entries()) {
        const eff = getEffectById(id);
        p.row.style.display = (activeCat === 'all' || eff.cat === activeCat) ? '' : 'none';
    }
}

function buildList() {
    el.effectList.innerHTML = '';
    previews.clear();
    for (const eff of EFFECTS) {
        const p = buildPreview(eff);
        previews.set(eff.id, p);
        el.effectList.appendChild(p.row);
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   Send payload
   ═══════════════════════════════════════════════════════════════════════ */
function buildPayload() {
    const base = { cmd: 'cfg', br: state.brightness, t: Date.now() };
    if (state.selection.type === 'effect') {
        return { ...base, sel: state.selection.id };
    } else {
        const { r, g, b } = hexToRgb(state.selection.hex);
        return { ...base, sel: 'custom', r, g, b };
    }
}

/* ═══════════════════════════════════════════════════════════════════════
   Modal
   ═══════════════════════════════════════════════════════════════════════ */
let nfcAbort = null;

function openSyncModal(title, msg) {
    el.syncTitle.textContent = title;
    el.syncMsg.textContent = msg;
    el.syncModal.classList.add('open');
}
function closeSyncModal() {
    el.syncModal.classList.remove('open');
    if (nfcAbort) { try { nfcAbort.abort(); } catch (_) {} nfcAbort = null; }
}

/* ═══════════════════════════════════════════════════════════════════════
   Boot
   ═══════════════════════════════════════════════════════════════════════ */
function wireEvents() {
    el.themeBtn.addEventListener('click', () => {
        state.theme = state.theme === 'dark' ? 'light' : 'dark';
        applyTheme();
        saveState();
    });

    el.brightness.addEventListener('input', () => {
        state.brightness = parseInt(el.brightness.value, 10);
        el.brightnessVal.textContent = state.brightness + '%';
        saveState();
    });

    el.hueSlider.addEventListener('input', () => {
        state.hsv.h = parseInt(el.hueSlider.value, 10);
        drawSvSquare();
        syncColorUI();
        selectColor();
    });

    let svDragging = false;
    el.svCanvas.addEventListener('pointerdown', e => {
        svDragging = true;
        el.svCanvas.setPointerCapture(e.pointerId);
        pickSvAt(e.clientX, e.clientY);
    });
    el.svCanvas.addEventListener('pointermove', e => {
        if (svDragging) pickSvAt(e.clientX, e.clientY);
    });
    el.svCanvas.addEventListener('pointerup', e => {
        svDragging = false;
        try { el.svCanvas.releasePointerCapture(e.pointerId); } catch (_) {}
    });
    el.svCanvas.addEventListener('pointercancel', () => { svDragging = false; });

    el.colorCard.addEventListener('click', e => {
        if (e.target.closest('.color-picker')) return;
        selectColor();
    });

    el.syncCancel.addEventListener('click', closeSyncModal);

    el.sendBtn.addEventListener('click', async () => {
        const payload = buildPayload();

        if (!NFC.isSupported()) {
            toast('NFC not available on this device');
            return;
        }

        openSyncModal('Ready to Sync', "Hold your phone against the device's NFC icon.");
        nfcAbort = new AbortController();

        try {
            await NFC.writeJson(payload, nfcAbort.signal);
            el.syncTitle.textContent = 'Sent';
            el.syncMsg.textContent = 'Configuration transmitted successfully.';
            setTimeout(closeSyncModal, 150);
            toast('Sent to device');
        } catch (e) {
            if (e.name === 'AbortError') { closeSyncModal(); return; }
            el.syncTitle.textContent = 'Sync Failed';
            el.syncMsg.textContent = e.message || 'Could not write to the device.';
            setTimeout(closeSyncModal, 1800);
        }
    });
}

function boot() {
    loadState();
    applyTheme();

    /* NFC status badge */
    if (NFC.isSupported()) {
        el.nfcBadge.classList.add('ready');
        el.nfcText.textContent = 'NFC Ready';
    } else {
        el.nfcText.textContent = 'No NFC';
    }

    /* Restore HSV state if selection is a color */
    if (state.selection.type === 'color') {
        const { r, g, b } = hexToRgb(state.selection.hex);
        state.hsv = rgbToHsv(r, g, b);
    }

    /* Size SV canvas to its CSS box */
    const svWrap = document.querySelector('.sv-wrap');
    el.svCanvas.width  = Math.round(svWrap.clientWidth)  || 300;
    el.svCanvas.height = Math.round(svWrap.clientHeight) || 200;

    /* Populate UI */
    el.brightness.value = state.brightness;
    el.brightnessVal.textContent = state.brightness + '%';
    drawSvSquare();
    syncColorUI();

    buildCategoryBar();
    buildList();
    updateSelectionVisuals();

    wireEvents();

    /* Persistent NFC scan arms on first user gesture */
    NFC.armScanOnFirstGesture();

    requestAnimationFrame(animationLoop);
}

boot();
