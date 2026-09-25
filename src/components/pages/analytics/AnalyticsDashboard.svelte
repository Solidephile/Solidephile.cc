<script lang="ts">
import { onMount } from "svelte";
import Icon from "@/components/common/Icon.svelte";
import LineChart from "@/components/common/LineChart.svelte";
import TabNav from "@/components/common/TabNav.svelte";
import AnalyticsPanel from "./AnalyticsPanel.svelte";
import BreakdownList from "./BreakdownList.svelte";

interface MetricRow {
	name: string;
	value: number;
}

interface DashboardData {
	days: number;
	rangeLabel: string;
	/** 数据生成时间（毫秒时间戳） */
	updatedAt: number;
	stats: {
		totalViews: number;
		totalVisitors: number;
		todayViews: number;
		todayVisitors: number;
	};
	topPages: MetricRow[];
	channels: MetricRow[];
	countries: MetricRow[];
	browsers: MetricRow[];
	devices: MetricRow[];
}

interface SeriesData {
	range: string;
	rangeLabel: string;
	series: {
		labels: string[];
		pageviews: number[];
		sessions: number[];
	};
}

const RANGE_TABS = [
	{ id: "7d", name: "近 7 天" },
	{ id: "30d", name: "近 30 天" },
	{ id: "90d", name: "近 90 天" },
];

// Umami 的渠道名是英文（direct / search / ...），展示时转成中文
const CHANNEL_LABELS: Record<string, string> = {
	direct: "直接访问",
	search: "搜索引擎",
	social: "社交媒体",
	referral: "外部链接",
	email: "邮件",
	paid: "付费推广",
	organic: "自然流量",
};

let range = $state("30d");
let dashboard = $state<DashboardData | null>(null);
let series = $state<SeriesData | null>(null);
let dashboardError = $state<string | null>(null);
let seriesError = $state<string | null>(null);
let loadingSeries = $state(true);

// 汇总 + 排名：固定近 30 天，只在首次加载时请求
async function loadDashboard() {
	try {
		// 不带时间戳参数，好让服务端与 CDN 的 5 分钟缓存生效
		const res = await fetch("/api/umami?view=dashboard");
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		dashboard = (await res.json()) as DashboardData;
		dashboardError = null;
	} catch (err) {
		console.error("读取站点汇总失败:", err);
		dashboardError = "数据加载失败，请稍后重试";
	}
}

// 已取过的范围缓存在内存里：来回切换时不再发请求（刷新页面即清空）
const seriesCache = new Map<string, SeriesData>();

// 趋势：跟随范围切换；命中缓存就直接用
async function loadSeries(nextRange: string) {
	const cached = seriesCache.get(nextRange);

	if (cached) {
		series = cached;
		seriesError = null;
		loadingSeries = false;
		return;
	}

	loadingSeries = true;

	try {
		const res = await fetch(`/api/umami?view=series&range=${nextRange}`);
		if (!res.ok) throw new Error(`HTTP ${res.status}`);

		const payload = (await res.json()) as SeriesData;
		seriesCache.set(nextRange, payload);
		series = payload;
		seriesError = null;
	} catch (err) {
		console.error("读取访问趋势失败:", err);
		seriesError = "趋势数据加载失败";
	} finally {
		loadingSeries = false;
	}
}

function handleRangeChange(nextRange: string) {
	if (nextRange === range) return;
	range = nextRange;
	loadSeries(nextRange);
}

onMount(() => {
	loadDashboard();
	loadSeries(range);
});

function formatNumber(value: number): string {
	return Number(value).toLocaleString("en-US");
}

// 数据生成时间（服务端返回；受 CDN 缓存影响，反映的是取数时刻）
function formatTime(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString("zh-CN", {
		hour: "2-digit",
		minute: "2-digit",
	});
}

const summaryCards = $derived(
	dashboard
		? [
				{
					icon: "material-symbols:group",
					label: "累计访客",
					value: formatNumber(dashboard.stats.totalVisitors),
				},
				{
					icon: "material-symbols:visibility",
					label: "累计浏览",
					value: formatNumber(dashboard.stats.totalViews),
				},
				{
					icon: "material-symbols:today",
					label: "今日访客",
					value: formatNumber(dashboard.stats.todayVisitors),
				},
				{
					icon: "material-symbols:view-day-outline",
					label: "今日浏览",
					value: formatNumber(dashboard.stats.todayViews),
				},
			]
		: [],
);

const channelItems = $derived(
	(dashboard?.channels ?? []).map((row) => ({
		...row,
		name: CHANNEL_LABELS[row.name.toLowerCase()] ?? row.name,
	})),
);
</script>

<div class="flex flex-col gap-4">
	{#if dashboardError}
		<div
			class="card-base p-10 text-center text-sm text-neutral-500 dark:text-neutral-400"
		>
			{dashboardError}
		</div>
	{:else if !dashboard}
		<div
			class="card-base p-10 text-center text-sm text-neutral-500 dark:text-neutral-400"
		>
			加载中…
		</div>
	{:else}
		<!-- 汇总数据：累计 + 今日 -->
		<div>
			<div class="mb-2 flex items-center justify-between gap-3">
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					数据更新于 {formatTime(dashboard.updatedAt)}
				</p>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					数据来源：Umami
				</p>
			</div>
			<div class="grid grid-cols-2 gap-3 lg:grid-cols-4">
				{#each summaryCards as card (card.label)}
					<div class="card-base flex items-center gap-3 p-4">
						<div
							class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-(--btn-regular-bg) text-xl text-(--primary)"
						>
							<Icon icon={card.icon} />
						</div>
						<div class="min-w-0">
							<p class="text-sm text-neutral-500 dark:text-neutral-400">
								{card.label}
							</p>
							<p
								class="truncate text-xl font-bold text-neutral-900 dark:text-neutral-100"
							>
								{card.value}
							</p>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- 访问趋势：只有这里可以切换时间范围 -->
		<AnalyticsPanel icon="material-symbols:show-chart" title="访问趋势">
			<div class="mb-3">
				<TabNav
					tabs={RANGE_TABS}
					activeTab={range}
					onTabChange={handleRangeChange}
					useHash={false}
				/>
			</div>

			<div
				class="transition-opacity duration-200 {loadingSeries
					? 'opacity-60'
					: ''}"
			>
				{#if seriesError}
					<p
						class="py-16 text-center text-sm text-neutral-500 dark:text-neutral-400"
					>
						{seriesError}
					</p>
				{:else if series}
					<LineChart
						labels={series.series.labels}
						series={[
							{ label: "访问量", data: series.series.pageviews, fill: true },
							{ label: "会话数", data: series.series.sessions },
						]}
						height={280}
						clampZero
					/>
				{:else}
					<div
						class="flex items-center justify-center text-sm text-neutral-500 dark:text-neutral-400"
						style="height: 280px;"
					>
						加载中…
					</div>
				{/if}
			</div>
		</AnalyticsPanel>

		<!-- 各维度排名（固定近 30 天） -->
		<p class="text-xs text-neutral-500 dark:text-neutral-400">
			排名数据 · {dashboard.rangeLabel}
		</p>
		<div class="grid grid-cols-1 gap-4 md:grid-cols-2">
			<AnalyticsPanel icon="material-symbols:description" title="热门页面">
				<BreakdownList items={dashboard.topPages} />
			</AnalyticsPanel>

			<AnalyticsPanel icon="material-symbols:link" title="来源渠道">
				<BreakdownList items={channelItems} />
			</AnalyticsPanel>

			<AnalyticsPanel icon="material-symbols:public" title="访客地区">
				<BreakdownList items={dashboard.countries} />
			</AnalyticsPanel>

			<AnalyticsPanel icon="material-symbols:devices" title="设备与浏览器">
				<div class="flex flex-col gap-4">
					<div>
						<p
							class="mb-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400"
						>
							浏览器
						</p>
						<BreakdownList items={dashboard.browsers} />
					</div>
					<div>
						<p
							class="mb-1.5 text-xs font-medium text-neutral-500 dark:text-neutral-400"
						>
							设备
						</p>
						<BreakdownList items={dashboard.devices} />
					</div>
				</div>
			</AnalyticsPanel>
		</div>
	{/if}
</div>
