---
title: "示例项目"
slug: example-project
published: 2026-09-21
draft: false
order: 100
description: "本文档介绍项目集合的 Frontmatter 字段与状态键值，供你在 src/content/projects/ 下编写项目时参考。"
image: "images/test.avif"
status: "developing"
tags:
  - 测试
---

## 项目展示页使用指南

在 `src/content/projects/` 下新建一个 `.md` 或 `.mdx` 文件即可创建一个项目。**正文就是项目 README**，渲染在详情页底部；**frontmatter** 里的字段则用于列表卡片与详情页顶部展示。

## Frontmatter 字段

| 字段 | 类型 | 说明 |
|---|---|---|
| `title` | string | 必填。项目名称。 |
| `slug` | string | 可选，和文章一样使用。 |
| `published` | date | 必填。发布/更新日期，如 `2025-10-01`。用于排序（配合 `order`）。 |
| `draft` | boolean | 可选，默认 `false`。设为 `true` 时生产构建会隐藏该页，预览可见。 |
| `order` | number | 可选。手动排序权重，**越大越靠前**；未设置则按 `published` 降序。 |
| `description` | string | 可选。卡片简介 + 详情页描述。 |
| `image` | string | 可选。封面图。支持完整 URL、公共根路径（`/images/xxx.png`）、相对路径（相对本文件目录，如 `images/xxx.png`）。留空则不显示封面。 |
| `tags` | string[] | 可选。标签，列表页与详情页显示为 `#标签`。 |
| `link` | array | 可选。外链按钮数组：`{ label, icon, value }`。`icon` 可用 astro-icon 名（如 `fa7-brands:github`）、图片 URL，或留空用 `label` 首字母。 |
| `status` | string | 可选。项目状态，用标准 key（见下表）。 |
| `lang` | string | 可选。页面语言，如 `zh_CN`。 |
