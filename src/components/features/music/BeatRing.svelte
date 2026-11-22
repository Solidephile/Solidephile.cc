<script lang="ts">
import { beatState } from "@/utils/beat-utils";
import { player } from "./player.svelte";

/**
 * 四等分节拍环：一拍亮一格，从右上起顺时针。
 *
 * 几何全部由 `size` / `stroke` / `gap` 算出来，改参数不用手工调弧线。
 * 端点用平头（butt）：圆头会向两端各伸出半个线宽，把缝吃掉——「看不见空隙」
 * 就是这么来的，所以这里的 `gap` 就是肉眼看到的缝。
 *
 * 只在「换格」时才写 DOM，不做逐帧动画。
 */
let {
	size = 30,
	stroke = 6,
	gap = 6,
}: {
	size?: number;
	/** 环线宽度 */
	stroke?: number;
	/** 段与段之间的缝（度） */
	gap?: number;
} = $props();

const arcs = $derived.by(() => {
	const center = size / 2;
	const radius = Math.max(3, center - stroke / 2 - 1);

	const pointAt = (deg: number): [number, number] => {
		const rad = (deg * Math.PI) / 180;

		return [center + radius * Math.cos(rad), center + radius * Math.sin(rad)];
	};

	const arc = (from: number, to: number): string => {
		const [x0, y0] = pointAt(from);
		const [x1, y1] = pointAt(to);

		return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${radius.toFixed(2)} ${radius.toFixed(2)} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
	};

	// 从「右上」开始顺时针：每一格占一个象限，两端各让出 gap/2
	return [-1, 0, 1, 2].map((quadrant) =>
		arc(quadrant * 90 + gap / 2, (quadrant + 1) * 90 - gap / 2),
	);
});

/** 当前亮第几格；没在播放时 -1（全部熄灭） */
const active = $derived.by(() => {
	const track = player.stageTrack;
	if (!track || !player.stagePlaying) return -1;

	const beat = beatState(player.stageTime, track.bpm, player.stageOffset);
	if (!beat) return -1;

	return ((beat.beat % 4) + 4) % 4;
});
</script>

<svg
	class="beat-ring"
	viewBox={`0 0 ${size} ${size}`}
	aria-hidden="true"
	style:--ring-size={`${size}px`}
	style:--ring-stroke={`${stroke}px`}
>
	{#each arcs as path, index (index)}
		<path d={path} data-active={active === index} />
	{/each}
</svg>

<style>
	.beat-ring {
		display: block;
		width: var(--ring-size);
		height: var(--ring-size);
	}

	.beat-ring path {
		fill: none;
		stroke: color-mix(in oklab, var(--music-ink) 20%, transparent);
		stroke-width: var(--ring-stroke);
		stroke-linecap: butt;
		/* 熄灭慢、点亮快 */
		transition: stroke 280ms ease-out;
	}

	.beat-ring path[data-active="true"] {
		stroke: var(--music-accent-strong);
		transition-duration: 70ms;
	}
</style>
