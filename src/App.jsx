import ChartCard from "./components/ChartCard";
import ProfileCard from "./components/ProfileCard";
import Hero from "./components/Hero";

import useOsuData from "./hooks/useOsuData";

import { formatRelativeTime } from "./utils/formatters";

import githubIcon from "./assets/github.svg";


/* =========================
   Main App
   ========================= */

function App() {

	const {
        stats,
        history,
        error,
		accuracyMin,
		accuracyMax,
    } = useOsuData();

    /* =========================
       Loading
       ========================= */

    if (!stats || !history) {
        return (
            <>
                <main className="container">
                    <div className="loading">
                        {error
                            ? "加载失败"
                            : "Loading..."}
                    </div>
                </main>
            </>
        );
    }


    return (
		<>
            <main className="container">

                {/* =========================
                   Hero
                   ========================= */}

                <Hero />


                {/* =========================
                   Profile
                   ========================= */}

                <ProfileCard stats={stats} />


                {/* =========================
                   History
                   ========================= */}

                <section className="history-section">

                    <div className="section-heading">

                        <div>
                            <p className="eyebrow">
                                HISTORY
                            </p>

                            <h2>
                                数据历史曲线展示
                            </h2>
                        </div>

                        <span className="history-count">
                            {history.length} 条记录
                        </span>

                    </div>


                    {history.length === 0 ? (

                        <div className="charts-grid">

                            <div className="chart-card chart-card-wide">

                                <div className="chart-error">
                                    暂无历史数据
                                </div>

                            </div>

                        </div>

                    ) : (

                        <div className="charts-grid">

                            <ChartCard
                                title="PP值"
                                description="Performance points"
                                unit="pp"
                                history={history}
                                dataKey="pp"
                                valueFormat="decimal"
                                suffix=" pp"
                                wide
                            />


                            <ChartCard
                                title="全球排名"
                                description="Global Rank"
                                unit="#"
                                history={history}
                                dataKey="global_rank"
                                valueFormat="integer"
                                reverse
                                fillBelow
                            />


                            <ChartCard
                                title="国家排名"
                                description="Country Rank"
                                unit="#"
                                history={history}
                                dataKey="country_rank"
                                valueFormat="integer"
                                reverse
                                fillBelow
                            />


                            <ChartCard
                                title="游玩次数"
                                description="Play Count"
                                unit="plays"
                                history={history}
                                dataKey="play_count"
                                valueFormat="integer"
                            />


                            <ChartCard
                                title="游玩时间"
                                description="Play Time"
                                unit="hours"
                                history={history.map(
                                    item => ({
                                        ...item,
                                        play_time_hours:
                                            Number(
                                                item.play_time
                                            ) / 3600,
                                    })
                                )}
                                dataKey="play_time_hours"
                                valueFormat="decimal"
                                suffix=" h"
                            />


                            <ChartCard
                                title="总分"
                                description="Total Score"
                                unit="score"
                                history={history}
                                dataKey="total_score"
                                valueFormat="compact"
                            />


                            <ChartCard
                                title="总命中次数"
                                description="Total Hits"
                                unit="hits"
                                history={history}
                                dataKey="total_hits"
                                valueFormat="compact"
                            />


                            <ChartCard
                                title="准确率"
                                description="Accuracy"
                                unit="%"
                                history={history}
                                dataKey="accuracy"
                                valueFormat="decimal"
                                suffix="%"
                                yMin={Math.max(
                                    0,
                                    accuracyMin - 0.01
                                )}
                                yMax={Math.min(
                                    100,
                                    accuracyMax + 0.01
                                )}
                            />

                        </div>

                    )}

                </section>


                {/* =========================
                   Footer
                   ========================= */}

                <footer>

					<div className="footer-info">
					
						<div className="osu-updated">
							{formatRelativeTime(
								stats.updated_at
							)}{" 前更新"}
						</div>

						<span className="footer-dot">
							·
						</span>

						<span>
							历史数据每日更新
						</span>
					
					</div>
					
					{/* GitHub */}
					<a
						className="github-button"
						href="https://github.com/Solidephile/Solidephile.github.io"
						target="_blank"
						rel="noopener noreferrer"
						aria-label="GitHub Repository"
					>
						<img src={githubIcon} alt="GitHub" />
					</a>

                </footer>

            </main>
        </>
    );
}

export default App;