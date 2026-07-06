// record-demo.mjs — Automated vertical (1080×1920) marketing demo capture.
//
// Drives the REAL app analyzing one word and produces a FINISHED Instagram
// video — no external editor. All effects (zoom, captions, glow) are done
// in-page during capture. Music is intentionally NOT added here (added
// natively in Instagram).
//
// HARD PREREQUISITES
//   1. ffmpeg on PATH — Puppeteer's page.screencast() will not run at all
//      without it (it drives ffmpeg to produce the webm; not just conversion).
//   2. puppeteer installed (npm i -D puppeteer). This repo currently ships
//      Playwright, which has no page.screencast() equivalent.
//
// Everything this script writes stays under output/. No app code is touched.
//
// Usage:  node scripts/marketing/record-demo.mjs
//         DEMO_BASE_URL=http://localhost:3000 node scripts/marketing/record-demo.mjs

import { spawnSync, spawn } from 'node:child_process';
import { mkdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

// ── Config constants ────────────────────────────────────────────────────────
const WORD = 'eventually';                                   // EN, assumed cached
const DEMO_BASE_URL = process.env.DEMO_BASE_URL ?? 'http://localhost:3000';

const VIEWPORT = { width: 1080, height: 1920, deviceScaleFactor: 1 };

const RAW_PATH = 'output/demo-raw.webm';
const MP4_PATH = 'output/demo.mp4';

// Per-section tour config. `label` values are matched against the SectionLabel
// <p> text (case-insensitive). Zoom scale varies — common errors is the hero.
const TOUR = [
  { key: 'meaning',  labels: ['Meaning in context', 'Meaning'], hold: 4000, scale: 1.30, caption: 'El significado real, en contexto' },
  { key: 'errors',   labels: ['Common errors'],                 hold: 5000, scale: 1.42, caption: 'El error que casi todos cometen' },
  { key: 'etymology',labels: ['Etymology'],                     hold: 4000, scale: 1.30, caption: 'De dónde viene la palabra' },
  { key: 'register', labels: ['Register level', 'Collocations'],hold: 3000, scale: 1.28, caption: 'Registro y colocaciones' },
];

// ── Timeline logging ────────────────────────────────────────────────────────
let t0 = 0;
const stamp = () => {
  const ms = Date.now() - t0;
  const m = String(Math.floor(ms / 60000)).padStart(2, '0');
  const s = (Math.floor(ms / 100) % 600) / 10;
  return `[${m}:${s.toFixed(1).padStart(4, '0')}]`;
};
const beat = (msg) => console.log(`${stamp()} ${msg}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);

// ── Prerequisite: ffmpeg ────────────────────────────────────────────────────
function assertFfmpeg() {
  const probe = spawnSync('ffmpeg', ['-version'], { stdio: 'ignore' });
  if (probe.error || probe.status !== 0) {
    console.error(
      '\n✗ ffmpeg is required but was not found on PATH.\n' +
      '  Puppeteer.page.screencast() drives ffmpeg to write the webm — it will\n' +
      '  not run at all without it. Install ffmpeg and retry:\n' +
      '    Debian/Ubuntu:  sudo apt install ffmpeg\n' +
      '    macOS (brew):   brew install ffmpeg\n'
    );
    process.exit(1);
  }
}

// ── Prerequisite: puppeteer ─────────────────────────────────────────────────
async function loadPuppeteer() {
  try {
    const mod = await import('puppeteer');
    return mod.default ?? mod;
  } catch {
    console.error(
      '\n✗ puppeteer is not installed.\n' +
      '  This script uses Puppeteer\'s native page.screencast(); the repo ships\n' +
      '  Playwright, which has no equivalent. Install puppeteer and retry:\n' +
      '    npm i -D puppeteer\n'
    );
    process.exit(1);
  }
}

// ── In-page effect helpers (injected via page.evaluate) ─────────────────────

// Injected once: registers window.__demo helpers on the page so the caption /
// glow / zoom logic runs in the browser (composited, no reflow).
function installEffectKit() {
  // Playfair Display for captions (falls back to serif if the network is down).
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700;800&display=swap';
  document.head.appendChild(link);

  const BRAND_A = '#3A3D8F';
  const BRAND_B = '#5B5FCF';

  window.__demo = {
    // Absolutely-positioned brand caption in the IG safe zone. A scrim behind
    // the text separates it from the live app so captions never read as
    // "overlaid on content". Fades in/out via opacity only (tolerates dropped
    // frames far better than motion).
    //   scrim: 'none'  → no veil (use over a zoomed card we WANT visible)
    //          'soft'   → light frost
    //          'strong' → near-opaque end-card look (hook / CTA)
    showCaption(text, { hero = false, scrim = 'strong' } = {}) {
      this.hideCaption();
      const scrimBg = { none: 'transparent', soft: 'rgba(250,250,248,0.60)', strong: 'rgba(250,250,248,0.86)' }[scrim] ?? 'transparent';
      const blur = scrim === 'strong' ? 'blur(4px)' : scrim === 'soft' ? 'blur(2px)' : 'none';

      // Full-screen scrim wrapper (covers content behind for legibility).
      const wrap = document.createElement('div');
      wrap.id = '__demo_caption';
      Object.assign(wrap.style, {
        position: 'fixed', left: '0', top: '0', width: '1080px', height: '1920px',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 90px 420px', boxSizing: 'border-box', // bottom pad keeps text in the 1500 safe zone
        zIndex: '2147483647', pointerEvents: 'none',
        background: scrimBg, backdropFilter: blur, WebkitBackdropFilter: blur,
        opacity: '0', transition: 'opacity 400ms ease',
      });

      const el = document.createElement('div');
      el.textContent = text;
      Object.assign(el.style, {
        textAlign: 'center',
        fontFamily: '"Playfair Display", Georgia, serif',
        fontWeight: '800',
        fontSize: hero ? '78px' : '64px', lineHeight: '1.18',
        background: `linear-gradient(135deg, ${BRAND_A}, ${BRAND_B})`,
        WebkitBackgroundClip: 'text', backgroundClip: 'text',
        WebkitTextFillColor: 'transparent', color: 'transparent',
      });
      wrap.appendChild(el);
      document.body.appendChild(wrap);
      // next frame → fade in
      requestAnimationFrame(() => requestAnimationFrame(() => { wrap.style.opacity = '1'; }));
    },
    fadeCaption() {
      const el = document.getElementById('__demo_caption');
      if (el) el.style.opacity = '0';
    },
    hideCaption() {
      const el = document.getElementById('__demo_caption');
      if (el) el.remove();
    },

    // Find the <section> card for a set of candidate SectionLabel texts.
    _findSection(labels) {
      const wanted = labels.map((s) => s.toLowerCase());
      const ps = Array.from(document.querySelectorAll('p'));
      for (const p of ps) {
        const txt = (p.textContent || '').trim().toLowerCase();
        if (wanted.includes(txt)) return p.closest('section') || p.parentElement;
      }
      return null;
    },

    // Temporarily lift overflow:hidden on ancestors so a scaled card is not
    // clipped by the advanced-section wrapper. Returns a restore fn.
    _liftOverflow(el) {
      const touched = [];
      let n = el.parentElement;
      while (n && n !== document.body) {
        const cs = getComputedStyle(n);
        if (cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible') {
          touched.push([n, n.style.overflow]);
          n.style.overflow = 'visible';
        }
        n = n.parentElement;
      }
      return () => touched.forEach(([node, prev]) => { node.style.overflow = prev; });
    },

    scrollToSection(labels) {
      const sec = this._findSection(labels);
      if (!sec) return false;
      sec.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    },

    zoomIn(labels, scale) {
      const sec = this._findSection(labels);
      if (!sec) return false;
      this._restoreOverflow = this._liftOverflow(sec);
      // Glow set INSTANTLY (no box-shadow transition) so the only animated
      // property during the zoom is `transform` — that keeps it on the
      // compositor and avoids per-frame repaints that drop fps.
      sec.style.boxShadow = '0 0 0 3px rgba(91,95,207,.35), 0 0 24px rgba(91,95,207,.25)';
      sec.style.borderRadius = 'inherit';
      // Promote to its own layer so the browser scales the cached texture
      // instead of re-rasterizing the (heavy) card content every frame.
      sec.style.transformOrigin = 'center';
      sec.style.willChange = 'transform';
      sec.style.backfaceVisibility = 'hidden';
      sec.style.transition = 'transform 1.8s cubic-bezier(.22,1,.36,1)';
      sec.style.transform = 'translateZ(0) scale(1)';
      void sec.offsetWidth; // flush so the transition runs from 1.0
      sec.style.transform = `translateZ(0) scale(${scale})`;
      this._zoomed = sec;
      return true;
    },

    zoomOut() {
      const sec = this._zoomed;
      if (!sec) return;
      sec.style.transform = 'translateZ(0) scale(1)';
      const done = () => {
        sec.style.boxShadow = 'none';
        sec.style.willChange = '';
        sec.style.backfaceVisibility = '';
        if (this._restoreOverflow) { this._restoreOverflow(); this._restoreOverflow = null; }
      };
      setTimeout(done, 1900);
      this._zoomed = null;
    },

    // Lower-third subtitle band for the guided tour. Solid brand fill + white
    // text (never a giant transparent word floating over content), positioned
    // below the zoomed card so it can't overlap it. Cheap to paint (no blur).
    showBanner(text) {
      this.hideBanner();
      const b = document.createElement('div');
      b.id = '__demo_banner';
      b.textContent = text;
      Object.assign(b.style, {
        position: 'fixed', left: '50%', top: '1300px', transform: 'translateX(-50%)',
        maxWidth: '900px', padding: '20px 36px', boxSizing: 'border-box',
        background: `linear-gradient(135deg, ${BRAND_A}, ${BRAND_B})`,
        color: '#ffffff', borderRadius: '18px',
        fontFamily: '"Playfair Display", Georgia, serif', fontWeight: '700',
        fontSize: '42px', lineHeight: '1.2', textAlign: 'center',
        boxShadow: '0 12px 44px rgba(58,61,143,.32)',
        zIndex: '2147483646', pointerEvents: 'none',
        opacity: '0', transition: 'opacity 350ms ease',
      });
      document.body.appendChild(b);
      requestAnimationFrame(() => requestAnimationFrame(() => { b.style.opacity = '1'; }));
    },
    fadeBanner() { const b = document.getElementById('__demo_banner'); if (b) b.style.opacity = '0'; },
    hideBanner() { const b = document.getElementById('__demo_banner'); if (b) b.remove(); },
  };
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  assertFfmpeg();
  const puppeteer = await loadPuppeteer();

  const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
  process.chdir(root);
  if (!existsSync('output')) mkdirSync('output', { recursive: true });

  const browser = await puppeteer.launch({
    headless: true,
    defaultViewport: VIEWPORT,
    args: [
      '--no-sandbox', '--force-color-profile=srgb', `--window-size=${VIEWPORT.width},${VIEWPORT.height}`,
      // Keep transform/scale animations on the compositor so screencast fps
      // holds up in headless (software GPU otherwise stutters on the zoom).
      '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-zero-copy',
      '--enable-unsafe-swiftshader',
    ],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORT);

    // Force LIGHT theme before any app code runs (key: localStorage 'theme').
    await page.evaluateOnNewDocument(() => {
      try {
        localStorage.setItem('theme', 'light');
        document.documentElement.setAttribute('data-theme', 'light');
      } catch {}
    });

    console.log(`→ Navigating to ${DEMO_BASE_URL} (word: "${WORD}")`);
    await page.goto(DEMO_BASE_URL, { waitUntil: 'networkidle0', timeout: 60000 });

    // Re-assert light theme post-load and install the effect kit.
    await page.evaluate(() => {
      localStorage.setItem('theme', 'light');
      document.documentElement.setAttribute('data-theme', 'light');
    });
    await page.evaluate(installEffectKit);

    // Full idle load + light theme applied → 1s settle before recording.
    await sleep(1000);

    // ── Start recording ─────────────────────────────────────────────────────
    t0 = Date.now();
    const recorder = await page.screencast({ path: RAW_PATH, fps: 30 });
    beat('recording started');

    // 1. HOOK caption (before typing).
    await page.evaluate(() => window.__demo.showCaption("Esta palabra NO significa 'eventualmente'.", { hero: true }));
    beat('hook caption shown');
    await sleep(1500);
    await page.evaluate(() => window.__demo.fadeCaption());
    await sleep(450);
    await page.evaluate(() => window.__demo.hideCaption());

    // 2. TYPING — the main search input. No stable selector exists: it is the
    //    input whose placeholder starts with "Type " ("Type any word…").
    const inputSel = 'input[type="text"]';
    await page.waitForSelector(inputSel, { timeout: 15000 });
    const inputHandle = await page.evaluateHandle(() => {
      const inputs = Array.from(document.querySelectorAll('input[type="text"]'));
      return inputs.find((i) => (i.placeholder || '').toLowerCase().startsWith('type')) || inputs[0];
    });
    await inputHandle.asElement().click();
    await sleep(800);

    const chars = WORD.split('');
    for (let i = 0; i < chars.length; i++) {
      await page.keyboard.type(chars[i], { delay: 0 });
      await sleep(rand(70, 140));
      if (i === 3) await sleep(rand(250, 400)); // hesitation after 4th char
    }
    beat('typing done');
    await sleep(600);
    await page.keyboard.press('Enter'); // submit (onKeyDown Enter → handleAnalyze)
    beat('submitted');

    // 3. LOADING — wait for the "finished" signal: the advanced toggle button
    //    ("View full analysis") only renders once the full result is mounted.
    await page.waitForFunction(() => {
      return Array.from(document.querySelectorAll('button'))
        .some((b) => /view full analysis|hide full analysis/i.test(b.textContent || ''));
    }, { timeout: 45000 });
    beat('analysis rendered');
    await sleep(600);

    // 4. EXPAND the collapsed advanced block (etymology / common errors /
    //    register live inside it). Only click if currently collapsed.
    const expanded = await page.evaluate(() => {
      const btn = Array.from(document.querySelectorAll('button'))
        .find((b) => /view full analysis/i.test(b.textContent || ''));
      if (btn) { btn.scrollIntoView({ behavior: 'smooth', block: 'center' }); btn.click(); return true; }
      return false; // already expanded
    });
    if (expanded) {
      beat('advanced expanded');
      await sleep(900); // grid expand animation is 500ms + settle
    }

    // 5. GUIDED TOUR.
    for (const sec of TOUR) {
      const found = await page.evaluate((labels) => window.__demo.scrollToSection(labels), sec.labels);
      if (!found) { beat(`⚠ section not found, skipping: ${sec.key}`); continue; }
      await sleep(1200); // let the smooth scroll fully finish before the zoom (no overlap)
      await page.evaluate(({ labels, scale }) => window.__demo.zoomIn(labels, scale), { labels: sec.labels, scale: sec.scale });
      if (sec.caption) {
        await page.evaluate((c) => window.__demo.showBanner(c), sec.caption);
      }
      beat(`zoom: ${sec.key} (scale ${sec.scale})`);
      await sleep(sec.hold);
      await page.evaluate(() => { window.__demo.fadeBanner(); window.__demo.zoomOut(); });
      await sleep(1900); // let zoom-out + fade finish
      await page.evaluate(() => window.__demo.hideBanner());
    }

    // 6. CTA — scroll to top, hold on full result, final caption.
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'smooth' }));
    await sleep(1500);
    beat('CTA');
    await page.evaluate(() => window.__demo.showCaption("¿Tú también creías que significaba 'eventualmente'? 👇"));
    await sleep(2500);
    await page.evaluate(() => window.__demo.fadeCaption());
    await sleep(450);

    // ── Stop recording ───────────────────────────────────────────────────────
    await recorder.stop();
    beat('recording stopped');
  } finally {
    await browser.close();
  }

  // ── Convert to Instagram-compatible MP4 (yuv420p is required) ─────────────
  console.log('→ Converting to MP4…');
  await new Promise((res, rej) => {
    const ff = spawn('ffmpeg', [
      '-y', '-i', RAW_PATH,
      '-c:v', 'libx264', '-crf', '18', '-r', '30', '-pix_fmt', 'yuv420p',
      MP4_PATH,
    ], { stdio: 'inherit' });
    ff.on('close', (code) => (code === 0 ? res() : rej(new Error(`ffmpeg exited ${code}`))));
  });

  console.log(`\n✓ Done → ${MP4_PATH}`);
}

main().catch((err) => {
  console.error('\n✗ Capture failed:', err.message);
  process.exit(1);
});
