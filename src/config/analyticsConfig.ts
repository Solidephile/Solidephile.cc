import type { AnalyticsConfig } from "../types/analyticsConfig";

// 读取环境变量：Vite/Astro 走 import.meta.env，构建脚本 / Node 环境回退到 process.env。
// 这样自建 Umami 的实例地址与 Website ID 不必写死在仓库里（本文件在构建时求值）。
function readEnv(key: string): string {
	try {
		const value = (import.meta.env as Record<string, unknown>)[key];
		if (typeof value === "string" && value) return value;
	} catch {
		// import.meta.env 不可用（例如在纯 Node 脚本里）
	}
	if (typeof process !== "undefined") {
		return process.env[key] ?? "";
	}
	return "";
}

// 自建 Umami 实例地址，例如 https://analytics.solidephile.cc（去掉结尾斜杠）
const umamiUrl = readEnv("UMAMI_URL").replace(/\/+$/, "");

export const analyticsConfig: AnalyticsConfig = {
	// Google Analytics ID
	googleAnalyticsId: "",
	// Microsoft Clarity ID
	microsoftClarityId: "",
	// Umami 统计配置
	umamiAnalytics: {
		// Umami Website ID（环境变量 UMAMI_WEBSITE_ID；留空则不会注入统计脚本）
		websiteId: readEnv("UMAMI_WEBSITE_ID"),
		// Umami JS地址：配置了 UMAMI_URL 就用自建实例，否则回退官方 Cloud
		scriptUrl: umamiUrl
			? `${umamiUrl}/script.js`
			: "https://cloud.umami.is/script.js",
		// Umami 会话回放脚本地址，同上
		replaysScriptUrl: umamiUrl
			? `${umamiUrl}/recorder.js`
			: "https://cloud.umami.is/recorder.js",
		// 是否追踪出站链接
		trackOutboundLinks: true,
		// 是否收集浏览器性能指标
		collectWebVitals: false,
		// 会话回放配置
		replays: {
			// 是否启用会话回放
			enabled: false,
			// 录制会话采样率，范围 0-1，例如 0.15 表示记录 15% 的会话
			sampleRate: 0.15,
			// 隐私遮罩级别："moderate" 会遮罩所有输入框；"strict" 额外遮罩页面全部文本
			maskLevel: "moderate",
			// 单次录制最大时长（毫秒）
			maxDuration: 300000,
			// 需要排除录制的元素 CSS 选择器，例如 ".sensitive-widget"
			blockSelector: "",
		},
	},
	// 51la 统计配置
	la51Analytics: {
		// 51la 统计 ID
		Id: "",
		// 自定义 SDK JS 地址，防止 DNS 污染，留空使用默认地址
		sdkUrl: "",
		// 多个统计 ID 的数据分离标识，留空则使用 Id
		ck: "",
		// 是否开启事件分析功能
		autoTrack: false,
		//  Hash路由模式, 项目使用History API路由, 所以不必开启默认false
		hashMode: false,
		// 是否开启网站录屏功能
		screenRecord: true,
	},
};
