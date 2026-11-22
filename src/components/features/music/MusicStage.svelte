<script lang="ts">
import { onMount, untrack } from "svelte";
import {
	type MusicVisualizerConfig,
	musicVisualizerConfig,
} from "@/config/musicVisualizerConfig";
import type { MusicTrack } from "@/types/music";
import type { LyricLine } from "@/utils/lrc";
import { readStored, writeStored } from "@/utils/storage-utils";
import BeatRing from "./BeatRing.svelte";
import CoverPane from "./CoverPane.svelte";
import LyricsView from "./LyricsView.svelte";
import { player } from "./player.svelte";
import StageGlow from "./StageGlow.svelte";
import TimingDebug from "./TimingDebug.svelte";
import TransportBar from "./TransportBar.svelte";

/**
 * 单曲页的播放器舞台
 *
 * 布局：桌面左栏 = 封面 + 控制条（在封面下面），右栏 = 整高歌词；移动端 = 封面 /
 * 歌词两屏横向滑动（原生 scroll-snap，不需要手势代码），控制条钉在卡片底部。
 *
 * 这些部件放进同一个 island 是为了共用同一个播放器实例：页面只登记「本页展示的是
 * 哪一首」（`setStageTrack`），真正的队列在按下播放时才换。
 *
 * `--music-accent` 在这里统一定义，子组件直接用；卡片外观就是 `card-base`。
 */
let {
	track,
	lyrics,
	published = "",
	tags = [],
	accent = "",
	spectrum,
	kiai = [],
}: {
	/** 本页展示的曲目（单曲页只有一首，不是播放器的队列） */
	track: MusicTrack;
	lyrics: LyricLine[];
	published?: string;
	tags?: string[];
	/** frontmatter 里的主题色，空串表示用全站主题色 */
	accent?: string;
	/** frontmatter 里的频谱覆写（只写想改的字段，其余用全局默认） */
	spectrum?: Partial<MusicVisualizerConfig>;
	/** kiai 区间（秒）：这段时间光晕每拍闪一次、左右交替（非 kiai 是每 4 拍两侧同时） */
	kiai?: number[][];
} = $props();

// 播放器是全局的：这里只登记「本页展示的是哪一首」，真正的队列在按下播放时才换。
// 离开页面时清掉，免得别的页面上的歌词继续跟着它走。
//
// 必须 untrack：setStageTrack 内部会读写播放器状态（连接管理器、必要时接管队列），
// 直接放在 effect 里会变成「这个 effect 读也写同一份状态」→ 无限重跑
// （表现为整个 island 抛 effect_update_depth_exceeded 后失去响应）。
$effect(() => {
	const current = track;
	untrack(() => player.setStageTrack(current));

	return () => player.setStageTrack(null);
});
/** 频谱最终配置 = 全局默认 + 这首歌的覆写 */
const visualizer = $derived<MusicVisualizerConfig>({
	...musicVisualizerConfig,
	...spectrum,
});

/**
 * 光晕闪动默认关：它比较吵，应该是「想看演出的人自己打开」。
 * 开关状态存本地，刷新/切页都记得。
 */
const GLOW_KEY = "music-stage-glow";
let glowOn = $state(false);

onMount(() => {
	glowOn = readStored(GLOW_KEY) === "1";
});

function toggleGlow(): void {
	glowOn = !glowOn;
	writeStored(GLOW_KEY, glowOn ? "1" : "0");
}

/** 移动端当前停在哪一屏：0 = 封面，1 = 歌词 */
let paneIndex = $state(0);
let carousel: HTMLDivElement | undefined = $state();

function syncPane(): void {
	if (!carousel || carousel.clientWidth === 0) return;

	const next = Math.round(carousel.scrollLeft / carousel.clientWidth);
	if (next !== paneIndex) paneIndex = next;
}

function goPane(index: number): void {
	if (!carousel) return;
	carousel.scrollTo({
		left: index * carousel.clientWidth,
		behavior: "smooth",
	});
}

// 横竖屏切换时（桌面布局是 display:contents，没有滚动位置）滚动位置会被重置，
// 光靠 scroll 事件可能不触发，所以尺寸变化后再同步一次指示点
$effect(() => {
	const element = carousel;
	if (!element) return;

	const observer = new ResizeObserver(syncPane);
	observer.observe(element);

	return () => observer.disconnect();
});

const panes = [
	{ index: 0, label: "封面" },
	{ index: 1, label: "歌词" },
];
</script>

<div class="music-host" style:--music-accent={accent || "var(--primary)"}>
	<div class="card-base music-stage">
		<!-- 节拍光晕：铺在卡片左右内边缘，位于内容之下；默认关 -->
		{#if glowOn}
			<StageGlow {kiai} />
		{/if}

		<!--
			左上角这一簇是「可视化」区：节拍环（指示器）+ 各种效果开关。
			放在卡片级 overlay 里（不是封面屏内部），所以移动端滑到歌词屏也看得到；
			以后新增可视化 toggle 直接往这里加按钮即可。
		-->
		<div class="stage-tools">
			<BeatRing />

			<button
				type="button"
				class="stage-toggle"
				aria-pressed={glowOn}
				aria-label="光晕闪动"
				onclick={toggleGlow}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true">
					<path
						d="M8 1c.6 4.2 2.8 6.4 7 7-4.2.6-6.4 2.8-7 7-.6-4.2-2.8-6.4-7-7 4.2-.6 6.4-2.8 7-7z"
					/>
				</svg>
			</button>
		</div>

		<div class="stage-grid">
			<div
				class="carousel"
				bind:this={carousel}
				onscroll={syncPane}
				aria-label="播放器视图"
				role="group"
			>
				<div class="pane">
					<CoverPane track={track} {published} {tags} spectrum={visualizer} />
				</div>
				<div class="pane">
					<LyricsView lines={lyrics} />
				</div>
			</div>

			<div class="transport-wrap">
				<div class="dots">
					{#each panes as pane (pane.index)}
						<button
							type="button"
							class="dot"
							data-active={paneIndex === pane.index}
							aria-label={`显示${pane.label}`}
							aria-current={paneIndex === pane.index ? "true" : undefined}
							onclick={() => goPane(pane.index)}
						></button>
					{/each}
				</div>

				<TransportBar crossOrigin={visualizer.enable} />
			</div>
		</div>
	</div>

	<TimingDebug />
</div>

<style>
	/* 卡片外观交给 card-base（和全站一致），这里只提供播放器自己的色板。
	   注意 --deep-text 在深色模式下没有重定义（一直是深墨色），不能用。
	   色板挂在这一层，舞台和时间校准面板都在它下面，两边都能取到。 */
	.music-host {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		--music-ink: rgb(0 0 0 / 0.9);
		--music-accent-ink: #fff;
		/* 歌词当前行用这个：主题色在浅色底上偏淡，混一点深色提对比 */
		--music-accent-strong: color-mix(in oklab, var(--music-accent) 92%, #111);
	}

	:global(.dark) .music-host {
		--music-ink: rgb(255 255 255 / 0.94);
		--music-accent-ink: rgb(0 0 0 / 0.75);
		--music-accent-strong: color-mix(in oklab, var(--music-accent) 88%, #fff);
	}

	/* 光晕和节拍环的定位祖先必须是这张卡片本身：不加 position 的话，
	   StageGlow 里的 absolute 元素会一路往上找到页面容器，
	   竖向就会跨到下面那张介绍卡上。 */
	.music-stage {
		position: relative;
	}

	/* 左上角的可视化簇。横排 / 竖排各一个理由：
	   移动端横排 —— 整张卡片只有一屏封面，横着排既不占高度也碰不到歌词；
	   桌面竖排 —— 横排会正好压在封面图的上边界高度上，竖着沿封面左侧的空白往下走，
	   那块空地也就补上了。以后新增的 toggle 跟着主轴 append 即可。 */
	.stage-tools {
		position: absolute;
		z-index: 2;
		top: 0.7rem;
		left: 0.9rem;
		display: flex;
		flex-direction: row;
		align-items: center;
		gap: 0.5rem;
	}

	.stage-toggle {
		display: grid;
		place-items: center;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background-color: color-mix(in oklab, var(--card-bg) 66%, transparent);
		-webkit-backdrop-filter: blur(8px);
		backdrop-filter: blur(8px);
		color: var(--content-meta);
		cursor: pointer;
		/* 静止态就收着：所有设备一致，触屏不会出现"永远像 hover" */
		opacity: 0.62;
		transition:
			color 150ms ease,
			background-color 150ms ease,
			opacity 160ms ease;
	}

	.stage-toggle svg {
		width: 0.95rem;
		height: 0.95rem;
		fill: currentColor;
	}

	.stage-toggle[aria-pressed="true"] {
		background-color: color-mix(in oklab, var(--music-accent) 22%, transparent);
		color: var(--music-accent-strong);
	}

	@media (hover: hover) {
		.stage-toggle:hover,
		.stage-toggle:focus-visible {
			opacity: 1;
		}
	}

	.stage-grid {
		/* 光晕是绝对定位的，内容要抬到它上面 */
		position: relative;
		z-index: 1;
		display: grid;
		grid-template-columns: minmax(0, 1fr);
		grid-template-rows: minmax(0, 1fr) auto;
		/* 下限保证矮屏（笔记本）时封面 + 标题 + 元数据也放得下，不会挤成溢出裁切 */
		height: clamp(540px, 74dvh, 690px);
	}

	/* 移动端：横向 scroll-snap 当作切换器，垂直手势仍然交给页面 */
	.carousel {
		display: flex;
		min-width: 0;
		overflow-x: auto;
		overflow-y: hidden;
		scroll-snap-type: x mandatory;
		overscroll-behavior-x: contain;
		scrollbar-width: none;
	}

	.carousel::-webkit-scrollbar {
		display: none;
	}

	.pane {
		flex: 0 0 100%;
		min-width: 0;
		height: 100%;
		scroll-snap-align: start;
	}

	.transport-wrap {
		display: flex;
		flex-direction: column;
		gap: 0.45rem;
		padding: 0.2rem 1.15rem 0.95rem;
	}

	.dots {
		display: flex;
		justify-content: center;
		gap: 0.1rem;
	}

	.dot {
		width: 18px;
		height: 18px;
		padding: 6px;
		border: 0;
		border-radius: 999px;
		background-color: color-mix(in oklab, var(--music-ink) 26%, transparent);
		background-clip: content-box;
		cursor: pointer;
		transition:
			width 200ms ease,
			background-color 200ms ease;
	}

	.dot[data-active="true"] {
		width: 30px;
		background-color: var(--music-accent);
	}

	@media (min-width: 768px) {
		/* 桌面：可视化簇转竖排（封面栏出现，左侧有竖着的空地） */
		.stage-tools {
			flex-direction: column;
		}

		.stage-grid {
			/* 中间宽度先给窄一点的封面栏，否则歌词会被挤成一条 */
			grid-template-columns: minmax(0, 340px) minmax(0, 1fr);
			/* 下限跟着变高了的控制条走，保证封面栏放得下 */
			height: clamp(610px, 82vh, 740px);
		}

		/* 桌面端不需要轮播：让两个 pane 直接成为 grid 项 */
		.carousel {
			display: contents;
		}

		.pane:nth-child(1) {
			grid-column: 1;
			grid-row: 1;
		}

		.pane:nth-child(2) {
			grid-column: 2;
			grid-row: 1 / span 2;
		}

		.transport-wrap {
			grid-column: 1;
			grid-row: 2;
			padding: 0.15rem 1.2rem 1.2rem;
		}

		.dots {
			display: none;
		}
	}

	/* 放宽的桌面：封面栏和歌词列一起加宽 */
	@media (min-width: 1050px) {
		.stage-grid {
			grid-template-columns: minmax(0, 430px) minmax(0, 1fr);
		}
	}
</style>
