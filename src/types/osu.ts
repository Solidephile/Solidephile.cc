// osu! 页面数据类型（供 OsuPage / OsuPanel / OsuTabs 等共享）

/** /api/osu 返回的当前统计数据 */
export interface OsuStats {
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

/** osu_history 表的一条历史记录 */
export interface OsuHistoryItem {
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
	/** 由 play_time 换算出的小时数，仅供图表使用 */
	play_time_hours?: number;
}

/** /api/osu 的完整返回结构 */
export interface OsuData {
	stats: OsuStats;
	history: OsuHistoryItem[];
}
