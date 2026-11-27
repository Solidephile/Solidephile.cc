<script lang="ts">
import { flushSync, onDestroy, onMount } from "svelte";
import StateMessage from "@/components/common/StateMessage.svelte";
import { findActiveIndex, LYRIC_LEAD_MS, type LyricLine } from "@/utils/lrc";
import {
	animateScrollTop,
	cancelScrollTop,
	scrollTweenDuration,
} from "@/utils/scroll-tween";
import { readStored, writeStored } from "@/utils/storage-utils";
import { player } from "./player.svelte";

/**
 * 歌词栏（纯展示）
 *
 * 只把播放进度映射成歌词状态，不接收点击、滚轮和触摸：位置完全由进度决定，
 * 进度只能从播放条调整，因此页面滚动与移动端左右滑动都能穿透这块区域。
 * 容器裁掉溢出内容，但保留程序化滚动能力，自动居中依赖这一点。
 *
 * 数据流：
 *   `lrc.ts` 解析出的行 → 按播放时间定位当前行 → 当前行内按段计算填充进度
 *   → 渲染逐字渐变与尾部标点 → 将当前行滚入可视区域中央。
 *
 * 时间基准：
 *   歌词相关的判断统一读取 `lyricTime`（播放时间加上 `LYRIC_LEAD_MS` 的感知提前量），
 *   与导航栏播放器共用同一提前量，避免两处显示不同步。
 *
 * 渲染约定：
 *   各行字号与行距固定，当前行只改变颜色并做轻微缩放，所以切行不会触发整列重排；
 *   未唱文字使用中性灰、已唱使用行色，逐字填充通过文字裁切渐变实现。
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
const WORD_MODE_KEY = "music-lyrics-word-mode";

let box: HTMLDivElement | undefined = $state();
let align = $state<Align>("center");
let showTranslation = $state(true);
/**
 * 逐字歌词模式。
 *
 * 开启：带 `<...>` 时间的段按标记时间逐段填充；没有标记的行整行扫过。
 * 关闭：按段到点即亮，不做滑动。
 */
let wordMode = $state(true);
/** 列表上下留白：取可视高度的一半，使首尾行也能滚到正中 */
let gutter = $state(0);
/**
 * 本次切行的过渡时长：滚动补间与当前行缩放共用。
 *
 * 由 `scrollTweenDuration` 按滚动距离算出，写入 CSS 变量 `--line-grow-ms`，
 * 使缩放与整列滚动同时开始、同时结束。
 */
let growMs = $state(600);

// 感知提前量统一在 lrc.ts 定义，导航栏播放器共用同一个值
const lyricTime = $derived(player.stageTime + LYRIC_LEAD_MS / 1000);

/**
 * 逐字行提前进入「当前行」状态的时间。
 *
 * 只提前行状态（换色 / 缩放 / 居中 / 滚动），逐段点亮仍按各自时间；
 * 没有逐字时间的首段也仍在行时间才开始。整句先就位，再开始逐字。
 */
const LINE_ARRIVE_LEAD_MS = 250;

const hasTranslation = $derived(
	lines.some((line) => line.translation.length > 0),
);

const activeIndex = $derived(findActiveIndex(lines, lyricTime));

/** 这一行是不是「逐字行」：至少两段且其中至少一段带 `<...>` 时间 */
function hasWordTiming(line: LyricLine): boolean {
	return line.spans.length > 1 && line.spans.some((span) => span.t !== null);
}

/**
 * 「当前行」= 高亮并居中的那一行。
 *
 * 第一句开始前 `activeIndex` 为负（前奏较长时），直接沿用会让整屏灰字停在上端，
 * 看起来像高亮失效；因此把它夹到第一行，开场即把首句视为当前行。
 *
 * 逐字行额外提前 `LINE_ARRIVE_LEAD_MS` 进入当前行状态（只在它自己的行时间之前生效），
 * 普通行仍按行时间切换。
 */
const currentIndex = $derived.by(() => {
	if (lines.length === 0) return -1;

	let index = activeIndex;
	while (index + 1 < lines.length) {
		const next = lines[index + 1];
		if (!hasWordTiming(next)) break;
		if (next.t - LINE_ARRIVE_LEAD_MS / 1000 > lyricTime) break;
		index += 1;
	}

	return Math.max(0, index);
});

/** 没有逐字时间的行：整行从左到右扫过所用的时长 */
const UNTIMED_LINE_SWEEP_S = 0.6;

/** 最后一段既没有下一段时间戳、行尾也没有结束时间时，用它自己的固定时长收尾 */
const LAST_SPAN_SWEEP_S = 0.5;

/**
 * 尾部装饰（行尾标点与空格）扫过所用的时间。
 *
 * 装饰不参与正片的时间分配，只在整段末尾的一小段里独立扫过；
 * 因此标点不会在段末瞬间变色，也不会占用正片的渐变时间。
 */
const TAIL_SWEEP_S = 0.2;

/** 当前行一段的填充进度 */
type SpanFill = {
	/** 正片填充进度 */
	progress: number;
	/** 尾部装饰的局部填充进度 */
	tail: number;
};

/**
 * 当前行各段的填充进度，逐字渐变的驱动数据。
 *
 * 段与段之间线性推进，保证填充到某段时正好到达它的时间点（卡拉 OK 的常规做法）。
 * 最后一段优先使用行尾单独写的时间戳作为终点，没有则按固定时长收尾；
 * 整行没有逐字时间时只有一段，从行时间开始扫过。
 *
 * `tail` 是行尾装饰的局部进度：正片走完整段时，装饰在段尾那一小段内扫过。
 */
const spanFills = $derived.by<SpanFill[]>(() => {
	const line = lines[currentIndex];
	if (!line || !wordMode) return [];

	const timed = line.spans.some((span) => span.t !== null);
	const starts = line.spans.map((span) => span.t ?? line.t);
	const fallback = timed ? LAST_SPAN_SWEEP_S : UNTIMED_LINE_SWEEP_S;

	return starts.map((start, index) => {
		const next = starts[index + 1];
		const end =
			next !== undefined && next > start
				? next
				: line.end !== null && line.end > start
					? line.end
					: start + fallback;
		const duration = Math.max(end - start, 0.001);
		// 段比扫过窗口还短时，整个段都属于尾部装饰
		const sweep = Math.min(TAIL_SWEEP_S, duration);
		const tail = (lyricTime - (end - sweep)) / sweep;

		return {
			progress: Math.min(1, Math.max(0, (lyricTime - start) / duration)),
			tail: Math.min(1, Math.max(0, tail)),
		};
	});
});

// 切页会重建 island，显示偏好保存在本地
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
	if (readStored(WORD_MODE_KEY) === "0") wordMode = false;
});

function setAlign(value: Align): void {
	align = value;
	writeStored(ALIGN_KEY, value);
}

/**
 * 当前行缩放的 transform-origin：贴住对齐的那一侧。
 *
 * 行是满宽块，缩放默认以中心为原点；左对齐时整行会向内缩进一段，
 * 因此 origin 跟随 `align`，左对齐与右对齐时文字边缘保持不动。
 */
function lineOrigin(value: Align): string {
	if (value === "left") return "left center";
	if (value === "right") return "right center";
	return "center";
}

function toggleTranslation(): void {
	const container = box;
	const index = currentIndex;
	// 以当前行为轴做这次布局变化：先记录它切换前的屏幕位置
	const anchor = container?.querySelector<HTMLElement>(
		`[data-index="${index}"]`,
	);
	const beforeTop = anchor?.getBoundingClientRect().top ?? 0;

	// 状态写入 DOM 之后才能量到新布局
	flushSync(() => {
		showTranslation = !showTranslation;
	});

	writeStored(TRANSLATION_KEY, showTranslation ? "1" : "0");

	// 先一次性抵消整体位移（不补间）：视觉上表现为其余行向中心收拢或从中心散开，
	// 而不是整段滚过很长的距离。歌越靠后，当前行上方累积的高度越多，这一步越关键。
	if (container && anchor) {
		container.scrollTop += anchor.getBoundingClientRect().top - beforeTop;
	}

	// 再补齐当前行偏离中心的残余距离（通常为无，只有被夹到边界时才存在）
	centerOn(index);
}

/** 逐字填充开关：只影响填充与颜色的呈现，不改变布局，因此不需要重新居中 */
function toggleWordMode(): void {
	wordMode = !wordMode;
	writeStored(WORD_MODE_KEY, wordMode ? "1" : "0");
}

// 容器高度变化时更新上下留白
$effect(() => {
	const container = box;
	if (!container) return;

	const observer = new ResizeObserver(() => {
		gutter = Math.round(container.clientHeight / 2);
	});
	observer.observe(container);

	return () => observer.disconnect();
});

// 切页销毁时停止可能仍在运行的补间。
// onDestroy 在 SSR 阶段也会执行，此时 box 必然为空，不会访问服务端不存在的 cancelAnimationFrame。
onDestroy(() => {
	if (box) cancelScrollTop(box);
});

/** 把第 index 行滚到可视区域正中 */
function centerOn(index: number): void {
	const container = box;
	if (!container || index < 0) return;

	const line = container.querySelector<HTMLElement>(`[data-index="${index}"]`);
	if (!line) return;

	const target = Math.max(
		0,
		line.offsetTop - container.clientHeight / 2 + line.offsetHeight / 2,
	);

	// 先按本次滚动距离算出时长，再交给 transform 过渡使用，使缩放与滚动同时收住；
	// 切行时布局不变，目标只需测量一次
	growMs = scrollTweenDuration(target - container.scrollTop);

	animateScrollTop(container, target);
}

// 当前行或上下留白变化时重新居中
$effect(() => {
	const active = currentIndex;
	// 读取留白，使其变化时重新居中
	const padding = gutter;
	if (!box || active < 0 || padding <= 0) return;

	centerOn(active);
});
</script>

<div
	class="lyrics-pane"
	style:--lyric-align={align}
	style:--line-origin={lineOrigin(align)}
	style:--line-grow-ms={`${growMs}ms`}
>
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

		<span class="sep" aria-hidden="true"></span>
		<div class="group" role="group" aria-label="歌词显示">
			<button
				type="button"
				class="tool glyph"
				aria-pressed={wordMode}
				aria-label="逐字歌词"
				title={wordMode ? "关闭逐字歌词" : "开启逐字歌词"}
				onclick={toggleWordMode}>逐</button
			>
			{#if hasTranslation}
				<button
					type="button"
					class="tool glyph"
					aria-pressed={showTranslation}
					aria-label="翻译"
					title={showTranslation ? "隐藏翻译" : "显示翻译"}
					onclick={toggleTranslation}>译</button
				>
			{/if}
		</div>
	</div>

	{#if lines.length === 0}
		<div class="flex w-full flex-1 items-center justify-center">
			<StateMessage size="inline" title="暂无歌词" />
		</div>
	{:else}
		<div class="scroller" bind:this={box} aria-label="歌词" role="group">
			<div
				class="list"
				style:--lyric-gutter={`${gutter}px`}
				data-translation={showTranslation && hasTranslation}
			>
				{#each lines as line, index (index)}
					{@const isActive = index === currentIndex}
					{@const sungAll = index < currentIndex}
					{@const distance = Math.min(Math.abs(index - currentIndex), 5)}
					<!-- 只有已经过去的行才算全部唱完；未来的行保持未唱，否则它会在轮到之前先整行亮起 -->
					<div
						class="line"
						data-index={index}
						data-active={isActive}
						data-tinted={line.color ? "true" : undefined}
						style:--distance={distance}
						style:--line-color={line.color || "var(--music-accent-strong)"}
					>
						<span class="text"
							>{#each line.spans as span, spanIndex (spanIndex)}
								{@const spanFill = spanFills[spanIndex]}
								{@const fill = isActive
									? (spanFill?.progress ?? 0)
									: sungAll
										? 1
										: 0}
								{@const tailFill = isActive ? (spanFill?.tail ?? 0) : fill}
								{@const fillState =
									fill >= 1 ? "sung" : fill <= 0 ? "unsung" : "filling"}
								{@const tailState =
									tailFill >= 1 ? "sung" : tailFill <= 0 ? "unsung" : "filling"}
								<!-- 非逐字模式以整行为单位：行时间一到整行点亮，不再按段计时 -->
								{@const lit = isActive ? lyricTime >= line.t : sungAll}
								<!-- 空格与标点不进入正片的渐变盒子（见 lrc.ts 的 splitDeco）：
								     前导装饰随段开始点亮，尾部装饰在段末独立扫过 -->
								<span class="span" style:--span-color={span.color || "inherit"}
									>{#if span.lead}<span
											class="deco"
											data-fill={wordMode
												? fill > 0
													? "sung"
													: "unsung"
												: lit
													? "sung"
													: "unsung"}>{span.lead}</span
										>{/if}<span
										class="fill"
										style:--span-fill={wordMode
											? `${(fill * 100).toFixed(2)}%`
											: undefined}
										data-fill={wordMode
											? fillState
											: lit
												? "sung"
												: "unsung"}>{span.text}</span
									>{#if span.tail}<span
											class="deco"
											style:--span-fill={wordMode
												? `${(tailFill * 100).toFixed(2)}%`
												: undefined}
											data-fill={wordMode
												? tailState
												: lit
													? "sung"
													: "unsung"}>{span.tail}</span
										>{/if}</span
								>
							{/each}</span
						>
						{#if showTranslation && line.translation}
							<!-- 译文没有逐字时间：行开始前与原文一样保持未唱灰，行开始后整体点亮 -->
							<span class="tr-text" data-sung={lyricTime >= line.t}
								>{line.translation}</span
							>
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
		/* 未唱文字：与主题色同明度的中性灰（同不透明度，只靠色相区分），
		   使一行内只有颜色差异、行与行之间只剩距离衰减 */
		--unsung-base: var(--music-lyric-unsung);
		--fill-edge: 0.35em;
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
		/* 不接收用户滚动：仍可程序化调用 scrollTo，滚轮与手势事件向外传递 */
		overflow: hidden;
		/* 位置完全由脚本决定，禁用浏览器的滚动锚定自动调整 */
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

	/* 带翻译时加大句与句之间的距离：同句译文贴近原文（`.line` 内部间距更小），
	   前后两句之间留出可见分隔，使每组「原文 + 译文」更完整 */
	.list[data-translation="true"] {
		gap: 0.4rem;
	}

	.line {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: 0.2rem;
		/* 铺满整行宽度，对齐方式才生效 */
		align-items: stretch;
		padding: 0.4rem 0.6rem;
		/* 译文使用中档字重；原文在 `.text` 里单独挂歌词字体 */
		font-weight: 500;
		/* 行内文字统一用这个字号，翻译按 em 跟着它缩放 */
		font-size: 1.5rem;
		/* 非当前行的文字统一使用未唱灰：过去行与未来行同色，
		   行与行之间只由距离 opacity 区分；未唱灰也与当前行的未唱部分一致 */
		color: var(--music-lyric-unsung);
		text-align: var(--lyric-align, center);
		/* 行按与当前行的距离衰减；步长由 `.music-host` 按亮/暗模式给出
		   （深色底上同样的透明度更显亮，所以深色模式用更陡的步长）。
		   保留一个下限：否则深色模式最远的行会完全透明，拖动进度条跳转时
		   途经的行会直接消失，只剩亮色模式才能看到淡淡的文字 */
		opacity: max(
			0.15,
			calc(1 - var(--distance) * var(--music-lyric-distance-step, 0.15))
		);
		/* 未唱状态的文字颜色，行内按需覆盖 */
		--unsung-color: var(--unsung-base);
		/* 当前行用 transform 轻微缩放：它不参与布局，不会触发整列重排，
		   代价仅为该行的合成与重绘，优于逐帧重排的 font-size 动画。
		   origin 跟随对齐方式（见 lineOrigin），左对齐与右对齐时文字边缘不位移 */
		transform-origin: var(--line-origin, center);
		/* 各行字号与行距一致，切行时整列高度不变，只有颜色、位置与轻微缩放在变化。
		   缩放时长读取 `--line-grow-ms`（即本次滚动补间的时长），缓动与滚动一致，
		   两者同时开始、同时结束 */
		transition:
			opacity 260ms ease,
			color 260ms ease,
			transform var(--line-grow-ms, 600ms) cubic-bezier(0.65, 0, 0.35, 1);
	}

	.line[data-active="true"] {
		opacity: 1;
		/* 已唱部分直接使用行色（主题色或 `{c:}`），不做明度压深：
		   压深会使浅色模式显得沉闷，也会与主题色脱节 */
		color: var(--line-color);
		/* 当前行轻微缩放，歌词与译文一同变化 */
		transform: scale(1.08);
	}

	/* 有自定义颜色的行即使不是当前行，也保留部分行色，便于辨认分段 */
	.line[data-tinted="true"]:not([data-active="true"]) {
		color: color-mix(in oklab, var(--line-color) 60%, var(--music-lyric-unsung));
	}

	.text {
		display: block;
		/* 原文使用歌词字体（未配置时回退到 body），字重与译文一致 */
		font-family: var(--font-lyric, inherit);
		font-weight: 500;
		line-height: 1.6;
		text-wrap: pretty;
	}

	/* 一段 = 前置装饰 + 正片 + 后置装饰；颜色挂在整段上，子元素只管亮暗和渐变 */
	.span {
		color: var(--span-color);
	}

	.fill,
	.deco {
		transition: color 180ms ease;
	}

	/* 还没唱到的正片、还没唱到的装饰（空格、标点）用中性灰 */
	.fill[data-fill="unsung"],
	.deco[data-fill="unsung"] {
		color: var(--unsung-color);
	}

	/* 正在填充：以渐变作为文字颜色，边缘保留软过渡以避免硬切。
	   百分比基于元素自身宽度（空格与标点已拆为装饰，不计入正片时间），
	   渐变末端使用未唱的中性灰，形成由灰到行色的扫过。
	   尾部标点使用同一规则，仅将其填充进度换为自身的局部进度 */
	.fill[data-fill="filling"],
	.deco[data-fill="filling"] {
		transition: none;
		-webkit-background-clip: text;
		background-clip: text;
		-webkit-text-fill-color: transparent;
		background-image: linear-gradient(
			to right,
			currentColor calc(var(--span-fill) - var(--fill-edge)),
			var(--unsung-color) calc(var(--span-fill) + var(--fill-edge))
		);
	}

	/* 翻译：同一句里贴着原文；没有翻译的行不会占位。
	   字体使用译文字体（马路口圆体的简体中文字形版本），与原文分属两个地区变体；
	   未配置译文字体时回退到歌词字体。颜色始终继承本行，与原文使用同一透明度，
	   层级只靠字号区分；颜色过渡与原文的段一致，行开始 / 结束时两边一起渐变 */
	.tr-text {
		display: block;
		font-family: var(--font-lyric-tr, var(--font-lyric, inherit));
		font-size: 0.8em;
		line-height: 1.45;
		color: inherit;
		transition: color 180ms ease;
	}

	/* 行开始前，译文与原文一样使用未唱灰 */
	.tr-text[data-sung="false"] {
		color: var(--unsung-color);
	}

	/* 右上角小工具条：右边缘与歌词列的内侧对齐（按列宽的一半偏移），
	   而不是贴住整个右栏 */
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

	/* 默认半透明，避免干扰歌词；悬停或聚焦时完全显现。
	   静止透明度对所有设备生效：若只写在 hover 媒体查询里，触屏会一直保持完全显现 */
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

	/* 单字按钮（逐 / 译） */
	.tool.glyph {
		font-size: 0.68rem;
		font-weight: 600;
	}

	.sep {
		width: 1px;
		height: 0.9rem;
		background: color-mix(in oklab, var(--music-ink) 14%, transparent);
	}
</style>
