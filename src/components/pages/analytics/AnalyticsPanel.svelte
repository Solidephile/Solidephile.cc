<script lang="ts">
import type { Snippet } from "svelte";
import Icon from "@/components/common/Icon.svelte";

interface Props {
	/** Iconify 名；需存在于离线图标集 src/constants/icons-data.json */
	icon: string;
	title: string;
	children: Snippet;
}

let { icon, title, children }: Props = $props();
</script>

<section class="card-base p-4">
	<div class="mb-3 flex items-center gap-2">
		<span class="text-lg text-(--primary)">
			<Icon {icon} />
		</span>
		<h3 class="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
			{title}
		</h3>
	</div>
	{@render children()}
</section>
