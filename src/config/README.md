# 配置文件说明

本目录包含所有配置文件，采用模块化设计，每个文件负责特定的功能模块。

## 📁 配置文件结构

```
src/config/
├── index.ts                  # 配置索引文件 - 统一导出
├── siteConfig.ts             # 站点基础配置
├── analyticsConfig.ts        # 统计分析配置（Google Analytics、Umami、51la 等）
├── announcementConfig.ts     # 公告配置
├── backgroundWallpaper.ts    # 背景壁纸配置（含轮播）
├── booknavConfig.ts          # 书签导航配置
├── commentConfig.ts          # 评论系统配置
├── coverImageConfig.ts       # 封面图配置
├── displaySettingsConfig.ts  # 设置面板配置
├── dynamicConfig.ts          # 动态页面配置
├── effectsConfig.ts          # 动画特效配置（樱花等）
├── expressiveCodeConfig.ts   # 代码高亮配置
├── fontConfig.ts             # 字体配置
├── FooterConfig.html         # 页脚自定义 HTML
├── friendsConfig.ts          # 友链配置
├── galleryConfig.ts          # 相册配置
├── homeCardsConfig.ts        # 首页入口卡片配置
├── licenseConfig.ts          # 许可证配置
├── mermaidConfig.ts          # Mermaid 图表配置
├── musicConfig.ts            # 音乐播放器配置
├── musicVisualizerConfig.ts  # 单曲页频谱可视化配置
├── navBarConfig.ts           # 导航栏配置（含 LinkPresets 链接预设）
├── osuConfig.ts              # osu 页面配置
├── pioConfig.ts              # 看板娘配置（Spine、Live2D）
├── plantumlConfig.ts         # PlantUML 图表配置
├── profileConfig.ts          # 用户资料配置
├── sidebarConfig.ts          # 侧边栏布局配置
├── sponsorConfig.ts          # 打赏配置
└── README.md                 # 本文件
```

## 🚀 使用方式

### 推荐：使用配置索引（统一导入）

```typescript
import { siteConfig, profileConfig } from "@/config";
```

### 直接导入单个配置

```typescript
import { siteConfig } from "@/config/siteConfig";
import { profileConfig } from "@/config/profileConfig";
```

## 📋 配置文件列表

| 文件 | 说明 |
|------|------|
| `index.ts` | 配置索引：把下面这些配置统一 re-export |
| `siteConfig.ts` | 站点基础配置（标题、描述、主题色、页面开关、语言、文章内容页配置等） |
| `analyticsConfig.ts` | 统计分析配置（Google Analytics、Microsoft Clarity、Umami、51la） |
| `announcementConfig.ts` | 公告配置（标题、内容、类型、链接等） |
| `backgroundWallpaper.ts` | 背景壁纸配置（壁纸模式、图片、多图轮播、横幅文字、水波纹等） |
| `booknavConfig.ts` | 书签导航配置（分类分组、书签项、favicon 自动获取） |
| `commentConfig.ts` | 评论系统配置（Twikoo、Waline、Artalk、Giscus、Disqus） |
| `coverImageConfig.ts` | 封面图配置（文章封面图、随机封面图 API、加载动画开关） |
| `displaySettingsConfig.ts` | 视图设置面板配置（面板总开关、各设置项开关） |
| `dynamicConfig.ts` | 动态页面配置（标题、描述、评论、每页数量、memos 接口） |
| `effectsConfig.ts` | 动画特效配置（樱花数量、速度、尺寸等） |
| `expressiveCodeConfig.ts` | 代码高亮配置（亮色/暗色主题、折叠、语言徽章） |
| `fontConfig.ts` | 字体配置（字体列表、回退、预加载、构建期子集化 `subsetFonts`） |
| `FooterConfig.html` | 页脚自定义 HTML 片段（直接写 HTML） |
| `friendsConfig.ts` | 友链配置（友链列表、页面设置） |
| `galleryConfig.ts` | 相册配置（相册列表、瀑布流列宽） |
| `homeCardsConfig.ts` | 首页入口卡片配置（标题栏、卡片列表、背景图） |
| `licenseConfig.ts` | 许可证配置（CC 协议等） |
| `mermaidConfig.ts` | Mermaid 图表渲染配置 |
| `musicConfig.ts` | 音乐播放器配置（导航栏/侧边栏开关、音量、播放模式、Meting 歌单） |
| `musicVisualizerConfig.ts` | 单曲页频谱可视化默认值（bars / height / 颜色 / 平滑 / FFT 等，可被歌曲 frontmatter 的 `theme.spectrum` 局部覆写） |
| `navBarConfig.ts` | 导航栏配置（动态链接、LinkPresets 链接预设、搜索配置） |
| `osuConfig.ts` | osu! 页面展示配置（最好成绩初始条数、每次加载步进） |
| `pioConfig.ts` | 看板娘配置（Spine 模型、Live2D 模型） |
| `plantumlConfig.ts` | PlantUML 图表渲染配置 |
| `profileConfig.ts` | 用户资料配置（头像、姓名、社交链接） |
| `sidebarConfig.ts` | 侧边栏布局配置（左侧/右侧/移动端组件列表） |
| `sponsorConfig.ts` | 打赏配置（打赏方式、打赏者列表） |

## 📝 说明

- 所有配置文件均可通过 `index.ts` 统一导入
- 每个配置文件对应 `types/` 目录下的独立类型定义文件
- `siteConfig.ts` 只保留站点核心信息，不聚合其他模块配置
- `siteConfig.lang` 默认 `zh_CN`，会被构建期环境变量 `PUBLIC_SITE_LANG` 覆盖（只认 `en` / `zh_CN` / `zh_TW` / `ja` / `ko` / `ru` 及其变体）；站点语言是**构建期常量**，不按访问者浏览器语言切换，也没有运行时切换入口
- `navBarConfig.ts` 底部的 `LinkPresets` 可自由自定义导航栏链接的名称、图标和 URL
- `displaySettingsConfig.ts` 的视图设置面板默认关闭，除了修改配置里的 `enable`，也可以在部署平台（Vercel / Cloudflare 等）设置环境变量 `PUBLIC_DISPLAY_SETTINGS=true` 开启，无需改动配置文件；环境变量优先级更高，取值 `true/1/on/yes` 开启、`false/0/off/no` 关闭
- 音乐相关有两个文件：`musicConfig.ts` 管播放器行为与歌单来源，`musicVisualizerConfig.ts` 只管单曲页的频谱可视化，两者互不影响
