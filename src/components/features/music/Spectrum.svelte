<script lang="ts">
import { onMount, untrack } from "svelte";
import { toCanvasColor } from "@/utils/color-utils";
import {
	contextLatency,
	ensureAnalyser,
	getAnalyser,
	isAnalyserUnavailable,
} from "./audio-context";
import { player } from "./player.svelte";

/**
 * 横向频谱（canvas）
 *
 * 播放时才有内容；暂停后跑一小段让竖条自然落下去再停（不常驻 rAF）。
 * 移出视口（移动端滑到歌词屏、页面滚动）时 IntersectionObserver 直接暂停。
 *
 * 用 canvas 而不是一堆 DOM 元素：每帧改几十个 div 的 height 会触发布局重排，
 * 手机上会掉帧；canvas 一次重绘几乎没有成本。
 */
let {
	bars = 32,
	height = 32,
	color = "",
	smoothing = 0.8,
	peakDecay = 0.012,
	floor = 0.25,
	curve = 1.8,
	fftSize = 4096,
	reflect = 0.4,
}: {
	bars?: number;
	height?: number;
	color?: string;
	smoothing?: number;
	peakDecay?: number;
	/** 噪声底（0~1）：低于它的能量算静音，画成 0 */
	floor?: number;
	/** 压缩曲线（>1 越压越狠）：调大能拉开高低差 */
	curve?: number;
	fftSize?: number;
	/** 倒影高度占柱高的比例，0 = 关闭 */
	reflect?: number;
} = $props();

/**
 * 竖条数量 / 画布几何：只取挂载时的配置值。
 *
 * `levels` / `peaks` 是按 `count` 预分配的定长数组，运行中改 props 也不会重建，
 * 所以"只读一次"才是正确语义。用 `untrack` 把这个意图写明，同时消掉 Svelte 的
 * `state_referenced_locally` 警告（它提醒的是"普通读只捕获当下值，之后不跟随"）。
 */
const count = untrack(() => Math.max(8, Math.min(96, Math.round(bars))));
const barHeight = untrack(() => Math.max(8, height));
const reflectHeight = untrack(() =>
	Math.max(0, barHeight * Math.min(1.5, Math.max(0, reflect))),
);
const totalHeight = barHeight + reflectHeight;

/**
 * 分析窗口（dB）。AnalyserNode 的默认窗口上限太低，音乐的低频峰常常越过它，
 * 被 clamp 成满值之后变化信息就全丢了——表现为「左边几根一直顶着天花板」。
 */
const MIN_DB = -90;
const MAX_DB = -6;

/** 频段范围：低于下限只是 DC / 次声波，分辨率也不够 */
const MIN_HZ = 40;
const MAX_HZ = 11000;

/**
 * 静音判定阈值：低于它视为没有内容，用来决定「暂停后落干净了、可以停 rAF」。
 *
 * 注意它只服务于「停循环」这件事，**不要**拿它去决定画不画某一根柱子：柱子按
 * 实际电平给高度（不足 1px 就自然消失），中间没有 1px 的下限，安静段才不会闪烁。
 */
const ZERO_LEVEL = 0.01;

let host: HTMLDivElement | undefined = $state();
let canvas: HTMLCanvasElement | undefined = $state();
let failed = $state(isAnalyserUnavailable());
let onScreen = $state(true);

let ctx: CanvasRenderingContext2D | null = null;
let analyser: AnalyserNode | null = null;
let freq: Uint8Array | null = null;
/** 每根竖条覆盖的 bin 区间，扁平存成 [from0, to0, from1, to1, ...] */
let bands = new Int32Array(0);
const levels = new Float32Array(count);
const peaks = new Float32Array(count);

let cssWidth = 0;
let fill = "#888";
/** 上次重读主题色的时刻（毫秒），用于在 draw 里做节流兜底 */
let colorSyncedAt = 0;
/** 倒影的淡出渐变：目的是把下半部分"擦"掉，只留一点反光 */
let fade: CanvasGradient | null = null;
let raf = 0;
let lastFrame = 0;

/** off = 不画；run = 播放中；settle = 暂停后让竖条落下去 */
const mode = $derived(
	failed || !onScreen ? "off" : player.stagePlaying ? "run" : "settle",
);

/**
 * 按真实采样率把频段对数分给 count 根竖条。
 * 不能用 `binCount ** (i/count)` 这类纯数学映射：低频处每段还不到一个 bin，
 * 前几根会全部落到同一个 bin 上（完全相同、同时饱和）。
 */
function rebuildBands(binCount: number, sampleRate: number): void {
	const nyquist = sampleRate / 2;
	const toBin = (hz: number): number => (hz / nyquist) * binCount;
	const maxHz = Math.min(MAX_HZ, nyquist * 0.95);
	const ratio = maxHz / MIN_HZ;

	bands = new Int32Array(count * 2);

	for (let i = 0; i < count; i += 1) {
		const low = MIN_HZ * ratio ** (i / count);
		const high = MIN_HZ * ratio ** ((i + 1) / count);
		// floor/ceil 保证每段至少吃到 1 个 bin
		const from = Math.max(1, Math.floor(toBin(low)));
		const to = Math.max(from + 1, Math.ceil(toBin(high)));
		bands[i * 2] = from;
		bands[i * 2 + 1] = Math.min(binCount, to);
	}
}

function resize(): void {
	const element = canvas;
	const parent = host;
	if (!element || !parent) return;

	const width = parent.clientWidth;
	if (width <= 0) return;

	const dpr = Math.min(2, window.devicePixelRatio || 1);
	cssWidth = width;
	element.width = Math.round(width * dpr);
	element.height = Math.round(totalHeight * dpr);

	ctx = element.getContext("2d");
	if (!ctx) return;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

	refreshColor();

	// 倒影淡出：从基线完全透明 → 底部完全擦除
	if (reflectHeight > 0) {
		fade = ctx.createLinearGradient(0, barHeight, 0, totalHeight);
		fade.addColorStop(0, "rgba(0, 0, 0, 0)");
		fade.addColorStop(1, "rgba(0, 0, 0, 1)");
	} else {
		fade = null;
	}
}

/**
 * 重新读一次画布颜色。
 *
 * canvas 不会跟着 CSS 变量走，只在尺寸变化时读一次不够：换明暗主题（改的是
 * `<html>` 的 class）和拖色相（`--hue` 写在 `<html>` 的内联 style 上）都不触发
 * resize，颜色会停在旧值——表现为「刷新之后才变色」。
 */
function refreshColor(): void {
	const element = canvas;
	if (!element) return;

	// 主题色是 oklch()：canvas 对它的支持不保证（不支持时 fillStyle 会被静默忽略、
	// 颜色停在旧值，看起来就像「换主题色没生效」），所以先转成 rgb() 再存
	fill = toCanvasColor(getComputedStyle(element).color);
}

function draw(): void {
	if (!ctx || cssWidth <= 0) return;

	// 主题色（拖色相 / 切明暗）随时可能被改，canvas 不会自己跟着 CSS 变量走。
	// MutationObserver 负责即时刷新；这里再兜一层——每秒最多重读一次计算色，
	// 漏了事件（或在暂停时才改了主题）也能在恢复绘制后一秒内自愈。
	const now = performance.now();
	if (now - colorSyncedAt >= 1000) {
		colorSyncedAt = now;
		refreshColor();
	}

	ctx.clearRect(0, 0, cssWidth, totalHeight);
	ctx.fillStyle = fill;

	// 柱子窄一点、缝宽一点，看起来更轻
	const slot = cssWidth / count;
	const gap = Math.max(1, slot * 0.45);
	const barWidth = Math.max(1, slot - gap);
	const xOf = (i: number): number => i * slot + gap / 2;

	ctx.globalAlpha = 0.9;
	for (let i = 0; i < count; i += 1) {
		// 高度 = 真实电平，不设 1px 下限：安静段柱子平滑缩到亚像素后自然看不见，
		// 不会在阈值附近「有时画 1px、有时不画」地闪
		const h = levels[i] * barHeight;
		if (h < 0.5) continue;
		ctx.fillRect(xOf(i), barHeight - h, barWidth, h);
	}

	// 峰值：一小段悬在柱子上方的短线。太贴近基线时干脆不画，
	// 否则一条固定 2px 的线会在底部突然冒出来/消失
	ctx.globalAlpha = 1;
	for (let i = 0; i < count; i += 1) {
		const peakY = peaks[i] * barHeight;
		if (peakY < 4) continue;
		ctx.fillRect(xOf(i), Math.max(0, barHeight - peakY - 3), barWidth, 2);
	}

	// 倒影：把柱子以基线镜像画到下方，再用渐变把它擦淡
	if (reflectHeight > 0) {
		ctx.globalAlpha = 0.4;
		ctx.save();
		ctx.translate(0, barHeight * 2);
		ctx.scale(1, -1);
		for (let i = 0; i < count; i += 1) {
			const h = levels[i] * barHeight;
			if (h < 0.5) continue;
			ctx.fillRect(xOf(i), barHeight - h, barWidth, h);
		}
		ctx.restore();
		ctx.globalAlpha = 1;

		if (fade) {
			ctx.globalCompositeOperation = "destination-out";
			ctx.fillStyle = fade;
			ctx.fillRect(0, barHeight, cssWidth, reflectHeight);
			ctx.globalCompositeOperation = "source-over";
			ctx.fillStyle = fill;
		}
	}
}

function tick(now: number): void {
	raf = 0;
	// dt 归一化成「一帧 = 1」，并设上限，防止切回标签页时一步跳完
	const dt = lastFrame > 0 ? Math.min(3, (now - lastFrame) / 16.667) : 1;
	lastFrame = now;

	if (analyser && freq && player.stagePlaying) {
		analyser.getByteFrequencyData(freq);
		const span = Math.max(0.001, 1 - floor);

		for (let i = 0; i < count; i += 1) {
			const from = bands[i * 2];
			const to = bands[i * 2 + 1];

			// 取段内**均值**而不是最大值：字节频谱里大多数 bin 都在高位，
			// 取 max 会让每根条都顶到天花板，看起来"全都一样高"
			let sum = 0;
			for (let b = from; b < to; b += 1) sum += freq[b];
			const mean = sum / Math.max(1, to - from) / 255;

			// 先减噪声底、再上压缩曲线，把高位那一小段拉开
			const shaped = Math.max(0, mean - floor) / span;
			const target = Math.min(1, shaped ** curve);

			// 起得快、落得慢，打击感更明显
			const rate = (target > levels[i] ? 0.55 : 0.2) * dt;
			levels[i] += (target - levels[i]) * Math.min(1, rate);
		}
	} else {
		for (let i = 0; i < count; i += 1) {
			levels[i] += (0 - levels[i]) * Math.min(1, 0.12 * dt);
		}
	}

	let idle = true;
	for (let i = 0; i < count; i += 1) {
		peaks[i] = Math.max(levels[i], peaks[i] - peakDecay * dt);
		if (levels[i] >= ZERO_LEVEL || peaks[i] >= ZERO_LEVEL) idle = false;
	}

	draw();

	// 暂停后落干净就停掉，不常驻 rAF；停之前把画布清空，
	// 免得最后一帧的 1px 柱子/峰值线留在那里（暂停时看着像"频谱没消失"）
	if (!player.stagePlaying && idle) {
		clearCanvas();
		return;
	}
	raf = requestAnimationFrame(tick);
}

function start(): void {
	if (raf || !canvas) return;
	// 恢复绘制前先读一次颜色：暂停期间改了主题就当场上色，不用等兜底的 1 秒
	refreshColor();
	lastFrame = 0;
	raf = requestAnimationFrame(tick);
}

function stop(): void {
	if (raf) cancelAnimationFrame(raf);
	raf = 0;
}

/** 整块清空（暂停落干净后调用，别留最后一帧的残影） */
function clearCanvas(): void {
	if (!ctx || cssWidth <= 0) return;
	ctx.clearRect(0, 0, cssWidth, totalHeight);
}

function setup(): void {
	const element = player.element;
	if (!element) return;

	const node = ensureAnalyser(element);
	if (!node) {
		failed = true;
		return;
	}

	// 媒体走的就是这个图谱，顺手把它的输出延迟当自动估计交出去
	// （已经测过的话播放器会忽略）
	player.estimateLatency(contextLatency(node.context));

	analyser = node;
	analyser.fftSize = Math.max(512, Math.min(32768, fftSize));
	analyser.minDecibels = MIN_DB;
	analyser.maxDecibels = MAX_DB;
	analyser.smoothingTimeConstant = smoothing;

	rebuildBands(analyser.frequencyBinCount, analyser.context.sampleRate);
	freq = new Uint8Array(analyser.frequencyBinCount);
	resize();
}

$effect(() => {
	const current = mode;

	if (current === "off") {
		stop();
		return;
	}

	// 建图必须在用户手势之后（点播放），否则 context 是 suspended 的
	if (current === "run" && !analyser) setup();
	start();

	return stop;
});

onMount(() => {
	const parent = host;
	if (!parent) return;

	const resizeObserver = new ResizeObserver(() => resize());
	resizeObserver.observe(parent);

	const intersectionObserver = new IntersectionObserver(
		(entries) => {
			const entry = entries[0];
			if (entry) onScreen = entry.isIntersecting;
		},
		{ threshold: 0 },
	);
	intersectionObserver.observe(parent);

	// 主题色变化：换明暗主题改的是 <html> 的 class，拖色相改的是 <html> 的内联 style
	let colorPending = false;
	const themeObserver = new MutationObserver(() => {
		if (colorPending) return;
		colorPending = true;
		requestAnimationFrame(() => {
			colorPending = false;
			refreshColor();
			// 暂停时 rAF 已经停了，画布不会自己重画：补一帧，颜色立刻跟随，
			// 不然要等到下次播放/resize 才更新
			if (!raf) draw();
		});
	});
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "style"],
	});

	return () => {
		resizeObserver.disconnect();
		intersectionObserver.disconnect();
		themeObserver.disconnect();
		stop();
	};
});
</script>

{#if !failed}
	<div
		class="spectrum"
		bind:this={host}
		style:--spectrum-height={`${totalHeight}px`}
		style:--spectrum-color={color || undefined}
		aria-hidden="true"
	>
		<canvas bind:this={canvas}></canvas>
	</div>
{/if}

<style>
	/*
	 * 宽度收窄到和进度条对齐：进度条那一行左右各有一段时间文字，
	 * 让频谱和滑条两端齐平，看起来才是一组。
	 */
	.spectrum {
		width: calc(100% - 4.4rem);
		height: var(--spectrum-height, 45px);
		margin-inline: auto;
		flex-shrink: 0;
		color: var(--spectrum-color, var(--music-accent));
	}

	.spectrum canvas {
		display: block;
		width: 100%;
		height: 100%;
	}
</style>
