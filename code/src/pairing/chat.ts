import { randomUUID } from "node:crypto";
import type { ChatMessage, ChatState, CoachDelta, CoachRuntime, DriverSource, ModelSelection } from "../contracts.js";
import { text } from "../validation.js";

export interface ChatOptions {
  /** Create the Pair runtime lazily for the first question. */
  createRuntime(signal: AbortSignal): Promise<CoachRuntime>;
  /** 표시용 대화 상태가 바뀌었음을 호스트에 알린다. */
  publish(state: ChatState): void;
  /** 개별 응답의 시작·진행·종료를 요청 ID와 함께 전달한다. */
  emit(requestId: string, event: CoachDelta | "start" | "end"): void;
}

/** Manage the display transcript and a single Pair runtime's request lifecycle. */
export function createChat(options: ChatOptions) {
  const chatId = randomUUID();
  const messages: ChatMessage[] = [];
  let runtime: CoachRuntime | undefined;
  let activeRequest: { abortController: AbortController; task: Promise<void> } | undefined;
  let driverChangeTask: Promise<void> | undefined;
  let modelChangeTask: Promise<void> | undefined;
  let isEnded = false;
  let closeTask: Promise<void> | undefined;

  /** 진행 중인 질문과 로그 변경을 반영한 상태를 반환하며, 외부에서 기록을 바꾸지 못하게 복제한다. */
  function getState(): ChatState {
    let status: ChatState["status"] = "idle";
    if (isEnded) {
      status = "ended";
    } else if (activeRequest || driverChangeTask || modelChangeTask) {
      status = "working";
    }
    return {
      id: chatId,
      status,
      messages: structuredClone(messages),
    };
  }

  /** 현재 대화 상태의 복사본을 호스트에 전달해 화면 갱신을 요청한다. */
  function publish(): void {
    options.publish(getState());
  }

  /** 표시용 메시지를 복사해 보관하고, 개수나 전체 크기 제한을 넘으면 오래된 항목부터 버린다. */
  function appendMessage(message: ChatMessage): void {
    messages.push(structuredClone(message));
    // 여기서는 화면용 사본만 제한한다. 모델 대화 맥락은 SDK가 별도로 관리한다.
    while (messages.length > 256 || Buffer.byteLength(JSON.stringify(messages)) > 1024 * 1024) {
      messages.shift();
    }
  }

  /** 현재 질문에 취소를 알리고 런타임 중단과 응답 작업 종료를 모두 기다린다. */
  async function stop(): Promise<void> {
    const request = activeRequest;
    if (!request) return;
    request.abortController.abort();

    let failure: unknown;
    try {
      await runtime?.cancel();
    } catch (error) {
      failure = error;
    }
    try {
      await request.task;
    } catch (error) {
      failure ??= error;
    }
    if (failure) throw failure;
  }

  /** 중복 질문을 막고 기존 SDK 세션으로 새 질문을 전송하며, 중단된 답변도 부분 응답으로 보존한다. */
  function submit(question: string): Promise<void> {
    if (isEnded) return Promise.reject(new Error("CHAT_ENDED"));
    if (activeRequest || driverChangeTask || modelChangeTask) return Promise.reject(new Error("CHAT_BUSY"));
    text(question, 16 * 1024, "INVALID_COACH_MESSAGE");

    const requestId = randomUUID();
    const abortController = new AbortController();
    const signal = abortController.signal;
    appendMessage({ id: randomUUID(), role: "user", text: question });

    const task = Promise.resolve().then(async () => {
      let replyText = "";
      let isComplete = false;
      options.emit(requestId, "start");

      try {
        // 세션 하나를 재사용하며, 표시 기록 전체를 재전송하지 않고 새 질문만 보낸다.
        runtime ??= await options.createRuntime(signal);
        if (signal.aborted) return;
        const prompt = `Respond in Korean. Keep code, identifiers and quoted source text unchanged.\n\n${question}`;

        for await (const delta of runtime.stream(prompt, signal)) {
          if (signal.aborted || isEnded) continue;
          if (delta.kind === "text") {
            const nextReplyBytes = Buffer.byteLength(replyText) + Buffer.byteLength(delta.text);
            if (nextReplyBytes > 64 * 1024) {
              await runtime.cancel();
              throw new Error("COACH_REPLY_TOO_LARGE");
            }
            replyText += delta.text;
          } else if (delta.kind === "source") {
            appendMessage(delta.message);
          }
          options.emit(requestId, delta);
        }
        isComplete = !signal.aborted;
      } catch (error) {
        if (!signal.aborted) throw error;
      } finally {
        if (replyText) {
          appendMessage({
            id: requestId,
            role: "assistant",
            text: replyText,
            ...(!isComplete ? { partial: true } : {}),
          });
        }
        if (runtime?.closed) isEnded = true;
        activeRequest = undefined;
        options.emit(requestId, "end");
        publish();
      }
    });

    activeRequest = { abortController, task };
    publish();
    return task;
  }

  /** Replace the Driver scope only while idle, rejecting the Pair's own session. */
  async function setDriver(driver: DriverSource | null): Promise<void> {
    if (isEnded) throw new Error("CHAT_ENDED");
    if (activeRequest || driverChangeTask || modelChangeTask) throw new Error("CHAT_BUSY");
    if (driver?.sessionId === runtime?.sessionId) throw new Error("COACH_SELF_BINDING_REJECTED");

    driverChangeTask = Promise.resolve().then(() => runtime?.setDriver(driver));
    publish();
    try {
      await driverChangeTask;
    } finally {
      driverChangeTask = undefined;
      publish();
    }
  }

  async function setModel(selection: ModelSelection): Promise<void> {
    if (isEnded) throw new Error("CHAT_ENDED");
    if (activeRequest || driverChangeTask || modelChangeTask) throw new Error("CHAT_BUSY");
    modelChangeTask = Promise.resolve().then(() => runtime?.setModel(selection));
    publish();
    try { await modelChangeTask; }
    finally {
      if (runtime?.closed) isEnded = true;
      modelChangeTask = undefined;
      publish();
    }
  }

  async function listModels() {
    if (isEnded) throw new Error("CHAT_ENDED");
    if (activeRequest || driverChangeTask || modelChangeTask) throw new Error("CHAT_BUSY");
    return runtime ? runtime.listModels() : undefined;
  }

  /** 대화를 즉시 종료 상태로 전환하고 진행 중인 작업과 런타임을 정리하며, 실패한 정리는 재시도할 수 있다. */
  function end(): Promise<void> {
    if (closeTask) return closeTask;
    // 중단과 자원 정리가 끝나기 전에도 새 질문은 즉시 거절한다.
    isEnded = true;
    activeRequest?.abortController.abort();
    publish();

    /** 로그 변경, 응답 중단, 런타임 종료를 순서대로 시도하고 오류가 있어도 나머지 정리를 수행한다. */
    const closeResources = async (): Promise<void> => {
      let failure: unknown;
      try {
        await modelChangeTask;
      } catch (error) {
        failure = error;
      }
      try {
        await driverChangeTask;
      } catch (error) {
        failure = error;
      }
      try {
        await stop();
      } catch (error) {
        failure = error;
      }
      try {
        await runtime?.close();
      } catch (error) {
        failure = error;
      }
      if (failure) throw failure;
    };

    closeTask = closeResources().catch(error => {
      closeTask = undefined;
      throw error;
    });
    return closeTask;
  }

  return { getState, submit, setDriver, setModel, listModels, stop, end };
}
