/* ═══════════════════════════════════════════════════════════════════════
   nfc.js — Web NFC session management
   ═══════════════════════════════════════════════════════════════════════
   Keeps a persistent scan alive for the page lifetime so Android's
   system dispatcher never steals the tag after a write. Uses the same
   NDEFReader instance for scan and write.
*/

let reader = null;
let scanActive = false;
let scanStarting = false;

export function isSupported() {
    return 'NDEFReader' in window;
}

async function ensureReader() {
    if (!isSupported()) return null;
    if (!reader) reader = new NDEFReader();
    return reader;
}

export async function startScan() {
    if (scanActive || scanStarting) return;
    const r = await ensureReader();
    if (!r) return;

    scanStarting = true;
    try {
        await r.scan();
        r.onreading      = () => {};
        r.onreadingerror = () => {};
        scanActive = true;
    } catch (e) {
        if (e.name !== 'AbortError') console.warn('NFC scan failed:', e);
    } finally {
        scanStarting = false;
    }
}

/*
 * Web NFC requires user activation to start a scan. Attach to the first
 * click/touch/keydown on the page, then leave the scan running.
 */
export function armScanOnFirstGesture() {
    if (!isSupported()) return;
    const arm = () => {
        ['click', 'touchstart', 'keydown'].forEach(ev =>
            document.removeEventListener(ev, arm));
        startScan();
    };
    ['click', 'touchstart', 'keydown'].forEach(ev =>
        document.addEventListener(ev, arm, { passive: true }));
}

/*
 * Write an NDEF JSON record. Ensures the persistent scan is running
 * first so Android never pops its "no app found" page.
 */
export async function writeJson(payload, signal) {
    if (!isSupported()) throw new Error('NFC not supported');

    if (!scanActive) await startScan();

    const r = await ensureReader();
    await r.write({
        records: [{
            recordType: 'mime',
            mediaType: 'application/json',
            data: new TextEncoder().encode(JSON.stringify(payload)),
        }],
    }, { signal });
}
