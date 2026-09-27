/// <reference types="mdast" />
import { h } from "hastscript";
import {
	difficultyColour,
	difficultyTextColour,
} from "../components/pages/osu/score-visuals.ts";
import beatmapCardData from "../constants/beatmap-card-data.json" with {
	type: "json",
};

/**
 * 谱面卡片（对应正文里的 `::beatmap{id=123456}`）
 *
 * 数据来自构建期脚本写出的 beatmap-card-data.json，所以这里只做「查表 + 拼 HTML」，
 * 没有任何运行时请求。样式在 src/styles/beatmap-card.css 的 .card-beatmap 一节。
 *
 * 卡片必须带 no-styling：markdown.css 里 `a:not(.no-styling)` 会给正文链接在
 * hover 时加 `border-bottom: 1px dashed`，而卡片是整块的 <a>——那条边框会撑高
 * 卡片，hover 时把下面所有内容顶下去（实测 +0.8px）。
 * Firefly 的 GitHub 卡片同样靠这个类豁免。
 *
 * @param {Object} properties - 指令属性
 * @param {string} properties.id - beatmapset id
 * @param {import('mdast').RootContent[]} children - 指令子节点（必须是叶子指令）
 * @returns {import('mdast').Parent} 渲染出的卡片节点
 */

// 谱面状态标签与配色。颜色取自 osu!lazer 的 OsuColour.ForBeatmapSetOnlineStatus，
// 只有 graveyard 把它原本的纯黑换成可读的灰（黑字压在封面上看不见）。
const STATUS = {
	ranked: { label: "Ranked", color: "#b3ff66" },
	approved: { label: "Approved", color: "#b3ff66" },
	qualified: { label: "Qualified", color: "#66ccff" },
	loved: { label: "Loved", color: "#ff66ab" },
	pending: { label: "Pending", color: "#ffd966" },
	wip: { label: "WIP", color: "#ff9966" },
	graveyard: { label: "Graveyard", color: "#9aa4ad" },
};

function formatLength(seconds) {
	if (!Number.isFinite(seconds) || seconds <= 0) return "—";
	const total = Math.round(seconds);
	const m = Math.floor(total / 60);
	const s = total % 60;
	return `${m}:${String(s).padStart(2, "0")}`;
}

function formatBpm(bpm) {
	if (!Number.isFinite(bpm) || bpm <= 0) return "—";
	return Number.isInteger(bpm) ? String(bpm) : bpm.toFixed(1);
}

function invalid(reason) {
	return h(
		"div",
		{ class: "hidden" },
		`Invalid beatmap directive. (${reason})`,
	);
}

/**
 * 四个模式的极简几何图标（手绘，非 osu! 官方资源）
 * 每个图标是一组 [标签, 属性] ，统一在 24×24 画布上，颜色跟随 currentColor。
 */
const MODE_ICONS = {
	// 打击圈：外环 + 中心点
	osu: [
		["circle", { cx: 12, cy: 12, r: 9, fill: "none", stroke: "currentColor", "stroke-width": 2 }],
		["circle", { cx: 12, cy: 12, r: 6, fill: "currentColor" }],
	],
	// 太鼓：鼓身（胶囊）+ 中心音符
	taiko: [
		["rect", { x: 2, y: 7, width: 20, height: 10, rx: 5, fill: "none", stroke: "currentColor", "stroke-width": 2 }],
		["circle", { cx: 12, cy: 12, r: 2.8, fill: "currentColor" }],
	],
	// 接水果：水果 + 接盘
	catch: [
		["circle", { cx: 12, cy: 9.5, r: 5.5, fill: "currentColor" }],
		["rect", { x: 2.5, y: 17, width: 19, height: 3.5, rx: 1.75, fill: "currentColor" }],
	],
	// 下落式：四条轨道
	mania: [
		["rect", { x: 1.6, y: 4, width: 4, height: 16, rx: 1.5, fill: "currentColor" }],
		["rect", { x: 7.2, y: 4, width: 4, height: 16, rx: 1.5, fill: "currentColor" }],
		["rect", { x: 12.8, y: 4, width: 4, height: 16, rx: 1.5, fill: "currentColor" }],
		["rect", { x: 18.4, y: 4, width: 4, height: 16, rx: 1.5, fill: "currentColor" }],
	],
};

/** 圆角星星，与成绩卡片的 material-symbols:star-rounded 是同一个图形 */
const STAR_PATH =
	"m12 17.275l-4.15 2.5q-.275.175-.575.15t-.525-.2t-.35-.437t-.05-.588l1.1-4.725L3.775 10.8q-.25-.225-.312-.513t.037-.562t.3-.45t.55-.225l4.85-.425l1.875-4.45q.125-.3.388-.45t.537-.15t.537.15t.388.45l1.875 4.45l4.85.425q.35.05.55.225t.3.45t.038.563t-.313.512l-3.675 3.175l1.1 4.725q.075.325-.05.588t-.35.437t-.525.2t-.575-.15z";

/** 拼一个内联 SVG；HTML 解析器会自动给 svg 子树加上命名空间，所以不需要额外处理 */
function svgEl(shapes) {
	return h(
		"svg",
		{
			xmlns: "http://www.w3.org/2000/svg",
			viewBox: "0 0 24 24",
			"aria-hidden": "true",
		},
		shapes.map(([tag, props]) => h(tag, props)),
	);
}

/** 按模式分组，保持原有顺序（diffs 已按星级升序） */
function groupByMode(diffs) {
	const groups = new Map();
	for (const diff of diffs) {
		const mode = MODE_ICONS[diff.mode] ? diff.mode : "osu";
		if (!groups.has(mode)) groups.set(mode, []);
		groups.get(mode).push(diff);
	}
	return [...groups.entries()];
}

/**
 * 难度概览条：每个模式一组 = 模式图标 + 一排竖胶囊，
 * 胶囊颜色就是该难度在 osu-web 难度色带上的颜色。
 * 纯图形，信息由下拉菜单里的文字承载，所以这里 aria-hidden。
 */
function difficultyBar(diffs) {
	return h(
		"div",
		{ class: "bm-diffbar", "aria-hidden": "true" },
		groupByMode(diffs).map(([mode, list]) =>
			h("span", { class: "bm-diffbar-group" }, [
				svgEl(MODE_ICONS[mode]),
				h(
					"span",
					{ class: "bm-diffbar-bars" },
					list.map((diff) =>
						h("span", {
							class: "bm-diffbar-bar",
							style: `background-color:${difficultyColour(diff.stars)};`,
						}),
					),
				),
			]),
		),
	);
}

/**
 * 一个难度行：模式图标 | 星级胶囊（带圆角星星）| 难度名
 * 不再显示时长与 AR / OD / HP / CS。
 */
function difficultyRow(diff) {
	const starText = Number(diff.stars).toFixed(2);
	const mode = MODE_ICONS[diff.mode] ? diff.mode : "osu";

	return h("div", { class: "bm-diff" }, [
		h("span", { class: "bm-diff-mode" }, svgEl(MODE_ICONS[mode])),
		h(
			"span",
			{
				class: "bm-diff-star",
				style: `background-color:${difficultyColour(diff.stars)};color:${difficultyTextColour(diff.stars)};`,
			},
			[svgEl([["path", { d: STAR_PATH, fill: "currentColor" }]]), starText],
		),
		h("span", { class: "bm-diff-name" }, diff.name),
	]);
}

export function BeatmapCardComponent(properties, children) {
	if (Array.isArray(children) && children.length !== 0) {
		return invalid('"beatmap" 必须是叶子指令，形如 ::beatmap{id=123456}');
	}

	const id = Number(properties?.id);
	if (!Number.isInteger(id) || id <= 0) {
		return invalid('缺少合法的 "id" 属性');
	}

	const data = beatmapCardData[String(id)] ?? null;

	// 抓取失败或还没跑脚本时，给一张只有链接的兜底卡片，而不是让整页渲染失败
	if (!data) {
		return h(
			"a",
			{
				class: "card-beatmap card-beatmap--fallback no-styling",
				href: `https://osu.ppy.sh/beatmapsets/${id}`,
				target: "_blank",
				rel: "noopener noreferrer",
			},
			[
				h("div", { class: "bm-body" }, [
					h("div", { class: "bm-title" }, `Beatmapset #${id}`),
					h(
						"div",
						{ class: "bm-artist" },
						"元数据尚未抓取（运行 pnpm beatmaps 生成缓存）",
					),
				]),
			],
		);
	}

	const status = STATUS[data.status] ?? {
		label: data.status || "Unknown",
		color: "#9aa4ad",
	};

	const diffs = Array.isArray(data.diffs) ? data.diffs : [];
	const longest = diffs.reduce((max, d) => Math.max(max, d.length || 0), 0);

	// 元信息行：时长 / BPM / 难度概览条
	const metaChildren = [
		h("span", { class: "bm-chip" }, formatLength(longest)),
		h("span", { class: "bm-chip" }, `${formatBpm(data.bpm)} BPM`),
		diffs.length
			? difficultyBar(diffs)
			: h("span", { class: "bm-chip" }, "暂无难度数据"),
	];

	return h(
		"a",
		{
			class: "card-beatmap no-styling",
			href: `https://osu.ppy.sh/beatmapsets/${data.id}`,
			target: "_blank",
			rel: "noopener noreferrer",
		},
		[
			// 封面与遮罩各自成层，卡片本身不设 overflow:hidden，
			// 这样难度浮层才能溢出到卡片下方而不裁切
			data.cover
				? h("div", {
						class: "bm-cover",
						style: `background-image:url("${data.cover}");`,
					})
				: null,
			h("div", { class: "bm-scrim" }),
			h("div", { class: "bm-body" }, [
				h("div", { class: "bm-head" }, [
					h("div", { class: "bm-titles" }, [
						h("div", { class: "bm-title" }, data.title || "Unknown title"),
						h(
							"div",
							{ class: "bm-artist" },
							[
								data.artist || "Unknown artist",
								data.creator
									? h(
											"span",
											{ class: "bm-mapper" },
											` · mapped by ${data.creator}`,
										)
									: null,
							].filter(Boolean),
						),
					]),
					h(
						"span",
						{
							class: "bm-status",
							// 只暴露成 CSS 变量：亮/暗主题下状态色的用法不同
							// （亮色当底色、暗色当文字色），直接写 color 会被内联优先级压过主题样式
							style: `--status-color:${status.color};`,
						},
						status.label,
					),
				]),
				h(
					"div",
					{ class: "bm-meta" },
					metaChildren,
				),
			]),
			diffs.length
				? h(
						"div",
						{ class: "bm-diffs" },
						diffs.map((diff) =>
							difficultyRow({
								...diff,
								// 星级为 0 的难度（未定星级）按最低档上色
								stars: Number.isFinite(diff.stars) ? diff.stars : 0,
							}),
						),
					)
				: null,
		].filter(Boolean),
	);
}
