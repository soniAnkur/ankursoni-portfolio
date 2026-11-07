/**
 * Entry point for the "night-drive" intro experience.
 * Desktop + capable devices get the 3D intro; everything else (mobile,
 * reduced-motion, no WebGL2) falls straight through to the existing static
 * site, which is the real/fallback site and must keep working untouched.
 *
 * Contracts for the three lazily-imported modules (each is its own file,
 * built independently — do not change these signatures without updating
 * all three):
 *
 *   import initSplash from "./splash/splash.js"
 *     initSplash() -> {
 *       setProgress(fraction: number 0..1, label?: string) -> void
 *       complete() -> Promise<void>   // plays exit animation, resolves when gone, removes its own DOM
 *       el: HTMLElement               // root element it mounted (for z-index/skip-link coordination)
 *     }
 *
 *   import initRace from "./race/engine.js"
 *     initRace({ mount, onProgress, onCheckpoint, onReady }) -> { dispose(): void }
 *       - mount: HTMLElement to render the <canvas> into (fills it, position:fixed handled by caller's CSS)
 *       - onProgress(fraction: number 0..1): called repeatedly while loading assets (geometry/env/audio)
 *       - onCheckpoint(sectionId: "about"|"skills"|"projects"|"contact"): called once per checkpoint crossed
 *       - onReady(): called once when the car is drivable and the scene is visible
 *       - returns an object with dispose() to tear everything down (used by the skip-to-site control)
 *
 *   import initFaq from "./faq/faq.js"
 *     initFaq({ onProgress }) -> { ready: Promise<void> }
 *       - onProgress(fraction: number 0..1): reports embedding-model download progress (0 if already cached)
 *       - mounts its own chat UI near #contact; safe to call lazily, independent of the race module
 *       - must not throw / must not block the page if the model fails to load (catch internally, degrade
 *         to keyword-only matching silently)
 */

const RACE_ROOT_ID = "race-root";

function prefersNoRace() {
  const isNarrow = window.matchMedia("(max-width: 820px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const noWebGL2 = !(() => {
    try {
      const c = document.createElement("canvas");
      return !!(c.getContext("webgl2"));
    } catch {
      return false;
    }
  })();
  return isNarrow || reducedMotion || noWebGL2;
}

function skipToSite(raceHandle, splashHandle) {
  try { raceHandle?.dispose?.(); } catch {}
  const root = document.getElementById(RACE_ROOT_ID);
  if (root) root.remove();
  if (splashHandle && !splashHandle._done) {
    splashHandle.complete?.();
  }
  document.body.classList.remove("race-active");
  document.body.classList.add("race-skipped");
}

async function boot() {
  if (prefersNoRace()) {
    // Fallback site only — do nothing, existing script.js already runs it.
    return;
  }

  const root = document.createElement("div");
  root.id = RACE_ROOT_ID;
  document.body.prepend(root);
  document.body.classList.add("race-active");

  const [{ default: initSplash }, { default: initRace }] = await Promise.all([
    import("./splash/splash.js"),
    import("./race/engine.js"),
  ]);

  const splash = initSplash();

  // Skip-to-site control lives at the main.js level so it always works
  // regardless of which internal module is mid-load.
  const skipBtn = document.createElement("button");
  skipBtn.id = "skip-to-site";
  skipBtn.type = "button";
  skipBtn.textContent = "Skip to site →";
  root.appendChild(skipBtn);

  let raceHandle = null;
  let faqProgress = 0;
  let engineProgress = 0;

  const updateCombinedProgress = () => {
    splash.setProgress((engineProgress + faqProgress) / 2);
  };

  skipBtn.addEventListener("click", () => skipToSite(raceHandle, splash));

  raceHandle = initRace({
    mount: root,
    onProgress(fraction) {
      engineProgress = fraction;
      updateCombinedProgress();
    },
    onCheckpoint(sectionId) {
      // Arriving at a stage no longer yanks the visitor out to the flat
      // HTML page — the race engine itself now shows real content for
      // that stage in-scene (kiosk cards). This hook is kept only for a
      // lightweight visited-stages indicator the engine may render itself;
      // main.js intentionally does nothing further here.
      void sectionId;
    },
    async onReady() {
      await splash.complete();
    },
  });

  // FAQ widget loads independently and never blocks the race from starting;
  // its download progress still feeds the splash bar if splash is still up.
  import("./faq/faq.js")
    .then(({ default: initFaq }) =>
      initFaq({
        onProgress(fraction) {
          faqProgress = fraction;
          updateCombinedProgress();
        },
      })
    )
    .catch(() => {
      /* FAQ widget is a bonus feature — never let it break the page. */
    });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
