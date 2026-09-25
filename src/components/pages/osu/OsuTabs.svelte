<script lang="ts">
/**
 * osu 页面的四个 tab：游戏简介 / 历史数据 / 最好成绩 / 谱面相关
 * 选中的 tab 会同步到 URL hash（由 OsuTabNav 处理）
 */
import type { OsuHistoryItem } from "@/types/osu";

import HistoryCharts from "./HistoryCharts.svelte";
import OsuTabNav from "./OsuTabNav.svelte";

interface Props {
	history: OsuHistoryItem[];
}

const { history }: Props = $props();

const TABS = [
	{ id: "intro", name: "游戏简介", icon: "material-symbols:sports-esports" },
	{ id: "history", name: "历史数据", icon: "material-symbols:show-chart" },
	{ id: "scores", name: "最好成绩", icon: "material-symbols:trophy" },
	{ id: "beatmaps", name: "谱面相关", icon: "material-symbols:map" },
];

let activeTab = $state("intro");

function handleTabChange(tabId: string) {
	activeTab = tabId;
}
</script>

<div class="mb-6">
	<OsuTabNav tabs={TABS} {activeTab} onTabChange={handleTabChange} />

	{#if activeTab === "intro"}
		<!-- TODO: 游戏简介内容 -->
		{@render placeholder("游戏简介", "内容待补充")}
	{:else if activeTab === "history"}
		<HistoryCharts {history} />
	{:else if activeTab === "scores"}
		<!-- TODO: 最好成绩内容 -->
		{@render placeholder("最好成绩", "内容待补充")}
	{:else if activeTab === "beatmaps"}
		<!-- TODO: 谱面相关内容 -->
		{@render placeholder("谱面相关", "内容待补充")}
	{/if}
</div>

{#snippet placeholder(title: string, note: string)}
	<div class="card-base flex flex-col items-center justify-center gap-2 p-10 text-center">
		<p class="text-lg font-semibold text-neutral-700 dark:text-neutral-300">{title}</p>
		<p class="text-sm text-neutral-500 dark:text-neutral-400">{note}</p>
	</div>
{/snippet}
