import test from "node:test";
import assert from "node:assert/strict";
import { parseChatMessage, shouldSendKey } from "../src/ui/chatMessage.js";

test("chat formatting keeps code literal and separates readable paragraphs and lists", () => {
  const blocks = parseChatMessage("A **reason** with `key`.\n\n- First\n- Second\n\n```ts\n<script>not executable</script>\nconst key = 'ko';\n```");
  assert.deepEqual(blocks.map(block => block.kind), ["paragraph", "list", "code"]);
  assert.deepEqual(blocks[0], {
    kind: "paragraph",
    content: [
      { kind: "text", text: "A " }, { kind: "strong", text: "reason" },
      { kind: "text", text: " with " }, { kind: "code", text: "key" }, { kind: "text", text: "." },
    ],
  });
  assert.deepEqual(blocks[2], { kind: "code", language: "ts", text: "<script>not executable</script>\nconst key = 'ko';" });
});

test("Enter sends but Shift+Enter and Korean IME composition do not", () => {
  const enter = { key: "Enter", shiftKey: false, isComposing: false, keyCode: 13, repeat: false };
  assert.equal(shouldSendKey(enter), true);
  assert.equal(shouldSendKey({ ...enter, shiftKey: true }), false);
  assert.equal(shouldSendKey({ ...enter, isComposing: true }), false);
  assert.equal(shouldSendKey({ ...enter, keyCode: 229 }), false);
  assert.equal(shouldSendKey({ ...enter, repeat: true }), false);
});

test("ordered list starts and unsafe markup remain content rather than executable links", () => {
  const blocks = parseChatMessage("3. Third\n4. Fourth\n\n[run](command:delete) <img src=x onerror=run()>");
  assert.deepEqual(blocks[0], {
    kind: "list", ordered: true, start: 3,
    items: [[{ kind: "text", text: "Third" }], [{ kind: "text", text: "Fourth" }]],
  });
  assert.deepEqual(blocks[1], { kind: "paragraph", content: [{ kind: "text", text: "[run](command:delete) <img src=x onerror=run()>" }] });
});
