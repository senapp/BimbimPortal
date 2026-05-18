import * as React from 'react';
import { EventCategory } from '../../utils/portalTypes';
import { EVENT_COLORS, EVENT_CATEGORY_OPTIONS } from '../../utils/timelineConstants';
import css from '../../pages/TimelinePage.module.css';

interface EventFormState {
    title: string;
    description: string;
    category: EventCategory;
    color: string;
    eventType: 'point' | 'period';
    date?: string;
    startDate?: string;
    endDate?: string;
}

interface EventFormProps {
    formState: EventFormState;
    setFormState: (state: EventFormState) => void;
    onSave: () => void;
    onCancel: () => void;
    onDelete?: () => void;
    isEditing: boolean;
}

export const EventForm: React.FC<EventFormProps> = ({
    formState,
    setFormState,
    onSave,
    onCancel,
    onDelete,
    isEditing,
}) => {
    return (
        <div className={css.modalOverlay} onClick={onCancel}>
            <div className={css.modal} onClick={(e) => e.stopPropagation()}>
                <h2>{isEditing ? 'Edit Event' : 'Create Event'}</h2>

                {/* Title */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Title
                    </label>
                    <input
                        type="text"
                        className={css.input}
                        value={formState.title}
                        onChange={(e) =>
                            setFormState({ ...formState, title: e.target.value })
                        }
                        placeholder="Event title..."
                    />
                </div>

                {/* Description */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Description (optional)
                    </label>
                    <textarea
                        className={css.input}
                        value={formState.description}
                        onChange={(e) =>
                            setFormState({ ...formState, description: e.target.value })
                        }
                        placeholder="Add details..."
                        style={{ minHeight: '80px', fontFamily: 'inherit' }}
                    />
                </div>

                {/* Event Type */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Event Type
                    </label>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            style={{
                                flex: 1,
                                padding: '8px',
                                border:
                                    formState.eventType === 'point'
                                        ? '2px solid #4ECDC4'
                                        : '2px solid #ddd',
                                background:
                                    formState.eventType === 'point' ? '#f0fffe' : 'white',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onClick={() =>
                                setFormState({ ...formState, eventType: 'point' })
                            }
                        >
                            Point in Time
                        </button>
                        <button
                            style={{
                                flex: 1,
                                padding: '8px',
                                border:
                                    formState.eventType === 'period'
                                        ? '2px solid #4ECDC4'
                                        : '2px solid #ddd',
                                background:
                                    formState.eventType === 'period' ? '#f0fffe' : 'white',
                                borderRadius: '6px',
                                cursor: 'pointer',
                                transition: 'all 0.2s ease',
                            }}
                            onClick={() =>
                                setFormState({ ...formState, eventType: 'period' })
                            }
                        >
                            Period
                        </button>
                    </div>
                </div>

                {/* Date Fields */}
                {formState.eventType === 'point' ? (
                    <div style={{ marginBottom: '16px' }}>
                        <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                            Date
                        </label>
                        <input
                            type="date"
                            className={css.input}
                            value={formState.date || ''}
                            onChange={(e) =>
                                setFormState({ ...formState, date: e.target.value })
                            }
                        />
                    </div>
                ) : (
                    <>
                        <div style={{ marginBottom: '16px' }}>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: '4px',
                                    fontWeight: 500,
                                }}
                            >
                                Start Date
                            </label>
                            <input
                                type="date"
                                className={css.input}
                                value={formState.startDate || ''}
                                onChange={(e) =>
                                    setFormState({
                                        ...formState,
                                        startDate: e.target.value,
                                    })
                                }
                            />
                        </div>
                        <div style={{ marginBottom: '16px' }}>
                            <label
                                style={{
                                    display: 'block',
                                    marginBottom: '4px',
                                    fontWeight: 500,
                                }}
                            >
                                End Date
                            </label>
                            <input
                                type="date"
                                className={css.input}
                                value={formState.endDate || ''}
                                onChange={(e) =>
                                    setFormState({ ...formState, endDate: e.target.value })
                                }
                            />
                        </div>
                    </>
                )}

                {/* Category */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Category
                    </label>
                    <select
                        className={css.input}
                        value={formState.category}
                        onChange={(e) =>
                            setFormState({
                                ...formState,
                                category: e.target.value as EventCategory,
                            })
                        }
                        style={{ cursor: 'pointer' }}
                    >
                        {EVENT_CATEGORY_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </div>

                {/* Color */}
                <div style={{ marginBottom: '16px' }}>
                    <label style={{ display: 'block', marginBottom: '4px', fontWeight: 500 }}>
                        Color
                    </label>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        {EVENT_COLORS.map((color) => (
                            <button
                                key={color}
                                style={{
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '4px',
                                    background: color,
                                    border:
                                        formState.color === color
                                            ? '3px solid #333'
                                            : '2px solid #ddd',
                                    cursor: 'pointer',
                                    transition: 'all 0.2s ease',
                                }}
                                onClick={() =>
                                    setFormState({ ...formState, color })
                                }
                                title={color}
                            />
                        ))}
                    </div>
                </div>

                {/* Buttons */}
                <div className={css.modalButtons}>
                    <button onClick={onSave} className={css.primaryButton}>
                        {isEditing ? 'Save Changes' : 'Create Event'}
                    </button>
                    <button onClick={onCancel} className={css.secondaryButton}>
                        Cancel
                    </button>
                    {isEditing && onDelete && (
                        <button
                            onClick={() => {
                                if (window.confirm('Delete this event? This cannot be undone.')) {
                                    onDelete();
                                }
                            }}
                            style={{
                                padding: '12px 20px',
                                background: '#ff6b6b',
                                border: 'none',
                                borderRadius: '8px',
                                color: 'white',
                                cursor: 'pointer',
                                fontSize: '14px',
                                fontWeight: 500,
                                transition: 'background 0.2s ease',
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.background = '#ff5252')}
                            onMouseLeave={(e) => (e.currentTarget.style.background = '#ff6b6b')}
                        >
                            Delete Event
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
};
