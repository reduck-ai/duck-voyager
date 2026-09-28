/**
 * Parse one Claude Code session transcript (`~/.claude/projects/<slug>/<id>.jsonl`) into
 * what an eval looks at: the ask, the answer, the steps taken, the time and the tokens.
 *
 * Claude Code does not document this format; the parts this file relies on:
 * - `assistant` lines carry `message.id`, `message.model`, `message.usage` and content blocks
 *   (`text`, `thinking`, `tool_use`). One API response can be written as several lines,
 *   one per block, each repeating the same `usage`, so usage is counted once per `message.id`.
 * - `user` lines are either a human turn (a string, or `text` blocks) or tool results
 *   (`tool_result` blocks, matched to their call by `tool_use_id`). `isMeta` marks injected
 *   text such as a skill's expansion, which is not the human's.
 * - Every line has an ISO `timestamp`.
 * - `cost-state` lines carry what Claude Code billed: `totalCostUSD`, and `modelUsage` with a
 *   `costUSD` per model, side models (Haiku) included. The figures run from the process's
 *   `startTime`, so the last line of each `startTime` is that process's total. On a bench run
 *   it equals the SDK `result` message's `total_cost_usd`.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { basename, join } from "node:path";
import type { Chat, Image, Step, ToolStep } from "./replay/chat/chat.ts";

export type { Image, Step };

export type Tokens = { input: number; output: number; cacheRead: number; cacheWrite: number };

/** A session is a chat (what the replay components draw) plus what an eval measures. */
export type Session = Chat & {
	id: string;
	path: string;
	title: string | null;
	answer: string;
	end: string;
	models: string[];
	turns: number;
	tokens: Tokens;
	/** Prompt size per API call (input + cache read + cache write): what the model had in its
	 *  context at the first call and the largest one. `end` is the context the session ends
	 *  with: the last prompt plus the last response, the final answer included. */
	context: { start: number; peak: number; end: number };
	/** What Claude Code billed, in USD, from the transcript's own `cost-state` lines: the total
	 *  and its split per model. Null for a transcript with none (a subagent's, or an older one).
	 *  A process writes its line only now and then, so a long or resumed interactive session can
	 *  miss one: `since` is when the earliest process it counts started, to set against `start`. */
	cost: { usd: number; byModel: Record<string, number>; since: string } | null;
};

/** Where Claude Code keeps the sessions of a working directory: every character that is
 *  not a letter or a digit becomes `-`. */
export function projectDir(cwd: string): string {
	return join(homedir(), ".claude", "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));
}

export function parseSession(path: string): Session {
	const lines = readFileSync(path, "utf8")
		.split("\n")
		.flatMap((raw) => {
			try {
				return raw.trim() ? [JSON.parse(raw)] : [];
			} catch {
				return [];
			} // torn last line of a live session
		});

	let title: string | null = null;
	let ask = "";
	let answer = "";
	const models = new Set<string>();
	const counted = new Set<string>();
	const tokens: Tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
	const prompts: number[] = [];
	let lastOutput = 0;
	const steps: Step[] = [];
	const byCallId = new Map<string, ToolStep>();
	const times: string[] = [];
	/** The last `cost-state` of each Claude Code process, keyed by its `startTime`. */
	const costs = new Map<number, any>();

	for (const line of lines) {
		if (line.timestamp) times.push(line.timestamp);
		if (line.type === "ai-title") title = line.aiTitle ?? title;
		if (line.type === "cost-state") costs.set(line.startTime, line);
		const content = line.message?.content;

		if (line.type === "assistant") {
			const { id, model, usage } = line.message;
			if (model) models.add(model);
			if (usage && !counted.has(id)) {
				counted.add(id);
				tokens.input += usage.input_tokens ?? 0;
				tokens.output += usage.output_tokens ?? 0;
				lastOutput = usage.output_tokens ?? 0;
				tokens.cacheRead += usage.cache_read_input_tokens ?? 0;
				tokens.cacheWrite += usage.cache_creation_input_tokens ?? 0;
				prompts.push(
					(usage.input_tokens ?? 0) +
						(usage.cache_read_input_tokens ?? 0) +
						(usage.cache_creation_input_tokens ?? 0)
				);
			}
			for (const b of content ?? []) {
				if (b.type === "text" && b.text.trim()) {
					answer = b.text;
					steps.push({ kind: "text", at: line.timestamp, text: b.text });
				}
				if (b.type === "tool_use") {
					const step: ToolStep = {
						kind: "tool",
						at: line.timestamp,
						end: null,
						tool: b.name,
						input: b.input,
						error: false,
						result: "",
						images: []
					};
					steps.push(step);
					byCallId.set(b.id, step);
				}
			}
		}

		if (line.type === "user") {
			if (typeof content === "string") {
				ask ||= content;
				continue;
			}
			for (const b of content ?? []) {
				if (b.type === "text" && !line.isMeta) ask ||= b.text;
				if (b.type === "tool_result") {
					const step = byCallId.get(b.tool_use_id);
					if (!step) continue;
					step.end = line.timestamp;
					step.error = b.is_error === true;
					step.result = textOf(b.content);
					step.images = imagesOf(b.content);
				}
			}
		}
	}

	let cost: Session["cost"] = null;
	for (const [startTime, state] of [...costs].sort(([a], [b]) => a - b)) {
		cost ??= { usd: 0, byModel: {}, since: new Date(startTime).toISOString() };
		cost.usd += state.totalCostUSD ?? 0;
		for (const [model, usage] of Object.entries<any>(state.modelUsage ?? {}))
			cost.byModel[model] = (cost.byModel[model] ?? 0) + (usage.costUSD ?? 0);
	}

	times.sort();
	const start = times[0] ?? "";
	const end = times.at(-1) ?? "";
	return {
		id: basename(path, ".jsonl"),
		path,
		title,
		ask,
		answer,
		start,
		end,
		durationMs: start ? Date.parse(end) - Date.parse(start) : 0,
		models: [...models],
		turns: counted.size,
		steps,
		tokens,
		context: { start: prompts[0] ?? 0, peak: Math.max(0, ...prompts), end: (prompts.at(-1) ?? 0) + lastOutput },
		cost
	};
}

/** A tool result's content is a string or a list of blocks. Text blocks are joined; any other
 *  block leaves a `[type]` marker where it was. */
function textOf(content: unknown): string {
	if (typeof content === "string") return content;
	if (!Array.isArray(content)) return "";
	return content.map((b) => (b.type === "text" ? b.text : `[${b.type}]`)).join("\n");
}

function imagesOf(content: unknown): Image[] {
	if (!Array.isArray(content)) return [];
	return content
		.filter((b) => b.type === "image" && b.source?.type === "base64")
		.map((b) => ({ mediaType: b.source.media_type, data: b.source.data }));
}

/** The sessions of a working directory, newest first. */
export function listSessions(cwd: string): { id: string; path: string; modified: string }[] {
	const dir = projectDir(cwd);
	return readdirSync(dir)
		.filter((f) => f.endsWith(".jsonl"))
		.map((f) => ({
			id: basename(f, ".jsonl"),
			path: join(dir, f),
			modified: statSync(join(dir, f)).mtime
		}))
		.sort((a, b) => b.modified.getTime() - a.modified.getTime())
		.map((s) => ({ ...s, modified: s.modified.toISOString() }));
}
