<script lang="ts">
import {
	Chart,
	CategoryScale,
	LinearScale,
	LineController,
	PointElement,
	LineElement,
	Tooltip,
	Filler,
} from "chart.js";
import { onMount, onDestroy } from "svelte";

Chart.register(LineController, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Filler);


interface Props {
	title: string;
	description: string;
	unit: string;
	history: Array<Record<string, number | string>>;
	dataKey: string;
	valueFormat?: string;
	suffix?: string;
	reverse?: boolean;
	fillBelow?: boolean;
	wide?: boolean;
	yMin?: number;
	yMax?: number;
}

let {
	title,
	description,
	unit,
	history,
	dataKey,
	valueFormat = "compact",
	suffix = "",
	reverse = false,
	fillBelow = false,
	wide = false,
	yMin,
	yMax,
}: Props = $props();

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
		const p = rgb[1].split(/[\s,/]+/).filter(Boolean);
		if (p.length >= 3) {
			return `rgba(${p[0]}, ${p[1]}, ${p[2]}, ${alpha})`;
		}
	}

	if (/^(oklch|oklab|hsl|hwb|lab|lch|color)\(/i.test(c)) {
		return c.includes("/")
			? c.replace(/\/[^)]*\)$/, `/ ${alpha})`)
			: c.replace(/\)$/, ` / ${alpha})`);
	}

	return c;
}

// 折线下方填充的渐变端点透明度：顶部较浓、底部透明（可自行调整这两个值）
const FILL_ALPHA_TOP = 0.4;
const FILL_ALPHA_BOTTOM = 0.05;

// 图表用到的颜色，全部来自主题变量，随亮暗主题与主题色变化
function themeColors() {
	const primary = readVar("--primary", "#ff66ab");
	return {
		primary,
		fillTop: withAlpha(primary, FILL_ALPHA_TOP),
		fillBottom: withAlpha(primary, FILL_ALPHA_BOTTOM),
		tick: readVar("--content-meta", "rgba(0, 0, 0, 0.7)"),
		grid: readVar("--line-divider", "rgba(0, 0, 0, 0.08)"),
		tooltipBg: readVar("--float-panel-bg", "rgba(20, 17, 24, 0.96)"),
	};
}

let canvas: HTMLCanvasElement;
let chart: Chart | undefined;
let themeObserver: MutationObserver | undefined;

function formatDate(timestamp: string | number) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "numeric",
	}).format(new Date(timestamp));
}

function formatValue(value: number) {
	if (valueFormat === "integer") {
		return Math.round(value).toLocaleString("en-US");
	}
	if (valueFormat === "decimal") {
		return Number(value).toLocaleString("en-US", {
			minimumFractionDigits: 2,
			maximumFractionDigits: 2,
		});
	}
	return Number(value).toLocaleString("en-US", {
		notation: "compact",
		maximumFractionDigits: 2,
	});
}

// Y 轴范围：在数据极值上下各留出内边距，避免最大/最小值的数据点贴边被裁掉一半
function getChartRange(
	values: number[],
	paddingRatio = 0.08,
	minimumPadding = 1,
) {
	const minValue = Math.min(...values);
	const maxValue = Math.max(...values);

	if (minValue === maxValue) {
		return {
			min: minValue - minimumPadding,
			max: maxValue + minimumPadding,
		};
	}

	const padding = Math.max(
		(maxValue - minValue) * paddingRatio,
		minimumPadding,
	);

	return { min: minValue - padding, max: maxValue + padding };
}

function createChart(animate: boolean) {
	const values = history.map((item) => Number(item[dataKey]));
	const labels = history.map((item) => formatDate(item.timestamp));

	// 未显式指定范围时，自动在数据极值上下留白
	let min = yMin;
	let max = yMax;
	if (min === undefined || max === undefined) {
		const range = getChartRange(values, 0.08, 1);
		min = range.min;
		max = range.max;
	}

	const c = themeColors();

	return new Chart(canvas, {
		type: "line",
		data: {
			labels,
			datasets: [
				{
					label: title,
					data: values,
					borderColor: c.primary,
					borderWidth: 2,
					pointRadius: history.length <= 20 ? 3 : 0,
					pointHoverRadius: 5,
					pointBackgroundColor: c.primary,
					pointBorderWidth: 0,
					tension: 0.32,
					fill: fillBelow ? "start" : "origin",
					backgroundColor: (context) => {
						const ch = context.chart;
						const { chartArea } = ch;
						if (!chartArea) return c.fillTop;
						const gradient = ch.ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
						gradient.addColorStop(0, c.fillTop);
						gradient.addColorStop(1, c.fillBottom);
						return gradient;
					},
				},
			],
		},
		options: {
			responsive: true,
			maintainAspectRatio: false,
			animation: animate ? { duration: 500 } : false,
			interaction: { mode: "index", intersect: false },
			plugins: {
				legend: { display: false },
				tooltip: {
					displayColors: false,
					backgroundColor: c.tooltipBg,
					borderColor: c.grid,
					borderWidth: 1,
					titleColor: c.tick,
					bodyColor: c.tick,
					padding: 10,
					cornerRadius: 10,
					callbacks: {
						label: (ctx) => `${title}：${formatValue(ctx.parsed.y)}${suffix}`,
					},
				},
			},
			scales: {
				x: {
					grid: { display: false },
					border: { display: false },
					ticks: { color: c.tick, maxTicksLimit: 7, font: { size: 10 } },
				},
				y: {
					reverse,
					min,
					max,
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

// 主题切换（含手动改主题色）后重建图表，让颜色跟随 CSS 变量
function onThemeChange() {
	if (!canvas) return;
	chart?.destroy();
	chart = createChart(false);
}

onMount(() => {
	chart = createChart(true);

	// 与 Firefly WavesEffect 一致：theme-change 事件 + MutationObserver 兜底
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

<article class={wide ? "md:col-span-2" : ""}>
	<div class="card-base p-4">
		<div class="mb-2 flex items-center justify-between">
			<div>
				<h4 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{title}</h4>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">{description}</p>
			</div>
			<span class="text-xs text-neutral-500 dark:text-neutral-400">{unit}</span>
		</div>
		<div class="relative h-48">
			<canvas bind:this={canvas}></canvas>
		</div>
	</div>
</article>
