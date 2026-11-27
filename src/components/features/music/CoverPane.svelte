<script lang="ts">
import Icon from "@components/common/Icon.svelte";
import type { MusicVisualizerConfig } from "@/config/musicVisualizerConfig";
import type { MusicTrack } from "@/types/music";
import Spectrum from "./Spectrum.svelte";

/**
 * 左栏（移动端第一屏）：封面 + 标题 + 一句话描述 + 频谱
 *
 * 曲目由 MusicStage 透传（就是这一页的歌，和全局播放器当前在放哪首无关）；
 * 「介绍卡上的东西」（发布日期、标签）和频谱配置也是外面给的。
 * 专辑封面下的元数据已收进下方「关于这首歌」卡片，这里只保留引用式的一句话描述。
 *
 * 频谱放在这一屏的底部：桌面上它正好在控制条上方；移动端因为属于封面屏，
 * 滑到歌词屏时自然就消失了（不用额外判断当前是第几屏）。
 */
let {
	track,
	quote = "",
	spectrum,
}: {
	track: MusicTrack | null;
	quote?: string;
	spectrum: MusicVisualizerConfig;
} = $props();

const title = $derived(track?.title ?? "");
const artist = $derived(track?.artist ?? "");
const cover = $derived(track?.cover ?? "");
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

		{#if quote}
			<div class="quote-block">
				<span class="quote-divider" aria-hidden="true"></span>
				<div class="quote" title={quote}>
					<span class="quote-mark quote-mark-start" aria-hidden="true">
						<Icon icon="material-symbols:format-quote-rounded" />
					</span>
					<p class="quote-text">{quote}</p>
					<span class="quote-mark quote-mark-end" aria-hidden="true">
						<Icon icon="material-symbols:format-quote-rounded" />
					</span>
				</div>
			</div>
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

	.quote-block {
		display: flex;
		max-width: 100%;
		flex-direction: column;
		align-items: center;
		gap: 0.5rem;
	}

	/* 和艺术家之间用一条短横线分隔（与横幅的引用块同一结构） */
	.quote-divider {
		display: block;
		width: 2.25rem;
		height: 1px;
		background: color-mix(in oklab, var(--content-meta) 45%, transparent);
	}

	.quote {
		position: relative;
		width: fit-content;
		max-width: 100%;
		padding: 0.55rem 1.9rem;
		border-radius: var(--radius-large);
		background: color-mix(in oklab, var(--music-ink) 5%, transparent);
	}

	.quote-text {
		margin: 0;
		display: -webkit-box;
		overflow: hidden;
		-webkit-box-orient: vertical;
		-webkit-line-clamp: 3;
		line-clamp: 3;
		font-size: 0.95rem;
		font-weight: 500;
		line-height: 1.7;
		color: color-mix(in oklab, var(--music-ink) 82%, transparent);
		overflow-wrap: anywhere;
		text-wrap: pretty;
	}

	/* 左上 / 右下的引号图标；不用主题色，尺寸比横幅里的略小（上下对称定位，
	   不会像引号字符那样受行高基线影响）。
	   样式挂在 span 上而不是 Icon 上：子组件生成的 svg 拿不到本组件的作用域类名。 */
	.quote-mark {
		position: absolute;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		font-size: 1.1rem;
		color: color-mix(in oklab, var(--content-meta) 55%, transparent);
	}

	.quote-mark-start {
		top: 0.4rem;
		left: 0.55rem;
		transform: rotate(180deg);
	}

	.quote-mark-end {
		right: 0.55rem;
		bottom: 0.4rem;
	}

	@media (min-width: 768px) {
		.cover-pane {
			padding: 1.25rem 1.25rem;
		}

		.art-wrap {
			/* 随封面栏宽度自然收缩；下方要给频谱留位置 */
			width: min(100%, 260px);
		}
	}
</style>
