import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { pathToFileURL } from "node:url";
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
    const previous = { directory: path.join(directory, "previous"), sessionId: "previous", title: "Previous synthetic Driver" };
    const selected = { directory: path.join(directory, "selected"), sessionId: "selected", title: "Selected synthetic Driver" };
    await mkdir(previous.directory);
    await mkdir(selected.directory);
    const previousFile = path.join(previous.directory, "events.jsonl");
    const selectedFile = path.join(selected.directory, "events.jsonl");
    const driverMarker = `SYNTHETIC_DRIVER_${randomUUID()}`;
    await writeFile(previousFile, '{"text":"SYNTHETIC_PREVIOUS_DRIVER"}\n');
    await writeFile(selectedFile, JSON.stringify({ text: driverMarker }) + "\n");
    const catalog = await listPairModels(storage, async () => undefined, new AbortController().signal);
    assert.ok(catalog.length > 0);
    const target = catalog.find(model => model.id === "gpt-5.4");
    assert.ok(target, "The live check needs account access to gpt-5.4.");
    for (const effort of ["none", "low", "high"]) assert.ok(target.reasoningEfforts.some(item => item === effort));
    t.diagnostic(`Real model catalog normalized successfully (${catalog.length} choices).`);

    const client = await createAuthenticatedClient(storage);
    try {
      const { config, policy } = await readSessionConfig(project, ownedRuntimeDirectory(client), "claude-haiku-4.5");
      await policy.setDriver(previous);
      const session = await createSessionWithDeadline(client, config);
      try {
        const initialId = session.sessionId;
        const execute = async (name: string, args: Parameters<typeof session.rpc.tools.execute>[0]["arguments"]) => {
          const result = await deadline(session.rpc.tools.execute({
            name, arguments: args, toolCallId: randomUUID(),
          }), 10_000, "LIVE_TOOL_TIMEOUT");
          assert.ok(typeof result !== "string");
          return result;
        };
        assert.equal((await execute("view", { path: previousFile })).resultType, "success");
        await policy.setDriver(selected);
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
          for (const [source, marker] of [[file, "SYNTHETIC_MODEL_CONTROL_MARKER"], [selectedFile, driverMarker]] as const) {
            for (const result of [
              await execute("view", { path: source }),
              await execute(searchName, { pattern: marker, paths: source, output_mode: "content" }),
            ]) {
              assert.equal(result.resultType, "success", result.textResultForLlm);
              assert.ok(result.textResultForLlm?.includes(marker), result.textResultForLlm);
            }
          }
          for (const source of [directory, previous.directory, previousFile]) {
            assert.equal((await execute("view", { path: source })).resultType, "denied");
            assert.equal((await execute(searchName, { pattern: ".", paths: source })).resultType, "denied");
          }
          assert.deepEqual(policy.driver, selected);
          t.diagnostic(`Confirmed ${selection.modelId}/${selection.reasoningEffort ?? "default"} with view/${searchName}, selected Driver access and old-scope denial.`);
        }
      } finally { await session.disconnect(); }
    } finally { await stopClient(client); }

    const runtime = await createCoachRuntime({
      workspace: project, directory: storage, model: "claude-haiku-4.5", driver: previous,
    });
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
      await runtime.setDriver(selected);
      await runtime.setModel({ modelId: target.id, reasoningEffort: "high" });
      await runtime.setModel({ modelId: target.id, reasoningEffort: "none" });
      assert.equal(runtime.sessionId, id);
      let second = "";
      let driverRead = false;
      for await (const delta of runtime.stream(
        `합성 읽기 테스트입니다. view 도구로 현재 선택된 Driver 기록 ${selectedFile}을 읽으세요. ` +
          "앞서 알려준 테스트 단어와 파일의 text 값만 답하세요.",
        new AbortController().signal,
      )) {
        if (delta.kind === "text") second += delta.text;
        if (delta.kind === "source" && delta.message.source === pathToFileURL(selectedFile).href &&
            delta.message.text.includes(driverMarker)) driverRead = true;
      }
      assert.match(second, /파란별/);
      assert.ok(second.includes(driverMarker), second);
      assert.equal(driverRead, true, "The switched production runtime must actually read the selected Driver.");
      assert.equal(runtime.closed, false);
      t.diagnostic("Production Pair runtime retained the synthetic word and read the selected Driver after switching.");
    } finally { await runtime.close(); }

    const noReasoning = await createCoachRuntime({
      workspace: project, directory: storage, model: target.id, reasoningEffort: "none",
    });
    await noReasoning.close();
    t.diagnostic("Startup with an explicit none preference also succeeded.");
  } finally { await rm(directory, { recursive: true, force: true }); }
});
