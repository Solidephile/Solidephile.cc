/**
 * osu! 页面配置（仅前端展示相关）
 *
 * 后端抓取相关的配置在环境变量里（见 api/update_osu.js）：
 *   OSU_SCORES_LIMIT       每天抓取的最好成绩条数（默认 100，为 osu! API 单次上限）
 *   OSU_PINNED_SCORE_IDS   置顶成绩的 score id，逗号分隔，顺序即展示顺序
 */

export const osuConfig = {
	/** 「最好成绩」tab 初始显示多少条 */
	scoresInitialDisplay: 10,

	/** 每点一次「展示更多」追加多少条 */
	scoresLoadStep: 10,
};
