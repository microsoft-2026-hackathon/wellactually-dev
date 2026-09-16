import type { ModelInfo } from "@github/copilot-sdk";
import type { ModelSelection, PairModel, ReasoningEffort } from "../contracts.js";
import { isRecord } from "../validation.js";

export const DEFAULT_PAIR_MODEL = "claude-haiku-4.5";
const modelIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const efforts: readonly ReasoningEffort[] = ["low", "medium", "high", "xhigh", "max"];

export function readModelSelection(value: unknown): ModelSelection {
  if (!isRecord(value) || typeof value.modelId !== "string" || !modelIdPattern.test(value.modelId)) {
    throw new Error("COACH_MODEL_INVALID");
  }
  if (value.reasoningEffort !== undefined && !efforts.some(effort => effort === value.reasoningEffort)) {
    throw new Error("COACH_REASONING_INVALID");
  }
  const reasoningEffort = efforts.find(effort => effort === value.reasoningEffort);
  return { modelId: value.modelId, ...(reasoningEffort ? { reasoningEffort } : {}) };
}

export function pairModels(models: readonly ModelInfo[]): PairModel[] {
  const result: PairModel[] = [];
  for (const model of models) {
    if (model.policy?.state === "disabled") continue;
    if (!modelIdPattern.test(model.id) || !model.name?.trim()) throw new Error("COACH_MODEL_CATALOG_INVALID");
    const supported = model.capabilities.supports.reasoningEffort ? model.supportedReasoningEfforts ?? [] : [];
    if (supported.some(effort => !efforts.includes(effort)) ||
        (model.defaultReasoningEffort && !supported.includes(model.defaultReasoningEffort))) {
      throw new Error("COACH_MODEL_CATALOG_INVALID");
    }
    result.push({
      id: model.id, name: model.name, reasoningEfforts: [...new Set(supported)],
      ...(model.defaultReasoningEffort ? { defaultReasoningEffort: model.defaultReasoningEffort } : {}),
    });
  }
  if (!result.length) throw new Error("COACH_MODEL_CATALOG_EMPTY");
  return result.sort((a, b) => a.name.localeCompare(b.name));
}

export function validateModelSelection(selection: ModelSelection, models: readonly PairModel[]): PairModel {
  readModelSelection(selection);
  const model = models.find(item => item.id === selection.modelId);
  if (!model) throw new Error("COACH_MODEL_UNAVAILABLE");
  if (selection.reasoningEffort && !model.reasoningEfforts.includes(selection.reasoningEffort)) {
    throw new Error("COACH_REASONING_UNSUPPORTED");
  }
  return model;
}

export function defaultModelSelection(model: PairModel): ModelSelection {
  return {
    modelId: model.id,
    ...(model.defaultReasoningEffort ? { reasoningEffort: model.defaultReasoningEffort } : {}),
  };
}
