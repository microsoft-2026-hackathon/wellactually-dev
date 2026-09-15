import { randomBytes } from "node:crypto";
import * as vscode from "vscode";
import { parseViewCommand, type ViewCommand, type ViewEvent, type ViewState } from "./messages.js";
import { createWebviewHtml } from "./webview.js";
import { uiText } from "./strings.js";

export class CoachViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  private view: vscode.WebviewView | undefined;
  private listeners: vscode.Disposable[] = [];
  private state: ViewState | undefined;
  private ready = false;
  private disposed = false;

  /** 확장 리소스 위치와 검증된 웹뷰 명령을 처리할 호스트 콜백을 보관한다. */
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly onCommand: (command: ViewCommand) => Promise<void>,
  ) {}

  /** 기존 화면 연결을 해제하고, 제한된 로컬 리소스와 메시지 수신기를 갖춘 새 웹뷰를 초기화한다. */
  resolveWebviewView(view: vscode.WebviewView): void {
    if (this.disposed) return;
    this.releaseView();
    this.view = view;
    const resourceRoots = [
      vscode.Uri.joinPath(this.context.extensionUri, "src", "ui"),
      vscode.Uri.joinPath(this.context.extensionUri, "dist", "src"),
    ];
    view.webview.options = {
      enableScripts: true,
      enableCommandUris: false,
      localResourceRoots: resourceRoots,
    };
    this.listeners.push(
      view.webview.onDidReceiveMessage((value: unknown) => { void this.receive(value); }),
      view.onDidDispose(() => {
        if (this.view === view) this.releaseView();
      }),
    );
    view.webview.html = createWebviewHtml({
      nonce: randomBytes(24).toString("base64"),
      cspSource: view.webview.cspSource,
      styleUri: view.webview.asWebviewUri(vscode.Uri.joinPath(resourceRoots[0]!, "styles.css")).toString(),
      scriptUri: view.webview.asWebviewUri(vscode.Uri.joinPath(resourceRoots[1]!, "ui", "webview-client.js")).toString(),
    });
  }

  /** 확정 상태는 재연결을 위해 보관하고, 준비가 끝난 화면에만 이벤트를 전달한다. */
  post(event: ViewEvent): void {
    if (this.disposed) return;
    // 다시 열린 웹뷰에는 준비 완료 후 확정 상태만 보내며, 일시적인 응답 조각은 재전송하지 않는다.
    if (event.type === "state") this.state = event;
    if (this.ready && this.view) {
      void this.view.webview.postMessage(event).then(undefined, () => {
        console.error("WELLACTUALLY_VIEW_DELIVERY_FAILED");
      });
    }
  }

  /** Open and focus the Pair view without reviving a disposed provider. */
  async show(): Promise<void> {
    if (this.disposed) return;
    await vscode.commands.executeCommand("wellactually.coach.focus");
    this.view?.show(false);
  }

  /** 웹뷰의 준비 완료 신호를 기다리며, 종료되거나 제한 시간을 넘기면 실패한다. */
  async waitUntilReady(timeoutMs = 10_000): Promise<void> {
    const deadline = Date.now() + timeoutMs;
    while (!this.ready) {
      if (this.disposed || Date.now() >= deadline) throw new Error("COACH_VIEW_NOT_READY");
      await new Promise<void>(resolve => setTimeout(resolve, 25));
    }
  }

  /** 공급자를 종료 상태로 만들고 저장된 상태와 화면 이벤트 연결을 해제한다. */
  dispose(): void {
    this.disposed = true;
    this.state = undefined;
    this.releaseView();
  }

  /** 현재 웹뷰 참조와 준비 상태를 비우고 해당 화면에 등록한 수신기를 제거한다. */
  private releaseView(): void {
    this.view = undefined;
    this.ready = false;
    for (const listener of this.listeners.splice(0)) listener.dispose();
  }

  /** 브라우저 입력을 검증하고 준비 완료 시 상태를 복원한 뒤 명령 처리를 호스트에 위임한다. */
  private async receive(value: unknown): Promise<void> {
    if (this.disposed) return;
    let command: ViewCommand;
    try {
      // 브라우저와 호스트 경계에서 형식을 검증한다. 현재 대화 ID의 일치는 호스트가 별도로 검사한다.
      command = parseViewCommand(value);
    } catch {
      this.post({
        type: "error",
        message: uiText("invalidAction"),
      });
      return;
    }
    if (command.type === "ready") {
      this.ready = true;
      if (this.state) this.post(this.state);
    }
    try {
      await this.onCommand(command);
    } catch {
      this.post({
        type: "error",
        requestId: command.requestId,
        message: uiText("actionFailed"),
      });
    }
  }
}
