import test from "node:test";
import assert from "node:assert/strict";
import { createReplyState, QuestionDraft, reduceReply } from "../src/ui/webview-client.js";
import type { ViewState } from "../src/ui/messages.js";

function view(overrides: Partial<ViewState> = {}): ViewState {
  return {
    type: "state", chat: { id: "chat-1", status: "idle", messages: [] },
    driver: null, workspaceLabel: "/project", notice: "", starting: false, ...overrides,
  };
}

test("a requested reply preserves original text through ordinary state updates", () => {
  let state = reduceReply(createReplyState(), view());
  state = reduceReply(state, { type: "replyStart", requestId: "reply-1", chatId: "chat-1" });
  state = reduceReply(state, { type: "replyDelta", requestId: "reply-1", text: "원문 `Original English`" });
  state = reduceReply(state, view({ notice: "저장된 프로젝트 파일을 읽을 수 있습니다." }));
  assert.equal(state.reply?.text, "원문 `Original English`");
  state = reduceReply(state, { type: "replyDelta", requestId: "reply-1", text: "를 확인해 보세요." });
  assert.equal(state.reply?.text, "원문 `Original English`를 확인해 보세요.");
});

test("startup cancellation and its following state do not erase the first question", () => {
  const draft = new QuestionDraft();
  const question = "What should I test first?";
  draft.submit("question-1", view().chat, question);
  let value = draft.receive(view({ starting: true }), question);
  assert.equal(value, question);
  assert.equal(draft.waiting, true);
  value = draft.receive({ type: "error", requestId: "question-1", message: "Authentication cancelled." }, value);
  value = draft.receive(view(), value);
  assert.equal(value, question);
  assert.equal(draft.waiting, false);
});

test("startup failure restores the command's draft after its independent stream has ended", () => {
  const draft = new QuestionDraft();
  const question = "What should I test first?";
  draft.submit("ui-command-1", view().chat, question);
  const accepted = view({
    starting: true,
    chat: { id: "chat-1", status: "working", messages: [{ id: "human-1", role: "user", text: question }] },
  });
  let value = draft.receive(accepted, question);
  assert.equal(value, "");
  let reply = reduceReply(createReplyState(), accepted);
  reply = reduceReply(reply, { type: "replyStart", requestId: "host-stream-1", chatId: "chat-1" });
  assert.equal(reply.reply?.requestId, "host-stream-1");
  const ended = { type: "replyEnd", requestId: "host-stream-1" } as const;
  reply = reduceReply(reply, ended);
  value = draft.receive(ended, value);
  assert.equal(reply.reply, null);
  const idle = { ...accepted, starting: false, chat: { ...accepted.chat, status: "idle" as const } };
  value = draft.receive(idle, value);
  value = draft.receive({ type: "error", requestId: "ui-command-1", message: "Authentication cancelled." }, value);
  value = draft.receive(idle, value);
  assert.equal(value, question);
  assert.equal(draft.waiting, false);
  assert.equal(idle.chat.messages[0]?.text, question);
});

test("only a newly acknowledged question clears the matching draft", () => {
  const draft = new QuestionDraft();
  const old = { id: "old", role: "user" as const, text: "Same question" };
  const initial = view({ chat: { id: "chat-1", status: "idle", messages: [old] } });
  draft.submit("question-2", initial.chat, old.text);
  assert.equal(draft.receive(initial, old.text), old.text);
  const accepted = { ...initial, chat: { ...initial.chat, status: "working" as const, messages: [old, { ...old, id: "new" }] } };
  assert.equal(draft.receive(accepted, old.text), "");
  assert.equal(draft.waiting, false);
  assert.equal(draft.receive({ ...accepted, notice: "연결을 확인했습니다." }, "My next question"), "My next question");
});

test("an acknowledged but failed question is restored without overwriting a newer draft", () => {
  const draft = new QuestionDraft();
  draft.submit("question-1", view().chat, "Original");
  const accepted = view({ chat: { id: "chat-1", status: "working", messages: [{ id: "u1", role: "user", text: "Original" }] } });
  assert.equal(draft.receive(accepted, "Original"), "");
  assert.equal(draft.receive({ type: "error", requestId: "question-1", message: "Failed" }, ""), "Original");
  draft.submit("question-2", accepted.chat, "Original");
  assert.equal(draft.receive({ type: "error", requestId: "question-2", message: "Failed" }, "New draft"), "New draft");
});

test("stale errors and unrelated state changes do not erase a pending draft", () => {
  const draft = new QuestionDraft();
  draft.submit("question-1", view().chat, "Keep this");
  assert.equal(draft.receive({ type: "error", requestId: "old-error", message: "Old error" }, "Keep this"), "Keep this");
  assert.equal(draft.receive(view({ chat: { id: "startup-replacement", status: "idle", messages: [] } }), "Keep this"), "Keep this");
  assert.equal(draft.waiting, true);
  draft.reset();
  assert.equal(draft.waiting, false);
  assert.equal(draft.receive({ type: "error", requestId: "question-1", message: "Old error" }, ""), "");
});

test("stopping, ending, or replacing a chat rejects late stream events", () => {
  for (const finish of [
    { type: "replyEnd", requestId: "reply-1" } as const,
    view({ chat: { id: "chat-1", status: "ended", messages: [] } }),
    view({ chat: { id: "chat-2", status: "idle", messages: [] } }),
  ]) {
    let state = reduceReply(createReplyState(), view());
    state = reduceReply(state, { type: "replyStart", requestId: "reply-1", chatId: "chat-1" });
    state = reduceReply(state, { type: "replyDelta", requestId: "reply-1", text: "Partial" });
    state = reduceReply(state, finish);
    state = reduceReply(state, { type: "replyDelta", requestId: "reply-1", text: "Late" });
    state = reduceReply(state, { type: "replyStart", requestId: "reply-1", chatId: "chat-1" });
    assert.equal(state.reply, null);
  }
});

test("only current-request tool activity is shown and persisted replies replace their stream", () => {
  let state = reduceReply(createReplyState(), view());
  state = reduceReply(state, { type: "replyStart", requestId: "reply-1", chatId: "wrong-chat" });
  assert.equal(state.reply, null);
  state = reduceReply(state, { type: "replyStart", requestId: "reply-1", chatId: "chat-1" });
  state = reduceReply(state, { type: "tool", requestId: "other", name: "view", state: "started" });
  assert.equal(state.reply?.tool, null);
  state = reduceReply(state, { type: "tool", requestId: "reply-1", name: "view", state: "started" });
  assert.equal(state.reply?.tool?.name, "view");
  state = reduceReply(state, view({ chat: { id: "chat-1", status: "idle", messages: [
    { id: "reply-1", role: "assistant", text: "Answer", partial: true },
  ] } }));
  assert.equal(state.reply, null);
});
