/**
 * Theme switching, shared by the homepage and the article pages.
 *
 * Lives in its own file because the posts don't load script.js. The themes
 * directory is derived from the existing link rather than hardcoded, so the
 * same script works from the site root and from /writing/.
 */
(() => {
  "use strict";

  const link = document.getElementById("themeCss");
  if (!link) return;

  // "themes/iris-dark.css" at the root, "../themes/iris-dark.css" in /writing/
  const base = (link.getAttribute("href") || "").replace(/[^/]+$/, "");

  const known = window.__THEMES__ || [
    "iris-dark",
    "warm-dark",
    "technical-light",
    "pastel",
    "swiss",
  ];
  const fallback = window.__THEME__ || known[0];

  let saved = null;
  try {
    saved = localStorage.getItem("theme");
  } catch {}

  // The previous toggle stored "apple"/"vibrant" under the same key.
  const start = known.includes(saved) ? saved : fallback;

  const buttons = [...document.querySelectorAll(".theme-dot")];

  const apply = (name, persist) => {
    link.setAttribute("href", base + name + ".css");
    document.documentElement.dataset.siteTheme = name;
    buttons.forEach((b) => {
      const on = b.dataset.themeName === name;
      b.classList.toggle("is-active", on);
      b.setAttribute("aria-pressed", String(on));
    });
    if (persist) {
      try {
        localStorage.setItem("theme", name);
      } catch {}
    }
  };

  apply(start, false);
  buttons.forEach((b) =>
    b.addEventListener("click", () => apply(b.dataset.themeName, true))
  );

  // Keep tabs in sync when the choice changes in another one.
  window.addEventListener("storage", (e) => {
    if (e.key === "theme" && known.includes(e.newValue)) apply(e.newValue, false);
  });
})();
