// osu! 成绩接口：返回「置顶成绩」与「最好成绩」
//
// 数据来源：数据库（osu_current 的 best_scores / pinned_scores 两个 jsonb 列），
// 由每日 Cron 调用 /api/update_osu 时抓取并写入。
//
// 本接口只读数据库、不调用 osu! API，所以：
//   - 响应快，且不受 osu! 服务状态影响
//   - 前端可以在「最好成绩」tab 打开时才懒加载，不影响首屏

import { neon } from "@neondatabase/serverless";

const sql = neon(process.env.DATABASE_URL);

// jsonb 列由驱动解析后通常是数组；这里对字符串形式也做兼容
function toArray(value) {
    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    return [];
}

export default async function handler(req, res) {
    try {
        const result = await sql`
            SELECT
                best_scores,
                pinned_scores,
                updated_at
            FROM osu_current
            WHERE id = 1
            LIMIT 1
        `;

        if (result.length === 0) {
            return res.status(404).json({
                error: "osu_current 没有数据"
            });
        }

        const row = result[0];

        return res.status(200).json({
            pinned: toArray(row.pinned_scores),
            best: toArray(row.best_scores),
            updated_at: row.updated_at
        });

    } catch (error) {
        console.error("读取成绩失败:", error);

        return res.status(500).json({
            error: "读取成绩失败"
        });
    }
}
