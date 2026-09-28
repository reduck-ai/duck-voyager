<!--
	`?run=<id>&run=<id>` compares those runs; without one, the list to pick them from. The
	address is the whole state, so a replay is a link.
-->
<script lang="ts">
	import Compare from "./Compare.svelte";
	import Pick from "./Pick.svelte";

	const ids = new URLSearchParams(location.search).getAll("run");

	async function get(path: string) {
		const r = await fetch(path);
		if (!r.ok) throw new Error(await r.text());
		return r.json();
	}
</script>

{#if ids.length}
	{#await Promise.all(ids.map((id) => get(`data/${id}.json`))) then runs}
		<Compare {runs} />
	{:catch error}
		<p>{error.message}</p>
	{/await}
{:else}
	{#await get("data/runs.json") then runs}
		<Pick {runs} />
	{:catch error}
		<p>{error.message}</p>
	{/await}
{/if}

<style>
	:global(body) {
		margin: 0;
		background: #fcfcfb;
		color: #0b0b0b;
		font: 14px/20px anthropic-sans, system-ui, sans-serif;
	}
	p {
		padding: 24px 32px;
	}
</style>
