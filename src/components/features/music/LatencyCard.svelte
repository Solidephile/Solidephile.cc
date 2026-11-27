<script lang="ts">
import Icon from "@components/common/Icon.svelte";
import { onMount } from "svelte";
import { readStored, writeStored } from "@/utils/storage-utils";
import { player } from "./player.svelte";

let { accent = "" }: { accent?: string } = $props();

const SOURCE_LABELS: Record<string, string> = {
	none: "未测",
	auto: "自动",
	measured: "已校准",
};

const OPEN_KEY = "music-latency-open";

/** 内部统一用秒，界面用毫秒 */
const measuredMs = $derived(Math.round(player.measuredLatency * 1000));
const offsetMs = $derived(Math.round(player.manualOffset * 1000));
const totalMs = $derived(Math.round(player.latency * 1000));
/** 滑块从最左端到当前值的填充比例（和播放条一致） */
const percent = $derived(((offsetMs + 300) / 600) * 100);

let open = $state(false);
let calibrating = $state(false);

onMount(() => {
	if (readStored(OPEN_KEY) === "1") open = true;
});

function toggleOpen(): void {
	open = !open;
	writeStored(OPEN_KEY, open ? "1" : "0");
}

async function recalibrate(): Promise<void> {
	if (calibrating) return;
	calibrating = true;
	try {
		await player.calibrateLatency();
	} finally {
		calibrating = false;
	}
}

function updateOffsetMs(value: number): void {
	if (!Number.isFinite(value)) return;
	player.setManualOffset(value / 1000);
}
</script>

<div
	class="card-base p-5 sm:p-7"
	style:--latency-accent={accent || "var(--primary)"}
>
	<button
		type="button"
		class="group flex w-full flex-wrap items-center gap-2 text-left"
		aria-expanded={open}
		aria-controls="latency-body"
		onclick={toggleOpen}
	>
		<Icon
			icon="material-symbols:timer"
			class="text-2xl"
			style="color: var(--latency-accent)"
		/>
		<span class="text-lg font-bold text-90">播放延迟校准</span>
		<span class="ml-auto text-base tabular-nums text-(--content-meta)">
			总补偿 {totalMs} ms
		</span>
		<Icon
			icon="fa7-solid:chevron-right"
			class="text-sm text-(--content-meta) transition-transform duration-150 group-hover:text-(--btn-content) {open
				? 'rotate-90'
				: ''}"
		/>
	</button>

	<div id="latency-body" class="mt-4" hidden={!open}>
		<!-- 自动测量 -->
		<div class="flex flex-wrap items-center gap-2 text-base">
			<span class="text-(--content-meta)">自动测量</span>
			<span class="font-medium tabular-nums text-90">
				{measuredMs > 0 ? `${measuredMs} ms` : "未校准"}
			</span>
			<span
				class="rounded-full bg-(--btn-regular-bg) px-2.5 py-0.5 text-sm text-(--content-meta)"
			>
				{SOURCE_LABELS[player.latencySource] ?? "未测"}
			</span>
			<button
				type="button"
				class="ml-auto rounded-lg bg-(--btn-regular-bg) px-3.5 py-1.5 text-base text-(--btn-content) transition-colors duration-150 hover:bg-(--btn-regular-bg-hover) disabled:opacity-60"
				onclick={recalibrate}
				disabled={calibrating}
			>
				{calibrating ? "校准中…" : "重新校准"}
			</button>
		</div>

		{#if player.latencySupport === "unavailable"}
			<p class="mt-3 text-base leading-relaxed text-(--content-meta)">
				当前浏览器拿不到输出延迟（outputLatency 为 0），无法自动校准；请用下面的手动偏移对齐。
			</p>
		{/if}

		<!-- 手动偏移：滑块粗调 + 输入框精调 -->
		<div class="mt-3 flex flex-wrap items-center gap-2 text-base">
			<span class="text-(--content-meta)">手动偏移</span>
			<input
				type="range"
				min="-300"
				max="300"
				step="5"
				value={offsetMs}
				aria-label="手动延迟偏移（毫秒）"
				aria-valuetext={`${offsetMs} ms`}
				style:--pct={`${percent}%`}
				oninput={(event) => updateOffsetMs(Number(event.currentTarget.value))}
				class="latency-range min-w-36 flex-1"
			/>
			<input
				type="number"
				min="-300"
				max="300"
				step="5"
				value={offsetMs}
				aria-label="手动延迟偏移毫秒数"
				oninput={(event) => updateOffsetMs(Number(event.currentTarget.value))}
				class="latency-number w-20 rounded-md border border-(--line-divider) bg-transparent px-2 py-1 text-right tabular-nums text-90 focus:border-(--latency-accent) focus:outline-none"
			/>
			<span class="text-(--content-meta)">ms</span>
			<button
				type="button"
				class="flex size-8 items-center justify-center rounded-full text-(--content-meta) transition-colors duration-150 hover:bg-(--btn-regular-bg-hover) hover:text-(--btn-content)"
				aria-label="重置手动偏移"
				title="重置手动偏移"
				onclick={() => player.resetManualOffset()}
			>
				<Icon icon="fa7-solid:arrow-rotate-left" class="text-lg" />
			</button>
		</div>

		<p class="mt-4 text-base leading-relaxed text-(--content-meta)">
			自动测量值是浏览器报告的设备输出延迟，手动偏移叠加在其上。若感觉画面偏晚则减小延迟，否则增大延迟。
		</p>
	</div>
</div>

<style>
	.latency-range {
		-webkit-appearance: none;
		appearance: none;
		min-width: 0;
		height: 18px;
		margin: 0;
		background: transparent;
		/* input 默认不继承文字色（UA 会给 fieldtext），轨道混色会因此在深色模式下变黑 */
		color: var(--content-meta);
		cursor: pointer;
	}

	/* 参考播放条：细轨 + 主题色填充，从最左端填到当前值 */
	.latency-range::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--latency-accent) var(--pct),
			color-mix(in oklab, currentColor 20%, transparent) var(--pct)
		);
	}

	.latency-range::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 12px;
		height: 12px;
		margin-top: -4px;
		border: 0;
		border-radius: 50%;
		background: var(--latency-accent);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
	}

	.latency-range::-moz-range-track {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--latency-accent) var(--pct),
			color-mix(in oklab, currentColor 20%, transparent) var(--pct)
		);
	}

	.latency-range::-moz-range-thumb {
		width: 12px;
		height: 12px;
		border: 0;
		border-radius: 50%;
		background: var(--latency-accent);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
	}

	.latency-range:focus-visible {
		outline: 2px solid
			color-mix(in oklab, var(--latency-accent) 60%, transparent);
		outline-offset: 3px;
		border-radius: 999px;
	}

	/* 去掉 number 输入框的上下箭头：深色模式下 WebKit 的 spin 按钮是白底，
	   和输入框风格不搭；键盘方向键仍然可以微调 */
	.latency-number {
		appearance: textfield;
		-moz-appearance: textfield;
	}

	.latency-number::-webkit-outer-spin-button,
	.latency-number::-webkit-inner-spin-button {
		-webkit-appearance: none;
		margin: 0;
	}
</style>
