<script lang="ts">
/**
 * 单条成绩卡片（横向）
 *
 * 布局：评级（最左）— 谱面信息 — 元信息 — pp（最右）
 * 背景：铺面封面铺满整卡，再用 card-bg 遮罩从左到右渐隐（两段式，参照 osu! Expert+）：
 *       0–40% 保持同一浓度（平台段），40–80% 才渐隐到卡片底色。
 * 封面按视口加载：进入/接近视口才渲染 <img>，离开后移除，释放解码后的位图内存。
 *
 * 色彩映射（星级胶囊、mod 档位配色）集中在 ./score-visuals.ts
 */
import { onMount } from "svelte";
import type { OsuScore, OsuScoreRank } from "@/types/osu";

import { observeInView } from "./in-view";
import {
	difficultyColour,
	difficultyTextColour,
	type ModTone,
	modTone,
} from "./score-visuals";

interface Props {
	score: OsuScore;
	/** 置顶成绩：标题前显示标记录 */
	pinned?: boolean;
}

const { score, pinned = false }: Props = $props();

// 封面按视口加载。
// 100 张 400×240 的封面解码后约 38MB，离开视口不卸载会一直占着内存。
let cardEl: HTMLElement | undefined;
let coverInView = $state(false);

onMount(() => {
	if (!cardEl) return;

	return observeInView(cardEl, (inView) => {
		coverInView = inView;
	});
});

// 评级配色：XH/SH 是 Hidden 的「银」评级，X/S 为金
const RANK_STYLES: Record<string, string> = {
	XH: "bg-neutral-300 text-neutral-800",
	X: "bg-amber-400 text-amber-950",
	SH: "bg-neutral-300 text-neutral-800",
	S: "bg-amber-400 text-amber-950",
	A: "bg-emerald-500 text-white",
	B: "bg-sky-500 text-white",
	C: "bg-violet-500 text-white",
	D: "bg-rose-500 text-white",
	F: "bg-neutral-500 text-white",
};

const DEFAULT_RANK_STYLE = "bg-neutral-400 text-white";

function rankLabel(rank: OsuScoreRank | null): string {
	switch (rank) {
		case "XH":
		case "X":
			return "SS";
		case "SH":
		case "S":
			return "S";
		default:
			return rank ?? "?";
	}
}

let rankStyle = $derived(
	(score.rank && RANK_STYLES[score.rank]) || DEFAULT_RANK_STYLE,
);

// 星级胶囊：底色与文字色都走 osu-web 的难度色带，星级越高颜色越深
let starBg = $derived(difficultyColour(score.stars));
let starText = $derived(difficultyTextColour(score.stars));

// mod 胶囊配色：按「降低难度 / 提升难度 / 中性」分档，而不是每个 mod 一个品牌色
const TONE_STYLES: Record<ModTone, string> = {
	reduce: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
	increase: "bg-rose-500/15 text-rose-700 dark:text-rose-300",
	plain: "bg-(--btn-regular-bg) text-(--btn-content)",
};

function modStyle(mod: string): string {
	return TONE_STYLES[modTone(mod)];
}
</script>

<article class="card-base relative overflow-hidden" bind:this={cardEl}>
	<!-- 铺面封面：整卡背景；按视口加载 / 离开视口后卸载 -->
	{#if score.cover && coverInView}
		<img
			src={score.cover}
			alt=""
			aria-hidden="true"
			decoding="async"
			class="pointer-events-none absolute inset-0 h-full w-full object-cover"
		/>
	{/if}

	<!-- 遮罩：两段式渐隐（浓度与 Expert+ 一致）
	     0–40% 保持 72% 浓度（平台段）→ 左侧封面压暗但可见，不会越往右越淡
	     40–75% 才渐隐到卡片底色 → 右侧文字落在纯色底上 -->
	<div
		class="pointer-events-none absolute inset-0"
		style="background: linear-gradient(to right, color-mix(in oklab, var(--card-bg) 72%, transparent) 0%, color-mix(in oklab, var(--card-bg) 72%, transparent) 40%, var(--card-bg) 75%, var(--card-bg) 100%);"
	></div>

	<!-- 内容 -->
	<div class="relative flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
		<!-- 评级（最左） -->
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-black {rankStyle}"
		>
			{rankLabel(score.rank)}
		</div>

		<!-- 谱面信息 -->
		<div class="min-w-0 flex-1">
			<div class="flex items-baseline gap-1.5">
				{#if pinned}
					<span
						class="shrink-0 rounded px-1 py-px text-[10px] font-bold bg-(--primary)/15 text-(--primary)"
					>
						置顶
					</span>
				{/if}
				<span class="truncate text-sm font-bold text-neutral-900 dark:text-neutral-100">
					{score.title}
				</span>
				{#if score.artist}
					<!-- 艺术家与歌曲名同色，小一号；宽度不足时标题与艺术家各自省略 -->
					<span class="shrink-0 text-xs text-neutral-900 dark:text-neutral-100">by</span>
					<span class="truncate text-xs font-medium text-neutral-900 dark:text-neutral-100">
						{score.artist}
					</span>
				{/if}
			</div>

			<div class="truncate text-xs text-neutral-600 dark:text-neutral-400">
				{score.version}
			</div>

			<!-- 窄屏：元信息另起一行 -->
			<div class="mt-1.5 sm:hidden">{@render meta()}</div>
		</div>

		<!-- 宽屏：元信息单列 -->
		<div class="hidden shrink-0 sm:block">{@render meta()}</div>

		<!-- pp（最右）：强调色；tabular-nums 让各行的数位与小数点纵向对齐 -->
		<div class="shrink-0 text-right">
			<div class="text-lg leading-tight font-bold tabular-nums text-(--primary)">
				{score.pp.toFixed(2)}
			</div>
			<div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">pp</div>
		</div>
	</div>
</article>

{#snippet meta()}
	<div
		class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300"
	>
		<!-- 难度星级：胶囊底色 = osu-web 难度色带，文字色走对应的高对比色带。
		     宽度下限的作用是让不同卡片的星级胶囊等宽，从而对齐右侧的准确率与 mod -->
		<span
			class="inline-flex min-h-[1.35em] min-w-[3.75rem] shrink-0 items-center justify-center gap-[0.1em] rounded-full px-[0.55em] py-[0.22em] text-[11px] leading-none font-extrabold tabular-nums"
			style="background-color: {starBg}; color: {starText};"
		>
			<span class="text-[0.7em] leading-none" aria-hidden="true">★</span>
			{score.stars.toFixed(2)}
		</span>

		<!-- 准确率 -->
		<span class="font-medium tabular-nums">{(score.accuracy * 100).toFixed(2)}%</span>

		<!-- 使用的 mod -->
		{#if score.mods.length > 0}
			<span class="flex flex-wrap items-center gap-1">
				{#each score.mods as mod (mod)}
					<span class="rounded px-1.5 py-0.5 text-[10px] font-bold {modStyle(mod)}">
						{mod}
					</span>
				{/each}
			</span>
		{/if}
	</div>
{/snippet}
