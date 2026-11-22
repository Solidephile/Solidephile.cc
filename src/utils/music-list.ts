/**
 * 本地曲目列表（构建期）
 *
 * 管理器、音乐索引页、单曲页都从这里取同一份「有序本地歌单」，
 * 顺序 = frontmatter 里的 `order` 升序（没写的排在后面），再按发行日期升序。
 * 歌词给的是 `.lrc` 原文（增强格式），解析在页面侧做，见 player.svelte.ts。
 */

import { getCollection } from "astro:content";
import type { LocalMusicTrack } from "@/types/music";

export async function getLocalMusicTracks(): Promise<LocalMusicTrack[]> {
	const lrcFiles = import.meta.glob("/src/content/music/*.lrc", {
		query: "?raw",
		import: "default",
		eager: true,
	}) as Record<string, string>;

	const entries = await getCollection("music", (entry) => !entry.data.draft);
	const rank = (entry: (typeof entries)[number]): number =>
		entry.data.order ?? Number.MAX_SAFE_INTEGER;

	return entries
		.sort(
			(a, b) =>
				rank(a) - rank(b) ||
				a.data.published.getTime() - b.data.published.getTime(),
		)
		.map((entry) => ({
			slug: entry.id,
			title: entry.data.title,
			artist: entry.data.artist,
			audio: entry.data.audio,
			cover: entry.data.cover,
			duration: entry.data.duration,
			bpm: entry.data.bpm,
			offset: entry.data.offset,
			// 增强格式原文直接给管理器：解析由页面控制器做（引擎不能 import lrc.ts）
			lrc: lrcFiles[`/src/content/music/${entry.id}.lrc`] ?? "",
			published: entry.data.published.toISOString().slice(0, 10),
			category: entry.data.category,
			tags: entry.data.tags,
		}));
}
