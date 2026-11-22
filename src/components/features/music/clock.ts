/**
 * 播放时钟
 *
 * `audio.currentTime` 只在少数时机刷新，逐帧读会得到台阶，节拍特效一抖就露馅。
 * 这里记住「某个 currentTime 对应哪个墙钟时刻」，播放中用 performance.now() 外推；
 * 外推值与元素报告的值差太多就重新对齐，播放/暂停/跳转/变速由事件强制对齐。
 *
 * 刻意不补偿输出延迟（baseLatency / outputLatency）：offset 是用户在音频时间轴上
 * 量的，补不补都能被它吸收。
 */

/** 允许的最大漂移（秒）：超过就重新对齐 */
const DRIFT_TOLERANCE = 0.15;

const SYNC_EVENTS = [
	"play",
	"pause",
	"seeked",
	"ratechange",
	"loadedmetadata",
	"ended",
] as const;

let audio: HTMLAudioElement | null = null;
/** 对齐时的音频时间（秒） */
let anchorMedia = 0;
/** 对齐时的墙钟时间（毫秒） */
let anchorWall = 0;
/** 已注册的监听，解绑时逐个摘掉（重复挂载不会叠加） */
let listeners: { type: string; handler: () => void }[] = [];

function sync(): void {
	if (!audio) return;
	anchorMedia = audio.currentTime;
	anchorWall = performance.now();
}

/**
 * 立即把时钟锚到指定位置（秒）。
 *
 * `audio.currentTime = x` 之后 `seeked` 是异步来的，中间几帧还会读到旧位置——
 * 表现就是拖动后进度条先跳回去再跳回来。跳转时直接同步锚定即可。
 */
export function syncAt(seconds: number): void {
	anchorMedia = seconds;
	anchorWall = performance.now();
}

export function attach(element: HTMLAudioElement): void {
	detach();
	audio = element;
	sync();

	const handler = (): void => sync();
	for (const type of SYNC_EVENTS) {
		element.addEventListener(type, handler);
		listeners.push({ type, handler });
	}
}

/** 解绑（切页销毁 island 时调用）；之后 readTime() 返回 0 */
export function detach(): void {
	for (const { type, handler } of listeners) {
		audio?.removeEventListener(type, handler);
	}
	listeners = [];
	audio = null;
}

/** 当前播放位置（秒）；暂停时直接返回元素的 currentTime */
export function readTime(): number {
	if (!audio) return 0;
	if (audio.paused || audio.ended) return audio.currentTime;

	const predicted = anchorMedia + (performance.now() - anchorWall) / 1000;
	const actual = audio.currentTime;

	if (Math.abs(predicted - actual) > DRIFT_TOLERANCE) {
		anchorMedia = actual;
		anchorWall = performance.now();
		return actual;
	}

	return predicted;
}
