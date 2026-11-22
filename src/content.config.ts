import { defineCollection } from "astro:content";
import type { CollectionConfig } from "astro/content/config";
import { glob } from "astro/loaders";
import { type ZodType, z } from "astro/zod";

type PostData = {
	title: string;
	published: Date;
	updated?: Date;
	draft: boolean;
	description: string;
	image: string;
	tags: string[];
	category: string | null;
	lang: string;
	pinned: boolean;
	author: string;
	sourceLink: string;
	licenseName: string;
	licenseUrl: string;
	comment: boolean;
	password: string;
	passwordHint: string;
	series: string;
	seriesOrder?: number;
	prevTitle: string;
	prevSlug: string;
	nextTitle: string;
	nextSlug: string;
};

type DynamicData = {
	published: Date;
	pinned: boolean;
	location: string;
};

type ProjectLink = {
	label: string;
	icon: string;
	value: string;
};

type ProjectData = {
	title: string;
	published: Date;
	draft: boolean;
	order?: number;
	description: string;
	image: string;
	tags: string[];
	link: ProjectLink[];
	status: string;
	lang: string;
};

type MusicData = {
	title: string;
	artist: string;
	published: Date;
	draft: boolean;
	category: string;
	tags: string[];
	audio: string;
	cover: string;
	duration: number;
	bpm: number;
	offset: number;
	/** 手动排序号（越小越前）；不写就排在手动排过序的曲目之后 */
	order?: number;
	credits: string[];
	/** kiai 区间（秒）：这段时间光晕每拍闪一次、左右交替（非 kiai 是每 4 拍两侧同时） */
	kiai: number[][];
	/** 页面主题：强调色 + 频谱覆写 */
	theme?: {
		accent: string;
		spectrum?: {
			enable?: boolean | undefined;
			bars?: number | undefined;
			height?: number | undefined;
			color?: string | undefined;
			smoothing?: number | undefined;
			peakDecay?: number | undefined;
			floor?: number | undefined;
			curve?: number | undefined;
			fftSize?: number | undefined;
			reflect?: number | undefined;
		};
	};
};

type ContentCollection<T> = CollectionConfig<
	ZodType<T>,
	ReturnType<typeof glob>
>;

const postsCollection: ContentCollection<PostData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/posts" }),
	schema: z.object({
		title: z.string(),
		published: z.date(),
		updated: z.date().optional(),
		draft: z.boolean().optional().default(false),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		category: z.string().optional().nullable().default(""),
		lang: z.string().optional().default(""),
		pinned: z.boolean().optional().default(false),
		author: z.string().optional().default(""),
		sourceLink: z.string().optional().default(""),
		licenseName: z.string().optional().default(""),
		licenseUrl: z.string().optional().default(""),
		comment: z.boolean().optional().default(true),
		password: z.string().optional().default(""),
		passwordHint: z.string().optional().default(""),
		series: z.string().optional().default(""),
		seriesOrder: z.number().optional(),

		/* For internal use */
		prevTitle: z.string().default(""),
		prevSlug: z.string().default(""),
		nextTitle: z.string().default(""),
		nextSlug: z.string().default(""),
	}),
});

const specCollection: ContentCollection<Record<string, never>> =
	defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/spec" }),
		schema: z.object({}),
	});

const dynamicCollection: ContentCollection<DynamicData> = defineCollection({
	loader: glob({ pattern: "**/*.md", base: "./src/content/dynamic" }),
	schema: z.object({
		published: z.date(),
		pinned: z.boolean().optional().default(false),
		location: z.string().optional().default(""),
	}),
});

const projectsCollection: ContentCollection<ProjectData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/projects" }),
	schema: z.object({
		title: z.string(),
		published: z.date(),
		draft: z.boolean().optional().default(false),
		order: z.number().optional(),
		description: z.string().optional().default(""),
		image: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		link: z
			.array(
				z.object({
					label: z.string(),
					icon: z.string().optional().default(""),
					value: z.string(),
				}),
			)
			.optional()
			.default([]),
		status: z.string().optional().default(""),
		lang: z.string().optional().default(""),
	}),
});

/**
 * osu 页面的 tab 内容（游戏简介 / 谱面相关）
 *
 * 两者都是手写正文，正文里可以用 `::beatmap{id=...}` 插谱面卡片
 * （由 rehype-component-beatmap.mjs 渲染，数据来自构建期抓取的 JSON 缓存）。
 */
const osuCollection: ContentCollection<Record<string, never>> =
	defineCollection({
		loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/osu" }),
		schema: z.object({}),
	});

/**
 * 音乐条目（单曲页）
 *
 * 一首歌 = src/content/music/ 下同名的两个文件：
 *   - <slug>.md / <slug>.mdx   元数据 + 介绍正文（本 collection）
 *   - <slug>.lrc               歌词（构建期用 import.meta.glob 读原文，不进 frontmatter，
 *                              方便直接粘贴/替换；支持的标记见 src/utils/lrc.ts 顶部说明）
 * 音频与封面在 R2（cdn.solidephile.cc），这里只存地址。
 */
const musicCollection: ContentCollection<MusicData> = defineCollection({
	loader: glob({ pattern: "**/*.{md,mdx}", base: "./src/content/music" }),
	schema: z.object({
		title: z.string(),
		artist: z.string(),
		published: z.date(),
		draft: z.boolean().optional().default(false),
		category: z.string().optional().default(""),
		tags: z.array(z.string()).optional().default([]),
		/** 音频的公开地址 */
		audio: z.string(),
		/** 封面的公开地址 */
		cover: z.string().optional().default(""),
		/** 时长（秒），元素 metadata 到位前先用它 */
		duration: z.number(),
		/** 节拍：BPM 与第一拍在音频时间轴上的位置（秒） */
		bpm: z.number(),
		offset: z.number().optional().default(0),
		/** 手动排序号（越小越前）；不写就排在手动排过序的曲目之后 */
		order: z.number().optional(),
		/** 版权行（作词/作曲/编曲…） */
		credits: z.array(z.string()).optional().default([]),
		/** kiai 区间（秒）：这段时间左右光晕每拍交替闪（非 kiai 是每 4 拍两侧同时） */
		kiai: z.array(z.array(z.number()).length(2)).optional().default([]),
		/**
		 * 页面主题。
		 * accent：覆盖 `--music-accent`，不写就用全站主题色
		 * （卡片背景与其它卡片一致，不做 per-song 背景）。
		 * spectrum：频谱的可选覆写，不写的字段用 `musicVisualizerConfig` 的默认值。
		 */
		theme: z
			.object({
				accent: z.string().optional().default(""),
				spectrum: z
					.object({
						enable: z.boolean().optional(),
						bars: z.number().int().min(8).max(96).optional(),
						height: z.number().min(12).max(160).optional(),
						color: z.string().optional(),
						smoothing: z.number().min(0).max(1).optional(),
						peakDecay: z.number().min(0).max(0.2).optional(),
						floor: z.number().min(0).max(0.9).optional(),
						curve: z.number().min(1).max(4).optional(),
						fftSize: z.number().int().min(512).max(32768).optional(),
						reflect: z.number().min(0).max(1.5).optional(),
					})
					.optional(),
			})
			.optional(),
	}),
});

export const collections: {
	dynamic: typeof dynamicCollection;
	posts: typeof postsCollection;
	spec: typeof specCollection;
	projects: typeof projectsCollection;
	osu: typeof osuCollection;
	music: typeof musicCollection;
} = {
	dynamic: dynamicCollection,
	posts: postsCollection,
	spec: specCollection,
	projects: projectsCollection,
	osu: osuCollection,
	music: musicCollection,
};
