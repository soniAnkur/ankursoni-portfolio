/**
 * Boot-sequence / terminal-ignition splash overlay.
 *
 * Pure DOM + CSS, zero dependencies, zero async work on init — mounts
 * instantly so it can cover the page the moment main.js decides to show
 * the race intro, before the race engine or FAQ model have loaded anything.
 *
 * Contract (see src/main.js header comment for the authoritative version):
 *   initSplash() -> {
 *     setProgress(fraction: number 0..1, label?: string) -> void
 *     complete() -> Promise<void>
 *     el: HTMLElement
 *   }
 */

const FLAVOR_TEXT = [
  "Igniting engine…",
  "Compiling shaders…",
  "Booting AI co-pilot…",
  "Calibrating headlights…",
  "Loading night drive…",
  "Syncing checkpoints…",
];

const FLAVOR_INTERVAL_MS = 1100;
const FLASH_MS = 320;
const LEAVE_MS = 460;

function buildMarkup() {
  const overlay = document.createElement("div");
  overlay.className = "splash-overlay";
  overlay.setAttribute("role", "status");
  overlay.setAttribute("aria-live", "polite");

  overlay.innerHTML = `
    <div class="splash-grid" aria-hidden="true"></div>
    <div class="splash-glow" aria-hidden="true"></div>
    <div class="splash-scanline" aria-hidden="true"></div>
    <div class="splash-panel">
      <div class="splash-wordmark">
        <span class="bracket">&lt;</span><span class="word">ANKUR.SONI</span><span class="bracket">/&gt;</span>
      </div>
      <div class="splash-subtitle">Night Drive — Booting</div>
      <div class="splash-bar-frame">
        <div class="splash-bar-track">
          <div class="splash-bar-fill"></div>
        </div>
        <div class="splash-bar-meta">
          <span class="splash-bar-label">SYSTEM</span>
          <span class="splash-bar-pct">0%</span>
        </div>
      </div>
      <div class="splash-status">Initializing…</div>
    </div>
  `;

  return overlay;
}

export default function initSplash() {
  const el = buildMarkup();
  document.body.appendChild(el);

  const fillEl = el.querySelector(".splash-bar-fill");
  const pctEl = el.querySelector(".splash-bar-pct");
  const statusEl = el.querySelector(".splash-status");

  let lastFraction = -1;
  let lastRenderedText = "";
  let explicitLabel = null;
  let flavorIndex = 0;
  let completePromise = null;

  function renderStatus() {
    const text = explicitLabel != null ? explicitLabel : FLAVOR_TEXT[flavorIndex];
    if (text !== lastRenderedText) {
      statusEl.textContent = text;
      lastRenderedText = text;
    }
  }

  const flavorTimer = window.setInterval(() => {
    if (explicitLabel == null) {
      flavorIndex = (flavorIndex + 1) % FLAVOR_TEXT.length;
      renderStatus();
    }
  }, FLAVOR_INTERVAL_MS);

  renderStatus();

  function setProgress(fraction, label) {
    // Once complete() has started its exit flourish, ignore any further
    // progress updates (e.g. a late onProgress call from the race engine)
    // so they can't interrupt or glitch the exit animation.
    if (el._done) return;

    const clamped = Math.max(0, Math.min(1, Number(fraction) || 0));

    // Avoid redundant DOM writes when called every animation frame with
    // essentially the same value.
    if (Math.abs(clamped - lastFraction) >= 0.001) {
      lastFraction = clamped;
      const pct = Math.round(clamped * 100);
      fillEl.style.width = pct + "%";
      pctEl.textContent = pct + "%";
    }

    if (typeof label === "string" && label.length > 0) {
      explicitLabel = label;
    } else if (label === null) {
      explicitLabel = null;
    }
    renderStatus();
  }

  function complete() {
    if (completePromise) return completePromise;

    el._done = true;
    window.clearInterval(flavorTimer);

    completePromise = new Promise((resolve) => {
      // Snap the bar to 100% with a quick flash flourish.
      pctEl.textContent = "100%";
      lastRenderedText = "ready";
      statusEl.textContent = "Ready.";
      el.classList.add("is-flashing");

      window.setTimeout(() => {
        el.classList.add("is-leaving");

        window.setTimeout(() => {
          el.remove();
          resolve();
        }, LEAVE_MS);
      }, FLASH_MS);
    });

    return completePromise;
  }

  return {
    setProgress,
    complete,
    el,
  };
}
