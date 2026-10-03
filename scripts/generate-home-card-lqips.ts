// 首页入口卡片封面的 LQIP
//
// generate-lqips.ts 只扫本地 src/ / public/ 下的图片，而入口卡片封面配的是
// 外部 URL（osu! 资源站之类），所以单独抓一份：下载 → 缩到 2×2 → 取三个角
// 拼成 18 位 hex，格式和 lqips.json 完全一致，前端拼出同一个 135deg 渐变。
//
// 抓不到就沿用上一次的缓存值；连缓存都没有的话前端会自动退回主题中性色，
// 总之不会退回「卡片底色那种高饱和渐变」当占位。
//
// 单独跑：pnpm home-covers

import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const CONFIG_FILE = "src/config/homeCardsConfig.ts";
const OUTPUT_FILE = "src/constants/home-card-lqips.json";
// 封面原图可能有几 MB（osu! 比赛获奖图动辄 4~5MB），慢一点也要拉完
const TIMEOUT_MS = 60_000;

type LqipMap = Record<string, string>;

/**
 * 只从配置源码里捞 `image: "..."` 这一行。
 * 不去 import 配置模块，是为了让脚本和配置之间没有类型耦合
 * （tsconfig 会一起检查 scripts/，跨模块 import 的扩展名要求容易互相绊住）。
 */
function collectImageUrls(source: string): string[] {
	const urls = new Set<string>();
	for (const match of source.matchAll(/^\s*image:\s*["'`]([^"'`]+)["'`]/gm)) {
		urls.add(match[1]);
	}
	return [...urls];
}

function rgbToHex(r: number, g: number, b: number): string {
	const hex = (n: number) => n.toString(16).padStart(2, "0");
	return `${hex(r)}${hex(g)}${hex(b)}`;
}

async function fetchLqip(url: string): Promise<string | null> {
	const controller = new AbortController();
	const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
	try {
		const response = await fetch(url, { signal: controller.signal });
		if (!response.ok) {
			console.warn(`  ! HTTP ${response.status}`);
			return null;
		}

		const input = Buffer.from(await response.arrayBuffer());
		// 和 generate-lqips.ts 用同一套取色方式，产物才能和本地图片保持一致
		const { data, info } = await sharp(input)
			.resize(2, 2, { fit: "fill" })
			.raw()
			.toBuffer({ resolveWithObject: true });

		const corner = (index: number) => {
			const offset = index * info.channels;
			return rgbToHex(data[offset], data[offset + 1], data[offset + 2]);
		};

		// 2×2 的 [0] 左上、[1] 右上、[3] 右下，正好对应 135deg 的三个色标
		return corner(0) + corner(1) + corner(3);
	} catch (error) {
		console.warn(`  ! ${error instanceof Error ? error.message : error}`);
		return null;
	} finally {
		clearTimeout(timer);
	}
}

async function main(): Promise<void> {
	let existing: LqipMap = {};
	try {
		existing = JSON.parse(await fs.readFile(OUTPUT_FILE, "utf-8")) as LqipMap;
	} catch {
		// 首次运行没有缓存，正常
	}

	const urls = collectImageUrls(await fs.readFile(CONFIG_FILE, "utf-8"));
	if (urls.length === 0) {
		console.log("No card cover images configured, nothing to do.");
		return;
	}

	const lqips: LqipMap = {};
	for (const url of urls) {
		process.stdout.write(`Processing ${url} ...`);
		const compact = await fetchLqip(url);
		if (compact) {
			lqips[url] = compact;
			console.log(` ${compact}`);
		} else {
			// 失败时保住已经跑好的缓存，不要把它抹成空
			if (existing[url]) lqips[url] = existing[url];
			console.log(" skipped");
		}
	}

	await fs.mkdir(path.dirname(OUTPUT_FILE), { recursive: true });
	await fs.writeFile(
		OUTPUT_FILE,
		`${JSON.stringify(lqips, null, 2)}\n`,
		"utf-8",
	);
	console.log(`Done. ${Object.keys(lqips).length} entries -> ${OUTPUT_FILE}`);
}

main();
