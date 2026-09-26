<script lang="ts">
/**
 * 统一加载态：转圈 + 文案。
 * 与 Svelte 组件（如侧栏动态）保持同一种实现：内联 SVG + animate-spin，
 * 不依赖离线图标集。全站（osu / analytics 等）统一用它，避免各处文案与样式不一致。
 */
interface Props {
	/** 文案，默认「加载中…」 */
	text?: string;
	/** 固定高度（px）；不传则用上下内边距撑开 */
	height?: number;
}

let { text = "加载中…", height }: Props = $props();
</script>

<div
	class="flex w-full flex-col items-center justify-center gap-2 {height
		? ''
		: 'py-16'}"
	style={height ? `height: ${height}px;` : undefined}
	role="status"
	aria-live="polite"
>
	<svg
		class="size-5 animate-spin text-(--primary)"
		viewBox="0 0 24 24"
		fill="none"
		aria-hidden="true"
	>
		<circle
			cx="12"
			cy="12"
			r="10"
			stroke="currentColor"
			stroke-width="3"
			opacity="0.25"
		/>
		<path
			d="M4 12a8 8 0 018-8"
			stroke="currentColor"
			stroke-width="3"
			stroke-linecap="round"
		/>
	</svg>
	<p class="m-0 text-sm text-neutral-500 dark:text-neutral-400">{text}</p>
</div>
