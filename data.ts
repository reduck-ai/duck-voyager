/**
 * What the replay page reads, under `data/`: `runs.json`, the list of runs, and
 * `<folder>/<task>.<arm>.json`, one run with its session. Each file is exactly a type of
 * `replay/run.ts`, so nothing the page does not show leaves this machine.
 *
 * `pnpm replay` serves them live from `runs/` and the transcripts (vite.config.ts); `pnpm export`
 * writes the public ones into `replay/public/data/`, which the site is built from (export.ts).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Run, RunWithSession } from "./replay/run.ts";
import { parseSession } from "./session.ts";

const RUNS = join(import.meta.dirname, "runs");

/** A run as listed, with where its transcript is. */
export type Recorded = Run & { transcript: string };

/** Every recorded run that still has its transcript. A run's id is its folder under `runs/`,
 *  `<folder>/<task>.<arm>`, the same run.ts writes files to. */
export function runs(): Recorded[] {
	if (!existsSync(RUNS)) return [];
	return readdirSync(RUNS).flatMap((folder) => {
		const file = join(RUNS, folder, "results.jsonl");
		if (!existsSync(file)) return [];
		return readFileSync(file, "utf8")
			.split("\n")
			.filter(Boolean)
			.map((line) => JSON.parse(line))
			.filter((row) => row.session && existsSync(row.session))
			.map((row) => ({
				id: `${folder}/${row.task}.${row.arm}`,
				task: row.task,
				arm: row.arm,
				verdict: row.verdict,
				outcome: row.outcome,
				wallMs: row.wallMs,
				turns: row.turns,
				costUsd: row.costUsd,
				answer: row.answer,
				transcript: row.session
			}));
	});
}

export const listed = ({ transcript: _, ...run }: Recorded): Run => run;

export function withSession({ transcript, ...run }: Recorded): RunWithSession {
	const { ask, start, durationMs, steps, models } = parseSession(transcript);
	return { ...run, session: { ask, start, durationMs, steps, models } };
}
