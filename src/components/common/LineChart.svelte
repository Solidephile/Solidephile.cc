<script lang="ts">
import {
	CategoryScale,
	Chart,
	Filler,
	Legend,
	LineController,
	LineElement,
	LinearScale,
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

/* ---------- 主题色：读取 Firefly 的 CSS 变量 ---------- */

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

function getRange() {
	if (yMin !== undefined && yMax !== undefined) {
		return { min: yMin, max: yMax };
	}

	const values = series
		.flatMap((item) => item.data)
		.map(Number)
		.filter(Number.isFinite);

	if (values.length === 0) {
		return { min: 0, max: 1 };
	}

	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);

	if (minValue === maxValue) {
		const lower = clampZero
			? Math.max(0, minValue - minPadding)
			: minValue - minPadding;
		return { min: lower, max: maxValue + minPadding };
	}

	const padding = Math.max((maxValue - minValue) * paddingRatio, minPadding);
	const lower = clampZero
		? Math.max(0, minValue - padding)
		: minValue - padding;

	return { min: yMin ?? lower, max: yMax ?? maxValue + padding };
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
					pointBorderWidth: 0,
					tension: 0.32,
					fill: item.fill ? fillMode : false,
					backgroundColor: item.fill
						? (context: { chart: Chart }) => {
								const chartRef = context.chart;
								const { chartArea } = chartRef;
								if (!chartArea) return withAlpha(color, 0.25);

								const gradient = chartRef.ctx.createLinearGradient(
									0,
									chartArea.top,
									0,
									chartArea.bottom,
								);
								gradient.addColorStop(0, withAlpha(color, 0.25));
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
					ticks: { color: c.tick, maxTicksLimit: 8, font: { size: 10 } },
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
