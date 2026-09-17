import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { createCoachRuntime } from "../src/runtime/coachRuntime.js";
import {
  assertSessionTools, createAuthenticatedClient, createSessionWithDeadline,
  deadline, listPairModels, ownedRuntimeDirectory, readSessionConfig, stopClient,
} from "../src/runtime/sdkRuntime.js";
import type { ModelSelection } from "../src/contracts.js";
import { isReadToolInventory } from "../src/runtime/readPolicy.js";

test("authenticated model controls list real options, switch effort, keep read restrictions and retain conversation", {
  skip: process.env.WELLACTUALLY_LIVE_MODEL_CHECK !== "1",
  timeout: 180_000,
}, async t => {
  const directory = await mkdtemp(path.resolve(".model-controls-live-"));
  try {
    const project = path.join(directory, "project");
    const storage = path.join(directory, "runtime");
    await mkdir(project);
    const file = path.join(project, "facts.md");
    await writeFile(file, "SYNTHETIC_MODEL_CONTROL_MARKER\n");
    const catalog = await listPairModels(storage, async () => undefined, new AbortController().signal);
    assert.ok(catalog.length > 0);
    const target = catalog.find(model => model.id === "gpt-5.4");
    assert.ok(target, "The live check needs account access to gpt-5.4.");
    for (const effort of ["none", "low", "high"]) assert.ok(target.reasoningEfforts.some(item => item === effort));
    t.diagnostic(`Real model catalog normalized successfully (${catalog.length} choices).`);

    const client = await createAuthenticatedClient(storage);
    try {
      const { config } = await readSessionConfig(project, ownedRuntimeDirectory(client), "claude-haiku-4.5");
      const session = await createSessionWithDeadline(client, config);
      try {
        const initialId = session.sessionId;
        const changes: ModelSelection[] = [
          { modelId: target.id, reasoningEffort: "low" },
          { modelId: target.id, reasoningEffort: "high" },
          { modelId: target.id, reasoningEffort: "none" },
          { modelId: "claude-haiku-4.5" },
          { modelId: "auto" },
        ];
        for (const selection of changes) {
          const outcome = await deadline(session.rpc.model.switchTo(selection), 20_000, "LIVE_SWITCH_TIMEOUT");
          assert.equal(outcome.deferred, false);
          const current = await session.rpc.model.getCurrent();
          assert.equal(current.modelId, selection.modelId);
          if (selection.reasoningEffort) assert.equal(current.reasoningEffort, selection.reasoningEffort);
          assert.equal(session.sessionId, initialId);
          await assertSessionTools(session);
          const names = (await session.rpc.tools.getCurrentMetadata()).tools?.map(tool => tool.name);
          assert.equal(isReadToolInventory(names), true);
          const searchName = names?.find(name => name === "grep" || name === "rg");
          assert.ok(searchName);
          const result = await session.rpc.tools.execute({
            name: searchName, toolCallId: randomUUID(),
            arguments: { pattern: "SYNTHETIC_MODEL_CONTROL_MARKER", paths: file, output_mode: "content" },
          });
          assert.ok(typeof result !== "string");
          assert.equal(result.resultType, "success");
          assert.match(result.textResultForLlm ?? "", /SYNTHETIC_MODEL_CONTROL_MARKER/);
          const blocked = await session.rpc.tools.execute({
            name: "view", toolCallId: randomUUID(), arguments: { path: directory },
          });
          assert.ok(typeof blocked !== "string");
          assert.notEqual(blocked.resultType, "success");
          t.diagnostic(`Confirmed ${selection.modelId}/${selection.reasoningEffort ?? "default"} with view/${searchName}.`);
        }
      } finally { await session.disconnect(); }
    } finally { await stopClient(client); }

    const runtime = await createCoachRuntime({ workspace: project, directory: storage, model: "claude-haiku-4.5" });
    try {
      const id = runtime.sessionId;
      let first = "";
      for await (const delta of runtime.stream(
        "합성 연결 테스트입니다. 이 대화의 테스트 단어는 '파란별'입니다. 도구를 사용하지 말고 '기억했습니다'라고만 답하세요.",
        new AbortController().signal,
      )) if (delta.kind === "text") first += delta.text;
      assert.match(first, /기억/);
      await assert.rejects(runtime.setModel({ modelId: "claude-haiku-4.5", reasoningEffort: "none" }),
        /COACH_REASONING_UNSUPPORTED/);
      assert.equal(runtime.closed, false);
      await runtime.setModel({ modelId: target.id, reasoningEffort: "high" });
      await runtime.setModel({ modelId: target.id, reasoningEffort: "none" });
      assert.equal(runtime.sessionId, id);
      let second = "";
      for await (const delta of runtime.stream(
        "앞서 알려준 합성 테스트 단어만 답하세요. 도구는 사용하지 마세요.",
        new AbortController().signal,
      )) if (delta.kind === "text") second += delta.text;
      assert.match(second, /파란별/);
      assert.equal(runtime.closed, false);
      t.diagnostic("Production Pair runtime returned both model responses and retained the synthetic word after switching.");
    } finally { await runtime.close(); }

    const noReasoning = await createCoachRuntime({
      workspace: project, directory: storage, model: target.id, reasoningEffort: "none",
    });
    await noReasoning.close();
    t.diagnostic("Startup with an explicit none preference also succeeded.");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
