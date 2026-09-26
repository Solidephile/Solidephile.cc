<script lang="ts">
/**
 * osu 页面的四个 tab：游戏简介 / 历史数据 / 最好成绩 / 谱面相关
 * 使用共用的 TabNav（layout="fill" 等分铺满），选中的 tab 会同步到 URL hash
 */
import TabNav from "@components/common/TabNav.svelte";
import type { OsuHistoryItem } from "@/types/osu";

import HistoryCharts from "./HistoryCharts.svelte";
import ScoresList from "./ScoresList.svelte";

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

// 「最好成绩」首次打开后保持挂载（用 CSS 隐藏，而不是销毁）：
// 这样切走再切回来不会重复请求，也不会丢掉已经展开的条数
let scoresOpened = $state(false);

function handleTabChange(tabId: string) {
	activeTab = tabId;

	if (tabId === "scores") {
		scoresOpened = true;
	}
}
</script>

<div class="mb-6">
	<TabNav tabs={TABS} {activeTab} onTabChange={handleTabChange} layout="fill" />

	{#if activeTab === "intro"}
		<!-- TODO: 游戏简介内容 -->
		{@render placeholder("游戏简介", "内容待补充")}
	{:else if activeTab === "history"}
		<HistoryCharts {history} />
	{:else if activeTab === "beatmaps"}
		<!-- TODO: 谱面相关内容 -->
		{@render placeholder("谱面相关", "内容待补充")}
	{/if}

	<!-- 最好成绩：懒加载（首次打开才挂载），打开后靠 hidden 切换以保留状态 -->
	{#if scoresOpened}
		<div class:hidden={activeTab !== "scores"}>
			<ScoresList />
		</div>
	{/if}
</div>

{#snippet placeholder(title: string, note: string)}
	<div class="card-base flex flex-col items-center justify-center gap-2 p-10 text-center">
		<p class="text-lg font-semibold text-neutral-700 dark:text-neutral-300">{title}</p>
		<p class="text-sm text-neutral-500 dark:text-neutral-400">{note}</p>
	</div>
{/snippet}
