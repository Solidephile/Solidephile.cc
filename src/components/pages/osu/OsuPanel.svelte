<script lang="ts">
/**
 * osu 基本信息卡片（资料卡 + 关键统计）
 * 由 OsuPage 传入数据；位于 tabs 之外，任何 tab 下都可见。
 */
import avatarModule from "@assets/images/avatar.avif";
import type { OsuStats } from "@/types/osu";

interface Props {
	stats: OsuStats;
}

const { stats }: Props = $props();

// Astro 会把 src 目录下的图片 import 转成 ImageMetadata 对象（{ src, width, height, format }），
// 这里取其 .src 作为图片地址；若某条构建路径直接返回 URL 字符串，也一并兼容。
const avatarImage = avatarModule as unknown as string | { src: string };
const avatarSrc =
	typeof avatarImage === "string" ? avatarImage : avatarImage.src;

function formatNumber(value: number, decimals = 0) {
	return Number(value).toLocaleString("en-US", {
		minimumFractionDigits: decimals,
		maximumFractionDigits: decimals,
	});
}

function formatPlayTime(seconds: number) {
	const totalMinutes = Math.floor(Number(seconds) / 60);
	const days = Math.floor(totalMinutes / 1440);
	const hours = Math.floor((totalMinutes % 1440) / 60);
	const minutes = totalMinutes % 60;
	return `${days}d ${hours}h ${minutes}m`;
}

function formatRelativeTime(timestamp: string) {
	const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
	const minutes = Math.floor(diff / 60000);
	if (minutes < 60) return `${minutes}m`;
	if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
	return `${Math.floor(minutes / 1440)}d`;
}
</script>

<div class="mb-6">
	<div class="card-base flex flex-col gap-4 p-6">
		<div class="flex items-center gap-4">
			<img
				src={avatarSrc}
				alt="osu! avatar"
				class="h-16 w-16 rounded-md object-cover"
			/>
			<div>
				<p class="text-xs text-neutral-500 dark:text-neutral-400">PLAYER</p>
				<h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.username}</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">
					{stats.country}{stats.country_code ? ` · ${stats.country_code}` : ""}
				</p>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">全球排名</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">GLOBAL RANK</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">#{formatNumber(stats.global_rank)}</div>
			</div>
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">国家排名</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">COUNTRY RANK</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">#{formatNumber(stats.country_rank)}</div>
			</div>
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">PP 值</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">PERFORMANCE</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{formatNumber(stats.pp, 2)} pp</div>
			</div>
			<div class="rounded-xl bg-(--card-bg) p-3 border border-(--line-divider)">
				<div class="text-base font-bold text-neutral-500 dark:text-neutral-400">游玩时间</div>
				<div class="text-[10px] tracking-wide text-neutral-400 dark:text-neutral-500">PLAY TIME</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{formatPlayTime(stats.play_time)}</div>
			</div>
		</div>
	</div>

	<div class="mt-3 text-sm text-neutral-500 dark:text-neutral-400">
		{formatRelativeTime(stats.updated_at)} 前更新 · 历史数据每日更新
	</div>
</div>
