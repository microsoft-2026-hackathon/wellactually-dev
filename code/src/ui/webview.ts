import { uiText, type UiMessage } from "./strings.js";
import type { MessageValues } from "../format.js";

export interface WebviewHtmlOptions {
  nonce: string;
  cspSource: string;
  styleUri: string;
  scriptUri: string;
}

/** HTML 속성에 넣을 값의 특수 문자를 이스케이프해 마크업 경계를 깨지 않도록 한다. */
function attribute(value: string): string {
  return value.replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]!);
}

/** Validate assets and build the Pair view with a CSP that blocks external communication. */
export function createWebviewHtml(options: WebviewHtmlOptions): string {
  if (!/^[A-Za-z0-9+/_=-]{16,128}$/.test(options.nonce) ||
      !options.cspSource.trim() || options.cspSource.trim().split(/\s+/).some(source =>
        source !== "'self'" && !/^(https:|vscode-webview:|vscode-resource:|vscode-webview-resource:)\/\/[A-Za-z0-9.*:_-]+$/.test(source))) {
    throw new Error("INVALID_WEBVIEW_OPTIONS");
  }
  for (const uri of [options.styleUri, options.scriptUri]) {
    if (!/^(https:|vscode-webview:|vscode-resource:|vscode-webview-resource:)\/\//.test(uri)) throw new Error("INVALID_WEBVIEW_OPTIONS");
  }
  /** 한국어 UI 문구를 HTML에 삽입할 수 있는 이스케이프된 문자열로 가져온다. */
  const tx = (key: UiMessage, values: MessageValues = {}): string => attribute(uiText(key, values));
  const nonce = attribute(options.nonce);
  const policy = `default-src 'none'; base-uri 'none'; form-action 'none'; style-src ${options.cspSource} 'nonce-${options.nonce}'; script-src 'nonce-${options.nonce}' 'strict-dynamic'; connect-src 'none';`;
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="${attribute(policy)}">
  <title>${tx("title")}</title>
  <link nonce="${nonce}" rel="stylesheet" href="${attribute(options.styleUri)}">
</head>
<body>
  <main id="coach-view" class="chat-shell">
    <h1 class="sr-only">${tx("title")}</h1>
    <header class="chat-toolbar">
      <p id="view-status" class="compact-status" role="status" aria-live="polite" aria-atomic="true">${tx("readyShort")}</p>
      <button id="open-settings" type="button" class="icon-button" data-local="settings" aria-haspopup="dialog" aria-controls="settings-dialog" aria-label="${tx("openSettings")}" title="${tx("openSettings")}">
        <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m10 3-.7 2.4-2 .9L5 5.7 3 9l1.7 1.8v2.4L3 15l2 3.3 2.3-.6 2 .9L10 21h4l.7-2.4 2-.9 2.3.6 2-3.3-1.7-1.8v-2.4L21 9l-2-3.3-2.3.6-2-.9L14 3Z"/><circle cx="12" cy="12" r="3"/></svg>
      </button>
      <details id="session-menu" class="session-menu">
        <summary class="icon-button" aria-label="${tx("sessionActions")}" title="${tx("sessionActions")}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></svg></summary>
        <div id="lifecycle-controls" class="action-menu">
          <button type="button" data-command="newChat" disabled>${tx("newChat")}</button>
          <button type="button" data-command="end" disabled>${tx("end")}</button>
        </div>
      </details>
    </header>
    <p id="view-error" class="view-notice error small" role="alert" hidden></p>
    <p id="view-notice" class="view-notice muted small" role="status" hidden></p>

    <section id="chat-scroll" class="chat-scroll" tabindex="0" aria-label="${tx("conversationAria")}">
      <section id="empty-session" class="chat-empty" aria-labelledby="empty-title">
        <svg class="empty-mark" viewBox="0 0 48 48" aria-hidden="true"><path d="M8 9h23a5 5 0 0 1 5 5v13a5 5 0 0 1-5 5H18L9 39v-7H8a5 5 0 0 1-5-5V14a5 5 0 0 1 5-5Z"/><path d="M40 19h1a4 4 0 0 1 4 4v15a4 4 0 0 1-4 4h-4v4l-6-4H21"/></svg>
        <h2 id="empty-title">${tx("startConversation")}</h2>
        <p>${tx("startConversationHelp")}</p>
      </section>
      <ol id="conversation" class="conversation" aria-label="${tx("conversationAria")}"></ol>
      <article id="stream-reply" class="chat-message coach-message" aria-label="${tx("currentReply")}" hidden>
        <div class="speaker"><span>${tx("roleCoach")}</span></div>
        <div id="stream-text" class="message-body"></div>
        <p id="tool-status" class="muted small" role="status" aria-live="polite"></p>
      </article>
    </section>
    <button id="new-messages" class="new-messages secondary" type="button" data-local="latest" hidden>${tx("newMessages")}</button>

    <form id="question-form" class="chat-composer" novalidate>
      <label class="sr-only" for="coach-question">${tx("askLabel")}</label>
      <div class="composer-input">
        <textarea id="coach-question" name="question" rows="1" required aria-describedby="composer-state question-error composer-keyboard-hint" placeholder="${tx("composerPlaceholder")}" disabled></textarea>
        <div class="composer-bottom">
          <div id="model-controls" class="composer-selectors" role="group" aria-label="${tx("modelControls")}" aria-busy="false">
            <span class="composer-role" title="${tx("pairRoleHelp")}">${tx("pairRole")}</span>
            <button id="select-model" type="button" class="composer-picker" data-command="selectModel" aria-haspopup="dialog" aria-label="${tx("selectModel", { model: uiText("model") })}" title="${tx("modelHelp")}" disabled>
              <span id="model-label" class="picker-label">${tx("model")}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
            </button>
            <button id="select-reasoning" type="button" class="composer-picker" data-command="selectReasoning" aria-haspopup="dialog" aria-describedby="reasoning-description" aria-label="${tx("selectReasoning", { level: uiText("reasoningDefault") })}" title="${tx("reasoningUnknown")}" disabled>
              <span id="reasoning-label" class="picker-label">${tx("reasoningLabel", { level: uiText("reasoningDefault") })}</span>
              <svg viewBox="0 0 16 16" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>
            </button>
            <span id="reasoning-description" class="sr-only">${tx("reasoningUnknown")}</span>
          </div>
          <div class="composer-actions">
            <button type="button" id="stop-reply" class="icon-button secondary" data-command="stopReply" aria-label="${tx("stopReply")}" title="${tx("stopReply")}" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="1"/></svg></button>
            <button type="submit" id="send-question" class="icon-button send-button" aria-label="${tx("ask")}" title="${tx("ask")}" disabled><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 19V5m-6 6 6-6 6 6"/></svg></button>
          </div>
        </div>
      </div>
      <p id="question-error" class="error small" role="alert" hidden></p>
      <div class="composer-meta">
        <p id="composer-state" class="muted small">${tx("connecting")}</p>
        <span id="composer-keyboard-hint" class="muted small keyboard-hint">${tx("composerHint")}</span>
      </div>
    </form>
    <footer id="ended-actions" class="ended-actions" hidden>
      <p class="muted small">${tx("closedComposer")}</p>
      <button type="button" data-command="newChat">${tx("newChat")}</button>
    </footer>
  </main>

  <dialog id="settings-dialog" aria-labelledby="settings-title">
    <header class="dialog-header">
      <h2 id="settings-title">${tx("settings")}</h2>
      <button id="close-settings" class="icon-button" type="button" data-local="closeSettings" aria-label="${tx("closeSettings")}" title="${tx("closeSettings")}" autofocus><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button>
    </header>
    <div id="settings-body" class="settings-body">
      <p id="settings-error" class="error small" role="alert" hidden></p>
      <section class="settings-section">
        <h3>${tx("driverTitle")}</h3>
        <p id="driver-status" class="muted"></p>
        <p id="driver-session" class="muted small" hidden></p>
        <p id="driver-availability" class="muted small" hidden></p>
        <div class="button-row">
          <button id="select-driver" class="secondary" type="button" data-command="selectDriver" disabled>${tx("selectDriver")}</button>
          <button id="disconnect-driver" class="secondary" type="button" data-command="disconnectDriver" hidden>${tx("disconnectDriver")}</button>
        </div>
        <p class="muted small">${tx("settingsConnectionHelp")}</p>
      </section>
      <section class="settings-section">
        <h3>${tx("projectTitle")}</h3>
        <p id="workspace-label"></p>
        <p class="muted small">${tx("projectHelp")}</p>
      </section>
    </div>
  </dialog>
  <script nonce="${nonce}" type="module" src="${attribute(options.scriptUri)}"></script>
</body>
</html>`;
}
