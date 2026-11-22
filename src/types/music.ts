/**
 * 音乐相关的类型
 *
 * `MusicTrack` 是「一首歌」的唯一形状：播放器、索引页、单曲页都用它。
 *
 * 引擎（`MusicManager` 里那段 `is:inline` 脚本）内部仍用 `name / artist / url / pic`
 * 那套旧字段名，那是它的私有协议——只在 `player.svelte.ts` 的 `fromManager` /
 * `toManager` 与 `MusicManager.astro` 的 props 映射里出现，不要扩散到外面。
 */

/** 一首歌 */
export type MusicTrack = {
	title: string;
	artist: string;
	/** 音频地址（本地曲目在 R2，网易云是 CDN 直链） */
	audio: string;
	/** 封面地址 */
	cover: string;
	/** 时长（秒）；0 表示未知（网易云的曲目没有） */
	duration: number;
	/**
	 * 节拍：BPM 与第一拍在音频时间轴上的位置（秒）。
	 * 只有本地曲目有；缺省表示没有节拍信息，节拍特效自然停用。
	 */
	bpm?: number;
	offset?: number;
	/**
	 * 原始 `.lrc` 文本（可以是增强格式）。导航栏那份播放器用它在运行时取歌词，
	 * 解析统一在页面控制器里做（见 player.svelte.ts 的 fm:lyrics-raw）。
	 */
	lrc?: string;
	/** 本地曲目的路由 slug；网易云没有单曲页 */
	slug?: string;
};

/** 本地曲目：内容集合里的完整元数据，比分发给播放器的部分多几条内容字段 */
export type LocalMusicTrack = MusicTrack & {
	/** 发行日期 YYYY-MM-DD */
	published: string;
	category: string;
	tags: string[];
};

/**
 * 索引页的一行。
 * 不是另一种曲目：`track` 是同一个 `MusicTrack`，其余字段只是列表里额外显示的元数据
 * （网易云的行没有这些，所以都可选）。
 */
export type MusicListEntry = {
	track: MusicTrack;
	/** 发行年份（从 published 截出来） */
	year?: string;
	category?: string;
	tags?: string[];
};
