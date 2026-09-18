import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { dirname, resolve } from "node:path";
import { z } from "zod/v4";
import { assertSeparateWorkspace, createArticle, planArticle, selectWorkspace } from "./save.mjs";

const server = new McpServer({ name: "wellactually-knowledge", version: "0.1.0" });
const pluginRoot = process.env.PLUGIN_ROOT ??
  (process.argv[1] ? resolve(dirname(process.argv[1]), "../..") : undefined);

function supportsFormElicitation(capabilities) {
  const elicitation = capabilities?.elicitation;
  if (!elicitation) return false;
  return Object.keys(elicitation).length === 0 || elicitation.form !== undefined;
}

server.registerTool("saveKnowledge", {
  title: "Save Knowledge Article",
  description: "Save an explicitly requested engineering article as a NEW Markdown file plus a matching read-only HTML copy under the current session workspace's .wellactually/knowledge directory. The HTML is rendered deterministically by this server from the supplied Markdown; never author HTML yourself. Supply the exact workspace file URI from get_current_session. Host roots are enforced when available, and MCP form confirmation is requested when supported. Never edits or overwrites files. No shell, model calls, or network access. Supply the finished article body without frontmatter. Do not retry after denial.",
  inputSchema: z.object({
    title: z.string().min(1).max(200),
    markdown: z.string().min(1).max(200_000),
    tags: z.array(z.string().regex(/^[a-z0-9][a-z0-9-]{0,39}$/)).max(10).default([]),
    workspaceUri: z.string().describe("Exact file URI of the task workspace returned by get_current_session. It must match a client root when roots are supported. Never invent a path or use the plugin directory."),
  }).strict(),
  annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false },
}, async (input, extra) => {
  try {
    const capabilities = server.server.getClientCapabilities();
    const options = { signal: extra.signal, relatedRequestId: extra.requestId };
    const hasRoots = capabilities?.roots !== undefined;
    const roots = hasRoots
      ? (await server.server.listRoots({}, options)).roots
      : [{ uri: input.workspaceUri }];
    const plan = planArticle(input, roots);
    assertSeparateWorkspace(plan.workspace.path, pluginRoot);

    if (supportsFormElicitation(capabilities)) {
      const confirmation = await server.server.elicitInput({
        mode: "form",
        message: `Create one new Knowledge Markdown file and its HTML copy?\n\nTitle: ${input.title}\nDestination: ${plan.path}\nHTML copy: ${plan.htmlPath}\nSize: ${Buffer.byteLength(plan.content, "utf8")} bytes Markdown, ${Buffer.byteLength(plan.htmlContent, "utf8")} bytes HTML\n\nExisting files will not be changed.`,
        requestedSchema: {
          type: "object",
          properties: { save: { type: "boolean", title: "Save this article", default: false } },
          required: ["save"],
        },
      }, { ...options, timeout: 300_000 });
      if (confirmation.action !== "accept" || confirmation.content?.save !== true) {
        return { content: [{ type: "text", text: "Save declined or cancelled. No file was created. Do not retry without a new user request." }] };
      }
    }

    const currentRoots = hasRoots
      ? (await server.server.listRoots({}, options)).roots
      : [{ uri: input.workspaceUri }];
    const currentWorkspace = selectWorkspace(currentRoots, plan.workspace.uri);
    if (currentWorkspace.path !== plan.workspace.path) throw new Error("Workspace changed while awaiting approval.");
    extra.signal.throwIfAborted();
    const saved = createArticle(plan);
    return { content: [{ type: "text", text: `Saved new Knowledge article: ${saved.path}\n${saved.uri}\nHTML copy: ${saved.htmlPath}\n${saved.htmlUri}` }] };
  } catch (error) {
    return { isError: true, content: [{ type: "text", text: `Knowledge save failed: ${error.message}. Do not retry automatically or use general writing tools. If a write began before an I/O error, a partial new file may remain; existing files were not overwritten.` }] };
  }
});

server.connect(new StdioServerTransport()).catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});