<script lang="ts">
/**
 * 统一的「空状态 / 失败状态」占位：圆标图标 + 标题 + 说明。
 *
 * 三档尺寸：
 * - default（4rem 圆标、py-16）：页面级空态 / 失败态
 * - compact（2.5rem 圆标、py-6）：小容器（侧栏、筛选无结果）
 * - inline（无圆标、py-8、小字号）：嵌在组件内部（图表 / 排行列表）
 *
 * 失败态不提供重试：说明统一写「请稍后刷新页面重试」。
 * 图标走离线图标集（src/constants/icons-data.json），加新图标前先确认存在；
 * inline 档不显示图标，可以不传 icon。
 */
import Icon from "@/components/common/Icon.svelte";

type Size = "default" | "compact" | "inline";

interface Props {
	/** empty = 空数据（中性色）；error = 取数失败（红色圆标） */
	variant?: "empty" | "error";
	/** 图标名，例如 "material-symbols:trophy"；inline 档可省略 */
	icon?: string;
	title: string;
	/** 说明，可省略 */
	description?: string;
	/** 尺寸档位 */
	size?: Size;
}

let {
	variant = "empty",
	icon,
	title,
	description,
	size = "default",
}: Props = $props();
</script>

<div
	class="flex w-full flex-col items-center justify-center text-center {size ===
	'default'
		? 'py-16'
		: size === 'compact'
			? 'py-6'
			: 'py-8'}"
	role={variant === "error" ? "alert" : undefined}
>
	{#if size !== "inline" && icon}
		<div
			class="inline-flex shrink-0 items-center justify-center rounded-full border border-(--line-divider) bg-(--btn-regular-bg) {size ===
			'default'
				? 'mb-6 h-16 w-16 text-[2rem]'
				: 'mb-3 h-10 w-10 text-xl'} {variant === 'error'
				? 'text-red-500'
				: 'text-(--btn-content)'}"
			aria-hidden="true"
		>
			<Icon {icon} />
		</div>
	{/if}
	<h2
		class="m-0 font-semibold text-black/80 dark:text-white/80 {size === 'default'
			? 'text-xl'
			: 'text-sm'}"
	>
		{title}
	</h2>
	{#if description}
		<p
			class="m-0 max-w-md text-black/60 dark:text-white/60 {size === 'default'
				? 'mt-2 text-sm'
				: 'mt-1.5 text-xs'}"
		>
			{description}
		</p>
	{/if}
</div>
