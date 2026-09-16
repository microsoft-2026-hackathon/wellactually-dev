import test from "node:test";
import assert from "node:assert/strict";
import { MAX_MESSAGE_BYTES, parseViewCommand } from "../src/ui/messages.js";

test("the first question can target an idle chat without starting a separate workflow", () => {
  const value = { type: "message", requestId: "first-question", chatId: "chat-1", text: "What trade-off should I examine?" };
  assert.deepEqual(parseViewCommand(value), value);
  assert.throws(() => parseViewCommand({ type: "start", requestId: "old-start" }), /INVALID_VIEW_COMMAND/);
});

test("every conversation action carries its chat identity, while only readiness is global", () => {
  for (const type of ["newChat", "stopReply", "end", "selectDriver", "disconnectDriver"]) {
    const command = { type, requestId: "r1", chatId: "chat-1" };
    assert.deepEqual(parseViewCommand(command), command);
    assert.throws(() => parseViewCommand({ type, requestId: "r1" }), /INVALID_VIEW_COMMAND/);
    assert.throws(() => parseViewCommand({ ...command, jobId: "old-report" }), /INVALID_VIEW_COMMAND/);
  }
  const ready = { type: "ready", requestId: "r1" };
  assert.deepEqual(parseViewCommand(ready), ready);
  assert.throws(() => parseViewCommand({ ...ready, chatId: "chat-1" }), /INVALID_VIEW_COMMAND/);
});

test("report and language commands are rejected rather than hidden or disabled", () => {
  for (const type of ["generateReport", "cancelReport", "previewReport", "saveReport"]) {
    assert.throws(() => parseViewCommand({ type, requestId: "r1", chatId: "chat-1" }), /INVALID_VIEW_COMMAND/);
  }
  for (const language of ["auto", "en", "ko"]) {
    assert.throws(() => parseViewCommand({ type: "setLanguage", requestId: "r1", language }), /INVALID_VIEW_COMMAND/);
  }
});

test("removed workflows and extra executable or file payloads never cross the view boundary", () => {
  for (const type of ["start", "cancelStart", "verifyConnection", "pause", "resume", "confirmDirective",
    "beginNextIteration", "retryClose", "deleteRetained", "driver.send"]) {
    assert.throws(() => parseViewCommand({ type, requestId: "r1", chatId: "chat-1" }), /INVALID_VIEW_COMMAND/);
  }
  const valid = { type: "message", requestId: "r1", chatId: "chat-1", text: "Question" };
  for (const extra of [{ command: "driver.send" }, { path: "/private/log" }, { html: "<script>run()</script>" }, { script: "run()" }]) {
    assert.throws(() => parseViewCommand({ ...valid, ...extra }), /INVALID_VIEW_COMMAND/);
  }
  for (const value of [null, [], undefined, "message", {}, { ...valid, requestId: "" },
    { ...valid, chatId: "../project" }, { ...valid, requestId: "r".repeat(129) },
    { ...valid, text: {} }, { ...valid, text: 42 }, { ...valid, text: " \n\t" }]) {
    assert.throws(() => parseViewCommand(value), /INVALID_VIEW_COMMAND/);
  }
});

test("questions are bounded by UTF-8 bytes, without normalizing the submitted text", () => {
  const command = { type: "message", requestId: "r1", chatId: "chat-1", text: " \nQuestion\n " };
  assert.deepEqual(parseViewCommand(command), command);
  assert.equal(parseViewCommand({ ...command, text: "a".repeat(MAX_MESSAGE_BYTES) }).type, "message");
  assert.equal(parseViewCommand({ ...command, text: "한".repeat(5461) }).type, "message");
  assert.throws(() => parseViewCommand({ ...command, text: "a".repeat(MAX_MESSAGE_BYTES + 1) }), /INVALID_VIEW_COMMAND/);
  assert.throws(() => parseViewCommand({ ...command, text: "한".repeat(5462) }), /INVALID_VIEW_COMMAND/);
});
