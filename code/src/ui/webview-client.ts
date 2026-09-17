import type { ChatMessage, ChatState, ReasoningEffort } from "../contracts.js";
import { MAX_MESSAGE_BYTES, type ViewCommand, type ViewEvent, type ViewState } from "./messages.js";
import { uiText as t, type UiMessage } from "./strings.js";
import { renderChatMessage, shouldSendKey } from "./chatMessage.js";

interface Reply {
  requestId: string;
  chatId: string;
  text: string;
  tool: { name: string; state: "started" | "completed" } | null;
}
export interface ReplyState {
  chatId: string | null;
  ended: boolean;
  reply: Reply | null;
  retired: readonly string[];
}
/** 대화나 진행 중인 응답이 아직 연결되지 않은 스트리밍 표시 상태를 만든다. */
export function createReplyState(): ReplyState {
  return { chatId: null, ended: false, reply: null, retired: [] };
}
/** 완료된 요청 ID를 제한된 이력에 남겨 늦게 도착한 이벤트가 옛 응답을 다시 표시하지 못하게 한다. */
function retire(state: ReplyState, requestId: string): ReplyState {
  return {
    ...state,
    reply: state.reply?.requestId === requestId ? null : state.reply,
    retired: [...state.retired.filter(id => id !== requestId), requestId].slice(-128),
  };
}
/** 호스트 이벤트를 응답 표시 상태에 반영하며 다른 대화·종료된 요청·중복 시작 이벤트는 무시한다. */
export function reduceReply(state: ReplyState, event: ViewEvent): ReplyState {
  if (event.type === "state") {
    const ended = event.chat.status === "ended";
    const completed = state.reply && event.chat.messages.some(message =>
      message.role === "assistant" && message.id === state.reply!.requestId);
    const next = state.reply && (ended || event.chat.id !== state.chatId || completed)
      ? retire(state, state.reply.requestId) : state;
    return { ...next, chatId: event.chat.id, ended };
  }
  if (event.type === "replyEnd") return retire(state, event.requestId);
  if (event.type === "replyStart") {
    if (state.ended || event.chatId !== state.chatId || state.retired.includes(event.requestId)) return state;
    if (state.reply?.requestId === event.requestId) return state;
    const next = state.reply ? retire(state, state.reply.requestId) : state;
    return {
      ...next,
      reply: {
        requestId: event.requestId,
        chatId: event.chatId,
        text: "",
        tool: null,
      },
    };
  }
  if (!state.reply || !("requestId" in event) || event.requestId !== state.reply.requestId) return state;
  if (event.type === "replyDelta") return { ...state, reply: { ...state.reply, text: state.reply.text + event.text } };
  if (event.type === "tool") return { ...state, reply: { ...state.reply, tool: { name: event.name, state: event.state } } };
  if (event.type === "error") return retire(state, event.requestId!);
  return state;
}

/** 질문 접수 확인 전의 입력을 보관해 전송 실패 시 복원하고, 새로 작성한 초안은 유지한다. */
export class QuestionDraft {
  private pending: {
    requestId: string;
    chatId: string;
    text: string;
    existingIds: Set<string>;
    acknowledged: boolean;
  } | null = null;

  /** 현재 초안과 연결된 요청 ID를 반환해 오류 응답이 어느 질문에 해당하는지 구분한다. */
  get requestId(): string | undefined {
    return this.pending?.requestId;
  }

  /** 호스트 상태에서 질문 접수를 아직 확인하지 못했는지 알려 중복 전송을 막는 데 사용한다. */
  get waiting(): boolean {
    return this.pending !== null && !this.pending.acknowledged;
  }

  /** 전송할 질문과 기존 메시지 ID를 보관해 이후 같은 텍스트의 신규 메시지를 접수 확인으로 구분한다. */
  submit(requestId: string, chat: ChatState, text: string): void {
    this.pending = {
      requestId,
      chatId: chat.id,
      text,
      existingIds: new Set(chat.messages.map(item => item.id)),
      acknowledged: false,
    };
  }

  /** 질문 접수 시 기존 입력을 비우고 실패 시 복원하되, 사용자가 새로 입력한 내용은 덮어쓰지 않는다. */
  receive(event: ViewEvent, value: string): string {
    const pending = this.pending;
    if (!pending) return value;
    if (event.type === "error" && event.requestId === pending.requestId) {
      this.pending = null;
      return value || pending.text;
    }
    if (event.type === "state" && !pending.acknowledged && event.chat.id === pending.chatId &&
        event.chat.messages.some(item => item.role === "user" && item.text === pending.text && !pending.existingIds.has(item.id))) {
      // 과거의 동일 문장은 접수 확인이 아니며, 전송 이후 작성한 새 초안도 건드리지 않는다.
      pending.acknowledged = true;
      return value === pending.text ? "" : value;
    }
    return value;
  }

  /** 새 대화나 전송 실패 처리에 맞춰 보관 중인 질문의 접수 추적을 해제한다. */
  reset(): void {
    this.pending = null;
  }
}

export interface WebviewApi { postMessage(command: ViewCommand): void }

interface PickerControlState {
  label: string;
  accessibleName: string;
  title: string;
  disabled: boolean;
}

const reasoningMessages: Record<ReasoningEffort, UiMessage> = {
  low: "reasoningLow", medium: "reasoningMedium", high: "reasoningHigh",
  xhigh: "reasoningXhigh", max: "reasoningMax",
};

export function composerControlState(state: ViewState | null, responsePending = false): {
  ended: boolean;
  working: boolean;
  inputDisabled: boolean;
  sendDisabled: boolean;
  stopVisible: boolean;
  status: UiMessage;
  message: UiMessage | null;
  model: PickerControlState;
  reasoning: PickerControlState;
} {
  const ended = state?.chat.status === "ended";
  const modelBusy = !!state?.model.busy;
  const working = !!state?.starting || (state?.chat.status === "working" && !modelBusy) || responsePending;
  const disabled = !state || ended || working || modelBusy;
  const message = !state ? "connecting" : ended ? "closedComposer"
    : working ? "busyComposer" : modelBusy ? "modelBusyComposer" : null;
  const blockedHelp = message ? ` ${t(message)}` : "";
  const modelLabel = state?.model.name || state?.model.id || t("model");
  const modelName = t("selectModel", { model: modelLabel });
  const effort = state?.model.reasoningEffort;
  const level = t(effort ? reasoningMessages[effort] : "reasoningDefault");
  const reasoningName = t("selectReasoning", { level });
  const available = state?.model.reasoningAvailable;
  const reasoningHelp = available === false ? t("reasoningUnavailable")
    : [!effort ? t("reasoningDefaultHelp") : "", available == null ? t("reasoningUnknown") : "", t("reasoningHelp")]
      .filter(Boolean).join(" ");
  return {
    ended,
    working,
    inputDisabled: !state || ended,
    sendDisabled: disabled,
    stopVisible: !!state && !ended && working,
    status: ended ? "endedShort" : state?.starting ? "connectingShort" : working ? "workingShort"
      : modelBusy ? "modelBusyShort" : "readyShort",
    message,
    model: {
      label: modelLabel,
      accessibleName: modelName,
      title: `${modelName}. ${t("modelHelp")}${blockedHelp}`,
      disabled,
    },
    reasoning: {
      label: t("reasoningLabel", { level }),
      accessibleName: reasoningName,
      title: `${reasoningName}. ${reasoningHelp}${blockedHelp}`,
      disabled: disabled || available === false,
    },
  };
}

export function driverControlState(state: ViewState | null, working: boolean): {
  disabled: boolean;
  message: UiMessage | null;
} {
  if (!state) return { disabled: true, message: null };
  if (state.chat.status === "ended") return { disabled: true, message: "closedComposer" };
  if (state.selectingDriver) return { disabled: true, message: "selectingDriver" };
  if (working) return { disabled: true, message: "busyComposer" };
  if (state.model.busy) return { disabled: true, message: "modelBusyComposer" };
  return { disabled: false, message: null };
}

/** VS Code가 웹뷰 실행 환경에 제공하는 호스트 통신 API를 얻는다. */
declare function acquireVsCodeApi(): WebviewApi;

/** Wire the Pair view's rendering, drafts, scrolling and input, returning receive/dispose hooks. */
export function mountCoachView(doc: Document, api: WebviewApi): { receive(event: ViewEvent): void; dispose(): void } {
  let state: ViewState | null = null;
  let replies = createReplyState();
  const draft = new QuestionDraft();
  let requestSequence = 0;
  let resetOnNewChat = false;
  let followLatest = true;
  let contentVersion = "";
  let streamText = "";
  let fieldError: UiMessage | null = null;
  let remoteFieldError = "";
  let viewError = "";
  let dialogTrigger: HTMLElement | null = null;
  const messages = new Map<string, {
    fingerprint: string;
    node: HTMLLIElement;
    label: HTMLElement;
    partial: HTMLElement;
  }>();
  /** 생성 시각과 화면 내 증가 번호로 호스트 명령을 구분할 요청 ID를 만든다. */
  const requestId = (): string => `view-${Date.now().toString(36)}-${++requestSequence}`;
  /** 필수 DOM 요소를 ID로 찾고, 템플릿과 클라이언트 구성이 어긋났으면 즉시 오류를 낸다. */
  function element<T extends HTMLElement = HTMLElement>(id: string): T {
    const found = doc.getElementById(id);
    if (!found) throw new Error(`Missing Pair view element: ${id}`);
    return found as T;
  }
  /** 표시 내용이 달라진 경우에만 텍스트 노드를 갱신해 불필요한 DOM 변경을 줄인다. */
  function text(id: string, value: string): void {
    const node = element(id);
    if (node.textContent !== value) node.textContent = value;
  }
  /** 요소의 hidden 상태로 화면 표시 여부를 바꾼다. */
  function visible(id: string, show: boolean): void {
    element(id).hidden = !show;
  }
  /** 문자열을 HTML로 해석하지 않고 텍스트와 선택적 CSS 클래스를 가진 DOM 요소를 만든다. */
  function create<K extends keyof HTMLElementTagNameMap>(tag: K, value?: string, className?: string): HTMLElementTagNameMap[K] {
    const node = doc.createElement(tag);
    if (value !== undefined) node.textContent = value;
    if (className) node.className = className;
    return node;
  }
  const question = element<HTMLTextAreaElement>("coach-question");
  const form = element<HTMLFormElement>("question-form");
  const scroll = element("chat-scroll");
  const settings = element<HTMLDialogElement>("settings-dialog");
  const settingsBody = element("settings-body");
  const menu = element<HTMLDetailsElement>("session-menu");
  /** 입력 오류와 일반 작업 오류를 해당 영역에 표시하고 접근성용 오류 상태도 함께 갱신한다. */
  function renderErrors(): void {
    const message = fieldError ? t(fieldError) : remoteFieldError;
    text("question-error", message);
    visible("question-error", !!message);
    if (message) question.setAttribute("aria-invalid", "true");
    else question.removeAttribute("aria-invalid");
    const general = viewError || (state?.chat.status === "ended" ? message : "");
    text("view-error", general);
    visible("view-error", !!general);
    text("settings-error", viewError);
    visible("settings-error", !!viewError);
  }
  /** 새 작업을 시작할 때 입력·호스트·화면 오류를 모두 비우고 표시를 갱신한다. */
  function clearErrors(): void {
    fieldError = null;
    remoteFieldError = "";
    viewError = "";
    renderErrors();
  }
  /** 명령을 호스트 통신 API에 전달하고 즉시 발생한 전달 오류를 화면에 표시한다. */
  function dispatch(command: ViewCommand): boolean {
    try {
      api.postMessage(command);
      return true;
    } catch {
      viewError = t("transportFailed");
      renderErrors();
      return false;
    }
  }
  /** 최신 메시지로 스크롤하고 이후 새 응답을 자동으로 따라가는 상태로 전환한다. */
  function jumpToLatest(): void {
    followLatest = true;
    scroll.scrollTop = scroll.scrollHeight;
    visible("new-messages", false);
  }
  /** 사용자가 대화 하단 근처를 읽는지 판단해 자동 스크롤 여부를 갱신한다. */
  function onScroll(): void {
    followLatest = scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight <= 40;
    if (followLatest) visible("new-messages", false);
  }
  /** 입력창 또는 종료 안내 높이에 맞춰 새 메시지 이동 버튼이 하단 UI를 가리지 않게 배치한다. */
  function updateJumpPosition(): void {
    const footer = form.hidden ? element("ended-actions") : form;
    element("new-messages").style.bottom = `${footer.offsetHeight + 8}px`;
  }
  /** 메시지 ID와 내용 지문으로 변경된 항목만 갱신하고, 자료 발췌의 펼침 상태와 표시 순서를 유지한다. */
  function renderMessages(items: readonly ChatMessage[]): void {
    const target = element("conversation");
    const keep = new Set<string>();
    let position = 0;
    for (const item of items) {
      keep.add(item.id);
      const fingerprint = JSON.stringify(item);
      let rendered = messages.get(item.id);
      if (!rendered || rendered.fingerprint !== fingerprint) {
        const node = create("li", undefined, item.role === "tool" ? "read-entry" :
          `chat-message ${item.role === "user" ? "human" : "coach"}-message`);
        node.dataset.messageId = item.id;
        const label = create(item.role === "tool" ? "summary" : "div", undefined, item.role === "tool" ? undefined : "speaker");
        const partial = create("p", undefined, "muted small");
        if (item.role === "tool") {
          const details = create("details");
          details.open = rendered?.node.querySelector("details")?.open ?? false;
          details.append(label, create("pre", item.text, "source-excerpt"), partial);
          node.append(details);
        } else {
          const body = create("div", undefined, "message-body");
          renderChatMessage(doc, body, item.text);
          node.append(label, body, partial);
        }
        rendered?.node.replaceWith(node);
        rendered = { fingerprint, node, label, partial };
        messages.set(item.id, rendered);
      }
      const label = item.role === "tool" ? t("sourceRead", { source: item.source || t("toolSource") })
        : t(item.role === "user" ? "roleHuman" : "roleCoach");
      if (rendered.label.textContent !== label) rendered.label.textContent = label;
      rendered.partial.hidden = !item.partial;
      rendered.partial.textContent = t(item.role === "tool" ? "partialSource" : "partialReply");
      const current = target.children.item(position++);
      if (current !== rendered.node) target.insertBefore(rendered.node, current);
    }
    for (const [id, rendered] of messages) {
      if (!keep.has(id)) {
        rendered.node.remove();
        messages.delete(id);
      }
    }
  }
  /** 연결·응답·종료·질문 접수 상태에 맞춰 입력창, 작업 버튼과 상태 안내를 일관되게 갱신한다. */
  function renderControls(): void {
    const controls = composerControlState(state, !!replies.reply || draft.waiting);
    const driverControls = driverControlState(state, controls.working);
    question.disabled = controls.inputDisabled;
    element<HTMLButtonElement>("send-question").disabled = controls.sendDisabled;
    visible("send-question", !controls.stopVisible);
    visible("stop-reply", controls.stopVisible);
    visible("question-form", !controls.ended);
    visible("ended-actions", controls.ended);
    text("composer-state", controls.message ? t(controls.message) : "");
    text("view-status", t(controls.status));
    for (const name of ["model", "reasoning"] as const) {
      const control = controls[name];
      const button = element<HTMLButtonElement>(`select-${name}`);
      text(`${name}-label`, control.label);
      button.disabled = control.disabled;
      button.setAttribute("aria-label", control.accessibleName);
      button.title = control.title;
    }
    text("reasoning-description", controls.reasoning.title);
    element("model-controls").setAttribute("aria-busy", String(!!state?.model.busy));
    element("stream-reply").setAttribute("aria-busy", String(!!replies.reply));
    for (const button of doc.querySelectorAll<HTMLButtonElement>("[data-command]")) {
      switch (button.dataset.command) {
        case "newChat":
          button.disabled = !state;
          break;
        case "end":
          button.disabled = !state;
          button.hidden = controls.ended;
          break;
        case "selectDriver":
        case "disconnectDriver":
          button.disabled = driverControls.disabled;
          break;
      }
    }
    text("driver-availability", driverControls.message ? t(driverControls.message) : "");
    visible("driver-availability", driverControls.message !== null);
    updateJumpPosition();
  }
  /** 확정된 대화 기록과 프로젝트·드라이버 연결 정보, 호스트 안내 문구를 화면에 반영한다. */
  function renderState(): void {
    if (!state) return;
    visible("empty-session", state.chat.messages.length === 0 && state.chat.status !== "ended" && !replies.reply);
    renderMessages(state.chat.messages);
    text("workspace-label", state.workspaceLabel || t("noProject"));
    text("driver-status", state.driver?.title ?? t("noDriver"));
    text("driver-session", state.driver ? t("driverSession", { sessionId: state.driver.sessionId }) : "");
    visible("driver-session", !!state.driver);
    text("select-driver", t(state.driver ? "changeDriver" : "selectDriver"));
    visible("disconnect-driver", !!state.driver);
    text("view-notice", state.notice);
    visible("view-notice", !!state.notice);
  }
  /** 확정 기록과 분리된 현재 응답을 표시하고 도구 실행 또는 응답 준비 상태를 안내한다. */
  function renderReply(): void {
    const reply = replies.reply;
    visible("stream-reply", !!reply);
    if (reply) visible("empty-session", false);
    const value = reply?.text ?? "";
    if (streamText !== value) {
      renderChatMessage(doc, element("stream-text"), value);
      streamText = value;
    }
    let toolStatus = "";
    if (reply?.tool?.state === "started") {
      toolStatus = t("readingContext");
    } else if (reply && !reply.text) {
      toolStatus = t("thinking");
    }
    text("tool-status", toolStatus);
  }
  /** 호스트 이벤트로 초안과 응답을 갱신하되 읽던 위치와 포커스를 보존하고 새 대화 전환을 처리한다. */
  function receive(event: ViewEvent): void {
    // 화면 갱신만으로 사용자의 대화 읽기 위치나 설정창 스크롤이 이동해서는 안 된다.
    const chatScrollTop = scroll.scrollTop;
    const settingsScrollTop = settingsBody.scrollTop;
    const focused = doc.activeElement as HTMLElement | null;
    const oldReplyText = replies.reply?.text ?? "";
    let focusNewChat = false;
    const failedQuestion = event.type === "error" && !!event.requestId && event.requestId === draft.requestId;
    const value = draft.receive(event, question.value);
    if (value !== question.value) question.value = value;
    replies = reduceReply(replies, event);
    let newContent = oldReplyText !== (replies.reply?.text ?? "");
    if (event.type === "state") {
      if (resetOnNewChat && state && state.chat.id !== event.chat.id) {
        draft.reset();
        question.value = "";
        resetOnNewChat = false;
        clearErrors();
        followLatest = true;
        focusNewChat = true;
      }
      const version = JSON.stringify(event.chat.messages);
      newContent ||= version !== contentVersion;
      contentVersion = version;
      state = event;
      renderState();
    } else if (event.type === "error") {
      fieldError = null;
      if (failedQuestion) remoteFieldError = event.message;
      else viewError = event.message;
      resetOnNewChat = false;
    }
    renderErrors();
    renderReply();
    renderControls();
    scroll.scrollTop = chatScrollTop;
    if (settings.open) settingsBody.scrollTop = settingsScrollTop;
    if (focusNewChat && !settings.open) question.focus({ preventScroll: true });
    else if (focused && (!focused.isConnected || focused.closest("[hidden]") || ("disabled" in focused && focused.disabled))) {
      const target = settings.open ? element("close-settings") : state?.chat.status === "ended"
        ? element("ended-actions").querySelector<HTMLButtonElement>("button")! : question;
      target.focus({ preventScroll: true });
    } else if (failedQuestion && !settings.open && !question.disabled) question.focus({ preventScroll: true });
    if (newContent) {
      // 사용자가 이미 최신 메시지를 읽고 있을 때만 새 내용을 자동으로 따라간다.
      if (followLatest && !settings.open) jumpToLatest();
      else visible("new-messages", true);
    }
  }
  /** 질문의 공백·크기와 전송 가능 상태를 검사하고, 초안을 보관한 뒤 호스트에 질문 명령을 보낸다. */
  function submit(event: SubmitEvent): void {
    event.preventDefault();
    clearErrors();
    if (!state || question.disabled || element<HTMLButtonElement>("send-question").disabled) return;
    const value = question.value;
    if (!value.trim()) fieldError = "emptyQuestion";
    else if (new TextEncoder().encode(value).byteLength > MAX_MESSAGE_BYTES) fieldError = "questionLimit";
    if (fieldError) {
      renderErrors();
      question.focus({ preventScroll: true });
      return;
    }
    const command: ViewCommand = { type: "message", requestId: requestId(), chatId: state.chat.id, text: value };
    draft.submit(command.requestId, state.chat, value);
    if (!dispatch(command)) draft.reset();
    else {
      followLatest = true;
      question.focus({ preventScroll: true });
    }
    renderControls();
  }
  /** 입력 조합이나 줄바꿈이 아닌 전송용 Enter 입력을 폼 제출로 연결한다. */
  function onComposerKey(event: KeyboardEvent): void {
    if (shouldSendKey(event)) {
      event.preventDefault();
      form.requestSubmit();
    }
  }
  /** Escape 입력으로 열린 설정창이나 대화 작업 메뉴를 닫고 메뉴 포커스를 복원한다. */
  function onKey(event: KeyboardEvent): void {
    if (event.key === "Escape" && settings.open) {
      event.preventDefault();
      settings.close();
    } else if (event.key === "Escape" && menu.open) {
      event.preventDefault();
      menu.open = false;
      menu.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
    }
  }
  /** 설정창이 닫히면 열었던 버튼으로 포커스를 돌리고, 버튼이 사라졌으면 기본 설정 버튼을 사용한다. */
  function onDialogClose(): void {
    (dialogTrigger?.isConnected && !dialogTrigger.closest("[hidden]") ? dialogTrigger : element("open-settings"))
      .focus({ preventScroll: true });
  }
  /** 버튼 클릭을 화면 내부 동작과 호스트 명령으로 분리하고 숨겨지거나 비활성화된 버튼은 무시한다. */
  function click(event: MouseEvent): void {
    const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>("button") : null;
    if (!button || button.disabled || button.closest("[hidden]")) return;
    switch (button.dataset.local) {
      case "settings":
        dialogTrigger = button;
        menu.open = false;
        if (!settings.open) settings.showModal();
        settingsBody.scrollTop = 0;
        element("close-settings").focus({ preventScroll: true });
        return;
      case "closeSettings":
        settings.close();
        return;
      case "latest":
        jumpToLatest();
        scroll.focus({ preventScroll: true });
        return;
    }
    if (!state) return;
    const action = button.dataset.command;
    switch (action) {
      case "newChat":
      case "stopReply":
      case "end":
      case "selectDriver":
      case "disconnectDriver":
      case "selectModel":
      case "selectReasoning":
        clearErrors();
        if (menu.contains(button)) {
          menu.open = false;
          menu.querySelector<HTMLElement>("summary")?.focus({ preventScroll: true });
        }
        if (action === "newChat") resetOnNewChat = true;
        if (!dispatch({ type: action, requestId: requestId(), chatId: state.chat.id })) resetOnNewChat = false;
    }
  }
  const resize = new ResizeObserver(updateJumpPosition);
  resize.observe(form);
  resize.observe(element("ended-actions"));
  renderControls();
  form.addEventListener("submit", submit);
  question.addEventListener("keydown", onComposerKey);
  settings.addEventListener("close", onDialogClose);
  scroll.addEventListener("scroll", onScroll);
  doc.addEventListener("click", click);
  doc.addEventListener("keydown", onKey);
  dispatch({ type: "ready", requestId: requestId() });
  return {
    receive,
    /** 웹뷰가 내려갈 때 크기 관찰과 모든 DOM 이벤트 수신기를 해제한다. */
    dispose() {
      resize.disconnect();
      form.removeEventListener("submit", submit);
      question.removeEventListener("keydown", onComposerKey);
      settings.removeEventListener("close", onDialogClose);
      scroll.removeEventListener("scroll", onScroll);
      doc.removeEventListener("click", click);
      doc.removeEventListener("keydown", onKey);
    },
  };
}

if (typeof document !== "undefined" && typeof acquireVsCodeApi === "function") {
  const view = mountCoachView(document, acquireVsCodeApi());
  window.addEventListener("message", (event: MessageEvent<ViewEvent>) => view.receive(event.data));
  window.addEventListener("unload", () => view.dispose(), { once: true });
}
