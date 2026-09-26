<script lang="ts">
/**
 * osu 页面的 tab 导航
 *
 * 四个面板由 osu.astro 用 Astro 渲染（只有 Astro 侧渲染的面板里才能放 MDX 内容），
 * 这个 island 只负责两件事：
 *   1. 维护选中态（并把 hash 深链同步交给共用的 TabNav）
 *   2. 把选中态写到最近的外层 [data-osu-tabs] 容器上
 *
 * 面板显隐由 osu.astro 里的 CSS 根据 data-active-tab 决定，
 * 所以「谁被选中」始终只有这里一个来源，不会两边各说各话。
 */
import TabNav from "@components/common/TabNav.svelte";
import { onMount } from "svelte";

const TABS = [
	{ id: "intro", name: "游戏简介", icon: "material-symbols:sports-esports" },
	{ id: "history", name: "历史数据", icon: "material-symbols:show-chart" },
	{ id: "scores", name: "最好成绩", icon: "material-symbols:trophy" },
	{ id: "beatmaps", name: "谱面相关", icon: "material-symbols:map" },
];

let activeTab = $state("intro");
let root = $state<HTMLElement | undefined>(undefined);

/** 把选中态发布给外层容器（osu.astro 里的 [data-osu-tabs]） */
function publish(tabId: string) {
	root?.closest("[data-osu-tabs]")?.setAttribute("data-active-tab", tabId);
}

// TabNav 无论是点击还是 hash 变化都会回调这里，所以不用再单独监听 hash
function handleTabChange(tabId: string) {
	activeTab = tabId;
	publish(tabId);
}

onMount(() => {
	// 首屏把服务端渲染的默认值对齐一次，避免 SSR 默认值与深链不一致
	publish(activeTab);
});
</script>

<!-- display:contents：只作为「发布选中态」的载体，不参与布局 -->
<div bind:this={root} class="contents">
	<TabNav tabs={TABS} {activeTab} onTabChange={handleTabChange} layout="fill" />
</div>
