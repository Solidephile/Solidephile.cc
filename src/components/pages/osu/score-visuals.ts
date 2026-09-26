/**
 * 成绩卡的视觉映射表
 *
 * 两套映射都取自 osu! Expert+，其数值对齐 osu!web 官方实现：
 * - 难度色带：对应 osu-web 的 `getDiffColour` / `getDiffTextColour`
 * - mod 配色：按「降低难度 / 提升难度 / 中性」三档，而不是每个 mod 一个品牌色
 */

// ── 难度色带 ────────────────────────────────────────────

/** 底色色带的锚点（星级） */
const DIFF_DOMAIN = [0.1, 1.25, 2, 2.5, 3.3, 4.2, 4.9, 5.8, 6.7, 7.7, 9];
/** 底色色带中每个锚点对应的颜色，与 DIFF_DOMAIN 一一对应 */
const DIFF_RANGE = [
	"#4290FB",
	"#4FC0FF",
	"#4FFFD5",
	"#7CFF4F",
	"#F6F05C",
	"#FF8068",
	"#FF4E6F",
	"#C645B8",
	"#6563DE",
	"#18158E",
	"#000000",
];

// 星级 ≥ 9 时底色固定为纯黑，osu-web 的文字色带只覆盖这一段
const TEXT_SR_DOMAIN = [9, 9.9, 10.6, 11.5, 12.4];
const TEXT_SR_RANGE = [
	"#F6F05C",
	"#FF8068",
	"#FF4E6F",
	"#C645B8",
	"#B0A8FF",
	"#E4E2FF",
];

interface Rgb {
	r: number;
	g: number;
	b: number;
}

function hexToRgb(hex: string): Rgb {
	const n = Number.parseInt(hex.slice(1), 16);
	return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function rgbToHex(r: number, g: number, b: number): string {
	const clamp = (x: number): number =>
		Math.max(0, Math.min(255, Math.round(x)));
	const parts = [clamp(r), clamp(g), clamp(b)].map((x) =>
		x.toString(16).padStart(2, "0"),
	);
	return `#${parts.join("")}`;
}

/** 在色带上按位置插值取色；落在两端之外时返回 fallback */
function sampleRamp(
	value: number,
	domain: number[],
	range: string[],
	fallback: string,
): string {
	for (let i = 0; i < domain.length - 1; i++) {
		const d0 = domain[i];
		const d1 = domain[i + 1];

		if (value >= d0 && value < d1) {
			const t = (value - d0) / (d1 - d0);
			const a = hexToRgb(range[i]);
			const b = hexToRgb(range[i + 1]);

			return rgbToHex(
				a.r + (b.r - a.r) * t,
				a.g + (b.g - a.g) * t,
				a.b + (b.b - a.b) * t,
			);
		}
	}

	return fallback;
}

/** 星级胶囊的底色；< 0.1 星为灰、≥ 9 星为黑（与 osu-web 一致） */
export function difficultyColour(stars: number): string {
	if (stars < 0.1) return "#AAAAAA";
	if (stars >= 9) return "#000000";
	return sampleRamp(stars, DIFF_DOMAIN, DIFF_RANGE, "#000000");
}

/** 星级胶囊上的文字色：≥ 6.5 星起换成浅色带，保证在深底色上可读 */
export function difficultyTextColour(stars: number): string {
	if (stars < 6.5) return "#000000";
	if (stars < 9) return "#F6F05C";
	if (stars >= 12.4) return "#E4E2FF";
	return sampleRamp(stars, TEXT_SR_DOMAIN, TEXT_SR_RANGE, "#E4E2FF");
}

// ── mod 配色 ────────────────────────────────────────────

/** 降低难度的 mod */
const MOD_REDUCTION = new Set(["EZ", "NF", "HT", "DC", "NR", "SO", "MU"]);

/** 提升难度的 mod */
const MOD_INCREASE = new Set([
	"HR",
	"SD",
	"PF",
	"DT",
	"NC",
	"HD",
	"FL",
	"FI",
	"BL",
	"DA",
	"AC",
	"WU",
	"WD",
	"DF",
	"TC",
	"SV2",
	"NS",
	"TP",
	"MF",
	"MG",
	"AD",
	"AS",
	"CS",
	"DS",
	"RD",
	"SI",
	"ST",
	"SY",
	"TD",
	"BM",
	"CO",
	"DP",
	"FR",
	"GR",
	"IN",
	"MR",
	"RP",
	"SW",
	"TR",
	"WG",
	"BR",
	"BU",
]);

/** mod 对成绩的影响档位 */
export type ModTone = "reduce" | "increase" | "plain";

/** mod 缩写 → 档位；未收录的（含转换类 CL）一律中性 */
export function modTone(acronym: string): ModTone {
	const key = acronym.toUpperCase();
	if (MOD_REDUCTION.has(key)) return "reduce";
	if (MOD_INCREASE.has(key)) return "increase";
	return "plain";
}
