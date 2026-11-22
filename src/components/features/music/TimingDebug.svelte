<script lang="ts">
import { onDestroy, onMount } from "svelte";
import { beatState } from "@/utils/beat-utils";
import { contextLatency } from "./audio-context";
import { player } from "./player.svelte";

/**
 * timing 校准面板：只有 URL 带 `?debug=1` 时才渲染
 *
 * 只调 offset（BPM 在 frontmatter 里测好）：开节拍器，一边听一边微调，直到 click
 * 和鼓点重合。歌词、光晕读的是同一个 offset，会同步跟着动。
 *
 * 输出延迟由节拍器顺手测：它决定 `player.time` 的补偿量，和 click 的排程共用同一条
 * 时间轴，所以两边永远一致。
 */

let visible = $state(false);
let offsetMs = $state(0);
let metronome = $state(false);
let copied = $state(false);
/** 节拍器 click 实际用的提前量（毫秒），只用于面板对照 */
let clickLeadMs = $state(0);

/** 每小节几拍：节拍器重音与格子都按它算 */
const BEATS_PER_BAR = 4;
/** 采样间隔（tick 数）：节拍器每 40ms 一次，这里相当于一秒一采 */
const SAMPLE_EVERY = 25;
/** 预热采样次数：新 context 刚恢复时读到的值还没稳定 */
const WARMUP_SAMPLES = 8;

let ctx: AudioContext | null = null;
let timer: ReturnType<typeof setInterval> | undefined;
let copiedTimer: ReturnType<typeof setTimeout> | undefined;
/** 上一次排出去的 click 对应的音频时间，用于同一拍去重 */
let lastClickAt = Number.NaN;
/** 上一次排程时的时间轴位置，用于识别拖动/暂停造成的跳变 */
let lastNow = Number.NaN;
let tickCount = 0;
let latencySamples = 0;

const track = $derived(player.stageTrack);
const beat = $derived(
	track ? beatState(player.stageTime, track.bpm, player.stageOffset) : null,
);

/** 当前是小节里的第几格（0 起） */
const cellIndex = $derived(
	beat ? ((beat.beat % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR : -1,
);
/** 踩到拍时 1，之后快速衰减 —— 格子与光晕共用同一个形状 */
const flash = $derived(beat && player.stagePlaying ? (1 - beat.phase) ** 3 : 0);
const cells = Array.from({ length: BEATS_PER_BAR }, (_, index) => index);

onMount(() => {
	visible = new URLSearchParams(location.search).has("debug");
});

// 面板里的 offset 从曲目 frontmatter 起算；舞台曲目登记之后才知道真实值
let offsetInitialized = $state(false);
$effect(() => {
	if (!visible || offsetInitialized || !track) return;

	offsetMs = Math.round(player.stageOffset * 1000);
	offsetInitialized = true;
});

// offset 实时生效：歌词、光晕、节拍器读的都是 player.offset
$effect(() => {
	if (!visible || !offsetInitialized) return;
	player.setOffsetOverride(offsetMs / 1000);
});

function nudge(delta: number): void {
	offsetMs = Math.max(0, offsetMs + delta);
	lastClickAt = Number.NaN;
}

async function copyOffset(): Promise<void> {
	try {
		await navigator.clipboard.writeText(String(offsetMs));
		copied = true;
		if (copiedTimer) clearTimeout(copiedTimer);
		copiedTimer = setTimeout(() => {
			copied = false;
		}, 1500);
	} catch {
		copied = false;
	}
}

// ── 节拍器 ────────────────────────────────────────────────
/** 短促的 click，峰值要给够才盖得住音乐 */
function click(when: number, accent: boolean): void {
	if (!ctx) return;

	const osc = ctx.createOscillator();
	const gain = ctx.createGain();
	osc.type = "square";
	osc.frequency.value = accent ? 1760 : 1175;
	gain.gain.setValueAtTime(0.0001, when);
	gain.gain.exponentialRampToValueAtTime(accent ? 0.7 : 0.45, when + 0.003);
	gain.gain.exponentialRampToValueAtTime(0.0001, when + 0.09);
	osc.connect(gain);
	gain.connect(ctx.destination);
	osc.start(when);
	osc.stop(when + 0.1);
}

/** 提前一点排程，避免 setInterval 抖动影响落点 */
function schedule(): void {
	if (ctx?.state !== "running") return;

	// 采样与播放状态无关：暂停时也要让延迟值先收敛下来
	tickCount += 1;
	if (latencySamples <= WARMUP_SAMPLES || tickCount % SAMPLE_EVERY === 0) {
		sampleLatency();
	}

	if (!track || !player.stagePlaying || !track.bpm) return;

	const spb = 60 / track.bpm;
	const now = player.stageTime;

	// 拖动/暂停会让时间轴跳变；不重算的话旧的 lastClickAt 会把后面的拍全挡住
	if (Number.isFinite(lastNow) && Math.abs(now - lastNow) > 0.4) {
		lastClickAt = Number.NaN;
	}
	lastNow = now;

	const first = Math.floor((now - player.stageOffset) / spb);
	// click 排进图谱之后还要走一段输出延迟才真的出声，不补的话它永远比「听到的音乐」
	// 晚一截；这个差值不能记到 offset 上——offset 只描述节拍在音频里的位置。
	const lead = contextLatency(ctx);

	// 面板读数：click 用的是「此刻」的输出延迟，视觉读的是平滑后的 player.latency，
	// 两者不一致时 click 就会相对视觉偏早/偏晚（差多少见面板的 click vs 视觉）
	const leadNow = Math.round(lead * 1000);
	if (leadNow !== clickLeadMs) clickLeadMs = leadNow;

	// 只排还没到的拍：允许迟到会让同一拍被排两次，听起来是一记双击
	for (let index = first + 1; index <= first + 3; index++) {
		const at = player.stageOffset + index * spb;
		const delta = at - now;
		if (delta <= 0 || delta > 0.3) continue;
		if (Math.abs(at - lastClickAt) < 0.02) continue;

		const inBar = ((index % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR;
		// 减完落在过去时直接出声（只会在刚开播 / 刚拖动那一下发生），别丢掉这一拍
		click(
			Math.max(ctx.currentTime, ctx.currentTime + delta - lead),
			inBar === 0,
		);
		lastClickAt = at;
	}
}

/**
 * 读一次输出延迟。
 * 刚 resume 的 context 头几次读到的值往往还没稳定，所以那几次直接跟随，
 * 之后再做指数平滑——否则一个偏小的种子会把整段播放锁在错误的补偿上。
 */
function sampleLatency(): void {
	if (!ctx) return;

	const raw = contextLatency(ctx);
	if (!Number.isFinite(raw) || raw <= 0) return;

	latencySamples += 1;
	const previous = player.latency;
	const next =
		latencySamples <= WARMUP_SAMPLES ? raw : previous * 0.75 + raw * 0.25;

	if (Math.abs(next - previous) < 0.001) return;
	player.setLatency(next);
}

async function toggleMetronome(): Promise<void> {
	if (metronome) {
		metronome = false;
		if (timer) clearInterval(timer);
		timer = undefined;
		return;
	}

	ctx ??= new AudioContext();
	await ctx.resume();
	latencySamples = 0;
	tickCount = 0;
	sampleLatency();
	lastClickAt = Number.NaN;
	lastNow = Number.NaN;
	metronome = true;
	timer = setInterval(schedule, 40);
}

onDestroy(() => {
	if (timer) clearInterval(timer);
	if (copiedTimer) clearTimeout(copiedTimer);
	void ctx?.close();
});
</script>

{#if visible}
	<div class="card-base timing p-4">
		<div class="timing-strong mb-3 text-base font-bold">timing 校准</div>

		<div class="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 font-mono text-sm tabular-nums text-(--content-meta)">
			<span>播放位置</span>
			<span class="timing-strong">{(player.stageTime * 1000).toFixed(0)} ms</span>
			<span>offset</span>
			<span class="text-(--primary)">{offsetMs} ms</span>
			<span>bpm</span>
			<span>{track?.bpm ?? "-"}</span>
			<span>输出延迟</span>
			<span>
				{player.latency > 0 ? `${(player.latency * 1000).toFixed(0)} ms` : "未测"}
			</span>
			<span>click 提前</span>
			<span>{clickLeadMs > 0 ? `${clickLeadMs} ms` : "未测"}</span>
			<span>click vs 视觉</span>
			<span>
				{clickLeadMs > 0
					? `${clickLeadMs - Math.round(player.latency * 1000)} ms`
					: "-"}
			</span>
			<span>节拍</span>
			<span>
				{#if beat}
					#{beat.beat}　phase {beat.phase.toFixed(2)}　下一拍 {(beat.nextIn * 1000).toFixed(0)} ms
				{:else}
					-
				{/if}
			</span>
		</div>

		<div class="mt-3 flex flex-wrap items-center gap-2">
			<button type="button" class="timing-btn" onclick={() => nudge(-5)}>−5ms</button>
			<button type="button" class="timing-btn" onclick={() => nudge(-1)}>−1ms</button>
			<button type="button" class="timing-btn" onclick={() => nudge(1)}>+1ms</button>
			<button type="button" class="timing-btn" onclick={() => nudge(5)}>+5ms</button>
			<button
				type="button"
				class="timing-btn"
				onclick={() => void copyOffset()}
			>{copied ? "已复制" : "复制 offset"}</button>
		</div>

		<div class="mt-3 flex items-center gap-3">
			<div class="flex gap-1.5" aria-hidden="true">
				{#each cells as cell (cell)}
					{@const lit = cell === cellIndex ? flash : 0}
					<span
						class="beat-cell"
						class:beat-cell--accent={cell === 0}
						class:beat-cell--on={lit > 0.02}
						style="opacity:{0.14 + 0.86 * lit};transform:scaleY({(0.6 + 0.4 * lit).toFixed(3)})"
					></span>
				{/each}
			</div>

			<button
				type="button"
				class="timing-btn"
				data-on={metronome}
				onclick={() => void toggleMetronome()}
			>
				节拍器{metronome ? " 开" : " 关"}
			</button>
		</div>
	</div>
{/if}

<style>
	/* 面板挂在 .music-host 里，直接用那边的 --music-ink（--deep-text 在深色模式下
	   没有重定义，一直是深墨色，不能用） */
	.timing {
		color: var(--content-meta);
	}

	.timing-strong {
		color: var(--music-ink);
	}

	.timing-btn {
		padding: 0.2rem 0.6rem;
		border: 1px solid var(--line-divider);
		border-radius: 0.5rem;
		font-size: 0.8125rem;
		font-weight: 500;
		white-space: nowrap;
		transition:
			background-color 150ms ease,
			color 150ms ease;
	}

	.timing-btn:hover {
		background-color: var(--btn-plain-bg-hover);
	}

	.timing-btn[data-on="true"] {
		border-color: transparent;
		background-color: var(--primary);
		color: #fff;
	}

	:global(.dark) .timing-btn[data-on="true"] {
		color: rgb(0 0 0 / 0.7);
	}

	.beat-cell {
		display: block;
		width: 1.6rem;
		height: 2.25rem;
		border-radius: 0.35rem;
		background: var(--primary);
		will-change: opacity, transform;
	}

	/* 小节第一拍：底色淡一点、亮起来时更实，和其余三拍区分 */
	.beat-cell--accent {
		background: color-mix(in oklab, var(--primary) 55%, transparent);
	}

	.beat-cell--accent.beat-cell--on {
		background: var(--primary);
	}
</style>
