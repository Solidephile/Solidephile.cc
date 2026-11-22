/**
 * 歌词解析：增强 LRC
 *
 * 设计原则是「标准 LRC 是它的子集」：完全不写任何扩展标记的 .lrc 也能直接解析，
 * 想加逐字/颜色/翻译时再往行里插标记。
 *
 *   [00:12.34]僕らのLIVE 君とのLIFE          行时间
 *   [00:12.34]僕ら<00:12.72>の LIVE          <mm:ss.xx> = 逐字时间，写在「从这个时刻
 *                                            开始唱」的字/词前面
 *   [00:12.34]{c:#e8536f}红色文字            {c:#hex} = 从这里开始换色，直到下一个
 *                                            {c:} 或行尾（不需要闭合标签）
 *   [00:12.34]正文{tr:翻译}                  {tr:…} = 整行翻译，渲染时会被摘掉
 *
 * 另外两条容错：
 *   - 一行可以有多个 [时间] 标签（副歌复用同一句），会展开成多行；
 *   - 传统双语 LRC（两句同一时间戳、都没写 {tr:}）会把后一句当成前一句的翻译。
 *
 * 分隔符同时接受 `.` 和 `:`（后者是老式写法），小数位 1~3 位都行。
 *
 * 以后要加别的文本样式：给 LyricSpan 加字段 + 在 parseBody 的 {tag} 分支里多认
 * 一个 key，渲染侧再读它即可。
 */

/** 一行歌词里的一段文字（逐字 / 换色的最小单元） */
export type LyricSpan = {
	text: string;
	/**
	 * 这一段开始唱的时间（秒）。
	 * null = 这一段没有逐字时间，跟随整行时间（即整行一起点亮）。
	 */
	t: number | null;
	/** 这一段自己的颜色（#rgb / #rrggbb）；空串表示跟随行色 / 主题色 */
	color: string;
};

export type LyricLine = {
	/** 整行开始时间（秒） */
	t: number;
	/** 去掉所有标记后的纯文本 */
	text: string;
	/** 翻译；空串表示没有 */
	translation: string;
	/** 整行颜色（行首第一个 {c:} 视为整行色）；空串表示用主题色 */
	color: string;
	/** 逐字 / 换色片段，至少一段 */
	spans: LyricSpan[];
};

/**
 * 歌词感知提前量（毫秒）。
 *
 * 渲染时把播放时间整体往前推一点，让高亮和滚动略早于歌声。`.lrc` 里存的是音频
 * 真实时间（本地曲目直接取谱面的 note 时间），提前量只在渲染侧生效、不进文件：
 * 文件时间能和 `?debug=1` 的播放位置直接对照，不同来源的歌词也不会各自差一个偏移。
 *
 * 单曲页（`LyricsView`）和导航栏那份播放器共用这一个值——后者通过
 * `MusicPlayer.astro` 的 `define:vars` 拿到，别在 inline 脚本里另写一个数字。
 */
export const LYRIC_LEAD_MS = 300;

const LINE_TAG_RE = /^\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/;
const WORD_TAG_RE = /^<(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?>/;

function toSeconds(minute: string, second: string, fraction?: string): number {
	const tail = fraction
		? Number.parseInt(fraction, 10) / 10 ** fraction.length
		: 0;

	return Number.parseInt(minute, 10) * 60 + Number.parseInt(second, 10) + tail;
}

type Body = Omit<LyricLine, "t">;

/** 解析一行去掉时间标签之后的正文 */
function parseBody(raw: string): Body {
	const spans: LyricSpan[] = [];
	let translation = "";
	let lineColor = "";
	let color = "";
	/** 下一个 <time> 标记，只作用于紧随其后的那一段 */
	let pendingTime: number | null = null;
	let buffer = "";

	const flush = (): void => {
		if (!buffer) return;
		spans.push({ text: buffer, t: pendingTime, color });
		buffer = "";
		pendingTime = null;
	};

	let index = 0;
	while (index < raw.length) {
		const char = raw[index];

		if (char === "<") {
			const match = WORD_TAG_RE.exec(raw.slice(index));
			if (match) {
				flush();
				pendingTime = toSeconds(match[1], match[2], match[3]);
				index += match[0].length;
				continue;
			}
		}

		if (char === "{") {
			const close = raw.indexOf("}", index);
			if (close > index) {
				const tag = raw.slice(index + 1, close).trim();
				const cut = tag.indexOf(":");
				const key = (cut >= 0 ? tag.slice(0, cut) : "").trim().toLowerCase();
				const value = cut >= 0 ? tag.slice(cut + 1).trim() : "";

				if (key === "tr") {
					translation = translation ? `${translation} ${value}` : value;
					index = close + 1;
					continue;
				}

				if (key === "c") {
					flush();
					color = value;
					// 出现在任何文字之前的第一个换色标记，同时当作整行色
					if (!lineColor && spans.length === 0) lineColor = value;
					index = close + 1;
					continue;
				}
			}
		}

		buffer += char;
		index += 1;
	}
	flush();

	// 去掉行首行尾空白（中间的空格要保留）
	while (spans.length > 0 && spans[0].text.trim() === "") spans.shift();
	if (spans.length > 0) spans[0].text = spans[0].text.replace(/^\s+/, "");

	while (spans.length > 0) {
		const last = spans[spans.length - 1];
		if (last.text.trim() !== "") break;
		spans.pop();
	}
	if (spans.length > 0) {
		const last = spans[spans.length - 1];
		last.text = last.text.replace(/\s+$/, "");
	}

	return {
		text: spans.map((span) => span.text).join(""),
		translation,
		color: lineColor,
		spans,
	};
}

/**
 * 解析整份歌词。
 *
 * @param raw .lrc 原文
 */
export function parseLrc(raw: string): LyricLine[] {
	const parsed: LyricLine[] = [];

	for (const source of raw.split(/\r?\n/)) {
		const text = source.trim();
		if (!text) continue;

		// 收集行首连续的时间标签（同一句歌词可以挂在多个时间戳上）
		const times: number[] = [];
		let rest = text;
		for (;;) {
			const match = LINE_TAG_RE.exec(rest);
			if (!match) break;
			times.push(toSeconds(match[1], match[2], match[3]));
			rest = rest.slice(match[0].length);
		}

		// [ti:] / [ar:] / [al:] / [by:] / [offset:] 之类没有时间戳的行直接跳过
		if (times.length === 0) continue;

		const body = parseBody(rest);
		if (body.text === "" && body.translation === "") continue;

		for (const t of times) {
			parsed.push({
				t,
				...body,
				spans: body.spans.map((s) => ({ ...s })),
			});
		}
	}

	parsed.sort((a, b) => a.t - b.t);

	// 双语 LRC 的常见写法：同一时间戳两句，后一句其实是翻译
	const lines: LyricLine[] = [];
	for (const line of parsed) {
		const prev = lines[lines.length - 1];
		const sameTime = prev !== undefined && Math.abs(prev.t - line.t) < 0.001;
		if (prev && sameTime && !prev.translation && line.text !== "") {
			prev.translation = line.text;
			continue;
		}
		lines.push(line);
	}

	return lines;
}

/** 当前时间落在第几行（-1 表示还没到第一行）；二分查找，逐帧调用也便宜 */
export function findActiveIndex(lines: LyricLine[], time: number): number {
	let low = 0;
	let high = lines.length - 1;
	let found = -1;

	while (low <= high) {
		const mid = (low + high) >> 1;
		if (lines[mid].t <= time) {
			found = mid;
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}

	return found;
}

/**
 * 这一行到 time 为止已经「唱到」第几段（返回已唱段数）。
 * 整行都没有逐字时间时返回总段数，相当于整行一起点亮。
 */
export function sungSpanCount(line: LyricLine, time: number): number {
	let count = 0;
	for (const span of line.spans) {
		if (span.t === null || span.t <= time) count += 1;
		else break;
	}

	return count;
}
