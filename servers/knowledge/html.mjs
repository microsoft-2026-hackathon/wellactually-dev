const STYLE = `:root{--ink:#18262a;--ink-soft:#4c5b5f;--paper:#f7f9f7;--surface:#fff;--line:#ced8d5;--teal:#176b68;--teal-deep:#0f4c4a;--wash:#e8f1ef;--code:#132d31;--content:44rem}
*{box-sizing:border-box}
body{margin:0;color:var(--ink);background:var(--paper);font-family:-apple-system,BlinkMacSystemFont,"Segoe UI","Apple SD Gothic Neo","Noto Sans KR",sans-serif;font-size:17px;line-height:1.75;word-break:keep-all}
main{max-width:var(--content);margin:0 auto;padding:3rem 1.25rem 5rem}
header{border-bottom:1px solid var(--line);padding-bottom:1.5rem;margin-bottom:2.5rem}
h1{font-size:2rem;line-height:1.3;margin:0 0 .75rem}
h2{font-size:1.4rem;margin:2.75rem 0 .75rem;padding-top:.5rem;border-top:1px solid var(--line)}
h3{font-size:1.15rem;margin:2rem 0 .5rem}
h4,h5,h6{font-size:1rem;margin:1.5rem 0 .5rem}
.meta{color:var(--ink-soft);font-size:.9rem;display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}
.tag{background:var(--wash);color:var(--teal-deep);border-radius:999px;padding:.1rem .6rem;font-size:.8rem}
p,ul,ol,blockquote,pre,table{margin:0 0 1.1rem}
ul,ol{padding-left:1.4rem}
li{margin:.3rem 0}
a{color:var(--teal-deep);text-underline-offset:3px}
a:hover{color:var(--teal)}
blockquote{border-left:3px solid var(--teal);background:var(--surface);color:var(--ink-soft);padding:.6rem 1rem;margin-left:0}
code{font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:.9em;background:var(--wash);border-radius:4px;padding:.1rem .35rem}
pre{background:var(--code);color:#e8f1ef;border-radius:8px;padding:1rem 1.15rem;overflow-x:auto}
pre code{background:none;padding:0;color:inherit}
hr{border:0;border-top:1px solid var(--line);margin:2.5rem 0}
table{border-collapse:collapse;width:100%;font-size:.95rem;display:block;overflow-x:auto}
th,td{border:1px solid var(--line);padding:.5rem .7rem;text-align:left;vertical-align:top}
th{background:var(--wash)}
footer{margin-top:3rem;padding-top:1rem;border-top:1px solid var(--line);color:var(--ink-soft);font-size:.85rem}
@media print{body{background:#fff}main{padding:0}}`;

function escapeText(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[character]));
}

function safeUrl(url) {
  const trimmed = url.trim();
  if (/^(https?:\/\/|mailto:|#|\.{0,2}\/)/i.test(trimmed) && !/[\s<>"']/.test(trimmed)) return escapeText(trimmed);
  return undefined;
}

function renderInline(text) {
  let output = "";
  let rest = text;
  while (rest) {
    const code = rest.match(/^(`+)([\s\S]*?)\1/);
    if (code) {
      output += `<code>${escapeText(code[2].trim())}</code>`;
      rest = rest.slice(code[0].length);
      continue;
    }
    const link = rest.match(/^(!?)\[([^\]]*)\]\(([^()\s]*)\)/);
    if (link) {
      const href = safeUrl(link[3]);
      const label = renderInline(link[2]);
      output += href && !link[1]
        ? `<a href="${href}" rel="noopener noreferrer">${label || href}</a>`
        : escapeText(link[0]);
      rest = rest.slice(link[0].length);
      continue;
    }
    const strong = rest.match(/^(\*\*|__)(?=\S)([\s\S]*?\S)\1/);
    if (strong) {
      output += `<strong>${renderInline(strong[2])}</strong>`;
      rest = rest.slice(strong[0].length);
      continue;
    }
    const emphasis = rest.match(/^(\*|_)(?=\S)([\s\S]*?\S)\1/);
    if (emphasis) {
      output += `<em>${renderInline(emphasis[2])}</em>`;
      rest = rest.slice(emphasis[0].length);
      continue;
    }
    output += escapeText(rest[0]);
    rest = rest.slice(1);
  }
  return output;
}

function renderRow(line) {
  return line.replace(/^\|/, "").replace(/\|$/, "").split("|").map((cell) => cell.trim());
}

function renderBlocks(markdown) {
  const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
  const blocks = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index];
    if (!line.trim()) { index += 1; continue; }

    const fence = line.match(/^(```|~~~)\s*([A-Za-z0-9+#-]*)\s*$/);
    if (fence) {
      const body = [];
      index += 1;
      while (index < lines.length && !lines[index].startsWith(fence[1])) body.push(lines[index++]);
      index += 1;
      const language = fence[2] ? ` class="language-${escapeText(fence[2])}"` : "";
      blocks.push(`<pre><code${language}>${escapeText(body.join("\n"))}</code></pre>`);
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      const level = Math.min(heading[1].length + 1, 6);
      blocks.push(`<h${level}>${renderInline(heading[2].trim())}</h${level}>`);
      index += 1;
      continue;
    }

    if (/^\s{0,3}(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
      blocks.push("<hr />");
      index += 1;
      continue;
    }

    if (/^\s{0,3}>/.test(line)) {
      const body = [];
      while (index < lines.length && /^\s{0,3}>/.test(lines[index])) {
        body.push(lines[index++].replace(/^\s{0,3}>\s?/, ""));
      }
      blocks.push(`<blockquote>${renderBlocks(body.join("\n"))}</blockquote>`);
      continue;
    }

    if (/^\s{0,3}\|.*\|\s*$/.test(line) && /^\s{0,3}\|[\s:|-]+\|\s*$/.test(lines[index + 1] ?? "")) {
      const head = renderRow(line.trim());
      index += 2;
      const body = [];
      while (index < lines.length && /^\s{0,3}\|.*\|\s*$/.test(lines[index])) {
        body.push(renderRow(lines[index++].trim()));
      }
      const headHtml = head.map((cell) => `<th>${renderInline(cell)}</th>`).join("");
      const bodyHtml = body
        .map((row) => `<tr>${row.map((cell) => `<td>${renderInline(cell)}</td>`).join("")}</tr>`)
        .join("");
      blocks.push(`<table><thead><tr>${headHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`);
      continue;
    }

    const bullet = line.match(/^\s{0,3}([-*+]|\d{1,9}[.)])\s+/);
    if (bullet) {
      const ordered = /\d/.test(bullet[1]);
      const items = [];
      while (index < lines.length) {
        const item = lines[index].match(/^\s{0,3}([-*+]|\d{1,9}[.)])\s+(.*)$/);
        if (!item || /\d/.test(item[1]) !== ordered) break;
        const body = [item[2]];
        index += 1;
        while (index < lines.length && /^\s{2,}\S/.test(lines[index])) {
          body.push(lines[index++].replace(/^\s{2,}/, ""));
        }
        items.push(`<li>${body.map((part) => renderInline(part)).join(" ")}</li>`);
      }
      const tag = ordered ? "ol" : "ul";
      blocks.push(`<${tag}>${items.join("")}</${tag}>`);
      continue;
    }

    const paragraph = [];
    while (index < lines.length && lines[index].trim()
      && !/^(#{1,6}\s|```|~~~|\s{0,3}>)/.test(lines[index])
      && !/^\s{0,3}([-*+]|\d{1,9}[.)])\s+/.test(lines[index])) {
      paragraph.push(lines[index++].trim());
    }
    if (!paragraph.length) { index += 1; continue; }
    blocks.push(`<p>${paragraph.map((part) => renderInline(part)).join("<br />")}</p>`);
  }
  return blocks.join("\n");
}

function withoutDuplicateTitle(markdown, title) {
  const leading = markdown.match(/^#\s+(.*)(\n|$)/);
  if (leading && leading[1].trim().toLowerCase() === title.trim().toLowerCase()) {
    return markdown.slice(leading[0].length).trimStart();
  }
  return markdown;
}

export function renderArticleHtml({ title, date, tags, markdown }) {
  const heading = escapeText(title);
  const tagList = tags.map((tag) => `<span class="tag">${escapeText(tag)}</span>`).join("");
  const body = renderBlocks(withoutDuplicateTitle(markdown.trim(), title));
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="generator" content="wellactually-knowledge" />
    <title>${heading}</title>
    <style>
${STYLE}
    </style>
  </head>
  <body>
    <main>
      <header>
        <h1>${heading}</h1>
        <p class="meta"><time datetime="${escapeText(date)}">${escapeText(date)}</time>${tagList}</p>
      </header>
${body}
      <footer>Generated from the Markdown article by Wellactually Knowledge. Edit the Markdown file and save again to produce an updated copy.</footer>
    </main>
  </body>
</html>
`;
}
