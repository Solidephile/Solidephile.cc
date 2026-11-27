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

/**
 * 当前这一拍的触发时刻（秒）。
 *
 * 节拍特效的「是否该闪」要按**触发时刻**判断，而不是按下帧时刻：时间戳放在拍子上时，
 * 开始那一刻正好踩在拍点、判定成立；结束那一拍的闪也能在区间之后按自己的衰减收完，
 * 不会被硬切掉。
 */
export function beatTriggerTime(state: BeatState, time: number): number {
	return time - state.phase * state.spb;
}

/**
 * 触发时刻是否落在特效区间内（闭区间）。
 *
 * `windows` 为空表示没有配置，全曲都显示特效（保持原来的行为）。
 * 反向区间（结束早于开始）按大小互换，单点区间也算命中。
 */
export function inEffectWindow(
	windows: readonly (readonly number[])[] | undefined,
	triggerTime: number,
): boolean {
	if (!windows || windows.length === 0) return true;

	for (const range of windows) {
		const from = range[0];
		const to = range[1];
		if (typeof from !== "number" || typeof to !== "number") continue;
		if (!Number.isFinite(from) || !Number.isFinite(to)) continue;

		const start = Math.min(from, to);
		const end = Math.max(from, to);
		if (triggerTime >= start && triggerTime <= end) return true;
	}

	return false;
}
