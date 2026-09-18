import {
    formatNumber,
    formatPlayTime,
} from "../utils/formatters";

import externalLinkIcon from "../assets/external-link.svg";

export default function ProfileCard({ stats }) {
    return (
        <section className="profile-card">

            {/* Profile Header */}

            <div className="profile-header">

                <div className="avatar">
                    <img
                        src={stats.avatar_url || ""}
                        alt="osu! avatar"
                    />
                </div>


                <div className="player-info">

                    <p className="player-label">
                        PLAYER
                    </p>

                    <h2>
                        {stats.username}
                    </h2>

                    <p>
                        {stats.country}
                        {stats.country_code
                            ? ` · ${stats.country_code}`
                            : ""}
                    </p>

                </div>


                {/* osu! Profile */}

                <a
					className="osu-button"
					href="https://osu.ppy.sh/users/37807295"
					target="_blank"
					rel="noopener noreferrer"
					aria-label="访问 osu! 主页"
				>
					<span className="osu-button-label">
						访问 osu! 主页
					</span>

					<img
						className="external-link-icon"
						src={externalLinkIcon}
						alt=""
						aria-hidden="true"
					/>
				</a>

            </div>


            {/* Current Stats */}

            <div className="stats-grid">

                <div className="stat">
                    <span className="stat-label">
                        全球排名
                        <small>GLOBAL RANK</small>
                    </span>

                    <strong>
                        #{formatNumber(
                            stats.global_rank
                        )}
                    </strong>
                </div>


                <div className="stat">
                    <span className="stat-label">
                        国家排名
                        <small>COUNTRY RANK</small>
                    </span>

                    <strong>
                        #{formatNumber(
                            stats.country_rank
                        )}
                    </strong>
                </div>


                <div className="stat">
                    <span className="stat-label">
                        PP值
                        <small>PERFORMANCE</small>
                    </span>

                    <strong>
                        {formatNumber(
                            stats.pp,
                            2
                        )}
                        <small> pp</small>
                    </strong>
                </div>


                <div className="stat">
                    <span className="stat-label">
                        游玩时间
                        <small>PLAY TIME</small>
                    </span>

                    <strong>
                        {formatPlayTime(
                            stats.play_time
                        )}
                    </strong>
                </div>

            </div>

        </section>
    );
}