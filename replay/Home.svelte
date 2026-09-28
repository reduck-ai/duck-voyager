<!--
	A scoreboard over the latest run of every task, then every task with results, one card
	each, laid out like a post: the task, and its prompt cut to two lines with "Show more" for
	the rest in place; then the comparison, always in
	view: who did better and by how much, and each tool's time, cost and grade; then a bar at the
	bottom with the run (a picker when the task has several) and "Open", its replay on the
	result. A grade shows why it was given on a click, so the numbers stay scannable.
-->
<script lang="ts">
	import { faMedal } from "@fortawesome/free-solid-svg-icons";
	import { FontAwesomeIcon } from "@fortawesome/svelte-fontawesome";
	import { untrack } from "svelte";
	import { SvelteSet } from "svelte/reactivity";
	import { clock } from "./chat/Timeline.svelte";
	import {
		ARM_NAMES,
		day,
		grader,
		latest,
		outcome,
		scoreboard,
		type Run,
		type TaskTrials,
		type Trial
	} from "./run.ts";

	let { tasks }: { tasks: TaskTrials[] } = $props();

	let picked = $state(untrack(() => Object.fromEntries(tasks.map((t) => [t.id, latest(t).id]))));
	const board = $derived(scoreboard(tasks));
	/** Tasks whose prompt is cut, those shown whole, and runs whose grade's reason is shown. */
	const cut = new SvelteSet<string>();
	const prompts = new SvelteSet<string>();
	const reasons = new SvelteSet<string>();
	/** Marks a task whose prompt overflows its two lines, so only those offer "Show more". */
	const measure = (node: HTMLElement, id: string) => {
		if (node.scrollHeight > node.clientHeight) cut.add(id);
	};
	const toggle = (set: SvelteSet<string>, id: string) => (set.has(id) ? set.delete(id) : set.add(id));

	const grade = (run: Run) =>
		run.verdict ? (run.verdict.pass ? "✓ Passed" : "✗ Failed") : "Not graded";
	const replay = (trial: Trial) =>
		`?${trial.runs.map((r) => `run=${encodeURIComponent(r.id)}`).join("&")}&t=end`;
</script>

<main>
	<header>
		<h1>duck-voyager</h1>
		<p>
			One agent (Claude Code), one prompt, and one browser tool per run: Reduck MCP or Chrome
			MCP (Claude in Chrome). By <a href="https://reduck.ai">Reduck AI</a> ·
			<a href="https://github.com/reduck-ai/duck-voyager">code and data</a>
		</p>
	</header>

	<section class="board">
		<h3>Latest run of each task</h3>
		<div class="row head">
			<span></span><span>Passed</span><span>Avg time</span><span>Avg cost</span>
		</div>
		{#each board.arms as a (a.arm)}
			<div class="row">
				<span class="arm">{ARM_NAMES[a.arm]}</span>
				<span>{a.passed}/{a.graded}</span>
				<span>{board.compared ? clock(a.ms) : "–"}</span>
				<span>{board.compared ? `$${a.usd.toFixed(2)}` : "–"}</span>
			</div>
		{/each}
		<p class="note">
			Time and cost: the mean over the {board.compared} tasks both tools passed.
		</p>
	</section>

	{#each tasks as task (task.id)}
		{@const trial = task.trials.find((t) => t.id === picked[task.id])!}
		{@const result = outcome(trial.runs)}
		{@const longest = Math.max(...trial.runs.map((r) => r.wallMs))}
		<article>
			<h2>{task.name}</h2>
			<p class="label">Prompt:</p>
			<p class="prompt" class:whole={prompts.has(task.id)} use:measure={task.id}>{task.prompt}</p>
			{#if cut.has(task.id)}
				<button class="more" onclick={() => toggle(prompts, task.id)}>
					{prompts.has(task.id) ? "Show less" : "Show more"}
				</button>
			{/if}

			<div class="comparison">
				<p class="outcome" class:win={result.winner}>
					{#if result.winner}<FontAwesomeIcon icon={faMedal} />{/if}
					{result.text}
				</p>
				{#each trial.runs as run (run.id)}
					{@const why = reasons.has(run.id)}
					<div class="run">
						<span class="arm">{ARM_NAMES[run.arm]}</span>
						<span class="bar"><span style:width="{(run.wallMs / longest) * 100}%"></span></span>
						<span class="n">{clock(run.wallMs)}</span>
						<span class="n">${run.costUsd.toFixed(2)}</span>
						{#if run.verdict?.detail}
							<button
								class="grade"
								class:pass={run.verdict.pass}
								class:fail={!run.verdict.pass}
								aria-expanded={why}
								title="Why?"
								onclick={() => toggle(reasons, run.id)}>{grade(run)}</button
							>
						{:else}
							<span class="grade" class:pass={run.verdict?.pass} class:fail={run.verdict?.pass === false}
								>{grade(run)}</span
							>
						{/if}
					</div>
					{#if why && run.verdict?.detail}
						<p class="why">By {grader(run.verdict)}: {run.verdict.detail}</p>
					{/if}
				{/each}
			</div>

			<footer>
				{#if task.trials.length > 1}
					<select bind:value={picked[task.id]} aria-label="Run">
						{#each task.trials as t (t.id)}<option value={t.id}>{day(t)}</option>{/each}
					</select>
				{:else}
					<span>{day(trial)}</span>
				{/if}
				<a class="open" href={replay(trial)}>Open</a>
			</footer>
		</article>
	{/each}
</main>

<style>
	main {
		max-width: 768px;
		margin: 0 auto;
		padding: 32px 16px 64px;
	}
	h1 {
		margin: 0 0 4px;
		font-size: 22px;
	}
	header p {
		margin: 0 0 24px;
		color: #7b7a74;
	}
	a {
		color: inherit;
	}
	article {
		margin-bottom: 12px;
		padding: 16px 20px 12px;
		border: 1px solid rgb(11 11 11 / 0.1);
		border-radius: 12px;
		background: white;
	}
	h2 {
		margin: 0;
		font-size: 17px;
	}
	.label {
		margin: 6px 0 0;
		color: #7b7a74;
		font-size: 13px;
	}
	/* Two lines with an ellipsis until "Show more". */
	.prompt {
		display: -webkit-box;
		-webkit-line-clamp: 2;
		line-clamp: 2;
		-webkit-box-orient: vertical;
		overflow: hidden;
		margin: 2px 0 0;
		white-space: pre-wrap;
		color: #3d3d3a;
	}
	.prompt.whole {
		display: block;
	}
	/* An inline link, as under a post's text. */
	.more {
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: rgb(29 110 190);
		cursor: pointer;
	}
	.more:hover {
		text-decoration: underline;
	}
	.board {
		margin-bottom: 20px;
		padding: 16px 20px;
		border-radius: 12px;
		background: #0b0b0b;
		color: #e9e8e2;
	}
	.board h3 {
		margin: 0 0 8px;
		font-size: 13px;
		font-weight: 600;
		color: #b5b3ab;
	}
	.board .row {
		display: grid;
		grid-template-columns: 1fr 80px 90px 90px;
		gap: 10px;
		padding: 4px 0;
		font-variant-numeric: tabular-nums;
		font-size: 17px;
	}
	.board .row span:not(:first-child) {
		text-align: right;
	}
	.board .head {
		font-size: 12px;
		color: #b5b3ab;
	}
	.board .arm {
		color: white;
	}
	.note {
		margin: 8px 0 0;
		font-size: 12px;
		color: #b5b3ab;
	}
	.comparison {
		margin-top: 14px;
	}
	.outcome {
		margin: 0 0 4px;
		color: #7b7a74;
	}
	.outcome.win {
		color: #0b0b0b;
		font-weight: 600;
		:global(svg) {
			color: #e8b04b;
		}
	}
	.run {
		display: grid;
		grid-template-columns: 180px 1fr 48px 52px 96px;
		align-items: center;
		gap: 10px;
		margin-top: 8px;
		font-variant-numeric: tabular-nums;
	}
	.arm {
		font-weight: 600;
	}
	.bar {
		height: 8px;
		border-radius: 4px;
		background: rgb(11 11 11 / 0.05);
	}
	.bar span {
		display: block;
		height: 100%;
		border-radius: 4px;
		background: #0b0b0b;
	}
	.n {
		text-align: right;
	}
	.grade {
		justify-self: end;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: #7b7a74;
	}
	.grade.pass {
		color: rgb(40 130 70);
	}
	.grade.fail {
		color: rgb(180 50 40);
	}
	/* A grade with a reason reads as something to click. */
	button.grade {
		cursor: pointer;
		text-decoration: underline dotted;
		text-underline-offset: 3px;
	}
	.why {
		margin: 4px 0 0 190px;
		color: #7b7a74;
		font-size: 13px;
		line-height: 18px;
	}
	/* The post's action bar: the run it shows, and where to open it. */
	footer {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 12px;
		margin-top: 14px;
		padding-top: 10px;
		border-top: 1px solid rgb(11 11 11 / 0.06);
		color: #7b7a74;
	}
	/* Text in the bar, like a single run's date, with only its arrow to say it is a picker. */
	select {
		max-width: 75%;
		padding: 0;
		border: 0;
		background: none;
		font: inherit;
		color: inherit;
		cursor: pointer;
	}
	select:hover {
		color: #0b0b0b;
	}
	.open {
		flex: none;
		padding: 6px 14px;
		border-radius: 8px;
		background: #0b0b0b;
		color: white;
		text-decoration: none;
	}
</style>
