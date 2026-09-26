/**
 * osu 页面数据加载（供页面里各个 island 共用）
 *
 * 重构后 tab 面板由 Astro 渲染，取数分散到各个 island（基本信息 / 历史曲线 /
 * 最好成绩），所以把「取一次、大家共用」的逻辑抽到这里：
 *
 * - loadOsuData() 用模块级 Promise 缓存：同一个页面里不管几个组件调用，
 *   都只发一次 /api/osu 请求；失败时把缓存清掉，下次调用会重试。
 * - 本地开发下 /api/osu 不可用时回退到 mock 数据，方便没有后端时调 UI。
 * - Swup 切页后清缓存，重新进入 osu 页面会重新取数。
 */
import type { OsuData, OsuHistoryItem, OsuStats, OsuStatus } from "@/types/osu";

// ---------- Mock 数据（仅本地开发回退） ----------

function buildMockHistory(): OsuHistoryItem[] {
	const items: OsuHistoryItem[] = [];
	const days = 10;
	for (let i = days - 1; i >= 0; i--) {
		const d = new Date();
		d.setDate(d.getDate() - i);
		d.setUTCHours(10, 0, 0, 0);
		const k = days - i; // 1..10
		const totalHits = 4800000 + k * 120000;
		const pp = 5000 + k * 68;
		items.push({
			timestamp: d.toISOString(),
			global_rank: 16000 - k * 365,
			country_rank: 1300 - k * 41,
			pp,
			play_count: 2900 + k * 60,
			play_time: 1050000 + k * 18000,
			total_score: 7500000000 + k * 200000000,
			total_hits: totalHits,
			accuracy: 97.2 + k * 0.08,
			maximum_combo: 1100 + k * 35,
			// 和后端同一条公式，保证 mock 的曲线形状与真实数据一致
			pptth: Number(((pp / totalHits) * 10000).toFixed(2)),
		});
	}
	return items;
}

const MOCK_STATS: OsuStats = {
	username: "Solidephile",
	avatar_url: "",
	country: "China",
	country_code: "CN",
	global_rank: 12345,
	country_rank: 888,
	pp: 5678.9,
	play_time: 1234567,
	updated_at: new Date().toISOString(),
};

/** 补一个 play_time_hours 字段供图表使用，并按时间正序排列 */
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

// ---------- 主数据 ----------

let pending: Promise<OsuData> | null = null;

/** 取 /api/osu（stats + history）。同一个页面内多次调用只会发一次请求。 */
export function loadOsuData(): Promise<OsuData> {
	if (!pending) {
		pending = fetch("/api/osu")
			.then((res) => {
				if (!res.ok) throw new Error(`API ${res.status}`);
				return res.json() as Promise<OsuData>;
			})
			.then((data) => ({ ...data, history: prepareHistory(data.history) }))
			.catch((error) => {
				// 失败不缓存，下次调用可以重试
				pending = null;

				if (import.meta.env.DEV) {
					console.warn("osu API 不可用，使用 mock 数据:", error);
					return {
						stats: MOCK_STATS,
						history: prepareHistory(buildMockHistory()),
					};
				}

				throw error;
			});
	}

	return pending;
}

// ---------- 实时在线状态 ----------

/**
 * 取 /api/osu_status。失败返回 null（调用方自行展示「未知」），
 * 所以这里不缓存：实时状态每次进页面都该重新问一次。
 */
export async function loadOsuStatus(): Promise<OsuStatus | null> {
	try {
		const res = await fetch(`/api/osu_status?t=${Date.now()}`);
		if (!res.ok) throw new Error(`API ${res.status}`);
		return (await res.json()) as OsuStatus;
	} catch (error) {
		console.warn("osu 在线状态获取失败:", error);
		return null;
	}
}

// Swup 切页后清掉缓存。模块只加载一次，这里用 once 标记避免重复注册。
if (typeof document !== "undefined") {
	document.addEventListener("swup:content:replace", () => {
		pending = null;
	});
}
