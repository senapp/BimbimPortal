import * as React from 'react';
import { format, isBefore, parseISO } from 'date-fns';
import { TodoItem, TodoPageState, TodoPriority, TodoStatus } from '../utils/portalTypes';
import { usePersistedState } from '../utils/storage';
import css from './TodoPage.module.css';

type TodoFormState = {
    title: string;
    description: string;
    dueDate: string;
    status: TodoStatus;
    priority: TodoPriority;
};

const DEFAULT_TODO_STATE: TodoPageState = {
    items: [],
    filterStatus: 'all',
    filterQuery: '',
    sortBy: 'created',
};

const createEmptyForm = (): TodoFormState => ({
    title: '',
    description: '',
    dueDate: format(new Date(Date.now() + 86400000), 'yyyy-MM-dd'),
    status: 'todo',
    priority: 'medium',
});

const priorityRank: Record<TodoPriority, number> = {
    low: 1,
    medium: 2,
    high: 3,
};

const statusLabel: Record<TodoStatus, string> = {
    todo: 'Todo',
    'in-progress': 'In progress',
    done: 'Done',
};

const priorityLabel: Record<TodoPriority, string> = {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
};

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export type TodoItemView = TodoItem & {
    isOverdue: boolean;
};

export const getFilteredAndSortedTodoItems = (state: TodoPageState, todayIso: string): TodoItemView[] => {
    const query = state.filterQuery.trim().toLowerCase();

    const visibleItems = state.items.filter((item) => {
        const matchesQuery = !query || [item.title, item.description, item.priority, item.status, item.dueDate].join(' ').toLowerCase().includes(query);
        const matchesStatus = state.filterStatus === 'all' || item.status === state.filterStatus;

        return matchesQuery && matchesStatus;
    });

    return [...visibleItems].sort((left, right) => {
        if (state.sortBy === 'due') {
            return left.dueDate.localeCompare(right.dueDate);
        }

        if (state.sortBy === 'priority') {
            return priorityRank[right.priority] - priorityRank[left.priority];
        }

        return right.createdAt.localeCompare(left.createdAt);
    }).map((item) => ({
        ...item,
        isOverdue: item.status !== 'done' && isBefore(parseISO(item.dueDate), parseISO(todayIso)),
    }));
};

export const TodoPage: React.FC = () => {
    const [todoState, setTodoState] = usePersistedState<TodoPageState>('todo-state', DEFAULT_TODO_STATE);
    const [formState, setFormState] = React.useState<TodoFormState>(createEmptyForm());
    const [editingId, setEditingId] = React.useState<string | null>(null);

    const filteredItems = React.useMemo(() => {
        const todayIso = format(new Date(), 'yyyy-MM-dd');
        return getFilteredAndSortedTodoItems(todoState, todayIso);
    }, [todoState.filterQuery, todoState.filterStatus, todoState.items, todoState.sortBy]);

    const submitTask = (event: React.FormEvent): void => {
        event.preventDefault();

        const normalizedTitle = formState.title.trim();

        if (!normalizedTitle) {
            return;
        }

        const payload: TodoItem = {
            id: editingId ?? createId(),
            title: normalizedTitle,
            description: formState.description.trim(),
            dueDate: formState.dueDate,
            status: formState.status,
            priority: formState.priority,
            createdAt: editingId
                ? todoState.items.find((item) => item.id === editingId)?.createdAt ?? new Date().toISOString()
                : new Date().toISOString(),
        };

        setTodoState((previous) => ({
            ...previous,
            items: editingId
                ? previous.items.map((item) => (item.id === editingId ? payload : item))
                : [payload, ...previous.items],
        }));

        setEditingId(null);
        setFormState(createEmptyForm());
    };

    const editTask = (item: TodoItem): void => {
        setEditingId(item.id);
        setFormState({
            title: item.title,
            description: item.description,
            dueDate: item.dueDate,
            status: item.status,
            priority: item.priority,
        });
    };

    const toggleDone = (item: TodoItem): void => {
        setTodoState((previous) => ({
            ...previous,
            items: previous.items.map((current) => (current.id === item.id
                ? { ...current, status: current.status === 'done' ? 'todo' : 'done' }
                : current)),
        }));
    };

    const deleteTask = (taskId: string): void => {
        setTodoState((previous) => ({
            ...previous,
            items: previous.items.filter((item) => item.id !== taskId),
        }));

        if (editingId === taskId) {
            setEditingId(null);
            setFormState(createEmptyForm());
        }
    };

    return (
        <section className={css.page}>
            <div className={css.headerRow}>
                <div>
                    <h2 className={css.title}>Todo</h2>
                    <p className={css.subtitle}>A clean task board with filtering, sorting, editing, and persistence.</p>
                </div>

                <div className={css.toolbar}>
                    <label className={css.selectField}>
                        <span>Filter</span>
                        <select value={todoState.filterStatus} onChange={(event) => setTodoState((previous) => ({ ...previous, filterStatus: event.target.value as TodoPageState['filterStatus'] }))}>
                            <option value="all">All</option>
                            <option value="todo">Todo</option>
                            <option value="in-progress">In progress</option>
                            <option value="done">Done</option>
                        </select>
                    </label>

                    <label className={css.selectField}>
                        <span>Sort</span>
                        <select value={todoState.sortBy} onChange={(event) => setTodoState((previous) => ({ ...previous, sortBy: event.target.value as TodoPageState['sortBy'] }))}>
                            <option value="created">Created</option>
                            <option value="due">Due date</option>
                            <option value="priority">Priority</option>
                        </select>
                    </label>
                </div>
            </div>

            <div className={css.layout}>
                <aside className={css.listPane}>
                    <label className={css.searchField}>
                        <span>Search tasks</span>
                        <input type="search" value={todoState.filterQuery} onChange={(event) => setTodoState((previous) => ({ ...previous, filterQuery: event.target.value }))} placeholder="Search title, description, due date" />
                    </label>

                    <div className={css.listCard}>
                        <h3 className={css.panelTitle}>Tasks</h3>

                        <div className={css.todoList}>
                            {filteredItems.length === 0 ? (
                                <div className={css.emptyState}>No tasks match the current filter.</div>
                            ) : filteredItems.map((item) => (
                                <article key={item.id} className={`${css.todoItem} ${item.status === 'done' ? css.doneItem : ''} ${item.isOverdue ? css.overdueItem : ''}`.trim()}>
                                    <div className={css.todoHeader}>
                                        <div>
                                            <h4>{item.title}</h4>
                                            <p>{item.description || 'No description provided'}</p>
                                        </div>

                                        <span className={`${css.priorityPill} ${css[`priority-${item.priority}`]}`.trim()}>{priorityLabel[item.priority]}</span>
                                    </div>

                                    <div className={css.metaRow}>
                                        <span>{statusLabel[item.status]}</span>
                                        <span>{item.dueDate}</span>
                                        {item.isOverdue && <span>Overdue</span>}
                                    </div>

                                    <div className={css.actionsRow}>
                                        <button type="button" className={css.secondaryButton} onClick={() => toggleDone(item)}>{item.status === 'done' ? 'Undo' : 'Complete'}</button>
                                        <button type="button" className={css.secondaryButton} onClick={() => editTask(item)}>Edit</button>
                                        <button type="button" className={css.secondaryButtonDanger} onClick={() => deleteTask(item.id)}>Delete</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </aside>

                <section className={css.formPane}>
                    <form className={css.formCard} onSubmit={submitTask}>
                        <h3 className={css.panelTitle}>{editingId ? 'Edit task' : 'Create task'}</h3>

                        <div className={css.inputGrid}>
                            <label className={css.field}>
                                <span>Title</span>
                                <input type="text" required value={formState.title} onChange={(event) => setFormState((previous) => ({ ...previous, title: event.target.value }))} />
                            </label>

                            <label className={css.field}>
                                <span>Due date</span>
                                <input type="date" value={formState.dueDate} onChange={(event) => setFormState((previous) => ({ ...previous, dueDate: event.target.value }))} />
                            </label>

                            <label className={css.field}>
                                <span>Status</span>
                                <select value={formState.status} onChange={(event) => setFormState((previous) => ({ ...previous, status: event.target.value as TodoStatus }))}>
                                    <option value="todo">Todo</option>
                                    <option value="in-progress">In progress</option>
                                    <option value="done">Done</option>
                                </select>
                            </label>

                            <label className={css.field}>
                                <span>Priority</span>
                                <select value={formState.priority} onChange={(event) => setFormState((previous) => ({ ...previous, priority: event.target.value as TodoPriority }))}>
                                    <option value="low">Low</option>
                                    <option value="medium">Medium</option>
                                    <option value="high">High</option>
                                </select>
                            </label>

                            <label className={`${css.field} ${css.fullWidth}`}>
                                <span>Description</span>
                                <textarea rows={6} value={formState.description} onChange={(event) => setFormState((previous) => ({ ...previous, description: event.target.value }))} />
                            </label>
                        </div>

                        <div className={css.actionsRow}>
                            <button type="submit" className={css.primaryButton}>{editingId ? 'Update task' : 'Save task'}</button>
                            <button type="button" className={css.secondaryButton} onClick={() => { setEditingId(null); setFormState(createEmptyForm()); }}>Reset</button>
                        </div>
                    </form>
                </section>
            </div>
        </section>
    );
};