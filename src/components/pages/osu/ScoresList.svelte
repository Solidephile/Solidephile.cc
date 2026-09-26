<script lang="ts">
/**
 * 「最好成绩」tab 内容
 *
 * - 组件只在 tab 首次被打开时才挂载，所以 onMount 里请求即实现了懒加载
 * - 初始只渲染前 N 条，点「展示更多」逐步追加：
 *   避免一次渲染上百张封面图（100 张同时请求会明显卡顿）
 * - 数据由每日 Cron 抓取后存库，本接口只读数据库，不依赖 osu! 实时可用
 */
import LoadingState from "@components/common/LoadingState.svelte";
import { onMount } from "svelte";
import { osuConfig } from "@/config/osuConfig";
import type { OsuScoresData } from "@/types/osu";

import ScoreCard from "./ScoreCard.svelte";

let data = $state<OsuScoresData | null>(null);
let error = $state<string | null>(null);

/** 最好成绩当前显示到第几条 */
let visibleCount = $state(osuConfig.scoresInitialDisplay);

const pinnedScores = $derived(data?.pinned ?? []);
const bestScores = $derived(data?.best ?? []);
const visibleBest = $derived(bestScores.slice(0, visibleCount));
const hasMore = $derived(visibleCount < bestScores.length);

function showMore() {
	visibleCount = Math.min(
		visibleCount + osuConfig.scoresLoadStep,
		bestScores.length,
	);
}

onMount(async () => {
	try {
		const res = await fetch(`/api/osu_scores?t=${Date.now()}`);

		if (!res.ok) throw new Error(`API ${res.status}`);

		data = (await res.json()) as OsuScoresData;
	} catch (e) {
		console.warn("osu 成绩获取失败:", e);

		error = "成绩数据加载失败";
	}
});
</script>

{#if error}
	<div class="card-base p-8 text-center text-neutral-500 dark:text-neutral-400">
		{error}
	</div>
{:else if !data}
	<LoadingState />
{:else if pinnedScores.length === 0 && bestScores.length === 0}
	<div class="card-base p-8 text-center text-neutral-500 dark:text-neutral-400">
		暂无成绩数据（每日自动更新一次）
	</div>
{:else}
	<div class="flex flex-col gap-8">
		<!-- ============ 置顶成绩 ============ -->
		{#if pinnedScores.length > 0}
			<section>
				<div class="mb-3 flex items-center justify-between">
					<div>
						<p class="mb-1 text-xs text-neutral-500 dark:text-neutral-400">PINNED</p>
						<h3 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">置顶成绩</h3>
					</div>
					<span class="text-sm text-neutral-500 dark:text-neutral-400">
						{pinnedScores.length} 条
					</span>
				</div>

				<div class="flex flex-col gap-3">
					{#each pinnedScores as score, i (`pinned-${score.id ?? i}`)}
						<ScoreCard {score} pinned />
					{/each}
				</div>
			</section>
		{/if}

		<!-- ============ 最好成绩 ============ -->
		{#if bestScores.length > 0}
			<section>
				<div class="mb-3 flex items-center justify-between">
					<div>
						<p class="mb-1 text-xs text-neutral-500 dark:text-neutral-400">BEST</p>
						<h3 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">最好成绩</h3>
					</div>
					<span class="text-sm text-neutral-500 dark:text-neutral-400">
						已显示 {visibleBest.length} / {bestScores.length} 条
					</span>
				</div>

				<div class="flex flex-col gap-3">
					{#each visibleBest as score, i (`best-${score.id ?? i}`)}
						<ScoreCard {score} />
					{/each}
				</div>

				{#if hasMore}
					<div class="mt-5 flex justify-center">
						<!-- 按钮落在页面底色 --page-bg 上，而 --btn-regular-bg 与它是同亮度、
						     只差彩度（oklch 0.95 / 0.95），会糊在一起。这里沿用 SegmentedControl
						     的做法，整档下沉到 --btn-regular-bg-hover，色差才看得出来 -->
						<button
							type="button"
							class="rounded-lg bg-(--btn-regular-bg-hover) px-5 py-2 text-sm font-medium text-(--btn-content) transition-colors duration-150 hover:bg-(--btn-regular-bg-active) active:scale-95"
							onclick={showMore}
						>
							展示更多（还有 {bestScores.length - visibleBest.length} 条）
						</button>
					</div>
				{/if}
			</section>
		{/if}
	</div>
{/if}
