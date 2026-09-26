/**
 * 共享的 IntersectionObserver（成绩卡按视口加载封面用）
 *
 * 为什么共用一个实例：成绩列表展开后可能同时有上百张卡，
 * 每张卡各自 new 一个 observer 太浪费；Expert+ 也是全页共用一个。
 *
 * 用法：
 *   onMount(() => observeInView(el, (inView) => { ... }));
 * 返回的函数用于组件卸载时清理。
 */

type InViewListener = (inView: boolean) => void;

const listeners = new Map<Element, InViewListener>();

let observer: IntersectionObserver | null = null;

/** 提前 220px 预加载（与 osu! Expert+ 的 rootMargin 一致） */
const ROOT_MARGIN = "220px 0px";

function ensureObserver(): IntersectionObserver | null {
	if (typeof window === "undefined" || !("IntersectionObserver" in window)) {
		return null;
	}

	if (!observer) {
		observer = new IntersectionObserver(
			(entries) => {
				for (const entry of entries) {
					listeners.get(entry.target)?.(entry.isIntersecting);
				}
			},
			{ root: null, rootMargin: ROOT_MARGIN, threshold: 0 },
		);
	}

	return observer;
}

/**
 * 监听某个元素是否进入（或接近）视口。
 * 浏览器不支持 IntersectionObserver 时直接回调 true（照常加载）。
 */
export function observeInView(
	el: Element,
	listener: InViewListener,
): () => void {
	const instance = ensureObserver();

	if (!instance) {
		listener(true);
		return () => {};
	}

	listeners.set(el, listener);
	instance.observe(el);

	return () => {
		listeners.delete(el);
		instance.unobserve(el);
	};
}
