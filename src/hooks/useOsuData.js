import { useEffect, useState } from "react";

export default function useOsuData() {
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState(null);
    const [accuracyMin, setAccuracyMin] = useState(null);
    const [accuracyMax, setAccuracyMax] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadData() {
            try {
                const response = await fetch(
                    `/api/osu?t=${Date.now()}`
                );

                if (!response.ok) {
                    throw new Error(
                        `API request failed: ${response.status}`
                    );
                }

                const data = await response.json();

                console.log("osu API data:", data);

                // =========================
                // Current stats
                // =========================

                if (!data.stats) {
                    throw new Error(
                        "API 返回数据中没有 stats"
                    );
                }

                setStats(data.stats);


                // =========================
                // History
                // =========================

                if (!Array.isArray(data.history)) {
                    throw new Error(
                        "API 返回数据中没有有效的 history"
                    );
                }

                const sortedHistory = [...data.history].sort(
                    (a, b) =>
                        new Date(a.timestamp) -
                        new Date(b.timestamp)
                );

                setHistory(sortedHistory);


                // =========================
                // Accuracy range
                // =========================

                const accuracyValues = sortedHistory
                    .map(item => Number(item.accuracy))
                    .filter(Number.isFinite);

                if (accuracyValues.length > 0) {
                    setAccuracyMin(
                        Math.min(...accuracyValues)
                    );

                    setAccuracyMax(
                        Math.max(...accuracyValues)
                    );
                } else {
                    setAccuracyMin(0);
                    setAccuracyMax(100);
                }

            } catch (err) {
                console.error(
                    "Failed to load osu! data:",
                    err
                );

                setError(err);
            }
        }

        loadData();
    }, []);

    return {
        stats,
        history,
        accuracyMin,
        accuracyMax,
        error
    };
}