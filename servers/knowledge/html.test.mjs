import assert from "node:assert/strict";
import test from "node:test";
import { renderArticleHtml } from "./html.mjs";

function render(markdown) {
  return renderArticleHtml({ title: "Article", date: "2026-09-18", tags: [], markdown }).split("</style>")[1];
}

test("renders the documented Markdown subset used by compiled articles", () => {
  const body = render([
    "## Cache invalidation",
    "",
    "A **bounded** decision with `code` and *doubt*.",
    "",
    "- first item",
    "- second item",
    "",
    "1. step one",
    "2. step two",
    "",
    "> A quoted constraint.",
    "",
    "| Option | Cost |",
    "| --- | --- |",
    "| Cache | Staleness |",
    "",
    "```js",
    "const x = 1 < 2;",
    "```",
    "",
    "---",
  ].join("\n"));
  assert.match(body, /<h3>Cache invalidation<\/h3>/);
  assert.match(body, /<strong>bounded<\/strong>/);
  assert.match(body, /<code>code<\/code>/);
  assert.match(body, /<em>doubt<\/em>/);
  assert.match(body, /<ul><li>first item<\/li><li>second item<\/li><\/ul>/);
  assert.match(body, /<ol><li>step one<\/li><li>step two<\/li><\/ol>/);
  assert.match(body, /<blockquote><p>A quoted constraint\.<\/p><\/blockquote>/);
  assert.match(body, /<th>Option<\/th><th>Cost<\/th>/);
  assert.match(body, /<td>Cache<\/td><td>Staleness<\/td>/);
  assert.match(body, /<pre><code class="language-js">const x = 1 &lt; 2;<\/code><\/pre>/);
  assert.match(body, /<hr \/>/);
});

test("keeps safe links and neutralises unsafe or malformed ones", () => {
  assert.match(render("[docs](https://example.com/a)"), /<a href="https:\/\/example\.com\/a" rel="noopener noreferrer">docs<\/a>/);
  assert.match(render("[local](./notes.md)"), /<a href="\.\/notes\.md"/);
  for (const markdown of ["[x](javascript:alert(1))", "[x](data:text/html,<script>)", "[x](vbscript:msgbox)"]) {
    assert.doesNotMatch(render(markdown), /<a /);
  }
});

test("drops a leading heading that repeats the article title", () => {
  const repeated = renderArticleHtml({ title: "Article", date: "2026-09-18", tags: [], markdown: "# article\n\nBody." });
  assert.equal(repeated.match(/Article/g).length, 2);
  assert.doesNotMatch(repeated, /<h2>/);
  const different = renderArticleHtml({ title: "Article", date: "2026-09-18", tags: [], markdown: "# Other\n\nBody." });
  assert.match(different, /<h2>Other<\/h2>/);
});

test("is deterministic and always produces a complete standalone document", () => {
  const input = { title: "Same", date: "2026-09-18", tags: ["a"], markdown: "Body." };
  assert.equal(renderArticleHtml(input), renderArticleHtml(input));
  const html = renderArticleHtml(input);
  assert.match(html, /^<!doctype html>/);
  assert.match(html, /<meta name="viewport"/);
  assert.match(html, /<\/html>\n$/);
  assert.doesNotMatch(html, /https?:\/\//);
});
