<script lang="ts">
import { onMount } from "svelte";
import LoadingState from "@/components/common/LoadingState.svelte";
import StateMessage from "@/components/common/StateMessage.svelte";
import { player } from "@/components/features/music/player.svelte";
import type { MusicListEntry } from "@/types/music";
import { formatDuration } from "@/utils/time-utils";

/**
 * 音乐索引
 *
 * 切 tab 只切列表，不动正在播放的那一首；点整行才播放（本地队列 = 整份本地歌单，
 * 网易云则是整份歌单），本地曲目的标题另外可以进详情页。
 */
let { entries }: { entries: MusicListEntry[] } = $props();

type Mode = "local" | "meting";

let mode = $state<Mode>("local");
let metingEntries = $state<MusicListEntry[]>([]);
let metingStatus = $state<"idle" | "loading" | "ready" | "error">("idle");

// 接上全局播放器，才能知道哪一行正在放
onMount(() => player.connect());

const current = $derived(player.track?.audio ?? "");

function isCurrent(entry: MusicListEntry): boolean {
	return current !== "" && current === entry.track.audio;
}

/** 本地行的元数据：artist · 年份 · 时长 · BPM（分类单独做成行尾胶囊） */
function metaText(entry: MusicListEntry): string {
	const parts = [entry.track.artist];
	if (entry.year) parts.push(entry.year);
	if (entry.track.duration > 0)
		parts.push(formatDuration(entry.track.duration));
	if (entry.track.bpm != null) parts.push(`${entry.track.bpm} BPM`);
	return parts.join(" · ");
}

async function loadMeting(): Promise<void> {
	if (metingStatus === "loading" || metingStatus === "ready") return;

	metingStatus = "loading";
	try {
		const list = await player.loadMeting();
		metingEntries = list.map((track) => ({ track }));
		metingStatus = list.length > 0 ? "ready" : "error";
	} catch {
		metingStatus = "error";
	}
}

function selectMode(next: Mode): void {
	if (mode === next) return;
	mode = next;

	// 切 tab 只换列表：不动队列，正在放的那一首继续放；真正换来源是按下某行的播放
	if (next === "meting") void loadMeting();
}

function playLocal(entry: MusicListEntry): void {
	player.connect();
	player.toggleTrack(entry.track);
}

function playMetingRow(entry: MusicListEntry, index: number): void {
	if (isCurrent(entry)) {
		// 暂停/继续只归播放键：点当前这一条只负责「继续」，不负责暂停
		if (!player.playing) player.togglePause();
		return;
	}

	player.playMeting(
		metingEntries.map((item) => item.track),
		index,
	);
}
</script>

<div class="music-index">
	<div class="head">
		<div class="segmented" role="tablist" aria-label="播放来源">
			<button
				type="button"
				role="tab"
				aria-selected={mode === "local"}
				data-active={mode === "local"}
				onclick={() => selectMode("local")}>本地歌曲</button
			>
			<button
				type="button"
				role="tab"
				aria-selected={mode === "meting"}
				data-active={mode === "meting"}
				onclick={() => selectMode("meting")}>网易云歌单</button
			>
		</div>

		<p class="hint">
			{mode === "local"
				? "完整音源 · 独立单曲页"
				: "在线试听 · 无单曲页"}
		</p>
	</div>

	{#if mode === "local"}
		{#if entries.length === 0}
			<StateMessage
				icon="material-symbols:play-circle"
				title="还没有收录歌曲"
			/>
		{:else}
			<ul class="list">
				{#each entries as entry (entry.track.slug ?? entry.track.audio)}
					{@const active = isCurrent(entry)}
					<li class="row" data-active={active}>
						{#if entry.track.cover}
							<img class="cover" src={entry.track.cover} alt="" loading="lazy" />
						{:else}
							<span class="cover cover-empty"></span>
						{/if}

						<div class="body">
							{#if entry.track.slug}
								<a class="title text-90" href={`/music/${entry.track.slug}/`}>
									<span class="title-text">{entry.track.title}</span>
									<!-- 箭头在链接内部：点标题或点箭头都进单曲页。文字放进
									     .title-text 里负责截断，箭头不参与收缩 -->
									<svg class="title-arrow" viewBox="0 0 16 16" aria-hidden="true">
										<path d="M6 3l5 5-5 5" />
									</svg>
								</a>
							{:else}
								<span class="title text-90">{entry.track.title}</span>
							{/if}

							<p class="meta">
								{metaText(entry)}
								{#if entry.category}
									<span class="meta-tag">{entry.category}</span>
								{/if}
							</p>
						</div>

						{#if active && player.playing}
							<span class="eq" aria-hidden="true">
								<span></span><span></span><span></span>
							</span>
						{/if}

						<!-- 整行点击 = 就地播放（不跳页）；标题链接浮在它上面，点标题只负责导航。
						     正在播放的这一行不再可点：暂停/继续只归播放键，免得点一行就把歌停了 -->
						{#if !(active && player.playing)}
							<button
								type="button"
								class="row-hit"
								aria-label={active
									? `继续 ${entry.track.title}`
									: `播放 ${entry.track.title}`}
								onclick={() => playLocal(entry)}
							></button>
						{/if}
					</li>
				{/each}
			</ul>
		{/if}
	{:else if metingStatus === "error"}
		<StateMessage
			variant="error"
			icon="material-symbols:error-outline"
			title="歌单加载失败"
			description="请稍后刷新页面重试"
		/>
	{:else if metingStatus !== "ready"}
		<LoadingState text="正在加载歌单…" />
	{:else}
		<ul class="list">
			{#each metingEntries as entry, index (entry.track.audio)}
				{@const active = isCurrent(entry)}
				<li class="row" data-active={active}>
					{#if entry.track.cover}
						<img class="cover" src={entry.track.cover} alt="" loading="lazy" />
					{:else}
						<span class="cover cover-empty"></span>
					{/if}

					<div class="body">
						<span class="title text-90">{entry.track.title}</span>
						<p class="meta"><span>{entry.track.artist}</span></p>
					</div>

					{#if active && player.playing}
						<span class="eq" aria-hidden="true">
							<span></span><span></span><span></span>
						</span>
					{/if}

					<!-- 云端曲目没有详情页，标题不可点；整行点击 = 播放（正在播放的那行同理不可点） -->
					{#if !(active && player.playing)}
						<button
							type="button"
							class="row-hit"
							aria-label={active
								? `继续 ${entry.track.title}`
								: `播放 ${entry.track.title}`}
							onclick={() => playMetingRow(entry, index)}
						></button>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.music-index {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	/* 来源切换：两颗胶囊 */
	.segmented {
		display: inline-flex;
		padding: 0.2rem;
		border-radius: 999px;
		background-color: var(--btn-regular-bg);
	}

	.segmented button {
		padding: 0.35rem 0.9rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--content-meta);
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
		transition:
			background-color 200ms ease,
			color 200ms ease;
	}

	.segmented button[data-active="true"] {
		background-color: var(--card-bg);
		color: var(--primary);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.08);
	}

	.hint {
		margin: 0;
		color: var(--content-meta);
		font-size: 0.75rem;
	}

	.list {
		display: flex;
		flex-direction: column;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		position: relative;
		display: flex;
		align-items: center;
		gap: 0.9rem;
		padding: 0.65rem 0.25rem;
		border-radius: var(--radius-large);
		transition: background-color 160ms ease;
	}

	/* 分割线用伪元素画成直线：给 .row 直接加 border-top 的话，1px 边框会沿着
	   圆角往下拐，行与行之间会露出一小段弧（左上 / 右上角），深色下也看得见。
	   长度取高亮圆角卡片顶边的直线段：两端各让出一个圆角半径 */
	.row + .row::before {
		content: "";
		position: absolute;
		top: 0;
		left: var(--radius-large);
		right: var(--radius-large);
		height: 1px;
		background-color: var(--line-divider);
		pointer-events: none;
	}

	/* 两档主题色底色：hover = 很淡的一层，当前曲目 = 再浓一档。
	   用 color-mix 叠在卡片底色上，白天/黑夜自动跟随（--primary 两套主题各有一版）
	   顺序：当前曲目的规则放在 hover 之后，正在播放的那一行（已经不可点）
	   不会被 hover 冲淡；深色那两条同理，都放最后。 */
	.row:hover {
		background-color: color-mix(in oklab, var(--primary) 6%, transparent);
	}

	.row[data-active="true"] {
		background-color: color-mix(in oklab, var(--primary) 13%, transparent);
	}

	:global(.dark) .row:hover {
		background-color: color-mix(in oklab, var(--primary) 6%, transparent);
	}

	:global(.dark) .row[data-active="true"] {
		background-color: color-mix(in oklab, var(--primary) 13%, transparent);
	}

	/* 封面只是图片；整行的点击交给 .row-hit（透明覆盖层） */
	.cover {
		display: block;
		width: 3.5rem;
		height: 3.5rem;
		flex-shrink: 0;
		border-radius: calc(var(--radius-large) - 2px);
		object-fit: cover;
	}

	.cover-empty {
		background: color-mix(in oklab, var(--primary) 12%, transparent);
	}

	/* 覆盖整行的播放热区：在标题链接下面一层，所以点标题只跳转、点别处就播放 */
	.row-hit {
		position: absolute;
		inset: 0;
		z-index: 1;
		padding: 0;
		border: 0;
		border-radius: inherit;
		background: transparent;
		cursor: pointer;
	}

	.row-hit:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--primary) 60%, transparent);
		outline-offset: -2px;
	}

	/* 正在播放：右侧的跳动频谱（和导航栏播放器列表里那套动画一致）。
	   右端留白和分割线对齐：行的右 padding 0.25rem + 这里的 0.75rem = 1rem，
	   等于 --radius-large，所以图标正好落在高亮圆角卡片的直线段右端 */
	.eq {
		display: flex;
		flex-shrink: 0;
		align-items: flex-end;
		gap: 2px;
		height: 0.85rem;
		margin-right: 0.75rem;
		color: var(--primary);
	}

	.eq span {
		width: 3px;
		height: 4px;
		border-radius: 2px;
		background-color: currentColor;
		animation: eq-bounce 1.2s ease-in-out infinite;
	}

	.eq span:nth-child(1) {
		animation-duration: 0.8s;
	}

	.eq span:nth-child(2) {
		animation-duration: 0.6s;
		animation-delay: 0.15s;
	}

	.eq span:nth-child(3) {
		animation-duration: 1s;
		animation-delay: 0.3s;
	}

	@keyframes eq-bounce {
		0%,
		100% {
			height: 4px;
		}
		50% {
			height: 14px;
		}
	}

	.body {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: 0.15rem;
	}

	.title {
		align-self: flex-start;
		max-width: 100%;
		overflow: hidden;
		font-size: 1rem;
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
		text-decoration: none;
	}

	/* 只有本地曲目的标题是链接：浮到整行播放热区上面，点标题只跳转、不播放。
	   云端曲目没有详情页，标题保持普通文本 —— 不设 z-index，点击就穿透到整行热区 */
	a.title {
		position: relative;
		z-index: 2;
		display: inline-flex;
		align-items: center;
		gap: 0.3rem;
	}

	/* 截断交给内层文字：长标题只掐文字，右侧箭头始终留在原地 */
	a.title .title-text {
		min-width: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/* 「进入单曲页」的提示箭头：默认用比标题（black/90）稍浅的深灰，
	   保持「提示」的强度而不是正文；hover / 键盘 focus 到标题时变主题色
	   并右移 2px，指向「前进」 */
	a.title .title-arrow {
		flex-shrink: 0;
		width: 0.875rem;
		height: 0.875rem;
		fill: none;
		stroke: currentColor;
		stroke-width: 1.75;
		stroke-linecap: round;
		stroke-linejoin: round;
		color: rgba(0, 0, 0, 0.8);
		transition:
			color 150ms ease,
			transform 150ms ease;
	}

	/* 深色模式对称处理：压暗的白，比标题的 white/90 退一档 */
	:global(.dark) a.title .title-arrow {
		color: rgba(255, 255, 255, 0.72);
	}

	a.title:hover,
	a.title:focus-visible {
		color: var(--primary);
	}

	a.title:hover .title-arrow,
	a.title:focus-visible .title-arrow {
		color: var(--primary);
		transform: translateX(2px);
	}

	@media (prefers-reduced-motion: reduce) {
		a.title .title-arrow {
			transition: color 150ms ease;
		}

		a.title:hover .title-arrow,
		a.title:focus-visible .title-arrow {
			transform: none;
		}
	}

	/* 元数据一行：artist · 年份 · 时长 · BPM，行尾跟分类胶囊。
	   不排成 flex，让文字自然换行（窄屏宁可两行也不丢信息） */
	.meta {
		margin: 0;
		color: var(--content-meta);
		font-size: 0.75rem;
		line-height: 1.5;
	}

	/* 分类胶囊：行尾的「归属」标记，沿用原来标签那套淡主题色底。
	   对齐用默认的 vertical-align: baseline —— inline-flex 的基线取自第一个
	   flex 项，这样胶囊里的文字和元数据文字落在同一条基线上；用 middle
	   （按盒子中线对齐）时胶囊盒会比文字低 1px 左右，看起来像没对齐 */
	.meta-tag {
		display: inline-flex;
		align-items: center;
		margin-left: 0.35rem;
		padding: 0.05rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--primary) 12%, transparent);
		color: var(--content-meta);
		font-size: 0.6875rem;
		line-height: 1.35;
	}
</style>
