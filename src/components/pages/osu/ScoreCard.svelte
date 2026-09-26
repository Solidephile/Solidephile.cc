<script lang="ts">
/**
 * 单条成绩卡片（横向）
 *
 * 布局：评级（最左）— 谱面信息 — 元信息 — pp（最右）
 *       谱面信息两行：第一行「歌曲名 by 艺术家」，第二行「星级胶囊 + 难度名」
 * 背景：铺面封面铺满整卡，再用 card-bg 遮罩从左到右渐隐（两段式，参照 osu! Expert+）：
 *       0–40% 保持同一浓度（平台段），40–80% 才渐隐到卡片底色。
 * 封面按视口加载：进入/接近视口才渲染 <img>，离开后移除，释放解码后的位图内存。
 *
 * 色彩映射（星级胶囊、mod 档位配色）集中在 ./score-visuals.ts
 */

import Icon from "@components/common/Icon.svelte";
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

/** osu! 成绩页（v2 API 的全局成绩 ID，与 /scores/{id} 一致） */
const SCORE_URL_BASE = "https://osu.ppy.sh/scores/";

const scoreUrl = $derived(
	score.id ? `${SCORE_URL_BASE}${score.id}` : undefined,
);

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

// 评级徽章：配色照搬 osu-web v2019 官方徽章
// 来源：resources/images/badges/score-ranks-v2019/GradeSmall-*.svg
//
// 官方没有「银底徽章」——SS 一律品红底、S 一律青底，银与金的区别只在字母颜色
// （金渐变 #FFE7A8→#FFB800 / 银渐变 white→#AADFF0）。
//
// 亮/暗分开写的原因：
//   官方底色是给深色界面设计的，直接放在白卡片上会显得发闷，所以亮色模式把底色
//   的 HSL 亮度 +4%。但青底（S 系）本身亮度居中，提亮会让浅色字母更糊，所以亮色
//   模式同时把字母换成官方渐变的浅端（金 #FFE7A8 / 银 纯白）来补回对比度——
//   实测 A/B/C/D 对比度上升，S 系基本持平，没有一处变差。
//   F 是失败徽章，官方就是深灰，两种模式都保持原样（且最佳成绩里不会出现）。
//
// 类名必须写成完整字面量：Tailwind 只扫描源码中的字面字符串，模板拼接不会被识别。
const RANKS: Record<OsuScoreRank, { label: string; style: string }> = {
	XH: {
		label: "SS",
		style: "bg-[#e01eab] text-white dark:bg-[#CE1C9D] dark:text-[#D5EFF8]",
	},
	X: {
		label: "SS",
		style: "bg-[#e01eab] text-[#FFE7A8] dark:bg-[#CE1C9D] dark:text-[#FFD054]",
	},
	SH: {
		label: "S",
		style: "bg-[#00bbc9] text-white dark:bg-[#00A8B5] dark:text-[#D5EFF8]",
	},
	S: {
		label: "S",
		style: "bg-[#00bbc9] text-[#FFE7A8] dark:bg-[#00A8B5] dark:text-[#FFD054]",
	},
	A: { label: "A", style: "bg-[#87e116] text-[#275227] dark:bg-[#7CCE14]" },
	B: { label: "B", style: "bg-[#e5b842] text-[#553A2B] dark:bg-[#E3B130]" },
	C: { label: "C", style: "bg-[#f39065] text-[#473625] dark:bg-[#F18252]" },
	D: { label: "D", style: "bg-[#eb6565] text-[#512525] dark:bg-[#E95353]" },
	F: { label: "F", style: "bg-[#3F3F3F] text-[#CC3333]" },
};

/** rank 缺失时的兜底（老数据 / 异常响应） */
const FALLBACK_RANK = { label: "?", style: "bg-neutral-400 text-white" };

const rankView = $derived((score.rank && RANKS[score.rank]) || FALLBACK_RANK);

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

<a
	class="card-base group relative block overflow-hidden"
	href={scoreUrl}
	target="_blank"
	rel="noopener noreferrer"
	bind:this={cardEl}
>
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
	     0–40% 保持 60% 浓度（平台段）→ 左侧封面压暗但可见，不会越往右越淡
	     40–75% 才渐隐到卡片底色 → 右侧文字落在纯色底上 -->
	<div
		class="pointer-events-none absolute inset-0"
		style="background: linear-gradient(to right, color-mix(in oklab, var(--card-bg) 60%, transparent) 0%, color-mix(in oklab, var(--card-bg) 60%, transparent) 40%, var(--card-bg) 75%, var(--card-bg) 100%);"
	></div>

	<!-- 可点击反馈：只叠一层很淡的中性明暗，不换色（避免同亮度异彩度的问题） -->
	<div
		class="pointer-events-none absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-150 group-hover:opacity-100 dark:bg-white/10"
	></div>

	<!-- 内容 -->
	<div class="relative flex items-center gap-3 px-3 py-2.5 sm:gap-4 sm:px-4 sm:py-3">
		<!-- 评级（最左）；内描边（inset-ring）让徽章看起来更有质感 -->
		<div
			class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-lg font-black inset-ring-1 inset-ring-white/30 {rankView.style}"
		>
			{rankView.label}
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
					<!-- 艺术家让位给歌曲名。用 flex:1 1 0（基准宽度 0）而不是缩小权重：
					     基准为 0 意味着空间不足时它无处可缩，收缩量只能全部落在歌曲名上。
					     于是顺序恒为「歌曲名 by 艺术家…」→「歌曲名…」，不会两个一起省略 -->
					<span
						class="min-w-0 flex-1 truncate text-xs text-neutral-900 dark:text-neutral-100"
						>by <span class="font-medium">{score.artist}</span></span
					>
				{/if}
			</div>

			<!-- 难度名；星级胶囊固定在标题下方的最左侧 -->
			<div class="mt-1 flex items-center gap-2">
				<span
					class="inline-flex min-h-[1.35em] shrink-0 items-center justify-center gap-[0.15em] rounded-full px-[0.55em] py-[0.22em] text-[11px] leading-none font-extrabold tabular-nums"
					style="background-color: {starBg}; color: {starText};"
				>
					<!-- 用 SVG 圆角星，而不是 ★ 字形：字形在小字号下尖角锯齿很明显 -->
					<Icon icon="material-symbols:star-rounded" class="shrink-0 text-[1.15em]" />
					{score.stars.toFixed(2)}
				</span>

				<!-- 金色取自 Expert+ 的成绩卡配色；纯金在亮色底上太浅，亮色改用更深的琥珀 -->
				<span class="truncate text-xs font-medium text-neutral-700 dark:text-amber-400">
					{score.version}
				</span>
			</div>

			<!-- 窄屏：元信息另起一行 -->
			<div class="mt-1.5 sm:hidden">{@render meta()}</div>
		</div>

		<!-- 宽屏：元信息单列；靠右对齐，让 mod 的右端与准确率落点固定 -->
		<div class="hidden shrink-0 sm:block">{@render meta("justify-end")}</div>

		<!-- pp（最右）：强调色；tabular-nums 让各行的数位与小数点纵向对齐。
		     宽屏给固定轨道宽度——它是右轨的最后一列，宽度一变，左边 mod / 准确率
		     的落点就跟着漂，准确率就再也对不齐了 -->
		<div class="shrink-0 text-right sm:w-[6.75rem]">
			<div class="text-xl leading-tight font-bold tabular-nums text-(--primary)">
				{score.pp.toFixed(2)}
			</div>
			<div class="text-[10px] font-medium text-neutral-500 dark:text-neutral-400">pp</div>
		</div>
	</div>
</a>

{#snippet meta(extra = "")}
	<div
		class="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-neutral-700 dark:text-neutral-300 {extra}"
	>
		<!-- 准确率：窄屏排在最左——它的左缘就是本行的起点，与 mod 数量无关，因此各行严格对齐。
		     宽屏用 order 移到 mod 右侧，改成固定 7.5ch 轨道 + 右对齐（与 Expert+ 同值），
		     落点同样是固定的，mod 贴着它的左缘排。
		     字号只在宽屏放大：窄屏的信息密度本来就高，跟着放大会挤成一团 -->
		<span
			class="shrink-0 text-[12px] font-bold text-neutral-700 tabular-nums sm:order-2 sm:w-[7.5ch] sm:text-right sm:text-[16px] dark:text-amber-400"
		>
			{(score.accuracy * 100).toFixed(2)}%
		</span>

		<!-- 使用的 mod -->
		{#if score.mods.length > 0}
			<span class="flex flex-wrap items-center gap-1 sm:order-1">
				{#each score.mods as mod (mod)}
					<span class="rounded px-1.5 py-0.5 text-[10px] font-bold sm:text-[12px] {modStyle(mod)}">
						{mod}
					</span>
				{/each}
			</span>
		{/if}
	</div>
{/snippet}
