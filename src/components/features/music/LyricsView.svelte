<script lang="ts">
import { flushSync, onDestroy, onMount } from "svelte";
import {
	findActiveIndex,
	LYRIC_LEAD_MS,
	type LyricLine,
	sungSpanCount,
} from "@/utils/lrc";
import { animateScrollTop, cancelScrollTop } from "@/utils/scroll-tween";
import { readStored, writeStored } from "@/utils/storage-utils";
import { player } from "./player.svelte";

/**
 * 歌词栏（纯展示）
 *
 * 不接收点击、不接管滚轮/触摸：位置只由播放进度决定，进度只能从播放条调。
 * 这样整块歌词对滚轮和手势都是「透明」的，页面滚动和移动端左右滑动都能穿透。
 * 容器是 `overflow: hidden`，但仍然可以程序化滚动（自动居中就靠它）。
 *
 * 右上角一个小工具条放显示偏好（对齐方式 + 翻译开关）：默认半透明，
 * 悬停/聚焦才完全显现。
 *
 * 上下留白等于「可视高度的一半」，首尾两句才能滚到正中；靠 JS 量高度而不是
 * CSS 百分比（padding 的百分比按宽度算，高度用不上）。
 */
let { lines }: { lines: LyricLine[] } = $props();

type Align = "left" | "center" | "right";

const ALIGN_OPTIONS: { value: Align; label: string; path: string }[] = [
	{ value: "left", label: "左对齐", path: "M2 4h12M2 8h8M2 12h10" },
	{ value: "center", label: "居中", path: "M2 4h12M4 8h8M3 12h10" },
	{ value: "right", label: "右对齐", path: "M2 4h12M6 8h8M4 12h10" },
];

const ALIGN_KEY = "music-lyrics-align";
const TRANSLATION_KEY = "music-lyrics-translation";

let box: HTMLDivElement | undefined = $state();
let align = $state<Align>("center");
let showTranslation = $state(true);
/** 上下留白（px）= 可视高度的一半 */
let gutter = $state(0);

// 歌词提前量（感知上略早于歌声）统一在 lrc.ts 里，导航栏那份播放器用的是同一个值
const lyricTime = $derived(player.stageTime + LYRIC_LEAD_MS / 1000);

const hasTranslation = $derived(
	lines.some((line) => line.translation.length > 0),
);

const activeIndex = $derived(findActiveIndex(lines, lyricTime));

/**
 * 「当前行」= 高亮 + 居中的那一行。
 *
 * 第一句开始前 activeIndex 是 -1（前奏很长时），直接用它开场会是「整屏灰字顶在
 * 上端」，看起来像高亮失效。所以把它夹到 0：开场就把第一句当作当前行。
 */
const currentIndex = $derived(
	lines.length === 0 ? -1 : Math.max(0, activeIndex),
);

/** 当前行已经唱到第几段；整行没有逐字时间时等于总段数 */
const sungCount = $derived.by(() => {
	const line = lines[currentIndex];

	return line ? sungSpanCount(line, lyricTime) : 0;
});

// 切页会重建 island，两个显示偏好记在本地
onMount(() => {
	const savedAlign = readStored(ALIGN_KEY);
	if (
		savedAlign === "left" ||
		savedAlign === "center" ||
		savedAlign === "right"
	) {
		align = savedAlign;
	}
	if (readStored(TRANSLATION_KEY) === "0") showTranslation = false;
});

function setAlign(value: Align): void {
	align = value;
	writeStored(ALIGN_KEY, value);
}

function toggleTranslation(): void {
	const container = box;
	const index = currentIndex;
	// 以「当前行」为轴做这次布局变化：记下它切换前的屏幕位置
	const anchor = container?.querySelector<HTMLElement>(
		`[data-index="${index}"]`,
	);
	const beforeTop = anchor?.getBoundingClientRect().top ?? 0;

	// 必须等这次状态变化真的写进 DOM 之后再量位置，否则量到的还是旧布局。
	// flushSync 就是干这个的。
	flushSync(() => {
		showTranslation = !showTranslation;
	});

	writeStored(TRANSLATION_KEY, showTranslation ? "1" : "0");

	// 一次性抵掉整体位移（瞬时、不带补间）：视觉上是「其它行向中心收拢 / 从中心
	// 散开」，而不是整段滚过很长的距离。歌越靠后，当前行上方累积的行高越多，
	// 这一步越关键。
	if (container && anchor) {
		container.scrollTop += anchor.getBoundingClientRect().top - beforeTop;
	}

	// 再补上「当前行离正中」的残余距离（一般为 0，被夹到边界时才会有量）
	centerOn(index);
}

$effect(() => {
	const container = box;
	if (!container) return;

	const observer = new ResizeObserver(() => {
		gutter = Math.round(container.clientHeight / 2);
	});
	observer.observe(container);

	return () => observer.disconnect();
});

// 切页销毁时停掉可能还在跑的补间。
// 注意 onDestroy 的回调在 SSR 阶段也会执行，而那时 box 一定是 undefined，
// 所以这里不会碰到服务端不存在的 cancelAnimationFrame。
onDestroy(() => {
	if (box) cancelScrollTop(box);
});

/** 把第 index 行滚到可视区域正中 */
function centerOn(index: number): void {
	const container = box;
	if (!container || index < 0) return;

	const line = container.querySelector<HTMLElement>(`[data-index="${index}"]`);
	if (!line) return;

	animateScrollTop(
		container,
		Math.max(
			0,
			line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2,
		),
	);
}

// 当前行变化（或量到新高度）时把它滚到中间。
// 依赖只有 currentIndex / gutter / box，所以不会每帧重跑。
$effect(() => {
	const active = currentIndex;
	// 读一下 gutter，让它变化时重新居中
	const padding = gutter;
	if (!box || active < 0 || padding <= 0) return;

	centerOn(active);
});
</script>

<div class="lyrics-pane" style:--lyric-align={align}>
	<div class="toolbar">
		<div class="group" role="group" aria-label="歌词对齐">
			{#each ALIGN_OPTIONS as option (option.value)}
				<button
					type="button"
					class="tool"
					aria-pressed={align === option.value}
					aria-label={option.label}
					onclick={() => setAlign(option.value)}
				>
					<svg viewBox="0 0 16 16" aria-hidden="true">
						<path d={option.path} />
					</svg>
				</button>
			{/each}
		</div>

		{#if hasTranslation}
			<span class="sep" aria-hidden="true"></span>
			<button
				type="button"
				class="tool tr"
				aria-pressed={showTranslation}
				aria-label="翻译"
				title={showTranslation ? "隐藏翻译" : "显示翻译"}
				onclick={toggleTranslation}>译</button
			>
		{/if}
	</div>

	{#if lines.length === 0}
		<p class="empty">暂无歌词</p>
	{:else}
		<div class="scroller" bind:this={box} aria-label="歌词" role="group">
			<div class="list" style:--lyric-gutter={`${gutter}px`}>
				{#each lines as line, index (index)}
					{@const isActive = index === currentIndex}
					{@const distance = Math.min(Math.abs(index - currentIndex), 5)}
					<div
						class="line"
						data-index={index}
						data-active={isActive}
						data-tinted={line.color ? "true" : undefined}
						style:--distance={distance}
						style:--line-color={line.color || "var(--music-accent-strong)"}
					>
						<span class="text"
							>{#each line.spans as span, spanIndex (spanIndex)}<span
									class="span"
									style:--span-color={span.color || "inherit"}
									data-sung={isActive ? spanIndex < sungCount : true}>{span.text}</span
								>{/each}</span
						>
						{#if showTranslation && line.translation}
							<span class="tr-text">{line.translation}</span>
						{/if}
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style>
	.lyrics-pane {
		position: relative;
		display: flex;
		height: 100%;
		min-width: 0;
		flex-direction: column;
		align-items: center;
	}

	.scroller {
		position: relative;
		display: flex;
		flex: 1;
		min-height: 0;
		/* 歌词列比整个右栏窄一点，行更好读 */
		width: 100%;
		max-width: 42rem;
		flex-direction: column;
		padding-inline: 1rem;
		/* 不接收用户滚动：仍可程序化 scrollTo，但滚轮/手势全部穿透出去 */
		overflow: hidden;
		/* 位置完全由脚本决定，禁止浏览器的滚动锚定自动"帮忙"调整 */
		overflow-anchor: none;
		/* 上下淡出，滚到两端不是硬切 */
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent 0,
			#000 7%,
			#000 93%,
			transparent 100%
		);
		mask-image: linear-gradient(
			to bottom,
			transparent 0,
			#000 7%,
			#000 93%,
			transparent 100%
		);
	}

	.list {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		padding-block: var(--lyric-gutter, 0px);
	}

	.line {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: 0.2rem;
		/* 铺满整行宽度，text-align 才会生效（居中/左/右都靠它） */
		align-items: stretch;
		padding: 0.4rem 0.6rem;
		/* 行内文字统一用这个字号，翻译按 em 跟着它缩放 */
		font-size: 1.1rem;
		color: var(--content-meta);
		text-align: var(--lyric-align, center);
		opacity: calc(1 - var(--distance) * 0.15);
		transition:
			opacity 260ms ease,
			color 260ms ease;
	}

	.line[data-active="true"] {
		opacity: 1;
		color: var(--line-color);
		font-size: clamp(1.45rem, 1.25rem + 0.8vw, 2rem);
	}

	/* 有自定义颜色的行，即使不在当前也透出一点颜色，方便看出分段 */
	.line[data-tinted="true"]:not([data-active="true"]) {
		color: color-mix(in oklab, var(--line-color) 60%, var(--content-meta));
	}

	.text {
		display: block;
		line-height: 1.6;
		text-wrap: pretty;
	}

	.line[data-active="true"] .text {
		font-weight: 700;
		line-height: 1.45;
	}

	.span {
		color: var(--span-color);
		transition: opacity 180ms ease;
	}

	/* 还没唱到的字/词压暗，唱到时点亮 */
	.span[data-sung="false"] {
		opacity: 0.38;
	}

	/* 翻译：跟着当前行字号等比缩小一点，并封顶，免得当前行变成一大块；
	   没有翻译的行不会占位 */
	.tr-text {
		display: block;
		font-size: min(0.9em, 1.65rem);
		line-height: 1.45;
		color: var(--content-meta);
		opacity: 0.85;
	}

	/* 当前行的翻译跟着高亮：同色、更实 */
	.line[data-active="true"] .tr-text {
		color: inherit;
		opacity: 1;
	}

	/* 右上角小工具条：贴着歌词列的右边缘（而不是整个右栏），
	   `50% - 半列宽` 正好落在列的内侧 */
	.toolbar {
		position: absolute;
		z-index: 2;
		top: 0.7rem;
		right: max(0.75rem, calc(50% - 21rem));
		display: flex;
		align-items: center;
		gap: 0.15rem;
		padding: 0.15rem;
		border-radius: 999px;
		background-color: color-mix(in oklab, var(--card-bg) 66%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		box-shadow: 0 1px 2px rgb(0 0 0 / 0.06);
	}

	/* 默认收着，别抢歌词的注意力；悬停/聚焦才完全显现。
	   静止态的透明度对所有设备生效 —— 只写在 @media (hover: hover) 里的话，
	   触屏会一直是"完全显现"（看起来像卡在 hover） */
	.toolbar {
		opacity: 0.62;
		transition: opacity 160ms ease;
	}

	@media (hover: hover) {
		.toolbar:hover,
		.toolbar:focus-within {
			opacity: 1;
		}
	}

	.group {
		display: flex;
		align-items: center;
		gap: 0.1rem;
	}

	.tool {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--content-meta);
		cursor: pointer;
		transition:
			color 150ms ease,
			background-color 150ms ease;
	}

	.tool svg {
		width: 0.85rem;
		height: 0.85rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.6;
		stroke-linecap: round;
	}

	.tool:hover {
		color: var(--music-accent-strong);
	}

	.tool[aria-pressed="true"] {
		background-color: color-mix(in oklab, var(--music-accent) 20%, transparent);
		color: var(--music-accent-strong);
	}

	.tool.tr {
		font-size: 0.68rem;
		font-weight: 600;
	}

	.sep {
		width: 1px;
		height: 0.9rem;
		background: color-mix(in oklab, var(--music-ink) 14%, transparent);
	}

	.empty {
		margin: auto;
		padding: 2rem;
		color: var(--content-meta);
		font-size: 0.9rem;
	}
</style>
