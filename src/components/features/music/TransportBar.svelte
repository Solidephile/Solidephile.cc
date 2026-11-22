<script lang="ts">
import Icon from "@components/common/Icon.svelte";
import { onMount } from "svelte";
import { formatDuration } from "@/utils/time-utils";
import { prepareAnalyser } from "./audio-context";
import { type PlayMode, player } from "./player.svelte";

/**
 * 播放控制条（进度 + 时间 + 上一首/播放/下一首）
 *
 * 它不持有 `<audio>`：音频归导航栏那份全局播放器，切页不断。这里只读页面态
 * （`stageTime` / `stageDuration`），操作也交给全局播放器。
 *
 * 拖动进度条时只改显示、松手才 seek：手感更像桌面播放器，也避免按住时每一帧都发
 * 一次 Range 请求。结束拖动挂在 window 的 pointerup / pointercancel 上，指针移出
 * 元素再松手、触屏被浏览器接管都能收尾。
 */
let { crossOrigin = false }: { crossOrigin?: boolean } = $props();

/**
 * 播放模式的图标与文案。
 * 图标走离线图标集（material-symbols 的 repeat / repeat-one / shuffle 已加进
 * icons-data.json），和旧 widget 那个 repeat 按钮是同一套字形。
 */
const MODE_META: Record<PlayMode, { label: string; icon: string }> = {
	list: { label: "列表循环", icon: "material-symbols:repeat-rounded" },
	one: { label: "单曲循环", icon: "material-symbols:repeat-one-rounded" },
	random: { label: "随机播放", icon: "material-symbols:shuffle-rounded" },
};

let dragging = $state(false);
let dragValue = $state(0);

onMount(() => player.connect());

$effect(() => {
	if (!dragging) return;

	const finish = (): void => commitSeek();
	window.addEventListener("pointerup", finish, true);
	window.addEventListener("pointercancel", finish, true);

	return () => {
		window.removeEventListener("pointerup", finish, true);
		window.removeEventListener("pointercancel", finish, true);
	};
});

const duration = $derived(player.stageDuration);
const shownTime = $derived(dragging ? dragValue : player.stageTime);
const percent = $derived(
	duration > 0 ? Math.min(100, Math.max(0, (shownTime / duration) * 100)) : 0,
);
const single = $derived(player.stageTracks.length < 2);
const mode = $derived(player.playMode);
const modeMeta = $derived(MODE_META[mode]);

function beginDrag(event: Event & { currentTarget: HTMLInputElement }): void {
	dragging = true;
	dragValue = Number(event.currentTarget.value);
}

function handleInput(event: Event & { currentTarget: HTMLInputElement }): void {
	const value = Number(event.currentTarget.value);
	// 指针拖动中只预览；键盘方向键（不在拖）直接生效
	if (dragging) {
		dragValue = value;
		return;
	}
	player.seek(value);
}

function commitSeek(value?: number): void {
	// change 带的是输入框当前值，优先用它（指针在窗口外松开时更准）
	if (typeof value === "number") dragValue = value;
	if (!dragging) return;
	dragging = false;
	player.seek(dragValue);
}

/**
 * 播放键：不是当前曲目就先接管队列（本地曲目 = 整份本地歌单，从这一首开始），否则播放/暂停。
 *
 * 频谱开着时先把元素接进音频图谱、等 context 真的跑起来，再开始播放：中途改路由或
 * context 还没渲染就开播，会让媒体渲染器重连一次，这一次播放和时钟错开（节拍器和
 * 格子偏早），暂停再播才恢复。
 */
async function togglePlayback(): Promise<void> {
	player.connect();

	const element = player.element;
	if (crossOrigin && element && !player.stagePlaying) {
		await prepareAnalyser(element);
	}

	player.toggleStage();
}
</script>

<div class="transport">
	<div class="seek-row">
		<span class="time">{formatDuration(shownTime)}</span>

		<input
			type="range"
			min="0"
			max={duration || 1}
			step="0.1"
			value={shownTime}
			aria-label="播放进度"
			aria-valuetext={`${formatDuration(shownTime)} / ${formatDuration(duration)}`}
			class="seek"
			data-dragging={dragging}
			style:--pct={`${percent}%`}
			onpointerdown={beginDrag}
			oninput={handleInput}
			onchange={(event) => commitSeek(Number(event.currentTarget.value))}
		/>

		<span class="time">{formatDuration(duration)}</span>
	</div>

	<div class="actions">
		<button
			type="button"
			class="mode"
			data-active={mode !== "list"}
			aria-label={`播放模式：${modeMeta.label}`}
			title={`播放模式：${modeMeta.label}`}
			onclick={() => player.cyclePlayMode()}
		>
			<Icon icon={modeMeta.icon} />
		</button>

		<button
			type="button"
			class="skip"
			disabled={single}
			aria-label="上一首"
			onclick={() => player.prev()}
		>
			<Icon icon="material-symbols:skip-previous-rounded" />
		</button>

		<button
			type="button"
			class="play"
			aria-label={player.stagePlaying ? "暂停" : "播放"}
			onclick={togglePlayback}
		>
			<Icon
				icon={player.stagePlaying
					? "material-symbols:pause-rounded"
					: "material-symbols:play-arrow-rounded"}
			/>
		</button>

		<button
			type="button"
			class="skip"
			disabled={single}
			aria-label="下一首"
			onclick={() => player.next()}
		>
			<Icon icon="material-symbols:skip-next-rounded" />
		</button>
	</div>
</div>

<style>
	.transport {
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
		width: 100%;
	}

	.seek-row {
		display: flex;
		align-items: center;
		gap: 0.65rem;
	}

	.time {
		flex-shrink: 0;
		color: var(--content-meta);
		font-size: 0.72rem;
		font-variant-numeric: tabular-nums;
		font-weight: 500;
		letter-spacing: 0.02em;
	}

	/* 自绘进度条：细轨 + 悬停才出现的拇指 */
	.seek {
		-webkit-appearance: none;
		appearance: none;
		width: 100%;
		height: 18px;
		margin: 0;
		background: transparent;
		/* input 默认不继承文字色（UA 会给 fieldtext），轨道用 currentColor 混出来的
		   颜色会因此在深色模式下变成深灰，所以显式给一个 */
		color: var(--music-ink);
		cursor: pointer;
	}

	.seek::-webkit-slider-runnable-track {
		height: 4px;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--music-accent) var(--pct),
			color-mix(in oklab, currentColor 20%, transparent) var(--pct)
		);
	}

	.seek::-webkit-slider-thumb {
		-webkit-appearance: none;
		appearance: none;
		width: 13px;
		height: 13px;
		margin-top: -4.5px;
		border: 0;
		border-radius: 50%;
		background: var(--music-accent);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
		transform: scale(0);
		transition: transform 150ms ease;
	}

	.seek:hover::-webkit-slider-thumb,
	.seek:focus-visible::-webkit-slider-thumb,
	.seek[data-dragging="true"]::-webkit-slider-thumb {
		transform: scale(1);
	}

	.seek::-moz-range-track {
		height: 4px;
		border-radius: 999px;
		background: color-mix(in oklab, currentColor 20%, transparent);
	}

	.seek::-moz-range-progress {
		height: 4px;
		border-radius: 999px;
		background: var(--music-accent);
	}

	.seek::-moz-range-thumb {
		width: 13px;
		height: 13px;
		border: 0;
		border-radius: 50%;
		background: var(--music-accent);
		box-shadow: 0 1px 3px rgb(0 0 0 / 0.25);
	}

	.seek:focus-visible {
		outline: 2px solid color-mix(in oklab, var(--music-accent) 60%, transparent);
		outline-offset: 3px;
		border-radius: 999px;
	}

	.actions {
		position: relative;
		display: flex;
		align-items: center;
		justify-content: center;
		gap: 1.15rem;
	}

	/* 播放模式钉在控制行左端（和旧 widget 的 repeat 同位）：它是绝对定位，
	   所以 上一首/播放/下一首 这三个仍然精确居中 */
	.mode {
		position: absolute;
		left: 0;
		top: 50%;
		transform: translateY(-50%);
		display: grid;
		place-items: center;
		width: 2.25rem;
		height: 2.25rem;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		/* 图标尺寸写在按钮的 font-size 上：Icon 是子组件，它生成的 <svg> 拿不到
		   本组件的作用域类名，写在图标上不会生效 */
		font-size: 1.4rem;
		/* 和旧 widget 的 repeat 用同一个「次要图标色」：--content-meta（浅色下 0.7 黑、
		   深色下 0.6 白）。以前用 --music-ink + opacity .7，深色模式下比 widget 亮一档。 */
		color: var(--content-meta);
		cursor: pointer;
		transition:
			color 150ms ease,
			transform 150ms ease;
	}

	/* 非默认模式（单曲循环 / 随机）用强调色，和旧 widget 的 repeat 一致 */
	.mode[data-active="true"] {
		color: var(--music-accent);
	}

	.mode:hover,
	.mode:focus-visible {
		color: var(--music-accent);
	}

	.mode:active {
		transform: translateY(-50%) scale(0.94);
	}

	.skip,
	.play {
		display: grid;
		place-items: center;
		padding: 0;
		border: 0;
		border-radius: 50%;
		background: transparent;
		cursor: pointer;
		transition:
			transform 150ms ease,
			background-color 150ms ease,
			color 150ms ease;
	}

	/* 上一首 / 下一首：图标和旧播放器同一套（material-symbols rounded），
	   响应也对齐旧播放器：悬停只变色、按下缩放。
	   尺寸写在按钮的 font-size 上，不要写在图标上：Icon 是子组件，它生成的 <svg>
	   拿不到本组件的作用域类名（`class="skip-icon"` + `.skip-icon{}` 不会命中，图标
	   会退回继承的 16px，也就是之前「图标很小」的原因）。svg 自身是 width/height=1em。
	   material 的 play / skip 字形在 viewBox 里只占中间一小块，所以字号要接近按钮
	   尺寸，比例才和旧播放器一致。 */
	.skip {
		height: 2.5rem;
		width: 2.5rem;
		font-size: 1.75rem;
		color: var(--music-ink);
		opacity: 0.7;
	}

	.skip:hover:not(:disabled) {
		color: var(--music-accent);
		opacity: 1;
	}

	.skip:active:not(:disabled) {
		transform: scale(0.95);
	}

	.skip:disabled {
		cursor: default;
		opacity: 0.25;
	}

	/* 播放键：保留本站的设计（主题色实心圆 + 反色图标）。
	   字号同理要偏大，比例才和旧播放器的小圆按钮一致 */
	.play {
		height: 3.5rem;
		width: 3.5rem;
		font-size: 2.4rem;
		background-color: var(--music-accent);
		color: var(--music-accent-ink);
		box-shadow: 0 6px 18px -8px color-mix(in oklab, var(--music-accent) 80%, transparent);
	}

	.play:hover {
		transform: scale(1.06);
	}

	.play:active {
		transform: scale(0.95);
	}
</style>
