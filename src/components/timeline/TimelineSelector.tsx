import * as React from 'react';
import { Timeline } from '../../utils/portalTypes';
import css from '../../pages/TimelinePage.module.css';

interface TimelineSelectorProps {
    timelines: Timeline[];
    selectedTimelineId: string | null;
    onSelectTimeline: (id: string) => void;
    onDeleteTimeline: (id: string) => void;
    onCreateTimeline: () => void;
}

export const TimelineSelector: React.FC<TimelineSelectorProps> = ({
    timelines,
    selectedTimelineId,
    onSelectTimeline,
    onDeleteTimeline,
    onCreateTimeline,
}) => {
    return (
        <div className={css.selector}>
            <div className={css.selectorButtons}>
                {timelines.map((timeline) => (
                    <div key={timeline.id} style={{ display: 'flex', gap: '0px', alignItems: 'center' }}>
                        <button
                            className={`${css.selectButton} ${
                                selectedTimelineId === timeline.id ? css.active : ''
                            }`}
                            onClick={() => onSelectTimeline(timeline.id)}
                            style={{ borderRadius: '8px 0 0 8px' }}
                        >
                            {timeline.name}
                        </button>
                        <button
                            className={css.deleteButton}
                            onClick={() => {
                                if (window.confirm(`Delete timeline "${timeline.name}"?`)) {
                                    onDeleteTimeline(timeline.id);
                                }
                            }}
                            title="Delete timeline"
                            style={{
                                borderRadius: '0 8px 8px 0',
                                padding: '12px 10px',
                                fontSize: '16px',
                            }}
                        >
                            ×
                        </button>
                    </div>
                ))}
            </div>
            <button className={css.createButton} onClick={onCreateTimeline}>
                + New Timeline
            </button>
        </div>
    );
};
