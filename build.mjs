/**
 * Renders content/site.json into index.html.
 *
 * Build-time rather than client-side on purpose: the site carries JSON-LD,
 * llms.txt and a sitemap, and a page that assembles itself in the browser
 * would serve crawlers an empty shell and waste all of it.
 *
 *   node build.mjs                  # uses content.theme
 *   node build.mjs --theme=warm-dark
 */
import { readFile, writeFile, readdir } from "node:fs/promises";

const site = JSON.parse(await readFile("content/site.json", "utf8"));

const themeArg = process.argv.find((a) => a.startsWith("--theme="));
const theme = themeArg ? themeArg.split("=")[1] : site.theme || "iris-dark";
const ORDER = ["iris-dark", "warm-dark", "technical-light", "pastel", "swiss"];
const found = (await readdir("themes")).filter((f) => f.endsWith(".css")).map((f) => f.replace(/\.css$/, ""));
// Present dark to light rather than however the filesystem lists them.
const themes = [...ORDER.filter((t) => found.includes(t)), ...found.filter((t) => !ORDER.includes(t))];
if (!themes.includes(theme)) {
  console.error(`Unknown theme "${theme}". Available: ${themes.join(", ")}`);
  process.exit(1);
}

// Content is authored as plain text; escape it, then allow a tiny inline
// subset back so copy can carry <strong>, <em>, <code> and links.
const esc = (t = "") =>
  String(t).replace(/&(?!(amp|lt|gt|quot|#\d+);)/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

const rich = (t = "") =>
  esc(t)
    .replace(/&lt;(\/?(?:strong|em|code|span|br))&gt;/g, "<$1>")
    // span and code may carry a class — the copy uses <span class="highlight">
    .replace(/&lt;(span|code) class="([a-z0-9 _-]+)"&gt;/gi, '<$1 class="$2">')
    .replace(/&lt;a href="([^"]+)"([^&]*)&gt;/g, '<a href="$1"$2>')
    .replace(/&lt;\/a&gt;/g, "</a>");

const attr = (t = "") => esc(t).replace(/"/g, "&quot;");
const map = (xs, fn) => (xs || []).map(fn).join("\n");

const icon = {
  arrow: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none"><path d="M4 10H16M16 10L10 4M16 10L10 16" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  external: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>',
  github: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.37 0 0 5.37 0 12c0 5.3 3.438 9.8 8.205 11.387.6.113.82-.26.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.085 1.838 1.237 1.838 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.4 3-.405 1.02.005 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.573C20.565 21.795 24 17.295 24 12c0-6.63-5.37-12-12-12z"/></svg>',
  linkedin: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>',
  mail: '<svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M24 4.5v15c0 .85-.65 1.5-1.5 1.5H21V7.387l-9 6.463-9-6.463V21H1.5C.649 21 0 20.35 0 19.5v-15c0-.425.162-.8.431-1.068C.7 3.16 1.076 3 1.5 3H2l10 7.25L22 3h.5c.425 0 .8.162 1.069.432.27.268.431.643.431 1.068z"/></svg>',
};

const socialIcon = (title = "") =>
  /linkedin/i.test(title) ? icon.linkedin : /github/i.test(title) ? icon.github : icon.mail;

// Swatch = each theme's page colour, so the control previews itself.
const THEME_SWATCH = {
  "iris-dark": "#6e8bff",
  "warm-dark": "#e8b14c",
  "technical-light": "#fcfcfa",
  "pastel": "#e9c2d0",
  "swiss": "#ff3b00",
};
const THEME_LABELS = {
  "iris-dark": "Iris dark",
  "warm-dark": "Warm dark",
  "technical-light": "Technical light",
  "pastel": "Pastel",
  "swiss": "Swiss",
};

/* ------------------------------------------------------------------ */

const head = `<!DOCTYPE html>
<html lang="en"${theme === "iris-dark" ? "" : ` data-site-theme="${attr(theme)}"`}>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(site.meta.title)}</title>
    <meta name="description" content="${attr(site.meta.description)}">
    <meta name="robots" content="${attr(site.meta.robots)}">
    <link rel="canonical" href="${attr(site.meta.url)}">

    <link rel="icon" type="image/svg+xml" href="/favicon.svg">

    <meta property="og:type" content="website">
    <meta property="og:url" content="${attr(site.meta.url)}">
    <meta property="og:title" content="${attr(site.meta.title)}">
    <meta property="og:description" content="${attr(site.meta.description)}">
    <meta property="og:image" content="${attr(site.meta.ogImage)}">
    <meta property="og:site_name" content="${attr(site.meta.siteName)}">

    <meta name="twitter:card" content="summary_large_image">
    <meta name="twitter:title" content="${attr(site.meta.title)}">
    <meta name="twitter:description" content="${attr(site.meta.description)}">
    <meta name="twitter:image" content="${attr(site.meta.ogImage)}">

    <link rel="stylesheet" href="styles.css">
    <link rel="stylesheet" id="themeCss" href="themes/${attr(theme)}.css">
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">

    <script type="application/ld+json">
${JSON.stringify({
  "@context": "https://schema.org",
  "@type": "Person",
  name: site.identity.name,
  url: site.meta.url,
  image: site.meta.ogImage,
  jobTitle: site.identity.jobTitle,
  worksFor: { "@type": "Organization", name: site.identity.employer },
  alumniOf: { "@type": "CollegeOrUniversity", name: "Kurukshetra University" },
  address: {
    "@type": "PostalAddress",
    addressRegion: "California",
    addressLocality: "San Francisco Bay Area",
    addressCountry: "US",
  },
  sameAs: ["https://www.linkedin.com/in/ankursoni948/", "https://github.com/soniAnkur"],
}, null, 4)}
    </script>

    <script src="https://cdn.jsdelivr.net/npm/iconify-icon@2/dist/iconify-icon.min.js" defer></script>
</head>`;

const nav = `
    <nav class="nav">
        <div class="nav-container">
            <a href="#" class="nav-logo">
                <span class="logo-bracket">&lt;</span>
                <span class="logo-text">${esc(site.identity.logo.text)}</span>
                <span class="logo-bracket">/&gt;</span>
            </a>
            <div class="nav-links">
${map(site.nav, (n) => `                <a href="${attr(n.href)}" class="nav-link">${esc(n.label)}</a>`)}
            </div>
            <div class="nav-actions">
                <div class="theme-switch" role="group" aria-label="Colour theme">
${themes.map((t) => `                    <button type="button" class="theme-dot" data-theme-name="${attr(t)}" title="${attr(THEME_LABELS[t] || t)}" aria-label="${attr(THEME_LABELS[t] || t)}"><span style="background:${THEME_SWATCH[t] || "#888"}"></span></button>`).join("\n")}
                </div>
                <button class="nav-toggle" aria-label="Open menu"><span></span><span></span><span></span></button>
            </div>
        </div>
    </nav>`;

const hero = `
    <section class="hero">
        <div class="hero-container">
            <div class="hero-profile">
                <div class="profile-image-wrapper">
                    <div class="profile-ring"></div>
                    <div class="profile-ring-2"></div>
                    <img src="${attr(site.hero.portrait.src)}" alt="${attr(site.hero.portrait.alt)}" class="profile-image">
                </div>
                <div class="status-badge">
                    <span class="status-dot"></span>
                    <span>${esc(site.identity.status)}</span>
                </div>
            </div>
            <div class="hero-content">
                <div class="hero-subtitle">${esc(site.identity.role)}</div>
                <h1 class="hero-title">
                    <span class="glitch" data-text="${attr(site.identity.name.toUpperCase())}">${esc(site.identity.name.toUpperCase())}</span>
                </h1>
                <div class="hero-tagline">
                    <span class="typing-text">${esc(site.identity.tagline)}</span>
                    <span class="cursor">|</span>
                </div>
                <p class="hero-description">${rich(site.identity.intro)}</p>
                <div class="hero-stats">
${map(site.hero.stats, (s) => `                    <div class="stat">
                        <div class="stat-value">${esc(s.value)}</div>
                        <div class="stat-label">${esc(s.label)}</div>
                    </div>`)}
                </div>
                <div class="hero-cta">
${map(site.hero.actions, (a) => `                    <a href="${attr(a.href)}" class="btn btn-${attr(a.style)}">
                        <span>${esc(a.label)}</span>${a.icon ? "\n                        " + icon[a.icon] : ""}
                    </a>`)}
                </div>
                <div class="hero-social">
${map(site.hero.social, (s) => `                    <a href="${attr(s.href)}" target="_blank" class="social-link" title="${attr(s.title)}">${socialIcon(s.title)}</a>`)}
                </div>
                <div class="scroll-indicator"><div class="scroll-text">Scroll</div></div>
            </div>
        </div>
    </section>`;

const sectionHead = (heading) => `            <div class="section-header">
                <h2 class="section-title">${esc(heading)}</h2>
                <div class="section-line"></div>
            </div>`;

const about = `
    <section id="about" class="about">
        <div class="container">
${sectionHead(site.about.heading)}
            <div class="about-grid">
                <div class="about-text">
${map(site.about.body, (p, i) => `                    <p${i === 0 ? ' class="lead"' : ""}>${rich(p)}</p>`)}
                </div>
                <div class="about-info">
                    <h3 class="rail-heading">${esc(site.about.railHeading)}</h3>
                    <ul class="flagship-list">
${map(site.about.flagship, (f) => `                        <li>
                            <a class="flagship" href="${attr(f.href)}" target="_blank" rel="noopener">
                                <span class="flagship-shot" style="background-image:url('${attr(f.image)}')" role="img" aria-label="Screenshot of ${attr(f.name)}"></span>
                                <span class="flagship-body">
                                    <span class="flagship-name">${esc(f.name)}</span>
                                    <span class="flagship-note">${esc(f.note)}</span>
                                </span>
                                <iconify-icon class="flagship-go" icon="lucide:arrow-up-right" aria-hidden="true"></iconify-icon>
                            </a>
                        </li>`)}
                    </ul>
                    <a class="flagship-all" href="${attr(site.about.allLink.href)}">${esc(site.about.allLink.label)}</a>
                </div>
            </div>
        </div>
    </section>`;

const projectCard = (p) => `                <div class="project-card" data-category="${attr(p.category)}">
                    ${p.badge ? `<div class="project-badge">${esc(p.badge)}</div>` : ""}
                    <div class="project-image"${p.image ? ` style="background:url('${attr(p.image)}') center/cover no-repeat" role="img" aria-label="${attr(p.imageAlt)}"` : ""}>
                        <div class="project-overlay"></div>
                        <div class="project-tech">${esc(p.stack)}</div>
                    </div>
                    <div class="project-content">
                        <h3 class="project-title">${esc(p.title)}</h3>
                        ${p.built ? `<div class="project-built">${esc(p.built)}</div>` : ""}
                        <p class="project-description">${rich(p.description)}</p>
                        <div class="project-tags">
${map(p.tags, (t) => `                            <span class="tag">${esc(t)}</span>`)}
                        </div>
                        <div class="project-links">
${map(p.links, (l) => `                            <a href="${attr(l.href)}" target="_blank" rel="noopener noreferrer" class="project-link">${/github/i.test(l.href) ? icon.github : icon.external} ${esc(l.label)}</a>`)}
                        </div>
                    </div>
                </div>`;

const projects = `
    <section id="projects" class="projects">
        <div class="container">
${sectionHead(site.projects.heading)}
            <div class="project-filters">
${map(site.projects.filters, (f, i) => `                <button class="filter-btn${i === 0 ? " active" : ""}" data-filter="${attr(f.id)}">${esc(f.label)}</button>`)}
            </div>
            <div class="projects-rail" role="region" aria-label="Selected projects" tabindex="0">
${map(site.projects.items, projectCard)}
            </div>
        </div>
    </section>`;

const updates = `
    <section id="updates" class="updates">
        <div class="container">
${sectionHead(site.updates.heading)}
            <p class="updates-subtitle">${rich(site.updates.intro)}</p>
            <ul class="feed">
${map(site.updates.items, (u) => `                <li class="feed-item">
                    <iconify-icon class="feed-mark" icon="${attr(u.icon || "simple-icons:linkedin")}" aria-label="LinkedIn"></iconify-icon>
                    <div class="feed-body">
                        <p class="feed-meta">${esc(u.meta).replace(/·/g, "<span>·</span>")}</p>
                        <div class="feed-text">${rich(u.text)}</div>
                        <button class="feed-more" type="button" aria-expanded="false">See more</button>
                        ${u.tags.length ? `<p class="feed-tags">${u.tags.map((t) => `<span>${esc(t)}</span>`).join(" ")}</p>` : ""}
                        <a class="feed-link" href="${attr(u.href)}" target="_blank" rel="noopener">Open on LinkedIn</a>
                    </div>
                </li>`)}
            </ul>
        </div>
    </section>`;

const writing = `
    <section id="blog" class="writing">
        <div class="container">
${sectionHead(site.writing.heading)}
            <p class="writing-line">${rich(site.writing.intro)}</p>
            <ul class="post-list">
${map(site.writing.posts, (p) => `                <li>
                    <a class="post" href="${attr(p.href)}">
                        <img class="post-cover" src="${attr(p.cover)}" alt="${attr(p.coverAlt)}" width="320" height="200" loading="lazy">
                        <span class="post-body">
                            <span class="post-head">
                                <span class="post-title">${esc(p.title)}</span>
                                <span class="post-meta">${esc(p.meta)}</span>
                            </span>
                            <span class="post-note">${rich(p.note)}</span>
                        </span>
                    </a>
                </li>`)}
            </ul>
        </div>
    </section>`;

const contact = `
    <section id="contact" class="contact">
        <div class="container">
${sectionHead(site.contact.heading)}
            <div class="contact-content">
                <div class="contact-text">
                    <h3>${esc(site.contact.lead)}</h3>
                    <p>${rich(site.contact.body)}</p>
                    <dl class="contact-list">
${map(site.contact.details, (d) => `                        <div class="contact-row">
                            <dt>${esc(d.label)}</dt>
                            <dd>${rich(d.value)}</dd>
                        </div>`)}
                    </dl>
                </div>
                <div class="contact-cta">
                    <div class="cta-card">
                        <h4>${esc(site.contact.ctaHeading)}</h4>
                        <ul class="opportunities-list">
${map(site.contact.topics, (t) => `                            <li>${esc(t)}</li>`)}
                        </ul>
                        <p class="cta-note">${rich(site.contact.note)}</p>
                        <a href="${attr(site.contact.cta.href)}" class="btn btn-primary btn-large">
                            <span>${esc(site.contact.cta.label)}</span>
                            ${icon.arrow}
                        </a>
                    </div>
                </div>
            </div>
        </div>
    </section>`;

const footer = `
    <footer class="footer">
        <div class="container">
            <div class="footer-content">
                <div class="footer-brand">
                    <div class="footer-logo">
                        <span class="logo-bracket">&lt;</span>
                        <span class="logo-text">${esc(site.identity.logo.text)}</span>
                        <span class="logo-bracket">/&gt;</span>
                    </div>
                    <p>${esc(site.footer.tagline)}</p>
                </div>
                <div class="footer-links">
${map(site.footer.columns, (c) => `                    <div class="footer-column">
                        <h4>${esc(c.heading)}</h4>
${map(c.links, (l) => `                        <a href="${attr(l.href)}"${/^https?:/.test(l.href) ? ' target="_blank"' : ""}${l.rel ? ` rel="${attr(l.rel)}"` : ""}>${esc(l.label)}</a>`)}
                    </div>`)}
                </div>
            </div>
            <div class="footer-bottom">
                <p>&copy; <span id="copyrightYear">2026</span> ${esc(site.identity.name)}. All rights reserved.</p>
                <p class="footer-stats">
${site.footer.stats.map((t) => `                    <span>${esc(t)}</span>`).join("\n                    <span>•</span>\n")}
                </p>
            </div>
        </div>
    </footer>

    <script>window.__THEMES__ = ${JSON.stringify(themes)}; window.__THEME__ = "${theme}";</script>
    <script src="theme.js"></script>
    <script src="script.js"></script>
    <script src="backdrop.js" defer></script>
</body>
</html>
`;

const html = [
  head,
  '<body>',
  '    <div class="tech-bg">',
  '        <div class="grid-overlay"></div>',
  '        <div class="particles" id="particles"></div>',
  '    </div>',
  nav, hero, about, projects, updates, writing, contact, footer,
].join("\n");

const outArg = process.argv.find((a) => a.startsWith("--out="));
const out = outArg ? outArg.split("=")[1] : "index.html";

await writeFile(out, html);

// The posts are hand-written rather than generated, but the default theme
// belongs to the content layer, so the build owns their stylesheet link and
// bootstrap too. Otherwise someone landing straight on a post gets whichever
// theme was hardcoded there instead of the one site.json asks for.
const bootstrap = `    <script id="themeBootstrap">window.__THEMES__ = ${JSON.stringify(
  themes
)}; window.__THEME__ = "${theme}";</script>`;

const patched = [];
for (const file of (await readdir("writing")).filter((f) => f.endsWith(".html"))) {
  const path = `writing/${file}`;
  const before = await readFile(path, "utf8");

  let src = before.replace(
    /(<link rel="stylesheet" id="themeCss" href="\.\.\/themes\/)[a-z0-9-]+(\.css">)/,
    `$1${theme}$2`
  );

  src = /<script id="themeBootstrap">/.test(src)
    ? src.replace(/[ \t]*<script id="themeBootstrap">[\s\S]*?<\/script>/, bootstrap)
    : src.replace(/([ \t]*<script src="\.\.\/theme\.js"><\/script>)/, `${bootstrap}\n$1`);

  if (src !== before) {
    await writeFile(path, src);
    patched.push(file);
  }
}

console.log(
  `built ${out} · theme "${theme}" · ${site.projects.items.length} projects, ${site.updates.items.length} updates, ${site.writing.posts.length} posts` +
    (patched.length ? `\nrethemed ${patched.length} post(s): ${patched.join(", ")}` : "")
);
