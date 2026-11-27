/**
 * 歌词解析：增强 LRC
 *
 * 设计原则是「标准 LRC 是它的子集」：不写任何扩展标记的 .lrc 也能直接解析，
 * 需要逐字、换色或翻译时再往行里插入标记。
 *
 *   [mm:ss.xx]正文                       行时间
 *   [mm:ss.xx]正文<mm:ss.xx>后续          <mm:ss.xx> = 逐字时间，写在「从这个时刻
 *                                        开始唱」的字或词前面
 *   [mm:ss.xx]正文<mm:ss.xx>              行尾单独一个时间戳、后面没有正文 = 最后
 *                                        一段的结束时间（不写则按固定时长收尾）
 *   [mm:ss.xx]{c:#hex}彩色文字            {c:#hex} = 从这里开始换色，直到下一个
 *                                        {c:} 或行尾（不需要闭合标签）
 *   [mm:ss.xx]正文{tr:翻译}               {tr:…} = 整行翻译，渲染时会被摘除
 *   [mm:ss.xx]{int:mm:ss.xx}              间奏声明：从行时间到 {int:…} 为止是间奏，
 *                                        解析时自动生成一行「• • •」（三个点依次扫过）；
 *                                        `int` 是 interlude 的缩写，也可写 interlude / intro
 *
 * 另外两条容错：
 *   - 一行可以带多个行时间标签（副歌复用同一句），展开为多行；
 *   - 传统双语 LRC（同一时间戳的两行、都没有 {tr:}）把后一行视为前一行译文。
 *
 * 分隔符同时接受 `.` 和 `:`（后者为老式写法），小数位位数不受限制，按位数换算。
 *
 * 段内的空格、标点与符号会拆到 `LyricSpan.lead` / `.tail`，不参与逐字渐变：
 * 渐变按段的宽度推进，装饰字符留在正片里会分走本该属于正片的时间。
 *
 * 新增其他文本样式时：给 `LyricSpan` 增加字段，在 `parseBody` 的标签分支里识别，
 * 再在渲染侧读取。
 */

/** 一行歌词里的一段文字（逐字与换色的最小单元） */
export type LyricSpan = {
	/** 正片文字：参与逐字渐变的片段（空格与标点已拆到 lead、tail） */
	text: string;
	/** 段首的空格、标点与符号：照常渲染，但不占用渐变时间 */
	lead: string;
	/** 段尾的空格、标点与符号：照常渲染，但不占用渐变时间 */
	tail: string;
	/**
	 * 这一段开始唱的时间（秒）。
	 * null 表示没有逐字时间，跟随整行时间。
	 */
	t: number | null;
	/** 这一段自身的颜色（十六进制）；空串表示跟随行色或主题色 */
	color: string;
};

export type LyricLine = {
	/** 整行开始时间（秒） */
	t: number;
	/**
	 * 行尾结束时间（秒）。
	 * 写法是在最后一个字之后、整行末尾单独写一个不带正文的时间戳，
	 * 表示最后一段线性填到哪个时刻；null 表示未写，由渲染侧按固定时长收尾。
	 */
	end: number | null;
	/** 去掉所有标记后的纯文本 */
	text: string;
	/** 翻译；空串表示没有 */
	translation: string;
	/** 整行颜色（行首第一个 {c:} 视为整行色）；空串表示使用主题色 */
	color: string;
	/** 逐字与换色片段，至少一段 */
	spans: LyricSpan[];
};

/**
 * 歌词感知提前量（毫秒）。
 *
 * 渲染时将播放时间整体前移，使高亮与滚动略早于歌声。`.lrc` 中保存的是音频真实时间
 * （本地曲目取自谱面的 note 时间），提前量只在渲染侧生效、不写入文件：
 * 文件时间可以直接与调试面板的播放位置对照，不同来源的歌词也不会各自偏移。
 *
 * 单曲页（`LyricsView`）与导航栏播放器共用这一个值：后者通过 `MusicPlayer.astro`
 * 的 `define:vars` 获取，不应在 inline 脚本里另写一份。
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

/** 一行解析结果：歌词正文之外，还可能带 `{int:…}` 声明的间奏结束时间 */
type ParsedBody = Body & {
	/** `{int:…}` 的结束时间（秒）；null 表示这一行不是间奏声明 */
	interludeEnd: number | null;
};

/** 一条间奏声明，最终会展开成一行「• • •」 */
type Interlude = {
	/** 开始时间（秒），即这一行的行时间 */
	start: number;
	/** 结束时间（秒），即 `{int:…}` 的值 */
	end: number;
	/** 行色；空串 = 主题色 */
	color: string;
	/** 译文（间奏行也可以带 `{tr:…}`）；空串表示没有 */
	translation: string;
};

/** 一行间奏显示几个点：与手写的 intro 行一致 */
const INTERLUDE_DOTS = 3;

/** 不参与渐变时间的「装饰字符」：空白、标点、符号（♪ 、• 之类） */
const DECO_CHAR_RE = /[\s\p{P}\p{S}]/u;

/**
 * 把一段文字拆为「前置装饰 / 正片 / 后置装饰」。
 *
 * 渲染侧只对正片做渐变填充，装饰字符不进入渐变盒子；否则渐变按段的宽度推进，
 * 正片后带全角空格或标点时，正片会提前填满、时间被装饰分走。
 * 装饰照常渲染，按段的状态整体点亮或扫过，但不占用正片的时间。
 */
function splitDeco(raw: string): { lead: string; text: string; tail: string } {
	const chars = [...raw];
	let start = 0;
	while (start < chars.length && DECO_CHAR_RE.test(chars[start])) start += 1;

	let end = chars.length;
	while (end > start && DECO_CHAR_RE.test(chars[end - 1])) end -= 1;

	return {
		lead: chars.slice(0, start).join(""),
		text: chars.slice(start, end).join(""),
		tail: chars.slice(end).join(""),
	};
}

/**
 * 解析 `{int:…}` 里的结束时间。
 *
 * 优先按 `mm:ss` / `mm:ss.xx` 时间戳解析（与行时间标签同一写法），
 * 纯数字则当作秒数，省得为了算差值手写换算。
 */
function parseTimeValue(value: string): number | null {
	const match = /^(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?$/.exec(value);
	if (match) return toSeconds(match[1], match[2], match[3]);

	const seconds = Number(value);
	return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

/**
 * 把一条间奏声明展开成一行「• • •」。
 *
 * 三个点在间奏内均分，最后一个点线性填到结束——与手写的 intro 行同一个节奏感。
 * 点作为**正片**放进来（不经过 `splitDeco`），所以逐字模式下渐变会真的从点上扫过，
 * 不会被当成标点、把时间全部让给相邻文字。
 */
function makeInterludeLine({
	start,
	end,
	color,
	translation,
}: Interlude): LyricLine {
	const step = (end - start) / INTERLUDE_DOTS;
	const spans: LyricSpan[] = [];

	for (let i = 0; i < INTERLUDE_DOTS; i += 1) {
		spans.push({
			text: "•",
			// 点之间的空格放在后一段的前导装饰里：照常渲染，但不占用渐变时间
			lead: i === 0 ? "" : " ",
			tail: "",
			t: start + i * step,
			color,
		});
	}

	return {
		t: start,
		end,
		text: spans.map((span) => span.lead + span.text + span.tail).join(""),
		translation,
		color,
		spans,
	};
}

/** 解析一行去掉时间标签之后的正文 */
function parseBody(raw: string): ParsedBody {
	const spans: LyricSpan[] = [];
	let translation = "";
	let lineColor = "";
	let color = "";
	/** 下一个 <time> 标记，只作用于紧随其后的那一段 */
	let pendingTime: number | null = null;
	let buffer = "";
	/** `{int:…}` 声明的间奏结束时间；null 表示这一行没有声明 */
	let interludeEnd: number | null = null;

	const flush = (): void => {
		if (!buffer) return;
		spans.push({ text: buffer, lead: "", tail: "", t: pendingTime, color });
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

				if (key === "int" || key === "interlude" || key === "intro") {
					const parsedEnd = parseTimeValue(value);
					if (parsedEnd !== null) interludeEnd = parsedEnd;
					index = close + 1;
					continue;
				}
			}
		}

		buffer += char;
		index += 1;
	}
	flush();

	// 行尾若只剩一个不带正文的时间戳，它就是最后一段的结束时间。
	// flush() 在推入正文时会清空 pendingTime，因此此处仍保留的值只能来自行尾标记；
	// 标记后若跟有空白，该空白会被推成一段并在下方裁掉，此时改取它的时间。
	let end: number | null = pendingTime;
	if (end === null) {
		const tail = spans[spans.length - 1];
		if (tail && tail.t !== null && tail.text.trim() === "") end = tail.t;
	}

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

	// 把空格 / 标点从「参与渐变的正片」里拆出去（渲染侧只让正片扫过）
	for (const span of spans) {
		const parts = splitDeco(span.text);
		span.lead = parts.lead;
		span.text = parts.text;
		span.tail = parts.tail;
	}

	return {
		end,
		text: spans.map((span) => span.lead + span.text + span.tail).join(""),
		translation,
		color: lineColor,
		spans,
		interludeEnd,
	};
}

/**
 * 解析整份歌词。
 *
 * @param raw .lrc 原文
 */
export function parseLrc(raw: string): LyricLine[] {
	const parsed: LyricLine[] = [];
	/** 间奏声明：正文解析完之后统一展开成「• • •」行 */
	const interludes: Interlude[] = [];

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

		// 间奏声明：只在没有正文时生效（`{tr:…}` 允许），并且只接受一个行首时间戳——
		// 一行挂多个时间戳是「副歌复用同一句」的写法，套在间奏上会把结束时间重复用
		if (body.interludeEnd !== null) {
			if (
				times.length === 1 &&
				body.text.trim() === "" &&
				body.interludeEnd > times[0]
			) {
				interludes.push({
					start: times[0],
					end: body.interludeEnd,
					color: body.color,
					translation: body.translation,
				});
			}
			continue;
		}

		if (body.text === "" && body.translation === "") continue;

		for (const t of times) {
			parsed.push({
				t,
				end: body.end,
				text: body.text,
				translation: body.translation,
				color: body.color,
				spans: body.spans.map((s) => ({ ...s })),
			});
		}
	}

	parsed.sort((a, b) => a.t - b.t);

	// 双语 LRC 的常见写法：同一时间戳的两行，后一行为前一行译文
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

	// 间奏展开：区间里已经有真实歌词时跳过（手写歌词优先），避免两种行叠在一起。
	// 结束时间正好等于下一句歌词的开始时间属于正常写法，不算重叠。
	const generated = interludes
		.filter(
			(decl) =>
				!lines.some((line) => line.t >= decl.start && line.t < decl.end),
		)
		.map(makeInterludeLine);

	if (generated.length === 0) return lines;

	return [...lines, ...generated].sort((a, b) => a.t - b.t);
}

/** 当前时间所在的行下标；返回负值表示尚未到达第一行。二分查找，逐帧调用开销足够低 */
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
