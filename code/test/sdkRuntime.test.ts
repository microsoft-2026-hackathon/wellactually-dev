import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import path from "node:path";
import {
  authenticateClient, deadline, getHostGitHubToken, isolatedClientOptions, readSessionConfig, stopClient, withClientCleanupOnFailure,
} from "../src/runtime/sdkRuntime.js";

test("private runtime attempts ambient auth without exposing credentials or using default data storage", () => {
  const options = isolatedClientOptions("/synthetic/owned", undefined, {
    PATH: "/synthetic/bin", HOME: "/synthetic/home", NODE_OPTIONS: "--unsafe",
  });

  assert.equal(options.mode, "copilot-cli");
  assert.equal(options.useLoggedInUser, true);
  assert.equal(options.env?.HOME, "/synthetic/home");
  assert.equal(options.env?.NODE_OPTIONS, undefined);
  assert.equal(options.baseDirectory, "/synthetic/owned/state");
  const explicit = isolatedClientOptions("/synthetic/owned", { githubToken: "synthetic-token" }, {});
  assert.equal(explicit.mode, "empty");
  assert.equal(explicit.useLoggedInUser, false);
  assert.equal(explicit.gitHubToken, "synthetic-token");
  assert.equal(JSON.stringify(explicit.env).includes("synthetic-token"), false);
  assert.throws(() => isolatedClientOptions("/synthetic/owned", { githubToken: "" }), /COACH_AUTH_INVALID/);
});

test("host credentials are requested only when private runtime authentication is unavailable", async () => {
  const events: string[] = [];
  const open = async (auth?: { githubToken?: string }) => {
    events.push(auth ? "token-client" : "existing-client");
    return {
      async getAuthStatus() { events.push("auth-check"); return { isAuthenticated: !!auth }; },
      async stop() { events.push("stop"); return []; },
      async forceStop() {},
    };
  };
  await authenticateClient(open, async () => { events.push("host-auth"); return "synthetic"; });
  assert.deepEqual(events, ["existing-client", "auth-check", "stop", "host-auth", "token-client", "auth-check"]);
  let prompted = false;
  await authenticateClient(async () => ({
    async getAuthStatus() { return { isAuthenticated: true }; },
    async stop() { return []; },
    async forceStop() {},
  }), async () => { prompted = true; return undefined; });
  assert.equal(prompted, false);
  await assert.rejects(authenticateClient(open, async () => undefined), /COACH_AUTH_REQUIRED/);
});

test("cancelled host consent cannot open an authenticated client after a late approval", async () => {
  const controller = new AbortController();
  let approve!: (session: { accessToken: string }) => void;
  const consent = new Promise<{ accessToken: string }>(resolve => { approve = resolve; });
  const requests: boolean[] = [];
  const opened: boolean[] = [];
  const result = authenticateClient(async auth => {
    opened.push(!!auth);
    return {
      async getAuthStatus() { return { isAuthenticated: !!auth }; },
      async stop() { return []; },
      async forceStop() {},
    };
  }, () => getHostGitHubToken(controller.signal, async interactive => {
    requests.push(interactive);
    return interactive ? consent : undefined;
  }));
  const rejected = assert.rejects(result, /COACH_AUTH_REQUIRED/);
  await new Promise(resolve => setImmediate(resolve));
  assert.deepEqual(requests, [false, true]);
  controller.abort();
  approve({ accessToken: "synthetic-late-approval" });
  await rejected;
  assert.deepEqual(opened, [false]);
});

test("host authentication still reuses existing sessions and obtains active consent when needed", async () => {
  for (const existing of [true, false]) {
    const requests: boolean[] = [];
    const token = await getHostGitHubToken(new AbortController().signal, async interactive => {
      requests.push(interactive);
      return existing || interactive ? { accessToken: "synthetic-active-token" } : undefined;
    });
    assert.equal(token, "synthetic-active-token");
    assert.deepEqual(requests, existing ? [false] : [false, true]);
  }
  const stopped = new AbortController();
  stopped.abort();
  let calls = 0;
  assert.equal(await getHostGitHubToken(stopped.signal, async () => { calls++; return undefined; }), undefined);
  assert.equal(calls, 0);
});

test("persistent Pair customizes behavior without replacing SDK safety or read permissions", async () => {
  const directory = await mkdtemp(path.resolve(".sdk-config-"));
  try {
    const root = path.join(directory, "project");
    const storage = path.join(directory, "runtime");
    await mkdir(root);
    await mkdir(storage);
    const defaults = await readSessionConfig(root, storage);
    assert.equal(defaults.config.model, "claude-haiku-4.5");
    assert.equal(defaults.config.reasoningEffort, undefined);
    const reasoning = await readSessionConfig(root, storage, "synthetic-model", "high");
    assert.equal(reasoning.config.reasoningEffort, "high");
    const { config, policy } = await readSessionConfig(root, storage, "gpt-5-mini");
    assert.equal(config.model, "gpt-5-mini");
    assert.deepEqual(config.infiniteSessions, { enabled: true });
    assert.deepEqual(config.memory, { enabled: false });
    assert.deepEqual(config.availableTools, ["view", "grep"]);
    assert.deepEqual(config.additionalDirectories, []);
    for (const name of ["enableSkills", "enableConfigDiscovery", "enableSessionStore", "enableHostGitOperations", "enableOnDemandInstructionDiscovery"]) {
      assert.equal(config[name as keyof typeof config], false, name);
    }
    assert.deepEqual(config.mcpServers, {});
    assert.deepEqual(config.customAgents, []);
    assert.equal(config.systemMessage?.mode, "customize");
    assert.ok(config.systemMessage?.mode === "customize");
    const sections = config.systemMessage.sections;
    assert.deepEqual(Object.keys(sections ?? {}).sort(), ["identity", "tone", "tool_efficiency"]);
    for (const [section, filename] of [
      ["identity", "coach.md"], ["tone", "coach-tone.md"], ["tool_efficiency", "coach-tools.md"],
    ] as const) {
      assert.deepEqual(sections?.[section], {
        action: "replace", content: await readFile(`src/policies/${filename}`, "utf8"),
      });
    }
    assert.equal(sections?.safety, undefined);
    assert.equal(sections?.tool_instructions, undefined);
    assert.match(config.systemMessage.content ?? "", /Approved workspace directory:/);
    assert.match(config.systemMessage.content ?? "", /This role is Pair/);
    assert.doesNotMatch([
      config.systemMessage.content, ...Object.values(sections ?? {}).map(section => section.content),
    ].join("\n"), /\bCoach\b|코치/);
    assert.equal(config.hooks, policy.hooks);
    assert.equal(config.onPermissionRequest, policy.onPermissionRequest);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test("failed graceful shutdown remains a cleanup failure even if forceStop resolves", async () => {
  let stopped = 0;
  let forced = 0;
  const client = {
    async stop(): Promise<Error[]> { stopped++; return [new Error("DO_NOT_EXPOSE_TOKEN")]; },
    async forceStop() { forced++; },
  };
  await assert.rejects(withClientCleanupOnFailure(client, async () => {
    throw new Error("synthetic acquisition failure");
  }), /COACH_CLEANUP_FAILED$/);
  assert.equal(stopped, 1);
  assert.equal(forced, 1);
  await assert.rejects(stopClient(client), /COACH_CLEANUP_FAILED$/);
});

test("a late acquired SDK resource is disposed after its deadline", async () => {
  let finish!: (value: string) => void;
  let disposed = "";
  const resource = new Promise<string>(resolve => { finish = resolve; });
  await assert.rejects(deadline(resource, 1, "COACH_CREATE_TIMEOUT", async value => {
    disposed = value;
  }), /COACH_CREATE_TIMEOUT/);
  finish("late-session");
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(disposed, "late-session");
});

test("explicit host auth has priority over environment tokens without duplicating either in env", () => {
  const env = { GH_TOKEN: "synthetic-gh", COPILOT_GITHUB_TOKEN: "synthetic-copilot", NODE_OPTIONS: "--unsafe" };
  const existing = isolatedClientOptions("/synthetic/owned", undefined, env);
  assert.equal(existing.gitHubToken, "synthetic-copilot");
  const explicit = isolatedClientOptions("/synthetic/owned", { githubToken: "synthetic-host" }, env);
  assert.equal(explicit.gitHubToken, "synthetic-host");
  for (const name of Object.keys(env)) assert.equal(explicit.env?.[name], undefined);
});
