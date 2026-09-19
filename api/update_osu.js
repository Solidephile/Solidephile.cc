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
                updated_at
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
                ${currentData.updated_at}
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
                updated_at = EXCLUDED.updated_at
        `;


        // --------------------------------
        // 6. 判断今天 UTC+8 是否已经记录
        // --------------------------------

        const todayUTC8 =
            getUTC8Date(new Date());


        const existingToday =
            await sql`
                SELECT updated_at
                FROM osu_history
                WHERE updated_at >=
                    ${todayUTC8}::date
                    AT TIME ZONE 'Asia/Shanghai'
                AND updated_at <
                    (${todayUTC8}::date + INTERVAL '1 day')
                    AT TIME ZONE 'Asia/Shanghai'
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