<script lang="ts">
/**
 * osu 基本信息卡片（资料卡 + 关键统计 + 在线状态 / 游戏内主页链接）
 * 由 OsuPage 传入数据；位于 tabs 之外，任何 tab 下都可见。
 */

import avatarModule from "@assets/images/avatar.avif";
import Icon from "@components/common/Icon.svelte";
import type { OsuStats, OsuStatus } from "@/types/osu";

interface Props {
	stats: OsuStats;
	/** 实时在线状态；null 表示尚未拿到 */
	status: OsuStatus | null;
	/** 状态接口请求失败 */
	statusError: boolean;
}

const { stats, status, statusError }: Props = $props();

// 游戏内个人主页地址
const OSU_PROFILE_URL = "https://osu.ppy.sh/users/37807295";

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

// 「最后活跃」文案（比上面那行相对时间更口语化）
function lastVisitText(timestamp: string): string {
	const diff = Math.max(0, Date.now() - new Date(timestamp).getTime());
	const minutes = Math.floor(diff / 60000);
	if (minutes < 1) return "刚刚活跃";
	if (minutes < 60) return `最后活跃 ${minutes} 分钟前`;
	const hours = Math.floor(minutes / 60);
	if (hours < 24) return `最后活跃 ${hours} 小时前`;
	const days = Math.floor(hours / 24);
	if (days < 30) return `最后活跃 ${days} 天前`;
	const months = Math.floor(days / 30);
	if (months < 12) return `最后活跃 ${months} 个月前`;
	return `最后活跃 ${Math.floor(months / 12)} 年前`;
}

// 胶囊的中性样式（离线 / 隐身 / 未知共用）
const NEUTRAL_PILL =
	"border-(--line-divider) bg-(--btn-regular-bg) text-(--btn-content)";

// 在线状态展示：在线 / 最后活跃 / 隐身 / 未知 / 读取中
// 每种状态给出 { 文案, 圆点样式, 胶囊样式 }，模板里统一渲染成胶囊
let statusView = $derived.by(() => {
	if (!status) {
		return {
			text: statusError ? "在线状态未知" : "读取中…",
			dotClass: "bg-neutral-300 dark:bg-neutral-600",
			pillClass: NEUTRAL_PILL,
		};
	}

	if (status.is_online === true) {
		return {
			text: "当前在线",
			dotClass: "bg-emerald-500",
			pillClass:
				"border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:border-emerald-400/30 dark:bg-emerald-400/10 dark:text-emerald-400",
		};
	}

	if (status.last_visit) {
		return {
			text: lastVisitText(status.last_visit),
			dotClass: "bg-neutral-400 dark:bg-neutral-500",
			pillClass: NEUTRAL_PILL,
		};
	}

	// last_visit 为 null：用户隐藏了在线状态（空心圆点表示「不可见」）
	return {
		text: "隐身",
		dotClass:
			"border border-neutral-400 bg-transparent dark:border-neutral-500",
		pillClass: NEUTRAL_PILL,
	};
});
</script>

<div class="mb-3">
	<div class="card-base flex flex-col gap-4 px-6 pt-6 pb-4">
		<div class="flex items-center gap-4">
			<img
				src={avatarSrc}
				alt="osu! avatar"
				class="h-16 w-16 rounded-md object-cover"
			/>
			<div>
				<p class="text-xs tracking-widest text-neutral-500 dark:text-neutral-400">PLAYER</p>
				<h2 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100">{stats.username}</h2>
				<p class="text-sm text-neutral-600 dark:text-neutral-400">
					{stats.country}{stats.country_code ? ` · ${stats.country_code}` : ""}
				</p>
			</div>
		</div>

		<div class="grid grid-cols-2 gap-3 @2xl:grid-cols-4">
			<div class="rounded-xl bg-(--btn-regular-bg) p-3">
				<div class="text-base font-bold text-(--btn-content)">全球排名</div>
				<div class="text-[10px] tracking-wider text-neutral-500 dark:text-neutral-400">GLOBAL RANK</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">#{formatNumber(stats.global_rank)}</div>
			</div>
			<div class="rounded-xl bg-(--btn-regular-bg) p-3">
				<div class="text-base font-bold text-(--btn-content)">国家排名</div>
				<div class="text-[10px] tracking-wider text-neutral-500 dark:text-neutral-400">COUNTRY RANK</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">#{formatNumber(stats.country_rank)}</div>
			</div>
			<div class="rounded-xl bg-(--btn-regular-bg) p-3">
				<div class="text-base font-bold text-(--btn-content)">PP 值</div>
				<div class="text-[10px] tracking-wider text-neutral-500 dark:text-neutral-400">PERFORMANCE</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{formatNumber(stats.pp, 2)} pp</div>
			</div>
			<div class="rounded-xl bg-(--btn-regular-bg) p-3">
				<div class="text-base font-bold text-(--btn-content)">游玩时间</div>
				<div class="text-[10px] tracking-wider text-neutral-500 dark:text-neutral-400">PLAY TIME</div>
				<div class="mt-1 text-xl font-bold text-neutral-900 dark:text-neutral-100">{formatPlayTime(stats.play_time)}</div>
			</div>
		</div>

		<!-- 在线状态（左） + 游戏内主页链接（右） -->
		<div class="flex flex-wrap items-center justify-between gap-3 border-t border-(--line-divider) pt-4">
			<!-- 在线状态：胶囊（边框与底色跟随状态） -->
			<span
				class="inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm {statusView.pillClass}"
			>
				<span
					class="h-2 w-2 shrink-0 rounded-full {statusView.dotClass}"
					aria-hidden="true"
				></span>
				{statusView.text}
			</span>

			<a
				href={OSU_PROFILE_URL}
				target="_blank"
				rel="noopener noreferrer"
				class="btn-regular rounded-lg px-3 py-1.5 gap-1.5 text-sm font-medium text-(--btn-content) active:scale-95"
			>
				<Icon icon="material-symbols:open-in-new" class="text-base" />
				我的 osu! 主页
			</a>
		</div>
	</div>

	<div class="mt-3 text-xs text-neutral-500 dark:text-neutral-400">
		{formatRelativeTime(stats.updated_at)} 前更新 · 历史数据每日更新
	</div>
</div>
