<script lang="ts">
/**
 * 历史数据曲线（原 OsuPanel 里的图表区）
 * 由 OsuPage 取数后经 OsuTabs 传入 history。
 *
 * 时段过滤是纯前端切片：history 本身就是全量数据，所以切换是瞬时的，
 * 不需要任何接口请求。（记录为每天一条，因此按日期过滤而不是按条数。）
 */
import SegmentedControl from "@/components/common/SegmentedControl.svelte";
import type { OsuHistoryItem } from "@/types/osu";

import ChartCard from "./ChartCard.svelte";

interface Props {
	history: OsuHistoryItem[];
}

const { history }: Props = $props();

const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_OPTIONS = [
	{ id: "7d", name: "7 天" },
	{ id: "30d", name: "30 天" },
	{ id: "90d", name: "90 天" },
	{ id: "all", name: "全部" },
];

const RANGE_DAYS: Record<string, number | null> = {
	"7d": 7,
	"30d": 30,
	"90d": 90,
	all: null,
};

// 默认看全部，和加控件之前的行为保持一致
let range = $state("all");

function timestampOf(item: OsuHistoryItem): number {
	return new Date(item.timestamp).getTime();
}

const filteredHistory = $derived.by(() => {
	const days = RANGE_DAYS[range];

	if (!days) return history;

	const cutoff = Date.now() - days * DAY_MS;
	return history.filter((item) => {
		const time = timestampOf(item);
		return Number.isFinite(time) && time >= cutoff;
	});
});

function handleRangeChange(nextRange: string) {
	range = nextRange;
}

// 准确率的纵轴范围跟着当前时段走
// （用 $derived 而不是顶层直接取值，避免 Svelte 的 state_referenced_locally 告警）
let accuracyValues = $derived(
	filteredHistory
		.map((item) => Number(item.accuracy))
		.filter(Number.isFinite),
);
let accuracyMin = $derived(
	accuracyValues.length > 0 ? Math.min(...accuracyValues) : 0,
);
let accuracyMax = $derived(
	accuracyValues.length > 0 ? Math.max(...accuracyValues) : 100,
);
</script>

<div
	class="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
>
	<div>
		<p class="mb-1 text-xs text-neutral-500 dark:text-neutral-400">HISTORY</p>
		<h3 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">
			数据历史曲线
		</h3>
	</div>

	<div class="flex w-full items-center gap-3 sm:w-auto">
		<span class="shrink-0 text-sm text-neutral-500 dark:text-neutral-400">
			{filteredHistory.length} 条记录
		</span>
		<SegmentedControl
			options={RANGE_OPTIONS}
			value={range}
			onChange={handleRangeChange}
			label="时间范围"
		/>
	</div>
</div>

<div class="grid grid-cols-1 gap-4 @xl:grid-cols-2">
	<ChartCard title="PP值" description="Performance points" unit="pp" history={filteredHistory} dataKey="pp" valueFormat="decimal" suffix=" pp" wide />
	<ChartCard title="全球排名" description="Global Rank" unit="#" history={filteredHistory} dataKey="global_rank" valueFormat="integer" reverse fillBelow />
	<ChartCard title="国家排名" description="Country Rank" unit="#" history={filteredHistory} dataKey="country_rank" valueFormat="integer" reverse fillBelow />
	<ChartCard title="游玩次数" description="Play Count" unit="plays" history={filteredHistory} dataKey="play_count" valueFormat="integer" />
	<ChartCard title="游玩时间" description="Play Time" unit="hours" history={filteredHistory} dataKey="play_time_hours" valueFormat="decimal" suffix=" h" />
	<ChartCard title="总分" description="Total Score" unit="score" history={filteredHistory} dataKey="total_score" valueFormat="compact" />
	<ChartCard title="总命中次数" description="Total Hits" unit="hits" history={filteredHistory} dataKey="total_hits" valueFormat="compact" />
	<ChartCard title="准确率" description="Accuracy" unit="%" history={filteredHistory} dataKey="accuracy" valueFormat="decimal" suffix="%" yMin={Math.max(0, accuracyMin - 0.02)} yMax={Math.min(100, accuracyMax + 0.02)} />
</div>
