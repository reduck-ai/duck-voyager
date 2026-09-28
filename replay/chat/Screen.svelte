<!--
	One screenshot from a chat, in a frame it fills, captioned with the call that took it.

	`send` / `receive` move a chat's screen from one frame to another: give the frame the screen
	leaves `out:send` and the one it goes to `in:receive`, both keyed by the chat, and it flies
	across instead of disappearing in one place and appearing in the other.
-->
<script module lang="ts">
	import { cubicOut } from "svelte/easing";
	import { crossfade } from "svelte/transition";

	export const [send, receive] = crossfade({ duration: 400, easing: cubicOut });
</script>

<script lang="ts">
	import { label, type Image, type ToolStep } from "./chat.ts";

	let { screen }: { screen: { step: ToolStep; image: Image } } = $props();
</script>

<figure>
	<div class="view">
		<img src="data:{screen.image.mediaType};base64,{screen.image.data}" alt="" />
	</div>
	<figcaption>{label(screen.step)}</figcaption>
</figure>

<style>
	figure {
		margin: 0;
		height: 100%;
		display: flex;
		flex-direction: column;
	}
	/* Out of the flow, so that a tall screenshot keeps the size of its frame. */
	.view {
		position: relative;
		flex: 1;
	}
	img {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		object-fit: contain;
	}
	figcaption {
		padding: 4px 10px;
		color: #7b7a74;
		font-size: 12px;
		white-space: nowrap;
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
