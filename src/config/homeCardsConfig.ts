/**
 * 首页「页面推荐」区块配置
 *
 * 首页默认只渲染文章列表，这个区块用来放指向站内其它页面的入口卡片
 * （例如 osu 数据页、相册、项目页……）。整块渲染成**一张大卡片**，
 * 上半是标题栏（左图标 + 右标题/描述，复用站内 .page-heading 那套），
 * 下半是入口卡片网格。
 *
 * - 加卡片：往 cards 里追加一项即可，顺序即展示顺序
 * - 临时隐藏某张：把它自己的 enabled 设为 false，不用删配置
 * - 整体关掉：enable 设为 false
 *
 * icon 走 astro-icon，下面这些图标集是**全量**可用的：
 *   simple-icons / material-symbols / mdi / mingcute
 *   fa7-solid / fa7-regular / fa7-brands
 */

/** 单张入口卡片 */
export interface HomeFeatureCard {
	/** 卡片标题 */
	title: string;
	/** 一句话说明；超出两行会自动截断 */
	description: string;
	/** 链接目标：站内路径（如 "/osu/"）或完整外链 */
	href: string;
	/** Iconify 图标名，如 "simple-icons:osu" */
	icon: string;
	/**
	 * 背景图 URL。填了就会铺满卡片并盖一层卡片底色的遮罩
	 * （保证文字可读），不填就是普通的卡片底色。
	 */
	image?: string;
	/** 占几列：1 = 半宽（默认），2 = 占满整行。窄屏一律一列，此项不影响 */
	span?: 1 | 2;
	/** 设为 false 可临时不渲染这张卡 */
	enabled?: boolean;
}

export interface HomeFeatureConfig {
	/** 整个区块的开关 */
	enable: boolean;
	/** 标题栏左上角的图标 */
	icon: string;
	/** 标题栏主标题 */
	title: string;
	/** 标题栏描述（主标题下方的灰字） */
	description: string;
	/** 卡片列表 */
	cards: HomeFeatureCard[];
}

export const homeFeatureConfig: HomeFeatureConfig = {
	enable: true,
	icon: "material-symbols:explore",
	title: "页面推荐",
	description: "来看看这些地方吧！",
	cards: [
		{
			title: "osu! ",
			description: "关于我和 osu! 的一切都在这里",
			href: "/osu/",
			icon: "simple-icons:osu",
			image: "https://assets.ppy.sh/contests/285/winners/Porukana.png",
			span: 2,
		},
		{
			title: "Bangumi",
			description: "我的Bangumi信息",
			href: "/bangumi/",
			icon: "material-symbols:movie",
			image: "https://assets.ppy.sh/contests/282/winners/girls%20kissing.png",
			span: 1,
		},
		{
			title: "站点统计",
			description: "看看有多少人来过这里QAQ",
			href: "/analytics/",
			icon: "material-symbols:analytics",
			image: "https://assets.ppy.sh/contests/282/winners/-%20Y%20u%20m%20i%20J%20i-.jpg",
			span: 1,
		},
		// 之后想展示别的页面，在这里追加一项就行，例如：
		// {
		//   title: "相册",
		//   description: "随手拍的一些照片",
		//   href: "/gallery/",
		//   icon: "material-symbols:photo-library",
		//   image: "https://example.com/cover.jpg",
		//   span: 1,
		// },
	],
};
