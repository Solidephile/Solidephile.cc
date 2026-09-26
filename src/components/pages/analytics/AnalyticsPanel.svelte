<script lang="ts">
import type { Snippet } from "svelte";
import Icon from "@/components/common/Icon.svelte";

interface Props {
	/** Iconify 名；需存在于离线图标集 src/constants/icons-data.json */
	icon: string;
	title: string;
	/** 右侧可选内容（例如时段筛选控件） */
	trailing?: Snippet;
	children: Snippet;
}

let { icon, title, trailing, children }: Props = $props();
</script>

<section class="card-base p-4">
	<div
		class="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
	>
		<div class="flex items-center gap-2.5">
			<span class="text-2xl text-(--primary)">
				<Icon {icon} />
			</span>
			<h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
				{title}
			</h3>
		</div>

		{#if trailing}
			{@render trailing()}
		{/if}
	</div>
	{@render children()}
</section>
