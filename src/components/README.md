# 📦 Components 组件目录

全站可复用组件按职责分类：`.astro` 负责静态外壳 / MDX 内容，`.svelte` 负责交互（`client:*` 挂载），页面专属组件放在 `pages/<页面>/` 下。

**通用约定**

- **状态占位**统一用 `common/LoadingState.svelte`（加载）、`common/StateMessage.svelte`（空 / 失败，三档尺寸）、`common/GridSkeleton.svelte`（媒体网格骨架）。规则见 `HANDOVER.md` §4.9，不要再手写圆标和文案。
- Svelte 侧的图标只能来自离线图标集 `src/constants/icons-data.json`（由 `common/Icon.svelte` 读取），新增图标前先确认里面存在，否则会渲染成占位圆圈。
- `.astro` 里用 astro-icon 的 `Icon` 一律写 `is:inline`，否则后出现的渲染会指向不存在的 `<symbol>`。
- MDX 文章里统一从 `@/components/mdx-ui` 导入 MDX UI 组件。

## 📁 目录结构

### 🏗️ layout/ - 页面布局

- `BannerHomeTextOverlay.astro` - 首页横幅文字覆盖层（打字机标题、头像、社交入口）
- `BannerPostMetaOverlay.astro` - 文章页横幅元信息覆盖层（标题 / 日期 / 分类）
- `CategoryBar.astro` - 分类栏
- `ConfigCarrier.astro` - 全局配置载体（把主题色等配置写到 DOM）
- `DropdownMenu.astro` - 下拉菜单
- `Footer.astro` - 页脚
- `HeaderTopRow.astro` - 顶部导航行（按 navbar 模式组合）
- `Navbar.astro` - 导航栏
- `NavMenuPanel.astro` - 导航菜单面板
- `PostCard.astro` - 文章卡片
- `PostMeta.astro` - 文章元信息（日期 / 阅读量 / 字数）
- `PostPage.astro` - 文章页布局
- `PostStats.astro` - 文章统计（发布日期 / 字数 / 阅读时长）
- `SideBar.astro` - 侧边栏
- `SidebarColumn.astro` - 左 / 右栏容器（按站点配置渲染 `SideBar`）
- `WallpaperSection.astro` - 壁纸与横幅区（背景播放器、横幅覆盖层、滚动指示）

### 🎮 controls/ - 导航和交互控件

- `ArchivePanel.astro` - 归档面板（服务端渲染 + 客户端筛选 / 折叠）
- `BackToComment.astro` - 返回评论区按钮
- `BackToHome.astro` - 返回主页按钮
- `BackToTop.astro` - 返回顶部按钮
- `DisplaySettingsIntegrated.svelte` - 集成式显示设置面板
- `FloatingControls.astro` - 右下角悬浮控件容器
- `FloatingTOC.astro` - 浮动目录
- `ImmersiveReading.astro` - 沉浸式阅读入口按钮
- `ImmersiveTOC.astro` - 沉浸式阅读目录面板
- `LightDarkSwitch.svelte` - 明暗主题切换
- `ScrollDownIndicator.astro` - 向下滚动指示器
- `Search.svelte` - 搜索（Pagefind）

### 🔧 common/ - 公共可复用组件

**基础 UI**
- `Badge.astro` - MDX 内联徽章
- `ButtonLink.astro` - 链接按钮
- `ButtonTag.astro` - 标签按钮
- `ClientPagination.svelte` - 客户端分页
- `DropdownItem.astro` / `DropdownItem.svelte` - 下拉选项
- `DropdownPanel.astro` / `DropdownPanel.svelte` - 下拉面板容器
- `FloatingButton.astro` - 悬浮按钮基础组件
- `Icon.svelte` - 离线图标组件
- `PageJump.svelte` - 分页跳页输入
- `Pagination.astro` - 静态路由分页
- `SegmentedControl.svelte` - 胶囊分段控件
- `TabGroup.svelte` - MDX 代码组 tab
- `WidgetLayout.astro` - 小部件布局容器

**内容和展示**
- `CoverImage.astro` - 封面图组件（本地图 + 随机图 API，失败显示「图片加载失败」）
- `ImageWrapper.astro` - 图片包装器（本地 / 远程）
- `LineChart.svelte` - Chart.js 折线图（含空数据占位）
- `Markdown.astro` - Markdown 内容样式包装器
- `PioMessageBox.astro` - 看板娘消息框
- `Timeline.astro` / `TimelineItem.astro` - MDX 时间线
- `Steps.astro` / `StepItem.astro` - MDX 编号步骤条
- `mdx-icons.ts` - TimelineItem / StepItem 共用的内置图标集（内联 SVG）

**筛选与状态**
- `FilterControls.svelte` - 胶囊筛选（bangumi / vndb / mal 共用）
- `TabNav.svelte` - 标签导航（支持 URL hash 深链）
- `GridSkeleton.svelte` - 媒体网格加载骨架（带 `role="status"`）
- `LoadingState.svelte` - 统一加载态（SVG 转圈 + 文案；`compact` 给小容器）
- `StateMessage.svelte` - 统一空 / 失败状态（三档：default / compact / inline）

### ✨ features/ - 全局功能与特效

**管理器**
- `BackgroundPlayer.astro` - 壁纸背景视频播放器（上一支 / 下一支、加载失败提示）
- `CodeGroupManager.astro` - 代码组 tab（rehype-code-group）交互管理
- `FancyboxManager.astro` - Fancybox 图片查看器管理
- `FontSetup.astro` - 字体加载和管理（Astro Font API）
- `GithubCardManager.astro` - GitHub 卡片客户端管理
- `KatexManager.astro` - KaTeX 数学公式渲染管理
- `MusicManager.astro` - 全局音乐引擎（单例 `<audio>`、队列、播放模式）

**功能组件**
- `EncryptedContent.astro` - 加密内容
- `EncryptedPost.astro` - 加密文章
- `Live2DWidget.astro` - Live2D 看板娘
- `MusicPlayer.astro` - 旧播放器 widget 的 HTML 视图（导航栏 / 侧栏）
- `MusicPlayerView.astro` - 旧播放器 widget 的 `is:inline` 控制脚本
- `SakuraEffect.astro` - 樱花飘落
- `SpineModel.astro` - Spine 看板娘
- `TypewriterText.astro` - 打字机动画
- `WavesEffect.astro` - 水波纹（主线程 Canvas 2D）

**features/music/** - 单曲页与全局播放器的 UI / 控制器
- `MusicStage.svelte` - 单曲页 island 根（布局、色板、工具簇、移动端轮播）
- `CoverPane.svelte` - 左栏：封面 / 标题 / 元数据 / 标签 / 频谱
- `LyricsView.svelte` - 右栏：纯展示歌词 + 对齐 / 翻译工具条
- `TransportBar.svelte` - 进度条与上一首 / 播放 / 下一首（不自带 `<audio>`）
- `BeatRing.svelte` - 四段节拍环（受 frontmatter `effects` 区间约束）
- `StageGlow.svelte` - 卡片两侧节拍光晕（同样受 `effects` 区间约束）
- `Spectrum.svelte` - canvas 频谱（含倒影）
- `TimingDebug.svelte` - `?debug=1` 的 offset / 输出延迟 / 特效区间校准面板
- `MusicRouteSync.svelte` - 单曲页 URL ↔ 当前曲目双向同步（无 UI）
- `player.svelte.ts` - 页面侧播放器控制器（runes、歌词、延迟）
- `clock.ts` - 墙钟插值的播放位置
- `audio-context.ts` - 共享 AudioContext / AnalyserNode

### 🧩 widget/ - 侧边栏小部件

- `Advertisement.astro` - 广告
- `Announcement.astro` - 公告
- `Calendar.astro` - 日历
- `Categories.astro` - 分类
- `Dynamic.astro` - 动态小部件外壳（渲染 `DynamicSidebar`）
- `DynamicSidebar.svelte` - 侧栏动态列表（加载 / 空 / 失败）
- `Music.astro` - 音乐播放器小部件
- `Profile.astro` - 个人信息 / 社交链接
- `SidebarTOC.astro` - 侧边栏目录
- `SiteInfo.astro` - 站点信息
- `SiteStats.astro` - 站点统计
- `SpineModel.astro` - Spine 看板娘小部件
- `Tags.astro` - 标签

### 📃 pages/ - 页面特定组件

- `AdvancedSearch.svelte` - 高级搜索

**pages/analytics/**
- `AnalyticsDashboard.svelte` - 站点统计看板（汇总 / 趋势 / 排名）
- `AnalyticsPanel.svelte` - 统计区块外壳（图标 + 标题 + 右侧控件）
- `BreakdownList.svelte` - 排名列表（进度条，含空态）

**pages/bangumi/**
- `BangumiGrid.svelte` - 番组网格 + 分类 tab + 动态模式取数
- `BangumiSection.svelte` - 番组分类展示
- `Card.svelte` - 番组卡片

**pages/bilibili/**
- `BilibiliCard.svelte` - 番剧卡片
- `BilibiliDetailModal.svelte` - 番剧详情弹窗
- `BilibiliGrid.svelte` - 番剧网格 + 筛选 / 排序 / 分页

**pages/dynamic/**
- `DynamicFeed.svelte` - 动态列表（加载、搜索、年份筛选、分页）
- `DynamicGallery.astro` - 动态图片网格 / 轮播 / 灯箱
- `dynamic-gallery.ts` - 动态图片的 Fancybox 注册
- `DynamicInlineComments.astro` - 单条动态的按需评论区
- `dynamic-inline-comments.ts` - 动态内联评论的 custom element
- `DynamicItem.astro` - 动态条目的服务端渲染
- `DynamicItemTemplate.astro` - 动态条目的客户端渲染模板

**pages/gallery/**
- `AlbumCard.astro` - 相册卡片
- `PhotoCard.astro` - 照片卡片

**pages/home/**
- `HomeFeatureCards.astro` - 首页入口卡片区

**pages/mal/**
- `Card.svelte` - MAL 条目卡片
- `MalGrid.svelte` - MAL 网格 + 分类 tab + 动态模式取数
- `MalSection.svelte` - MAL 分类展示

**pages/music/**
- `MusicIndex.svelte` - 音乐索引页（本地 / 网易云列表）

**pages/osu/**
- `ChartCard.svelte` - 历史曲线单图卡片（包一层 `LineChart`）
- `HistoryCharts.svelte` - 数据历史曲线区
- `in-view.ts` - 成绩卡懒加载共用的 IntersectionObserver
- `osu-data.ts` - `/api/osu` 请求与缓存
- `OsuPanel.svelte` - osu! 基本信息面板（纯展示）
- `OsuPanelHost.svelte` - 基本信息面板的取数外壳（加载 / 失败态）
- `OsuTabNav.svelte` - osu 页 tab 导航（把选中态写到容器上）
- `ScoreCard.svelte` - 成绩卡片
- `ScoresList.svelte` - 最好成绩 / 置顶成绩列表
- `score-visuals.ts` - 成绩卡视觉映射（难度配色等）

**pages/projects/**
- `ProjectCard.astro` - 项目卡片

**pages/vndb/**
- `Card.svelte` - VNDB 条目卡片
- `VndbGrid.svelte` - VNDB 网格 + 分类 tab + 动态模式取数
- `VndbSection.svelte` - VNDB 分类展示

### 💬 comment/ - 评论系统

- `index.astro` - 评论主组件（按配置切换服务）
- `Artalk.astro` - Artalk
- `Disqus.astro` - Disqus
- `Giscus.astro` - Giscus（GitHub 讨论）
- `Twikoo.astro` - Twikoo
- `Waline.astro` - Waline

### 📊 analytics/ - 数据统计服务

- `GoogleAnalytics.astro` - Google Analytics
- `La51Analytics.astro` - 51la 统计
- `MicrosoftClarity.astro` - Microsoft Clarity
- `UmamiAnalytics.astro` - Umami

### 🔧 misc/ - 杂项

- `License.astro` - 许可证信息
- `RecommendedPost.astro` - 推荐文章 / 相关文章
- `SeriesNav.astro` - 系列文章导航
- `SharePoster.svelte` - 分享海报生成

### 根级文件

- `mdx-ui.ts` - MDX UI 组件集合（`Badge` / `StepItem` / `Steps` / `TabGroup` / `Timeline` / `TimelineItem` 的统一导出）

---

## 🗂️ 分类原则

| 分类 | 用途 | 特点 |
|------|------|------|
| **layout/** | 页面布局和结构 | 决定整体页面框架 |
| **controls/** | 导航和交互 | 用户交互功能 |
| **common/** | 通用可复用组件 | 跨多个页面 / 组件使用 |
| **features/** | 全局功能 / 特效 / 播放器 | 全局加载的增强功能 |
| **widget/** | 侧边栏小部件 | 侧边栏特定组件 |
| **pages/** | 页面特定组件 | 仅在特定页面使用 |
| **comment/** | 评论系统 | 第三方服务集成 |
| **analytics/** | 数据统计 | 分析和统计服务 |
| **misc/** | 工具和辅助 | 其他杂项功能 |
