import test from "node:test";
import assert from "node:assert/strict";
import { createWebviewHtml } from "../src/ui/webview.js";
import { uiMessages, uiText } from "../src/ui/strings.js";

const options = {
  nonce: "0123456789abcdef", cspSource: "'self' https://*.vscode-cdn.net",
  styleUri: "https://fixture.vscode-cdn.net/styles.css",
  scriptUri: "https://fixture.vscode-cdn.net/webview-client.js",
};

test("chat opens with a composer, not a Start wizard or evidence workflow", () => {
  const html = createWebviewHtml(options);
  assert.match(html, /id="chat-scroll"/);
  assert.match(html, /id="question-form" class="chat-composer"/);
  assert.doesNotMatch(html, /data-command="(?:start|verifyConnection|pause|resume|confirmDirective|beginNextIteration|deleteRetained)"/);
  assert.doesNotMatch(html, /evidence-ledger|review-context|pending-directives/);
  assert.match(html, /data-command="newChat"/);
  assert.match(html, /data-command="end"/);
});

test("the empty state introduces AI pair programming rather than a question-and-answer service", () => {
  const html = createWebviewHtml(options);
  const emptyState = html.match(/<section id="empty-session"[\s\S]*?<\/section>/)?.[0];
  assert.ok(emptyState);
  assert.match(emptyState, /<h2 id="empty-title">AI와 함께하는 페어 프로그래밍<\/h2>/);
  assert.match(emptyState, /Wellactually는 AI와 함께 설계와 구현 방향을 논의하는 페어 프로그래밍 파트너입니다/);
  assert.match(emptyState, /프로젝트 폴더 전체를 읽기 전용으로 공유합니다/);
  assert.equal((emptyState.match(/<p(?:\s|>)/g) ?? []).length, 1);
  assert.equal("optionalDriver" in uiMessages, false);
  assert.doesNotMatch(Object.values(uiMessages).join("\n"), /질문|무엇을 함께 생각해|드라이버를 연결하지 않아도/);
  assert.match(html, /id="view-notice"[^>]*role="status"[^>]*hidden/);
  assert.match(html, /aria-label="메시지 보내기"/);
  assert.equal(uiText("askLabel"), "페어와 논의할 내용");
});

test("the selected Driver session and project information use an accessible native settings dialog", () => {
  const html = createWebviewHtml(options);
  const dialog = html.indexOf('<dialog id="settings-dialog"');
  assert.ok(dialog > html.indexOf('id="question-form"'));
  for (const id of ["driver-status", "workspace-label"]) {
    assert.ok(html.indexOf(`id="${id}"`) > dialog);
  }
  assert.match(html, /<dialog id="settings-dialog" aria-labelledby="settings-title"/);
  assert.match(html, /id="open-settings"[^>]*aria-haspopup="dialog"[^>]*aria-controls="settings-dialog"/);
  assert.match(html, /<label[^>]*for="coach-question"/);
  assert.match(html, /aria-describedby="composer-state question-error composer-keyboard-hint"/);
  assert.match(html, /id="question-error"[^>]*role="alert"/);
  assert.match(html, /id="close-settings"[^>]*aria-label="설정 닫기"/);
  assert.match(html, /id="close-settings"[^>]*autofocus/);
  assert.match(html, /data-command="disconnectDriver"/);
  assert.match(html, /드라이버 세션 선택/);
  assert.match(html, /숨김 파일과 민감한 파일도 포함됩니다/);
  assert.doesNotMatch(html, /드라이버 로그 선택/);
  assert.doesNotMatch(html, /language-setting|language-help|setLanguage|<select\b|<option\b/);
});

test("model and reasoning pickers share the rounded composer with a non-interactive read-only role", () => {
  const html = createWebviewHtml(options);
  const composer = html.match(/<form id="question-form"[\s\S]*?<\/form>/)?.[0];
  assert.ok(composer);
  assert.match(composer, /class="composer-input"[\s\S]*<textarea[\s\S]*class="composer-bottom"/);
  assert.match(composer, /<span class="composer-role"[^>]*>페어 · 읽기 전용<\/span>/);
  assert.match(composer, /id="model-controls"[^>]*role="group"[^>]*aria-label="페어 모델 설정"/);
  for (const [id, command] of [["select-model", "selectModel"], ["select-reasoning", "selectReasoning"]]) {
    assert.match(composer, new RegExp(`<button id="${id}" type="button"[^>]*data-command="${command}"[^>]*aria-haspopup="dialog"[^>]*disabled>`));
    assert.match(composer, new RegExp(`id="${id}"[\\s\\S]*?<svg[^>]*aria-hidden="true"`));
  }
  assert.match(composer, /id="select-model"[^>]*aria-label="모델 선택 · 현재 모델"/);
  assert.match(composer, /id="select-reasoning"[^>]*aria-describedby="reasoning-description"[^>]*aria-label="추론 수준 선택 · 현재 기본"/);
  assert.match(composer, /id="reasoning-label"[^>]*>추론: 기본<\/span>/);
  assert.match(composer, /class="composer-actions"[\s\S]*id="stop-reply"[\s\S]*id="send-question"/);
  assert.match(composer, /id="composer-keyboard-hint"/);
  assert.doesNotMatch(composer, /<select\b|<option\b|role="menu"|attachment|voice|agent-mode|data-command="[^"]*(?:execute|DriverInstruction)"/i);
});

test("ending keeps new chat and stop controls without a report workflow", () => {
  const html = createWebviewHtml(options);
  const dialog = html.indexOf('<dialog id="settings-dialog"');
  for (const id of ["stop-reply", "ended-actions"]) {
    assert.ok(html.indexOf(`id="${id}"`) >= 0 && html.indexOf(`id="${id}"`) < dialog);
  }
  assert.match(html, /id="stop-reply"[^>]*aria-label="응답 중단"/);
  assert.match(html, /id="ended-actions"/);
  assert.doesNotMatch(html, /report|보고서|지식 편찬|Compiler|compilation/i);
});

test("local assets use a nonce-only script policy and attribute text is escaped", () => {
  const html = createWebviewHtml({ ...options, styleUri: options.styleUri + '?x="<injected>&' });
  const policy = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)?.[1]?.replaceAll("&#39;", "'");
  assert.match(policy!, /default-src 'none'/);
  assert.match(policy!, /script-src 'nonce-0123456789abcdef' 'strict-dynamic'/);
  assert.match(policy!, /connect-src 'none'/);
  assert.match(policy!, /form-action 'none'/);
  assert.match(html, /styles\.css\?x=&quot;&lt;injected&gt;&amp;/);
  assert.match(html, /<script nonce="0123456789abcdef" type="module" src=/);
  assert.doesNotMatch(html, /unsafe-inline|unsafe-eval|onclick=|<injected>|command:|<iframe/);
  assert.throws(() => createWebviewHtml({ ...options, scriptUri: "javascript:alert(1)" }), /INVALID_WEBVIEW_OPTIONS/);
});

test("the single Korean catalog renders controls without a locale or preference", () => {
  for (const value of Object.values(uiMessages)) assert.match(value, /[가-힣]/);
  const html = createWebviewHtml(options);
  assert.match(html, /<html lang="ko">/);
  assert.match(html, /AI와 함께하는 페어 프로그래밍/);
  assert.match(html, /aria-label="사용자와 페어의 대화"/);
  assert.doesNotMatch(html, /코치|\bCoach\b/);
  assert.match(html, /aria-label="설정 열기"/);
  assert.doesNotMatch(html, /\b(?:English|Settings|Send question|Stop reply|Choose a language)\b/);
  assert.equal(uiText("sourceRead", { source: "src/OriginalEnglish.ts" }), "읽은 자료: src/OriginalEnglish.ts");
  assert.equal(uiText("driverSession", { sessionId: "Original-Session-ID" }), "세션: Original-Session-ID");
});
