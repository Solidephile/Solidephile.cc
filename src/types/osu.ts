// osu! 页面数据类型（供 osu 页面各个 island 共享）

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
	/**
	 * PPTTH：累计每 1 万次击打平均换来多少 pp（在后端 SQL 里算好）
	 * pp 减总击打为 0 时后端会返回 null，取用时需要过滤
	 */
	pptth: number;
}

/** /api/osu 的完整返回结构 */
export interface OsuData {
	stats: OsuStats;
	history: OsuHistoryItem[];
}

/** /api/osu_status 返回的实时在线状态 */
export interface OsuStatus {
	/** 是否在线；拿不到时为 null */
	is_online: boolean | null;
	/** 最后访问时间；null 表示用户隐藏了在线状态（隐身） */
	last_visit: string | null;
	/** 状态获取时间（ISO 字符串） */
	fetched_at: string;
	/** true 表示本次返回的是失败时回退的旧缓存 */
	stale?: boolean;
}

/** 成绩评级（osu! 的 rank 字段） */
export type OsuScoreRank =
	| "XH" // 银 SS
	| "X" // SS
	| "SH" // 银 S
	| "S"
	| "A"
	| "B"
	| "C"
	| "D"
	| "F";

/** 单条成绩（后端已裁剪，只含展示所需字段） */
export interface OsuScore {
	id: number | null;
	pp: number;
	rank: OsuScoreRank | null;
	/** 准确率，0–1 */
	accuracy: number;
	/** mod 缩写，如 ["HD", "DT"] */
	mods: string[];
	/** 谱面名（优先原名 title_unicode，无则罗马音 title） */
	title: string;
	/** 艺术家（优先原名 artist_unicode，无则罗马音 artist） */
	artist: string;
	/** 难度名（beatmap.version） */
	version: string;
	/** 难度星级 */
	stars: number;
	/** 铺面封面图地址 */
	cover: string;
}

/** /api/osu_scores 的返回结构 */
export interface OsuScoresData {
	/** 手动置顶的成绩，顺序即配置顺序 */
	pinned: OsuScore[];
	/** 按 pp 排序的最好成绩 */
	best: OsuScore[];
	/** 数据更新时间（ISO 字符串） */
	updated_at: string;
}
