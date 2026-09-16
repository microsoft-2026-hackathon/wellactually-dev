import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { record } from "../src/validation.js";
import { parseViewCommand } from "../src/ui/messages.js";

test("Pair has a dedicated secondary-sidebar container instead of an Explorer view", () => {
  const manifest = record(JSON.parse(readFileSync("package.json", "utf8")));
  const contributes = record(manifest.contributes);
  const containers = record(contributes.viewsContainers).secondarySidebar;
  assert.ok(Array.isArray(containers));
  const container = containers.map(value => record(value)).find(value => value.id === "wellactually-coach");
  assert.ok(container);
  assert.equal(typeof container.icon, "string");
  assert.ok(existsSync(String(container.icon)));
  const views = record(contributes.views);
  assert.equal(views.explorer, undefined);
  assert.deepEqual(views["wellactually-coach"], [{ type: "webview", id: "wellactually.coach", name: "%view.coach%" }]);
});

test("the extension opens the idle Pair view without a separate Start command", () => {
  const manifest = record(JSON.parse(readFileSync("package.json", "utf8")));
  assert.deepEqual(manifest.activationEvents, ["onView:wellactually.coach", "onCommand:wellactually.open"]);
  assert.deepEqual(record(manifest.contributes).commands, [
    { command: "wellactually.open", title: "%command.open%" },
  ]);
});

test("the extension exposes no language setting and the view cannot request one", () => {
  const manifest = record(JSON.parse(readFileSync("package.json", "utf8")));
  const configuration = record(record(manifest.contributes).configuration);
  assert.equal(record(configuration.properties)["wellactually.language"], undefined);
  for (const language of ["auto", "en", "ko", "fr"]) {
    assert.throws(() => parseViewCommand({ type: "setLanguage", requestId: "r", language }), /INVALID_VIEW_COMMAND/);
  }
});
