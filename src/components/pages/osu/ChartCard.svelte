<script lang="ts">
import LineChart from "@/components/common/LineChart.svelte";

// osu 历史图表的卡片外壳：只负责标题/描述/单位与数据映射，
// 图表本身（chart.js、主题色、坐标轴留白、tooltip…）全部复用通用组件 LineChart。
interface Props {
	title: string;
	description: string;
	unit: string;
	history: Array<Record<string, number | string>>;
	dataKey: string;
	valueFormat?: "integer" | "decimal" | "compact";
	suffix?: string;
	/** 排名类数据用反向 Y 轴（数值越小越好） */
	reverse?: boolean;
	/** 排名类数据从坐标轴起点填充 */
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

const dateFormatter = new Intl.DateTimeFormat("en-US", {
	month: "short",
	day: "numeric",
});

const labels = $derived(
	history.map((item) => dateFormatter.format(new Date(item.timestamp))),
);

const values = $derived(history.map((item) => Number(item[dataKey])));
</script>

<article class={wide ? "@xl:col-span-2" : ""}>
	<div class="card-base p-4">
		<div class="mb-2 flex items-center justify-between">
			<div>
				<h4 class="mb-0.5 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
					{title}
				</h4>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">
					{description}
				</p>
			</div>
			<span class="text-xs text-neutral-500 dark:text-neutral-400">
				{unit}
			</span>
		</div>

		<LineChart
			{labels}
			series={[{ label: title, data: values, fill: true }]}
			{valueFormat}
			{suffix}
			{reverse}
			height={192}
			fillMode={fillBelow ? "start" : "origin"}
			{yMin}
			{yMax}
		/>
	</div>
</article>
