<script lang="ts">
/**
 * 历史数据曲线（原 OsuPanel 里的图表区）
 * 由 OsuPage 取数后经 OsuTabs 传入 history。
 */
import type { OsuHistoryItem } from "@/types/osu";

import ChartCard from "./ChartCard.svelte";

interface Props {
	history: OsuHistoryItem[];
}

const { history }: Props = $props();

// 准确率的纵轴范围（用 $derived 而不是顶层直接取值，避免 Svelte 的 state_referenced_locally 告警）
let accuracyValues = $derived(
	history.map((item) => Number(item.accuracy)).filter(Number.isFinite),
);
let accuracyMin = $derived(
	accuracyValues.length > 0 ? Math.min(...accuracyValues) : 0,
);
let accuracyMax = $derived(
	accuracyValues.length > 0 ? Math.max(...accuracyValues) : 100,
);
</script>

<div class="mb-4 flex items-center justify-between">
	<div>
		<p class="mb-1 text-xs text-neutral-500 dark:text-neutral-400">HISTORY</p>
		<h3 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">数据历史曲线</h3>
	</div>
	<span class="text-sm text-neutral-500 dark:text-neutral-400">{history.length} 条记录</span>
</div>

<div class="grid grid-cols-1 gap-4 @xl:grid-cols-2">
	<ChartCard title="PP值" description="Performance points" unit="pp" {history} dataKey="pp" valueFormat="decimal" suffix=" pp" wide />
	<ChartCard title="全球排名" description="Global Rank" unit="#" {history} dataKey="global_rank" valueFormat="integer" reverse fillBelow />
	<ChartCard title="国家排名" description="Country Rank" unit="#" {history} dataKey="country_rank" valueFormat="integer" reverse fillBelow />
	<ChartCard title="游玩次数" description="Play Count" unit="plays" {history} dataKey="play_count" valueFormat="integer" />
	<ChartCard title="游玩时间" description="Play Time" unit="hours" {history} dataKey="play_time_hours" valueFormat="decimal" suffix=" h" />
	<ChartCard title="总分" description="Total Score" unit="score" {history} dataKey="total_score" valueFormat="compact" />
	<ChartCard title="总命中次数" description="Total Hits" unit="hits" {history} dataKey="total_hits" valueFormat="compact" />
	<ChartCard title="准确率" description="Accuracy" unit="%" {history} dataKey="accuracy" valueFormat="decimal" suffix="%" yMin={Math.max(0, accuracyMin - 0.02)} yMax={Math.min(100, accuracyMax + 0.02)} />
</div>
