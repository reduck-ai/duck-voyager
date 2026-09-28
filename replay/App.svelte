<!--
	The route. `?run=<ref>&run=<ref>` compares those runs; without one, every task with its results.
	A ref is a run id, or `<id>@<stage>` to pin that lane to a stage, so `?run=<id>@raw&run=<id>@draft`
	puts a run's transcript next to its draft on one timeline. `&stage=` is the stage of the page
	and of every bare id; `&t=` opens the replay at a moment: `m:ss` as the timeline shows it,
	seconds, or `end`. The address is the whole state, so a view is a link.

	Only `pnpm replay` has stages other than published: its server reads any of them, and a switch
	changes the stage in place, keeping the moment. The built site holds the published files alone
	and a static host ignores a query, so there the page never sends one, and it refuses a ref at
	another stage rather than show the published file under that stage's name.
-->
<script lang="ts">
	import Compare from "./Compare.svelte";
	import Home from "./Home.svelte";
	import Stages from "./Stages.svelte";
	import type { RunWithSession, Stage, TaskTrials } from "./run.ts";

	const DEV = import.meta.env.DEV;

	let params = $state(new URLSearchParams(location.search));
	const stage = $derived((DEV ? (params.get("stage") ?? "raw") : "published") as Stage);
	const refs = $derived(
		params.getAll("run").map((ref) => {
			const [id, at = stage] = ref.split("@");
			return { id, stage: at as Stage };
		})
	);

	/** Where the replay opens; from then on the timeline owns the moment. */
	const start = new URLSearchParams(location.search).get("t") ?? "0";
	let t = $state(
		start === "end"
			? Infinity
			: start.split(":").reduce((s, part) => s * 60 + Number(part), 0) * 1000 || 0
	);

	/** Changes the address in place: no reload, and the view follows. */
	function go(changes: Record<string, string>) {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) next.set(key, value);
		history.replaceState(null, "", `?${next}`);
		params = next;
	}

	async function get(path: string, at: Stage) {
		if (!DEV && at !== "published")
			throw new Error(`"${path}@${at}" is not on the public site: only published runs are.`);
		const r = await fetch(DEV ? `data/${path}.json?stage=${at}` : `data/${path}.json`);
		if (!r.ok) throw new Error(await r.text());
		return r.json();
	}

	const tasks = $derived(get("tasks", stage) as Promise<TaskTrials[]>);
	const runs = $derived(
		Promise.all(
			refs.map(async (ref) => ({ ...((await get(ref.id, ref.stage)) as RunWithSession), stage: ref.stage }))
		)
	);
</script>

{#if DEV}<Stages {stage} pick={(s) => go({ stage: s })} />{/if}

{#if refs.length}
	{#await Promise.all([tasks, runs]) then [tasks, runs]}
		<Compare {runs} bind:t task={tasks.find((task) => task.id === runs[0].task)} />
	{:catch error}
		<p>{error.message}</p>
	{/await}
{:else}
	{#await tasks then tasks}
		<Home {tasks} stage={DEV ? stage : undefined} />
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
