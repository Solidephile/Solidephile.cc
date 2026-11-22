/**
 * 共享的音频图谱（只为频谱分析）
 *
 * 三个必须小心的地方：
 *  1. `createMediaElementSource()` 对同一个 `<audio>` 只能调用一次，第二次会抛
 *     `InvalidStateError`；
 *  2. 媒体元素一旦接进 AudioContext，声音就只从图谱出口出——context 处于 suspended
 *     时是**静音**的，所以每次都要 `resume()`；
 *  3. `<audio>` 必须带 `crossorigin="anonymous"` 才能拿到未污染的数据流，而 CORS
 *     没放行时元素会直接 `error`（不是静音）。播放器的兜底会调用
 *     `markAnalyserUnavailable()`，之后这里不再尝试建图。
 *
 * 节拍器（TimingDebug）用自己独立的 AudioContext：它只在 `?debug=1` 下存在。
 */

let context: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
/** 已经接过图谱的元素：换元素要新建 source，但复用 context / analyser */
let attached: HTMLAudioElement | null = null;
let unavailable = false;

/** 是否已经确定「这台设备 / 这个来源用不了频谱」 */
export function isAnalyserUnavailable(): boolean {
	return unavailable;
}

/** 标记为不可用：后续不再尝试建图（由播放器的 error 兜底触发） */
export function markAnalyserUnavailable(): void {
	unavailable = true;
}

/**
 * 这个 context 自己的输出延迟（秒）。
 * 设备没真正输出过声音时它可能偏小，所以采样要连续做几次再定。
 */
export function contextLatency(ctx: AudioContext): number {
	return (ctx.baseLatency ?? 0) + (ctx.outputLatency ?? 0);
}

export function getAnalyser(): AnalyserNode | null {
	return analyser;
}

/**
 * 在用户手势里提前把图谱跑起来（播放之前调用）。
 *
 * 为什么要等 context 真的 running：中途才把元素接进图谱、或者 context 还没开始
 * 渲染就开播，媒体渲染器会重连一次，这一次播放就会和时钟错开（节拍器/格子偏早），
 * 暂停再播才恢复。所以宁可等这一次 resume，也不要在播放中改路由。
 */
export async function prepareAnalyser(
	element: HTMLAudioElement,
): Promise<void> {
	ensureAnalyser(element);
	await context?.resume().catch(() => undefined);
}

/**
 * 把 `<audio>` 接进图谱（幂等），返回 analyser。
 * 必须在用户手势之后调用，否则 context 建出来是 suspended 的。
 * fftSize 等分析窗口参数由调用方设置（频谱组件读自己的配置）。
 */
export function ensureAnalyser(element: HTMLAudioElement): AnalyserNode | null {
	if (unavailable) return null;

	try {
		context ??= new AudioContext();

		if (attached !== element) {
			analyser ??= context.createAnalyser();

			const source = context.createMediaElementSource(element);
			source.connect(analyser);
			analyser.connect(context.destination);
			attached = element;
		}

		void context.resume();
		return analyser;
	} catch (error) {
		console.warn("[music] 频谱初始化失败，已退回普通播放:", error);
		unavailable = true;
		return null;
	}
}
