<!-- Every recorded run, by task, to pick the ones to replay together. -->
<script lang="ts">
	import { ARM_NAMES, type Run } from "./run.ts";

	let { runs }: { runs: Run[] } = $props();

	let picked = $state<string[]>([]);
	const byTask = $derived(Object.entries(Object.groupBy(runs, (r) => r.task)));
</script>

<main>
	<a class:off={!picked.length} href="?{picked.map((id) => `run=${encodeURIComponent(id)}`).join('&')}">
		Replay {picked.length} run{picked.length === 1 ? "" : "s"}
	</a>
	{#each byTask as [task, runs]}
		<h2>{task}</h2>
		{#each runs! as run (run.id)}
			<label>
				<input type="checkbox" value={run.id} bind:group={picked} />
				{ARM_NAMES[run.arm]} · {run.id.split("/")[0]} ·
				{run.verdict ? (run.verdict.pass ? "passed" : "failed") : run.outcome} ·
				{Math.round(run.wallMs / 1000)} s · ${run.costUsd.toFixed(2)}
			</label>
		{/each}
	{/each}
</main>

<style>
	main {
		max-width: 768px;
		margin: 0 auto;
		padding: 24px 32px;
	}
	h2 {
		font-size: 15px;
		margin: 20px 0 6px;
	}
	label {
		display: block;
		padding: 3px 0;
		font-variant-numeric: tabular-nums;
	}
	a {
		position: sticky;
		top: 12px;
		float: right;
		padding: 6px 12px;
		border-radius: 8px;
		background: #0b0b0b;
		color: white;
		text-decoration: none;
	}
	a.off {
		pointer-events: none;
		opacity: 0.3;
	}
</style>
