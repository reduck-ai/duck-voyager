/**
 * Open-ended research: what people complain about in AI browser agents, from Reddit and X.
 * No single right answer, so the check only rules out the one thing that is never right: a
 * link the run never saw. Quality (grounding of quotes, coverage, recency, synthesis) is scored
 * by reading the transcript over the `sessions` MCP.
 */
import { all, signedInAs, type Task } from "../task.ts";

/** What identifies a post whatever form its URL takes: a tweet id, a Reddit post id, else
 *  the URL without its scheme, query and trailing slash. */
function key(url: string): string {
	return (
		url.match(/\/status(?:es)?\/(\d+)/)?.[1] ??
		url.match(/\/comments\/([a-z0-9]+)/i)?.[1] ??
		url.replace(/^https?:\/\/(www\.|old\.)?/, "").replace(/[?#].*$/, "").replace(/\/$/, "")
	);
}

export default {
	id: "browser-agent-pains",
	name: "What people hate about browser agents",
	prompt:
		"Research what people complain about when they use AI browser agents (browser-use, Claude computer use, Operator, Claude in Chrome, and similar) in the last 3 months. Look at Reddit and X. You can use Google as a search engine: it indexes both better. Give me the top 5 pain points. For each one, give at least 2 direct quotes, each with a link to the post it comes from.",
	requires: () => all([signedInAs("X", "reduck/x.com/whoami", (r) => r.handle, process.env.VOYAGER_X_HANDLE!)]),
	check: ({ answer, session }) => {
		const cited = [
			...new Set(
				(answer.match(/https?:\/\/[^\s)\]>"'`]+/g) ?? []).filter((u) =>
					/reddit\.com|x\.com|twitter\.com/.test(u)
				)
			)
		];
		const seen = (session?.steps ?? [])
			.map((s) => (s.kind === "tool" ? `${s.result}\n${JSON.stringify(s.input)}` : ""))
			.join("\n");
		const unseen = cited.filter((u) => !seen.includes(key(u)));
		const pass = cited.length >= 10 && unseen.length === 0;
		return {
			pass,
			detail: `${cited.length} links, ${unseen.length} never seen in a tool result${unseen.length ? `: ${unseen.join(" ")}` : ""}`
		};
	}
} satisfies Task;
