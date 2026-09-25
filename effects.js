/* ═══════════════════════════════════════════════════════════════════════
   effects.js — pure effect functions and their registry
   ═══════════════════════════════════════════════════════════════════════
   No DOM. No state. No side effects. Every effect takes (elapsedMs, out)
   where `out` is a Uint8Array(48) holding 16 × RGB triples.
*/

export const N       = 16;
export const TAU     = Math.PI * 2;
export const PI      = Math.PI;
export const LED_RAD = TAU / N;

const S = Math.sin, C = Math.cos, Abs = Math.abs, Exp = Math.exp;

export const clampU8 = v => v < 0 ? 0 : v > 255 ? 255 : (v | 0);

export function put(o, i, r, g, b) {
    const k = i * 3;
    o[k]   = clampU8(r);
    o[k+1] = clampU8(g);
    o[k+2] = clampU8(b);
}

export function wrapPi(a) {
    a = a % TAU;
    if (a >  PI) a -= TAU;
    if (a < -PI) a += TAU;
    return a;
}

export function hash32(x) {
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
    x = (x ^ (x >>> 16)) >>> 0;
    return x;
}

export function smoothstep(a) {
    if (a <= 0) return 0;
    if (a >= 1) return 1;
    return a * a * (3 - 2 * a);
}

function hueBlend(h0, h1, t) {
    let d = h1 - h0;
    if (d >  128) d -= 256;
    if (d < -128) d += 256;
    return ((h0 + d * t) + 256) & 0xff;
}

export function hsv2rgb(h, s, v) {
    if (s === 0) return [v, v, v];
    const region = Math.floor(h / 43) & 7;
    const rem = (h - region * 43) * 6;
    const pv = (v * (255 - s)) >> 8;
    const qv = (v * (255 - ((s * rem) >> 8))) >> 8;
    const tv = (v * (255 - ((s * (255 - rem)) >> 8))) >> 8;
    switch (region) {
        case 0:  return [v, tv, pv];
        case 1:  return [qv, v, pv];
        case 2:  return [pv, v, tv];
        case 3:  return [pv, qv, v];
        case 4:  return [tv, pv, v];
        default: return [v, pv, qv];
    }
}

function wrap01(u) { return u - Math.floor(u); }

/* ═══════════════════════════════════════════════════════════════════════
   Effect implementations
   ═══════════════════════════════════════════════════════════════════════ */

export const fx = {

void(t, o) {
    const T = t * 0.0003;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const b1 = S(x*2 + T) * 0.5 + 0.5;
        const b2 = S(x*1 - T*0.7) * 0.5 + 0.5;
        put(o, i, 8 + b1*18, 8 + b1*12, 20 + b2*35);
    }
},
ocean(t, o) {
    const p1 = t * 0.0012, p2 = t * 0.0007;
    for (let i = 0; i < N; i++) {
        const w1 = (S(p1 - i*0.35) + 1) * 0.5;
        const w2 = (S(p2 + i*0.20) + 1) * 0.5;
        let e = w1 * w2; e *= e;
        const v = 35 + e * 220;
        put(o, i, 0, (90*v)>>8, (210*v)>>8);
    }
},
aurora(t, o) {
    const hc = (110 + Math.floor(t/120) % 100) & 0xff;
    const ph = t * 0.0025;
    for (let i = 0; i < N; i++) {
        const p = ph - i * 0.22;
        let e = (S(p) + 1) * 0.5; e *= e;
        const v = 55 + e * 190;
        const hue = (hc + ((i * 12) / N | 0)) & 0xff;
        const [r,g,b] = hsv2rgb(hue, 210, v|0);
        put(o, i, r, g, b);
    }
},
ice(t, o) {
    const ph = t * 0.0020;
    for (let i = 0; i < N; i++) {
        const p = ph - i * 0.28;
        let e = (S(p) + 1) * 0.5; e *= e;
        const hue = (145 + ((i * 20) / N | 0)) & 0xff;
        const [r,g,b] = hsv2rgb(hue, (180 - e*80)|0, (90 + e*165)|0);
        put(o, i, r, g, b);
    }
},
cloudNine(t, o) {
    const T = t * 0.0004;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const tA = S(x*2 + T) * 0.5 + 0.5;
        const tB = S(x*1 - T*0.7) * 0.5 + 0.5;
        put(o, i, 240 + tA*15, 235 + (1 - Abs(tA - tB)) * 20, 245 + (1 - tA) * 10);
    }
},
mermaid(t, o) {
    const T = t * 0.0006;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let w1 = S(x*2 + T*1.1) * 0.5 + 0.5;
        let w2 = S(x*3 - T*0.7 + 1.7) * 0.5 + 0.5;
        w1 *= w1; w2 *= w2;
        const total = w1 + w2 + 0.001;
        const hue = ((w1*150 + w2*200) / total) | 0;
        let pearl = w1 * w2 * 2; if (pearl > 1) pearl = 1;
        const [r,g,b] = hsv2rgb(hue & 0xff, (170 - pearl*100)|0, (210 + pearl*45)|0);
        put(o, i, r, g, b);
    }
},
matcha(t, o) {
    const T = t * 0.0010;
    let br = S(T) * 0.5 + 0.5; br *= br;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const w = S(x - T*0.8) * 0.5 + 0.5;
        const hue = (60 + w * 40) | 0;
        const [r,g,b] = hsv2rgb(hue & 0xff, (120 + br*60)|0, (210 + br*45)|0);
        put(o, i, r, g, b);
    }
},
mochi(t, o) {
    const T = t * 0.0005;
    const p1 = (T * 0.7) % TAU;
    const p2 = (-T * 0.5 + 2.0) % TAU;
    const p3 = (T * 0.9 + 4.5) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const d1 = wrapPi(x - p1), d2 = wrapPi(x - p2), d3 = wrapPi(x - p3);
        const a1 = 1 - d1*d1 / 1.4; const o1 = a1 > 0 ? a1*a1 : 0;
        const a2 = 1 - d2*d2 / 1.2; const o2 = a2 > 0 ? a2*a2 : 0;
        const a3 = 1 - d3*d3 / 1.6; const o3 = a3 > 0 ? a3*a3 : 0;
        let r = 235, g = 200, b = 235;
        r -= o1*80;  g += o1*20;  b -= o1*60;
        r += o2*20;  g -= o2*40;  b -= o2*100;
        r -= o3*40;  g -= o3*20;
        put(o, i, r, g, b);
    }
},
solarFlare(t, o) {
    const T = t * 0.0010;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let boil = S(x*4 + T*1.2) + S(x*7 - T*1.7 + 1.3) + S(x*3 + T*0.8 + 2.9);
        boil = (boil + 3) / 6;
        const hs = S(x*2 - T*0.6 + 0.5) * S(T * 0.35);
        let fl = hs > 0.75 ? (hs - 0.75) * 4 : 0;
        if (fl > 1) fl = 1;
        let r = 200 + boil * 55;
        let g =  60 + boil * 140;
        let b =   5;
        r = r * (1 - fl*0.20) + 255 * fl * 0.20;
        g = g * (1 - fl*0.50) + 240 * fl * 0.50;
        b = b * (1 - fl*1.00) + 220 * fl * 1.00;
        put(o, i, r, g, b);
    }
},
iridescent(t, o) {
    const T = t * 0.0008;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const hue = ((x / TAU) * 255 + T * 30) & 0xff;
        const f1 = S(x*6 + T*2) * 0.5 + 0.5;
        const f2 = S(x*3 - T*1.5) * 0.5 + 0.5;
        const [r,g,b] = hsv2rgb(hue, (80 + f1*110)|0, (180 + f2*75)|0);
        put(o, i, r, g, b);
    }
},
miamiVice(t, o) {
    const T = t * 0.0010;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const blend = smoothstep(S(x*2 + T*1.5) * 0.5 + 0.5);
        const [r,g,b] = hsv2rgb((180 + blend * 150) & 0xff, 255, (180 + S(x*3 - T) * 60)|0);
        put(o, i, r, g, b);
    }
},
ripple(t, o) {
    const T = t * 0.0015;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const w1 = S(x*3 - T*3) * 0.5 + 0.5;
        const w2 = S(x*3 + T*3 + PI) * 0.5 + 0.5;
        const env = S(x*2 + T*0.5) * 0.3 + 0.7;
        const glow = w1 * w2 * env;
        put(o, i, 5 + glow*30, 30 + glow*200, 70 + glow*180);
    }
},
rainbow(t, o) {
    const T = t * 0.0015;
    const hb = (T * 40) & 0xff;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const hue = (hb + ((i * 256) / N | 0)) & 0xff;
        const vm = S(x*3 + T*2) * 0.5 + 0.5;
        const [r,g,b] = hsv2rgb(hue, 255, (200 + vm * 55) | 0);
        put(o, i, r, g, b);
    }
},
thunderstorm(t, o) {
    const Tc = t * 0.0008;
    const Ts = t * 0.0010;
    const strikeIdx = Math.floor(Ts * 0.5);
    const strikePhase = Ts - strikeIdx * 2;
    let flash = 0;
    if (strikePhase < 0.30) { const k = 1 - strikePhase / 0.30; flash = k * k; }
    const h = hash32(strikeIdx * 73 + 1);
    const strikePos = (((h >>> 24) & 0xff) / 255) * TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let cloud = S(x*2 + Tc*0.5) * 0.5 + 0.5;
        cloud = cloud * 0.7 + 0.3;
        let r = 15 * cloud, g = 20 * cloud, b = 60 * cloud;
        if (flash > 0) {
            const d = wrapPi(x - strikePos);
            let loc = 1 - Abs(d) / 0.8;
            if (loc > 0) {
                loc *= loc;
                r += loc * 200 * flash; g += loc * 220 * flash; b += loc * 255 * flash;
            }
        }
        put(o, i, r, g, b);
    }
},
cyberpunk(t, o) {
    const T = t * 0.0015;
    for (let i = 0; i < N; i++) {
        const w = (S(T - i*0.35) + 1) * 0.5;
        const [r,g,b] = hsv2rgb((128 + w * 85) & 0xff, 255, 220);
        put(o, i, r, g, b);
    }
},
opal(t, o) {
    const T = t * 0.0006;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let r = 220, g = 230, b = 240;
        let p1 = S(x*1 + T*0.7);
        p1 = p1 > 0.85 ? (p1 - 0.85) * 6.666 : 0;
        r += p1*80; g -= p1*60; b -= p1*30;
        let p2 = S(x*2 - T*0.5 + 1.7);
        p2 = p2 > 0.85 ? (p2 - 0.85) * 6.666 : 0;
        r -= p2*70; g += p2*40; b -= p2*50;
        let p3 = S(x*3 + T*0.9 + 3.1);
        p3 = p3 > 0.85 ? (p3 - 0.85) * 6.666 : 0;
        r -= p3*50; g -= p3*30; b += p3*60;
        put(o, i, r, g, b);
    }
},
cottonCandy(t, o) {
    const T = t * 0.0008;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const blend = S(x + T*1.5) * 0.5 + 0.5;
        const [r,g,b] = hsv2rgb((170 + blend * 75) & 0xff, 150, (225 + S(x*2 - T) * 20) | 0);
        put(o, i, r, g, b);
    }
},
macaron(t, o) {
    const PAL = [235, 205, 160, 100, 40];
    const T = t * 0.0004;
    for (let i = 0; i < N; i++) {
        let p = (i * 5) / N + T * 3;
        while (p >= 5) p -= 5;
        const i0 = p | 0;
        const i1 = (i0 + 1) % 5;
        const hue = hueBlend(PAL[i0], PAL[i1], p - i0);
        const [r,g,b] = hsv2rgb(hue, 170, 240);
        put(o, i, r, g, b);
    }
},
strawberryMilk(t, o) {
    const T = t * 0.0007;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let milk = S(x*2 - T*1.2) * 0.5 + 0.5;
        milk *= milk;
        const [r,g,b] = hsv2rgb(245, (200 - milk*150)|0, (230 + milk*25)|0);
        put(o, i, r, g, b);
    }
},
blossom(t, o) {
    const ph = t * 0.0018;
    for (let i = 0; i < N; i++) {
        const p = ph - i * 0.30;
        let e = (S(p) + 1) * 0.5; e *= e;
        const [r,g,b] = hsv2rgb(250, (255 - e*120)|0, (100 + e*155)|0);
        put(o, i, r, g, b);
    }
},
forest(t, o) {
    const ph = t * 0.0015;
    for (let i = 0; i < N; i++) {
        const p = ph - i * 0.25;
        let e = (S(p) + 1) * 0.5; e *= e;
        const hue = (60 + ((i * 70) / N | 0)) & 0xff;
        const [r,g,b] = hsv2rgb(hue, 235, (45 + e*195)|0);
        put(o, i, r, g, b);
    }
},
obsidian(t, o) {
    const T = t * 0.0007;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const base = S(x*3 + T*0.5) * 0.5 + 0.5;
        let r = 8 + base*8, g = 4 + base*4, b = 6 + base*6;
        const f1 = S(x*4 + T*2.0);
        const f2 = S(x*3 - T*1.3 + 1.7);
        let fs1 = f1 > 0.70 ? (f1 - 0.70) / 0.30 : 0;
        let fs2 = f2 > 0.75 ? (f2 - 0.75) / 0.25 : 0;
        fs1 *= fs1; fs2 *= fs2;
        let fissure = fs1 + fs2; if (fissure > 1) fissure = 1;
        r += fissure*220; g += fissure*55; b += fissure*10;
        put(o, i, r, g, b);
    }
},
bloodMoon(t, o) {
    const T = t * 0.0004;
    const moonPos = (T * 0.8) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const d = wrapPi(x - moonPos);
        let sh = 1 - (d*d)/1.6; if (sh < 0) sh = 0; sh *= sh;
        const base = S(x + T*0.5) * 0.5 + 0.5;
        put(o, i, 150 + base*40 - sh*110, 15 + base*10 - sh*10, 20 + base*15 - sh*15);
    }
},
noir(t, o) {
    const T = t * 0.0012;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const w1 = S(x*2 + T) * 0.5 + 0.5;
        const w2 = S(x*3 - T*1.4 + 1.9) * 0.5 + 0.5;
        let v = w1 * w2; v = v*v*v;
        const iv = (v * 235) | 0;
        put(o, i, iv, iv, iv);
    }
},
ember(t, o) {
    for (let i = 0; i < N; i++) {
        let r = 22, g = 12, b = 8;
        const h = hash32(i * 89 + 1);
        const period = 1500 + ((h >>> 24) & 0x3f) * 35;
        const phase  = ((h >>> 16) & 0xff) / 255;
        const u = ((t / period) + phase) % 1;
        let pulse = u < 0.5 ? u * 2 : (1 - u) * 2;
        pulse = pulse * pulse * pulse;
        r += pulse*230; g += pulse*95; b += pulse*20;
        put(o, i, r, g, b);
    }
},
wraith(t, o) {
    const T = t * 0.0010;
    const p1 = (T * 0.6) % TAU;
    const p2 = (-T * 0.4 + 3.3) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let r = 3, g = 6, b = 18;
        const d1 = wrapPi(x - p1), d2 = wrapPi(x - p2);
        const w1 = Exp(-(d1*d1) * 4.0);
        const w2 = Exp(-(d2*d2) * 6.0);
        r += w1*140 + w2*60;
        g += w1*180 + w2*120;
        b += w1*200 + w2*170;
        put(o, i, r, g, b);
    }
},
galaxy(t, o) {
    const T = t * 0.0010;
    const hueF = 170 + S(T * 0.35) * 45;
    const hb = hueF | 0;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let env = S(x*2 - T*1.5) * 0.5 + 0.5; env *= env;
        let shim = S(x*5 + T*3) * 0.5 + 0.5;
        shim = 0.75 + shim * 0.25;
        const vf = (60 + env * 180) * shim;
        const hue = (hb + ((i * 12) / N | 0)) & 0xff;
        const [r,g,b] = hsv2rgb(hue, 210, vf|0);
        put(o, i, r, g, b);
    }
},
supernova(t, o) {
    const cycleS = (t * 0.001) % 8;
    const u = cycleS / 8;
    const cycleIdx = Math.floor(t / 8000);
    const h = hash32(cycleIdx * 71 + 13);
    const center = (((h >>> 24) & 0xff) / 255) * TAU;
    let flash = 0, shellR = 0, shellA = 0;
    if (u < 0.04) flash = 1 - u * 25;
    else if (u < 0.72) {
        const su = (u - 0.04) / 0.68;
        shellR = su * PI;
        shellA = 1 - su * su;
    }
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const ad = Abs(wrapPi(x - center));
        const sd = (ad - shellR) / 0.35;
        const shell = Exp(-sd*sd) * shellA;
        const fd = ad / 0.4;
        const fe = Exp(-fd*fd) * flash;
        put(o, i, fe*255 + shell*170, fe*240 + shell*210, fe*220 + shell*255);
    }
},
blackHole(t, o) {
    const T = t * 0.0009;
    const pos = (T * 0.6) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const d = wrapPi(x - pos);
        const ad = Abs(d);
        const horizon = 1 - Exp(-(ad*ad) / 0.04);
        const dd = (ad - 0.7) / 0.5;
        const disk = Exp(-dd*dd);
        const lens = d > 0 ? 1 : 0.5;
        put(o, i,
            disk * lens * (255 - ad*60) * horizon,
            disk * lens * (170 - ad*40) * horizon,
            disk * lens * (255 - ad*10) * horizon);
    }
},
saturnRings(t, o) {
    const PAL = [[200,175,130],[235,220,185],[190,160,100],[180,175,165],[20,18,15]];
    const T = t * 0.0002;
    for (let i = 0; i < N; i++) {
        const u = wrap01(i / N + T);
        const bf = u * 5;
        const band = bf | 0;
        const fr = bf - band;
        const nb = (band + 1) % 5;
        const br = 1 - 0.15 * S(u * TAU * 3);
        put(o, i,
            (PAL[band][0]*(1-fr) + PAL[nb][0]*fr) * br,
            (PAL[band][1]*(1-fr) + PAL[nb][1]*fr) * br,
            (PAL[band][2]*(1-fr) + PAL[nb][2]*fr) * br);
    }
},
mars(t, o) {
    const T = t * 0.0003;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const n1 = S(x*1 + T*0.4) * 0.5 + 0.5;
        const n2 = S(x*3 - T*0.8) * 0.5 + 0.5;
        const n3 = S(x*7 + T*1.3) * 0.5 + 0.5;
        const s = n1*0.5 + n2*0.3 + n3*0.2;
        let r = 140 + s*60, g = 65 + s*30, b = 35 + s*15;
        const st = S(x*4 + T*0.6);
        if (st > 0.6) {
            const k = (st - 0.6) * 2.5;
            r *= 1 - k*0.35; g *= 1 - k*0.35; b *= 1 - k*0.35;
        }
        put(o, i, r, g, b);
    }
},
jupiter(t, o) {
    const B = [[235,215,175],[180,130,80],[210,180,130],[150,105,65],[230,200,155]];
    const T = t * 0.0002;
    for (let i = 0; i < N; i++) {
        const u = wrap01(i / N + T);
        const bf = u * 5;
        const band = bf | 0;
        const fr = bf - band;
        const nb = (band + 1) % 5;
        const bl = fr * fr * (3 - 2 * fr);
        let r = B[band][0]*(1-bl) + B[nb][0]*bl;
        let g = B[band][1]*(1-bl) + B[nb][1]*bl;
        let b = B[band][2]*(1-bl) + B[nb][2]*bl;
        const su = wrap01(0.3 + T * 0.15);
        let sd = u - su;
        if (sd > 0.5) sd -= 1;
        if (sd < -0.5) sd += 1;
        const spot = Exp(-(sd*sd) / 0.02);
        r = r * (1 - spot*0.4) + 200 * spot * 0.4;
        g = g * (1 - spot*0.7) +  95 * spot * 0.7;
        b = b * (1 - spot*0.8) +  70 * spot * 0.8;
        put(o, i, r, g, b);
    }
},
neptune(t, o) {
    const T = t * 0.0004;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const base = S(x*2 + T*0.5) * 0.5 + 0.5;
        let r = 20 + base*10, g = 45 + base*20, b = 170 + base*40;
        const s1p = (T * 1.7) % TAU;
        const d1 = wrapPi(x - s1p);
        const s1 = Exp(-(d1*d1) / 0.02);
        r += s1*80; g += s1*90; b += s1*60;
        const s2p = (-T * 2.4 + 2) % TAU;
        const d2 = wrapPi(x - s2p);
        const s2 = Exp(-(d2*d2) / 0.015);
        r += s2*60; g += s2*70; b += s2*45;
        put(o, i, r, g, b);
    }
},
starfield(t, o) {
    for (let i = 0; i < N; i++) {
        const h = hash32(i * 133 + 7);
        if ((h & 0xff) < 100) { put(o, i, 2, 3, 6); continue; }
        const period = 1500 + ((h >>> 24) & 0x7f) * 25;
        const phase  = ((h >>> 16) & 0xff) / 255;
        const u = (t / period + phase) % 1;
        let tw = 0.55 + 0.45 * C(u * TAU); tw *= tw;
        const temp = ((h >>> 8) & 0x7f) / 127;
        const r = 255 * (1 - temp * 0.35);
        const g = 240 - temp * 30;
        const b = 210 + temp * 45;
        const amp = tw * (0.6 + 0.4 * ((h >>> 5) & 7) / 7);
        put(o, i, r*amp, g*amp, b*amp);
    }
},
pulsar(t, o) {
    const T = t * 0.0030;
    const bp = T % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const d1 = wrapPi(x - bp);
        const d2 = wrapPi(x - bp - PI);
        const b1 = Exp(-(d1*d1) / 0.015);
        const b2 = Exp(-(d2*d2) / 0.015);
        put(o, i, 3 + (b1+b2)*40, 4 + (b1+b2)*200, 9 + (b1+b2)*255);
    }
},
eclipse(t, o) {
    const T = t * 0.0005;
    const mp = (T * 0.7) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const d = wrapPi(x - mp);
        const ad = Abs(d);
        const dark = Exp(-(ad*ad) / 0.08);
        const cr = (ad - 0.55) / 0.15;
        const cor = Exp(-cr*cr);
        const base = S(x*2 + T*0.8) * 0.5 + 0.5;
        let r = 40 + base*25, g = 14 + base*12, b = 20 + base*12;
        r += cor*245; g += cor*185; b += cor*60;
        r *= 1 - dark*0.95; g *= 1 - dark*0.95; b *= 1 - dark*0.95;
        put(o, i, r, g, b);
    }
},
meteorShower(t, o) {
    const T = t * 0.0025;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let r = 4, g = 4, b = 8;
        for (let k = 0; k < 3; k++) {
            const po = k * 1.4;
            const mp = (T + po) % TAU;
            const dd = wrapPi(mp - x);
            const behind = dd < 0 ? -dd : 0;
            const trail = Exp(-behind * 2.2);
            const head = Exp(-(behind*behind) / 0.01);
            r += head*255 + trail*180;
            g += head*220 + trail*120;
            b += head*130 + trail*50;
        }
        put(o, i, r, g, b);
    }
},
cosmicDust(t, o) {
    const T = t * 0.0004;
    const p1 = (T * 0.6) % TAU;
    const p2 = (-T * 0.45 + 2.5) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const d1 = wrapPi(x - p1), d2 = wrapPi(x - p2);
        const w1 = Exp(-(d1*d1) / 0.9);
        const w2 = Exp(-(d2*d2) / 0.7);
        let r = 60 + w1*130, g = 25 + w1*50, b = 55 + w1*90;
        r += w2*110; g += w2*80; b -= w2*20;
        put(o, i, r, g, b);
    }
},
orion(t, o) {
    const starPos = [0.00, 0.55, 1.30, 2.20, 3.10];
    const starAmp = [1.00, 0.70, 0.90, 0.80, 1.00];
    const T = t * 0.0002;
    const rot = T * 0.5;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let r = 3, g = 5, b = 12;
        for (let k = 0; k < 5; k++) {
            const sp = starPos[k] + rot;
            const d = wrapPi(x - sp);
            const glow = Exp(-(d*d) / 0.02);
            const h = hash32(k * 89 + 31);
            const period = 2500 + ((h >>> 24) & 0x7f) * 40;
            const phase  = ((h >>> 16) & 0xff) / 255;
            const u = (t / period + phase) % 1;
            const breathe = 0.7 + 0.3 * C(u * TAU);
            const amp = glow * starAmp[k] * breathe;
            r += amp*180; g += amp*210; b += amp*255;
        }
        put(o, i, r, g, b);
    }
},
hydrogenAlpha(t, o) {
    const T = t * 0.0005;
    let br = S(T) * 0.5 + 0.5; br *= br;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const lc = S(x*2 + T*0.7) * 0.5 + 0.5;
        const cb = br * 0.7 + lc * 0.3;
        const v = 170 + cb * 85;
        put(o, i, v, v*0.06, v*0.10);
    }
},
bunsenBurner(t, o) {
    const T = t * 0.0008;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const w = S(x*2 + T) * 0.5 + 0.5;
        let r = 15 + w*25, g = 90 + w*80, b = 200 + w*55;
        const h = hash32(Math.floor(t/180) * 17 + i * 41);
        if ((h & 0xff) > 200) {
            const spark = ((h >>> 8) & 0xff) / 255;
            r += spark*230; g += spark*140; b -= spark*120;
        }
        put(o, i, r, g, b);
    }
},
copperSulfate(t, o) {
    const T = t * 0.0004;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const f = S(x*5 + T*0.5);
        const sharp = f > 0.35 ? 1 : f > -0.35 ? 0.5 : 0;
        const dep = S(x*2 - T*0.7) * 0.5 + 0.5;
        put(o, i, 15 + dep*25, 125 + sharp*70 + dep*35, 200 + sharp*55);
    }
},
permanganate(t, o) {
    const T = t * 0.0003;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const w = S(x*2 + T) * 0.5 + 0.5;
        let r = 85 + w*35, g = 15 + w*12, b = 120 + w*45;
        const dp = (T * 0.6) % TAU;
        const d = wrapPi(x - dp);
        const diff = Exp(-(d*d) / 0.6);
        r += diff*95; g += diff*10; b += diff*30;
        put(o, i, r, g, b);
    }
},
mercury(t, o) {
    const T = t * 0.0006;
    const bp = (T * 0.8) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const b = S(x*3 + T*0.7) * 0.5 + 0.5;
        let r = 115 + b*40, g = 120 + b*40, bl = 130 + b*40;
        const d = wrapPi(x - bp);
        const bead = Exp(-(d*d) / 0.03);
        r += bead*140; g += bead*135; bl += bead*125;
        const d2 = wrapPi(x - bp - PI * 0.7);
        const gl = Exp(-(d2*d2) / 0.05) * 0.4;
        r += gl*80; g += gl*80; bl += gl*85;
        put(o, i, r, g, bl);
    }
},
bromine(t, o) {
    const T = t * 0.0003;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        const w = S(x*2 + T) * 0.5 + 0.5;
        let r = 125 + w*40, g = 40 + w*15, b = 20 + w*10;
        const vp = (T * 1.5) % TAU;
        const d = wrapPi(x - vp);
        const vap = Exp(-(d*d) / 0.35);
        r += vap*95; g += vap*55; b += vap*20;
        put(o, i, r, g, b);
    }
},
iodineVapor(t, o) {
    const T = t * 0.0004;
    const p1 = (T * 1.1) % TAU;
    const p2 = (-T * 0.7 + 2.4) % TAU;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let r = 35, g = 18, b = 75;
        const d1 = wrapPi(x - p1), d2 = wrapPi(x - p2);
        const v1 = Exp(-(d1*d1) / 0.25);
        const v2 = Exp(-(d2*d2) / 0.35) * 0.7;
        let pl = v1 + v2; if (pl > 1) pl = 1;
        r += pl*140; g += pl*25; b += pl*135;
        put(o, i, r, g, b);
    }
},
titration(t, o) {
    const cycle = (t * 0.001) % 12;
    const u = cycle / 12;
    const ep = u * u;
    for (let i = 0; i < N; i++) {
        const x = i * LED_RAD;
        let r = 35, g = 50, b = 65;
        if (ep > 0.05) {
            const th = 1 - ep;
            const sw = S(x*3 + t*0.0025);
            if (sw > th) {
                let k = (sw - th) / ep; if (k > 1) k = 1;
                r += k*200; g -= k*25; b += k*45;
            }
        }
        put(o, i, r, g, b);
    }
},
crystalLattice(t, o) {
    const T = t * 0.0004;
    let br = S(T * 1.5) * 0.5 + 0.5;
    br = 0.70 + 0.30 * br;
    for (let i = 0; i < N; i++) {
        const u = i / N;
        const nf = (u * 4) % 1;
        const dn = Math.min(nf, 1 - nf);
        const node = Exp(-(dn*dn) / 0.015);
        let r = 20, g = 35, b = 70;
        r += node*195*br; g += node*220*br; b += node*255*br;
        const line = 1 - node;
        r += line*10; g += line*15; b += line*25;
        put(o, i, r, g, b);
    }
},
photoWarm(t, o)    { for (let i = 0; i < N; i++) put(o, i, 255, 185, 105); },
photoNeutral(t, o) { for (let i = 0; i < N; i++) put(o, i, 255, 235, 210); },
photoCool(t, o)    { for (let i = 0; i < N; i++) put(o, i, 210, 235, 255); },
candle(t, o)       { for (let i = 0; i < N; i++) put(o, i, 255, 160,  70); },
moonlight(t, o)    { for (let i = 0; i < N; i++) put(o, i, 170, 200, 255); },
};

/* ═══════════════════════════════════════════════════════════════════════
   Registry
   ═══════════════════════════════════════════════════════════════════════ */

export const CATEGORIES = [
    { id: 'all',      label: 'All' },
    { id: 'ambient',  label: 'Ambient' },
    { id: 'vivid',    label: 'Vivid' },
    { id: 'pastel',   label: 'Pastel' },
    { id: 'noir',     label: 'Noir' },
    { id: 'cosmic',   label: 'Cosmic' },
    { id: 'reactive', label: 'Reactive' },
    { id: 'static',   label: 'Static' },
];

export const EFFECTS = [
    { id: 'void',              name: 'Void',              cat: 'ambient',  desc: 'Barely-there deep violet shimmer',         fn: fx.void },
    { id: 'ocean',             name: 'Ocean',             cat: 'ambient',  desc: 'Deep blue-cyan crossing waves',            fn: fx.ocean },
    { id: 'aurora',            name: 'Aurora',            cat: 'ambient',  desc: 'Green, teal, and violet drift',            fn: fx.aurora },
    { id: 'ice',               name: 'Ice',               cat: 'ambient',  desc: 'Desaturated pale blue shimmer',            fn: fx.ice },
    { id: 'cloudNine',         name: 'Cloud Nine',        cat: 'ambient',  desc: 'Near-white with faint pastel tint',        fn: fx.cloudNine },
    { id: 'mermaid',           name: 'Mermaid',           cat: 'ambient',  desc: 'Seafoam, lavender, and pearl',             fn: fx.mermaid },
    { id: 'matcha',            name: 'Matcha',            cat: 'ambient',  desc: 'Pale green into cream',                    fn: fx.matcha },
    { id: 'mochi',             name: 'Mochi',             cat: 'ambient',  desc: 'Pillowy pastel orbs, mint & peach',        fn: fx.mochi },
    { id: 'solarFlare',        name: 'Solar Flare',       cat: 'vivid',    desc: 'Boiling sun with white-hot flares',        fn: fx.solarFlare },
    { id: 'iridescent',        name: 'Iridescent',        cat: 'vivid',    desc: 'Soap-bubble thin-film interference',       fn: fx.iridescent },
    { id: 'miamiVice',         name: 'Miami Vice',        cat: 'vivid',    desc: 'Hot pink & cyan retro blend',              fn: fx.miamiVice },
    { id: 'ripple',            name: 'Ripple',            cat: 'vivid',    desc: 'Opposite waves interfering on navy',       fn: fx.ripple },
    { id: 'rainbow',           name: 'Rainbow',           cat: 'vivid',    desc: 'Full hue wheel, breathing value',          fn: fx.rainbow },
    { id: 'thunderstorm',      name: 'Thunderstorm',      cat: 'vivid',    desc: 'Stormy indigo with lightning',             fn: fx.thunderstorm },
    { id: 'cyberpunk',         name: 'Cyberpunk',         cat: 'vivid',    desc: 'Cyan & magenta two-colour sweep',          fn: fx.cyberpunk },
    { id: 'opal',              name: 'Opal',              cat: 'vivid',    desc: 'White stone with pastel flecks',           fn: fx.opal },
    { id: 'cottonCandy',       name: 'Cotton Candy',      cat: 'pastel',   desc: 'Pink & sky blue spatial weave',            fn: fx.cottonCandy },
    { id: 'macaron',           name: 'Macaron',           cat: 'pastel',   desc: 'Five pastel patisserie hues',              fn: fx.macaron },
    { id: 'strawberryMilk',    name: 'Strawberry Milk',   cat: 'pastel',   desc: 'Pink desaturating into milk white',        fn: fx.strawberryMilk },
    { id: 'blossom',           name: 'Blossom',           cat: 'pastel',   desc: 'Rose petals catching light',               fn: fx.blossom },
    { id: 'forest',            name: 'Forest',            cat: 'pastel',   desc: 'Yellow-green into deep green',             fn: fx.forest },
    { id: 'obsidian',          name: 'Obsidian',          cat: 'noir',     desc: 'Black glass with warm fissures',           fn: fx.obsidian },
    { id: 'bloodMoon',         name: 'Blood Moon',        cat: 'noir',     desc: 'Deep crimson with drifting dark spot',     fn: fx.bloodMoon },
    { id: 'noir',              name: 'Noir',              cat: 'noir',     desc: 'Black & white high-contrast bands',        fn: fx.noir },
    { id: 'ember',             name: 'Ember',             cat: 'noir',     desc: 'Charcoal with pulsing warm coals',         fn: fx.ember },
    { id: 'wraith',            name: 'Wraith',            cat: 'noir',     desc: 'Pale wisps on black-navy',                 fn: fx.wraith },
    { id: 'galaxy',            name: 'Galaxy',            cat: 'noir',     desc: 'Deep nebular drift with shimmer',          fn: fx.galaxy },
    { id: 'supernova',         name: 'Supernova',         cat: 'cosmic',   desc: 'Periodic explosion with expanding shell',  fn: fx.supernova },
    { id: 'blackHole',         name: 'Black Hole',        cat: 'cosmic',   desc: 'Lensed accretion disk, dark centre',       fn: fx.blackHole },
    { id: 'saturnRings',       name: 'Saturn Rings',      cat: 'cosmic',   desc: 'Banded ochre, cream, and pale grey',       fn: fx.saturnRings },
    { id: 'mars',              name: 'Mars',              cat: 'cosmic',   desc: 'Dusty red with dark striations',           fn: fx.mars },
    { id: 'jupiter',           name: 'Jupiter',           cat: 'cosmic',   desc: 'Banded gas giant with drifting spot',      fn: fx.jupiter },
    { id: 'neptune',           name: 'Neptune',           cat: 'cosmic',   desc: 'Deep blue with pale wind streaks',         fn: fx.neptune },
    { id: 'starfield',         name: 'Starfield',         cat: 'cosmic',   desc: 'Sparse stars with colour temperature',     fn: fx.starfield },
    { id: 'pulsar',            name: 'Pulsar',            cat: 'cosmic',   desc: 'Two lighthouse beams sweeping',            fn: fx.pulsar },
    { id: 'eclipse',           name: 'Eclipse',           cat: 'cosmic',   desc: 'Dark disc with warm corona ring',          fn: fx.eclipse },
    { id: 'meteorShower',      name: 'Meteor Shower',     cat: 'cosmic',   desc: 'Multiple gold streaks, one direction',     fn: fx.meteorShower },
    { id: 'cosmicDust',        name: 'Cosmic Dust',       cat: 'cosmic',   desc: 'Dusty rose & amber nebular cloud',         fn: fx.cosmicDust },
    { id: 'orion',             name: 'Orion',             cat: 'cosmic',   desc: 'Constellation of breathing stars',         fn: fx.orion },
    { id: 'hydrogenAlpha',     name: 'Hydrogen Alpha',    cat: 'reactive', desc: '656 nm deep crimson, slow breath',         fn: fx.hydrogenAlpha },
    { id: 'bunsenBurner',      name: 'Bunsen Burner',     cat: 'reactive', desc: 'Blue lab flame with orange sparks',        fn: fx.bunsenBurner },
    { id: 'copperSulfate',     name: 'Copper Sulfate',    cat: 'reactive', desc: 'Faceted crystal blue, CuSO₄·5H₂O',         fn: fx.copperSulfate },
    { id: 'permanganate',      name: 'Permanganate',      cat: 'reactive', desc: 'Deep purple KMnO₄ dissolving',             fn: fx.permanganate },
    { id: 'mercury',           name: 'Mercury',           cat: 'reactive', desc: 'Silver liquid metal, rolling bead',        fn: fx.mercury },
    { id: 'bromine',           name: 'Bromine',           cat: 'reactive', desc: 'Red-brown liquid with orange vapor',       fn: fx.bromine },
    { id: 'iodineVapor',       name: 'Iodine Vapor',      cat: 'reactive', desc: 'Violet I₂ sublimation plumes',             fn: fx.iodineVapor },
    { id: 'titration',         name: 'Titration',         cat: 'reactive', desc: 'Phenolphthalein endpoint approaching',     fn: fx.titration },
    { id: 'crystalLattice',    name: 'Crystal Lattice',   cat: 'reactive', desc: 'Cold blue-white atomic grid',              fn: fx.crystalLattice },
    { id: 'photoWarm',         name: 'Photo Warm',        cat: 'static',   desc: '~3200 K tungsten — for photos',            fn: fx.photoWarm },
    { id: 'photoNeutral',      name: 'Photo Neutral',     cat: 'static',   desc: '~5600 K daylight — for photos',            fn: fx.photoNeutral },
    { id: 'photoCool',         name: 'Photo Cool',        cat: 'static',   desc: '~6500 K cool daylight',                    fn: fx.photoCool },
    { id: 'candle',            name: 'Candle',            cat: 'static',   desc: 'Deep amber candlelight',                   fn: fx.candle },
    { id: 'moonlight',         name: 'Moonlight',         cat: 'static',   desc: 'Cool blue-white moonlight',                fn: fx.moonlight },
];

export function getEffectById(id) {
    return EFFECTS.find(e => e.id === id) || null;
}
