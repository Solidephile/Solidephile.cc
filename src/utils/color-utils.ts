/**
 * 颜色工具：把站点的现代颜色语法转成 canvas 一定认得的形式。
 *
 * canvas 的 `fillStyle` 只保证支持传统颜色写法；对 `oklch()` 这类新语法，
 * 有些引擎（或某些版本）会**静默忽略**——赋值不生效、颜色停在旧值。
 * 表现出来就是「改了主题色，画布里的颜色没变」，而且没有任何报错可查。
 *
 * 这里只处理站点实际会用到的 `oklch()`（`--primary` 等全站变量都是这个形式），
 * 其它写法原样返回，交给调用方去试。
 */

/**
 * `oklch(L C H[ / A])` → `rgb(r g b[ / a])`。
 *
 * L / C 支持百分比写法（CSS Color 4：C 的 100% 等于 0.4），H 可带 `deg`，
 * 可选 alpha。解析不了（不是 oklch 或写法不认识）返回 null。
 */
export function oklchToRgb(input: string): string | null {
	const match =
		/^oklch\(\s*([0-9.]+)(%?)\s+([0-9.]+)(%?)\s+([0-9.]+)(?:deg)?\s*(?:\/\s*([0-9.]+)(%?)\s*)?\)$/i.exec(
			input.trim(),
		);
	if (!match) return null;

	const lightness = match[2] ? Number(match[1]) / 100 : Number(match[1]);
	const chroma = match[4] ? (Number(match[3]) / 100) * 0.4 : Number(match[3]);
	const hue = (Number(match[5]) * Math.PI) / 180;

	// oklch → oklab
	const a = chroma * Math.cos(hue);
	const b = chroma * Math.sin(hue);

	// oklab → linear sRGB（Björn Ottosson 的系数）
	const lRoot = lightness + 0.3963377774 * a + 0.2158037573 * b;
	const mRoot = lightness - 0.1055613458 * a - 0.0638541728 * b;
	const sRoot = lightness - 0.0894841775 * a - 1.291485548 * b;

	const l = lRoot ** 3;
	const m = mRoot ** 3;
	const s = sRoot ** 3;

	const linearR = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
	const linearG = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
	const linearB = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

	const toChannel = (value: number): number => {
		const encoded =
			value <= 0.0031308 ? 12.92 * value : 1.055 * value ** (1 / 2.4) - 0.055;
		return Math.round(Math.min(1, Math.max(0, encoded)) * 255);
	};

	let alpha: string | null = null;
	if (match[6] !== undefined) {
		const parsed = match[7] ? Number(match[6]) / 100 : Number(match[6]);
		alpha = String(Math.min(1, Math.max(0, parsed)));
	}

	const rgb = `${toChannel(linearR)} ${toChannel(linearG)} ${toChannel(linearB)}`;

	return alpha === null ? `rgb(${rgb})` : `rgb(${rgb} / ${alpha})`;
}

/** 给 canvas 用的颜色：能转成 rgb 就转，转不了原样返回 */
export function toCanvasColor(color: string): string {
	return oklchToRgb(color) ?? color;
}
