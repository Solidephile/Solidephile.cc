// 服务端代理：向自建 Umami 取全站访问数据，供侧边栏"站点统计"使用。
// 前端永远拿不到 Umami 的凭据，只拿到两个数字。
//
//   pv = 全部时间累计访问量
//   uv = 近 30 天独立访客
//
// 为什么 UV 用 30 天：Umami 的"访客"是按会话哈希去重的，哈希里带了
// 「每月轮换一次的 salt」，跨月同一个人会被算成不同访客，所以累计 UV 会虚高。
// 30 天窗口与 salt 周期吻合，更接近真实人数。（PV 是纯累计，没有这个问题。）
//
// 需要的环境变量（配置在主站 Vercel 项目里）：
//   UMAMI_URL         自建 Umami 实例地址，例如 https://analytics.solidephile.cc
//   UMAMI_WEBSITE_ID  网站 ID
//   UMAMI_USERNAME    Umami 登录用户名
//   UMAMI_PASSWORD    Umami 登录密码（建议标记为 Sensitive）

const UMAMI_URL = (process.env.UMAMI_URL || "").replace(/\/+$/, "");
const WEBSITE_ID = process.env.UMAMI_WEBSITE_ID || "";
const USERNAME = process.env.UMAMI_USERNAME || "";
const PASSWORD = process.env.UMAMI_PASSWORD || "";

// 表示"全部时间"：用一个足够早的时间点即可（Umami 用毫秒时间戳）
const ALL_TIME_START = Date.UTC(2000, 0, 1);

// 独立访客的统计窗口（天）——想跟 PV 一样用全部时间，把这里改大即可
const UV_RANGE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

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

function requestStats(token, startAt, endAt) {
	const url =
		`${UMAMI_URL}/api/websites/${WEBSITE_ID}/stats` +
		`?startAt=${startAt}&endAt=${endAt}`;

	return fetch(url, { headers: { Authorization: `Bearer ${token}` } });
}

async function fetchStats(startAt, endAt) {
	const request = async () => requestStats(await getToken(), startAt, endAt);

	let upstream = await request();

	// token 过期 / 失效：清掉缓存重登一次
	if (upstream.status === 401) {
		cachedToken = "";
		tokenExpiresAt = 0;
		upstream = await request();
	}

	if (!upstream.ok) {
		throw new Error(
			`Umami stats 请求失败: ${upstream.status} ${await upstream.text()}`,
		);
	}

	return upstream.json();
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

		const endAt = Date.now();
		const uvStartAt = endAt - UV_RANGE_DAYS * DAY_MS;

		const [allTime, recent] = await Promise.all([
			fetchStats(ALL_TIME_START, endAt),
			fetchStats(uvStartAt, endAt),
		]);

		// 缓存 5 分钟：既省 Umami 的 API 调用，数字也不会太旧
		res.setHeader(
			"Cache-Control",
			"public, max-age=60, s-maxage=300, stale-while-revalidate=600",
		);

		return res.status(200).json({
			pv: Number(allTime?.pageviews ?? 0),
			uv: Number(recent?.visitors ?? 0),
		});
	} catch (error) {
		console.error("Umami 代理失败:", error);
		return res.status(502).json({ error: "读取 Umami 统计失败" });
	}
}
