/**
 * What a chat is, for the components in this folder: the ask, then everything the assistant
 * said and did, each stamped with when it happened. Times are ISO strings; `t` everywhere in
 * this folder is milliseconds since `start`.
 *
 * The folder depends on nothing outside it but `svelte` and `marked`, so it can move as is.
 */

/** A base64 image a tool returned, such as a screenshot. */
export type Image = { mediaType: string; data: string };

/** What the assistant said, or one tool call with its result. `end` is when the result came
 *  back, null for a call the chat ended without. */
export type Step =
	| { kind: "text"; at: string; text: string }
	| {
			kind: "tool";
			at: string;
			end: string | null;
			tool: string;
			input: unknown;
			error: boolean;
			result: string;
			images: Image[];
	  };

export type ToolStep = Extract<Step, { kind: "tool" }>;

export type Chat = { ask: string; start: string; durationMs: number; steps: Step[] };

export const since = (chat: Chat, iso: string) => Date.parse(iso) - Date.parse(chat.start);

/** Whether a tool call's result had not come back yet at `t`. */
export const running = (chat: Chat, step: ToolStep, t: number) =>
	!step.end || since(chat, step.end) > t;

/** The last screenshot a tool had returned by `t`, with the call that took it: what the
 *  browser looked like then. Null for a chat whose tools return none. */
export function screenAt(chat: Chat, t: number): { step: ToolStep; image: Image } | null {
	let screen = null;
	for (const s of chat.steps)
		if (s.kind === "tool" && s.images.length && !running(chat, s, t))
			screen = { step: s, image: s.images.at(-1)! };
	return screen;
}

/** A tool's result as a person reads it: JSON indented, anything else as it came. */
export function readable(result: string): string {
	try {
		return JSON.stringify(JSON.parse(result), null, 2);
	} catch {
		return result;
	}
}

/** A row on screen: a text, or a run of consecutive tool calls folded into one line. */
export type Row =
	| { kind: "text"; step: Step & { kind: "text" } }
	| { kind: "tools"; steps: ToolStep[] };

/** The rows of the chat as they stood at `t`. */
export function rowsAt(chat: Chat, t: number): Row[] {
	const rows: Row[] = [];
	for (const step of chat.steps) {
		if (since(chat, step.at) > t) break;
		const last = rows.at(-1);
		if (step.kind === "text") rows.push({ kind: "text", step });
		else if (last?.kind === "tools") last.steps.push(step);
		else rows.push({ kind: "tools", steps: [step] });
	}
	return rows;
}

/** One line for a tool call: its name without the `mcp__<server>__` prefix, and the one input
 *  field that says what it was for. A Reduck run names the scripts it ran. */
export function label(step: ToolStep): string {
	const name = step.tool.replace(/^mcp__.+?__/, "");
	const input = (step.input ?? {}) as Record<string, any>;
	const scripts: { host: string; slug: string }[] =
		input.scripts ?? (input.script ? [input.script] : []);
	if (scripts.length) {
		const names = [...new Set(scripts.map((s) => `${s.host}/${s.slug}`))];
		return `${name} ${names.join(", ")}${scripts.length > 1 ? ` ×${scripts.length}` : ""}`;
	}
	const detail = ["description", "url", "query", "action", "command", "skill", "host"]
		.map((k) => input[k])
		.find((v) => typeof v === "string");
	return detail ? `${name} · ${detail}` : name;
}
