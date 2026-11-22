<script lang="ts">
import { onMount } from "svelte";
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

function retryMeting(): void {
	metingStatus = "idle";
	void loadMeting();
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
				? "本地曲目为完整版，有单曲页面"
				: "网易云VIP歌曲只有试听，无单曲页面"}
		</p>
	</div>

	{#if mode === "local"}
		{#if entries.length === 0}
			<p class="empty">还没有收录歌曲。</p>
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
								<a class="title text-90" href={`/music/${entry.track.slug}/`}>{entry.track.title}</a>
							{:else}
								<span class="title text-90">{entry.track.title}</span>
							{/if}

							<p class="meta">
								<span>{entry.track.artist}</span>
								{#if entry.year}<span>{entry.year}</span>{/if}
								{#if entry.track.duration > 0}
									<span>{formatDuration(entry.track.duration)}</span>
								{/if}
								{#if entry.track.bpm != null}
									<span>{entry.track.bpm} BPM</span>
								{/if}
								{#if entry.category}<span>{entry.category}</span>{/if}
							</p>

							{#if entry.tags && entry.tags.length > 0}
								<ul class="tags">
									{#each entry.tags.slice(0, 3) as tag (tag)}
										<li>{tag}</li>
									{/each}
								</ul>
							{/if}
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
		<p class="empty">
			歌单加载失败，<button type="button" class="link" onclick={retryMeting}>重试</button>
		</p>
	{:else if metingStatus !== "ready"}
		<p class="empty">正在加载歌单…</p>
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

	.row + .row {
		border-top: 1px solid var(--line-divider);
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

	/* 正在播放：右侧的跳动频谱（和导航栏播放器列表里那套动画一致） */
	.eq {
		display: flex;
		flex-shrink: 0;
		align-items: flex-end;
		gap: 2px;
		height: 0.85rem;
		margin-right: 0.15rem;
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
	}

	/* 只有可点的标题（本地曲目的链接）给 hover 反馈 */
	a.title:hover {
		color: var(--primary);
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem 0.75rem;
		margin: 0;
		color: var(--content-meta);
		font-size: 0.75rem;
	}

	.tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
		margin: 0.1rem 0 0;
		padding: 0;
		list-style: none;
	}

	.tags li {
		padding: 0.05rem 0.45rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--primary) 12%, transparent);
		color: var(--content-meta);
		font-size: 0.6875rem;
	}

	.empty {
		margin: 0;
		padding: 1.5rem 0;
		color: var(--content-meta);
		font-size: 0.875rem;
	}

	.link {
		padding: 0;
		border: 0;
		background: none;
		color: var(--primary);
		font: inherit;
		cursor: pointer;
		text-decoration: underline;
	}
</style>
