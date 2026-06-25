import { TravelPlan, TravelEvent, CurrencyCode } from './portalTypes';

const safeBtoa = (str: string): string => {
    if (typeof btoa === 'function') return btoa(str);
    return Buffer.from(str, 'binary').toString('base64');
};

const safeAtob = (base64: string): string => {
    if (typeof atob === 'function') return atob(base64);
    return Buffer.from(base64, 'base64').toString('binary');
};

export const formatDateOnly = (dateStr: string): string => {
    try {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return dateStr;
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (isNaN(dateObj.getTime())) return dateStr;
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const month = months[dateObj.getMonth()];
        const day = dateObj.getDate();
        let suffix = 'th';
        if (day === 1 || day === 21 || day === 31) suffix = 'st';
        else if (day === 2 || day === 22) suffix = 'nd';
        else if (day === 3 || day === 23) suffix = 'rd';
        
        return `${month} ${day}${suffix}`;
    } catch {
        return dateStr;
    }
};

export const formatWeekdayFull = (dateStr: string): string => {
    try {
        const parts = dateStr.split('-');
        if (parts.length !== 3) return '';
        const dateObj = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        if (isNaN(dateObj.getTime())) return '';
        const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return weekdays[dateObj.getDay()];
    } catch {
        return '';
    }
};

export const encodePlan = (plan: TravelPlan): string => {
    const json = JSON.stringify(plan);
    const base64 = safeBtoa(encodeURIComponent(json)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    return base64;
};

export const decodePlan = (base64Param: string): TravelPlan | null => {
    try {
        let base64 = base64Param.replace(/-/g, '+').replace(/_/g, '/');
        while (base64.length % 4) {
            base64 += '=';
        }
        const decodedJson = decodeURIComponent(safeAtob(base64));
        return JSON.parse(decodedJson) as TravelPlan;
    } catch (e) {
        console.error('Decoding error:', e);
        return null;
    }
};

export const groupEventsByDay = (events: TravelEvent[]): Record<string, TravelEvent[]> => {
    const groups: Record<string, TravelEvent[]> = {};
    events.forEach(event => {
        if (!groups[event.date]) {
            groups[event.date] = [];
        }
        groups[event.date].push(event);
    });
    return groups;
};

export const convertCurrency = (amount: number, from: CurrencyCode, to: CurrencyCode, rate: number): number => {
    if (from === to) return amount;
    if (from === 'SEK' && to === 'JPY') {
        return amount * rate;
    }
    if (from === 'JPY' && to === 'SEK') {
        return amount / Math.max(rate, 0.0001);
    }
    return amount;
};

export const getEventGroupCost = (ev: TravelEvent, groupSize: number): number | undefined => {
    if (ev.cost === undefined || ev.cost === null) return undefined;
    if (ev.costType === 'per-person') {
        return ev.cost * groupSize;
    }
    return ev.cost;
};

export const formatConvertedCost = (cost: number, from: CurrencyCode, to: CurrencyCode, rate: number): string => {
    const converted = convertCurrency(cost, from, to, rate);
    const formatted = to === 'JPY' 
        ? Math.round(converted).toLocaleString() 
        : converted.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 });
    return to === 'JPY' ? `¥${formatted}` : `${formatted} kr`;
};

export const getDayTotalCostString = (dayEvents: TravelEvent[], targetCurrency: CurrencyCode, rate: number, groupSize: number): string => {
    let sum = 0;
    dayEvents.forEach(ev => {
        const groupCost = getEventGroupCost(ev, groupSize);
        if (groupCost !== undefined) {
            sum += convertCurrency(groupCost, ev.costCurrency || 'SEK', targetCurrency, rate);
        }
    });
    return formatConvertedCost(sum, targetCurrency, targetCurrency, rate);
};

export interface PlanCostSummary {
    constantTotal: number;
    perPersonTotal: number;
    groupTotal: number;
    perPersonShare: number;
}

export const getPlanCostSummary = (
    events: TravelEvent[],
    targetCurrency: CurrencyCode,
    rate: number,
    groupSize: number
): PlanCostSummary => {
    let constantTotal = 0;
    let perPersonTotal = 0;

    events.forEach(ev => {
        if (ev.cost !== undefined && ev.cost !== null) {
            const costInTarget = convertCurrency(ev.cost, ev.costCurrency || 'SEK', targetCurrency, rate);
            if (ev.costType === 'per-person') {
                perPersonTotal += costInTarget;
            } else {
                constantTotal += costInTarget;
            }
        }
    });

    const groupTotal = constantTotal + (perPersonTotal * groupSize);
    const perPersonShare = (constantTotal / Math.max(1, groupSize)) + perPersonTotal;

    return {
        constantTotal,
        perPersonTotal,
        groupTotal,
        perPersonShare
    };
};

