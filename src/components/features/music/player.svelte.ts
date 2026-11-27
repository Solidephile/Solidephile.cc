/**
 * 播放器状态（Svelte 5 runes）
 *
 * 真正的 `<audio>` 和队列归导航栏那份全局播放器（MusicManager，挂在 swup 容器之外，
 * 切页不断）。这里只做它的「页面侧控制器」：把事件同步成 runes、给页面组件提供
 * 派生状态，并把播放 / 换队列的操作转给它 —— 全站始终只有一个音频实例。
 *
 * 时间来自 clock.ts（墙钟插值），不直接读 currentTime，见那边的说明。
 */

import { musicVisualizerConfig } from "@/config/musicVisualizerConfig";
import type { MusicTrack } from "@/types/music";
import { type LyricLine, parseLrc } from "@/utils/lrc";
import { readStored, removeStored, writeStored } from "@/utils/storage-utils";
import {
	ensureAnalyser,
	getAnalyser,
	markAnalyserUnavailable,
} from "./audio-context";
import { attach as attachClock, readTime, syncAt } from "./clock";

/** 输出延迟（自动测量值）的本地缓存键（同一浏览器共用） */
const LATENCY_KEY = "music-output-latency";
/** 用户手动补偿的本地缓存键（毫秒） */
const LATENCY_OFFSET_KEY = "music-output-latency-offset";

/**
 * 自动采样时，只有新值和当前值差这么多才更新。
 * 设备切换带来的偏差通常远大于此，而同一设备上的抖动小于它，避免视觉跟着抖。
 */
const LATENCY_UPDATE_THRESHOLD_S = 0.05;

/**
 * 已校准的值和当前设备读数差这么多，就认为换了输出设备：
 * 作废旧校准。取比采样阈值更宽的值，避免把正常的读数波动当成换设备。
 */
const LATENCY_STALE_THRESHOLD_S = 0.1;

/** 手动补偿的上限（秒）；界面上的滑块范围也是它 */
const MANUAL_OFFSET_LIMIT_S = 0.3;

/** 测量值的来源：未确定 / 自动采样 / 节拍器或手动校准 */
export type LatencySource = "none" | "auto" | "measured";

/** 浏览器是否提供可用的 outputLatency；拿不到就只能靠手动偏移 */
export type LatencySupport = "unknown" | "ok" | "unavailable";

/**
 * 播放模式。
 * 引擎那边是 0 / 1 / 2 的数字，这里换成可读的字符串（两套 UI 共用同一份状态）。
 */
export type PlayMode = "list" | "one" | "random";

const PLAY_MODES: PlayMode[] = ["list", "one", "random"];

function toPlayMode(value: number | undefined): PlayMode {
	return PLAY_MODES[value ?? 0] ?? "list";
}

/**
 * 引擎的线上格式（`MusicManager` 那段 is:inline 脚本内部用的旧字段名）。
 *
 * 它是私有协议：只在 fromManager / toManager 这两个适配函数里出现，
 * 上层一律用 `MusicTrack`（src/types/music.ts）。
 */
type EngineTrack = {
	name: string;
	artist: string;
	url: string;
	pic: string;
	lrc?: string;
	duration?: number;
	bpm?: number;
	offset?: number;
	slug?: string;
};

type ManagerState = {
	playlist: EngineTrack[];
	currentIndex: number;
	track: EngineTrack | null;
	isPlaying: boolean;
	duration: number;
	playMode: number;
	/** 控制器解析后回写的结构化歌词 */
	lyrics: LyricLine[];
	/** 当前曲目的原始 LRC 文本（首帧竞态时用来补解析） */
	lrcRaw?: string;
};

type MusicManagerApi = {
	init(): Promise<void>;
	setPlaylist(
		tracks: EngineTrack[],
		index: number,
		autoPlay: boolean,
		crossOrigin: boolean,
	): void;
	loadMeting(): Promise<EngineTrack[]>;
	getLocalPlaylist(): EngineTrack[];
	getElement(): HTMLAudioElement;
	getState(): ManagerState;
	togglePlay(): void;
	playNext(): void;
	playPrev(): void;
	cyclePlayMode(): void;
	seekToTime(seconds: number): void;
	setLyrics(lines: LyricLine[]): void;
};

function manager(): MusicManagerApi | null {
	return (
		(window as unknown as { __musicManager?: MusicManagerApi })
			.__musicManager ?? null
	);
}

function fromManager(raw: EngineTrack): MusicTrack {
	return {
		title: raw.name,
		artist: raw.artist,
		audio: raw.url,
		cover: raw.pic,
		duration: raw.duration ?? 0,
		bpm: raw.bpm,
		offset: raw.offset,
		lrc: raw.lrc,
		slug: raw.slug,
	};
}

function toManager(track: MusicTrack): EngineTrack {
	return {
		name: track.title,
		artist: track.artist,
		url: track.audio,
		pic: track.cover,
		lrc: track.lrc,
		duration: track.duration,
		bpm: track.bpm,
		offset: track.offset,
		slug: track.slug,
	};
}

let tracks = $state<MusicTrack[]>([]);
let index = $state(0);
let playing = $state(false);
let time = $state(0);
let duration = $state(0);
/** 当前队列来自哪里：本地曲目（完整）还是网易云歌单 */
let source = $state<"local" | "meting">("meting");
/** 播放模式：引擎是唯一真源，这里只是镜像（两套 UI 都读它） */
let playMode = $state<PlayMode>("list");
/** 音乐页正在展示的曲目；它决定页面上的歌词 / 节拍特效跟谁走 */
let stageTrack = $state<MusicTrack | null>(null);
/** 调试面板临时改的 offset（秒）；换曲时清空 */
let offsetOverride = $state<number | null>(null);
/**
 * 自动测量到的设备输出延迟（秒）。
 *
 * 视觉要减去「此刻听到的」位置，所以真正的补偿 = 这个值 + 手动偏移。
 */
let measuredLatency = $state(0);
/**
 * 用户手动补偿（秒，可为负）。
 * 正数让画面推迟，负数让画面提前；与自动测量值相加后生效。
 */
let manualOffset = $state(0);
/** 视觉实际减去的总补偿（秒） */
function totalLatency(): number {
	return Math.max(0, measuredLatency + manualOffset);
}

/** 已经「测过」：有缓存值或节拍器写过，之后不再采用自动估计（设备切换时会被作废） */
let latencyMeasured = false;
/** 测量值的来源，供界面显示 */
let latencySource = $state<LatencySource>("none");
/** 浏览器是否提供 outputLatency；为 unavailable 时界面提示无法自动校准 */
let latencySupport = $state<LatencySupport>("unknown");
/** 上一次见到的输出设备集合（用于区分真正的输出设备变化与插拔麦克风） */
let outputDeviceKey = "";

let element: HTMLAudioElement | null = null;
let raf = 0;
let connecting = false;

function clampManualOffset(seconds: number): number {
	return Math.max(
		-MANUAL_OFFSET_LIMIT_S,
		Math.min(MANUAL_OFFSET_LIMIT_S, seconds),
	);
}

/** 挂载时读一次缓存：普通访问也要补偿，否则测量只在调试面板里生效 */
function restoreLatency(): void {
	const stored = Number(readStored(LATENCY_KEY));
	if (Number.isFinite(stored) && stored > 0) {
		measuredLatency = stored;
		latencyMeasured = true;
		latencySource = "measured";
	}

	const offsetMs = Number(readStored(LATENCY_OFFSET_KEY));
	if (Number.isFinite(offsetMs) && offsetMs !== 0) {
		manualOffset = clampManualOffset(offsetMs / 1000);
	}
}

/** 从共享音频图谱读一次输出延迟；没有图谱（频谱未启用）时返回 null */
function probeContextLatency(): { total: number; output: number } | null {
	const context = getAnalyser()?.context;
	// AnalyserNode.context 的类型是 BaseAudioContext；这里只可能是真实 AudioContext
	if (!(context instanceof AudioContext)) return null;

	const base = Number.isFinite(context.baseLatency) ? context.baseLatency : 0;
	const output = context.outputLatency ?? 0;
	return { total: base + output, output };
}

/** 记录浏览器是否真的提供了输出延迟（outputLatency 为 0 时视为拿不到） */
function noteOutputLatency(output: number): void {
	if (output > 0) latencySupport = "ok";
	else if (latencySupport !== "ok") latencySupport = "unavailable";
}

/**
 * 自动采用一个延迟值：已经校准过（节拍器 / 手动校准）就不动，
 * 同一设备上的小幅抖动也直接忽略，避免视觉跟着读数抖。
 */
function adoptAutoLatency(value: number): void {
	if (latencyMeasured) return;
	if (Math.abs(value - measuredLatency) < LATENCY_UPDATE_THRESHOLD_S) return;

	measuredLatency = value;
	latencySource = "auto";
}

/**
 * 作废校准值：输出设备变了，之前在一台设备上测到的延迟不再可信。
 * 不立刻把测量值归零，避免重新采样前视觉先跳一下；手动偏移不受影响。
 */
function clearLatencyMeasurement(): void {
	latencyMeasured = false;
	latencySource = measuredLatency > 0 ? "auto" : "none";
	removeStored(LATENCY_KEY);
}

/**
 * 重新采样当前输出延迟。
 *
 * 除了设备变化事件，开始播放 / 页面恢复可见时也会调用：有些浏览器切换默认输出
 * 设备并不会派发 `devicechange`，所以再按读数对一次——校准值和当前读数差得过多
 * 就当作换了设备，作废旧校准再采用新读数。
 *
 * 返回是否拿到了有效值；没有音频图谱时拿不到。
 */
function sampleLatencyNow(): boolean {
	const probe = probeContextLatency();
	if (probe === null) return false;

	noteOutputLatency(probe.output);

	if (
		latencyMeasured &&
		Math.abs(probe.total - measuredLatency) > LATENCY_STALE_THRESHOLD_S
	) {
		clearLatencyMeasurement();
	}

	adoptAutoLatency(probe.total);
	if (element && !playing) settleTime();
	return true;
}

function wait(ms: number): Promise<void> {
	return new Promise((resolve) => {
		setTimeout(resolve, ms);
	});
}

/**
 * 重新校准：连续读几次当前设备的输出延迟，取稳定后的读数。
 *
 * 优先复用正在播放的共享图谱；没有图谱（频谱被禁用 / 不可用）时临时建一个
 * AudioContext，用一个几乎无声的振荡器让它真正开始渲染，否则部分浏览器读到的
 * `outputLatency` 会一直是 0。整个函数必须在用户手势（按钮点击）里调用。
 */
async function calibrateLatency(): Promise<boolean> {
	const shared = getAnalyser()?.context;
	let context = shared instanceof AudioContext ? shared : null;
	const temporary = context === null;

	if (!context) {
		try {
			context = new AudioContext();
		} catch {
			latencySupport = "unavailable";
			return false;
		}
	}

	const current = context;
	let oscillator: OscillatorNode | null = null;

	try {
		await current.resume().catch(() => undefined);

		if (temporary) {
			oscillator = current.createOscillator();
			const gain = current.createGain();
			gain.gain.value = 0.0001;
			oscillator.connect(gain);
			gain.connect(current.destination);
			oscillator.start();
			await wait(80);
		}

		let best = 0;
		for (let i = 0; i < 6; i += 1) {
			const base = Number.isFinite(current.baseLatency)
				? current.baseLatency
				: 0;
			const output = current.outputLatency ?? 0;
			if (output > 0) best = Math.max(best, base + output);
			await wait(40);
		}

		if (best <= 0) {
			latencySupport = "unavailable";
			return false;
		}

		latencySupport = "ok";
		measuredLatency = best;
		latencyMeasured = true;
		latencySource = "measured";
		writeStored(LATENCY_KEY, String(best));
		if (element) settleTime();
		return true;
	} finally {
		if (oscillator) {
			try {
				oscillator.stop();
			} catch {
				// 已经停了
			}
		}
		if (temporary) await current.close().catch(() => undefined);
	}
}

/**
 * 设备列表变化：只有输出设备集合变了才作废延迟校准——
 * 插拔麦克风同样会触发 `devicechange`，不该把已校准的延迟清掉。
 */
async function handleDeviceChange(): Promise<void> {
	const pending = navigator.mediaDevices?.enumerateDevices?.();
	const devices = pending ? await pending.catch(() => null) : null;
	const next =
		devices
			?.filter((device) => device.kind === "audiooutput")
			.map((device) => device.deviceId)
			.sort()
			.join(",") ?? "";

	if (next === outputDeviceKey) return;
	outputDeviceKey = next;

	// 换设备后 outputLatency 的可用性也可能变，重新判断
	latencySupport = "unknown";
	clearLatencyMeasurement();
	sampleLatencyNow();
}

/** 只在播放时跑 rAF：暂停后就该彻底安静，没必要空转 */
function frame(): void {
	time = Math.max(0, readTime() - totalLatency());
	raf = requestAnimationFrame(frame);
}

function startLoop(): void {
	if (raf || !element) return;
	raf = requestAnimationFrame(frame);
}

function stopLoop(): void {
	if (raf) cancelAnimationFrame(raf);
	raf = 0;
}

/** 把显示位置同步到元素当前值（暂停/结束时用，避免停在上一帧的外推值） */
function settleTime(): void {
	time = Math.max(0, readTime() - totalLatency());
}

function isStageCurrent(): boolean {
	return (
		stageTrack !== null &&
		tracks.length > 0 &&
		tracks.some((track) => track.audio === stageTrack?.audio) &&
		tracks[index]?.audio === stageTrack.audio
	);
}

function syncFromManager(): void {
	const api = manager();
	if (!api) return;

	const state = api.getState();
	tracks = state.playlist.map(fromManager);
	index = state.currentIndex;
	playing = state.isPlaying;
	duration = state.duration;
	playMode = toPlayMode(state.playMode);
	// 引擎先发出 fm:lyrics-raw、控制器还没接上（首帧竞态）时补一次解析
	if (state.lrcRaw && state.lyrics.length === 0) {
		api.setLyrics(parseLrc(state.lrcRaw));
	}
	if (playing) startLoop();
}

/** 元素随时可能被换掉（歌单轨道走普通播放，见 MusicManager 的 replaceAudio） */
function bindElement(audio: HTMLAudioElement): void {
	element = audio;
	attachClock(audio);

	audio.addEventListener("loadedmetadata", () => {
		duration = Number.isFinite(audio.duration) ? audio.duration : 0;
	});
	// 这里**不监听 ended**：播完由管理器统一广播 `fm:play-state`（真的停下时会发）。
	// 自己再判一次会和「单曲循环」打架——那条路径是就地重启（currentTime = 0 + play），
	// 刻意不发任何事件，于是 ended 里写下的 playing = false 再也没人纠正，
	// 页面就会停在「音频在放、按钮显示播放、频谱和歌词冻住」的状态。
}

function onElementReplaced(next: HTMLAudioElement): void {
	stopLoop();
	time = 0;
	duration = 0;
	bindElement(next);
	if (playing) startLoop();
}

/**
 * 在「本站第一次用户交互」里把 `<audio>` 预接进音频图谱。
 *
 * 频谱建图有两条硬约束：
 *  1. 必须在用户手势里做 —— `AudioContext` 才能在创建时就 running（Safari 尤其严格：
 *     非手势创建 / 恢复的 context 可能一直 suspended，元素一旦接进 suspended 的图谱
 *     就完全没声，比「没频谱」严重得多）；
 *  2. 必须在元素还没出声时做 —— 音乐已经在放才把元素接进图谱，浏览器会重排一次媒体
 *     渲染管线，听起来就是「卡一下」（从索引页或导航栏开始播放、随后进单曲页最明显）。
 *
 * 第一次交互时元素还没进入播放（`preload="none"`，不点播放就不会加载），因此这时预接
 * 最安全。之后无论从哪个入口开播，元素都已经在图谱里。
 * 全局关掉频谱（`musicVisualizerConfig.enable`）就完全不建上下文。
 */
function primeAnalyserOnFirstGesture(): void {
	if (!musicVisualizerConfig.enable) return;

	let primed = false;
	const prime = (): void => {
		if (primed) return;
		primed = true;
		window.removeEventListener("pointerdown", prime, true);
		window.removeEventListener("keydown", prime, true);

		const audio = element;
		if (audio) ensureAnalyser(audio);
	};

	window.addEventListener("pointerdown", prime, {
		once: true,
		capture: true,
		passive: true,
	});
	window.addEventListener("keydown", prime, { once: true, capture: true });
}

/** 本地曲目全集（构建期注入的队列）；用来做「按 slug 定位」和整份替换 */
function localPlaylist(): MusicTrack[] {
	return manager()?.getLocalPlaylist().map(fromManager) ?? [];
}

/**
 * 接上全局播放器：拿它的 `<audio>` 接时钟、挂事件。
 * 管理器还没就位时短暂重试（它比 island 晚一点点初始化）。
 */
function connect(attempt = 0): void {
	if (connecting || element) return;
	const api = manager();
	const audio = api?.getElement();
	if (!api || !audio) {
		if (attempt < 20) {
			connecting = true;
			setTimeout(() => {
				connecting = false;
				connect(attempt + 1);
			}, 50);
		}
		return;
	}

	bindElement(audio);
	restoreLatency();
	sampleLatencyNow();

	window.addEventListener("fm:init", () => syncFromManager());
	window.addEventListener("fm:track", () => syncFromManager());
	window.addEventListener("fm:element", (event) => {
		const detail = (event as CustomEvent<{ element?: HTMLAudioElement }>)
			.detail;
		if (detail?.element) onElementReplaced(detail.element);
		sampleLatencyNow();
	});
	window.addEventListener("fm:play-state", (event) => {
		const detail = (event as CustomEvent<{ isPlaying: boolean }>).detail;
		playing = !!detail?.isPlaying;
		if (playing) {
			sampleLatencyNow();
			startLoop();
		} else {
			settleTime();
			stopLoop();
		}
	});
	window.addEventListener("fm:mode", (event) => {
		const detail = (event as CustomEvent<{ playMode?: number }>).detail;
		playMode = toPlayMode(detail?.playMode);
	});
	// 歌词解析放在这里而不是引擎里：引擎是 is:inline 脚本、import 不到 lrc.ts，
	// 在里面再写一份解析器就是第三份实现了。引擎只负责拿到原文，这里解析完回写。
	window.addEventListener("fm:lyrics-raw", (event) => {
		const detail = (event as CustomEvent<{ raw?: string }>).detail;
		manager()?.setLyrics(parseLrc(detail?.raw ?? ""));
	});
	window.addEventListener("fm:cors-failed", () => markAnalyserUnavailable());

	primeAnalyserOnFirstGesture();

	// 输出设备变化后旧的延迟补偿不再可信；有些浏览器切默认输出不派发 devicechange，
	// 所以开始播放、页面恢复可见时也会再对一次读数（见 sampleLatencyNow）
	navigator.mediaDevices?.addEventListener("devicechange", handleDeviceChange);
	document.addEventListener("visibilitychange", () => {
		if (document.visibilityState === "visible") sampleLatencyNow();
	});

	syncFromManager();
}

export const player = {
	/** 接上全局播放器（幂等；页面组件挂载时调用） */
	connect(): void {
		connect();
	},

	/** 全站的 `<audio>`（频谱 / 调试面板要用） */
	get element(): HTMLAudioElement | null {
		return element;
	},

	get tracks(): MusicTrack[] {
		return tracks;
	},

	/** 音乐页的播放条只关心自己这一首：不是当前曲目时按单曲处理 */
	get stageTracks(): MusicTrack[] {
		if (isStageCurrent()) return tracks;
		return stageTrack ? [stageTrack] : [];
	},

	get track(): MusicTrack | null {
		return tracks[index] ?? null;
	},

	/** 音乐页正在展示的曲目（页面自己登记，播放器未必在放它） */
	get stageTrack(): MusicTrack | null {
		return stageTrack;
	},

	get playing(): boolean {
		return playing;
	},

	get source(): "local" | "meting" {
		return source;
	},

	/** 播放模式（列表循环 / 单曲循环 / 随机） */
	get playMode(): PlayMode {
		return playMode;
	},

	get time(): number {
		return time;
	},

	/** 音乐页用的时间：展示的曲目不是当前曲目时钉在 0，免得歌词跟着别的歌走 */
	get stageTime(): number {
		return isStageCurrent() ? time : 0;
	},

	get stagePlaying(): boolean {
		return isStageCurrent() && playing;
	},

	get duration(): number {
		return duration > 0 ? duration : (tracks[index]?.duration ?? 0);
	},

	/** 音乐页的时长：不是当前曲目时用 frontmatter 的时长，进度条停在 0 */
	get stageDuration(): number {
		return isStageCurrent() ? player.duration : (stageTrack?.duration ?? 0);
	},

	/** 当前生效的 offset（秒）：调试面板的临时值优先 */
	get offset(): number {
		return offsetOverride ?? tracks[index]?.offset ?? 0;
	},

	/** 音乐页那一首的 offset（同上，但取的是舞台曲目） */
	get stageOffset(): number {
		return offsetOverride ?? stageTrack?.offset ?? 0;
	},

	/** 只登记「本页展示的是哪一首」，不改播放器状态（URL ↔ 曲目的同步在 MusicRouteSync） */
	setStageTrack(track: MusicTrack | null): void {
		connect();
		stageTrack = track;
	},

	/** 本地曲目全集 */
	getLocalTracks(): MusicTrack[] {
		return localPlaylist();
	},

	/** 整份本地队列，从某一首开始（prev/next 会按这个顺序走） */
	playLocalList(list: MusicTrack[], startIndex = 0, autoPlay = true): void {
		player.setQueue(list, startIndex, autoPlay, "local");
	},

	/**
	 * 整份替换队列。本地曲目开 `crossOrigin`（能接频谱），网易云别开。
	 * 队列 = [当前这首歌] 时就是「这一次只听这一首」。
	 */
	setQueue(
		list: MusicTrack[],
		startIndex = 0,
		autoPlay = false,
		nextSource: "local" | "meting" = "local",
	): void {
		connect();

		tracks = list;
		index = Math.max(0, Math.min(startIndex, Math.max(0, list.length - 1)));
		source = nextSource;

		const api = manager();
		if (!api) return;

		// 本地曲目要接频谱。切到网易云歌单时元素会被整个换掉（新元素不在图谱里），
		// 所以每次换上本地队列都补接一次——必须在开播之前，出声之后再接会卡一下
		// （原因见 primeAnalyserOnFirstGesture）。云端曲目绝不能接：没有 CORS，会静音。
		if (nextSource === "local" && element) ensureAnalyser(element);

		api.setPlaylist(
			list.map(toManager),
			index,
			autoPlay,
			nextSource === "local",
		);
	},

	/** 网易云歌单（带缓存），索引页用来列曲目 */
	async loadMeting(): Promise<MusicTrack[]> {
		const api = manager();
		if (!api) return [];

		return (await api.loadMeting()).map(fromManager);
	},

	/** 播放某一首本地曲目：队列 = 全部本地曲目（这样上下首/连播才成立） */
	playLocal(track: MusicTrack, autoPlay = true): void {
		const list = localPlaylist();
		const index = list.findIndex(
			(item) => item.slug === track.slug || item.audio === track.audio,
		);

		if (list.length > 0 && index >= 0) {
			player.setQueue(list, index, autoPlay, "local");
			return;
		}

		player.setQueue([track], 0, autoPlay, "local");
	},

	/** 索引页的封面播放键：正在放这一首就暂停/继续，否则重开 */
	/**
	 * 点列表里的一首：只负责「放这首」，不负责暂停。
	 * 暂停/继续只归播放键（单曲页播放条、导航栏那份 widget）：点正在播放的那一行
	 * 不会再把它停掉；暂停后再点则是继续，而不是从头重播。
	 */
	toggleTrack(track: MusicTrack): void {
		if (player.track?.audio === track.audio) {
			if (!playing) manager()?.togglePlay();
			return;
		}

		player.playLocal(track);
	},

	/** 只切播放/暂停，不改队列 */
	togglePause(): void {
		manager()?.togglePlay();
	},

	/** 切换播放模式：列表循环 → 单曲循环 → 随机 → 列表循环（状态靠 fm:mode 回来） */
	cyclePlayMode(): void {
		manager()?.cyclePlayMode();
	},

	playMeting(list: MusicTrack[], startIndex = 0): void {
		player.setQueue(list, startIndex, true, "meting");
	},

	/** 音乐页播放键：不是当前曲目就先接管队列，再播放/暂停 */
	toggleStage(): void {
		connect();
		const track = stageTrack;
		if (!track) return;

		if (!isStageCurrent()) {
			player.playLocal(track);
			return;
		}

		manager()?.togglePlay();
	},

	seek(seconds: number): void {
		// 展示的曲目不是当前曲目时不要动全局播放器的进度
		if (stageTrack && !isStageCurrent()) return;

		const clamped = Math.max(0, Math.min(seconds, player.duration || seconds));
		manager()?.seekToTime(clamped);
		// 立即重锚：不依赖异步的 seeked 事件，否则拖动后进度条会先跳到旧位置
		syncAt(clamped);
		time = clamped;
	},

	next(): void {
		manager()?.playNext();
	},

	prev(): void {
		manager()?.playPrev();
	},

	setOffsetOverride(value: number | null): void {
		offsetOverride = value;
	},

	/** 视觉实际减去的总补偿（秒）= 测量值 + 手动偏移 */
	get latency(): number {
		return totalLatency();
	},

	/** 自动测量到的设备输出延迟（秒） */
	get measuredLatency(): number {
		return measuredLatency;
	},

	/** 用户手动补偿（秒，可为负） */
	get manualOffset(): number {
		return manualOffset;
	},

	/** 测量值的来源：未确定 / 自动采样 / 节拍器或手动校准 */
	get latencySource(): LatencySource {
		return latencySource;
	},

	/** 浏览器是否提供可用的 outputLatency */
	get latencySupport(): LatencySupport {
		return latencySupport;
	},

	/** 写入测量值（节拍器 / 手动校准）；会持久化 */
	setLatency(seconds: number): void {
		const next = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
		if (next === measuredLatency) return;

		measuredLatency = next;
		if (next > 0) {
			latencyMeasured = true;
			latencySource = "measured";
			writeStored(LATENCY_KEY, String(next));
		}
		if (element) settleTime();
	},

	/** 设置手动补偿（秒，可为负）；会持久化并立即生效 */
	setManualOffset(seconds: number): void {
		if (!Number.isFinite(seconds)) return;

		const next = clampManualOffset(seconds);
		if (next === manualOffset) return;

		manualOffset = next;
		writeStored(LATENCY_OFFSET_KEY, String(Math.round(next * 1000)));
		if (element) settleTime();
	},

	/** 手动补偿归零 */
	resetManualOffset(): void {
		player.setManualOffset(0);
	},

	/**
	 * 自动估计（音频图谱报的值）：还没校准时采用；
	 * 已校准但和读数差得过多（多半是换了输出设备）时先作废旧校准。
	 */
	estimateLatency(seconds: number): void {
		if (!Number.isFinite(seconds) || seconds <= 0) return;

		if (
			latencyMeasured &&
			Math.abs(seconds - measuredLatency) > LATENCY_STALE_THRESHOLD_S
		) {
			clearLatencyMeasurement();
		}

		adoptAutoLatency(seconds);
	},

	/** 重新采样当前输出延迟（给「重新计算当前设备延迟」入口用），返回是否拿到有效值 */
	refreshLatency(): boolean {
		return sampleLatencyNow();
	},

	/** 重新校准：多次读取当前设备的输出延迟并写入测量值 */
	calibrateLatency(): Promise<boolean> {
		return calibrateLatency();
	},

	/** 作废当前校准（手动偏移保留） */
	clearLatency(): void {
		clearLatencyMeasurement();
	},
};
