<!--
	The stage switch of `pnpm replay`: raw, draft or published, over whichever view is open. It only
	picks; the page owns the address. Rendered under `import.meta.env.DEV` alone, so the build
	drops it whole, styles included: the site has one stage.
-->
<script lang="ts">
	import type { Stage } from "./run.ts";

	const STAGES: Stage[] = ["raw", "draft", "published"];

	let { stage, pick }: { stage: Stage; pick: (stage: Stage) => void } = $props();
</script>

<div role="group" aria-label="Stage">
	{#each STAGES as s (s)}
		<button class:on={stage === s} onclick={() => pick(s)}>{s}</button>
	{/each}
</div>

<style>
	/* Over both views, at the top right, where neither puts anything. */
	div {
		position: fixed;
		top: 8px;
		right: 12px;
		z-index: 3;
		display: flex;
		padding: 2px;
		border-radius: 8px;
		background: white;
		box-shadow: 0 0 0 1px var(--line), 0 2px 8px rgb(17 24 39 / 0.08);
	}
	button {
		padding: 3px 10px;
		border: 0;
		border-radius: 6px;
		background: none;
		font: inherit;
		font-size: 12px;
		text-transform: capitalize;
		color: var(--ink-3);
		cursor: pointer;
	}
	.on {
		background: var(--ink);
		color: #f9fafb;
	}
</style>
