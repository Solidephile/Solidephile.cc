<script lang="ts">
import {
	CategoryScale,
	Chart,
	Filler,
	Legend,
	LinearScale,
	LineController,
	LineElement,
	PointElement,
	Tooltip,
} from "chart.js";
import { onDestroy, onMount } from "svelte";

Chart.register(
	LineController,
	CategoryScale,
	LinearScale,
	PointElement,
	LineElement,
	Tooltip,
	Filler,
	Legend,
);

interface ChartSeries {
	label: string;
	data: number[];
	/** 颜色；不传则用主题色 --primary */
	color?: string;
	/** 是否在折线下方画渐变填充 */
	fill?: boolean;
}

interface Props {
	/** X 轴标签 */
	labels: string[];
	series: ChartSeries[];
	/** 数值格式 */
	valueFormat?: "integer" | "decimal" | "compact";
	/** Y 轴刻度与 tooltip 的后缀，例如 " 次" */
	suffix?: string;
	/** 图表高度（px） */
	height?: number;
	/** 排名类数据用反向 Y 轴（数值越小越好） */
	reverse?: boolean;
	/** 填充基准："origin" 从 0 起，"start" 从坐标轴起点起 */
	fillMode?: "origin" | "start";
	yMin?: number;
	yMax?: number;
	/** 极值上下留白比例 */
	paddingRatio?: number;
	/** 留白下限 */
	minPadding?: number;
	/** Y 轴下界不小于 0（适合计数类数据） */
	clampZero?: boolean;
	/** 是否显示图例；不传时多序列自动显示 */
	showLegend?: boolean;
}

let {
	labels = [],
	series = [],
	valueFormat = "integer",
	suffix = "",
	height = 240,
	reverse = false,
	fillMode = "origin",
	yMin,
	yMax,
	paddingRatio = 0.08,
	minPadding = 1,
	clampZero = false,
	showLegend,
}: Props = $props();

const legendVisible = $derived(showLegend ?? series.length > 1);

/* ---------- 主题色：读取 CSS 变量 ---------- */

function readVar(name: string, fallback: string): string {
	if (typeof window === "undefined") return fallback;
	return (
		getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
		fallback
	);
}

// 给颜色追加透明度：兼容 rgb()/rgba() 与 oklch() 等 CSS Color 4 语法
function withAlpha(color: string, alpha: number): string {
	const c = color.trim();

	const rgb = c.match(/^rgba?\(([^)]+)\)$/i);
	if (rgb) {
		const parts = rgb[1].split(/[\s,/]+/).filter(Boolean);
		if (parts.length >= 3) {
			return `rgba(${parts[0]}, ${parts[1]}, ${parts[2]}, ${alpha})`;
		}
	}

	if (/^(oklch|oklab|hsl|hwb|lab|lch|color)\(/i.test(c)) {
		return c.includes("/")
			? c.replace(/\/[^)]*\)$/, `/ ${alpha})`)
			: c.replace(/\)$/, ` / ${alpha})`);
	}

	return c;
}

function themeColors() {
	const primary = readVar("--primary", "#ff66ab");
	return {
		primary,
		tick: readVar("--content-meta", "rgba(0, 0, 0, 0.7)"),
		grid: readVar("--line-divider", "rgba(0, 0, 0, 0.08)"),
		panelBg: readVar("--float-panel-bg", "rgba(20, 17, 24, 0.96)"),
	};
}

/* ---------- 数值格式与坐标轴范围 ---------- */

function formatValue(value: number): string {
	if (valueFormat === "decimal") {
		return Number(value).toLocaleString("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}

	if (valueFormat === "compact") {
		return Number(value).toLocaleString("en-US", {
			notation: "compact",
			maximumFractionDigits: 1,
		});
	}

	return Math.round(value).toLocaleString("en-US");
}

/**
 * 取 1/2/5 × 10^n 的「好看」步长。
 * chart.js 在显式给了 min/max 之后，会按数据自己挑刻度，步长可能不是整数倍，
 * 于是纵轴标签看起来疏密不均；这里自己算一个步长，再交给 ticks.stepSize。
 */
function niceStep(span: number, targetTicks = 4): number {
	if (!Number.isFinite(span) || span <= 0) return 1;

	const rough = span / targetTicks;
	const magnitude = 10 ** Math.floor(Math.log10(rough));
	const normalized = rough / magnitude;
	const factor =
		normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 5 ? 5 : 10;

	return factor * magnitude;
}

/**
 * 把上下界向外取整到 step 的整数倍，保证刻度值是等距的整数倍。
 * `dataSpan` 用「数据本身的量程」而不是加过留白的量程——否则留白会把
 * 步长抬到上一档（例如 95pp 的波动被算成 50 一档，曲线就被压平了）。
 */
function withNiceBounds(
	min: number,
	max: number,
	dataSpan: number,
	targetTicks = 5,
) {
	const step = niceStep(dataSpan, targetTicks);
	// toPrecision 收一下浮点误差（0.1 * 3 会变成 0.30000000000000004）
	const round = (value: number) => Number(value.toPrecision(12));

	return {
		min: round(Math.floor(min / step) * step),
		max: round(Math.ceil(max / step) * step),
		stepSize: step,
	};
}

function getRange() {
	if (yMin !== undefined && yMax !== undefined) {
		return withNiceBounds(yMin, yMax, yMax - yMin);
	}

	const values = series
		.flatMap((item) => item.data)
		.map(Number)
		.filter(Number.isFinite);

	if (values.length === 0) {
		return { min: 0, max: 1, stepSize: undefined };
	}

	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);

	if (minValue === maxValue) {
		const lower = clampZero
			? Math.max(0, minValue - minPadding)
			: minValue - minPadding;
		const upper = maxValue + minPadding;
		return withNiceBounds(lower, upper, upper - lower);
	}

	const padding = Math.max((maxValue - minValue) * paddingRatio, minPadding);
	const lower = clampZero
		? Math.max(0, minValue - padding)
		: minValue - padding;

	return withNiceBounds(
		yMin ?? lower,
		yMax ?? maxValue + padding,
		maxValue - minValue,
	);
}

// canvas 用 $state：bind:this 赋值后能让下面的 $effect 重新触发，
// 避免「effect 先于绑定执行 → canvas 还是 undefined → 图表空白」这类时序问题
let canvas = $state<HTMLCanvasElement | undefined>(undefined);
let chart: Chart | undefined;
let themeObserver: MutationObserver | undefined;

function build(animate: boolean) {
	const target = canvas;
	if (!target) return;

	const c = themeColors();
	const range = getRange();
	const hasData =
		labels.length > 0 && series.some((item) => item.data.length > 0);

	// chart.js 会改动传给它的对象，而 Svelte 的 $state 是深代理：
	// 直接传代理数组会抛 state_descriptors_fixed，所以先复制成普通数组
	const chartLabels = Array.from(labels, (label) => String(label));

	chart?.destroy();
	chart = undefined;

	if (!hasData) return;

	chart = new Chart(target, {
		type: "line",
		data: {
			labels: chartLabels,
			datasets: series.map((item) => {
				const color = item.color || c.primary;

				return {
					label: item.label,
					data: Array.from(item.data, Number),
					borderColor: color,
					borderWidth: 2,
					pointRadius: chartLabels.length <= 20 ? 3 : 0,
					pointHoverRadius: 5,
					pointBackgroundColor: color,
					// 必须显式给 hover 颜色：chart.js 的默认值是
					// getHoverColor(options.backgroundColor)，它会用 @kurkle/color 解析颜色，
					// 而站点的 --primary 是 oklch(...) 语法，解析失败就退化成纯黑。
					// 线/点/填充都是把字符串直接丢给 canvas，所以只有 hover 这个点会变黑。
					pointHoverBackgroundColor: color,
					pointHoverBorderColor: color,
					pointHoverBorderWidth: 0,
					pointBorderWidth: 0,
					tension: 0.32,
					fill: item.fill ? fillMode : false,
					backgroundColor: item.fill
						? (context: { chart: Chart }) => {
								const chartRef = context.chart;
								const { chartArea } = chartRef;
								if (!chartArea) return withAlpha(color, 0.45);

								const gradient = chartRef.ctx.createLinearGradient(
									0,
									chartArea.top,
									0,
									chartArea.bottom,
								);
								gradient.addColorStop(0, withAlpha(color, 0.45));
								gradient.addColorStop(1, withAlpha(color, 0));
								return gradient;
							}
						: undefined,
				};
			}),
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate ? { duration: 500 } : false,
			interaction: { mode: "index", intersect: false },
			plugins: {
				legend: {
					display: legendVisible,
					position: "top",
					align: "end",
					labels: {
						color: c.tick,
						usePointStyle: true,
						pointStyle: "circle",
						boxWidth: 8,
						boxHeight: 8,
						padding: 16,
						font: { size: 11 },
					},
				},
				tooltip: {
					displayColors: false,
					backgroundColor: c.panelBg,
					borderColor: c.grid,
					borderWidth: 1,
					titleColor: c.tick,
					bodyColor: c.tick,
					padding: 10,
					cornerRadius: 10,
					callbacks: {
						label: (context) =>
							`${context.dataset.label}：${formatValue(Number(context.parsed.y))}${suffix}`,
					},
				},
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: {
						color: c.tick,
						maxTicksLimit: 8,
						// 横轴标签一律水平：默认允许倾斜到 50°，窄容器里会变成一排斜字
						maxRotation: 0,
						minRotation: 0,
						// 提前跳标签，给相邻刻度留出间距，而不是等挤到一起再旋转
						autoSkip: true,
						autoSkipPadding: 14,
						font: { size: 10 },
					},
				},
				y: {
					reverse,
					min: range.min,
					max: range.max,
					grid: { color: c.grid },
					border: { display: false },
					ticks: {
						color: c.tick,
						maxTicksLimit: 5,
						// 固定步长：由 getRange() 算好的「好看步长」，刻度值才会等距
						stepSize: range.stepSize,
						padding: 6,
						font: { size: 10 },
						callback: (value) => `${formatValue(Number(value))}${suffix}`,
					},
				},
			},
		},
	});
}

/** 渲染入口：统一捕获异常并打日志，避免静默失败 */
function render(animate: boolean) {
	try {
		build(animate);
	} catch (error) {
		console.error("折线图渲染失败:", error);
	}
}

// canvas 就绪后绘制；数据 / 配置变化时重绘（带入场动画）
$effect(() => {
	// 先读 canvas：绑定赋值后会重新触发本 effect
	if (!canvas) return;

	// 显式读取其余依赖
	void labels;
	void series;
	void valueFormat;
	void suffix;
	void reverse;
	void fillMode;
	void yMin;
	void yMax;
	void paddingRatio;
	void minPadding;
	void clampZero;
	void legendVisible;

	render(true);
});

// 主题切换 / 改主题色时重绘（无动画，避免重播入场动画）
function onThemeChange() {
	render(false);
}

onMount(() => {
	window.addEventListener("theme-change", onThemeChange);
	themeObserver = new MutationObserver(onThemeChange);
	themeObserver.observe(document.documentElement, {
		attributes: true,
		attributeFilter: ["class", "data-theme", "style"],
	});
});

onDestroy(() => {
	window.removeEventListener("theme-change", onThemeChange);
	themeObserver?.disconnect();
	chart?.destroy();
});
</script>

<div class="relative w-full" style={`height: ${height}px;`}>
	<canvas bind:this={canvas}></canvas>
	{#if series.every((item) => item.data.length === 0)}
		<div
			class="absolute inset-0 flex items-center justify-center text-sm text-neutral-400 dark:text-neutral-500"
		>
			暂无数据
		</div>
	{/if}
</div>
