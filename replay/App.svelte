<!--
	`?run=<id>&run=<id>` compares those runs; without one, every task with its results. `&t=` starts
	the replay at a moment: `m:ss` as the timeline shows it, seconds, or `end`. The address is the
	whole state, so a replay is a link.
-->
<script lang="ts">
	import Compare from "./Compare.svelte";
	import Home from "./Home.svelte";
	import type { TaskTrials } from "./run.ts";

	const params = new URLSearchParams(location.search);
	const ids = params.getAll("run");
	const t = params.get("t") ?? "0";
	const at =
		t === "end" ? Infinity : t.split(":").reduce((s, part) => s * 60 + Number(part), 0) * 1000 || 0;

	async function get(path: string) {
		const r = await fetch(path);
		if (!r.ok) throw new Error(await r.text());
		return r.json();
	}
</script>

{#if ids.length}
	{#await Promise.all([get("data/tasks.json"), ...ids.map((id) => get(`data/${id}.json`))]) then [tasks, ...runs]}
		<Compare {runs} {at} task={(tasks as TaskTrials[]).find((t) => t.id === runs[0].task)} />
	{:catch error}
		<p>{error.message}</p>
	{/await}
{:else}
	{#await get("data/tasks.json") then tasks}
		<Home {tasks} />
	{:catch error}
		<p>{error.message}</p>
	{/await}
{/if}

<style>
	/* Reduck's palette (app/src/lib/styles/colorPalette.css), on a warm light page. Text is
	   grey-900, never pure black; the brand orange is the one accent. */
	:global(:root) {
		--ink: #111827;
		--ink-2: #4b5563;
		--ink-3: #6b7280;
		--line: rgb(17 24 39 / 0.1);
		--surface: #fcfcfb;
		--brand: #f37321;
		--pass: #16a34a;
		--fail: #dc2626;
	}
	:global(body) {
		margin: 0;
		background: var(--surface);
		color: var(--ink);
		font: 14px/20px Inter, system-ui, sans-serif;
		font-optical-sizing: auto;
	}
	p {
		padding: 24px 32px;
	}
</style>
