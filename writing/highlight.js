/**
 * ~40 lines of syntax colouring for the code blocks in these posts.
 * Deliberately not a dependency: it only needs JS/TS/JSON, and it works on
 * the already-escaped text of each <code>, so nothing can inject markup.
 *
 * Strings and comments are matched first in a single alternation, so a
 * keyword inside a string is never recoloured.
 */
(function () {
  "use strict";

  const KEYWORDS = /\b(?:import|from|export|default|const|let|var|function|async|await|return|new|if|else|for|of|in|try|catch|throw|class|extends|interface|type|implements|public|private|readonly|void|null|undefined|true|false|this)\b/g;
  const NUMBERS = /\b\d+(?:\.\d+)?\b/g;

  // Strings (all three quote styles) and comments, matched before anything else.
  const SKIP = /("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\/\/[^\n]*|\/\*[\s\S]*?\*\/)/g;

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  function colourPlain(text) {
    return esc(text)
      .replace(KEYWORDS, '<span class="tok-k">$&</span>')
      .replace(NUMBERS, '<span class="tok-n">$&</span>')
      .replace(/\b([A-Za-z_$][\w$]*)(?=\s*\()/g, '<span class="tok-f">$1</span>');
  }

  document.querySelectorAll("pre > code").forEach((code) => {
    const src = code.textContent;
    let out = "";
    let last = 0;
    let m;
    SKIP.lastIndex = 0;
    while ((m = SKIP.exec(src)) !== null) {
      out += colourPlain(src.slice(last, m.index));
      out += m[1]
        ? '<span class="tok-s">' + esc(m[1]) + "</span>"
        : '<span class="tok-c">' + esc(m[2]) + "</span>";
      last = m.index + m[0].length;
    }
    out += colourPlain(src.slice(last));
    code.innerHTML = out;
  });
})();
