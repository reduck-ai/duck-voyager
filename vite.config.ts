/**
 * The replay app in `replay/`.
 *
 * `pnpm replay` serves it with every run on this machine, live, at any stage: each request under
 * `/data/` reads the stage its `?stage=` names (raw when absent) through data.ts. `pnpm build`
 * builds the site, whose data is the committed `replay/public/data/`: the published stage only,
 * with no handler to reach another. Both use the same paths, so the page reads them the same way.
 */
import { svelte } from "@sveltejs/vite-plugin-svelte";
import type { ServerResponse } from "node:http";
import { defineConfig, type Plugin } from "vite";
import { index, list, load } from "./data.ts";
import type { Stage } from "./replay/run.ts";
import { tasks } from "./task.ts";

const STAGES: Stage[] = ["raw", "draft", "published"];

function send(res: ServerResponse, status: number, body: unknown) {
	res.statusCode = status;
	res.setHeader("content-type", "application/json");
	res.end(JSON.stringify(body));
}

/** Registered straight on the server, so it answers before the files of `public/`. */
const live: Plugin = {
	name: "live-data",
	configureServer(server) {
		server.middlewares.use("/data", async (req, res) => {
			const url = new URL(req.url ?? "/", "http://localhost");
			const stage = (url.searchParams.get("stage") ?? "raw") as Stage;
			if (!STAGES.includes(stage)) return send(res, 400, `no stage ${stage}`);
			const path = decodeURIComponent(url.pathname.slice(1));
			if (path === "tasks.json") return send(res, 200, index(list(stage), await tasks()));
			const id = path.replace(/\.json$/, "");
			const run = load(id, stage);
			if (run) return send(res, 200, run);
			send(res, 404, `no ${stage} of ${id}`);
		});
	}
};

// A relative base: the site is served from a subpath (GitHub Pages, /reduck-voyager/).
export default defineConfig({
	root: "replay",
	base: "./",
	plugins: [svelte(), live],
	build: { outDir: "../dist", emptyOutDir: true }
});
