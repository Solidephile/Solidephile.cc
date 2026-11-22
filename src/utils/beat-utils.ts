/**
 * 节拍计算
 *
 * 先假定等间距：第 n 拍落在 `offset + n * (60 / bpm)` 秒（offset 是第一拍的位置）。
 * 绝大多数流行曲成立；遇到变速曲再把 beats 数组加进来，调用方只认这里的返回结构。
 */

export type BeatState = {
	/** 一拍多少秒 */
	spb: number;
	/** 当前是第几拍（从 0 开始；offset 之前会是负数） */
	beat: number;
	/** 在一拍里的位置：0 = 刚踩上，趋近 1 = 快到下一拍 */
	phase: number;
	/** 距离下一拍还有多少秒 */
	nextIn: number;
};

export function beatState(
	time: number,
	/** 缺省 = 这首歌没有节拍信息（网易云的曲目），直接不渲染节拍特效 */
	bpm: number | undefined,
	offset: number | undefined,
): BeatState | null {
	if (bpm === undefined || !Number.isFinite(bpm) || bpm <= 0) return null;

	const spb = 60 / bpm;
	const position = (time - (offset ?? 0)) / spb;
	const beat = Math.floor(position);
	const phase = position - beat;

	return { spb, beat, phase, nextIn: (1 - phase) * spb };
}
