<script lang="ts">
import { onMount } from "svelte";
import { navigateToPage } from "@/utils/navigation-utils";
import { player } from "./player.svelte";

/**
 * 单曲页的 URL ↔ 当前曲目双向同步（无 UI）
 *
 * - URL 变成 `/music/<slug>/`（首次进入、后退/前进、点链接）→ 把本地队列切到那一首，
 *   并沿用当前播放状态：在放歌就继续放，暂停或没播就只加载。
 * - 播放器切到别的本地曲目（导航栏列表、上下首、自动连播）→ 单曲页跟着导航过去；
 *   手动切歌 push、自动连播 replace，免得历史里堆一长串歌。
 *
 * 索引页与其它页面不跟随（在索引里选歌不该被带走）；云端曲目没有单曲页，忽略。
 */
const SONG_PATH = /^\/music\/([^/]+)\/?$/;

function pageSlug(): string | null {
	const match = SONG_PATH.exec(location.pathname);
	return match ? decodeURIComponent(match[1]) : null;
}

/** 同一目标只导航一次（swup 过渡期间可能连续收到事件） */
let pendingUrl = "";
let pendingTimer: ReturnType<typeof setTimeout> | undefined;

function syncFromUrl(): void {
	const slug = pageSlug();
	if (!slug) return;

	const list = player.getLocalTracks();
	const index = list.findIndex((track) => track.slug === slug);
	if (index < 0) return;

	// 已经是这一首（刚由播放驱动导航过来）就什么都不做，避免来回跳
	if (player.track?.slug === slug) return;

	// 沿用播放状态：在放就继续放，暂停就只加载。
	// 不要在这里"只展示不接管"——那样页面播放条和导航栏会各显示一份进度。
	player.playLocalList(list, index, player.playing);
}

/** `fm:track` 的 detail 是引擎的线上格式；这边只用到 slug 和两个标记 */
type TrackEvent = {
	track?: { slug?: string };
	auto?: boolean;
	autoPlay?: boolean;
};

function syncToUrl(detail: TrackEvent): void {
	const slug = pageSlug();
	if (!slug) return;

	const track = detail.track;
	if (!track?.slug || track.slug === slug) return;

	// 只有“开始播放某首”才算切歌：管理器初始化/换队列时的只加载不播放要跳过
	if (detail.autoPlay !== true) return;

	const url = `/music/${track.slug}/`;
	if (pendingUrl === url) return;

	pendingUrl = url;
	if (pendingTimer) clearTimeout(pendingTimer);
	pendingTimer = setTimeout(() => {
		pendingUrl = "";
	}, 1000);

	// 单曲页之间切歌：布局不变，保留滚动位置，别把人从歌词/介绍处甩回页面顶部
	navigateToPage(url, {
		replace: detail.auto === true,
		keepScroll: true,
	});
}

function onTrack(event: Event): void {
	const detail = (event as CustomEvent<TrackEvent>).detail;
	syncToUrl(detail ?? {});
}

onMount(() => {
	player.connect();
	window.addEventListener("fm:track", onTrack);

	let bound = false;
	const bindSwup = (): void => {
		if (bound) return;

		if (window.swup?.hooks?.on) {
			window.swup.hooks.on("page:view", syncFromUrl);
			bound = true;
			syncFromUrl();
			return;
		}

		document.addEventListener("swup:enable", bindSwup, { once: true });
	};
	bindSwup();

	return () => {
		window.removeEventListener("fm:track", onTrack);
		document.removeEventListener("swup:enable", bindSwup);
		if (pendingTimer) clearTimeout(pendingTimer);
		window.swup?.hooks?.off?.("page:view", syncFromUrl);
	};
});
</script>

<!-- 无 UI：只负责「URL 变 → 换曲目」和「换曲目 → URL 变」 -->
