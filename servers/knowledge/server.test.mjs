import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import test from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { ElicitRequestSchema, ListRootsRequestSchema } from "@modelcontextprotocol/sdk/types.js";

const entry = process.env.KNOWLEDGE_SERVER ?? fileURLToPath(new URL("../../dist/knowledge/server.cjs", import.meta.url));
const article = {
  title: "A bounded decision",
  markdown: "# A bounded decision\n\nTests were not run.",
  tags: ["design"],
};

async function fixture(context, capabilities = { roots: {}, elicitation: { form: {} } }) {
  const root = mkdtempSync(join(tmpdir(), "knowledge-mcp-"));
  const workspace = join(root, "workspace");
  mkdirSync(workspace);
  const input = { ...article, workspaceUri: pathToFileURL(workspace).href };
  const state = {
    roots: [{ uri: input.workspaceUri }],
    confirmations: [],
    result: { action: "accept", content: { save: true } },
  };
  const client = new Client({ name: "knowledge-test", version: "1.0.0" }, { capabilities });
  context.after(async () => {
    await client.close();
    rmSync(root, { recursive: true, force: true });
  });
  if (capabilities.roots) client.setRequestHandler(ListRootsRequestSchema, () => ({ roots: state.roots }));
  if (capabilities.elicitation) client.setRequestHandler(ElicitRequestSchema, (request) => {
    state.confirmations.push(request.params);
    return typeof state.result === "function" ? state.result() : state.result;
  });
  await client.connect(new StdioClientTransport({ command: process.execPath, args: [resolve(entry)], cwd: root, stderr: "pipe" }));
  return {
    client,
    state,
    workspace,
    root,
    input,
    call: (arguments_ = input) => client.callTool({
      name: "saveKnowledge",
      arguments: arguments_,
    }),
  };
}

test("MCP exposes only saveKnowledge and confirms each new save under the client root", async (context) => {
  const { client, state, workspace, root, call } = await fixture(context);
  assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name), ["saveKnowledge"]);
  for (let count = 0; count < 2; count++) {
    const result = await call();
    assert.notEqual(result.isError, true, JSON.stringify(result));
    assert.match(result.content[0].text, /Saved new Knowledge article/);
  }
  const directory = join(workspace, ".wellactually", "knowledge");
  assert.equal(readdirSync(directory).length, 2);
  assert.equal(state.confirmations.length, 2);
  assert.equal(state.confirmations[0].requestedSchema.properties.save.default, false);
  assert.match(state.confirmations[0].message, /Destination:/);
  assert.equal(existsSync(join(root, ".wellactually")), false);
  assert.match(readFileSync(join(directory, readdirSync(directory)[0]), "utf8"), /Tests were not run/);
});

test("decline, cancel, false and malformed acceptance do not write", async (context) => {
  const { state, workspace, call } = await fixture(context);
  for (const result of [{ action: "decline" }, { action: "cancel" }, { action: "accept", content: { save: false } }, { action: "accept" }]) {
    state.result = result;
    assert.doesNotMatch(JSON.stringify(await call()), /Saved new Knowledge article/);
    assert.equal(existsSync(join(workspace, ".wellactually")), false);
  }
});

test("Agent Host fallback uses the explicit workspace URI without form elicitation", async (context) => {
  const { call, workspace, state } = await fixture(context, {});
  const result = await call();
  assert.notEqual(result.isError, true, JSON.stringify(result));
  assert.equal(state.confirmations.length, 0);
  assert.equal(readdirSync(join(workspace, ".wellactually", "knowledge")).length, 1);
});

test("Agent Host fallback rejects the plugin installation", async (context) => {
  const { call, state, input } = await fixture(context, {});
  const pluginRoot = resolve(dirname(entry), "../..");
  const result = await call({ ...input, workspaceUri: pathToFileURL(pluginRoot).href });
  assert.equal(result.isError, true);
  assert.equal(state.confirmations.length, 0);
});

test("roots remain enforced when form elicitation is unavailable", async (context) => {
  const { call, workspace, state, root } = await fixture(context, { roots: {} });
  assert.notEqual((await call()).isError, true);
  assert.equal(state.confirmations.length, 0);
  rmSync(join(workspace, ".wellactually"), { recursive: true });
  const other = join(root, "other");
  mkdirSync(other);
  state.roots = [{ uri: pathToFileURL(other).href }];
  assert.equal((await call()).isError, true);
  assert.equal(existsSync(join(workspace, ".wellactually")), false);
});

test("empty elicitation capability is treated as form support", async (context) => {
  const { call, state } = await fixture(context, { roots: {}, elicitation: {} });
  assert.notEqual((await call()).isError, true);
  assert.equal(state.confirmations.length, 1);
});

test("arbitrary paths, extra parameters and missing workspace URI do not write", async (context) => {
  const { call, workspace, state, input } = await fixture(context);
  for (const invalid of [
    { ...input, workspaceUri: "file:///arbitrary" },
    { ...input, path: "/arbitrary.md" },
    { ...input, approved: true },
    article,
  ]) {
    assert.equal((await call(invalid)).isError, true);
  }
  assert.equal(state.confirmations.length, 0);
  assert.equal(existsSync(join(workspace, ".wellactually")), false);
});

test("workspace removed during approval does not receive a file", async (context) => {
  const { call, workspace, state } = await fixture(context);
  state.result = () => {
    state.roots = [];
    return { action: "accept", content: { save: true } };
  };
  assert.equal((await call()).isError, true);
  assert.equal(existsSync(join(workspace, ".wellactually")), false);
});