/** What the page reads, and all that is published of a run (see data.ts). */
import type { Verdict } from "../task.ts";
import type { Chat } from "./chat/chat.ts";

export type Run = {
	id: string;
	task: string;
	arm: "reduck" | "chrome";
	verdict: Verdict | null;
	outcome: string;
	wallMs: number;
	turns: number;
	costUsd: number;
	answer: string;
};

export type RunWithSession = Run & { session: Chat & { models: string[] } };

export const ARM_NAMES: Record<Run["arm"], string> = {
	reduck: "Reduck MCP",
	chrome: "Claude in Chrome"
};

/** A model id as people say it: `claude-opus-5-5` is "Opus 5.5". An id of another shape is
 *  shown as it is. */
export function modelName(id: string): string {
	const m = id.match(/^claude-([a-z]+)-(\d+)(?:-(\d{1,2}))?(?!\d)/);
	if (!m) return id;
	const [, family, major, minor] = m;
	return `${family[0].toUpperCase()}${family.slice(1)} ${major}${minor ? `.${minor}` : ""}`;
}
