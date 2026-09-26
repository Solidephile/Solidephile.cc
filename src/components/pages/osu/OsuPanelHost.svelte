<script lang="ts">
/**
 * 「基本信息」面板的取数外壳
 *
 * OsuPanel 保持纯展示（只吃 props，方便单独预览/测试），
 * 取数、加载态、错误态放在这里——它是常驻可见的，所以用 client:load。
 */

import { onMount } from "svelte";
import LoadingState from "@/components/common/LoadingState.svelte";
import type { OsuStats, OsuStatus } from "@/types/osu";

import OsuPanel from "./OsuPanel.svelte";
import { loadOsuData, loadOsuStatus } from "./osu-data";

let stats = $state<OsuStats | null>(null);
let error = $state(false);

// 实时在线状态单独接口，与主数据互不影响
let status = $state<OsuStatus | null>(null);
let statusError = $state(false);

onMount(async () => {
	loadOsuStatus().then((value) => {
		if (value) status = value;
		else statusError = true;
	});

	try {
		stats = (await loadOsuData()).stats;
	} catch (e) {
		console.warn("osu 基本信息获取失败:", e);
		error = true;
	}
});
</script>

{#if error}
	<div class="card-base mb-3 p-8 text-center text-neutral-500 dark:text-neutral-400">
		数据加载失败
	</div>
{:else if !stats}
	<div class="card-base mb-3">
		<LoadingState />
	</div>
{:else}
	<OsuPanel {stats} {status} {statusError} />
{/if}
