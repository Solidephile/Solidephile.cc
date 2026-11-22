/**
 * 一般化的滚动补间（当前用于歌词自动居中）
 *
 * 不用原生 `scrollTo({ behavior: "smooth" })`：它的时长固定、与距离无关，
 * 缓动也偏硬，切行时看起来像啪一下跳过去。这里按距离算时长 + easeInOutCubic，
 * 并且新的目标总是从「当前位置」续着动画，中途再次触发也不会硬切。
 *
 * 注意与 `scroll-utils.ts` 区分：那个是页面级的「回到顶部 / 锚点跳转」逻辑，
 * 这个只管「把一个容器平滑滚到某个位置」。
 *
 * 导航栏那个旧播放器的歌词滚动是 is:inline 脚本（无法 import），在
 * `MusicPlayerView.astro` 里有一份等价实现，**改这里的常数时要同步改那边**。
 */

/** 最短时长（ms）：再短就又像硬切了 */
const MIN_MS = 420;
/** 最长时长（ms）：大跳也不能没完没了 */
const MAX_MS = 900;
/** 每多滚 1px 增加的时长 */
const MS_PER_PX = 0.6;

/** 每个元素正在跑的 rAF，用来在重新触发时取消上一段 */
const running = new WeakMap<HTMLElement, number>();

/** 取消某个元素正在进行的补间（组件销毁时调用；没有在跑就什么都不做） */
export function cancelScrollTop(element: HTMLElement): void {
	const frame = running.get(element);
	if (!frame) return;

	cancelAnimationFrame(frame);
	running.delete(element);
}

/**
 * 把元素的滚动位置补间到 `top`。
 * 重复调用会取消上一段，从当前 `scrollTop` 接着走。
 */
export function animateScrollTop(element: HTMLElement, top: number): void {
	cancelScrollTop(element);

	const from = element.scrollTop;
	const delta = top - from;
	if (Math.abs(delta) < 1) return;

	// 系统开了「减少动态效果」就直接跳
	const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
	const duration = reduced
		? 0
		: Math.min(MAX_MS, MIN_MS + Math.abs(delta) * MS_PER_PX);

	if (duration === 0) {
		element.scrollTop = top;
		return;
	}

	const start = performance.now();
	const step = (now: number): void => {
		const t = Math.min(1, (now - start) / duration);
		// easeInOutCubic：起步和收尾都软，中段才快
		const eased = t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2;
		element.scrollTop = from + delta * eased;

		if (t < 1) running.set(element, requestAnimationFrame(step));
		else running.delete(element);
	};

	running.set(element, requestAnimationFrame(step));
}
