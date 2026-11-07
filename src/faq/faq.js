/**
 * "Ask about my portfolio" widget.
 *
 * Genuinely free, client-side-only fuzzy FAQ matcher:
 *  - No server, no paid API calls, nothing leaves the browser.
 *  - Instant keyword/substring matching works the moment this module runs.
 *  - In the background, a tiny quantized sentence-embedding model loads via
 *    transformers.js (resolved through the page's <script type="importmap">)
 *    and upgrades matching to real semantic similarity once ready.
 *  - If transformers.js or the model fails to load for any reason (offline,
 *    CDN blocked, etc.) this silently stays on keyword matching forever —
 *    the widget UI always renders and always answers something.
 *
 * Contract (see src/main.js for the authoritative doc comment):
 *   import initFaq from "./faq/faq.js";
 *   initFaq({ onProgress(fraction) }) -> { ready: Promise<void> }
 *   - Never throws. Fire-and-forget safe (the returned promise is optional).
 */

import { faqData } from "./faq-data.js";

const MODEL_ID = "Xenova/all-MiniLM-L6-v2";
const SIMILARITY_THRESHOLD = 0.45;
const FALLBACK_ANSWER =
  "Not sure about that one — try rephrasing, or check the Projects / About sections above.";

function noop() {}

const STOPWORDS = new Set([
  "a", "an", "the", "is", "are", "was", "were", "be", "been", "being",
  "do", "does", "did", "doing", "has", "have", "had", "having",
  "he", "his", "him", "she", "her", "they", "them", "their", "it", "its",
  "i", "you", "your", "we", "our", "my", "me",
  "what", "when", "where", "who", "whom", "which", "why", "how",
  "to", "of", "in", "on", "at", "for", "with", "about", "as", "by",
  "and", "or", "but", "if", "than", "that", "this", "these", "those",
  "can", "could", "will", "would", "should", "may", "might", "does",
  "any", "some", "there", "so", "just",
]);

function tokenize(text) {
  return (text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/** Zero-delay keyword/substring overlap matcher against the FAQ dataset. */
function keywordMatch(query) {
  const qTokens = tokenize(query).filter((t) => !STOPWORDS.has(t));
  if (!qTokens.length) return null;

  let bestEntry = null;
  let bestScore = 0;

  for (const entry of faqData) {
    const hayTokens = tokenize(`${entry.question} ${entry.answer}`);
    const haySet = new Set(hayTokens);
    let score = 0;
    for (const t of qTokens) {
      if (haySet.has(t)) {
        score += 1;
        continue;
      }
      for (const h of haySet) {
        if (h.length > 3 && (h.includes(t) || t.includes(h))) {
          score += 0.5;
          break;
        }
      }
    }
    score /= qTokens.length;
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore < 0.3) return null;
  return { entry: bestEntry, score: bestScore };
}

function cosineSim(a, b) {
  // Both vectors are L2-normalized by the embedder, so the dot product
  // *is* the cosine similarity.
  let dot = 0;
  for (let i = 0; i < a.length && i < b.length; i++) dot += a[i] * b[i];
  return dot;
}

function clamp01(n) {
  if (typeof n !== "number" || Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/* ---------------------------------------------------------------------- */
/* Widget UI                                                              */
/* ---------------------------------------------------------------------- */

function buildWidget(onAsk) {
  const root = document.createElement("div");
  root.id = "faq-widget-root";
  root.className = "faq-widget";

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "faq-toggle";
  toggle.setAttribute("aria-label", "Ask about this portfolio");
  toggle.innerHTML = '<span class="faq-toggle-icon">✨</span>';

  const panel = document.createElement("div");
  panel.className = "faq-panel";
  panel.hidden = true;

  panel.innerHTML = `
    <div class="faq-panel-header">
      <span class="faq-panel-title">Ask about this portfolio</span>
      <button type="button" class="faq-close" aria-label="Close">✕</button>
    </div>
    <div class="faq-status" data-faq-status>Keyword search ready • loading smarter matching…</div>
    <div class="faq-messages" data-faq-messages></div>
    <form class="faq-form" data-faq-form>
      <input
        type="text"
        class="faq-input"
        placeholder="e.g. What does he do at Amazon?"
        aria-label="Your question"
        autocomplete="off"
      />
      <button type="submit" class="faq-send" aria-label="Send">→</button>
    </form>
  `;

  root.appendChild(panel);
  root.appendChild(toggle);
  document.body.appendChild(root);

  const messagesEl = panel.querySelector("[data-faq-messages]");
  const formEl = panel.querySelector("[data-faq-form]");
  const inputEl = panel.querySelector(".faq-input");
  const statusEl = panel.querySelector("[data-faq-status]");
  const closeBtn = panel.querySelector(".faq-close");

  function addMessage(text, who) {
    const row = document.createElement("div");
    row.className = `faq-msg faq-msg-${who}`;
    row.textContent = text;
    messagesEl.appendChild(row);
    messagesEl.scrollTop = messagesEl.scrollHeight;
    return row;
  }

  addMessage(
    "Hi! Ask me something about Ankur's background or projects.",
    "bot"
  );

  function openPanel() {
    panel.hidden = false;
    toggle.classList.add("faq-toggle-open");
    setTimeout(() => inputEl.focus(), 0);
  }

  function closePanel() {
    panel.hidden = true;
    toggle.classList.remove("faq-toggle-open");
  }

  toggle.addEventListener("click", () => {
    if (panel.hidden) openPanel();
    else closePanel();
  });
  closeBtn.addEventListener("click", closePanel);

  formEl.addEventListener("submit", (e) => {
    e.preventDefault();
    try {
      const q = inputEl.value.trim();
      if (!q) return;
      addMessage(q, "user");
      inputEl.value = "";
      const thinking = addMessage("thinking…", "bot faq-thinking");
      Promise.resolve(onAsk(q))
        .then((answer) => {
          thinking.textContent = answer;
          thinking.classList.remove("faq-thinking");
        })
        .catch(() => {
          thinking.textContent = FALLBACK_ANSWER;
          thinking.classList.remove("faq-thinking");
        });
    } catch {
      // Never let a UI interaction throw out to the page.
    }
  });

  return {
    setStatus(text) {
      try {
        statusEl.textContent = text;
      } catch {}
    },
  };
}

/* ---------------------------------------------------------------------- */
/* Main entry point                                                       */
/* ---------------------------------------------------------------------- */

export default function initFaq(opts) {
  const options = opts || {};
  const onProgress = typeof options.onProgress === "function" ? options.onProgress : noop;

  let resolveReady = noop;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });

  let extractor = null;
  let faqEmbeddings = null;
  let widget = null;

  const reportProgress = (fraction) => {
    try {
      onProgress(clamp01(fraction));
    } catch {
      /* caller's onProgress misbehaving is not our problem */
    }
  };

  async function semanticMatch(query) {
    if (!extractor || !faqEmbeddings) return null;
    try {
      const out = await extractor(query, { pooling: "mean", normalize: true });
      const qVec = Array.from(out.data);
      let bestIdx = -1;
      let bestScore = -1;
      for (let i = 0; i < faqEmbeddings.length; i++) {
        const score = cosineSim(qVec, faqEmbeddings[i]);
        if (score > bestScore) {
          bestScore = score;
          bestIdx = i;
        }
      }
      if (bestIdx === -1 || bestScore < SIMILARITY_THRESHOLD) return null;
      return { entry: faqData[bestIdx], score: bestScore };
    } catch {
      return null;
    }
  }

  async function answerQuery(query) {
    let result = null;
    try {
      result = await semanticMatch(query);
    } catch {
      result = null;
    }
    if (!result) {
      try {
        result = keywordMatch(query);
      } catch {
        result = null;
      }
    }
    return result ? result.entry.answer : FALLBACK_ANSWER;
  }

  try {
    widget = buildWidget(answerQuery);
  } catch {
    // If the DOM/UI fails for any reason, the rest of the page must survive.
    widget = null;
  }

  async function precomputeEmbeddings() {
    const embeddings = [];
    for (const entry of faqData) {
      const out = await extractor(entry.question, { pooling: "mean", normalize: true });
      embeddings.push(Array.from(out.data));
    }
    faqEmbeddings = embeddings;
  }

  async function loadModel() {
    try {
      const mod = await import("@huggingface/transformers");
      const { pipeline } = mod;

      let maxFraction = 0;
      extractor = await pipeline("feature-extraction", MODEL_ID, {
        progress_callback: (data) => {
          try {
            if (!data) return;
            let fraction = 0;
            if (typeof data.progress === "number") {
              fraction = data.progress / 100;
            } else if (data.total) {
              fraction = data.loaded / data.total;
            }
            fraction = clamp01(fraction);
            if (fraction > maxFraction) maxFraction = fraction;
            if (data.status === "ready" || data.status === "done") {
              reportProgress(1);
            } else {
              reportProgress(maxFraction);
            }
          } catch {
            /* ignore malformed progress events */
          }
        },
      });

      // Model may have been fully cached already; make sure we always
      // reach 1 promptly so a splash screen waiting on us doesn't hang.
      reportProgress(1);

      try {
        await precomputeEmbeddings();
        widget?.setStatus("Smart matching ready.");
      } catch {
        faqEmbeddings = null;
        widget?.setStatus("Keyword search ready.");
      }
    } catch {
      // transformers.js failed to load, or the model download failed
      // (offline / CDN blocked / etc). Degrade silently to keyword search.
      extractor = null;
      faqEmbeddings = null;
      reportProgress(1);
      widget?.setStatus("Keyword search ready.");
    } finally {
      resolveReady();
    }
  }

  // Fire-and-forget: never let a rejection here escape to the caller.
  loadModel().catch(noop);

  return { ready };
}
