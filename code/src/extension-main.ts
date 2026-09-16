import * as vscode from "vscode";
import { realpath } from "node:fs/promises";
import { homedir } from "node:os";
import path from "node:path";
import type { DriverSource } from "./contracts.js";
import { createChat } from "./pairing/chat.js";
import { inspectDriverSession, listDriverSessions } from "./driver/source.js";
import { createDriverSelection } from "./driver/selection.js";
import { createCoachRuntime } from "./runtime/coachRuntime.js";
import { getHostGitHubToken } from "./runtime/sdkRuntime.js";
import { CoachViewProvider } from "./ui/coachView.js";
import type { ViewCommand, ViewState } from "./ui/messages.js";
import { hostFailureText, hostText, type HostMessage } from "./hostMessages.js";

export interface ExtensionApi {
  /** 현재 대화와 연결 정보를 웹뷰 상태 형식으로 조회한다. */
  getState(): ViewState;
  /** Wait until the Pair webview can receive host messages. */
  waitForViewReady(): Promise<void>;
  /** Stop new work and clean up the Pair conversation and view. */
  shutdown(): Promise<void>;
}

let application: ExtensionApi | undefined;

/** Create one Pair application per extension and wire its view, commands and workspace events. */
export async function activate(context: vscode.ExtensionContext): Promise<ExtensionApi> {
  if (application) return application;

  const output = vscode.window.createOutputChannel("Wellactually");
  let workspacePath = "";
  let selectedDriver: DriverSource | null = null;
  let isStarting = false;
  let isDisposed = false;
  let notice: HostMessage | null = null;
  let newChatTask: Promise<void> | undefined;
  const driverSelection = createDriverSelection(publishState);

  /** Read the model for a new Pair runtime, leaving an empty value to the runtime default. */
  function getConfiguredModel(): string {
    return vscode.workspace.getConfiguration("wellactually").get<string>("model", "").trim();
  }

  function getGitHubToken(signal: AbortSignal): Promise<string | undefined> {
    return getHostGitHubToken(signal, async interactive => {
      return vscode.authentication.getSession("github", ["user:email"], interactive
        ? { createIfNone: { detail: hostText("authDetail") } }
        : { silent: true });
    });
  }

  /** 신뢰된 로컬 워크스페이스에서 이번 대화가 참고할 프로젝트 하나를 선택해 실제 경로로 고정한다. */
  async function chooseProjectDirectory(): Promise<string> {
    if (!vscode.workspace.isTrusted) throw new Error("TRUSTED_WORKSPACE_REQUIRED");
    if (vscode.env.remoteName) throw new Error("REMOTE_WORKSPACE_UNSUPPORTED");

    const folders = vscode.workspace.workspaceFolders ?? [];
    const activeEditor = vscode.window.activeTextEditor;
    let selectedFolder: vscode.WorkspaceFolder | undefined;

    // 여러 폴더 중 대상을 결정할 수 없는 경우에만 선택창을 띄운다.
    if (folders.length === 1) {
      selectedFolder = folders[0];
    } else if (activeEditor) {
      selectedFolder = vscode.workspace.getWorkspaceFolder(activeEditor.document.uri);
    }
    if (!selectedFolder && folders.length > 1) {
      selectedFolder = await vscode.window.showWorkspaceFolderPick({
        placeHolder: hostText("chooseWorkspace"),
      });
    }
    if (!selectedFolder) {
      const code = folders.length ? "WORKSPACE_SELECTION_CANCELLED" : "OPEN_PROJECT_REQUIRED";
      throw new Error(code);
    }
    if (selectedFolder.uri.scheme !== "file") throw new Error("LOCAL_WORKSPACE_REQUIRED");
    return realpath(selectedFolder.uri.fsPath);
  }

  /** Wire a lazy Pair runtime and its state/response events into a new conversation. */
  function makeChat() {
    return createChat({
      /** 첫 질문 시 프로젝트와 인증을 확정하고, 성공 여부와 관계없이 연결 중 표시를 해제한다. */
      async createRuntime(signal) {
        isStarting = true;
        notice = "connecting";
        publishState();

        try {
          // 이후 편집기 포커스가 바뀌어도 이 대화의 참고 범위가 달라지지 않도록 고정한다.
          if (!workspacePath) workspacePath = await chooseProjectDirectory();
          signal.throwIfAborted();
          const model = getConfiguredModel();
          return await createCoachRuntime({
            workspace: workspacePath,
            directory: path.join(context.globalStorageUri.fsPath, "runtime"),
            ...(model ? { model } : {}),
            ...(selectedDriver ? { driver: selectedDriver } : {}),
            getToken: () => getGitHubToken(signal),
          });
        } finally {
          isStarting = false;
          notice = null;
          publishState();
        }
      },
      publish: () => publishState(),
      /** 대화 계층의 응답 시작·종료, 텍스트 조각과 도구 상태를 웹뷰 이벤트로 변환한다. */
      emit(requestId, event) {
        if (event === "start") {
          provider.post({ type: "replyStart", requestId, chatId: chat.getState().id });
        } else if (event === "end") {
          provider.post({ type: "replyEnd", requestId });
        } else if (event.kind === "text") {
          provider.post({ type: "replyDelta", requestId, text: event.text });
        } else if (event.kind === "tool") {
          provider.post({
            type: "tool",
            requestId,
            name: event.name,
            state: event.state,
          });
        }
      },
    });
  }

  let chat = makeChat();

  /** 대화 상태, 선택한 로그, 프로젝트 이름과 안내 문구를 화면에 보낼 상태로 조합한다. */
  function getViewState(): ViewState {
    const openProjectNames = vscode.workspace.workspaceFolders?.map(folder => folder.name).join(", ");
    return {
      type: "state",
      chat: chat.getState(),
      driver: selectedDriver,
      workspaceLabel: workspacePath || openProjectNames || hostText("noWorkspace"),
      notice: notice === null ? "" : hostText(notice),
      starting: isStarting,
      selectingDriver: driverSelection.active,
    };
  }

  /** 확장이 종료되지 않은 동안에만 최신 상태를 웹뷰에 전달한다. */
  function publishState(): void {
    if (!isDisposed) provider.post(getViewState());
  }

  /** 원시 오류 내용 대신 제한된 오류 코드와 사용자 안내를 출력하고 화면 상태를 동기화한다. */
  function showFailure(error: unknown, requestId?: string): void {
    const code = error instanceof Error && /^[A-Z][A-Z0-9_]+$/.test(error.message)
      ? error.message
      : "ACTION_FAILED";
    output.appendLine(code);
    provider.post({
      type: "error",
      ...(requestId ? { requestId } : {}),
      message: hostFailureText(code),
    });
    publishState();
  }

  /** End the Pair conversation without stopping the connected Driver. */
  async function endConversation(): Promise<void> {
    await chat.end();
    notice = "ended";
    publishState();
  }

  /** 중복 초기화 요청을 하나로 합치고 이전 대화 정리 후 프로젝트·로그 연결이 없는 새 대화를 만든다. */
  async function startNewChat(): Promise<void> {
    if (!newChatTask) {
      /** 기존 자원이 정리된 뒤에만 화면 기록과 연결 범위를 새 대화로 교체한다. */
      const resetChat = async (): Promise<void> => {
        await endConversation();
        selectedDriver = null;
        workspacePath = "";
        chat = makeChat();
        notice = null;
        publishState();
      };
      newChatTask = resetChat().finally(() => {
        newChatTask = undefined;
      });
    }
    await newChatTask;
  }

  async function selectDriver(): Promise<void> {
    if (chat.getState().status !== "idle") throw new Error("CHAT_BUSY");
    if (!vscode.workspace.isTrusted || vscode.env.remoteName) {
      throw new Error("TRUSTED_LOCAL_WORKSPACE_REQUIRED");
    }

    const targetChat = chat;
    await driverSelection.run(async () => {
      const project = workspacePath || await chooseProjectDirectory();
      if (targetChat !== chat) throw new Error("WRONG_CHAT_ID");
      workspacePath = project;
      publishState();
      const sessionStateDirectory = path.join(homedir(), ".copilot", "session-state");
      const { sessions, failures } = await listDriverSessions(sessionStateDirectory, project);
      for (const failure of failures) output.appendLine(`${failure.code}: ${failure.sessionId}`);
      if (failures.length) {
        void vscode.window.showWarningMessage(hostText("driverSessionsSkipped", { count: failures.length }));
      }
      if (!sessions.length) {
        void vscode.window.showInformationMessage(hostText("noDriverSessions"));
        return;
      }
      if (targetChat !== chat || targetChat.getState().status !== "idle") throw new Error("CHAT_BUSY");
      const selected = await vscode.window.showQuickPick(sessions.map(session => ({
        label: session.title.replace(/\s+/g, " "),
        description: session.workspace,
        detail: hostText("driverLastActive", {
          time: new Date(session.modifiedTime).toLocaleString("ko-KR"),
          sessionId: session.sessionId,
        }),
        sessionId: session.sessionId,
      })), {
        title: hostText("chooseDriver"),
        placeHolder: hostText("driverSessionScope"),
        matchOnDescription: true,
        matchOnDetail: true,
      });
      if (!selected) return;
      const source = await inspectDriverSession(sessionStateDirectory, selected.sessionId);
      if (targetChat !== chat) throw new Error("WRONG_CHAT_ID");
      await targetChat.setDriver(source);
      if (targetChat !== chat || targetChat.getState().status === "ended") throw new Error("WRONG_CHAT_ID");
      selectedDriver = source;
      notice = "driverConnected";
      publishState();
    });
  }

  /** Revoke the selected session tree before updating the displayed connection. */
  async function disconnectDriver(): Promise<void> {
    driverSelection.assertIdle();
    const targetChat = chat;
    await targetChat.setDriver(null);
    if (targetChat !== chat || targetChat.getState().status === "ended") {
      throw new Error("WRONG_CHAT_ID");
    }
    selectedDriver = null;
    notice = "driverDisconnected";
    publishState();
  }

  /** 오래된 대화의 명령을 거절하고, 검증된 웹뷰 명령을 해당 호스트 작업으로 분기한다. */
  async function handleCommand(command: ViewCommand): Promise<void> {
    if (isDisposed) throw new Error("EXTENSION_CLOSED");
    if ("chatId" in command && command.chatId !== chat.getState().id) {
      throw new Error("WRONG_CHAT_ID");
    }

    switch (command.type) {
      case "ready":
        publishState();
        return;
      case "message":
        await chat.submit(command.text);
        return;
      case "stopReply":
        await chat.stop();
        return;
      case "end":
        await endConversation();
        return;
      case "newChat":
        await startNewChat();
        return;
      case "selectDriver":
        await selectDriver();
        return;
      case "disconnectDriver":
        await disconnectDriver();
        return;
    }
  }

  const provider = new CoachViewProvider(context, async command => {
    try {
      await handleCommand(command);
    } catch (error) {
      showFailure(error, command.requestId);
    }
  });
  context.subscriptions.push(
    output,
    provider,
    vscode.window.registerWebviewViewProvider("wellactually.coach", provider),
    vscode.commands.registerCommand("wellactually.open", () => provider.show()),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      void endConversation().then(() => {
        notice = "workspaceChanged";
        publishState();
      }, showFailure);
    }),
  );

  application = {
    getState: getViewState,
    waitForViewReady: () => provider.waitUntilReady(),
    /** 추가 상태 전송을 막고 대화를 종료하며, 종료 실패 시에도 웹뷰 자원은 해제한다. */
    async shutdown() {
      isDisposed = true;
      try {
        await chat.end();
      } finally {
        provider.dispose();
      }
    },
  };
  publishState();
  return application;
}

/** Clear the application reference and wait for owned Pair resources to close. */
export async function deactivate(): Promise<void> {
  const current = application;
  application = undefined;
  await current?.shutdown();
}
