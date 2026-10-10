import { serializeDate } from "@web/core/l10n/dates";

export function predefinedRange(key, today, weekStart) {
    let start;
    switch (key) {
        case "today": start = today; break;
        case "week": start = today.minus({ days: (today.weekday - weekStart + 7) % 7 }); break;
        case "month": start = today.startOf("month"); break;
        case "year": start = today.startOf("year"); break;
        default: throw new Error("Unknown invoice date range");
    }
    return { start: serializeDate(start), end: serializeDate(today) };
}

export function isValidRange(start, end) {
    return Boolean(start?.isValid && end?.isValid && start.startOf("day") <= end.startOf("day"));
}
