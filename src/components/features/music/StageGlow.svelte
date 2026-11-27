<script lang="ts">
import { beatState, inEffectWindow } from "@/utils/beat-utils";
import { player } from "./player.svelte";

/**
 * 卡片左右内边缘的节拍光晕
 *
 * - 非 kiai：两侧**同时**闪，每 4 拍一次；
 * - kiai：两侧**交替**闪，每拍一次（更密、更亮）；
 * - 用两条横向渐变 + `opacity` 驱动，只写合成层属性，不碰 filter / 布局；
 * - 峰值固定在拍点上，衰减时长是**固定值**、不跟着触发周期拉伸：早先按周期归一化，
 *   光会整段亮着慢慢起伏，眼睛感到的"闪"落在拍点之后，看着就比鼓点慢。
 */
let {
	kiai = [],
	effects = [],
	width = 28,
	gain = 0.5,
	kiaiGain = 0.7,
}: {
	kiai?: number[][];
	/** 特效区间（秒）：区间外不闪；空数组表示全曲都闪 */
	effects?: number[][];
	/** 光带宽度（舞台卡宽度的百分比） */
	width?: number;
	/** 普通段强度（0~1） */
	gain?: number;
	/** kiai 段强度（0~1，可以比 gain 大） */
	kiaiGain?: number;
} = $props();

/** 非 kiai：几拍闪一次（两侧同时）；kiai 固定每拍一下 */
const NORMAL_BEATS = 2;
/** 一次闪动的衰减时长（秒）：与触发周期无关，闪完就暗 */
const FLASH_DECAY = 0.24;
/** 衰减指数：越大消失得越快 */
const DECAY = 1;
/** 最终乘到 opacity 上的系数 */
const MAX_OPACITY = 0.5;

function inKiai(time: number): boolean {
	for (const range of kiai) {
		const from = range[0];
		const to = range[1];
		if (typeof from !== "number" || typeof to !== "number") continue;
		if (time >= from && time <= to) return true;
	}

	return false;
}

const pulse = $derived.by(() => {
	const track = player.stageTrack;
	if (!track || !player.stagePlaying) return { left: 0, right: 0 };

	// 和节拍环共用同一套拍点计算；第一拍之前不闪
	const time = player.stageTime;
	const beat = beatState(time, track.bpm, player.stageOffset);
	if (!beat || beat.beat < 0) return { left: 0, right: 0 };

	const kiaiNow = kiai.length > 0 && inKiai(time);

	// 距离上一次触发已经过去多少拍：kiai 每拍触发，非 kiai 每 NORMAL_BEATS 拍
	const beatsSince = kiaiNow
		? beat.phase
		: (beat.beat % NORMAL_BEATS) + beat.phase;

	// 是否该闪按**触发那一拍**的时刻判断（不是当前帧）：结束那一拍的闪
	// 会在区间之后按自己的衰减收完，不会被区间硬切
	const triggerAt = time - beatsSince * beat.spb;
	if (!inEffectWindow(effects, triggerAt)) return { left: 0, right: 0 };

	// 峰值就在触发那一拍（beatsSince = 0），之后按固定时长衰减到 0，
	// 剩下的时间保持全暗 —— 这样眼睛看到的"一下"才落在拍点上
	const envelope = Math.max(0, 1 - (beatsSince * beat.spb) / FLASH_DECAY);
	const value = envelope ** DECAY * (kiaiNow ? kiaiGain : gain) * MAX_OPACITY;

	if (kiaiNow) {
		// kiai：左右交替（第 0 拍从左起）
		return beat.beat % 2 === 0
			? { left: value, right: 0 }
			: { left: 0, right: value };
	}

	// 非 kiai：两侧同时
	return { left: value, right: value };
});
</script>

<div
	class="glow"
	data-side="left"
	style:opacity={pulse.left}
	style:--glow-width={`clamp(28px, ${width}%, 190px)`}
></div>
<div
	class="glow"
	data-side="right"
	style:opacity={pulse.right}
	style:--glow-width={`clamp(28px, ${width}%, 190px)`}
></div>

<style>
	.glow {
		position: absolute;
		top: 0;
		bottom: 0;
		width: var(--glow-width, 12%);
		pointer-events: none;
		will-change: opacity;
	}

	/* 竖向的一条光带：从边缘向内横向淡出，而不是圆形光斑 */
	.glow[data-side="left"] {
		left: 0;
		background: linear-gradient(
			to right,
			color-mix(in oklab, var(--music-accent) 80%, transparent) 0%,
			color-mix(in oklab, var(--music-accent) 26%, transparent) 45%,
			color-mix(in oklab, var(--music-accent) 0%, transparent) 100%
		);
	}

	.glow[data-side="right"] {
		right: 0;
		background: linear-gradient(
			to left,
			color-mix(in oklab, var(--music-accent) 80%, transparent) 0%,
			color-mix(in oklab, var(--music-accent) 26%, transparent) 45%,
			color-mix(in oklab, var(--music-accent) 0%, transparent) 100%
		);
	}
</style>
