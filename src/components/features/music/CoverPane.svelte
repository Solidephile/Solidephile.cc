<script lang="ts">
import type { MusicVisualizerConfig } from "@/config/musicVisualizerConfig";
import type { MusicTrack } from "@/types/music";
import { formatDuration } from "@/utils/time-utils";
import { player } from "./player.svelte";
import Spectrum from "./Spectrum.svelte";

/**
 * 左栏（移动端第一屏）：封面 + 标题 + 元数据 + 频谱
 *
 * 曲目由 MusicStage 透传（就是这一页的歌，和全局播放器当前在放哪首无关）；
 * 「介绍卡上的东西」（发布日期、标签）和频谱配置也是外面给的。
 *
 * 频谱放在这一屏的底部：桌面上它正好在控制条上方；移动端因为属于封面屏，
 * 滑到歌词屏时自然就消失了（不用额外判断当前是第几屏）。
 */
let {
	track,
	published = "",
	tags = [],
	spectrum,
}: {
	track: MusicTrack | null;
	published?: string;
	tags?: string[];
	spectrum: MusicVisualizerConfig;
} = $props();

const title = $derived(track?.title ?? "");
const artist = $derived(track?.artist ?? "");
const cover = $derived(track?.cover ?? "");

const durationText = $derived(formatDuration(player.stageDuration));
</script>

<div class="cover-pane">
	<div class="stage">
		<div class="art-wrap">
			{#if cover}
				<img
					class="art"
					src={cover}
					alt={`${title} 封面`}
					width="800"
					height="800"
					loading="eager"
					decoding="async"
				/>
			{:else}
				<div class="art art-empty" aria-hidden="true"></div>
			{/if}
		</div>

		<div class="head">
			<h1 class="title" title={title}>{title}</h1>
			<p class="artist" title={artist}>{artist}</p>
		</div>

		<dl class="meta">
			<div>
				<dt>时长</dt>
				<dd>{durationText}</dd>
			</div>
			<div>
				<dt>BPM</dt>
				<dd>{track?.bpm ?? "-"}</dd>
			</div>
			{#if published}
				<div>
					<dt>发布</dt>
					<dd>{published}</dd>
				</div>
			{/if}
		</dl>

		{#if tags.length > 0}
			<ul class="tags">
				{#each tags as tag (tag)}
					<li>{tag}</li>
				{/each}
			</ul>
		{/if}
	</div>

	{#if spectrum.enable}
		<Spectrum {...spectrum} />
	{/if}
</div>

<style>
	.cover-pane {
		position: relative;
		display: flex;
		height: 100%;
		min-width: 0;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1.25rem 1.25rem 0.75rem;
		text-align: center;
	}

	/* 封面/标题/元数据在剩余空间里居中，频谱钉在底部 */
	.stage {
		display: flex;
		flex: 1;
		min-height: 0;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.75rem;
	}

	.art-wrap {
		width: min(68%, 260px);
		flex-shrink: 0;
	}

	.art {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		border-radius: calc(var(--radius-large) - 2px);
		object-fit: cover;
		box-shadow:
			0 1px 2px rgb(0 0 0 / 0.12),
			0 18px 40px -18px rgb(0 0 0 / 0.45);
	}

	.art-empty {
		background: color-mix(in oklab, var(--music-accent) 18%, transparent);
	}

	.head {
		display: flex;
		min-width: 0;
		max-width: 100%;
		flex-direction: column;
		gap: 0.2rem;
	}

	.title {
		margin: 0;
		overflow: hidden;
		font-size: clamp(1.25rem, 1.05rem + 1.6vw, 1.55rem);
		font-weight: 700;
		line-height: 1.35;
		color: var(--music-ink);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.artist {
		margin: 0;
		overflow: hidden;
		font-size: clamp(0.9rem, 0.85rem + 0.3vw, 1rem);
		color: var(--content-meta);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.meta {
		display: none;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem 1.1rem;
		margin: 0;
	}

	.meta > div {
		display: flex;
		flex-direction: column;
		gap: 1px;
	}

	.meta dt {
		font-size: 0.625rem;
		letter-spacing: 0.09em;
		color: var(--content-meta);
		opacity: 0.75;
	}

	.meta dd {
		margin: 0;
		font-size: 0.78rem;
		font-variant-numeric: tabular-nums;
		color: var(--music-ink);
	}

	.tags {
		display: none;
		flex-wrap: wrap;
		justify-content: center;
		gap: 0.35rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.tags li {
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--music-accent) 14%, transparent);
		color: color-mix(in oklab, var(--music-ink) 82%, transparent);
		font-size: 0.6875rem;
	}

	@media (min-width: 768px) {
		.cover-pane {
			padding: 1.25rem 1.25rem;
		}

		.art-wrap {
			/* 随封面栏宽度自然收缩；下方要给频谱留位置 */
			width: min(100%, 260px);
		}

		.meta {
			display: flex;
		}

		.tags {
			display: flex;
		}
	}
</style>
