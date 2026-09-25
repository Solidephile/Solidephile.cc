<script lang="ts">
/**
 * osu 页面专用 tab 栏
 * 交互与 common/TabNav 一致（含 URL hash 同步），
 * 但字号略大并支持图标；独立组件，不影响其它页面。
 */
import Icon from "@components/common/Icon.svelte";
import { onMount } from "svelte";

interface Tab {
	id: string;
	name: string;
	icon: string;
}

interface Props {
	tabs: Tab[];
	activeTab: string;
	onTabChange: (tabId: string) => void;
}

const { tabs, activeTab, onTabChange }: Props = $props();

// hash 同步：首次带 hash 打开页面时也生效（原版只在 hashchange 时同步）
function syncFromHash() {
	const hash = decodeURIComponent(window.location.hash.replace(/^#/, ""));
	if (hash && tabs.some((tab) => tab.id === hash)) {
		onTabChange(hash);
	}
}

onMount(() => {
	syncFromHash();
	window.addEventListener("hashchange", syncFromHash);
	return () => window.removeEventListener("hashchange", syncFromHash);
});

function clickTab(tabId: string) {
	onTabChange(tabId);
	const nextHash = `#${encodeURIComponent(tabId)}`;
	if (window.location.hash !== nextHash) {
		window.history.replaceState(null, "", nextHash);
	}
}
</script>

<div class="mb-5 border-b border-(--line-divider)">
	<nav class="grid grid-cols-4 gap-1" aria-label="osu 页面标签">
		{#each tabs as tab (tab.id)}
			<button
				type="button"
				aria-current={tab.id === activeTab ? "page" : undefined}
				class="flex min-w-0 flex-col items-center justify-center gap-1 rounded-t-lg border-b-2 px-1 py-2.5 text-base font-semibold transition-colors duration-200 @lg:flex-row @lg:gap-2 @lg:px-3 @lg:py-3 @lg:text-base
					{tab.id === activeTab
					? 'border-(--primary) text-(--primary)'
					: 'border-transparent text-neutral-500 hover:bg-black/5 hover:text-neutral-800 dark:text-neutral-400 dark:hover:bg-(--btn-plain-bg-hover) dark:hover:text-neutral-200'}"
				onclick={() => clickTab(tab.id)}
			>
				<Icon icon={tab.icon} class="text-xl" />
				<span class="max-w-full truncate">{tab.name}</span>
			</button>
		{/each}
	</nav>
</div>
