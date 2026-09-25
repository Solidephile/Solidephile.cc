// 服务端代理：向自建 Umami 取访问数据。前端永远拿不到 Umami 的凭据。
//
// 三个入口：
//   GET /api/umami                             → { pv, uv }       侧边栏"站点统计"用
//                                                  pv = 全部时间累计访问量
//                                                  uv = 近 30 天独立访客
//   GET /api/umami?view=dashboard              → 累计/今日汇总 + 各维度排名（排名固定近 30 天）
//   GET /api/umami?view=series&range=30d       → 只给趋势时序，range: 7d | 30d | 90d
//
// 为什么汇总与排名固定 30 天、趋势单独可切换：切范围时只需重取趋势，不必整页重新请求。
//
// 为什么侧栏的 UV 用 30 天：Umami 的"访客"是按会话哈希去重的，哈希里带了
// 「每月轮换一次的 salt」，跨月同一个人会被算成不同访客，所以累计 UV 会虚高。
// 30 天窗口与 salt 周期吻合，更接近真实人数。（PV 是纯累计，没有这个问题。）
//
// 需要的环境变量（配置在主站 Vercel 项目里）：
//   UMAMI_URL         自建 Umami 实例地址，例如 https://analytics.solidephile.cc
//   UMAMI_WEBSITE_ID  网站 ID
//   UMAMI_USERNAME    Umami 登录用户名
//   UMAMI_PASSWORD    Umami 登录密码（建议标记为 Sensitive）
//   UMAMI_TIMEZONE    可选，按天分组用的时区，默认 Asia/Shanghai

const UMAMI_URL = (process.env.UMAMI_URL || "").replace(/\/+$/, "");
const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || "";
const USERNAME = process.env.UMAMI_USERNAME || "";
const PASSWORD = process.env.UMAMI_PASSWORD || "";
const TIMEZONE = process.env.UMAMI_TIMEZONE || "Asia/Shanghai";

// 表示"全部时间"：用一个足够早的时间点即可（Umami 用毫秒时间戳）
const ALL_TIME_START = Date.UTC(2000, 0, 1);

// 侧栏独立访客的统计窗口（天）
const UV_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

// 看板「汇总 + 排名」的固定窗口
const DASHBOARD_DAYS = 30;

// 趋势可切换的时间范围
const RANGES = {
	"7d": { days: 7, label: "近 7 天" },
	"30d": { days: 30, label: "近 30 天" },
	"90d": { days: 90, label: "近 90 天" },
};
const DEFAULT_RANGE = "30d";

// 统一的 CDN 缓存策略：省 Umami 的 API 调用，数字也不会太旧
const CACHE_HEADER = "public, max-age=60, s-maxage=300, stale-while-revalidate=600";

// 登录 token 缓存在函数实例内存里，实例复用期间有效；过期或失效会自动重登
const TOKEN_TTL_MS = 30 * 60 * 1000;
let cachedToken = "";
let tokenExpiresAt = 0;

async function getToken() {
	if (cachedToken && Date.now() < tokenExpiresAt) {
		return cachedToken;
	}

	const res = await fetch(`${UMAMI_URL}/api/auth/login`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ username: USERNAME, password: PASSWORD }),
	});

	if (!res.ok) {
		throw new Error(`Umami 登录失败: ${res.status} ${await res.text()}`);
	}

	const data = await res.json();

	if (!data || !data.token) {
		throw new Error("Umami 登录响应里没有 token");
	}

	cachedToken = data.token;
	tokenExpiresAt = Date.now() + TOKEN_TTL_MS;

	return cachedToken;
}

/** 带失效重试的 GET：token 过期时清缓存重登一次 */
async function umamiGetJson(path) {
	const request = async () =>
		fetch(`${UMAMI_URL}${path}`, {
			headers: { Authorization: `Bearer ${await getToken()}` },
		});

	let upstream = await request();

	if (upstream.status === 401) {
		cachedToken = "";
		tokenExpiresAt = 0;
		upstream = await request();
	}

	if (!upstream.ok) {
		throw new Error(
			`Umami 请求失败 ${path}: ${upstream.status} ${await upstream.text()}`,
		);
	}

	return upstream.json();
}

const statsPath = (startAt, endAt) =>
	`/api/websites/${WEBSITE_ID}/stats?startAt=${startAt}&endAt=${endAt}`;

const seriesPath = (startAt, endAt) =>
	`/api/websites/${WEBSITE_ID}/pageviews?startAt=${startAt}&endAt=${endAt}` +
	`&unit=day&timezone=${encodeURIComponent(TIMEZONE)}`;

const metricsPath = (type, limit, startAt, endAt) =>
	`/api/websites/${WEBSITE_ID}/metrics?type=${type}&limit=${limit}` +
	`&startAt=${startAt}&endAt=${endAt}&timezone=${encodeURIComponent(TIMEZONE)}`;

/** 把 Umami 的 { x, y } 行规整成 { name, value }；空值给个兜底显示名 */
function toRows(result, emptyLabel) {
	if (!Array.isArray(result)) return [];

	return result
		.map((row) => {
			const rawName = row && row.x !== undefined && row.x !== null ? row.x : "";
			const name = String(rawName).trim() || emptyLabel;
			const value = Number(row && row.y !== undefined ? row.y : 0);
			return { name, value: Number.isFinite(value) ? value : 0 };
		})
		.filter((row) => row.value > 0);
}

/** 时间轴标签：兼容 "2026-02-01" / ISO 字符串 / 毫秒时间戳 */
function toDayLabel(value) {
	if (typeof value === "number") {
		const d = new Date(value);
		return `${d.getMonth() + 1}/${d.getDate()}`;
	}

	const text = String(value ?? "");
	const matched = text.match(/^(\d{4})-(\d{2})-(\d{2})/);

	if (matched) {
		return `${Number(matched[2])}/${Number(matched[3])}`;
	}

	return text;
}

/** 把 pageviews 接口的返回规整成 { labels, pageviews, sessions } */
function toSeries(result) {
	const pageviewPoints = Array.isArray(result?.pageviews)
		? result.pageviews
		: [];
	const sessionPoints = Array.isArray(result?.sessions) ? result.sessions : [];

	return {
		labels: pageviewPoints.map((point) => toDayLabel(point?.x)),
		pageviews: pageviewPoints.map((point) => Number(point?.y ?? 0)),
		sessions: sessionPoints.map((point) => Number(point?.y ?? 0)),
	};
}

/** 侧栏入口：{ pv, uv } */
async function handleSummary(res) {
	const endAt = Date.now();
	const uvStartAt = endAt - UV_RANGE_DAYS * DAY_MS;

	const [allTime, recent] = await Promise.all([
		umamiGetJson(statsPath(ALL_TIME_START, endAt)),
		umamiGetJson(statsPath(uvStartAt, endAt)),
	]);

	res.setHeader("Cache-Control", CACHE_HEADER);

	return res.status(200).json({
		pv: Number(allTime?.pageviews ?? 0),
		uv: Number(recent?.visitors ?? 0),
	});
}

/**
 * 取指定时区"今天 00:00"对应的 UTC 毫秒时间戳。
 * 做法：先取该时区下的当前时刻算出时区偏移，再把"当地日期 00:00"换算回 UTC。
 * （Asia/Shanghai 无夏令时；有夏令时的时区也能正确取到当前这一天的起点。）
 */
function startOfToday(timeZone) {
	const now = new Date();

	const dateText = new Intl.DateTimeFormat("en-CA", {
		timeZone,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
	}).format(now);

	const parts = new Intl.DateTimeFormat("en-US", {
		timeZone,
		hour12: false,
		year: "numeric",
		month: "2-digit",
		day: "2-digit",
		hour: "2-digit",
		minute: "2-digit",
		second: "2-digit",
	}).formatToParts(now);

	const pick = (type) =>
		Number(parts.find((part) => part.type === type)?.value ?? 0);

	const asUTC = Date.UTC(
		pick("year"),
		pick("month") - 1,
		pick("day"),
		pick("hour") % 24,
		pick("minute"),
		pick("second"),
	);
	const offsetMs = asUTC - now.getTime();

	return Date.parse(`${dateText}T00:00:00Z`) - offsetMs;
}

/** 看板入口：汇总（累计 + 今日）+ 各维度排名（固定 30 天） */
async function handleDashboard(res) {
	const endAt = Date.now();
	const startAt = endAt - DASHBOARD_DAYS * DAY_MS;
	const todayStartAt = startOfToday(TIMEZONE);

	// 每项独立 catch：某个维度失败时其余照常显示，不整页报错
	const safe = (promise) => promise.catch(() => null);

	const [allTime, today, topPages, channels, countries, browsers, devices] =
		await Promise.all([
			umamiGetJson(statsPath(ALL_TIME_START, endAt)),
			safe(umamiGetJson(statsPath(todayStartAt, endAt))),
			safe(umamiGetJson(metricsPath("path", 10, startAt, endAt))),
			safe(umamiGetJson(metricsPath("channel", 10, startAt, endAt))),
			safe(umamiGetJson(metricsPath("country", 10, startAt, endAt))),
			safe(umamiGetJson(metricsPath("browser", 8, startAt, endAt))),
			safe(umamiGetJson(metricsPath("device", 8, startAt, endAt))),
		]);

	if (!allTime) {
		throw new Error("Umami 汇总数据获取失败");
	}

	res.setHeader("Cache-Control", CACHE_HEADER);

	return res.status(200).json({
		days: DASHBOARD_DAYS,
		rangeLabel: RANGES[DEFAULT_RANGE].label,
		// 数据生成时间（受 CDN 缓存影响，反映的是真正取数的时刻）
		updatedAt: endAt,
		stats: {
			totalViews: Number(allTime?.pageviews ?? 0),
			totalVisitors: Number(allTime?.visitors ?? 0),
			todayViews: Number(today?.pageviews ?? 0),
			todayVisitors: Number(today?.visitors ?? 0),
		},
		topPages: toRows(topPages, "首页 / 未知"),
		channels: toRows(channels, "直接访问"),
		countries: toRows(countries, "未知地区"),
		browsers: toRows(browsers, "未知浏览器"),
		devices: toRows(devices, "未知设备"),
	});
}

/** 趋势入口：只返回时序数据，range 可切换 */
async function handleSeries(query, res) {
	const requested = String(query?.range || DEFAULT_RANGE);
	const rangeKey = Object.prototype.hasOwnProperty.call(RANGES, requested)
		? requested
		: DEFAULT_RANGE;
	const { days, label } = RANGES[rangeKey];

	const endAt = Date.now();
	const startAt = endAt - days * DAY_MS;

	const result = await umamiGetJson(seriesPath(startAt, endAt));

	res.setHeader("Cache-Control", CACHE_HEADER);

	return res.status(200).json({
		range: rangeKey,
		rangeLabel: label,
		series: toSeries(result),
	});
}

export default async function handler(req, res) {
	if (req.method !== "GET") {
		res.setHeader("Allow", "GET");
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	if (!UMAMI_URL || !WEBSITE_ID || !USERNAME || !PASSWORD) {
		return res.status(500).json({ error: "Umami 环境变量未配置完整" });
	}

	try {
		// 先把 token 准备好，避免并发请求各自登录一次
		await getToken();

		const view = String(req.query?.view || "summary");

		if (view === "dashboard") {
			return await handleDashboard(res);
		}

		if (view === "series") {
			return await handleSeries(req.query, res);
		}

		return await handleSummary(res);
	} catch (error) {
		console.error("Umami 代理失败:", error);
		return res.status(502).json({ error: "读取 Umami 统计失败" });
	}
}
