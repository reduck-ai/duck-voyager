/**
 * The replay app in `replay/`.
 *
 * `pnpm replay` serves it with every run on this machine, live: each request under `/data/`
 * reads `runs/` and parses the run's transcript where Claude Code left it (data.ts).
 * `pnpm build` builds the site, whose data is the committed `replay/public/data/` that
 * `pnpm export` wrote. Both are the same files at the same paths, so the page cannot tell them
 * apart.
 */
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { listed, runs, withSession } from "./data.ts";

function send(res: ServerResponse, body: unknown) {
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
}

/** Registered straight on the server, so it answers before the files of `public/`. */
const live: Plugin = {
	name: "live-data",
	configureServer(server) {
		server.middlewares.use("/data", (req, res) => {
			const path = decodeURIComponent((req.url ?? "/").split("?")[0].slice(1));
			if (path === "runs.json") return send(res, runs().map(listed));
			const run = runs().find((r) => `${r.id}.json` === path);
			if (run) return send(res, withSession(run));
			res.statusCode = 404;
			res.end(`no run ${path}`);
		});
	}
};

// A relative base: the site is served from a subpath (GitHub Pages, /duck-voyager/).
export default defineConfig({
	root: "replay",
	base: "./",
	plugins: [svelte(), live],
	build: { outDir: "../dist", emptyOutDir: true }
});
