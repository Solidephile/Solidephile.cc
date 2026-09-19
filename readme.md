# Solidephile.cc

这是我的个人网站，主要用于展示个人信息以及 osu! 游戏数据。

网站目前以 **React + Vite** 作为前端，使用 **Vercel** 部署，通过 **Vercel Serverless Functions** 提供后端 API，并使用 **Neon PostgreSQL** 保存 osu! 当前数据和历史数据，日后可能还会重构。

网站地址：

**https://solidephile.cc**

GitHub 仓库：

**https://github.com/Solidephile/Solidephile.cc**

(readme由ChatGPT生成，废话较多)

---

## 1、项目最初的想法

这个网站最开始只是一个非常简单的个人 GitHub Pages 页面。

当时我没有多少 Web 开发基础，希望做一个属于自己的网页，并且把自己在 osu! 上的一些数据放进去。

最开始希望展示的数据并不复杂，主要包括：

* 全球排名
* 国家排名
* PP
* 游戏时间

最初的目标其实只是：

> 做一个简单、好看，而且能够自动更新 osu! 数据的个人主页。

因此一开始并没有考虑数据库或者后端服务，而是采用了最简单的静态网站方案。

---

# 2、GitHub Pages + 静态 HTML

项目最开始使用的是传统的：

* HTML
* CSS
* JavaScript
* GitHub Pages

网站直接部署在 GitHub 仓库中，由 GitHub Pages 提供访问。

当时网页结构非常简单，JavaScript 直接读取一个 JSON 文件，例如：

```text
data/osu.json
```

JSON 中保存 osu! 数据，网页加载之后通过 JavaScript 读取数据并显示。

但是随着功能逐渐增加，这种结构的问题也开始出现。

---

# 3、接入 osu! API

为了让网站能够自动显示最新数据，我注册了 osu! OAuth 应用，并开始使用 osu! API。

网站通过 osu! API 获取指定用户的数据。

主要流程是：

1. 使用 osu! OAuth 获取 Access Token。
2. 使用 Access Token 请求 osu! API。
3. 获取用户的 statistics。
4. 提取需要的数据。
5. 保存为 JSON。
6. 网页读取 JSON 并显示。

当时使用的核心数据包括：

```text
username
avatar_url
country
country_code
global_rank
country_rank
pp
play_count
play_time
total_score
total_hits
accuracy
maximum_combo
updated_at
```

随着网站不断完善，展示的数据也从最初的几个指标扩展到了完整一些的 osu! 个人统计。

---

# 4、使用 GitHub Actions 自动更新

如果每次都手动调用 osu! API 再修改 JSON，显然不是一个长期可行的方案。

因此下一步加入了 GitHub Actions。

通过 GitHub Actions 定时运行 Node.js 脚本：

```text
scripts/update_osu.js
```

脚本负责：

1. 获取 osu! Access Token。
2. 获取我的 osu! 用户数据。
3. 生成新的 `osu.json`。
4. 保存历史数据。
5. 将修改提交回 GitHub 仓库。

这样网站就可以自动更新，而不需要每天手动修改数据。

当时的整体思路是：

```text
GitHub Actions
    ↓
osu! API
    ↓
生成 osu.json
    ↓
GitHub Repository
    ↓
GitHub Pages
    ↓
网页读取 JSON
```

---

# 5、历史数据

在自动更新当前数据之后，我又产生了一个新的需求：

> 不只是显示“现在是多少”，还希望知道过去发生了什么变化。

例如：

* 全球排名如何变化
* PP 如何变化
* 游戏时间如何增加
* Play Count 如何增长
* Accuracy 如何变化

因此增加了：

```text
data/osu_history.json
```

用来保存历史数据。

历史数据中的每一条记录都有自己的 `updated_at` 时间戳。

最开始 GitHub Actions 每次运行都可能生成新的历史记录，因此后来又加入了一个规则：

> 同一个 UTC+8 自然日最多保存一条新的历史数据。

这样即使自动任务一天运行多次，也不会产生大量重复的历史数据。

不过，这个规则只影响后来新增的数据。

数据库中的历史表仍然保留已有的历史记录，不会因为日期相同而删除旧记录。

---

# 6、GitHub Actions 遇到的问题

随着项目逐渐复杂，GitHub Actions 方案开始暴露出一些问题。

其中一个比较明显的问题是：

> 自动更新数据本身会修改 Git 仓库。

每次 Action 获取新的 osu! 数据之后，都需要修改 JSON 文件并产生新的 Git commit。

这意味着：

* 数据更新会产生 commit
* Git 历史中会出现大量自动生成的提交
* 本地修改和 Action 修改可能发生冲突
* push / pull / rebase 的过程变得更加麻烦

实际开发过程中也遇到过：

* push 被拒绝
* `fetch first`
* rebase
* JSON 文件冲突
* GitHub Actions 自动提交和本地提交发生冲突

通过将数据放到osu_data分支暂时解决了问题。

另外，GitHub Pages 对 JSON 的缓存也曾经造成过问题。

即使 GitHub 上的 `osu.json` 已经更新，网页有时仍然显示旧数据，需要手动强制刷新。

后来在 JavaScript 请求 JSON 时增加了时间戳参数：

```js
fetch(`/data/osu.json?t=${Date.now()}`)
```

用来避免浏览器缓存旧数据。

---

# 7、从 GitHub Pages 向 Vercel 迁移

随着网站功能增加，我开始重新考虑整个架构。

最初的 GitHub Pages 方案非常适合静态网页，但现在网站已经开始需要：

* 后端 API
* 数据库存储
* 定时任务
* 历史数据
* 更灵活的数据读取
* 更好的前后端分离

继续把所有数据直接放在 GitHub Repository 中已经不太合适。

因此开始进行一次比较大的架构调整：

> 从“GitHub Pages + JSON 文件”迁移到“Vercel + Serverless Function + PostgreSQL”。

同时，前端也从原来的单纯 HTML/CSS/JS 迁移到了 React。

---

# 8、购买域名

为了让网站拥有一个真正独立的地址，我购买了：

```text
solidephile.cc
```

域名最初通过腾讯云购买。

有了自己的域名之后，网站就不再只是一个 GitHub Pages 地址，而可以通过：

```text
https://solidephile.cc
```

直接访问。

---

# 9、Cloudflare DNS

购买域名之后，还需要配置 DNS，使域名能够正确指向 Vercel。

后来将域名的 DNS 托管迁移到了 Cloudflare。

Cloudflare 主要负责域名解析。

简单来说：

> 用户访问 `solidephile.cc` 时，DNS 负责告诉浏览器这个域名应该去哪里寻找网站。

而真正运行网站的服务则是 Vercel。

因此目前域名相关的职责大致是：

* 腾讯云：最初购买域名
* Cloudflare：DNS 解析
* Vercel：网站部署和运行

---

# 10、迁移到 React + Vite

前端随后从原来的静态 HTML/JavaScript 迁移到了 React + Vite。

选择 React 的主要原因并不是为了追求复杂的前端技术，而是因为随着页面越来越复杂，将页面拆成组件会更加容易维护。

目前主要的结构包括：

```text
src/
├── App.jsx
├── main.jsx
├── style.css
│
├── components/
│   ├── ChartCard.jsx
│   ├── Hero.jsx
│   └── ProfileCard.jsx
│
├── hooks/
│   └── useOsuData.js
│
├── utils/
│   └── formatters.js
│
└── assets/
    └── ...
```

其中：

### `App.jsx`

负责组织整个页面。

它不再直接处理所有细节，而是将页面拆分成多个组件。

### `components/`

用于保存页面组件。

例如：

* `Hero.jsx`：顶部区域
* `ProfileCard.jsx`：个人信息和 osu! 信息
* `ChartCard.jsx`：数据图表

### `hooks/useOsuData.js`

负责获取和处理 osu! 数据。

现在前端不再直接读取：

```text
data/osu.json
```

而是请求后端 API：

```text
/api/osu
```

### `utils/formatters.js`

保存一些数据格式化函数。

例如将秒数转换成更适合网页显示的游戏时间等。

---

# 11、引入 Neon PostgreSQL

前端迁移完成之后，另一个重要问题就是：

> 数据到底应该保存在哪里？

继续使用 JSON 文件已经不太合理。

因此引入了 Neon PostgreSQL。

Neon 提供云端 PostgreSQL 数据库，可以直接与 Vercel 配合使用。

目前数据库中主要有两个表：

```text
osu_current
osu_history
```

---

# 12、`osu_current` 表

`osu_current` 用来保存当前最新的 osu! 数据。

主要字段包括：

```text
id
username
avatar_url
country
country_code
global_rank
country_rank
pp
play_count
play_time
total_score
total_hits
accuracy
maximum_combo
updated_at
```

其中 `id = 1` 作为唯一的当前数据记录。

每次更新 osu! 数据时，会使用：

```sql
INSERT ... ON CONFLICT (id)
DO UPDATE
```

也就是说：

> 当前数据不是不断增加新记录，而是始终维护一份最新状态。

---

# 13、`osu_history` 表

历史数据则单独保存到：

```text
osu_history
```

主要字段包括：

```text
updated_at
global_rank
country_rank
pp
play_count
play_time
total_score
total_hits
accuracy
maximum_combo
```

`updated_at` 是主键。

历史数据与当前数据不同：

* `osu_current` 只保存现在的数据
* `osu_history` 保存过去的数据

因此可以通过历史表生成排名、PP、Play Time 等指标的变化曲线。

---

# 14、后端 API

迁移之后，网站增加了两个主要 API：

```text
/api/osu
/api/update_osu
```

---

## `/api/osu`

这个 API 负责从 Neon PostgreSQL 中读取数据。

前端请求：

```text
/api/osu
```

后端读取：

```text
osu_current
osu_history
```

然后组合成一个 JSON 返回给 React。

返回的数据结构大致为：

```json
{
    "stats": {},
    "history": []
}
```

这样前端不需要知道数据库的存在。

前端只需要：

> 请求 API → 获得数据 → 显示数据。

---

# 15、`/api/update_osu`

这个 API 负责更新数据。

执行过程大致为：

1. 检查环境变量。
2. 向 osu! OAuth 请求 Access Token。
3. 请求 osu! API。
4. 获取最新用户数据。
5. 更新 `osu_current`。
6. 判断 UTC+8 当天是否已经保存过历史数据。
7. 如果当天没有记录，则写入 `osu_history`。
8. 返回更新结果。

因此现在的数据流已经变成：

> osu! API → `/api/update_osu` → Neon PostgreSQL → `/api/osu` → React

---

# 16、为什么不让前端直接访问 osu! API

现在前端并不会直接请求 osu! API。

这样做主要有几个原因。

首先，osu! OAuth 的 Client Secret 属于敏感信息，不能放进浏览器端 JavaScript。

如果把这些信息放到前端，任何访问网站的人都可以通过浏览器开发者工具看到。

因此：

> osu! API 的认证和数据获取必须放在服务器端。

其次，数据库也不应该直接暴露给前端。

所以现在采用了前后端分离的方式：

```text
浏览器
   ↓
/api/osu
   ↓
Neon PostgreSQL
```

而更新数据时：

```text
Vercel Cron
   ↓
/api/update_osu
   ↓
osu! API
   ↓
Neon PostgreSQL
```

---

# 17、Vercel 部署

前端和 API 最终部署到了 Vercel。

GitHub Repository 与 Vercel 项目连接之后，每次向 `main` 分支 push 新代码，Vercel 都可以自动重新构建和部署。

因此现在 GitHub 主要负责：

* 保存源代码
* 保存项目历史
* 触发部署

而不再负责保存运行时的 osu! 数据。

这是与最初 GitHub Pages 方案最大的区别之一。

---

# 18、Vercel Cron 自动更新

为了让数据库中的 osu! 数据能够自动更新，加入了 Vercel Cron。

当前配置位于：

```text
vercel.json
```

目前配置为：

```json
{
    "crons": [
        {
            "path": "/api/update_osu",
            "schedule": "0 2 * * *"
        }
    ]
}
```

这里使用的是 UTC 时间。

因此：

```text
02:00 UTC
=
10:00 UTC+8
```

也就是说网站每天大约在北京时间 / UTC+8 的 10:00 自动更新一次。

Vercel Cron 可以按照 `vercel.json` 中的 cron expression 定时调用 Vercel Function。

---

# 19、为更新 API 增加 CRON_SECRET

在没有鉴权的时候，任何人都可以尝试直接访问：

```text
/api/update_osu
```

这意味着任何人都可能尝试触发一次 osu! 数据更新。

因此后来为这个 API 增加了 `CRON_SECRET`。

现在 `/api/update_osu` 会检查：

```text
Authorization: Bearer <CRON_SECRET>
```

如果请求没有正确的 Authorization Header，就返回：

```json
{
    "success": false,
    "error": "Unauthorized"
}
```

因此现在直接在浏览器访问：

```text
https://solidephile.cc/api/update_osu
```

会得到：

```json
{
    "success": false,
    "error": "Unauthorized"
}
```

这是正常现象。

Vercel Cron 可以配合 `CRON_SECRET` 对 Cron Job 请求进行保护。

手动测试时，如果需要调用这个接口，则需要提供正确的 Authorization Header。

---

# 20、环境变量

目前项目涉及的主要环境变量包括：

```text
OSU_CLIENT_ID
OSU_CLIENT_SECRET
OSU_USERNAME
DATABASE_URL
CRON_SECRET
```

其中：

### `OSU_CLIENT_ID`

osu! OAuth 应用的 Client ID。

### `OSU_CLIENT_SECRET`

osu! OAuth 应用的 Client Secret。

这是敏感信息。

### `OSU_USERNAME`

需要获取数据的 osu! 用户名。

### `DATABASE_URL`

Neon PostgreSQL 数据库连接字符串。

### `CRON_SECRET`

用于保护 `/api/update_osu` 的 Secret。

---

# 21、本地开发

项目使用 Node.js 和 Vite。

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

本地开发时需要准备环境变量。

目前本地使用 `.env` 保存开发环境变量。

例如：

```env
OSU_CLIENT_ID=...
OSU_CLIENT_SECRET=...
OSU_USERNAME=Solidephile
DATABASE_URL=...
CRON_SECRET=...
```

`.env` 不应该提交到 Git。

因此项目的 `.gitignore` 应该包含：

```text
.env
.env.local
```

---

# 22、目前的整体架构

经过多次重构，目前网站的核心运行方式已经发生了比较大的变化。

用户访问网站时：

```text
solidephile.cc
```

请求首先到达 Vercel。

React 前端加载之后，请求：

```text
/api/osu
```

然后 Vercel Serverless Function 从 Neon PostgreSQL 读取：

* 当前 osu! 数据
* osu! 历史数据

最后返回给 React，由前端负责显示。

而数据更新则完全是另一条流程：

Vercel Cron 每天定时调用：

```text
/api/update_osu
```

该接口向 osu! API 请求最新数据，然后将数据写入 Neon。

因此目前网站可以概括为：

> **Vercel 负责网站和后端运行，Neon 负责数据存储，osu! API 提供数据来源，Cloudflare 负责 DNS，GitHub 负责代码仓库和版本管理。**

---

# 23、从最开始到现在

这个项目实际上经历了几次比较明显的架构变化。

最开始只是：

> HTML + CSS + JavaScript + GitHub Pages

然后为了自动更新 osu! 数据，加入：

> osu! API + GitHub Actions + JSON

之后为了保存历史数据，又加入：

> osu! 历史数据 JSON

随着项目规模增加，GitHub Actions 自动提交数据、JSON 文件存储等方式开始出现维护上的问题，于是开始重新设计架构。

之后完成：

> React + Vite

再进一步加入：

> Vercel + Serverless Functions

然后购买自己的域名：

> `solidephile.cc`

并配置：

> Cloudflare DNS → Vercel

最后加入：

> Neon PostgreSQL

将运行时数据从 GitHub Repository 中彻底分离出来。

目前最终形成：

> **React + Vite + Vercel + Neon PostgreSQL + osu! API + Vercel Cron + Cloudflare DNS**

这也是目前这个项目的主要技术架构。

---

# 24、为什么最终选择这个架构

这个项目并不是一开始就按照现在的架构设计的。

实际上，现在的结构是在不断遇到问题之后逐步形成的。

最初使用 GitHub Pages，是因为它简单，而且不需要服务器。

使用 GitHub Actions，是因为需要自动获取 osu! 数据。

使用 JSON，是因为当时数据量很小，并不需要数据库。

但是随着功能增加，开始需要历史数据、API、定时任务和更灵活的数据管理，于是原来的方案逐渐变得不再合适。

因此后面的每一次重构，基本都是为了解决前一个阶段出现的问题：

* 静态页面 → React：方便组件化和维护
* JSON → PostgreSQL：让运行时数据与代码仓库分离
* GitHub Actions → Vercel Cron：减少数据更新对 Git 仓库的影响
* GitHub Pages → Vercel：同时承载前端和 Serverless API
* GitHub Pages 默认域名 → 自定义域名：拥有独立的网站地址
* 无后端 → Serverless Functions：处理 osu! API 和数据库访问
* 无鉴权的更新接口 → `CRON_SECRET`：避免任何人随意触发数据更新

因此这个网站的架构并不是一次设计完成的，而是在实际开发过程中逐渐演化出来的。

---

# 25、目前已经实现的功能

目前网站已经实现：

* 自定义域名 `solidephile.cc`
* React 前端
* 响应式页面
* osu! 个人资料展示
* osu! 当前统计数据
* osu! 历史数据
* 数据变化图表
* osu! API 自动获取
* Neon PostgreSQL 数据库存储
* Vercel Serverless API
* Vercel Cron 定时更新
* `CRON_SECRET` API 鉴权
* GitHub → Vercel 自动部署

---

# 26、后续计划

目前网站的基础架构已经基本完成，之后主要考虑继续完善前端和数据功能。

可能的方向包括：

* 进一步完善 osu! 数据图表
* 增加更多历史统计指标
* 优化移动端显示
* 优化网站动画和视觉效果
* 增加更多个人信息
* 增加 osu! 成绩相关内容
* 对历史数据进行更丰富的分析
* 清理旧的 GitHub Actions 和 JSON 数据文件
* 删除已经不再使用的 `osu_data` 分支
* 进一步优化 API 缓存和数据库访问

未来如果需要继续增加功能，也可以在目前的基础上继续扩展，而不需要重新设计整个网站。

---

# 27、项目状态

**当前状态：正常运行。**

网站：

```text
https://solidephile.cc
```

数据来源：

```text
osu! API
```

数据库：

```text
Neon PostgreSQL
```

部署：

```text
Vercel
```

DNS：

```text
Cloudflare
```

代码仓库：

```text
GitHub
```

自动更新：

```text
Vercel Cron
```

更新接口：

```text
/api/update_osu
```

数据读取接口：

```text
/api/osu
```

目前网站已经从最初的一个简单 GitHub Pages 静态页面，逐渐发展成了一个具有前端、Serverless 后端、云数据库、定时任务和自定义域名的完整小型 Web 项目。

这个项目本身也是我学习 Web 开发、API、数据库、部署、DNS、Serverless 和前后端分离的一个实践过程。
