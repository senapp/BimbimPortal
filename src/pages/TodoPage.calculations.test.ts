import { getFilteredAndSortedTodoItems } from './TodoPage';
import { TodoPageState } from '../utils/portalTypes';

const baseState: TodoPageState = {
    items: [
        {
            id: '1',
            title: 'High first',
            description: 'alpha',
            dueDate: '2026-04-10',
            status: 'todo',
            priority: 'high',
            createdAt: '2026-04-01T00:00:00.000Z',
        },
        {
            id: '2',
            title: 'Medium second',
            description: 'beta',
            dueDate: '2026-04-08',
            status: 'in-progress',
            priority: 'medium',
            createdAt: '2026-04-02T00:00:00.000Z',
        },
        {
            id: '3',
            title: 'Low done',
            description: 'gamma',
            dueDate: '2026-04-03',
            status: 'done',
            priority: 'low',
            createdAt: '2026-04-03T00:00:00.000Z',
        },
    ],
    filterStatus: 'all',
    filterQuery: '',
    sortBy: 'created',
};

describe('TodoPage calculations', () => {
    test('filters by query across title/description', () => {
        const result = getFilteredAndSortedTodoItems({ ...baseState, filterQuery: 'beta' }, '2026-04-09');
        expect(result).toHaveLength(1);
        expect(result[0].id).toBe('2');
    });

    test('filters by status', () => {
        const result = getFilteredAndSortedTodoItems({ ...baseState, filterStatus: 'done' }, '2026-04-09');
        expect(result.map((item) => item.id)).toEqual(['3']);
    });

    test('sorts by priority descending', () => {
        const result = getFilteredAndSortedTodoItems({ ...baseState, sortBy: 'priority' }, '2026-04-09');
        expect(result.map((item) => item.id)).toEqual(['1', '2', '3']);
    });

    test('marks overdue only for unfinished tasks', () => {
        const result = getFilteredAndSortedTodoItems({ ...baseState, sortBy: 'due' }, '2026-04-09');
        const task2 = result.find((item) => item.id === '2');
        const task3 = result.find((item) => item.id === '3');

        expect(task2?.isOverdue).toBe(true);
        expect(task3?.isOverdue).toBe(false);
    });
});
