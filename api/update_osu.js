import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

const clientId = process.env.OSU_CLIENT_ID;
const clientSecret = process.env.OSU_CLIENT_SECRET;
const username = process.env.OSU_USERNAME;

async function getAccessToken() {
    const response = await fetch(
        "https://osu.ppy.sh/oauth/token",
        {
            method: "POST",
            headers: {
                "Accept": "application/json",
                "Content-Type":
                    "application/x-www-form-urlencoded"
            },
            body: new URLSearchParams({
                client_id: clientId,
                client_secret: clientSecret,
                grant_type: "client_credentials",
                scope: "public"
            })
        }
    );

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `获取 Access Token 失败: ${response.status}\n${text}`
        );
    }

    const data = await response.json();

    return data.access_token;
}


async function getUser(token) {
    const url =
        `https://osu.ppy.sh/api/v2/users/@${encodeURIComponent(username)}/osu`;

    const response = await fetch(
        url,
        {
            headers: {
                "Authorization":
                    `Bearer ${token}`,

                "Accept":
                    "application/json"
            }
        }
    );

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `获取用户数据失败: ${response.status}\n${text}`
        );
    }

    return await response.json();
}


// --------------------------------
// 成绩（最好成绩 / 置顶成绩）
// --------------------------------

// mods 在新旧响应里可能是 ["HD"] 或 [{ acronym: "HD" }]，统一成缩写数组
function normalizeMods(mods) {
    if (!Array.isArray(mods)) return [];

    return mods
        .map((mod) =>
            typeof mod === "string" ? mod : mod && mod.acronym
        )
        .filter(
            (mod) =>
                typeof mod === "string" && mod.length > 0
        );
}

// 只保留前端要显示的字段：原样转发一条约 3~4KB，裁剪后约 200 字节
// （100 条：300KB+ → 20KB 左右）
function trimScore(score) {
    if (!score) return null;

    const beatmap = score.beatmap || {};
    const beatmapset = score.beatmapset || {};
    const covers = beatmapset.covers || {};

    return {
        id: score.id ?? null,
        pp: score.pp ?? 0,
        rank: score.rank ?? null,
        accuracy: score.accuracy ?? 0,
        mods: normalizeMods(score.mods),
        title: beatmapset.title_unicode || beatmapset.title || "",
        artist: beatmapset.artist_unicode || beatmapset.artist || "",
        version: beatmap.version ?? "",
        stars: beatmap.difficulty_rating ?? 0,
        cover:
            covers.cover ||
            covers["cover@2x"] ||
            covers.card ||
            "",
        // weight 只在最好成绩里有（置顶成绩没有）
        weight: score.weight ? score.weight.percentage ?? null : null
    };
}

async function osuFetch(token, url) {
    const response = await fetch(url, {
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json"
        }
    });

    return response;
}

// 最好成绩（按 pp 排序）。官方文档里 limit 上限为 100
//
// 这个端点有两个踩过的坑：
//   1. mode 是「查询参数」而不是路径段
//      —— 写成 /users/@x/osu/scores/best 会 404 {"error":"Invalid url or incorrect request method."}
//   2. 它要求用「数字用户 ID」
//      —— 写成 @用户名 会 404 {"error":null}（只有 /users/{user} 那个端点接受 @用户名）
async function fetchBestScores(token, userId, limit) {
    const userKey = userId ?? `@${encodeURIComponent(username)}`;

    const url =
        `https://osu.ppy.sh/api/v2/users/${userKey}/scores/best` +
        `?mode=osu&limit=${limit}&offset=0`;

    const response = await osuFetch(token, url);

    if (!response.ok) {
        const text = await response.text();

        throw new Error(
            `获取最好成绩失败: ${response.status}\nURL: ${url}\n${text}`
        );
    }

    const scores = await response.json();

    return Array.isArray(scores)
        ? scores.map(trimScore).filter(Boolean)
        : [];
}

// 按 score id 取单个成绩。
// score id 有两种格式：新版全局 id（/scores/{id}）与旧版按模式 id（/scores/osu/{id}），
// 先试新版，404 再回退旧版，这样配置里直接填网址中的数字即可。
async function fetchScoreById(token, scoreId) {
    let response = await osuFetch(
        token,
        `https://osu.ppy.sh/api/v2/scores/${scoreId}`
    );

    if (response.status === 404) {
        response = await osuFetch(
            token,
            `https://osu.ppy.sh/api/v2/scores/osu/${scoreId}`
        );
    }

    if (!response.ok) {
        const text = await response.text();

        throw new Error(`${response.status}\n${text}`);
    }

    const score = await response.json();

    // Get Score 返回的结构不一定自带 beatmapset，
    // 缺了就补一次 /beatmaps/{id}（在定时任务里跑，不影响访客）
    const beatmapId =
        score && score.beatmap
            ? typeof score.beatmap === "object"
                ? score.beatmap.id
                : score.beatmap
            : null;

    if (beatmapId && !score.beatmapset) {
        try {
            const beatmapResponse = await osuFetch(
                token,
                `https://osu.ppy.sh/api/v2/beatmaps/${beatmapId}`
            );

            if (beatmapResponse.ok) {
                const beatmap = await beatmapResponse.json();
                score.beatmap = beatmap;
                score.beatmapset = beatmap.beatmapset;
            }
        } catch (error) {
            console.error(
                `补齐谱面信息失败 (${scoreId}):`,
                error.message
            );
        }
    }

    return score;
}

// 置顶成绩：按 OSU_PINNED_SCORE_IDS 里的顺序逐个拉取
async function fetchPinnedScores(token) {
    const raw = process.env.OSU_PINNED_SCORE_IDS || "";

    const ids = raw
        .split(",")
        .map((id) => id.trim())
        .filter((id) => /^\d+$/.test(id));

    if (ids.length === 0) return [];

    const results = [];

    for (const id of ids) {
        try {
            const trimmed = trimScore(
                await fetchScoreById(token, id)
            );

            if (trimmed) results.push(trimmed);
        } catch (error) {
            // 单个置顶成绩失败不影响其它
            console.error(
                `获取置顶成绩 ${id} 失败:`,
                error.message
            );
        }
    }

    return results;
}


// 获取 UTC+8 日期
function getUTC8Date(date) {
    return new Intl.DateTimeFormat(
        "en-CA",
        {
            timeZone: "Asia/Shanghai",
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }
    ).format(date);
}


export default async function handler(req, res) {

    try {
		
		// --------------------------------
        // 0. 验证 Cron Secret
        // --------------------------------

        const authHeader =
            req.headers.authorization;

        const expectedAuth =
            `Bearer ${process.env.CRON_SECRET}`;

        if (
            !process.env.CRON_SECRET ||
            authHeader !== expectedAuth
        ) {
            return res.status(401).json({
                success: false,
                error: "Unauthorized"
            });
        }
		

        // --------------------------------
        // 1. 检查环境变量
        // --------------------------------

        if (!clientId) {
            return res.status(500).json({
                error: "OSU_CLIENT_ID 没有设置"
            });
        }

        if (!clientSecret) {
            return res.status(500).json({
                error: "OSU_CLIENT_SECRET 没有设置"
            });
        }

        if (!username) {
            return res.status(500).json({
                error: "OSU_USERNAME 没有设置"
            });
        }

        if (!process.env.DATABASE_URL) {
            return res.status(500).json({
                error: "DATABASE_URL 没有设置"
            });
        }


        // --------------------------------
        // 2. 获取 osu Access Token
        // --------------------------------

        console.log("正在获取 osu! Access Token...");

        const token =
            await getAccessToken();


        // --------------------------------
        // 3. 获取 osu 用户数据
        // --------------------------------

        console.log(
            `正在获取 ${username} 的 osu! 数据...`
        );

        const user =
            await getUser(token);

        const statistics =
            user.statistics;


        const updatedAt =
            new Date().toISOString();


        // --------------------------------
        // 4. 整理当前数据
        // --------------------------------

        const currentData = {

            username:
                user.username,

            avatar_url:
                user.avatar_url,

            country:
                user.country?.name || "Unknown",

            country_code:
                user.country_code || null,

            global_rank:
                statistics.global_rank,

            country_rank:
                statistics.country_rank,

            pp:
                statistics.pp,

            play_count:
                statistics.play_count,

            play_time:
                statistics.play_time,

            total_score:
                statistics.total_score,

            total_hits:
                statistics.total_hits,

            accuracy:
                statistics.hit_accuracy,

            maximum_combo:
                statistics.maximum_combo,

            updated_at:
                updatedAt
        };


        // --------------------------------
        // 4.5 抓取最好成绩 / 置顶成绩
        // --------------------------------

        const scoresLimit = Math.min(
            Math.max(
                parseInt(process.env.OSU_SCORES_LIMIT || "100", 10) || 100,
                1
            ),
            100
        );

        let bestScores = null;
        let pinnedScores = null;

        try {
            console.log(`正在获取前 ${scoresLimit} 条最好成绩...`);

            // 用 getUser() 已经拿到的数字 ID，这个端点不接受 @用户名
            bestScores = await fetchBestScores(token, user?.id, scoresLimit);

            console.log(`最好成绩：${bestScores.length} 条`);
        } catch (error) {
            console.error(
                "获取最好成绩失败（保留库中旧数据）:",
                error
            );
        }

        try {
            pinnedScores = await fetchPinnedScores(token);

            console.log(`置顶成绩：${pinnedScores.length} 条`);
        } catch (error) {
            console.error(
                "获取置顶成绩失败（保留库中旧数据）:",
                error.message
            );
        }


        // --------------------------------
        // 5. 更新 osu_current
        // --------------------------------

        await sql`
            INSERT INTO osu_current (
                id,
                username,
                avatar_url,
                country,
                country_code,
                global_rank,
                country_rank,
                pp,
                play_count,
                play_time,
                total_score,
                total_hits,
                accuracy,
                maximum_combo,
                updated_at,
                best_scores,
                pinned_scores
            )
            VALUES (
                1,
                ${currentData.username},
                ${currentData.avatar_url},
                ${currentData.country},
                ${currentData.country_code},
                ${currentData.global_rank},
                ${currentData.country_rank},
                ${currentData.pp},
                ${currentData.play_count},
                ${currentData.play_time},
                ${currentData.total_score},
                ${currentData.total_hits},
                ${currentData.accuracy},
                ${currentData.maximum_combo},
                ${currentData.updated_at},
                ${bestScores ? JSON.stringify(bestScores) : null}::jsonb,
                ${pinnedScores ? JSON.stringify(pinnedScores) : null}::jsonb
            )
            ON CONFLICT (id)
            DO UPDATE SET
                username = EXCLUDED.username,
                avatar_url = EXCLUDED.avatar_url,
                country = EXCLUDED.country,
                country_code = EXCLUDED.country_code,
                global_rank = EXCLUDED.global_rank,
                country_rank = EXCLUDED.country_rank,
                pp = EXCLUDED.pp,
                play_count = EXCLUDED.play_count,
                play_time = EXCLUDED.play_time,
                total_score = EXCLUDED.total_score,
                total_hits = EXCLUDED.total_hits,
                accuracy = EXCLUDED.accuracy,
                maximum_combo = EXCLUDED.maximum_combo,
                updated_at = EXCLUDED.updated_at,
                best_scores = COALESCE(EXCLUDED.best_scores, osu_current.best_scores),
                pinned_scores = COALESCE(EXCLUDED.pinned_scores, osu_current.pinned_scores)
        `;


        // --------------------------------
        // 6. 判断今天 UTC+8 是否已经记录
        // --------------------------------

        const todayUTC8 =
            getUTC8Date(new Date());


        // 先把 updated_at 统一成 timestamptz、再换算到 UTC+8 的日期来比较。
        // 原因：AT TIME ZONE 在 timestamp 与 timestamptz 两种列类型下语义相反——
        //   timestamp  AT TIME ZONE 'Asia/Shanghai' → 把「裸时间」当成上海时间
        //   timestamptz AT TIME ZONE 'Asia/Shanghai' → 换算成上海「墙上时间」
        // 原来的写法在列类型不匹配时会算错区间，导致同一个 UTC+8 自然日重复写入。
        // 这里统一先 (::text)::timestamptz（裸时间按 UTC 解释，因为写入用的是 toISOString），
        // 结果在两种列类型下都正确。
        const existingToday =
            await sql`
                SELECT updated_at
                FROM osu_history
                WHERE (
                    (updated_at::text)::timestamptz
                    AT TIME ZONE 'Asia/Shanghai'
                )::date = ${todayUTC8}::date
                LIMIT 1
            `;


        let historyUpdated = false;


        // --------------------------------
        // 7. 写入历史数据
        // --------------------------------

        if (existingToday.length > 0) {

            console.log(
                `UTC+8 今天（${todayUTC8}）已经记录过历史数据，跳过。`
            );

        } else {

            await sql`
                INSERT INTO osu_history (
                    updated_at,
                    global_rank,
                    country_rank,
                    pp,
                    play_count,
                    play_time,
                    total_score,
                    total_hits,
                    accuracy,
                    maximum_combo
                )
                VALUES (
                    ${currentData.updated_at},
                    ${currentData.global_rank},
                    ${currentData.country_rank},
                    ${currentData.pp},
                    ${currentData.play_count},
                    ${currentData.play_time},
                    ${currentData.total_score},
                    ${currentData.total_hits},
                    ${currentData.accuracy},
                    ${currentData.maximum_combo}
                )
            `;

            historyUpdated = true;

            console.log(
                `已添加 ${todayUTC8} 的历史数据。`
            );
        }


        // --------------------------------
        // 8. 返回结果
        // --------------------------------

        return res.status(200).json({

            success: true,

            message:
                "osu! 数据更新成功",

            historyUpdated,

            scores: {
                best: bestScores ? bestScores.length : null,
                pinned: pinnedScores ? pinnedScores.length : null
            },

            stats: currentData

        });

    } catch (error) {

        console.error(
            "osu 数据更新失败:",
            error
        );

        return res.status(500).json({

            success: false,

            error:
                error.message || "未知错误"

        });
    }
}