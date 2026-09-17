import test from "node:test";
import assert from "node:assert/strict";
import { composerControlState, createReplyState, driverControlState, QuestionDraft, reduceReply } from "../src/ui/webview-client.js";
import type { ViewState } from "../src/ui/messages.js";

function view(overrides: Partial<ViewState> = {}): ViewState {
  return {
    type: "state", chat: { id: "chat-1", status: "idle", messages: [] },
    driver: null, workspaceLabel: "/project", notice: "", starting: false, selectingDriver: false,
    model: { id: "claude-haiku-4.5", name: "Claude Haiku 4.5", reasoningEffort: null, reasoningAvailable: null, busy: false },
    ...overrides,
  };
}

test("Driver controls remain disabled throughout selection and recover afterward", () => {
  assert.deepEqual(driverControlState(null, false), { disabled: true, message: null });
  assert.deepEqual(driverControlState(view(), false), { disabled: false, message: null });
  assert.deepEqual(driverControlState(view({ selectingDriver: true }), false),
    { disabled: true, message: "selectingDriver" });
  assert.deepEqual(driverControlState(view(), true), { disabled: true, message: "busyComposer" });
  assert.deepEqual(driverControlState(view({ model: { ...view().model, busy: true } }), false),
    { disabled: true, message: "modelBusyComposer" });
  assert.deepEqual(driverControlState(view({ chat: { id: "chat-1", status: "ended", messages: [] } }), false),
    { disabled: true, message: "closedComposer" });
});

test("composer renders current SDK model names and Korean reasoning levels with next-message descriptions", () => {
  const initial = composerControlState(view());
  assert.equal(initial.model.label, "Claude Haiku 4.5");
  assert.equal(initial.model.accessibleName, "모델 선택 · 현재 Claude Haiku 4.5");
  assert.match(initial.model.title, /대화는 유지되며.*다음 메시지에 적용/);
  assert.equal(initial.reasoning.label, "추론: 기본");
  assert.equal(initial.reasoning.accessibleName, "추론 수준 선택 · 현재 기본");
  assert.match(initial.reasoning.title, /모델이 제공하는 추론 설정/);
  assert.match(initial.reasoning.title, /선택 가능한 추론 수준을 확인/);
  assert.equal(initial.model.disabled, false);
  assert.equal(initial.reasoning.disabled, false);
  assert.equal(initial.sendDisabled, false);
  assert.equal(initial.stopVisible, false);
  for (const [effort, label] of [
    ["low", "낮음"], ["medium", "보통"], ["high", "높음"], ["xhigh", "매우 높음"], ["max", "최대"],
  ] as const) {
    const controls = composerControlState(view({
      model: { ...view().model, reasoningEffort: effort, reasoningAvailable: true },
    }));
    assert.equal(controls.reasoning.label, `추론: ${label}`);
    assert.equal(controls.reasoning.accessibleName, `추론 수준 선택 · 현재 ${label}`);
    assert.match(controls.reasoning.title, /다음 메시지에 적용/);
    assert.equal(controls.reasoning.disabled, false);
  }
  const originalName = 'Original model <strong>"name"</strong> with a long version identifier';
  const named = composerControlState(view({ model: { ...view().model, name: originalName } }));
  assert.equal(named.model.label, originalName);
  assert.equal(named.model.accessibleName, `모델 선택 · 현재 ${originalName}`);
});

test("unavailable reasoning selection describes model-provided behavior without disabling model or send", () => {
  const controls = composerControlState(view({ model: { ...view().model, reasoningAvailable: false } }));
  assert.equal(controls.reasoning.disabled, true);
  assert.equal(controls.reasoning.label, "추론: 기본");
  assert.match(controls.reasoning.title, /선택 가능한 추론 수준을 제공하지 않으며 모델 자체의 설정/);
  assert.doesNotMatch(controls.reasoning.title, /추론(?:이|을|은)? (?:없|안|하지)/);
  assert.equal(controls.model.disabled, false);
  assert.equal(controls.sendDisabled, false);
});

test("pending model settings retain confirmed labels and an editable draft without posing as a response", () => {
  const controls = composerControlState(view({ model: { ...view().model, busy: true } }));
  assert.equal(controls.model.label, "Claude Haiku 4.5");
  assert.equal(controls.reasoning.label, "추론: 기본");
  assert.equal(controls.model.disabled, true);
  assert.equal(controls.reasoning.disabled, true);
  assert.match(controls.model.title, /모델 설정을 마친 뒤 메시지를 보내세요/);
  assert.match(controls.reasoning.title, /작성한 내용은 유지/);
  assert.equal(controls.inputDisabled, false);
  assert.equal(controls.sendDisabled, true);
  assert.equal(controls.stopVisible, false);
  assert.equal(controls.working, false);
  assert.equal(controls.status, "modelBusyShort");
  assert.equal(controls.message, "modelBusyComposer");
});

test("a live model switch reserves the working chat without showing a response or Stop", () => {
  const state = view({
    chat: { ...view().chat, status: "working" },
    model: { ...view().model, busy: true },
  });
  const controls = composerControlState(state);
  assert.equal(controls.working, false);
  assert.equal(controls.stopVisible, false);
  assert.equal(controls.status, "modelBusyShort");
  assert.equal(controls.message, "modelBusyComposer");
  assert.equal(controls.inputDisabled, false);
  assert.equal(controls.sendDisabled, true);
  assert.equal(controls.model.disabled, true);
  assert.equal(controls.reasoning.disabled, true);
  assert.deepEqual(driverControlState(state, controls.working),
    { disabled: true, message: "modelBusyComposer" });
  const actualReply = composerControlState(state, true);
  assert.equal(actualReply.working, true);
  assert.equal(actualReply.stopVisible, true);
  assert.equal(actualReply.status, "workingShort");
  const starting = composerControlState({ ...state, starting: true });
  assert.equal(starting.stopVisible, true);
  assert.equal(starting.status, "connectingShort");
});

test("model controls stay disabled during startup, actual responses, pending messages and ended chats", () => {
  for (const state of [
    view({ starting: true }),
    view({ chat: { ...view().chat, status: "working" } }),
  ]) {
    const controls = composerControlState(state);
    assert.equal(controls.model.disabled, true);
    assert.equal(controls.reasoning.disabled, true);
    assert.equal(controls.sendDisabled, true);
    assert.equal(controls.inputDisabled, false);
    assert.equal(controls.stopVisible, true);
  }
  const pending = composerControlState(view(), true);
  assert.equal(pending.model.disabled, true);
  assert.equal(pending.reasoning.disabled, true);
  assert.equal(pending.stopVisible, true);
  assert.equal(pending.status, "workingShort");
  for (const state of [null, view({ chat: { ...view().chat, status: "ended" } })]) {
    const controls = composerControlState(state);
    assert.equal(controls.model.disabled, true);
    assert.equal(controls.reasoning.disabled, true);
    assert.equal(controls.sendDisabled, true);
    assert.equal(controls.inputDisabled, true);
    assert.equal(controls.stopVisible, false);
  }
});

test("model picker, successful switch and cancellation updates preserve drafts, transcript and reply text", () => {
  const draft = new QuestionDraft();
  const message = { id: "human-1", role: "user" as const, text: "Original discussion" };
  const initial = view({ chat: { ...view().chat, messages: [message] } });
  let reply = reduceReply(createReplyState(), initial);
  reply = reduceReply(reply, { type: "replyStart", requestId: "reply-1", chatId: initial.chat.id });
  reply = reduceReply(reply, { type: "replyDelta", requestId: "reply-1", text: "원문 `Original English`" });
  const originalReply = reply.reply;
  const value = "작성 중인 다음 메시지\nKeep this draft";
  for (const model of [
    { ...initial.model, busy: true },
    { ...initial.model, name: "New original SDK model name", reasoningEffort: "high" as const, reasoningAvailable: true },
    initial.model,
  ]) {
    const event = {
      ...initial,
      chat: { ...initial.chat, status: model.busy ? "working" as const : "idle" as const },
      model,
    };
    assert.equal(draft.receive(event, value), value);
    assert.equal(draft.waiting, false);
    reply = reduceReply(reply, event);
    assert.equal(reply.reply, originalReply);
    assert.equal(reply.reply?.text, "원문 `Original English`");
    assert.equal(event.chat.id, initial.chat.id);
    assert.equal(event.chat.messages, initial.chat.messages);
    assert.equal(event.chat.messages[0], message);
  }
  assert.equal(draft.receive({ type: "error", requestId: "model-picker", message: "설정을 변경하지 못했습니다." }, value), value);
  draft.submit("next-message", initial.chat, value);
  assert.equal(draft.receive({ ...initial, model: { ...initial.model, busy: true } }, value), value);
  assert.equal(draft.waiting, true);
});

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
