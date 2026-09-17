import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod/v4";
import { createArticle, planArticle, selectWorkspace } from "./save.mjs";

const server = new McpServer({ name: "wellactually-knowledge", version: "0.1.0" });

server.registerTool("saveKnowledge", {
  title: "Save Knowledge Article",
  description: "Save a requested engineering article as NEW Markdown under a client workspace's .wellactually/knowledge directory. Requires host roots and an explicit human confirmation through MCP form elicitation on every call. Never edits or overwrites files. No shell, model calls, or network access. Supply the finished article body without frontmatter. Do not retry after denial.",
  inputSchema: z.object({
    title: z.string().min(1).max(200),
    markdown: z.string().min(1).max(200_000),
    tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)).max(10).default([]),
    workspaceUri: z.string().optional().describe("Exact file URI of the task workspace from host context; must match a client root. Required when more than one root exists. Never use the plugin directory."),
  }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (input, extra) => {
  try {
    const capabilities = server.server.getClientCapabilities();
    if (!capabilities?.roots || !capabilities?.elicitation?.form) {
      throw new Error("Saving requires client workspace roots and form elicitation for human approval. No file was created; do not fall back to general writing tools.");
    }
    const options = { signal: extra.signal, relatedRequestId: extra.requestId };
    const { roots } = await server.server.listRoots({}, options);
    const plan = planArticle(input, roots);
    const confirmation = await server.server.elicitInput({
      mode: "form",
      message: `Create one new Knowledge Markdown file?\n\nTitle: ${input.title}\nDestination: ${plan.path}\nSize: ${Buffer.byteLength(plan.content, "utf8")} bytes\n\nExisting files will not be changed.`,
      requestedSchema: {
        type: "object",
        properties: { save: { type: "boolean", title: "Save this article", default: false } },
        required: ["save"],
      },
    }, { ...options, timeout: 300_000 });
    if (confirmation.action !== "accept" || confirmation.content?.save !== true) {
      return { content: [{ type: "text", text: "Save declined or cancelled. No file was created. Do not retry without a new user request." }] };
    }
    const currentRoots = await server.server.listRoots({}, options);
    const currentWorkspace = selectWorkspace(currentRoots.roots, plan.workspace.uri);
    if (currentWorkspace.path !== plan.workspace.path) throw new Error("Workspace changed while awaiting approval.");
    extra.signal.throwIfAborted();
    const saved = createArticle(plan);
    return { content: [{ type: "text", text: `Saved new Knowledge article: ${saved.path}\n${saved.uri}` }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: `Knowledge save failed: ${error.message}. Do not retry automatically or use general writing tools. If a write began before an I/O error, a partial new file may remain; existing files were not overwritten.` }] };
  }
});

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});