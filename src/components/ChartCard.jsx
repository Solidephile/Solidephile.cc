import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";

import { formatNumber, formatDate } from "../utils/formatters";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Tooltip,
    Filler
);


function getChartRange(
    values,
    paddingRatio = 0.08,
    minimumPadding = 1
) {
    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
        return {
            min: min - minimumPadding,
            max: max + minimumPadding,
        };
    }

    const padding = Math.max(
        (max - min) * paddingRatio,
        minimumPadding
    );

    return {
        min: min - padding,
        max: max + padding,
    };
}


/* =========================
   Chart configuration
   ========================= */

const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
        duration: 500,
    },

    interaction: {
        mode: "index",
        intersect: false,
    },

    plugins: {
        legend: {
            display: false,
        },

        tooltip: {
            displayColors: false,

            backgroundColor: "rgba(20, 17, 24, 0.96)",
            borderColor: "rgba(255,255,255,0.08)",
            borderWidth: 1,

            titleColor: "#f7f3f7",
            bodyColor: "#c8c1ca",

            padding: 10,
            cornerRadius: 10,
        },
    },

    scales: {
        x: {
            border: {
                display: false,
            },

            grid: {
                display: false,
            },

            ticks: {
                color: "#706873",
                maxTicksLimit: 7,

                font: {
                    size: 10,
                },
            },
        },

        y: {
            border: {
                display: false,
            },

            grid: {
                color: "rgba(255,255,255,0.045)",
            },

            ticks: {
                color: "#706873",
                maxTicksLimit: 5,
                padding: 6,

                font: {
                    size: 10,
                },
            },
        },
    },
};


/* =========================
   Gradient
   ========================= */

function createGradient(context) {
    const chart = context.chart;
    const { ctx, chartArea } = chart;

    if (!chartArea) {
        return "rgba(255, 102, 171, 0.12)";
    }

    const gradient = ctx.createLinearGradient(
        0,
        chartArea.top,
        0,
        chartArea.bottom
    );

    gradient.addColorStop(
        0,
        "rgba(255, 102, 171, 0.28)"
    );

    gradient.addColorStop(
        1,
        "rgba(255, 102, 171, 0)"
    );

    return gradient;
}


/* =========================
   Chart Card
   ========================= */

function ChartCard({
    title,
    description,
    unit,
    history,
    dataKey,
    valueFormat = "compact",
    suffix = "",
    reverse = false,
    fillBelow = false,
    wide = false,
    yMin,
    yMax,
}) {
    const values = history.map(
        item => Number(item[dataKey])
    );

    const range =
        yMin === undefined || yMax === undefined
            ? getChartRange(
                values,
                0.08,
                dataKey === "accuracy" ? 0.01 : 1
            )
            : {
                min: yMin,
                max: yMax,
            };


    function formatValue(value) {
        if (valueFormat === "integer") {
            return formatNumber(value);
        }

        if (valueFormat === "raw") {
            return Number(value).toLocaleString("en-US");
        }

        if (valueFormat === "decimal") {
            return formatNumber(value, 2);
        }

        return Number(value).toLocaleString(
            "en-US",
            {
                notation: "compact",
                maximumFractionDigits: 2,
            }
        );
    }


    const chartData = {
        labels: history.map(
            item => formatDate(item.timestamp)
        ),

        datasets: [
            {
                label: title,

                data: values,

                borderColor: "#ff66ab",
                borderWidth: 2,

                pointRadius:
                    history.length <= 20 ? 3 : 0,

                pointHoverRadius: 5,

                pointBackgroundColor: "#ff66ab",
                pointBorderWidth: 0,

                tension: 0.32,

                fill: fillBelow ? "start" : "origin",

                backgroundColor: createGradient,
            },
        ],
    };


    const options = {
        ...chartDefaults,

        scales: {
            ...chartDefaults.scales,

            x: {
                ...chartDefaults.scales.x,
            },

            y: {
                ...chartDefaults.scales.y,

                reverse,

                min: range.min,
                max: range.max,

                ticks: {
                    ...chartDefaults.scales.y.ticks,

                    callback: value =>
                        `${formatValue(value)}${suffix}`,
                },
            },
        },

        plugins: {
            ...chartDefaults.plugins,

            tooltip: {
                ...chartDefaults.plugins.tooltip,

                callbacks: {
                    label: context =>
                        `${title}：${formatValue(
                            context.parsed.y
                        )}${suffix}`,
                },
            },
        },
    };


    return (
        <article
            className={
                `chart-card ${wide ? "chart-card-wide" : ""}`
            }
        >
            <div className="chart-header">

                <div>
                    <h3>{title}</h3>
                    <p>{description}</p>
                </div>

                <span className="chart-unit">
                    {unit}
                </span>

            </div>

            <div className="chart-wrap">
                <Line
                    data={chartData}
                    options={options}
                />
            </div>
        </article>
    );
}

export default ChartCard;