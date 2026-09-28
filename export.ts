/**
 * Publish runs: add each run named into `replay/public/data/`, the folder that is committed and
 * that the site is built from, then rebuild its list from what the folder holds.
 *
 *   pnpm export <folder>/<task>.<arm> …    # the ids `pnpm replay` shows
 *   pnpm export                            # only the list: after deleting a run's file
 *
 * A run is published only by name, once a person has read it whole in `pnpm replay`: a trace can
 * hold private data no rule foresees. The checks below are a net under that reading, not a
 * substitute for it. A run must belong to a public task (outside `tasks/private/`). Screenshots
 * are dropped: they show the whole browser. What remains is text, and the export fails, writing
 * nothing, if any line of `tasks/private/deny.txt` (emails, handles, names) or the home
 * directory path appears in it, case ignored. Without that file it does not run.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { runs, withSession } from "./data.ts";
import type { Run, RunWithSession } from "./replay/run.ts";
import { tasks } from "./task.ts";

const DENY = join(import.meta.dirname, "tasks/private/deny.txt");
const OUT = join(import.meta.dirname, "replay/public/data");

if (!existsSync(DENY)) throw new Error(`${DENY} is missing: one private string per line`);
const deny = [
	homedir(),
	...readFileSync(DENY, "utf8")
		.split("\n")
		.map((l) => l.trim())
		.filter(Boolean)
].map((s) => s.toLowerCase());

const ids = process.argv.slice(2);
const recorded = runs();
const publicTasks = new Set((await tasks()).filter((t) => !t.private).map((t) => t.id));

const files = new Map<string, string>();
const problems: string[] = [];
for (const id of ids) {
	const r = recorded.find((r) => r.id === id);
	if (!r) problems.push(`${id}: no such run with a transcript`);
	else if (!publicTasks.has(r.task)) problems.push(`${id}: task ${r.task} is private`);
	else {
		const run = withSession(r);
		for (const s of run.session.steps) if (s.kind === "tool") s.images = [];
		const text = JSON.stringify(run);
		const lower = text.toLowerCase();
		for (const s of deny) if (lower.includes(s)) problems.push(`${id}: contains "${s}"`);
		files.set(`${id}.json`, text);
	}
}
if (problems.length) {
	console.error(`nothing written:\n${problems.join("\n")}`);
	process.exit(1);
}

for (const [path, text] of files) {
	mkdirSync(dirname(join(OUT, path)), { recursive: true });
	writeFileSync(join(OUT, path), text);
}

// The list is whatever the folder holds, so deleting a run's file and running this unpublishes it.
mkdirSync(OUT, { recursive: true });
const published: Run[] = readdirSync(OUT, { recursive: true, encoding: "utf8" })
	.filter((f) => f.endsWith(".json") && f !== "runs.json")
	.map((f) => {
		const { session: _, ...run }: RunWithSession = JSON.parse(readFileSync(join(OUT, f), "utf8"));
		return run;
	});
writeFileSync(join(OUT, "runs.json"), JSON.stringify(published));
console.log(`${files.size} added, ${published.length} published → ${OUT}`);
