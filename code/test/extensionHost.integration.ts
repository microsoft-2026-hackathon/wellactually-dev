import * as vscode from "vscode";
import assert from "node:assert/strict";
import { writeFile } from "node:fs/promises";
import type { ExtensionApi } from "../src/extension-main.js";

export async function run(): Promise<void> {
  const extension = vscode.extensions.getExtension<ExtensionApi>("wellactually-local.wellactually");
  assert.ok(extension, "The installed extension must be discoverable.");
  const api = await extension.activate();
  assert.ok(extension.isActive);
  const state = api.getState();
  assert.equal(state.chat.status, "idle");
  assert.equal(state.starting, false);
  assert.equal(state.selectingDriver, false);
  assert.equal(state.model.busy, false);
  assert.equal(state.model.id, "claude-haiku-4.5");
  assert.equal(state.chat.messages.length, 0);
  assert.equal("report" in state, false);
  assert.equal("language" in state, false);
  assert.equal(state.notice, "");
  const commands = await vscode.commands.getCommands(true);
  assert.ok(commands.includes("wellactually.open"));
  assert.ok(!commands.includes("wellactually.verifyConnection"));
  const probePanel = vscode.window.createWebviewPanel("wellactually.cspProbe", "Webview CSP inspection", vscode.ViewColumn.Active, { enableScripts: false });
  const cspSource = probePanel.webview.cspSource;
  probePanel.dispose();
  const evidencePath = process.env.WELLACTUALLY_HOST_EVIDENCE;
  if (evidencePath) await writeFile(`${evidencePath}.csp.json`, JSON.stringify({ cspSource }), { mode: 0o600 });
  await vscode.commands.executeCommand("wellactually.coach.focus");
  await api.waitForViewReady();
  const configuration = vscode.workspace.getConfiguration("wellactually");
  assert.equal(configuration.has("language"), false);
  assert.equal(configuration.inspect("language")?.defaultValue, undefined);
  assert.ok(api.getState().workspaceLabel);
  const file = process.env.WELLACTUALLY_HOST_EVIDENCE;
  if (file) {
    await writeFile(file, JSON.stringify({
      verified: true, scope: "extension-host-activation-only",
      vscodeVersion: vscode.version, extensionHostNode: process.version,
      platform: process.platform, arch: process.arch, extensionPath: extension.extensionPath,
      inactiveUntilFirstMessage: true, webviewReady: true, liveModelCalls: false,
      language: "ko", languageSelection: false, knowledgeCompilation: false,
    }), { mode: 0o600 });
  }
  await api.shutdown();
}
