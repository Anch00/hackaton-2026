import { format, parseISO } from 'date-fns'

/**
 * Formats an ISO timestamp string as 'dd.MM.yyyy HH:mm'.
 * Used in tables and detail views where full date context is needed.
 */
export function fmtTimestamp(ts: string): string {
    try {
        return format(parseISO(ts), 'dd.MM HH:mm')
    } catch {
        return ts
    }
}

/**
 * Formats an ISO timestamp string as 'dd.MM HH:mm'.
 * Used in chart axis ticks and tooltips where space is limited.
 */
export function fmtTimestampShort(ts: string): string {
    try {
        return format(parseISO(ts), 'dd.MM HH:mm')
    } catch {
        return ts
    }
}
