<script lang="ts">
/**
 * 药丸分段控件：用于「时段 / 视图」这类筛选。
 * 刻意和顶部 TabNav（下划线式）区分开，避免看起来像两级页面导航。
 *
 * 配色全部取自 Firefly 的主题令牌（跟随主题色相），不使用中性灰：
 * - 轨道：--btn-regular-bg-hover，比页面底色深一档，在页面背景和卡片里都看得见
 * - 选中：--primary 实心 + 反差文字（亮色白字 / 暗色深字），沿用 .page-icon 的对比策略，
 *         靠「大色块」而不是「浅色滑块」表达选中，因此色差始终明显
 * - 未选中：--btn-content（主题色系文字）+ 主题色 hover 底
 *
 * 响应式：移动端整条占满宽度、各段等分（保证 375px 也放得下）；
 * ≥sm 恢复为内容自适应宽度的右侧控件。
 */
interface Option {
	id: string;
	name: string;
}

interface Props {
	options: Option[];
	value: string;
	onChange: (id: string) => void;
	/** 无障碍分组标签 */
	label?: string;
}

let { options, value, onChange, label = "筛选" }: Props = $props();

const BASE_CLASS =
	"flex-1 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors duration-150 sm:flex-none";

function buttonClass(option: Option): string {
	return option.id === value
		? `${BASE_CLASS} bg-(--primary) text-white shadow-sm dark:text-black/70`
		: `${BASE_CLASS} text-(--btn-content) hover:bg-(--btn-regular-bg)`;
}
</script>

<div
	class="flex w-full gap-1 rounded-xl bg-(--btn-regular-bg-hover) p-1 sm:w-auto"
	role="group"
	aria-label={label}
>
	{#each options as option (option.id)}
		<button
			type="button"
			class={buttonClass(option)}
			aria-pressed={option.id === value}
			onclick={() => onChange(option.id)}
		>
			{option.name}
		</button>
	{/each}
</div>
