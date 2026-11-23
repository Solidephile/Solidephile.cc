<script lang="ts">
/**
 * 统一加载态：转圈 + 文案。
 * 与 Svelte 组件（如侧栏动态）保持同一种实现：内联 SVG + animate-spin，
 * 不依赖离线图标集。全站（osu / analytics 等）统一用它，避免各处文案与样式不一致。
 */
interface Props {
	/** 文案，默认「加载中…」；传空字符串就只留转圈 */
	text?: string;
	/** 固定高度（px）；不传则用上下内边距撑开 */
	height?: number;
	/** 紧凑版：侧栏这种小容器（小转圈、py-3） */
	compact?: boolean;
}

let { text = "加载中…", height, compact = false }: Props = $props();
</script>

<div
	class="flex w-full flex-col items-center justify-center {height
		? ''
		: compact
			? 'gap-1.5 py-3'
			: 'gap-2 py-16'}"
	style={height ? `height: ${height}px;` : undefined}
	role="status"
	aria-live="polite"
>
	<svg
		class="motion-safe:animate-spin text-(--primary) {compact ? 'size-4' : 'size-5'}"
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
	{#if text}
		<p
			class="m-0 text-neutral-500 dark:text-neutral-400 {compact
				? 'text-xs'
				: 'text-sm'}"
		>
			{text}
		</p>
	{/if}
</div>
