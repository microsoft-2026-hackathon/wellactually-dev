import test from "node:test";
import assert from "node:assert/strict";
import type { SessionEvent } from "@github/copilot-sdk";
import { attachCoachRuntime, type RuntimeSession } from "../src/runtime/coachRuntime.js";
import { createReadPolicy } from "../src/runtime/readPolicy.js";
import { createChat } from "../src/pairing/chat.js";
import { parseChatMessage } from "../src/ui/chatMessage.js";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

class FakeSession implements RuntimeSession {
  sessionId = "own-coach-session";
  listeners = new Set<(event: SessionEvent) => void>();
  prompts: string[] = [];
  aborted = 0;
  disconnected = 0;
  onSend: () => void = () => {};
  onAbort: () => void = () => {};
  on(handler: (event: SessionEvent) => void): () => void {
    this.listeners.add(handler);
    return () => { this.listeners.delete(handler); };
  }
  async send({ prompt }: { prompt: string }): Promise<string> { this.prompts.push(prompt); this.onSend(); return "message"; }
  async abort(): Promise<void> { this.aborted++; this.onAbort(); }
  async disconnect(): Promise<void> { this.disconnected++; }
  emit(type: string, data: unknown): void {
    const event = { id: `event-${type}`, timestamp: new Date().toISOString(), parentId: null, type, data } as SessionEvent;
    for (const listener of this.listeners) listener(event);
  }
  finish(text = "Observed.") {
    this.emit("assistant.message", { messageId: "message", content: text });
    this.emit("assistant.turn_end", { turnId: "turn" });
    this.emit("session.idle", {});
  }
}

test("one Pair streams text and bounded source excerpts without replaying its final text", async () => {
  const session = new FakeSession();
  const root = path.resolve("test/fixtures/workspace");
  let cleanup = 0;
  const runtime = attachCoachRuntime(session, await createReadPolicy(root), async () => { cleanup++; });
  const iterator = runtime.stream("Explain the key", new AbortController().signal)[Symbol.asyncIterator]();
  const first = iterator.next();
  session.emit("assistant.message_delta", { messageId: "message", deltaContent: "First" });
  assert.deepEqual((await first).value, { kind: "text", text: "First" });
  session.emit("assistant.reasoning_delta", { deltaContent: "DO_NOT_EXPOSE_REASONING" });
  session.emit("tool.execution_start", { toolCallId: "read-1", toolName: "view", arguments: { path: path.join(root, "catalog.ts") } });
  session.emit("tool.execution_complete", { toolCallId: "read-1", success: true, result: { content: "가🙂".repeat(5_000) } });
  session.finish("First");
  const rest = [];
  for (;;) { const next = await iterator.next(); if (next.done) break; rest.push(next.value); }
  assert.equal(rest.filter(delta => delta.kind === "text").length, 0);
  const source = rest.find(delta => delta.kind === "source");
  assert.equal(source?.kind, "source");
  if (source?.kind === "source") {
    assert.equal(source.message.role, "tool");
    assert.match(source.message.source!, /catalog\.ts/);
    assert.equal(source.message.partial, true);
    assert.ok(Buffer.byteLength(source.message.text) <= 12_000);
    assert.equal(source.message.text.includes("\uFFFD"), false);
  }
  assert.equal(session.listeners.size, 0);
  await runtime.close();
  assert.equal(cleanup, 1);
});

test("grep provenance names the actual Driver operands for both single and multiple paths", async () => {
  const directory = await mkdtemp(path.resolve(".source-provenance-"));
  try {
    const root = path.join(directory, "project");
    const driver = path.join(directory, "driver");
    await mkdir(root);
    await mkdir(driver);
    const log = path.join(driver, "events.jsonl");
    const artifact = path.join(driver, "artifact.md");
    await writeFile(log, "{}");
    await writeFile(artifact, "Synthetic artifact");
    const policy = await createReadPolicy(root);
    await policy.setDriver({ directory: driver, sessionId: "driver", title: "Driver" });
    for (const paths of [[log], [log, artifact]]) {
      const session = new FakeSession();
      session.onSend = () => {
        session.emit("tool.execution_start", {
          toolCallId: "search", toolName: "grep", arguments: { pattern: ".", paths },
        });
        session.emit("tool.execution_complete", {
          toolCallId: "search", success: true, result: { content: "Synthetic search result" },
        });
        session.finish();
      };
      const runtime = attachCoachRuntime(session, policy, async () => {});
      try {
        const sources: string[] = [];
        for await (const delta of runtime.stream("Review the Driver", new AbortController().signal)) {
          if (delta.kind === "source") {
            sources.push(delta.message.source!);
            assert.equal(delta.message.partial, true);
          }
        }
        assert.deepEqual(sources, [`grep: ${paths.map(file => pathToFileURL(file).href).join(", ")}`]);
      } finally { await runtime.close(); }
    }
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("fatal cancellation ends the chat and verified client shutdown permits fresh-chat cleanup", async () => {
  const session = new FakeSession();
  let stops = 0;
  session.onSend = () => session.emit("assistant.message_delta", { messageId: "partial", deltaContent: "Partial" });
  session.onAbort = () => { throw new Error("Synthetic abort failure"); };
  session.disconnect = async () => {
    session.disconnected++;
    if (stops) throw new Error("RPC is unavailable after client shutdown");
  };
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")),
    async () => { stops++; });
  const chat = createChat({ async createRuntime() { return runtime; }, publish() {}, emit() {} });
  const request = chat.submit("First message");
  try {
    await new Promise(resolve => setImmediate(resolve));
    await assert.rejects(chat.stop(), /COACH_SETTLE_FAILED/);
    await request;
    assert.equal(chat.getState().status, "ended");
    assert.equal(chat.getState().messages.at(-1)?.partial, true);
    await assert.rejects(chat.submit("Do not reuse the closed runtime"), /CHAT_ENDED/);
    await chat.end();
    assert.equal(session.disconnected, 0);
    assert.equal(stops, 1);
  } finally {
    if (!stops) await runtime.close();
  }
});

test("distinct assistant messages stay separate in live text and the saved reply across tool turns", async () => {
  const session = new FakeSession();
  const root = path.resolve("test/fixtures/workspace");
  const runtime = attachCoachRuntime(session, await createReadPolicy(root), async () => {});
  const chunks: string[] = [];
  const expected = "프로젝트 구조를 먼저 살펴보겠습니다.\n\n관련 문서를 확인합니다.\n\n이해했습니다.";
  session.onSend = () => {
    session.emit("assistant.message_delta", { messageId: "inspect", deltaContent: "프로젝트 구조를 " });
    session.emit("assistant.message_delta", { messageId: "inspect", deltaContent: "먼저 살펴보겠습니다." });
    session.emit("assistant.message", { messageId: "inspect", content: "프로젝트 구조를 먼저 살펴보겠습니다." });
    session.emit("assistant.turn_end", { turnId: "inspection" });
    session.emit("tool.execution_start", { toolCallId: "read", toolName: "view", arguments: { path: root } });
    session.emit("tool.execution_complete", { toolCallId: "read", success: true, result: { content: "catalog.ts" } });
    session.emit("assistant.message", { messageId: "read", content: "관련 문서를 확인합니다." });
    session.emit("assistant.turn_end", { turnId: "reading" });
    session.emit("assistant.message_delta", { messageId: "answer", deltaContent: "" });
    session.emit("assistant.message_delta", { messageId: "answer", deltaContent: "이해했" });
    session.emit("assistant.message_delta", { messageId: "answer", deltaContent: "습니다." });
    session.emit("assistant.message", { messageId: "answer", content: "이해했습니다." });
    session.emit("assistant.turn_end", { turnId: "answering" });
    session.emit("session.idle", {});
  };
  const chat = createChat({
    async createRuntime() { return runtime; },
    publish() {},
    emit(_requestId, event) {
      if (typeof event === "object" && event.kind === "text") chunks.push(event.text);
    },
  });
  try {
    for (const question of ["First question", "Follow-up question"]) {
      chunks.length = 0;
      await chat.submit(question);
      assert.equal(chunks.join(""), expected);
      assert.equal(chat.getState().messages.at(-1)?.text, expected);
      assert.deepEqual(parseChatMessage(chunks.join("")).map(block => block.kind),
        ["paragraph", "paragraph", "paragraph"]);
    }
  } finally { await chat.end(); }
});

test("final-only messages get one boundary each without duplicate finals or late repeated deltas", async () => {
  const session = new FakeSession();
  session.onSend = () => {
    session.emit("assistant.message_delta", { messageId: "empty", deltaContent: "" });
    session.emit("assistant.message", { messageId: "first", content: "First." });
    session.emit("assistant.message", { messageId: "first", content: "First." });
    session.emit("assistant.message_delta", { messageId: "first", deltaContent: "First." });
    session.emit("assistant.message", { messageId: "empty", content: "" });
    session.emit("assistant.message", { messageId: "nested", content: "Not visible.", parentToolCallId: "parent" });
    session.emit("assistant.message", { messageId: "second", content: "Second." });
    session.emit("assistant.message", { messageId: "second", content: "Second." });
    session.emit("assistant.turn_end", { turnId: "final" });
    session.emit("session.idle", {});
  };
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {});
  try {
    let result = "";
    for await (const delta of runtime.stream("Question", new AbortController().signal)) {
      if (delta.kind === "text") result += delta.text;
    }
    assert.equal(result, "First.\n\nSecond.");
  } finally { await runtime.close(); }
});

test("changing Driver preserves the same SDK conversation and affects only the next requested turn", async () => {
  const directory = await mkdtemp(path.resolve(".coach-driver-"));
  try {
    const root = path.join(directory, "project");
    const first = path.join(directory, "driver-one");
    const second = path.join(directory, "driver-two");
    await mkdir(root);
    await mkdir(first);
    await mkdir(second);
    await writeFile(path.join(first, "events.jsonl"), "{}");
    await writeFile(path.join(second, "events.jsonl"), "{}");
    const session = new FakeSession();
    session.onSend = () => session.finish();
    const policy = await createReadPolicy(root);
    const runtime = attachCoachRuntime(session, policy, async () => {});
    const ask = async () => {
      for await (const _ of runtime.stream("Explain; respond in Korean.", new AbortController().signal)) {}
    };
    await ask();
    assert.match(session.prompts[0]!, /No Driver session is selected/);
    assert.match(session.prompts[0]!, /Project access is still available/);
    assert.match(session.prompts[0]!, /Pair's own internal storage/);
    assert.doesNotMatch(session.prompts[0]!, /\bCoach\b/);
    assert.doesNotMatch(session.prompts[0]!, /Previously connected/);
    await runtime.setDriver({ directory: first, sessionId: "driver-one", title: "First session" });
    assert.equal(session.prompts.length, 1);
    await ask();
    assert.match(session.prompts[1]!, /Explain; respond in Korean/);
    assert.ok(session.prompts[1]!.includes(first));
    assert.ok(session.prompts[1]!.includes(root));
    assert.match(session.prompts[1]!, /entire directory tree/);
    await runtime.setDriver({ directory: second, sessionId: "driver-two", title: "Second session" });
    await ask();
    assert.equal(runtime.sessionId, "own-coach-session");
    assert.equal(session.prompts[2]!.includes(first), false);
    assert.ok(session.prompts[2]!.includes(second));
    await assert.rejects(policy.sourceFiles("view", { path: first }), /READ_PATH_DENIED/);
    await runtime.setDriver(null);
    await ask();
    assert.match(session.prompts[3]!, /No Driver session is selected/);
    assert.equal(session.disconnected, 0);
    await runtime.close();
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("cancel waits for idle, rejects concurrent changes and removes listeners even with a paused consumer", async () => {
  const session = new FakeSession();
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {});
  const iterator = runtime.stream("question", new AbortController().signal)[Symbol.asyncIterator]();
  const first = iterator.next();
  session.emit("assistant.message_delta", { messageId: "message", deltaContent: "Partial" });
  await first;
  let cancelled = false;
  const cancellation = runtime.cancel().then(() => { cancelled = true; });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(cancelled, false);
  await assert.rejects(runtime.setDriver(null), /COACH_BUSY/);
  await assert.rejects(runtime.stream("concurrent", new AbortController().signal)[Symbol.asyncIterator]().next(), /COACH_BUSY/);
  session.emit("assistant.message_delta", { messageId: "message", deltaContent: "STALE" });
  session.emit("session.idle", {});
  await cancellation;
  assert.equal(session.listeners.size, 0);
  assert.equal((await iterator.next()).done, true);
  await runtime.close();
});

test("ranged source excerpts remain partial even without output truncation", async () => {
  const session = new FakeSession();
  const root = path.resolve("test/fixtures/workspace");
  session.onSend = () => {
    session.emit("tool.execution_start", { toolCallId: "read", toolName: "view", arguments: {
      path: path.join(root, "catalog.ts"), view_range: [1, 2],
    } });
    session.emit("tool.execution_complete", { toolCallId: "read", success: true, result: { content: "1: source excerpt" } });
    session.finish();
  };
  const runtime = attachCoachRuntime(session, await createReadPolicy(root), async () => {});
  try {
    let sources = 0;
    for await (const delta of runtime.stream("question", new AbortController().signal)) {
      if (delta.kind === "source") { sources++; assert.equal(delta.message.partial, true); }
    }
    assert.equal(sources, 1);
  } finally { await runtime.close(); }
});

test("failed abort closes the owned runtime and cannot leave a paused turn subscribed", async () => {
  const session = new FakeSession();
  session.onAbort = () => { throw new Error("DO_NOT_EXPOSE_TOKEN"); };
  let stopped = 0;
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => { stopped++; });
  const iterator = runtime.stream("question", new AbortController().signal)[Symbol.asyncIterator]();
  const first = iterator.next();
  session.emit("assistant.message_delta", { messageId: "message", deltaContent: "Partial" });
  await first;
  try {
    await assert.rejects(runtime.cancel(), /COACH_SETTLE_FAILED/);
    assert.equal(stopped, 1);
    assert.equal(session.listeners.size, 0);
    await assert.rejects(iterator.next(), /COACH_SETTLE_FAILED/);
    await assert.rejects(runtime.setDriver(null), /COACH_CLOSED/);
  } finally { await runtime.close().catch(() => {}); }
});

test("abandoning a stream never reports successful cleanup when abort fails", async () => {
  const session = new FakeSession();
  session.onAbort = () => { throw new Error("synthetic failure"); };
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {});
  const iterator = runtime.stream("question", new AbortController().signal)[Symbol.asyncIterator]();
  const first = iterator.next();
  session.emit("assistant.message_delta", { messageId: "message", deltaContent: "Partial" });
  await first;
  await assert.rejects(iterator.return!(), /COACH_SETTLE_FAILED/);
  assert.equal(session.listeners.size, 0);
  await runtime.close();
});

test("SDK errors and missing or empty final replies are visible sanitized failures", async () => {
  for (const outcome of ["error", "missing", "empty"]) {
    const session = new FakeSession();
    session.onAbort = () => session.emit("session.idle", {});
    session.onSend = () => {
      if (outcome === "error") session.emit("session.error", { message: "DO_NOT_EXPOSE_TOKEN" });
      else if (outcome === "empty") session.finish("");
      else session.emit("session.idle", {});
    };
    const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {});
    try {
      await assert.rejects(async () => {
        for await (const _ of runtime.stream("question", new AbortController().signal)) {}
      }, outcome === "error" ? /COACH_SESSION_ERROR$/ : /COACH_COMPLETION_MISSING$/);
      assert.equal(session.listeners.size, 0);
    } finally { await runtime.close(); }
  }
});

test("close cleanup can be retried but a failed close never admits new requests", async () => {
  const session = new FakeSession();
  let attempts = 0;
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {
    if (++attempts === 1) throw new Error("synthetic cleanup failure");
  });
  await assert.rejects(runtime.close(), /COACH_CLEANUP_FAILED/);
  await assert.rejects(runtime.stream("question", new AbortController().signal)[Symbol.asyncIterator]().next(), /COACH_CLOSED/);
  await runtime.close();
  assert.equal(attempts, 2);
});

test("old abort signals cannot cancel a later turn and stopping suppresses late events", async () => {
  const session = new FakeSession();
  session.onSend = () => session.finish();
  session.onAbort = () => session.emit("session.idle", {});
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {});
  const old = new AbortController();
  for await (const _ of runtime.stream("first", old.signal)) {}
  session.onSend = () => {};
  const current = new AbortController();
  const pending = runtime.stream("second", current.signal)[Symbol.asyncIterator]().next();
  old.abort();
  assert.equal(session.aborted, 0);
  current.abort();
  assert.equal((await pending).done, true);
  session.emit("assistant.message_delta", { messageId: "late", deltaContent: "STALE" });
  assert.equal(session.aborted, 1);
  assert.equal(session.listeners.size, 0);
  await runtime.close();
});

test("turn deadline aborts and settles SDK work before surfacing the timeout", async () => {
  const session = new FakeSession();
  session.onAbort = () => session.emit("session.idle", {});
  const runtime = attachCoachRuntime(session, await createReadPolicy(path.resolve("test/fixtures/workspace")), async () => {}, 1);
  await assert.rejects(runtime.stream("question", new AbortController().signal)[Symbol.asyncIterator]().next(), /COACH_TURN_TIMEOUT/);
  assert.equal(session.aborted, 1);
  assert.equal(session.listeners.size, 0);
  await runtime.close();
});
