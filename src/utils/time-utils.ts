/** 秒 → `m:ss`，播放器各处共用 */
export function formatDuration(seconds: number): string {
	const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
	const minutes = Math.floor(safe / 60);

	return `${minutes}:${String(Math.floor(safe % 60)).padStart(2, "0")}`;
}
