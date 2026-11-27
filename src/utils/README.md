# src/utils - 工具函数目录

纯函数、构建期辅助和浏览器初始化逻辑都在这里（不含 UI）。按用途分组，具体行为以各文件顶部注释为准。

**注意**

- 服务端渲染阶段不要直接读 `window` / `localStorage`；浏览器相关的初始化走 `layout-init.ts`，或由调用方在 `onMount` 里读。
- 滚动热路径（`grid-layout-utils.ts` / `fullscreen-wallpaper-utils.ts`）有性能约束，见 `HANDOVER.md` 的「滚动性能约束」，不要在里面加布局读取或每帧 `getComputedStyle`。

## 内容 / 构建期

- `content-utils.ts` - 文章 / 项目 / 系列 / 分类 / 标签列表的读取与排序
- `music-list.ts` - 构建期有序本地歌单（管理器、音乐索引页、单曲页共用的唯一来源）
- `schema-image.ts` - 构建期收集图片，把 `src` 相对路径解析成构建后的真实 URL
- `schema-utils.ts` - 把图片地址解析成绝对 URL（JSON-LD 用）
- `feed-utils.ts` - RSS / Atom 共用的条目归一化
- `projects-utils.ts` - 项目封面 / 图的同源 URL 解析 + 状态元数据
- `gallery-utils.ts` - 扫描相册目录、封面与照片列表
- `github-card-utils.ts` - GitHub 卡片的数据格式化（计数简写等）
- `lqip-utils.ts` - LQIP 紧凑格式解码 + 占位渐变 props
- `crypto-utils.ts` - 加密文章（HMAC / PBKDF2 / AES-GCM）
- `fontHelper.ts` - 字体配置共享逻辑（`astro.config.mjs` 与 `scripts/subset-fonts.ts` 共用）

## 配置 / 页面开关

- `site-config-utils.ts` - `PUBLIC_SITE_LANG` → `siteConfig.lang`
- `page-toggle-utils.ts` - `PUBLIC_PAGES_*` 覆盖 `siteConfig.pages` 的页面开关
- `display-settings-utils.ts` - 显示设置总开关（环境变量覆盖、关闭时强制子项关闭）
- `nav-menu-utils.ts` - 导航链接解析（页面开关过滤 + i18n 名称）
- `navbar-i18n.ts` - 导航菜单名的 i18n key 映射
- `language-utils.ts` - 语言代码 → 显示名称
- `nsfw-utils.ts` - bangumi / vndb / mal 共用的 NSFW 判定
- `responsive-utils.ts` - 侧栏宽度、可见性与网格列数的计算
- `sidebar-effective-utils.ts` - 本页是否隐藏侧栏

## 通用小工具

- `url-utils.ts` - slug / URL 路径辅助
- `date-utils.ts` - i18n 日期格式化
- `time-utils.ts` - 秒 → `m:ss`
- `color-utils.ts` - `oklch` → `rgb`（canvas 用）
- `image-utils.ts` - 按 seed 生成确定性 hash（随机封面）
- `email-utils.ts` - 邮箱地址 base64 混淆
- `fetch-dedup.ts` - 同页重复请求去重
- `storage-utils.ts` - 安全 `localStorage` 读写（SSR / 隐私模式不炸）
- `setting-utils.ts` - 主题 / 色相 / 壁纸偏好的读写与系统主题解析
- `icon-loader.ts` - 图标加载指示器
- `failed-covers.ts` - 封面加载失败的本地缓存
- `build-platform.ts` - `BUILD_PLATFORM` 环境变量（部署平台命名）

## 音乐

- `lrc.ts` - 增强 LRC 解析（逐字、换色、翻译、间奏 `{int:…}`）、当前行查找、`LYRIC_LEAD_MS`
- `beat-utils.ts` - 拍点计算（`beatState`）、特效区间判定（`beatTriggerTime` / `inEffectWindow`）
- `scroll-tween.ts` - 歌词居中用的滚动补间（不依赖原生 smooth scroll）

## 布局 / 滚动 / 交互

- `layout-init.ts` - 布局初始化入口（首次加载 + Swup 切页）
- `layout-utils.ts` - 背景图、`toArray` 等布局工具
- `grid-layout-utils.ts` - 主网格列、侧栏吸顶间距（滚动热路径）
- `fullscreen-wallpaper-utils.ts` - 全屏壁纸标题淡出 + blur ramp（滚动热路径）
- `scroll-utils.ts` - 动态导航栏的滚动方向判断
- `banner-utils.ts` - banner / fullscreen 壁纸模式判断
- `banner-visibility-utils.ts` - 横幅元信息类型与可见性
- `swup-transitions.ts` - Swup 页面过渡配置
- `navigation-utils.ts` - `navigateToPage()`（Swup 无刷新跳转）
- `toc-utils.ts` / `toc-shared.ts` - 目录计算（服务端 + 客户端共用）
- `content-overflow-utils.ts` - KaTeX 公式横向滚动、宽表格包裹
- `immersive-reading-utils.ts` - 沉浸式阅读初始化
- `touch-copy-utils.ts` - 触摸设备上显示代码块复制按钮
- `floating-panel-utils.ts` - 浮动面板开关
- `waves-draw.ts` - 水波纹绘制（供 `WavesEffect.astro` 使用）

## 动态 / 外部数据

- `memos-adapter.ts` - Memos API 客户端适配（动态数据源）
- `dynamic-utils.ts` - 动态条目的置顶 / 时间排序
- `bilibili-utils.ts` - Bilibili 番剧列表请求与类型
- `mal-utils.ts` - MAL 列表请求、状态与分类
- `vndb-utils.ts` - VNDB ulist 请求、状态文案与 tab 构建
- `booknav-utils.ts` - 书签图标解析（含首字母降级）
