import { 
    formatDateOnly, 
    formatWeekdayFull,
    encodePlan, 
    decodePlan, 
    groupEventsByDay,
    convertCurrency,
    getEventGroupCost,
    formatConvertedCost,
    getDayTotalCostString,
    getPlanCostSummary
} from '../utils/travelUtils';
import { TravelPlan, TravelEvent } from '../utils/portalTypes';

describe('Travel plan utility functions', () => {
    
    test('formatDateOnly and formatWeekdayFull correctly format date and weekday', () => {
        expect(formatDateOnly('2026-06-20')).toBe('Jun 20th');
        expect(formatDateOnly('2026-09-09')).toBe('Sep 9th');
        expect(formatDateOnly('2026-01-01')).toBe('Jan 1st');
        expect(formatDateOnly('invalid-date')).toBe('invalid-date');

        expect(formatWeekdayFull('2026-06-20')).toBe('Saturday');
        expect(formatWeekdayFull('2026-09-09')).toBe('Wednesday');
        expect(formatWeekdayFull('2026-01-01')).toBe('Thursday');
        expect(formatWeekdayFull('invalid-date')).toBe('');
    });

    test('groupEventsByDay groups events by their date field', () => {
        const events: TravelEvent[] = [
            { id: '1', title: 'A', date: '2026-06-20', latitude: 0, longitude: 0, description: '' },
            { id: '2', title: 'B', date: '2026-06-20', latitude: 0, longitude: 0, description: '' },
            { id: '3', title: 'C', date: '2026-06-21', latitude: 0, longitude: 0, description: '' },
        ];
        const grouped = groupEventsByDay(events);
        expect(grouped['2026-06-20']).toHaveLength(2);
        expect(grouped['2026-06-21']).toHaveLength(1);
        expect(grouped['2026-06-20'][0].title).toBe('A');
        expect(grouped['2026-06-20'][1].title).toBe('B');
        expect(grouped['2026-06-21'][0].title).toBe('C');
    });

    test('encodePlan and decodePlan safely encode and decode plan data including special characters and emojis', () => {
        const plan: TravelPlan = {
            id: 'plan-123',
            name: 'Trip to Tokyo 🇯🇵 & Stockholm 🇸🇪',
            startDate: '2026-06-20',
            endDate: '2026-06-27',
            events: [
                {
                    id: 'ev-1',
                    title: 'Check-in to hotel 🏨',
                    description: 'Hilton Tokyo - check in at 15:00',
                    date: '2026-06-20',
                    time: '15:00',
                    latitude: 35.6909,
                    longitude: 139.7003,
                    isAccommodation: true,
                },
                {
                    id: 'ev-2',
                    title: 'Dinner at Tsukiji 🍣',
                    description: 'Delicious sushi place',
                    date: '2026-06-20',
                    time: '18:00',
                    latitude: 35.6654,
                    longitude: 139.7709,
                    transportMethod: 'train',
                }
            ],
            createdAt: '2026-06-20T10:00:00Z',
            updatedAt: '2026-06-20T10:00:00Z',
        };

        const encoded = encodePlan(plan);
        // Base64URL-safe string should not contain '+', '/', or '='
        expect(encoded).not.toContain('+');
        expect(encoded).not.toContain('/');
        expect(encoded).not.toContain('=');

        const decoded = decodePlan(encoded);
        expect(decoded).not.toBeNull();
        expect(decoded?.id).toBe(plan.id);
        expect(decoded?.name).toBe(plan.name);
        expect(decoded?.events).toHaveLength(2);
        expect(decoded?.events[0].title).toBe(plan.events[0].title);
        expect(decoded?.events[0].isAccommodation).toBe(true);
        expect(decoded?.events[1].transportMethod).toBe('train');
    });

    test('convertCurrency correctly converts between SEK and JPY based on rate', () => {
        expect(convertCurrency(100, 'SEK', 'SEK', 15.0)).toBe(100);
        expect(convertCurrency(1500, 'JPY', 'JPY', 15.0)).toBe(1500);
        expect(convertCurrency(100, 'SEK', 'JPY', 15.0)).toBe(1500);
        expect(convertCurrency(1500, 'JPY', 'SEK', 15.0)).toBe(100);
        expect(convertCurrency(1500, 'JPY', 'SEK', 0)).toBe(1500 / 0.0001); // Handle division by zero
    });

    test('getEventGroupCost handles constant vs per-person cost calculations', () => {
        const evConstant: TravelEvent = {
            id: '1', title: 'Hotel', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
            cost: 1000, costType: 'constant'
        };
        const evPerPerson: TravelEvent = {
            id: '2', title: 'Train ticket', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
            cost: 500, costType: 'per-person'
        };
        const evNoCost: TravelEvent = {
            id: '3', title: 'Walk in park', date: '2026-06-20', latitude: 0, longitude: 0, description: ''
        };

        expect(getEventGroupCost(evConstant, 1)).toBe(1000);
        expect(getEventGroupCost(evConstant, 3)).toBe(1000);

        expect(getEventGroupCost(evPerPerson, 1)).toBe(500);
        expect(getEventGroupCost(evPerPerson, 3)).toBe(1500);

        expect(getEventGroupCost(evNoCost, 3)).toBeUndefined();
    });

    test('formatConvertedCost formats cost correctly for target currency', () => {
        expect(formatConvertedCost(100, 'SEK', 'SEK', 15.0)).toBe(`${(100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`);
        expect(formatConvertedCost(100.5, 'SEK', 'SEK', 15.0)).toBe(`${(100.5).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`);
        expect(formatConvertedCost(100, 'SEK', 'JPY', 15.0)).toBe(`¥${Math.round(1500).toLocaleString()}`);
        expect(formatConvertedCost(1500, 'JPY', 'SEK', 15.0)).toBe(`${(100).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`);
    });

    test('getDayTotalCostString sums and formats scaled costs of multiple events', () => {
        const dayEvents: TravelEvent[] = [
            {
                id: '1', title: 'Hotel (constant)', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
                cost: 1000, costCurrency: 'SEK', costType: 'constant'
            },
            {
                id: '2', title: 'Museum (per-person)', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
                cost: 200, costCurrency: 'SEK', costType: 'per-person'
            },
            {
                id: '3', title: 'Dinner (JPY per-person)', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
                cost: 1500, costCurrency: 'JPY', costType: 'per-person'
            }
        ];

        // Group size = 2, rate = 15.0
        // Expected costs:
        // Hotel: 1000 SEK (constant)
        // Museum: 200 * 2 = 400 SEK
        // Dinner: (1500 JPY * 2) = 3000 JPY -> 3000 / 15 = 200 SEK
        // Total = 1000 + 400 + 200 = 1600 SEK -> "1,600 kr" (formatted according to locale)
        expect(getDayTotalCostString(dayEvents, 'SEK', 15.0, 2)).toBe(`${(1600).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`);

        // Group size = 1, rate = 15.0
        // Expected costs:
        // Hotel: 1000 SEK
        // Museum: 200 SEK
        // Dinner: 1500 JPY -> 100 SEK
        // Total = 1000 + 200 + 100 = 1300 SEK -> "1,300 kr"
        expect(getDayTotalCostString(dayEvents, 'SEK', 15.0, 1)).toBe(`${(1300).toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })} kr`);

        // Target currency = JPY, group size = 2, rate = 15.0
        // Expected total = 1600 SEK -> 1600 * 15 = 24000 JPY -> "¥24,000"
        expect(getDayTotalCostString(dayEvents, 'JPY', 15.0, 2)).toBe(`¥${Math.round(24000).toLocaleString()}`);
    });

    test('getPlanCostSummary correctly aggregates constant total, per-person total, group total, and per-person shares', () => {
        const events: TravelEvent[] = [
            {
                id: '1', title: 'Hotel (constant)', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
                cost: 1000, costCurrency: 'SEK', costType: 'constant'
            },
            {
                id: '2', title: 'Museum (per-person)', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
                cost: 200, costCurrency: 'SEK', costType: 'per-person'
            },
            {
                id: '3', title: 'Dinner (JPY per-person)', date: '2026-06-20', latitude: 0, longitude: 0, description: '',
                cost: 1500, costCurrency: 'JPY', costType: 'per-person' // 100 SEK
            }
        ];

        // Rate = 15.0, groupSize = 2, targetCurrency = SEK
        // constantTotal: 1000 SEK
        // perPersonTotal: 200 + (1500 / 15) = 300 SEK
        // groupTotal: 1000 + (300 * 2) = 1600 SEK
        // perPersonShare: (1000 / 2) + 300 = 800 SEK
        const summary1 = getPlanCostSummary(events, 'SEK', 15.0, 2);
        expect(summary1.constantTotal).toBe(1000);
        expect(summary1.perPersonTotal).toBe(300);
        expect(summary1.groupTotal).toBe(1600);
        expect(summary1.perPersonShare).toBe(800);

        // groupSize = 4
        // groupTotal: 1000 + (300 * 4) = 2200 SEK
        // perPersonShare: (1000 / 4) + 300 = 550 SEK
        const summary2 = getPlanCostSummary(events, 'SEK', 15.0, 4);
        expect(summary2.groupTotal).toBe(2200);
        expect(summary2.perPersonShare).toBe(550);
    });
});
