import type { ModelSelection, PairModel, ReasoningEffort } from "../contracts.js";
import { isRecord } from "../validation.js";

export const DEFAULT_PAIR_MODEL = "claude-haiku-4.5";
const modelIdPattern = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const efforts: readonly ReasoningEffort[] = ["none", "low", "medium", "high", "xhigh", "max"];

function isReasoningEffort(value: unknown): value is ReasoningEffort {
  return efforts.some(effort => effort === value);
}

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

export function pairModels(models: readonly unknown[]): PairModel[] {
  const result: PairModel[] = [];
  for (const model of models) {
    if (!isRecord(model)) throw new Error("COACH_MODEL_CATALOG_INVALID");
    if (isRecord(model.policy) && model.policy.state === "disabled") continue;
    if (typeof model.id !== "string" || !modelIdPattern.test(model.id) ||
        typeof model.name !== "string" || !model.name.trim()) throw new Error("COACH_MODEL_CATALOG_INVALID");
    const capabilities = isRecord(model.capabilities) && isRecord(model.capabilities.supports)
      ? model.capabilities.supports : undefined;
    if (!capabilities && model.id !== "auto") throw new Error("COACH_MODEL_CATALOG_INVALID");
    const supported: unknown = capabilities?.reasoningEffort === true ? model.supportedReasoningEfforts ?? [] : [];
    if (!Array.isArray(supported) || !supported.every(isReasoningEffort) ||
        (model.defaultReasoningEffort !== undefined && model.defaultReasoningEffort !== null &&
          (!isReasoningEffort(model.defaultReasoningEffort) || !supported.includes(model.defaultReasoningEffort)))) {
      throw new Error("COACH_MODEL_CATALOG_INVALID");
    }
    result.push({
      id: model.id, name: model.name, reasoningEfforts: [...new Set(supported)],
      ...(isReasoningEffort(model.defaultReasoningEffort) ? { defaultReasoningEffort: model.defaultReasoningEffort } : {}),
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
