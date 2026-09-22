<script lang="ts">
import { onMount } from "svelte";
import ChartCard from "./ChartCard.svelte";

interface OsuStats {
	username: string;
	avatar_url: string;
	country: string;
	country_code: string | null;
	global_rank: number;
	country_rank: number;
	pp: number;
	play_time: number;
	updated_at: string;
}

interface OsuHistoryItem {
	timestamp: string;
	global_rank: number;
	country_rank: number;
	pp: number;
	play_count: number;
	play_time: number;
	total_score: number;
	total_hits: number;
	accuracy: number;
	maximum_combo: number;
	play_time_hours?: number;
}

let stats = $state<OsuStats | null>(null);
let history = $state<OsuHistoryItem[]>([]);
let accuracyMin = $state(0);
let accuracyMax = $state(100);

// ---------- Mock 数据（本地 /api/osu 拿不到时回退，方便先看 UI） ----------
function buildMockHistory(): OsuHistoryItem[] {
	const items: OsuHistoryItem[] = [];
	const days = 10;
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		d.setUTCHours(10, 0, 0, 0);
		const k = days - i; // 1..10
		items.push({
			timestamp: d.toISOString(),
			global_rank: 16000 - k * 365,
			country_rank: 1300 - k * 41,
			pp: 5000 + k * 68,
			play_count: 2900 + k * 60,
			play_time: 1050000 + k * 18000,
			total_score: 7500000000 + k * 200000000,
			total_hits: 4800000 + k * 120000,
			accuracy: 97.2 + k * 0.08,
			maximum_combo: 1100 + k * 35,
		});
	}
	return items;
}

const MOCK = {
	stats: {
		username: "Solidephile",
		avatar_url: "",
		country: "China",
		country_code: "CN",
		global_rank: 12345,
		country_rank: 888,
		pp: 5678.9,
		play_time: 1234567,
		updated_at: new Date().toISOString(),
	} as OsuStats,
	history: buildMockHistory(),
};

function prepareHistory(raw: OsuHistoryItem[]): OsuHistoryItem[] {
	return raw
		.map((item) => ({
			...item,
			play_time_hours: Number(item.play_time) / 3600,
		}))
		.sort(
			(a, b) =>
				new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
		);
}

onMount(async () => {
	try {
		const res = await fetch(`/api/osu?t=${Date.now()}`);
		if (!res.ok) throw new Error(`API ${res.status}`);
		const data = await res.json();
		stats = data.stats;
		history = prepareHistory(data.history);
		computeAccuracyRange();
	} catch (e) {
		if (import.meta.env.DEV) {
			console.warn("osu API 不可用，使用 mock 数据:", e);
			stats = MOCK.stats;
			history = prepareHistory(MOCK.history)
			computeAccuracyRange();
		} else {
			error = "数据加载失败";  // 生产环境显示错误状态
		}
	}
});

function computeAccuracyRange() {
	const vals = history.map((i) => Number(i.accuracy)).filter(Number.isFinite);
	if (vals.length > 0) {
		accuracyMin = Math.min(...vals);
		accuracyMax = Math.max(...vals);
	}
}

function formatNumber(value: number, decimals = 0) {
	return Number(value).toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}

function formatPlayTime(seconds: number) {
	const totalMinutes = Math.floor(Number(seconds) / 60);
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;
	return `${days}d ${hours}h ${minutes}m`;
}

function formatRelativeTime(timestamp: string) {
	const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
	return `${Math.floor(minutes / 1440)}d`;
}
</script>

{#if !stats}
	<div class="py-16 text-center text-neutral-500 dark:text-neutral-400">Loading...</div>
{:else}
	<!-- ============ 资料卡 ============ -->
	<div class="card-base mb-6 flex flex-col gap-4 p-6">
		<div class="flex items-center gap-4">
			{#if stats.avatar_url}
				<img
					src={stats.avatar_url}
					alt="osu! avatar"
					class="h-16 w-16 rounded-md object-cover"
				/>
			{/if}
			<div>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">PLAYER</p>
				<h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.username}</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">
					{stats.country}{stats.country_code ? ` · ${stats.country_code}` : ""}
				</p>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">全球排名</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">GLOBAL RANK</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">#{formatNumber(stats.global_rank)}</div>
			</div>
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">国家排名</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">COUNTRY RANK</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">#{formatNumber(stats.country_rank)}</div>
			</div>
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">PP 值</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">PERFORMANCE</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{formatNumber(stats.pp, 2)} pp</div>
			</div>
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">游玩时间</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">PLAY TIME</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{formatPlayTime(stats.play_time)}</div>
			</div>
		</div>
	</div>

	<!-- ============ 历史图表 ============ -->
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

	<div class="mt-4 text-sm text-neutral-500 dark:text-neutral-400">
		{formatRelativeTime(stats.updated_at)} 前更新 · 历史数据每日更新
	</div>
{/if}