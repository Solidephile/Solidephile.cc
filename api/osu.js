import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

export default async function handler(req, res) {
    try {
        const currentResult = await sql`
            SELECT
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
            FROM osu_current
            WHERE id = 1
            LIMIT 1
        `;

        const historyResult = await sql`
            SELECT
                updated_at AS timestamp,
                global_rank,
                country_rank,
                pp,
                play_count,
                play_time,
                total_score,
                total_hits,
                accuracy,
                maximum_combo,
                -- PPTTH：累计每 1 万次击打平均换来多少 pp
                -- NULLIF 让 total_hits 为 0 时返回 NULL 而不是除零报错
                ROUND(pp / NULLIF(total_hits, 0) * 10000, 2) AS pptth
            FROM osu_history
            ORDER BY updated_at ASC
        `;

        if (currentResult.length === 0) {
            return res.status(404).json({
                error: "osu_current 没有数据"
            });
        }

        return res.status(200).json({
            stats: currentResult[0],
            history: historyResult
        });

    } catch (error) {
        console.error("Database error:", error);

        return res.status(500).json({
            error: "读取数据库失败"
        });
    }
}