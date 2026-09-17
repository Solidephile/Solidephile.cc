import { useEffect, useState } from "react";

export default function useOsuData() {
    const [stats, setStats] = useState(null);
    const [history, setHistory] = useState(null);
    const [error, setError] = useState(null);

    useEffect(() => {
        async function loadData() {
            try {
                const timestamp = Date.now();

                const [
                    statsResponse,
                    historyResponse,
                ] = await Promise.all([
                    fetch(`/data/osu.json?t=${timestamp}`),
                    fetch(`/data/osu_history.json?t=${timestamp}`),
                ]);

                if (!statsResponse.ok) {
                    throw new Error(
                        `osu.json request failed: ${statsResponse.status}`
                    );
                }

                if (!historyResponse.ok) {
                    throw new Error(
                        `osu_history.json request failed: ${historyResponse.status}`
                    );
                }

                const statsData =
                    await statsResponse.json();

                const historyData =
                    await historyResponse.json();

                setStats(statsData);

                setHistory(
                    Array.isArray(historyData.history)
                        ? [...historyData.history].sort(
                            (a, b) =>
                                new Date(a.timestamp) -
                                new Date(b.timestamp)
                        )
                        : []
                );
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

    const accuracyValues =
        history?.map(item => Number(item.accuracy)) || [];

    const accuracyMin =
        accuracyValues.length > 0
            ? Math.min(...accuracyValues)
            : 0;

    const accuracyMax =
        accuracyValues.length > 0
            ? Math.max(...accuracyValues)
            : 100;

    return {
        stats,
        history,
        error,
        accuracyMin,
        accuracyMax,
    };
}