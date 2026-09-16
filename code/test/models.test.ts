import test from "node:test";
import assert from "node:assert/strict";
import type { ModelInfo } from "@github/copilot-sdk";
import { defaultModelSelection, pairModels, readModelSelection, validateModelSelection } from "../src/runtime/models.js";

function model(overrides: Partial<ModelInfo> = {}): ModelInfo {
  return {
    id: "synthetic-reasoner", name: "Synthetic reasoner",
    capabilities: { supports: { vision: false, reasoningEffort: true }, limits: { max_context_window_tokens: 100_000 } },
    supportedReasoningEfforts: ["low", "high", "max"], defaultReasoningEffort: "low",
    ...overrides,
  };
}

test("model controls use actual supported efforts and exclude policy-disabled models", () => {
  const catalog = pairModels([
    model(),
    model({ id: "disabled", policy: { state: "disabled", terms: "" } }),
    {
      id: "synthetic-simple", name: "A simple model",
      capabilities: { supports: { vision: false, reasoningEffort: false }, limits: { max_context_window_tokens: 8000 } },
    },
  ]);
  assert.deepEqual(catalog.map(item => item.id), ["synthetic-simple", "synthetic-reasoner"]);
  assert.deepEqual(catalog[0]?.reasoningEfforts, []);
  assert.deepEqual(catalog[1]?.reasoningEfforts, ["low", "high", "max"]);
  assert.deepEqual(defaultModelSelection(catalog[1]!), { modelId: "synthetic-reasoner", reasoningEffort: "low" });
  assert.deepEqual(defaultModelSelection(catalog[0]!), { modelId: "synthetic-simple" });
  assert.equal(validateModelSelection({ modelId: "synthetic-reasoner", reasoningEffort: "high" }, catalog).id,
    "synthetic-reasoner");
  assert.throws(() => validateModelSelection({ modelId: "synthetic-reasoner", reasoningEffort: "medium" }, catalog),
    /COACH_REASONING_UNSUPPORTED/);
  assert.throws(() => validateModelSelection({ modelId: "disabled" }, catalog), /COACH_MODEL_UNAVAILABLE/);
  assert.throws(() => validateModelSelection({ modelId: "synthetic-simple", reasoningEffort: "low" }, catalog),
    /COACH_REASONING_UNSUPPORTED/);
});

test("saved selections and inconsistent model capabilities fail explicitly", () => {
  for (const value of [null, {}, { modelId: "" }, { modelId: "bad\nid" }, { modelId: "ok", reasoningEffort: "invented" }]) {
    assert.throws(() => readModelSelection(value), /COACH_MODEL_INVALID|COACH_REASONING_INVALID/);
  }
  assert.deepEqual(readModelSelection({ modelId: "synthetic", reasoningEffort: "xhigh" }),
    { modelId: "synthetic", reasoningEffort: "xhigh" });
  assert.throws(() => pairModels([]), /COACH_MODEL_CATALOG_EMPTY/);
  assert.throws(() => pairModels([model({ defaultReasoningEffort: "medium" })]), /COACH_MODEL_CATALOG_INVALID/);
  assert.throws(() => pairModels([model({ id: "invalid\nid" })]), /COACH_MODEL_CATALOG_INVALID/);
});
