import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { formatMessage } from "../src/format.js";
import { record } from "../src/validation.js";
import { hostFailureText, hostText } from "../src/hostMessages.js";
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

test("unverified cleanup gives explicit recovery guidance without hiding its failure code", () => {
  const message = hostFailureText("COACH_CLEANUP_FAILED");
  assert.match(message, /COACH_CLEANUP_FAILED/);
  assert.match(message, /새 대화/);
  assert.match(message, /진행 중인 작업을 확인/);
  assert.match(message, /창을 다시 로드/);
  assert.equal(hostFailureText("OTHER_FAILED"), hostText("failed", { code: "OTHER_FAILED" }));
});

test("the Driver picker describes all sessions and explains records that are not ready", () => {
  assert.match(hostText("chooseDriver", { count: 42 }), /전체 42개/);
  assert.match(hostText("driverSessionScope"), /일반 Copilot Chat.*전체 프로젝트/);
  assert.equal(hostText("driverChatSource"), "VS Code Copilot Chat");
  assert.doesNotMatch(hostText("driverSessionScope"), /현재 프로젝트.*먼저/);
  assert.match(hostText("driverNoRecords"), /로컬 대화 기록 없음/);
  const message = hostFailureText("DRIVER_SESSION_NOT_READY");
  assert.match(message, /DRIVER_SESSION_NOT_READY/);
  assert.match(message, /해당 세션에서 대화를 시작/);
});

test("model selection failures distinguish unavailable reasoning, unconfirmed changes and preference saving", () => {
  assert.match(hostFailureText("COACH_REASONING_UNAVAILABLE"), /선택 가능한 추론 수준/);
  assert.match(hostFailureText("COACH_MODEL_SWITCH_FAILED"), /현재 대화를 종료/);
  assert.match(hostFailureText("COACH_MODEL_SWITCH_FAILED"), /새 대화/);
  assert.match(hostFailureText("COACH_MODEL_PREFERENCE_SAVE_FAILED"), /이번 대화에 적용/);
  assert.match(hostFailureText("COACH_MODEL_PREFERENCE_SAVE_FAILED"), /저장하지 못했습니다/);
});

test("frontier-model guidance is conditional and mentions the speed and usage tradeoff", () => {
  const message = hostText("modelRecommendation");
  assert.match(message, /복잡한 설계 논의/);
  assert.match(message, /고성능\(프론티어\) 모델을 권장/);
  assert.match(message, /응답 속도와 사용량/);
  assert.doesNotMatch(message, /필수|항상|보장/);
});
