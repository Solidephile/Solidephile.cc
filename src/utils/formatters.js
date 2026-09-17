export function formatNumber(value, decimals = 0) {
    return Number(value).toLocaleString("en-US", {
        minimumFractionDigits: decimals,
        maximumFractionDigits: decimals,
    });
}

export function formatDate(timestamp) {
    return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
    }).format(new Date(timestamp));
}

export function formatPlayTime(seconds) {
    const totalMinutes = Math.floor(Number(seconds) / 60);

    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;

    return `${days}d ${hours}h ${minutes}m`;
}

export function formatRelativeTime(timestamp) {
    const diff = Math.max(
        0,
        Date.now() - new Date(timestamp).getTime()
    );

    const minutes = Math.floor(diff / 60000);

    if (minutes < 60) {
        return `${minutes}m`;
    }

    if (minutes < 1440) {
        return `${Math.floor(minutes / 60)}h`;
    }

    return `${Math.floor(minutes / 1440)}d`;
}