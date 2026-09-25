/* ═══════════════════════════════════════════════════════════════════════
   panel.js — physical diffuser renderer
   ═══════════════════════════════════════════════════════════════════════
   Takes a linear-LED buffer (16 × RGB, 0-255 PWM values) and produces
   an sRGB image of the diffuser panel using:
     1. Gaussian light accumulation per pixel
     2. Normalisation by the peak possible sum
     3. sRGB gamma encode
     4. Mild WS2812B → sRGB primary correction
*/

import { N } from './effects.js';

const LO_RES = 32;
const SIGMA  = 8;
const SIGMA_2 = SIGMA * SIGMA * 2;
const PIXELS = LO_RES * LO_RES;

/* LED positions on the panel, in canvas-normalised coordinates */
export const LED_POS = [
    [0.20,0.15], [0.40,0.15], [0.60,0.15], [0.80,0.15],
    [0.85,0.20], [0.85,0.40], [0.85,0.60], [0.85,0.80],
    [0.80,0.85], [0.60,0.85], [0.40,0.85], [0.20,0.85],
    [0.15,0.80], [0.15,0.60], [0.15,0.40], [0.15,0.20],
];

/* Precomputed per-LED weight maps — one Float32Array per LED */
const WM = (() => {
    const maps = [];
    for (let i = 0; i < N; i++) {
        const [lx, ly] = [LED_POS[i][0] * LO_RES, LED_POS[i][1] * LO_RES];
        const map = new Float32Array(PIXELS);
        for (let py = 0; py < LO_RES; py++) {
            for (let px = 0; px < LO_RES; px++) {
                const dx = px + 0.5 - lx;
                const dy = py + 0.5 - ly;
                map[py * LO_RES + px] = Math.exp(-(dx*dx + dy*dy) / SIGMA_2);
            }
        }
        maps.push(map);
    }
    return maps;
})();

/* Peak weight sum — highest possible accumulated weight, at the ring */
const PEAK = (() => {
    let max = 0;
    for (let p = 0; p < PIXELS; p++) {
        let s = 0;
        for (let i = 0; i < N; i++) s += WM[i][p];
        if (s > max) max = s;
    }
    return max;
})();

/* sRGB encode LUT: linear [0..1023] → sRGB byte [0..255] */
const SRGB_LUT = (() => {
    const lut = new Uint8Array(1024);
    for (let i = 0; i < 1024; i++) {
        const v = i / 1023;
        const s = v <= 0.0031308
            ? v * 12.92
            : 1.055 * Math.pow(v, 1 / 2.4) - 0.055;
        lut[i] = Math.round(s * 255);
    }
    return lut;
})();

/* WS2812B → sRGB primary correction matrix */
const LED_TO_SRGB = [
    [ 1.06, 0.02, -0.02],
    [-0.04, 1.05,  0.02],
    [ 0.00, 0.02,  0.98],
];

/* ═══════════════════════════════════════════════════════════════════════
   Public API
   ═══════════════════════════════════════════════════════════════════════ */

export function makeOffscreen() {
    const c = document.createElement('canvas');
    c.width = c.height = LO_RES;
    const ctx = c.getContext('2d');
    const img = ctx.createImageData(LO_RES, LO_RES);
    return { canvas: c, ctx, img };
}

export function renderPanel(buf, imageData, brightness) {
    const data = imageData.data;
    const norm = brightness / (255 * PEAK);
    const m = LED_TO_SRGB;

    for (let p = 0; p < PIXELS; p++) {
        let r = 0, g = 0, b = 0;
        for (let i = 0; i < N; i++) {
            const w = WM[i][p];
            const k = i * 3;
            r += buf[k    ] * w;
            g += buf[k + 1] * w;
            b += buf[k + 2] * w;
        }
        r *= norm; g *= norm; b *= norm;

        let sr = r * m[0][0] + g * m[0][1] + b * m[0][2];
        let sg = r * m[1][0] + g * m[1][1] + b * m[1][2];
        let sb = r * m[2][0] + g * m[2][1] + b * m[2][2];

        if (sr < 0) sr = 0; else if (sr > 1) sr = 1;
        if (sg < 0) sg = 0; else if (sg > 1) sg = 1;
        if (sb < 0) sb = 0; else if (sb > 1) sb = 1;

        const o = p * 4;
        data[o    ] = SRGB_LUT[(sr * 1023 + 0.5) | 0];
        data[o + 1] = SRGB_LUT[(sg * 1023 + 0.5) | 0];
        data[o + 2] = SRGB_LUT[(sb * 1023 + 0.5) | 0];
        data[o + 3] = 255;
    }
}

export function drawToVisible(visCtx, off, visSize) {
    off.ctx.putImageData(off.img, 0, 0);
    visCtx.globalCompositeOperation = 'source-over';
    visCtx.imageSmoothingEnabled = true;
    visCtx.imageSmoothingQuality = 'high';
    visCtx.drawImage(off.canvas, 0, 0, LO_RES, LO_RES, 0, 0, visSize, visSize);
}
