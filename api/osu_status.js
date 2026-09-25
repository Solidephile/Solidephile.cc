// osu! 在线状态实时接口
//
// 数据源：osu! API v2 的 User 对象（is_online / last_visit）
// 为什么单独一个接口：/api/osu 读的是每天更新一次的数据库，而在线状态是秒级数据，
//   必须实时查询；且 Vercel Hobby 计划的 Cron 一天只能跑一次，无法靠定时任务保持新鲜。
//
// 三个状态（前端据此显示）：
//   is_online = true                    → 当前在线
//   is_online = false 且有 last_visit   → 最后活跃 X 前
//   last_visit = null                   → 用户隐藏了在线状态（隐身）
//
// 缓存：模块级内存缓存 60 秒，用来限制对 osu! API 的调用频率（同一实例热启动时复用）。
// 本接口无需鉴权：只暴露公开的用户在线状态，且不读写数据库。

const clientId = process.env.OSU_CLIENT_ID;
const clientSecret = process.env.OSU_CLIENT_SECRET;
const username = process.env.OSU_USERNAME;

const STATUS_TTL = 60 * 1000;

// 状态缓存
let statusCache = { data: null, at: 0 };

// Access Token 缓存（osu! 返回有效期约 24 小时）
let tokenCache = { token: null, expiresAt: 0 };

async function getAccessToken() {
    if (tokenCache.token && Date.now() < tokenCache.expiresAt) {
        return tokenCache.token;
    }

    const response = await fetch("https://osu.ppy.sh/oauth/token", {
        method: "POST",
        headers: {
            "Accept": "application/json",
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "client_credentials",
            scope: "public"
        })
    });

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `获取 Access Token 失败: ${response.status}\n${text}`
        );
    }

    const data = await response.json();

    tokenCache = {
        token: data.access_token,
        // 提前 5 分钟过期，避免边界情况
        expiresAt: Date.now() + Math.max(0, (data.expires_in || 3600) - 300) * 1000
    };

    return tokenCache.token;
}

async function fetchOsuStatus() {
    const token = await getAccessToken();

    const url =
        `https://osu.ppy.sh/api/v2/users/@${encodeURIComponent(username)}/osu`;

    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json"
        }
    });

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `获取用户状态失败: ${response.status}\n${text}`
        );
    }

    const user = await response.json();

    return {
        // 是否在线（在 lazer 或新版网站上）
        is_online: typeof user.is_online === "boolean" ? user.is_online : null,
        // 最后访问时间；为 null 表示用户隐藏了在线状态
        last_visit: user.last_visit || null,
        fetched_at: new Date().toISOString()
    };
}

export default async function handler(req, res) {
    res.setHeader("Cache-Control", "no-store");

    try {
        if (!clientId) {
            return res.status(500).json({ error: "OSU_CLIENT_ID 没有设置" });
        }

        if (!clientSecret) {
            return res.status(500).json({ error: "OSU_CLIENT_SECRET 没有设置" });
        }

        if (!username) {
            return res.status(500).json({ error: "OSU_USERNAME 没有设置" });
        }

        const now = Date.now();

        // 命中缓存，直接返回
        if (statusCache.data && now - statusCache.at < STATUS_TTL) {
            return res.status(200).json(statusCache.data);
        }

        const data = await fetchOsuStatus();
        statusCache = { data, at: now };

        return res.status(200).json(data);

    } catch (error) {
        console.error("获取 osu 在线状态失败:", error);

        // 请求失败但还有历史缓存时退回旧数据，避免前端直接显示「状态未知」
        if (statusCache.data) {
            return res.status(200).json({ ...statusCache.data, stale: true });
        }

        return res.status(500).json({ error: "获取在线状态失败" });
    }
}
