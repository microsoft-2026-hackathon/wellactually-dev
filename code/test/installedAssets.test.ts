import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

test("the extension includes executable entry points, policies, and the native SDK", () => {
  for (const filename of [
    "dist/src/extension.cjs", "dist/src/extension-main.js",
    "dist/src/ui/webview.js", "dist/src/ui/webview-client.js", "src/ui/styles.css",
    "src/agents/driver.agent.md", "src/policies/coach.md",
    "src/policies/coach-tone.md", "src/policies/coach-tools.md",
    "dist/src/ui/strings.js", "dist/src/format.js", "dist/src/hostMessages.js", "package.nls.json",
    "dist/src/ui/chatMessage.js", "media/coach.svg",
  ]) {
    assert.ok(existsSync(filename), `Missing package asset: ${filename}`);
  }
  for (const filename of ["dist/src/compilation", "dist/src/i18n", "src/policies/compiler.md", "package.nls.ko.json"]) {
    assert.equal(existsSync(filename), false, `Removed feature remains: ${filename}`);
  }
  const manifest = JSON.parse(readFileSync("package.json", "utf8"));
  assert.equal(manifest.main, "./dist/src/extension.cjs");
  assert.equal(manifest.engines.vscode, "^1.137.0");
  const entry = fileURLToPath(import.meta.resolve("@github/copilot-sdk"));
  const sdk = JSON.parse(readFileSync(path.join(path.dirname(entry), "..", "package.json"), "utf8"));
  assert.equal(sdk.version, "1.0.13");
  assert.ok(existsSync("node_modules/@github/copilot-sdk-darwin-arm64"));
});
