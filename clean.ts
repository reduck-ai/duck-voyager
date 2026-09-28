/**
 * Delete the PDFs saved in ~/Downloads (two levels deep) since a given time.
 *
 *   pnpm clean-downloads --since 2026-09-26T11:00:00Z
 *   pnpm clean-downloads --since 2026-09-26T11:00:00Z --dry-run
 */
import { readdirSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseArgs } from "node:util";

const { values } = parseArgs({
	options: { since: { type: "string" }, "dry-run": { type: "boolean", default: false } }
});
const since = Date.parse(values.since ?? "");
if (Number.isNaN(since)) throw new Error("--since <ISO time> is required");

const pdfs = (dir: string, depth: number): string[] =>
	readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
		const path = join(dir, e.name);
		if (e.isDirectory() && depth > 0 && !e.name.endsWith(".app")) return pdfs(path, depth - 1);
		return e.isFile() && e.name.toLowerCase().endsWith(".pdf") ? [path] : [];
	});

for (const f of pdfs(join(homedir(), "Downloads"), 1)) {
	if (statSync(f).mtimeMs < since) continue;
	if (!values["dry-run"]) rmSync(f);
	console.log(`${values["dry-run"] ? "would delete" : "deleted"} ${f}`);
}
