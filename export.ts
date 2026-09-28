/**
 * Write the runs of the public tasks (those outside `tasks/private/`) into
 * `replay/public/data/`, the folder that is committed and that the site is built from.
 *
 *   pnpm export
 *
 * Two rules keep private data out of a public repo. Screenshots are dropped: they show the whole
 * browser, and no code can tell what is in them. What remains is text, and it is checked: the
 * export fails, writing nothing, if any line of `tasks/private/deny.txt` (emails, handles, names)
 * or the home directory path appears in it, case ignored. Without that file it does not run.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { listed, runs, withSession } from "./data.ts";
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
]
	.map((s) => s.toLowerCase());

const published = new Set((await tasks()).filter((t) => !t.private).map((t) => t.id));
const chosen = runs().filter((r) => published.has(r.task));

const files = new Map<string, string>([["runs.json", JSON.stringify(chosen.map(listed))]]);
for (const r of chosen) {
	const run = withSession(r);
	for (const s of run.session.steps) if (s.kind === "tool") s.images = [];
	files.set(`${r.id}.json`, JSON.stringify(run));
}

const leaks = [...files].flatMap(([path, text]) => {
	const lower = text.toLowerCase();
	return deny.filter((s) => lower.includes(s)).map((s) => `${path}: "${s}"`);
});
if (leaks.length) {
	console.error(`nothing written, private strings found:\n${leaks.join("\n")}`);
	process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
for (const [path, text] of files) {
	mkdirSync(dirname(join(OUT, path)), { recursive: true });
	writeFileSync(join(OUT, path), text);
}
console.log(`${chosen.length} runs of ${[...published].join(", ")} → ${OUT}`);
