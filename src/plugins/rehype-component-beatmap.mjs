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

/** 一个难度行：名字 + 星级胶囊 + 关键参数 */
function difficultyRow(diff) {
	const starText = Number(diff.stars).toFixed(2);
	const extras = [
		diff.ar !== null && diff.ar !== undefined ? `AR${diff.ar}` : null,
		diff.od !== null && diff.od !== undefined ? `OD${diff.od}` : null,
		diff.hp !== null && diff.hp !== undefined ? `HP${diff.hp}` : null,
		diff.cs !== null && diff.cs !== undefined ? `CS${diff.cs}` : null,
	]
		.filter(Boolean)
		.join(" · ");

	// 非 std 难度标一下模式，避免和 std 星级混在一起看
	const modeTag = diff.mode && diff.mode !== "osu" ? diff.mode : null;

	return h("div", { class: "bm-diff" }, [
		h(
			"span",
			{ class: "bm-diff-name" },
			[
				modeTag ? h("span", { class: "bm-diff-mode" }, modeTag) : null,
				diff.name,
			].filter(Boolean),
		),
		h(
			"span",
			{
				class: "bm-diff-star",
				style: `background-color:${difficultyColour(diff.stars)};color:${difficultyTextColour(diff.stars)};`,
			},
			starText,
		),
		h("span", { class: "bm-diff-extra" }, extras || "—"),
		h("span", { class: "bm-diff-length" }, formatLength(diff.length)),
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
	const starMin = diffs.length ? Math.min(...diffs.map((d) => d.stars)) : 0;
	const starMax = diffs.length ? Math.max(...diffs.map((d) => d.stars)) : 0;

	const chips = [
		formatLength(longest),
		`${formatBpm(data.bpm)} BPM`,
		diffs.length
			? `${diffs.length} 难度 · ${starMin.toFixed(2)}★ ~ ${starMax.toFixed(2)}★`
			: "暂无难度数据",
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
							style: `color:${status.color};border-color:${status.color};`,
						},
						status.label,
					),
				]),
				h(
					"div",
					{ class: "bm-meta" },
					chips.map((text) => h("span", { class: "bm-chip" }, text)),
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
