// DOM overlay: the real "quest payoff" content card + a small always-visible
// progress indicator. Plain HTML/CSS (styled via race.css against the
// site's shared neon/glass custom properties — see --neon-*/--glass-* in
// styles.css), deliberately NOT 3D-extruded text, so it stays legible.
// Pure view layer: engine.js/quest-state.js decide what/when to show, this
// module only renders it and owns its own DOM teardown.

const STAGE_ORDER = ["about", "skills", "projects", "contact"];
const STAGE_LABELS = { about: "About", skills: "Skills", projects: "Projects", contact: "Contact" };

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function renderCard(card, content) {
  card.textContent = "";
  card.appendChild(el("div", "race-kiosk-card-eyebrow", content.eyebrow || ""));
  card.appendChild(el("h3", "race-kiosk-card-title", content.title || ""));
  if (content.body) card.appendChild(el("p", "race-kiosk-card-body", content.body));

  if (Array.isArray(content.stack) && content.stack.length) {
    const row = el("div", "race-kiosk-card-stack");
    content.stack.forEach((s) => row.appendChild(el("span", "race-kiosk-card-chip", s)));
    card.appendChild(row);
  }

  if (content.url) {
    const link = el("a", "race-kiosk-card-link", "View project →");
    link.href = content.url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    card.appendChild(link);
  }

  if (Array.isArray(content.links)) {
    content.links.forEach((l) => {
      const row = el("div", "race-kiosk-card-row");
      const a = el("a", "race-kiosk-card-link-inline", l.text);
      a.href = l.href;
      if (/^https?:/.test(l.href)) {
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      row.appendChild(a);
      card.appendChild(row);
    });
  }
}

export function createKioskOverlay(mount) {
  const card = el("div", "race-kiosk-card");
  card.setAttribute("aria-hidden", "true");
  mount.appendChild(card);

  const progress = el("div", "race-progress");
  mount.appendChild(progress);

  let lastKey = null;
  let lastProgressSig = null;

  return {
    showCard(key, content) {
      try {
        if (key !== lastKey) {
          renderCard(card, content);
          lastKey = key;
        }
        card.classList.add("is-visible");
        card.setAttribute("aria-hidden", "false");
      } catch {
        /* the overlay is cosmetic — never let a render error break driving */
      }
    },
    hideCard() {
      card.classList.remove("is-visible");
      card.setAttribute("aria-hidden", "true");
      lastKey = null;
    },
    updateProgress(summary) {
      try {
        const sig = JSON.stringify(summary);
        if (sig === lastProgressSig) return;
        lastProgressSig = sig;
        progress.textContent = "";
        STAGE_ORDER.forEach((id, i) => {
          const s = summary[id] || { done: 0, total: 1 };
          const done = s.total > 0 && s.done >= s.total;
          const label =
            id === "projects"
              ? `Projects ${s.done}/${s.total}`
              : `${STAGE_LABELS[id]}${done ? " ✓" : ""}`;
          progress.appendChild(el("span", "race-progress-item" + (done ? " is-done" : ""), label));
          if (i < STAGE_ORDER.length - 1) {
            progress.appendChild(el("span", "race-progress-sep", "·"));
          }
        });
      } catch {
        /* progress indicator is cosmetic */
      }
    },
    dispose() {
      try {
        card.remove();
      } catch {
        /* ignore */
      }
      try {
        progress.remove();
      } catch {
        /* ignore */
      }
    },
  };
}
