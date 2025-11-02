import { format } from 'd3-format';

export function formatNumber(value: number, formatString: string): string {
    return format(formatString)(value);
}

export function formatCurrency(value: number): string {
    return format('$,.2f')(value);
}

export function formatPercentage(value: number): string {
    return format('.2%')(value);
}

export function formatDecimal(value: number, precision: number = 2): string {
    return format(`,.${precision}f`)(value);
}