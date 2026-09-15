import test from "node:test";
import assert from "node:assert/strict";
import type { CoachRuntime } from "../src/contracts.js";
import { createChat } from "../src/pairing/chat.js";

test("the first question starts one Pair and subsequent questions reuse its context", async () => {
  let starts = 0;
  const prompts: string[] = [];
  const runtime: CoachRuntime = {
    sessionId: "coach",
    async *stream(prompt) { prompts.push(prompt); yield { kind: "text", text: "A useful explanation." }; },
    async setDriver() {}, async cancel() {}, async close() {},
  };
  const chat = createChat({
    async createRuntime() { starts++; return runtime; },
    publish() {}, emit() {},
  });
  assert.equal(starts, 0);
  await chat.submit("Should descriptions be cached?");
  await chat.submit("What about language?");
  assert.equal(starts, 1);
  assert.equal(prompts.length, 2);
  assert.match(prompts[0]!, /Respond in Korean/);
  assert.doesNotMatch(prompts[1]!, /Should descriptions be cached/);
  assert.deepEqual(chat.getState().messages.map(message => message.role), ["user", "assistant", "user", "assistant"]);
  await chat.end();
});

test("stopping during startup never sends the question and ending closes the eventual runtime", async () => {
  let ready!: (runtime: CoachRuntime) => void;
  let sent = 0;
  let closed = 0;
  const created = new Promise<CoachRuntime>(resolve => { ready = resolve; });
  const chat = createChat({
    createRuntime: () => created, publish() {}, emit() {},
  });
  const pending = chat.submit("Do not send after stop");
  await Promise.resolve();
  const ending = chat.end();
  assert.equal(chat.getState().status, "ended");
  ready({
    sessionId: "coach", async *stream() { sent++; },
    async setDriver() {}, async cancel() {}, async close() { closed++; },
  });
  await ending;
  await pending;
  assert.equal(sent, 0);
  assert.equal(closed, 1);
  assert.equal(chat.getState().messages.length, 1);
  await assert.rejects(chat.submit("Too late"), /CHAT_ENDED/);
});

test("a partial reply is retained, late text is excluded, and every question requests Korean", async () => {
  let release!: () => void;
  const pending = new Promise<void>(resolve => { release = resolve; });
  const prompts: string[] = [];
  const runtime: CoachRuntime = {
    sessionId: "coach",
    async *stream(prompt) {
      prompts.push(prompt);
      yield { kind: "text", text: "First part" };
      await pending;
      yield { kind: "text", text: "Late part" };
    },
    async setDriver() {}, async cancel() { release(); }, async close() {},
  };
  const chat = createChat({ async createRuntime() { return runtime; }, publish() {}, emit() {} });
  const request = chat.submit("Question");
  await new Promise(resolve => setImmediate(resolve));
  await assert.rejects(chat.submit("Concurrent"), /CHAT_BUSY/);
  await chat.stop();
  await request;
  assert.match(prompts[0]!, /Respond in Korean/);
  assert.equal(chat.getState().messages.at(-1)?.text, "First part");
  assert.equal(chat.getState().messages.at(-1)?.partial, true);
  await chat.submit("Next");
  assert.match(prompts[1]!, /Respond in Korean/);
  await chat.end();
  const state = chat.getState();
  state.messages[0]!.text = "Changed copy";
  assert.equal(chat.getState().messages[0]!.text, "Question");
});

test("runtime and cleanup failures stay visible and retrying end can finish cleanup", async () => {
  let closes = 0;
  const runtime: CoachRuntime = {
    sessionId: "coach", async *stream() { throw new Error("MODEL_FAILED"); },
    async setDriver() {}, async cancel() {},
    async close() { if (++closes === 1) throw new Error("CLEANUP_FAILED"); },
  };
  const chat = createChat({ async createRuntime() { return runtime; }, publish() {}, emit() {} });
  await assert.rejects(chat.submit("Question"), /MODEL_FAILED/);
  assert.equal(chat.getState().status, "idle");
  await assert.rejects(chat.end(), /CLEANUP_FAILED/);
  await chat.end();
  assert.equal(closes, 2);
});

test("connecting or disconnecting a Driver never sends an automatic message", async () => {
  let sends = 0;
  const selections: (string | null)[] = [];
  const runtime: CoachRuntime = {
    sessionId: "coach", async *stream() { sends++; yield { kind: "text", text: "Ready." }; },
    async setDriver(driver) { selections.push(driver?.sessionId ?? null); },
    async cancel() {}, async close() {},
  };
  const chat = createChat({ async createRuntime() { return runtime; }, publish() {}, emit() {} });
  await chat.submit("Hello");
  await chat.setDriver({ directory: "/selected/driver", sessionId: "driver", title: "Selected session" });
  await chat.setDriver(null);
  assert.deepEqual(selections, ["driver", null]);
  assert.equal(sends, 1);
  await assert.rejects(chat.setDriver({ directory: "/selected/coach", sessionId: "coach", title: "Pair" }), /SELF_BINDING/);
  await chat.end();
});

test("a pending Driver permission update cannot overlap a question or owned shutdown", async () => {
  let release!: () => void;
  const changed = new Promise<void>(resolve => { release = resolve; });
  const order: string[] = [];
  const runtime: CoachRuntime = {
    sessionId: "coach", async *stream() { yield { kind: "text", text: "Hello" }; },
    async setDriver() { await changed; order.push("changed"); },
    async cancel() {}, async close() { order.push("closed"); },
  };
  const chat = createChat({ async createRuntime() { return runtime; }, publish() {}, emit() {} });
  await chat.submit("Hello");
  const updating = chat.setDriver({ directory: "/selected/driver", sessionId: "driver", title: "Selected session" });
  await assert.rejects(chat.submit("During change"), /CHAT_BUSY/);
  const ending = chat.end();
  assert.deepEqual(order, []);
  release();
  await updating;
  await ending;
  assert.deepEqual(order, ["changed", "closed"]);
});

test("stopping startup propagates cancellation before a delayed authentication callback", async () => {
  let release!: () => void;
  const delayed = new Promise<void>(resolve => { release = resolve; });
  let wouldPrompt = false;
  const chat = createChat({
    async createRuntime(signal) {
      await delayed;
      if (!signal.aborted) wouldPrompt = true;
      throw new Error("COACH_AUTH_REQUIRED");
    },
    publish() {}, emit() {},
  });
  const submitted = chat.submit("Question");
  await Promise.resolve();
  const stopping = chat.stop();
  release();
  await stopping;
  await submitted;
  assert.equal(wouldPrompt, false);
  await chat.end();
});
