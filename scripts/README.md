# scripts - 构建脚本与生成器

构建期生成数据、后处理 `dist/`、以及两个内容脚手架。生成物默认提交到仓库（`src/constants/*.json`、`public/vndb-covers/` 除外，后者 gitignore）。

## 生成器（有对应 pnpm 命令）

| 文件 | 命令 | 生成物 / 说明 |
|---|---|---|
| `generate-lqips.ts` | `pnpm lqips` | `src/constants/lqips.json`：本地图片的 LQIP 占位渐变 |
| `generate-home-card-lqips.ts` | `pnpm home-covers` | `src/constants/home-card-lqips.json`：首页卡片封面（外部 URL）的 LQIP |
| `generate-beatmap-card-data.ts` | `pnpm beatmaps` | `src/constants/beatmap-card-data.json`：osu 谱面卡片数据（需 `.env` 里的 osu 凭据） |
| `generate-github-card-data.ts` | `pnpm github-cards` | `src/constants/github-card-data.json`：GitHub 卡片数据 |
| `generate-vndb-covers.ts` | `pnpm build` 第 5 步 | `public/vndb-covers/`：VNDB 封面（默认 no-op，需 `siteConfig.vndb` 配置且静态模式） |

## 构建后处理（由 `pnpm build` 按顺序调用）

- `prune-pio-assets.ts` - 看板娘关闭时把 `dist/pio` 整个删掉（省 15 MiB 左右）
- `subset-fonts.ts` - 扫描 `dist/**/*.html` 收集字符，把本地字体子集化成 woff2 并删除原 TTF
- `subset-font.d.ts` - `subset-font` 包的最小类型声明（该包没有自带类型）
- `minify-inline-scripts.ts` - 压缩 Astro 原样输出的 `is:inline` 脚本
- `run-pagefind.ts` - 在 `astro build` 之后跑 Pagefind（兼容 Cloudflare Pages 产物路径）

## 辅助模块

- `site-root.ts` - 解析构建产物根目录（Cloudflare Pages 上构建时会切换，供后处理脚本共用）

## 内容脚手架

- `new-post.js` - `pnpm new-post <file>`，在 `src/content/posts` 生成带 frontmatter 的文章
- `new-dynamic.js` - `pnpm new-dynamic` / `pnpm new-d`，在 `src/content/dynamic` 生成动态条目

## 手动工具（未接进 package.json）

- `quarantine-bad-posts.mjs` - 把引用了不存在图片的文章移到 `src/content/posts/_quarantine/`，不丢内容
