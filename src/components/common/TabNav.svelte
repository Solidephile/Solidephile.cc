<script lang="ts">
import { onMount } from "svelte";

import Icon from "./Icon.svelte";

interface Tab {
	id: string;
	name: string;
	count?: number;
	/** 可选图标（Iconify 名，如 "material-symbols:home"）。
	 *  注意：Svelte 侧走离线图标集，需先存在于 src/constants/icons-data.json */
	icon?: string;
}

interface Props {
	tabs: Tab[];
	activeTab: string;
	onTabChange: (tabId: string) => void;
	/** 是否把选中的 tab 同步到 URL hash（默认开启；嵌套的次级 tab 应关闭） */
	useHash?: boolean;
	/**
	 * 布局：
	 * - "scroll"（默认）按内容宽度排布，窄屏横向滚动
	 * - "fill" 等分铺满容器；窄容器下图标与文字上下堆叠，宽容器下并排
	 */
	layout?: "scroll" | "fill";
}

const {
	tabs,
	activeTab,
	onTabChange,
	useHash = true,
	layout = "scroll",
}: Props = $props();

const isFill = $derived(layout === "fill");

function handleHashChange() {
	if (!useHash) return;
	const hash = window.location.hash.replace(/^#/, "");
	if (hash) {
		try {
			const decoded = decodeURIComponent(hash);
			if (tabs.some((t) => t.id === decoded)) {
				onTabChange(decoded);
			}
		} catch {}
	}
}

onMount(() => {
	// 首次带 hash 打开页面时也生效（深链）
	handleHashChange();
	window.addEventListener("hashchange", handleHashChange);
	return () => window.removeEventListener("hashchange", handleHashChange);
});

function clickTab(tabId: string) {
	onTabChange(tabId);
	if (useHash) {
		const nextHash = `#${encodeURIComponent(tabId)}`;
		if (window.location.hash !== nextHash) {
			window.history.replaceState(null, "", nextHash);
		}
	}
}
</script>

<div class="border-b border-(--line-divider) {isFill ? 'mb-5 @container' : 'mb-3'}">
  {#if isFill}
    <!-- 等分铺满：列数跟随 tabs 数量 -->
    <nav
      class="grid gap-1"
      style="grid-template-columns: repeat({tabs.length}, minmax(0, 1fr));"
      aria-label="Tabs"
    >
      {#each tabs as tab (tab.id)}
        <button
          class="flex min-w-0 flex-col items-center justify-center gap-1 rounded-t-lg border-b-2 px-1 py-2.5 text-sm font-medium transition-colors duration-200 @lg:flex-row @lg:gap-2 @lg:px-3 @lg:py-3 @lg:text-base {tab.id === activeTab
            ? 'border-(--primary) text-(--primary)'
            : 'border-transparent text-neutral-500 hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-(--btn-plain-bg-hover) dark:hover:text-neutral-200'}"
          onclick={() => clickTab(tab.id)}
          type="button"
          aria-current={tab.id === activeTab ? "page" : undefined}
        >
          {#if tab.icon}
            <Icon icon={tab.icon} class="text-xl" />
          {/if}
          <span class="max-w-full truncate">{tab.name}</span>
          {#if tab.count !== undefined}
            <span class="bg-(--btn-regular-bg) text-(--btn-content) py-0.5 px-2 rounded-full text-xs">
              {tab.count}
            </span>
          {/if}
        </button>
      {/each}
    </nav>
  {:else}
    <div class="overflow-x-auto" data-tab-scroll-container>
      <nav class="flex min-w-max space-x-8" aria-label="Tabs">
        {#each tabs as tab}
          <button
            class="whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors duration-200 {tab.id === activeTab
              ? 'border-(--primary) text-(--primary)'
              : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'}"
            onclick={() => clickTab(tab.id)}
            type="button"
          >
            {#if tab.icon}
              <Icon icon={tab.icon} class="mr-1.5 inline-block align-[-0.15em] text-base" />
            {/if}
            {tab.name}
            {#if tab.count !== undefined}
              <span class="ml-2 bg-(--btn-regular-bg) text-(--btn-content) py-0.5 px-2 rounded-full text-xs">
                {tab.count}
              </span>
            {/if}
          </button>
        {/each}
      </nav>
    </div>
  {/if}
</div>
