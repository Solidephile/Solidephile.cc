// 谱面卡片数据抓取（构建期）
//
// 扫描 content 里所有 `::beatmap{id=...}` 指令，用 client_credentials 向 osu! API
// 逐个取 beatmapset，裁剪成卡片需要的形状写进 src/constants/beatmap-card-data.json。
// rehype 插件在渲染时读这份 JSON，所以访客侧不需要任何请求。
//
// 与 generate-github-card-data.ts 的差别：osu! 的 client_credentials 必须带密钥
// （不像 GitHub 可以匿名），所以没配 OSU_CLIENT_ID / OSU_CLIENT_SECRET 时
// 只能保留上一次的缓存——这里刻意不报错退出，避免把整个构建弄挂。

import fs from "node:fs/promises";
import path from "node:path";
import { glob } from "glob";

const OUTPUT_FILE = "src/constants/beatmap-card-data.json";
const CONTENT_GLOB = "src/content/**/*.{md,mdx}";
const BEATMAP_DIRECTIVE_PATTERN =
	/::beatmap\s*\{[^}]*\bid\s*=\s*["']?(\d+)["']?[^}]*\}/g;

interface BeatmapDiffData {
	name: string;
	stars: number;
	mode: string;
	/** 秒 */
	length: number;
	od: number | null;
	hp: number | null;
	cs: number | null;
	ar: number | null;
	maxCombo: number | null;
}

interface BeatmapCardData {
	id: number;
	title: string;
	artist: string;
	creator: string;
	status: string;
	bpm: number;
	cover: string;
	diffs: BeatmapDiffData[];
}

type BeatmapCardCache = Record<string, BeatmapCardData>;

// osu! API 原始响应里我们真正用到的字段（只声明用到的，避免 any）
interface RawBeatmap {
	version?: string;
	difficulty_rating?: number;
	mode?: string;
	total_length?: number;
	/** OD（注意字段名不是 od） */
	accuracy?: number;
	/** HP（注意字段名不是 hp） */
	drain?: number;
	cs?: number;
	ar?: number;
	max_combo?: number;
}

interface RawBeatmapset {
	title?: string;
	title_unicode?: string;
	artist?: string;
	artist_unicode?: string;
	creator?: string;
	status?: string;
	bpm?: number;
	covers?: Record<string, string>;
	beatmaps?: RawBeatmap[];
}

async function readCache(): Promise<BeatmapCardCache> {
	try {
		return JSON.parse(await fs.readFile(OUTPUT_FILE, "utf-8"));
	} catch {
		return {};
	}
}

/** 找出正文里引用到的所有 beatmapset id */
async function findBeatmapsetIds(): Promise<Map<string, number>> {
	const found = new Map<string, number>();
	const files = await glob(CONTENT_GLOB);

	for (const file of files) {
		const content = await fs.readFile(file, "utf-8");
		for (const match of content.matchAll(BEATMAP_DIRECTIVE_PATTERN)) {
			const id = Number(match[1]);
			if (Number.isInteger(id) && id > 0) found.set(String(id), id);
		}
	}

	return found;
}

async function getAccessToken(): Promise<string | null> {
	const clientId = process.env.OSU_CLIENT_ID?.trim();
	const clientSecret = process.env.OSU_CLIENT_SECRET?.trim();

	if (!clientId || !clientSecret) return null;

	const response = await fetch("https://osu.ppy.sh/oauth/token", {
		method: "POST",
		headers: {
			Accept: "application/json",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			client_id: Number(clientId),
			client_secret: clientSecret,
			grant_type: "client_credentials",
			scope: "public",
		}),
		signal: AbortSignal.timeout(10000),
	});

	if (!response.ok) {
		throw new Error(`osu! token 获取失败：${response.status}`);
	}

	const data = await response.json();
	return typeof data.access_token === "string" ? data.access_token : null;
}

function num(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** 只留下卡片要显示的字段，控制 JSON 体积 */
function trimBeatmapset(raw: RawBeatmapset, id: number): BeatmapCardData {
	const cover =
		raw.covers?.cover || raw.covers?.["cover@2x"] || raw.covers?.card || "";

	const diffs: BeatmapDiffData[] = (raw.beatmaps ?? [])
		.filter(
			(b): b is RawBeatmap & { version: string } =>
				typeof b?.version === "string",
		)
		.map((b) => ({
			name: b.version,
			stars: num(b.difficulty_rating) ?? 0,
			mode: typeof b.mode === "string" ? b.mode : "osu",
			length: num(b.total_length) ?? 0,
			od: num(b.accuracy),
			hp: num(b.drain),
			cs: num(b.cs),
			ar: num(b.ar),
			maxCombo: num(b.max_combo),
		}))
		.sort((a, b) => a.stars - b.stars);

	return {
		id,
		title: raw.title_unicode || raw.title || "",
		artist: raw.artist_unicode || raw.artist || "",
		creator: raw.creator || "",
		status: raw.status || "",
		bpm: num(raw.bpm) ?? 0,
		cover,
		diffs,
	};
}

async function fetchBeatmapset(
	token: string,
	id: number,
): Promise<BeatmapCardData> {
	const response = await fetch(`https://osu.ppy.sh/api/v2/beatmapsets/${id}`, {
		headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
		// 老谱面集偶尔响应很慢，10s 会误判成失败；20s 更稳妥
		signal: AbortSignal.timeout(20000),
	});

	if (!response.ok) {
		throw new Error(`osu! API 返回 ${response.status}`);
	}

	return trimBeatmapset(await response.json(), id);
}

async function writeCache(cache: BeatmapCardCache): Promise<void> {
	const sorted = Object.fromEntries(
		Object.entries(cache).sort(([a], [b]) => Number(a) - Number(b)),
	);

	await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await fs.writeFile(OUTPUT_FILE, `${JSON.stringify(sorted, null, "\t")}\n`);
}

async function main() {
	const ids = await findBeatmapsetIds();
	const existing = await readCache();

	if (ids.size === 0) {
		console.log("[BEATMAP-CARD] 正文里没有 ::beatmap 指令，跳过。");
		// 仍然写一次空缓存，避免插件 import 一个不存在的文件
		if (Object.keys(existing).length === 0) await writeCache({});
		return;
	}

	let token: string | null = null;
	try {
		token = await getAccessToken();
	} catch (error) {
		console.warn("[BEATMAP-CARD] 获取 token 失败，保留现有缓存。", error);
	}

	if (!token) {
		console.warn(
			"[BEATMAP-CARD] 未配置 OSU_CLIENT_ID / OSU_CLIENT_SECRET，保留现有缓存（卡片会显示兜底状态）。",
		);
		await writeCache(existing);
		return;
	}

	const nextCache: BeatmapCardCache = {};
	let refreshed = 0;

	for (const [key, id] of ids) {
		try {
			nextCache[key] = await fetchBeatmapset(token, id);
			refreshed++;
		} catch (error) {
			if (existing[key]) {
				nextCache[key] = existing[key];
				console.warn(`[BEATMAP-CARD] ${id} 刷新失败，沿用缓存。`, error);
			} else {
				console.warn(
					`[BEATMAP-CARD] ${id} 抓取失败，卡片会显示兜底状态。`,
					error,
				);
			}
		}
	}

	await writeCache(nextCache);
	console.log(
		`[BEATMAP-CARD] 缓存 ${Object.keys(nextCache).length} 个谱面集（刷新了 ${refreshed} 个）。`,
	);
}

main();
