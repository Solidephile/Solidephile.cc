<script lang="ts">
/**
 * osu 页面级容器：
 * - 统一从 /api/osu 取一次数据，向下传给「基本信息」与各个 tab，避免重复请求
 * - OsuPanel（基本信息）位于 tabs 之外，任何 tab 下都可见
 */
import { onMount } from "svelte";
import type { OsuData, OsuHistoryItem, OsuStats, OsuStatus } from "@/types/osu";

import OsuPanel from "./OsuPanel.svelte";
import OsuTabs from "./OsuTabs.svelte";

let stats = $state<OsuStats | null>(null);
let history = $state<OsuHistoryItem[]>([]);
let error = $state<string | null>(null);

// 实时在线状态（单独接口，与主数据互不影响）
let status = $state<OsuStatus | null>(null);
let statusError = $state(false);

// ---------- Mock 数据（仅本地开发回退：/api/osu 拿不到时方便先看 UI） ----------
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

const MOCK: OsuData = {
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
	},
	history: buildMockHistory(),
};

// 补一个 play_time_hours 字段供图表使用，并按时间正序排列
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

// 实时在线状态：与主数据并行请求，失败不影响主流程
async function loadStatus() {
	try {
		const res = await fetch(`/api/osu_status?t=${Date.now()}`);
		if (!res.ok) throw new Error(`API ${res.status}`);
		status = (await res.json()) as OsuStatus;
	} catch (e) {
		console.warn("osu 在线状态获取失败:", e);
		statusError = true;
	}
}

onMount(async () => {
	loadStatus();

	try {
		const res = await fetch(`/api/osu?t=${Date.now()}`);
		if (!res.ok) throw new Error(`API ${res.status}`);
		const data = (await res.json()) as OsuData;
		stats = data.stats;
		history = prepareHistory(data.history);
	} catch (e) {
		if (import.meta.env.DEV) {
			console.warn("osu API 不可用，使用 mock 数据:", e);
			stats = MOCK.stats;
			history = prepareHistory(MOCK.history);
		} else {
			error = "数据加载失败";
		}
	}
});
</script>

{#if error}
	<div class="card-base p-8 text-center text-neutral-500 dark:text-neutral-400">
		{error}
	</div>
{:else if !stats}
	<div class="py-16 text-center text-neutral-500 dark:text-neutral-400">Loading...</div>
{:else}
	<!-- 基本信息：不属于任何 tab，任何 tab 下都显示 -->
	<OsuPanel {stats} {status} {statusError} />

	<!-- 四个 tab 的内容区 -->
	<OsuTabs {history} />
{/if}
