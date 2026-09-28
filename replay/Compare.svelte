<!--
	Recorded runs side by side on one timeline, as long as the longest of them, each from its own
	start. A run that has finished is marked on the timeline, and its lane greys out under what it
	came to: the verdict, its time, its cost. Once two runs have both finished, a card between
	them says how the first to finish compares to the other. A click on a run's screen moves it
	over the lane next to it, larger, until it is closed.
-->
<script lang="ts">
	import { faMedal, faXmark } from "@fortawesome/free-solid-svg-icons";
	import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
	import { scale } from "svelte/transition";
	import Chat from "./chat/Chat.svelte";
	import { screenAt } from "./chat/chat.ts";
	import Screen, { receive, send } from "./chat/Screen.svelte";
	import Timeline, { clock } from "./chat/Timeline.svelte";
	import { ARM_NAMES, modelName, type RunWithSession } from "./run.ts";

	let { runs }: { runs: RunWithSession[] } = $props();

	/** The run whose screen is shown large, and the lane it covers: the next, or for the last
	 *  run the one before. */
	let staged = $state<number | null>(null);
	const covered = $derived(
		staged === null ? null : staged === runs.length - 1 ? staged - 1 : staged + 1
	);

	let t = $state(0);

	/** Two runs, from the side of the one that finished first: each metric as a ratio, worded
	 *  for whichever way it goes. */
	const versus = $derived.by(() => {
		if (runs.length !== 2) return null;
		const [first, other] = [...runs].sort((a, b) => a.session.durationMs - b.session.durationMs);
		const ratio = (mine: number, theirs: number, better: string, worse: string) =>
			mine <= theirs
				? { n: `${(theirs / mine).toFixed(1)}×`, word: better }
				: { n: `${(mine / theirs).toFixed(1)}×`, word: worse };
		return {
			first,
			lines: [
				ratio(first.session.durationMs, other.session.durationMs, "faster", "slower"),
				ratio(first.costUsd, other.costUsd, "cheaper", "costlier"),
				ratio(first.turns, other.turns, "fewer turns", "more turns")
			]
		};
	});
	const duration = $derived(Math.max(...runs.map((r) => r.session.durationMs)));
	const marks = $derived(
		runs.map((r) => ({ at: r.session.durationMs, label: ARM_NAMES[r.arm] }))
	);
</script>

<div class="compare">
	<div class="lanes">
		{#each runs as run, i (run.id)}
			{@const done = t >= run.session.durationMs}
			<section>
				<header>
					<span>
						<strong>{ARM_NAMES[run.arm]}</strong>
						<span class="model">· {run.session.models.map(modelName).join(", ")}</span>
					</span>
				</header>
				<Chat
					chat={run.session}
					{t}
					expanded={staged === i}
					onexpand={runs.length > 1 ? () => (staged = i) : undefined}
				/>
				{#if done}
					<div class="veil">
						<div class="card">
							<div class="verdict">
								{run.verdict ? (run.verdict.pass ? "✓ Passed" : "✗ Failed") : "Done"}
							</div>
							<div class="metrics">
								<div><b>{clock(run.session.durationMs)}</b>time</div>
								<div><b>${run.costUsd.toFixed(2)}</b>cost</div>
								<div><b>{run.turns}</b>turns</div>
							</div>
						</div>
					</div>
				{/if}
				{#if staged !== null && covered === i}
					{@const shown = runs[staged]}
					{@const screen = screenAt(shown.session, t)}
					<div class="stage" in:receive={{ key: shown.session }} out:send={{ key: shown.session }}>
						<header>
							<strong>{ARM_NAMES[shown.arm]}</strong>
							<button onclick={() => (staged = null)} aria-label="Back to picture in picture">
								<FontAwesomeIcon icon={faXmark} />
							</button>
						</header>
						{#if screen}<Screen {screen} />{/if}
					</div>
				{/if}
			</section>
		{/each}
		{#if versus && t >= duration}
			<div class="versus" transition:scale={{ start: 0.9, duration: 300 }}>
				<div class="winner">
					<FontAwesomeIcon icon={faMedal} />
					{ARM_NAMES[versus.first.arm]} wins
				</div>
				{#each versus.lines as line}<div><b>{line.n}</b> {line.word}</div>{/each}
			</div>
		{/if}
	</div>
	<Timeline {duration} {marks} bind:t />
</div>

<style>
	.compare {
		height: 100vh;
		display: flex;
		flex-direction: column;
		background: #f5f4ef;
	}
	.lanes {
		position: relative;
		flex: 1;
		min-height: 0;
		display: grid;
		grid-auto-columns: minmax(0, 1fr);
		grid-auto-flow: column;
		grid-template-rows: minmax(0, 1fr);
		border-bottom: 1px solid rgb(11 11 11 / 0.1);
	}
	/* Grid rows give the chat a fixed height to fill, which a flex column would not. */
	section {
		position: relative;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		grid-template-columns: minmax(0, 1fr);
		border-left: 1px solid rgb(11 11 11 / 0.1);
	}
	header {
		display: flex;
		justify-content: space-between;
		padding: 8px 16px;
		font-variant-numeric: tabular-nums;
	}
	/* Over the whole lane; the chat stays readable and clickable under it. */
	.veil {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		background: rgb(233 232 226 / 0.72);
		pointer-events: none;
	}
	/* Where the lanes meet, level with the cards of the finished runs. */
	.versus {
		position: absolute;
		left: 50%;
		top: 50%;
		translate: -50% -50%;
		z-index: 2;
		padding: 18px 26px;
		border-radius: 14px;
		background: #0b0b0b;
		color: #e9e8e2;
		text-align: center;
		font-size: 15px;
		line-height: 24px;
		box-shadow: 0 8px 32px rgb(11 11 11 / 0.3);
		pointer-events: none;
	}
	.winner {
		margin-bottom: 6px;
		color: white;
		font-size: 17px;
		font-weight: 600;
		:global(svg) {
			color: #e8b04b;
		}
	}
	.versus b {
		color: white;
		font-size: 20px;
		font-weight: 700;
		font-variant-numeric: tabular-nums;
	}
	.model {
		color: #7b7a74;
	}
	/* Over the covered lane, its veil included. */
	.stage {
		position: absolute;
		inset: 0;
		z-index: 1;
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		background: #e9e8e2;
		box-shadow: 0 6px 32px rgb(11 11 11 / 0.2);
	}
	.stage button {
		border: 0;
		background: none;
		font-size: 22px;
		line-height: 20px;
		cursor: pointer;
		color: #3d3d3a;
	}
	.card {
		padding: 20px 28px;
		border-radius: 12px;
		background: white;
		box-shadow: 0 4px 24px rgb(11 11 11 / 0.12);
		text-align: center;
	}
	.verdict {
		font-size: 16px;
		font-weight: 600;
		margin-bottom: 12px;
	}
	.metrics {
		display: flex;
		gap: 28px;
		color: #7b7a74;
		font-size: 12px;
	}
	.metrics b {
		display: block;
		color: #0b0b0b;
		font-size: 24px;
		line-height: 32px;
		font-variant-numeric: tabular-nums;
	}
</style>
