<script lang="ts">
interface Item {
	name: string;
	value: number;
}

interface Props {
	items: Item[];
	/** 数值后缀，例如 " 次" */
	suffix?: string;
	/** 空数据文案 */
	emptyText?: string;
}

let { items = [], suffix = "", emptyText = "暂无数据" }: Props = $props();

// 进度条以最大值为基准；max 至少为 1，避免除零
const maxValue = $derived(
	Math.max(1, ...items.map((item) => Number(item.value) || 0)),
);

function formatNumber(value: number): string {
	return Number(value).toLocaleString("en-US");
}
</script>

{#if items.length === 0}
	<p class="py-8 text-center text-sm text-neutral-400 dark:text-neutral-500">
		{emptyText}
	</p>
{:else}
	<ul class="flex flex-col gap-1">
		{#each items as item (item.name)}
			<li class="relative overflow-hidden rounded-lg px-2.5 py-2">
				<!-- 进度条底色 -->
				<div
					class="absolute inset-y-0 left-0 rounded-lg bg-(--btn-regular-bg)"
					style={`width: ${Math.max(4, (Number(item.value) / maxValue) * 100)}%`}
					aria-hidden="true"
				></div>
				<div class="relative flex items-center justify-between gap-3">
					<span
						class="min-w-0 truncate text-sm text-neutral-700 dark:text-neutral-300"
						title={item.name}
					>
						{item.name}
					</span>
					<span
						class="shrink-0 text-sm font-semibold tabular-nums text-neutral-900 dark:text-neutral-100"
					>
						{formatNumber(item.value)}{suffix}
					</span>
				</div>
			</li>
		{/each}
	</ul>
{/if}
