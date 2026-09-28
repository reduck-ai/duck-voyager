/**
 * Stdio MCP server over `session.ts`, so an agent can read Claude Code sessions directly.
 *
 *   claude mcp add -s user claude-sessions-parser -- node <repo>/duck_voyager/mcp.ts
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { join } from "node:path";
import { listSessions, parseSession, projectDir, type Session } from "./session.ts";

const server = new McpServer({ name: "claude-sessions-parser", version: "0.1.0" });
const json = (value: unknown) => ({
	content: [{ type: "text" as const, text: JSON.stringify(value, null, 2) }]
});
const cwd = z
	.string()
	.describe(
		"Working directory the sessions ran in. Default: the directory this server was started in."
	)
	.optional();
const id = z
	.string()
	.describe("Session id (the .jsonl file name), or an absolute path to a .jsonl transcript.");
const RESULT_CHARS = 500;

const open = (id: string, dir: string) =>
	parseSession(id.startsWith("/") ? id : join(projectDir(dir), `${id}.jsonl`));

server.registerTool(
	"list_sessions",
	{
		description:
			"List the Claude Code sessions of a working directory, newest first: id, time, first ask, step count, what it cost in USD (null when the transcript records none).",
		inputSchema: { cwd, limit: z.number().int().positive().default(20) }
	},
	async ({ cwd: dir = process.cwd(), limit }) =>
		json(
			listSessions(dir)
				.slice(0, limit)
				.map(({ path, modified }) => {
					const s = parseSession(path);
					return {
						id: s.id,
						modified,
						title: s.title,
						ask: s.ask.slice(0, 200),
						steps: s.steps.length,
						durationMs: s.durationMs,
						costUsd: s.cost?.usd ?? null
					};
				})
		)
);

server.registerTool(
	"read_session",
	{
		description:
			"Parse one Claude Code session: ask, final answer, duration, models, turns, tokens, the cost Claude Code recorded (total and per model, side models included; null when the transcript records none, as for a subagent's), then every step in order — what the assistant said, and each tool call whole (input, error, its full result, when it started and ended) followed by the images it returned (screenshots). full: false gives an outline instead: each result cut to its first 500 characters and images counted, not shown. read_step gives chosen steps in full.",
		inputSchema: {
			id,
			cwd,
			full: z
				.boolean()
				.default(true)
				.describe("false: an outline, results cut to 500 characters and images counted.")
		}
	},
	async ({ id, cwd: dir = process.cwd(), full }) => {
		const s = open(id, dir);
		if (full) {
			const { steps, ...rest } = s;
			return {
				content: [
					{ type: "text" as const, text: JSON.stringify(rest, null, 2) },
					...steps.flatMap((_, i) => inFull(s, i))
				]
			};
		}
		return json({
			...s,
			steps: s.steps.map((step, index) =>
				step.kind === "text"
					? { index, ...step }
					: {
							index,
							...step,
							result: step.result.slice(0, RESULT_CHARS),
							images: step.images.length
						}
			)
		});
	}
);

server.registerTool(
	"read_step",
	{
		description:
			"Steps of a session in full, in the order asked: the text each said, or a tool call with its input, its whole result text, and the images it returned (screenshots), shown as images right after it. Pass several indices to read them in one call.",
		inputSchema: {
			id,
			index: z
				.union([z.number().int().min(0), z.array(z.number().int().min(0)).min(1)])
				.describe("A step's index, or a list of them, from read_session."),
			cwd
		}
	},
	async ({ id, index, cwd: dir = process.cwd() }) => {
		const s = open(id, dir);
		return { content: [index].flat().flatMap((i) => inFull(s, i)) };
	}
);

/** One step whole, as MCP content: its JSON, then each image it returned. */
function inFull(session: Session, i: number) {
	const step = session.steps[i];
	if (!step) throw new Error(`no step ${i} in session ${session.id}`);
	const { images, ...rest } = step.kind === "tool" ? step : { ...step, images: [] };
	return [
		{ type: "text" as const, text: JSON.stringify({ index: i, ...rest }, null, 2) },
		...images.map((img) => ({
			type: "image" as const,
			data: img.data,
			mimeType: img.mediaType
		}))
	];
}

await server.connect(new StdioServerTransport());
