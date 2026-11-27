/**
 * 字体配置（统一入口）
 *
 * 所有字体相关配置都在此文件中定义：
 *   详细用法请参考 Astro 官方文档：https://docs.astro.build/en/guides/fonts
 * - fonts：Astro Font API 字体定义（自动下载、缓存、优化加载）
 * - fontConfig：字体选择与区域覆盖
 *
 * 添加新字体只需编辑本文件：
 * 1. 在下方 fonts 数组中添加字体定义
 * 2. 在 fontConfig.selected 或区域字段中引用对应的 cssVariable
 *
 * 支持的 provider：https://docs.astro.build/en/reference/font-provider-reference/#built-in-providers
 *   "google"     - Google Fonts
 *   "fontsource" - Fontsource
 *   "local"      - 本地字体文件
 *   "bunny"      - Bunny Fonts
 *   "fontshare"  - Fontshare
 *   "npm"        - NPM 包（如 @fontsource/*）
 *
 * 本地字体子集化：在 fontConfig.subsetFonts 中添加对应 cssVariable 的配置，
 * 构建时脚本会自动扫描页面字符并生成轻量 woff2 子集。
 */
import type { FontDefinition, FontSelectionConfig } from "@/types/fontConfig";

// ─── Astro Font API 字体定义 ───────────────────────────────
// 适用于 Astro Font API 的字体配置，支持自动下载、缓存和优化加载
// 本地开发调试的情况下，修改后需要每次重启开发服务器才能生效
export const fontsList: FontDefinition[] = [
	{
		// 自托管 + 构建期子集化：日文整包 1.4 MB 太贵，改成只保留站点实际用到的字符。
		// 字体文件来源：google/fonts 仓库 ofl/zenmarugothic（OFL-1.1，可自由自托管）。
		// 子集化在 scripts/subset-fonts.ts 里跑，配置见下方 fontConfig.subsetFonts。
		name: "Zen Maru Gothic",
		cssVariable: "--font-zen-maru-gothic",
		provider: "local",
		options: {
			variants: [
				{
					src: ["./public/assets/fonts/ZenMaruGothic-Regular.ttf"],
					weight: "400",
					style: "normal",
				},
				{
					src: ["./public/assets/fonts/ZenMaruGothic-Medium.ttf"],
					weight: "500",
					style: "normal",
				},
				{
					src: ["./public/assets/fonts/ZenMaruGothic-Bold.ttf"],
					weight: "700",
					style: "normal",
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
	{
		// 歌词原文：马路口圆体（Maruko Gothic）日文字形版本，基于 Zen Maru Gothic
		// 补全汉字，字形风格与主页横幅的 Zen Maru Gothic 一致。
		// 只用 Medium 一档，其余字重（Light / Regular / Bold）不下载。
		// 授权：OFL-1.1，可自由自托管与子集化。
		name: "Maruko Gothic JP",
		cssVariable: "--font-maruko-jp",
		provider: "local",
		options: {
			variants: [
				{
					src: ["./public/assets/fonts/MarukoGothic-JP-Medium.ttf"],
					weight: "500",
					style: "normal",
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
	{
		// 歌词译文：同一款字体的简体中文字形版本。
		// 日文版本里的汉字是日文字形，套在中文译文上会露出日式写法的细节差异，
		// 所以原文与译文分两个家族加载，各自使用对应地区的字形。
		name: "Maruko Gothic CN",
		cssVariable: "--font-maruko-cn",
		provider: "local",
		options: {
			variants: [
				{
					src: ["./public/assets/fonts/MarukoGothic-CN-Medium.ttf"],
					weight: "500",
					style: "normal",
				},
			],
		},
		fallbacks: ["sans-serif"],
	},
	{
		name: "Inter",
		cssVariable: "--font-inter",
		provider: "fontsource",
		weights: ["300", "400", "500", "600", "700"],
		styles: ["normal"],
		subsets: ["latin", "cyrillic"],
		fallbacks: ["sans-serif"],
	},
	{
		name: "JetBrains Mono",
		cssVariable: "--font-jetbrains-mono",
		provider: "fontsource",
		weights: ["400", "700"],
		styles: ["normal"],
		subsets: ["latin", "cyrillic"],
		fallbacks: [
			"ui-monospace",
			"SFMono-Regular",
			"Menlo",
			"Monaco",
			"Consolas",
			"Liberation Mono",
			"Courier New",
			"monospace",
		],
	},
	// ─── 更多本地字体 ───
	// 使用步骤：
	// 1. 将 TTF/OTF/WOFF2 字体文件放在 public/assets/fonts/ 目录下
	// 2. 在上方数组里追加一条 provider: "local" 的配置，src 指向刚放进去的文件
	// 3. 在 fontConfig.selected 或区域字段中引用它的 cssVariable
	// 4. 如需构建期子集化，在下方 fontConfig.subsetFonts 里补一个同名 key
	// 注意：这里不要留“引用了不存在文件”的示例条目——那样一开 enable 构建就会
	// 报 `Font file not found` 并静默跳过，排查起来很费劲。
];

// ─── 字体选择与区域覆盖 ─────────────────────────────────────
export const fontConfig: FontSelectionConfig = {
	// 是否启用自定义字体功能
	enable: true,
	// 当前选择的字体 CSS 变量名（对应上方 fonts 中的 cssVariable）
	// 使用 "system" 表示系统字体（不加载任何自定义字体）
	selected: ["system"],

	// 各区域独立字体设置（填写上方 fonts 中的 cssVariable，留空则使用全局 selected 字体）
	// 例如：bannerTitleFont: "--font-inter", 表示主页横幅主标题使用 Inter 字体
	// 主页横幅主标题字体
	bannerTitleFont: "--font-zen-maru-gothic",
	// 主页横幅副标题字体
	bannerSubtitleFont: "--font-zen-maru-gothic",
	// 导航栏标题字体
	navbarTitleFont: "",
	// 音乐页歌词原文字体（马路口圆体日文字形版本）
	musicLyricFont: "--font-maruko-jp",
	// 音乐页歌词译文字体（马路口圆体简体中文字形版本）
	musicLyricTranslationFont: "--font-maruko-cn",
	// 代码块字体（用于代码高亮和等宽字体场景）
	codeFont: "--font-jetbrains-mono",

	// 本地字体子集化配置（构建时由 scripts/subset-fonts.ts 处理）
	// key 为 fonts 数组中本地字体的 cssVariable，value 为子集化选项
	// 构建脚本默认扫描 dist 里实际出现的字符，只保留这些字形（日文整包 1.4 MB → 几百 KB）；
	// 设了 lyricChars 的字体只取歌词用字（马路口圆体按全站收集会到 200 KB+，而它只用在歌词上）
	subsetFonts: {
		"--font-zen-maru-gothic": {
			// 额外包含的字符（覆盖评论、Bangumi 番名等构建时抓不到的动态内容）
			extraChars: "♪",
		},
		"--font-maruko-jp": {
			// 原文子集：只取 .lrc 正文（不含 {tr:…}），外加歌词里偶尔出现的装饰符号
			lyricChars: "original",
			extraChars: "♪",
		},
		"--font-maruko-cn": {
			// 译文子集：只取 {tr:…} 里的内容
			lyricChars: "translation",
			extraChars: "♪",
		},
	},
};
