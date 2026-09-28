/**
 * `pnpm replay`: the app in `replay/`, which plays recorded runs back, served together with the
 * runs it reads. Nothing is exported or copied: every request reads `runs/<folder>/results.jsonl`
 * and parses the run's transcript where Claude Code left it (`session.ts`).
 *
 *   GET /api/runs                          every run that still has its transcript
 *   GET /api/runs/<folder>/<task>.<arm>    one of them, with its parsed session
 */
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";
import { parseSession } from "./session.ts";

const RUNS = join(import.meta.dirname, "runs");

/** A run's id is its folder under `runs/`, the same `<folder>/<task>.<arm>` run.ts writes files to. */
function runs() {
	if (!existsSync(RUNS)) return [];
	return readdirSync(RUNS).flatMap((folder) => {
		const file = join(RUNS, folder, "results.jsonl");
		if (!existsSync(file)) return [];
		return readFileSync(file, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line))
			.filter((row) => row.session && existsSync(row.session))
			.map(({ usage: _u, modelUsage: _m, ...row }) => ({
				id: `${folder}/${row.task}.${row.arm}`,
				...row
			}));
	});
}

const api: Plugin = {
	name: "runs",
	configureServer(server) {
		server.middlewares.use("/api/runs", (req, res) => {
			const id = decodeURIComponent((req.url ?? "/").slice(1));
			const run = id && runs().find((r) => r.id === id);
			if (id && !run) {
				res.statusCode = 404;
				res.end(`no run ${id}`);
				return;
			}
			res.setHeader("content-type", "application/json");
			res.end(JSON.stringify(run ? { ...run, session: parseSession(run.session) } : runs()));
		});
	}
};

export default defineConfig({ root: "replay", plugins: [svelte(), api] });
