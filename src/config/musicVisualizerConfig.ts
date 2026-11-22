/**
 * 单曲页频谱可视化
 *
 * 全局默认值；每首歌可以在 frontmatter 的 `theme.spectrum` 里局部覆写
 * （只写想改的字段，其余继承这里）。
 */
export type MusicVisualizerConfig = {
	/**
	 * 总开关：关掉后不建 AudioContext、不把 `<audio>` 接进音频图谱。
	 *
	 * 注意元素本身**创建时就带 `crossorigin="anonymous"`**，与这个开关无关。原因：
	 * 非 CORS 加载的元素一旦被接进图谱会直接静音（不是报错，error 兜底也抓不到），
	 * 比加载失败更难查，所以干脆一直按 CORS 加载；万一 CDN 没放行当前来源，元素会
	 * error，播放器的兜底去掉属性重试一次（放弃频谱保住播放）。
	 */
	enable: boolean;
	/** 竖条数量 */
	bars: number;
	/** 竖条区域高度（CSS 像素），不含下方倒影 */
	height: number;
	/** 颜色；空串 = 跟随主题色 `--music-accent` */
	color: string;
	/** AnalyserNode 的时间平滑（0~1，越大越稳越迟钝） */
	smoothing: number;
	/** 峰值回落速度（每帧减少的比例，越大掉得越快） */
	peakDecay: number;
	/**
	 * 噪声底（0~1）。字节频谱里音乐大部分能量都落在高位，不减掉底噪就全是
	 * 「每根条都顶着天花板」。
	 */
	floor: number;
	/**
	 * 压缩曲线（>1 越压越狠）。把高位那一小段能量拉开才能看出高低差；
	 * 觉得太「挑」就调小，觉得还是没差别就调大。
	 */
	curve: number;
	/**
	 * FFT 大小。左边几根竖条不动、还一起顶到天花板，主要就是它太小：bin 数不够时
	 * 对数分段下前几根会落到同一个 bin 上。调大才能分开，成本可以忽略
	 * （FFT 在音频线程里算）。
	 */
	fftSize: number;
	/** 下方倒影高度 = 柱高 × 这个比例；0 = 不要倒影 */
	reflect: number;
};

export const musicVisualizerConfig: MusicVisualizerConfig = {
	enable: true,
	bars: 32,
	height: 48,
	color: "",
	smoothing: 0.05,
	peakDecay: 0.02,
	floor: 0.05,
	curve: 1.8,
	fftSize: 4096,
	reflect: 0.4,
};
