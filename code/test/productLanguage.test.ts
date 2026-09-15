import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatMessage } from "../src/format.js";
import { record } from "../src/validation.js";
import { hostText } from "../src/hostMessages.js";
import { uiMessages } from "../src/ui/strings.js";

test("the assistant is Pair in English and Korean without renaming Wellactually or stable view IDs", () => {
  const manifest = record(JSON.parse(readFileSync("package.json", "utf8")));
  assert.equal(manifest.name, "wellactually");
  assert.equal(manifest.displayName, "Wellactually");
  assert.equal(manifest.publisher, "wellactually-local");
  const captions = record(JSON.parse(readFileSync("package.nls.json", "utf8")));
  assert.equal(captions["command.open"], "Wellactually: 페어 열기");
  assert.equal(captions["view.coach"], "페어");
  assert.equal(captions["container.coach"], "페어");
  assert.equal(uiMessages.title, "Wellactually 페어");
  assert.equal(uiMessages.roleCoach, "페어");
  for (const value of [...Object.values(captions), ...Object.values(uiMessages)]) {
    assert.doesNotMatch(String(value), /코치|\bCoach\b/);
  }
  for (const key of ["authDetail", "noWorkspace", "driverSessionScope", "driverConnected", "connecting"] as const) {
    assert.match(hostText(key), /페어/);
    assert.doesNotMatch(hostText(key), /코치|\bCoach\b/);
  }
  const identity = readFileSync("src/policies/coach.md", "utf8");
  assert.match(identity, /Wellactually's AI Pair/);
  for (const filename of [
    "src/policies/coach.md", "src/policies/coach-tone.md",
    "src/policies/coach-tools.md", "src/agents/driver.agent.md",
  ]) {
    assert.doesNotMatch(readFileSync(filename, "utf8"), /코치|\bCoach\b/, filename);
  }
});

test("the product exposes Korean native captions and no language preference", () => {
  const manifest = record(JSON.parse(readFileSync("package.json", "utf8")));
  const properties = record(record(record(manifest.contributes).configuration).properties);
  assert.deepEqual(Object.keys(properties), ["wellactually.model"]);
  const captions = record(JSON.parse(readFileSync("package.nls.json", "utf8")));
  for (const match of JSON.stringify(manifest).matchAll(/%([^%]+)%/g)) {
    assert.equal(typeof captions[match[1]!], "string");
    assert.match(String(captions[match[1]!]), /[가-힣]/);
  }
  assert.match(hostText("connecting"), /페어/);
  assert.match(hostText("failed", { code: "SYNTHETIC_ERROR" }), /SYNTHETIC_ERROR/);
});

test("formatting preserves inserted source text without interpreting its placeholders", () => {
  assert.equal(formatMessage("{count}: {text}", { count: 2, text: "<code>{unchanged}</code>" }),
    "2: <code>{unchanged}</code>");
  assert.throws(() => formatMessage("{missing}"), /MISSING_TRANSLATION_ARGUMENT/);
});
