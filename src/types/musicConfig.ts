// 音乐播放器配置
export type MusicPlayerConfig = {
	// 默认音量 (0-1)
	volume?: number;

	// 播放模式：'list'=列表循环, 'one'=单曲循环, 'random'=随机播放
	playMode?: "list" | "one" | "random";

	// 是否显示歌词
	showLyrics?: boolean;

	// 是否在导航栏显示音乐播放器
	showInNavbar?: boolean;

	// 是否在侧边栏显示音乐播放器组件
	showInSidebar?: boolean;

	/**
	 * 媒体会话（Media Session API）：Windows 音量弹窗 / Edge 媒体控制中心 / 手机锁屏
	 * 显示的歌曲信息。不写就按下面的默认值启用。
	 */
	mediaSession?: {
		// 是否启用（关闭后系统媒体卡不显示本站的信息）
		enable?: boolean;
		// album 行显示的文字（一般写站点名）
		album?: string;
		// 没有封面或封面加载失败时的默认图（public 下的绝对路径）
		fallbackArtwork?: string;
	};

	// Meting API 配置
	meting?: {
		// Meting API 地址
		api?: string;

		// 音乐平台：netease=网易云音乐, tencent=QQ音乐, kugou=酷狗音乐, xiami=虾米音乐, baidu=百度音乐
		server?: "netease" | "tencent" | "kugou" | "xiami" | "baidu";

		// 类型：song=单曲, playlist=歌单, album=专辑, search=搜索, artist=艺术家
		type?: "song" | "playlist" | "album" | "search" | "artist";

		// 歌单/专辑/单曲 ID 或搜索关键词
		id?: string;

		// 认证 token（可选）
		auth?: string;

		// 备用 API 配置（当主 API 失败时使用）
		fallbackApis?: string[];
	};
};
