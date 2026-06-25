import * as React from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, Polyline, useMap, useMapEvents } from 'react-leaflet';
import { TravelEvent, TravelPlan, TravelPageState, TravelTransportMethod, CurrencyCode } from '../utils/portalTypes';
import { usePersistedState } from '../utils/storage';
import { formatDateOnly, formatWeekdayFull, encodePlan, decodePlan, groupEventsByDay, getEventGroupCost, formatConvertedCost, getDayTotalCostString, getPlanCostSummary } from '../utils/travelUtils';
import css from './TravelPage.module.css';

const DEFAULT_STATE: TravelPageState = {
    plans: [],
    selectedPlanId: null,
    displayCurrency: 'SEK',
    groupSize: 2,
};

const TRANSPORT_METHODS: { value: TravelTransportMethod; label: string }[] = [
    { value: 'plane', label: '✈️ Plane' },
    { value: 'car', label: '🚗 Car' },
    { value: 'bus', label: '🚌 Bus' },
    { value: 'train', label: '🚆 Train' },
    { value: 'walk', label: '🚶 Walk' },
];

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const LeafletTileLayer = TileLayer as React.ComponentType<any>;
const LeafletMarker = Marker as React.ComponentType<any>;
const LeafletPopup = Popup as React.ComponentType<any>;
const LeafletPolyline = Polyline as React.ComponentType<any>;

const RoutePolyline: React.FC<{
    from: [number, number];
    to: [number, number];
    method: TravelTransportMethod;
}> = ({ from, to, method }) => {
    const [path, setPath] = React.useState<[number, number][]>([from, to]);
    const [progress, setProgress] = React.useState(0);
    const markerRef = React.useRef<any>(null);

    const pathData = React.useMemo(() => {
        if (path.length < 2) return { totalDist: 0, cumulativeDists: [0], segmentAngles: [] };
        
        let totalDist = 0;
        const cumulativeDists: number[] = [0];
        const segmentAngles: number[] = [];
        for (let i = 0; i < path.length - 1; i++) {
            const p1 = path[i];
            const p2 = path[i+1];
            const d = Math.sqrt(Math.pow(p2[0]-p1[0], 2) + Math.pow(p2[1]-p1[1], 2));
            totalDist += d;
            cumulativeDists.push(totalDist);
            
            const dy = p2[0] - p1[0];
            const dx = p2[1] - p1[1];
            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
            segmentAngles.push(90 - angle);
        }
        return { totalDist, cumulativeDists, segmentAngles };
    }, [path]);

    const color = method === 'plane' ? '#fbbf24' : method === 'train' ? '#10b981' : method === 'car' ? '#3b82f6' : '#6366f1';

    const icon = React.useMemo(() => {
        const getSvgPath = (m: TravelTransportMethod) => {
            switch (m) {
                case 'plane': return 'M21,16 L21,14 L13,9 L13,3.5 C13,2.67 12.33,2 11.5,2 C10.67,2 10,2.67 10,3.5 L10,9 L2,14 L2,16 L10,13.5 L10,19 L8,20.5 L8,22 L11.5,21 L15,22 L15,20.5 L13,19 L13,13.5 L21,16 Z';
                case 'car': return 'M18.92,6.01 C18.72,5.42 18.16,5 17.5,5 L6.5,5 C5.84,5 5.28,5.42 5.08,6.01 L3,12 L3,20 C3,20.55 3.45,21 4,21 L5,21 C5.55,21 6,20.55 6,20 L6,19 L18,19 L18,20 C18,20.55 18.45,21 19,21 L20,21 C20.55,21 21,20.55 21,20 L21,12 L18.92,6.01 Z';
                case 'bus': return 'M18,11 L18,19 C18,20.1 17.1,21 16,21 L8,21 C6.9,21 6,20.1 6,19 L6,11 C6,9.9 6.9,9 8,9 L16,9 C17.1,9 18,9.9 18,11 Z M16,11 L8,11 L8,13 L16,13 L16,11 Z M16,15 L8,15 L8,17 L16,17 L16,15 Z';
                case 'train': return 'M18,10 L18,20 C18,21.1 17.1,22 16,22 L8,22 C6.9,22 6,21.1 6,20 L6,10 C6,8.9 6.9,8 8,8 L16,8 C17.1,8 18,8.9 18,10 Z M16,10 L8,10 L8,12 L16,12 L16,10 Z M16,14 L8,14 L8,16 L16,16 L16,14 Z M16,18 L8,18 L8,20 L16,20 L16,18 Z';
                case 'walk': return 'M12,2 C6.48,2 2,6.48 2,12 C2,17.52 6.48,22 12,22 C17.52,22 22,17.52 22,12 C22,6.48 17.52,2 C12,2 Z M12,20 C7.59,20 4,16.41 4,12 C4,7.59 7.59,4 12,4 C16.41,4 20,7.59 20,12 C20,16.41 16.41,20 12,20 Z';
                default: return '';
            }
        };

        return L.divIcon({
            className: css.animatedTransportIcon,
            html: `<div class="${css.rotationWrapper}" style="color: ${color};">
                <svg viewBox="0 0 24 24" width="32" height="32"><path fill="currentColor" d="${getSvgPath(method)}"/></svg>
            </div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16],
        });
    }, [method, color]);

    React.useEffect(() => {
        if (method === 'plane') {
            const points: [number, number][] = [];
            const steps = 100;
            const midLat = (from[0] + to[0]) / 2;
            const midLon = (from[1] + to[1]) / 2;
            
            const dx = to[1] - from[1];
            const dy = to[0] - from[0];
            const dist = Math.sqrt(dx * dx + dy * dy);
            const offset = dist * 0.2;
            
            const pdx = -dy;
            const pdy = dx;
            const pdist = Math.sqrt(pdx * pdx + pdy * pdy) || 1;
            
            const ctrl: [number, number] = [
                midLat + (pdx / pdist) * offset,
                midLon + (pdy / pdist) * offset
            ];

            for (let i = 0; i <= steps; i++) {
                const t = i / steps;
                const lat = (1 - t) * (1 - t) * from[0] + 2 * (1 - t) * t * ctrl[0] + t * t * to[0];
                const lon = (1 - t) * (1 - t) * from[1] + 2 * (1 - t) * t * ctrl[1] + t * t * to[1];
                points.push([lat, lon]);
            }
            setPath(points);
        } else {
            const profile = (method === 'car' || method === 'bus' || method === 'train') ? 'driving' : 'walking';
            fetch(`https://router.project-osrm.org/route/v1/${profile}/${from[1]},${from[0]};${to[1]},${to[0]}?overview=full&geometries=geojson`)
                .then(res => res.json())
                .then(data => {
                    if (data.routes && data.routes[0]) {
                        const coords = data.routes[0].geometry.coordinates.map((c: any) => [c[1], c[0]] as [number, number]);
                        setPath(coords);
                    }
                })
                .catch(() => {});
        }
    }, [from, to, method]);

    React.useEffect(() => {
        if (path.length < 2) return;

        const duration = Math.max(25000, pathData.totalDist * 20000 + path.length * 300);
        let startTime = Date.now();
        let frameId: number;

        const animate = () => {
            const now = Date.now();
            const elapsed = now - startTime;
            const p = (elapsed % duration) / duration;
            setProgress(p);
            frameId = requestAnimationFrame(animate);
        };

        frameId = requestAnimationFrame(animate);
        return () => cancelAnimationFrame(frameId);
    }, [path, pathData.totalDist]);

    const smoothPosData = React.useMemo(() => {
        if (path.length < 2) return { pos: from, rotation: 0 };
        
        const { totalDist, cumulativeDists, segmentAngles } = pathData;
        const targetDist = progress * totalDist;
        let segIdx = cumulativeDists.findIndex((d, i) => targetDist >= d && targetDist <= (cumulativeDists[i+1] ?? totalDist));
        if (segIdx === -1) segIdx = 0;

        const d1 = cumulativeDists[segIdx];
        const d2 = cumulativeDists[segIdx+1] || totalDist;
        const segP = (targetDist - d1) / (d2 - d1 || 0.001);

        const p1 = path[segIdx];
        const p2 = path[segIdx+1] || path[segIdx];
        
        return {
            pos: [
                p1[0] + (p2[0] - p1[0]) * segP,
                p1[1] + (p2[1] - p1[1]) * segP
            ] as [number, number],
            rotation: segmentAngles[segIdx] || 0
        };
    }, [path, pathData, progress, from]);

    React.useEffect(() => {
        if (markerRef.current) {
            const el = markerRef.current.getElement();
            if (el) {
                const wrapper = el.querySelector(`.${css.rotationWrapper}`);
                if (wrapper) {
                    wrapper.style.transform = `rotate(${smoothPosData.rotation}deg)`;
                }
            }
        }
    }, [smoothPosData.rotation]);

    const dashArray = method === 'plane' ? '10, 10' : undefined;

    return (
        <>
            <LeafletPolyline positions={path} pathOptions={{ color, weight: 5, dashArray, opacity: 0.9 }} />
            <LeafletMarker
                ref={markerRef}
                position={smoothPosData.pos}
                icon={icon}
                interactive={false}
            />
        </>
    );
};

const MapAutoFit: React.FC<{ events: TravelEvent[] }> = ({ events }) => {
    const map = useMap();

    React.useEffect(() => {
        if (events.length === 0) {
            map.setView([20, 0], 2);
            return;
        }

        const points = events.map((e) => [e.latitude, e.longitude] as [number, number]);

        if (points.length === 1) {
            map.setView(points[0], 10);
            return;
        }

        map.fitBounds(points, { padding: [50, 50] });
    }, [events, map]);

    return null;
};

const CoordinatePickerMap: React.FC<{
    value: [number, number];
    onChange: (nextValue: [number, number]) => void;
}> = ({ value, onChange }) => {
    useMapEvents({
        click: (event: L.LeafletMouseEvent) => {
            onChange([event.latlng.lat, event.latlng.lng]);
        },
    });

    return (
        <LeafletMarker position={value} icon={L.divIcon({
            className: css.pickerMarkerWrapper,
            html: `<div class="${css.pickerMarkerPin}"><div class="${css.pickerMarkerDot}"></div></div>`,
            iconSize: [26, 34],
            iconAnchor: [13, 32],
        })}>
            <Popup>📍 Click map to move</Popup>
        </LeafletMarker>
    );
};

const MapFocusEvent: React.FC<{ selectedEvent: TravelEvent | null }> = ({ selectedEvent }) => {
    const map = useMap();

    React.useEffect(() => {
        if (!selectedEvent) return;
        
        const zoom = Math.max(map.getZoom(), 10);
        const targetCenterPixel = map.project([selectedEvent.latitude, selectedEvent.longitude], zoom);
        const offsetPixel = L.point(targetCenterPixel.x, targetCenterPixel.y - (map.getSize().y * 0.2));
        const offsetLatLng = map.unproject(offsetPixel, zoom);

        map.flyTo(offsetLatLng, zoom, {
            animate: true,
            duration: 0.5,
        });
    }, [selectedEvent, map]);

    return null;
};

const getUrlParam = (name: string): string | null => {
    if (typeof window === 'undefined') return null;
    let param = '';
    const hash = window.location.hash;
    if (hash.startsWith('#')) {
        const hashParams = new URLSearchParams(hash.slice(1));
        param = hashParams.get(name) || '';
    }
    if (!param) {
        param = new URLSearchParams(window.location.search).get(name) || '';
    }
    return param || null;
};

const getSharedPlan = (): TravelPlan | null => {
    const param = getUrlParam('sharePlan');
    if (!param) return null;
    return decodePlan(param);
};

const getSharedPlanId = (): string | null => {
    return getUrlParam('planId');
};

const TravelEventMarker: React.FC<{
    ev: TravelEvent;
    idx: number;
    isTransition: boolean;
    label: number;
    selectedEventId: string | null;
    setSelectedEventId: React.Dispatch<React.SetStateAction<string | null>>;
    setSelectedDays: React.Dispatch<React.SetStateAction<string[]>>;
    isSharedView: boolean;
    openEditEvent: (ev: TravelEvent) => void;
    deleteEvent: (eventId: string) => void;
    prevEvent: TravelEvent | null;
}> = ({
    ev,
    idx,
    isTransition,
    label,
    selectedEventId,
    setSelectedEventId,
    setSelectedDays,
    isSharedView,
    openEditEvent,
    deleteEvent,
    prevEvent,
}) => {
    const markerRef = React.useRef<any>(null);
    const [pageState] = usePersistedState<TravelPageState>('travel-state', DEFAULT_STATE);
    const [jpyPerSekRate] = usePersistedState<number>('global-jpy-per-sek-rate', 15.0);
    const targetCurrency = pageState.displayCurrency || 'SEK';
    const groupSize = pageState.groupSize || 2;

    React.useEffect(() => {
        if (selectedEventId === ev.id && markerRef.current) {
            if (typeof markerRef.current.isPopupOpen === 'function' && !markerRef.current.isPopupOpen()) {
                markerRef.current.openPopup();
            }
        } else if (selectedEventId !== ev.id && markerRef.current) {
            if (typeof markerRef.current.isPopupOpen === 'function' && markerRef.current.isPopupOpen()) {
                markerRef.current.closePopup();
            }
        }
    }, [selectedEventId, ev.id]);

    return (
        <LeafletMarker 
            ref={markerRef}
            position={[ev.latitude, ev.longitude]}
            icon={L.divIcon({
                className: css.mapMarkerWrapper,
                html: `
                    <div class="${css.mapMarker} ${isTransition ? css.mapMarkerTransition : ''} ${selectedEventId === ev.id ? css.mapMarkerSelected : ''}" 
                         style="${ev.imageUrl ? `background-image: url(${ev.imageUrl});` : ''}">
                        <div class="${css.markerTitle}">
                            <span class="${css.markerTime}">${ev.date} ${ev.time || ''}${ev.endTime ? ` - ${ev.endTime}` : ''}</span>
                            <span class="${css.markerEventName}">${ev.title}</span>
                        </div>
                        <div class="${css.markerLabel}">${label}</div>
                    </div>
                `,
                iconSize: [44, 44],
                iconAnchor: [22, 22],
            })}
            eventHandlers={{
                click: () => {
                    setSelectedEventId(prev => {
                        const next = prev === ev.id ? null : ev.id;
                        if (next) {
                            setSelectedDays(days => !days.includes(ev.date) ? [ev.date] : days);
                        }
                        return next;
                    });
                }
            }}
        >
            <LeafletPopup className={css.eventPopup}>
                {ev.imageUrl && <img src={ev.imageUrl} alt={ev.title} className={css.popupImage} />}
                <div className={css.popupContent}>
                    <div className={css.popupHeader}>
                        <h4 className={css.popupTitle}>{ev.title}</h4>
                        {ev.link && (
                            <a 
                                href={ev.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={css.popupLinkIcon}
                                title="Open website / booking link"
                            >
                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                </svg>
                            </a>
                        )}
                    </div>
                    <div className={css.popupDate}>{ev.date} {ev.time && `@ ${ev.time}`}{ev.endTime && ` - ${ev.endTime}`}</div>
                    <div className={css.popupDescription}>{ev.description}</div>
                    
                    <div className={css.popupMeta}>
                        {prevEvent && ev.transportMethod && (
                            <div className={css.popupMetaRow}>
                                <span className={css.popupMetaLabel}>Arrival by</span>
                                <span className={css.popupMetaValue}>
                                    {TRANSPORT_METHODS.find(m => m.value === ev.transportMethod)?.label}
                                </span>
                            </div>
                        )}
                        {ev.cost !== undefined && (
                            <div className={css.popupMetaRow}>
                                <span className={css.popupMetaLabel}>Cost</span>
                                <span className={css.popupMetaValue}>
                                    {formatConvertedCost(getEventGroupCost(ev, groupSize) || 0, ev.costCurrency || 'SEK', targetCurrency, jpyPerSekRate)}
                                    {ev.costType === 'per-person' && ` (${formatConvertedCost(ev.cost, ev.costCurrency || 'SEK', targetCurrency, jpyPerSekRate)})`}
                                </span>
                            </div>
                        )}
                    </div>

                    {!isSharedView && (
                        <div className={css.actionsRow}>
                            <button className={css.secondaryButton} type="button" onClick={() => openEditEvent(ev)}>Edit</button>
                            <button className={css.secondaryButtonDanger} type="button" onClick={() => deleteEvent(ev.id)}>Delete</button>
                        </div>
                    )}
                </div>
            </LeafletPopup>
        </LeafletMarker>
    );
};



export const TravelPage: React.FC<{
    isFullscreen?: boolean;
    onToggleFullscreen?: () => void;
}> = ({ isFullscreen = false, onToggleFullscreen }) => {
    const [pageState, setPageState] = usePersistedState<TravelPageState>('travel-state', DEFAULT_STATE);
    const [jpyPerSekRate] = usePersistedState<number>('global-jpy-per-sek-rate', 15.0);
    const targetCurrency = pageState.displayCurrency || 'SEK';
    const groupSize = pageState.groupSize || 2;
    const [loadedSharedPlan, setLoadedSharedPlan] = React.useState<TravelPlan | null>(() => {
        return getSharedPlan();
    });
    const [isLoadingShared, setIsLoadingShared] = React.useState(false);

    React.useEffect(() => {
        const planId = getSharedPlanId();
        if (planId) {
            setIsLoadingShared(true);
            fetch(`./plans/${planId}.json`)
                .then(res => {
                    if (!res.ok) throw new Error('Plan file not found');
                    return res.json();
                })
                .then((plan: TravelPlan) => {
                    setLoadedSharedPlan(plan);
                    setIsLoadingShared(false);
                })
                .catch(err => {
                    console.error('Failed to load shared plan:', err);
                    setIsLoadingShared(false);
                    alert('Failed to load the shared travel plan. It might not be incorporated or built yet.');
                });
        }
    }, []);

    React.useEffect(() => {
        const urlGroupSize = getUrlParam('groupSize');
        const urlCurrency = getUrlParam('currency') || getUrlParam('displayCurrency');

        setPageState(prev => {
            let changed = false;
            const nextState = { ...prev };

            if (urlGroupSize) {
                const parsedGroupSize = parseInt(urlGroupSize, 10);
                if (!isNaN(parsedGroupSize) && parsedGroupSize > 0 && nextState.groupSize !== parsedGroupSize) {
                    nextState.groupSize = parsedGroupSize;
                    changed = true;
                }
            }

            if (urlCurrency) {
                const upperCurrency = urlCurrency.toUpperCase() as CurrencyCode;
                if ((upperCurrency === 'SEK' || upperCurrency === 'JPY') && nextState.displayCurrency !== upperCurrency) {
                    nextState.displayCurrency = upperCurrency;
                    changed = true;
                }
            }

            return changed ? nextState : prev;
        });
    }, [setPageState]);

    const isSharedView = !!loadedSharedPlan;
    const [isPlanModalOpen, setIsPlanModalOpen] = React.useState(false);
    const [isEventModalOpen, setIsEventModalOpen] = React.useState(false);
    const [editingEventId, setEditingEventId] = React.useState<string | null>(null);
    const [selectedEventId, setSelectedEventId] = React.useState<string | null>(null);
    const [newPlanName, setNewPlanName] = React.useState('');
    const [newPlanStartDate, setNewPlanStartDate] = React.useState(new Date().toISOString().split('T')[0]);
    const [newPlanEndDate, setNewPlanEndDate] = React.useState(new Date().toISOString().split('T')[0]);
    
    const [selectedDays, setSelectedDays] = React.useState<string[]>([]);
    const [isEditPlanModalOpen, setIsEditPlanModalOpen] = React.useState(false);
    const [editPlanName, setEditPlanName] = React.useState('');
    const [editPlanStartDate, setEditPlanStartDate] = React.useState('');
    const [editPlanEndDate, setEditPlanEndDate] = React.useState('');

    const [eventForm, setEventForm] = React.useState<Partial<TravelEvent>>({
        title: '',
        description: '',
        date: new Date().toISOString().split('T')[0],
        time: '12:00',
        endTime: '',
        latitude: 0,
        longitude: 0,
        imageUrl: '',
        transportMethod: 'car',
        isAccommodation: false,
        cost: undefined,
        costCurrency: 'SEK',
        link: '',
        costType: 'constant',
    });

    // Ensure all plans have startDate and endDate
    React.useEffect(() => {
        let changed = false;
        const migratedPlans = pageState.plans.map(p => {
            if (!p.startDate || !p.endDate) {
                changed = true;
                const sortedEvs = [...p.events].sort((a, b) => a.date.localeCompare(b.date));
                const firstDate = sortedEvs.length ? sortedEvs[0].date : new Date().toISOString().split('T')[0];
                const lastDate = sortedEvs.length ? sortedEvs[sortedEvs.length - 1].date : new Date().toISOString().split('T')[0];
                return {
                    ...p,
                    startDate: p.startDate || firstDate,
                    endDate: p.endDate || lastDate,
                };
            }
            return p;
        });
        if (changed) {
            setPageState(prev => ({
                ...prev,
                plans: migratedPlans,
            }));
        }
    }, [pageState.plans, setPageState]);

    // Reset selected day and event on plan switch
    React.useEffect(() => {
        setSelectedEventId(null);
        setSelectedDays([]);
    }, [pageState.selectedPlanId]);

    const selectedPlan = React.useMemo(() => {
        if (loadedSharedPlan) return loadedSharedPlan;
        return pageState.plans.find(p => p.id === pageState.selectedPlanId) || null;
    }, [pageState.plans, pageState.selectedPlanId, loadedSharedPlan]);

    const sortedEvents = React.useMemo(() => {
        if (!selectedPlan) return [];
        return [...selectedPlan.events].sort((a, b) => {
            const dateComp = a.date.localeCompare(b.date);
            if (dateComp !== 0) return dateComp;
            return (a.time || '').localeCompare(b.time || '');
        });
    }, [selectedPlan]);

    const eventsByDay = React.useMemo(() => {
        return groupEventsByDay(sortedEvents);
    }, [sortedEvents]);

    const daysWithEvents = React.useMemo(() => {
        return Object.keys(eventsByDay).sort();
    }, [eventsByDay]);

    const displayedEvents = React.useMemo(() => {
        if (selectedDays.length === 0) return sortedEvents;
        
        const eventSet = new Set<string>();
        const result: TravelEvent[] = [];
        const sortedSelDays = [...selectedDays].sort();
        
        sortedSelDays.forEach(dateStr => {
            const dayIdx = daysWithEvents.indexOf(dateStr);
            if (dayIdx > 0) {
                const prevDay = daysWithEvents[dayIdx - 1];
                if (!selectedDays.includes(prevDay)) {
                    const prevDayEvents = eventsByDay[prevDay] || [];
                    if (prevDayEvents.length > 0) {
                        const prevLast = prevDayEvents[prevDayEvents.length - 1];
                        if (prevLast.isAccommodation) {
                            if (!eventSet.has(prevLast.id)) {
                                eventSet.add(prevLast.id);
                                result.push(prevLast);
                            }
                        }
                    }
                }
            }
            
            const currentDayEvents = eventsByDay[dateStr] || [];
            currentDayEvents.forEach(ev => {
                if (!eventSet.has(ev.id)) {
                    eventSet.add(ev.id);
                    result.push(ev);
                }
            });
        });
        
        return result.sort((a, b) => {
            const dateComp = a.date.localeCompare(b.date);
            if (dateComp !== 0) return dateComp;
            return (a.time || '').localeCompare(b.time || '');
        });
    }, [sortedEvents, selectedDays, daysWithEvents, eventsByDay]);

    const isLocalhost = typeof window !== 'undefined' && (
        window.location.hostname === 'localhost' || 
        window.location.hostname === '127.0.0.1'
    );

    const handleIncorporatePlan = () => {
        if (!selectedPlan) return;
        
        fetch('http://localhost:8787/api/incorporate-plan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(selectedPlan),
        })
        .then(res => {
            if (!res.ok) {
                return res.json().then(data => {
                    throw new Error(data.error || 'Failed to incorporate plan');
                });
            }
            return res.json();
        })
        .then(data => {
            const groupSize = pageState.groupSize || 2;
            const currency = pageState.displayCurrency || 'SEK';
            const prodUrl = `https://senapp.github.io/BimbimPortal/dist/index.html#planId=${selectedPlan.id}&groupSize=${groupSize}&currency=${currency}`;
            const localUrl = `${window.location.origin}${window.location.pathname}#planId=${selectedPlan.id}&groupSize=${groupSize}&currency=${currency}`;
            
            const message = `Plan incorporated successfully and stored in the repo!\n\n` +
                `Unique Share Link (Production):\n${prodUrl}\n\n` +
                `Unique Share Link (Local):\n${localUrl}\n\n` +
                `The link is copied to your clipboard.`;
                
            navigator.clipboard.writeText(prodUrl)
                .then(() => alert(message))
                .catch(() => alert(message));
        })
        .catch(err => {
            console.error('Incorporate error:', err);
            alert(`Failed to incorporate plan: ${err.message}\nMake sure the local proxy server is running at http://localhost:8787 (npm run instagram-proxy)`);
        });
    };



    const selectedEvent = React.useMemo(
        () => sortedEvents.find(ev => ev.id === selectedEventId) || null,
        [sortedEvents, selectedEventId]
    );

    const handleCreatePlan = () => {
        if (!newPlanName.trim()) return;
        const newPlan: TravelPlan = {
            id: createId(),
            name: newPlanName,
            startDate: newPlanStartDate,
            endDate: newPlanEndDate,
            events: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };
        setPageState(prev => ({
            ...prev,
            plans: [...prev.plans, newPlan],
            selectedPlanId: newPlan.id,
        }));
        setNewPlanName('');
        setNewPlanStartDate(new Date().toISOString().split('T')[0]);
        setNewPlanEndDate(new Date().toISOString().split('T')[0]);
        setIsPlanModalOpen(false);
    };

    const openEditPlan = () => {
        if (!selectedPlan) return;
        setEditPlanName(selectedPlan.name);
        setEditPlanStartDate(selectedPlan.startDate || new Date().toISOString().split('T')[0]);
        setEditPlanEndDate(selectedPlan.endDate || new Date().toISOString().split('T')[0]);
        setIsEditPlanModalOpen(true);
    };

    const handleSavePlanSettings = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan) return;
        setPageState(prev => ({
            ...prev,
            plans: prev.plans.map(p => {
                if (p.id !== selectedPlan.id) return p;
                return {
                    ...p,
                    name: editPlanName,
                    startDate: editPlanStartDate,
                    endDate: editPlanEndDate,
                    updatedAt: new Date().toISOString(),
                };
            })
        }));
        setIsEditPlanModalOpen(false);
    };

    const handleDeletePlan = () => {
        if (!selectedPlan || !window.confirm('Delete this travel plan?')) return;
        setPageState(prev => {
            const nextPlans = prev.plans.filter(p => p.id !== selectedPlan.id);
            return {
                ...prev,
                plans: nextPlans,
                selectedPlanId: nextPlans[0]?.id || null,
            };
        });
    };

    const handleSaveEvent = (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedPlan) return;

        const eventDate = eventForm.date || new Date().toISOString().split('T')[0];
        if (selectedPlan.startDate && eventDate < selectedPlan.startDate) {
            alert(`Event date cannot be before plan start date (${selectedPlan.startDate})`);
            return;
        }
        if (selectedPlan.endDate && eventDate > selectedPlan.endDate) {
            alert(`Event date cannot be after plan end date (${selectedPlan.endDate})`);
            return;
        }

        const preparedEvent: TravelEvent = {
            id: editingEventId || createId(),
            title: eventForm.title || 'Untitled Event',
            description: eventForm.description || '',
            date: eventDate,
            time: eventForm.time || '12:00',
            endTime: eventForm.endTime || undefined,
            latitude: eventForm.latitude || 0,
            longitude: eventForm.longitude || 0,
            imageUrl: eventForm.imageUrl || '',
            transportMethod: eventForm.transportMethod,
            isAccommodation: !!eventForm.isAccommodation,
            cost: (typeof eventForm.cost === 'number' && !isNaN(eventForm.cost)) ? eventForm.cost : undefined,
            costCurrency: eventForm.costCurrency || 'SEK',
            link: eventForm.link || '',
            costType: eventForm.costType || 'constant',
        };

        setPageState(prev => ({
            ...prev,
            plans: prev.plans.map(p => {
                if (p.id !== selectedPlan.id) return p;
                const nextEvents = editingEventId
                    ? p.events.map(ev => ev.id === editingEventId ? preparedEvent : ev)
                    : [...p.events, preparedEvent];
                return { ...p, events: nextEvents, updatedAt: new Date().toISOString() };
            })
        }));

        setIsEventModalOpen(false);
        setEditingEventId(null);
    };

    const openAddEvent = () => {
        setEditingEventId(null);
        setEventForm({
            title: '',
            description: '',
            date: new Date().toISOString().split('T')[0],
            time: '12:00',
            latitude: 0,
            longitude: 0,
            imageUrl: '',
            transportMethod: 'car',
            isAccommodation: false,
            cost: undefined,
            costCurrency: 'SEK',
            link: '',
            costType: 'constant',
        });
        setIsEventModalOpen(true);
    };

    const openEditEvent = (ev: TravelEvent) => {
        setEditingEventId(ev.id);
        setEventForm({
            ...ev,
            isAccommodation: ev.isAccommodation || false,
            cost: ev.cost,
            costCurrency: ev.costCurrency || 'SEK',
            link: ev.link || '',
            costType: ev.costType || 'constant',
        });
        setIsEventModalOpen(true);
    };

    const deleteEvent = (eventId: string) => {
        if (!window.confirm('Delete this event?')) return;
        setPageState(prev => ({
            ...prev,
            plans: prev.plans.map(p => {
                if (p.id !== selectedPlan?.id) return p;
                return { ...p, events: p.events.filter(ev => ev.id !== eventId), updatedAt: new Date().toISOString() };
            })
        }));
        if (selectedEventId === eventId) setSelectedEventId(null);
    };

    const handleDuplicateEvent = (e: React.MouseEvent) => {
        e.preventDefault();
        if (!selectedPlan || !editingEventId) return;

        const newId = createId();
        const duplicatedEvent: TravelEvent = {
            id: newId,
            title: eventForm.title ? `${eventForm.title}` : 'Duplicated Event',
            description: eventForm.description || '',
            date: eventForm.date || new Date().toISOString().split('T')[0],
            time: eventForm.time || '12:00',
            endTime: eventForm.endTime || undefined,
            latitude: eventForm.latitude || 0,
            longitude: eventForm.longitude || 0,
            imageUrl: eventForm.imageUrl || '',
            transportMethod: eventForm.transportMethod,
            isAccommodation: !!eventForm.isAccommodation,
            cost: (typeof eventForm.cost === 'number' && !isNaN(eventForm.cost)) ? eventForm.cost : undefined,
            costCurrency: eventForm.costCurrency || 'SEK',
            link: eventForm.link || '',
            costType: eventForm.costType || 'constant',
        };

        setPageState(prev => ({
            ...prev,
            plans: prev.plans.map(p => {
                if (p.id !== selectedPlan.id) return p;
                return {
                    ...p,
                    events: [...p.events, duplicatedEvent],
                    updatedAt: new Date().toISOString(),
                };
            })
        }));

        setEditingEventId(newId);
        setEventForm(duplicatedEvent);
    };

    const handleDayClick = (dateStr: string, isShift: boolean) => {
        setSelectedDays(prev => {
            if (isShift) {
                if (prev.includes(dateStr)) {
                    return prev.filter(d => d !== dateStr);
                } else {
                    return [...prev, dateStr];
                }
            } else {
                if (prev.length === 1 && prev[0] === dateStr) {
                    return [];
                }
                return [dateStr];
            }
        });
    };

    if (isLoadingShared) {
        return (
            <div className={css.page} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
                <div className={css.emptyState}>Loading shared travel plan...</div>
            </div>
        );
    }

    return (
        <div className={`${css.page} ${isFullscreen ? css.pageFullscreen : ''}`}>
            {isSharedView && (
                <div className={css.sharedBanner}>
                    <span>Viewing Shared Travel Plan: <strong>{selectedPlan?.name}</strong> (View Only)</span>
                    <button 
                        className={css.primaryButton}
                        onClick={() => {
                            const url = new URL(window.location.href);
                            url.searchParams.delete('sharePlan');
                            url.searchParams.delete('planId');
                            url.hash = '';
                            window.location.href = url.toString();
                        }}
                    >
                        Go to My Plans
                    </button>
                </div>
            )}

            <div className={css.topBar}>
                <div className={css.topBarHeader}>
                    <div className={css.planHeader}>
                        {onToggleFullscreen && (
                            <button 
                                className={css.fullscreenButton} 
                                onClick={onToggleFullscreen}
                                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                                type="button"
                            >
                                {isFullscreen ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M4 14h6v6M20 14h-6v6M4 10h6V4M20 10h-6V4"/>
                                    </svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7"/>
                                    </svg>
                                )}
                            </button>
                        )}
                        <h2 className={css.title}>Travel Plans</h2>
                        <select 
                            className={css.planSelect}
                            value={pageState.selectedPlanId || ''} 
                            onChange={e => setPageState(prev => ({ ...prev, selectedPlanId: e.target.value }))}
                            disabled={isSharedView}
                        >
                            <option value="" disabled>Select a plan...</option>
                            {pageState.plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>

                        {!isSharedView && (
                            <div style={{ display: 'inline-flex', gap: '0.4rem', alignItems: 'center' }}>
                                <button 
                                    className={css.iconButton} 
                                    onClick={() => setIsPlanModalOpen(true)}
                                    title="New Plan"
                                    type="button"
                                >
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                        <line x1="12" y1="5" x2="12" y2="19"></line>
                                        <line x1="5" y1="12" x2="19" y2="12"></line>
                                    </svg>
                                </button>
                                {selectedPlan && (
                                    <>
                                        <button 
                                            className={css.iconButton} 
                                            onClick={openEditPlan}
                                            title="Edit Plan Settings"
                                            type="button"
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <circle cx="12" cy="12" r="3"></circle>
                                                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
                                            </svg>
                                        </button>
                                        <button 
                                            className={css.iconButtonDanger} 
                                            onClick={handleDeletePlan}
                                            title="Delete Plan"
                                            type="button"
                                        >
                                            <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="3 6 5 6 21 6"></polyline>
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                                <line x1="14" y1="11" x2="14" y2="17"></line>
                                            </svg>
                                        </button>
                                        {isLocalhost && (
                                            <button 
                                                className={css.iconButton} 
                                                onClick={handleIncorporatePlan}
                                                title="Share Plan (Incorporate)"
                                                type="button"
                                            >
                                                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                    <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path>
                                                    <polyline points="16 6 12 2 8 6"></polyline>
                                                    <line x1="12" y1="2" x2="12" y2="15"></line>
                                                </svg>
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                        {selectedPlan && (
                            <label className={css.toggleLabel} style={{ marginLeft: '1rem' }}>
                                <span>Currency: </span>
                                <select
                                    value={pageState.displayCurrency || 'SEK'}
                                    onChange={(e) => setPageState(prev => ({ ...prev, displayCurrency: e.target.value as CurrencyCode }))}
                                    style={{
                                        backgroundColor: '#1f2937',
                                        color: '#fff',
                                        border: '1px solid #4b5563',
                                        borderRadius: '0.25rem',
                                        padding: '0.15rem 0.35rem',
                                        fontSize: '0.75rem',
                                        marginLeft: '0.25rem',
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="SEK">SEK (kr)</option>
                                    <option value="JPY">JPY (¥)</option>
                                </select>
                            </label>
                        )}
                        {selectedPlan && (
                            <label className={css.toggleLabel} style={{ marginLeft: '1rem' }}>
                                <span>People: </span>
                                <input
                                    type="number"
                                    min="1"
                                    max="20"
                                    value={pageState.groupSize !== undefined ? pageState.groupSize : 2}
                                    onChange={(e) => setPageState(prev => ({ ...prev, groupSize: Math.max(1, Number(e.target.value)) }))}
                                    style={{
                                        backgroundColor: '#1f2937',
                                        color: '#fff',
                                        border: '1px solid #4b5563',
                                        borderRadius: '0.25rem',
                                        padding: '0.15rem 0.35rem',
                                        fontSize: '0.75rem',
                                        marginLeft: '0.25rem',
                                        width: '45px',
                                        cursor: 'pointer'
                                    }}
                                />
                            </label>
                        )}
                        {selectedPlan && (
                            <span className={css.planTotalSummary}>
                                {(() => {
                                    const constSummary = getPlanCostSummary(selectedPlan.events, targetCurrency, jpyPerSekRate, groupSize);
                                    const groupTotalStr = formatConvertedCost(constSummary.groupTotal, targetCurrency, targetCurrency, jpyPerSekRate);
                                    const perPersonShareStr = formatConvertedCost(constSummary.perPersonShare, targetCurrency, targetCurrency, jpyPerSekRate);
                                    return (
                                        <>
                                            Total: {groupTotalStr}, Per Person: {perPersonShareStr}
                                        </>
                                    );
                                })()}
                            </span>
                        )}
                    </div>
                    {selectedPlan && !isSharedView && <button className={css.primaryButton} onClick={openAddEvent}>Add Event</button>}
                </div>

                {selectedPlan && (
                    <div className={css.planDateRangeRow}>
                        <span className={css.planDateStart}>{selectedPlan.startDate}</span>
                        <span className={css.planDateEnd}>{selectedPlan.endDate}</span>
                    </div>
                )}

                <div className={css.eventListWrapper}>
                    {daysWithEvents.length === 0 ? (
                        <div className={css.emptyState}>No events in this plan.</div>
                    ) : daysWithEvents.map((dateStr) => {
                        const dayEvents = eventsByDay[dateStr];
                        const isDaySelected = selectedDays.includes(dateStr);
                        const accommodationEvent = dayEvents.find(ev => ev.isAccommodation);
                        return (
                            <div 
                                key={dateStr}
                                className={`${css.dayCard} ${isDaySelected ? css.dayCardSelected : ''}`}
                                onClick={(e) => {
                                    handleDayClick(dateStr, e.shiftKey);
                                }}
                            >
                                <div className={css.dayCardHeader}>
                                    <div className={css.dayDateContainer}>
                                        <span className={css.dayDateText}>{formatDateOnly(dateStr)}</span>
                                        <span className={css.dayWeekdayText}>{formatWeekdayFull(dateStr)}</span>
                                    </div>
                                    {accommodationEvent && (
                                        <div 
                                            className={`${css.dayAccommodation} ${selectedEventId === accommodationEvent.id ? css.dayAccommodationSelected : ''}`} 
                                            title={accommodationEvent.title}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setSelectedEventId(prev => prev === accommodationEvent.id ? null : accommodationEvent.id);
                                                setSelectedDays(prev => {
                                                    if (!prev.includes(accommodationEvent.date)) {
                                                        return [accommodationEvent.date];
                                                    }
                                                    return prev;
                                                });
                                            }}
                                        >
                                            <div className={css.accommodationHeaderRow}>
                                                {accommodationEvent.imageUrl ? (
                                                    <img 
                                                        src={accommodationEvent.imageUrl} 
                                                        className={css.accommodationIconThumbnail} 
                                                        alt="" 
                                                    />
                                                ) : (
                                                    <span>🏠</span>
                                                )}
                                                <span className={css.accommodationName}>{accommodationEvent.title}</span>
                                                {selectedEventId === accommodationEvent.id && accommodationEvent.link && (
                                                    <a 
                                                        href={accommodationEvent.link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className={css.eventListLinkIcon}
                                                        onClick={(e) => e.stopPropagation()}
                                                        title="Open Link"
                                                    >
                                                        <svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                            {accommodationEvent.cost !== undefined && accommodationEvent.cost !== null && (
                                                <div className={css.accommodationPriceBox}>
                                                    {formatConvertedCost(getEventGroupCost(accommodationEvent, groupSize) || 0, accommodationEvent.costCurrency || 'SEK', targetCurrency, jpyPerSekRate)}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                                <div className={css.dayEventsList}>
                                    {dayEvents.filter(ev => !ev.isAccommodation).map((ev) => {
                                        const isEvSelected = selectedEventId === ev.id;
                                        return (
                                            <div
                                                key={ev.id}
                                                className={`${css.dayEventItem} ${isEvSelected ? css.dayEventItemSelected : ''}`}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedEventId(prev => prev === ev.id ? null : ev.id);
                                                    setSelectedDays(prev => {
                                                        if (!prev.includes(ev.date)) {
                                                            return [ev.date];
                                                        }
                                                        return prev;
                                                    });
                                                }}
                                            >
                                                {ev.imageUrl ? (
                                                    <img 
                                                        src={ev.imageUrl} 
                                                        className={css.eventIconThumbnail} 
                                                        alt="" 
                                                    />
                                                ) : (
                                                    <span className={css.eventIconFallback}>
                                                        {ev.transportMethod === 'plane' && '✈️'}
                                                        {ev.transportMethod === 'car' && '🚗'}
                                                        {ev.transportMethod === 'bus' && '🚌'}
                                                        {ev.transportMethod === 'train' && '🚆'}
                                                        {ev.transportMethod === 'walk' && '🚶'}
                                                        {!ev.transportMethod && '📍'}
                                                    </span>
                                                )}
                                                <span className={css.eventItemTitle}>
                                                    {ev.title} 
                                                    {ev.time ? ` - ${ev.time}` : ''}
                                                    {ev.cost !== undefined && ev.cost !== null && (
                                                        <span className={css.eventItemCost}>
                                                            {' - '}{formatConvertedCost(getEventGroupCost(ev, groupSize) || 0, ev.costCurrency || 'SEK', targetCurrency, jpyPerSekRate)}
                                                        </span>
                                                    )}
                                                </span>
                                                {isEvSelected && ev.link && (
                                                    <a 
                                                        href={ev.link} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className={css.eventListLinkIcon}
                                                        onClick={(e) => e.stopPropagation()}
                                                        title="Open Link"
                                                    >
                                                        <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                                            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                                        </svg>
                                                    </a>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                                {dayEvents.some(ev => ev.cost !== undefined && ev.cost !== null) && (
                                    <div className={css.dayCardFooter}>
                                        <span className={css.dayCardFooterLabel}>Total Cost</span>
                                        <span className={css.dayCardFooterValue}>{getDayTotalCostString(dayEvents, targetCurrency, jpyPerSekRate, groupSize)}</span>
                                    </div>
                                )}
                            </div>
                        );
                     })}
                </div>
            </div>

            {selectedEvent && (
                <div className={css.detailPanel}>
                    <div className={css.detailInfo}>
                        <div className={css.detailTitle}>{selectedEvent.title} ({selectedEvent.date} {selectedEvent.time})</div>
                        <div className={css.detailDescription}>{selectedEvent.description || 'No description provided.'}</div>
                        {selectedEvent.cost !== undefined && selectedEvent.cost !== null && (
                            <div className={css.detailCost}>
                                {formatConvertedCost(getEventGroupCost(selectedEvent, groupSize) || 0, selectedEvent.costCurrency || 'SEK', targetCurrency, jpyPerSekRate)}
                                {selectedEvent.costType === 'per-person' && ` (${formatConvertedCost(selectedEvent.cost, selectedEvent.costCurrency || 'SEK', targetCurrency, jpyPerSekRate)}/p)`}
                            </div>
                        )}
                        {selectedEvent.link && (
                            <a 
                                href={selectedEvent.link} 
                                target="_blank" 
                                rel="noopener noreferrer" 
                                className={css.detailLinkIcon}
                                title="Open website / booking link"
                            >
                                <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"></path>
                                    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"></path>
                                </svg>
                            </a>
                        )}
                    </div>
                    {!isSharedView && (
                        <div className={css.actionsRow} style={{ marginTop: 0 }}>
                            <button className={css.secondaryButton} type="button" onClick={() => openEditEvent(selectedEvent)}>Edit Event</button>
                            <button className={css.secondaryButtonDanger} type="button" onClick={() => deleteEvent(selectedEvent.id)}>Delete Event</button>
                        </div>
                    )}
                    {displayedEvents.indexOf(selectedEvent) >= 0 && displayedEvents.indexOf(selectedEvent) < displayedEvents.length - 1 && (
                        <div className={css.detailTravel}>
                            <div className={css.detailTravelLabel}>Next Destination</div>
                            <div className={css.detailTravelValue}>
                                {displayedEvents[displayedEvents.indexOf(selectedEvent) + 1].title}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className={css.mapPane}>
                <div className={css.mapWrap}>
                    <MapContainer center={[20, 0]} zoom={2} scrollWheelZoom className={css.map}>
                        <LeafletTileLayer
                            attribution="&copy; Esri &mdash; Esri, DeLorme, NAVTEQ"
                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                        />
                        <MapAutoFit events={displayedEvents} />
                        <MapFocusEvent selectedEvent={selectedEvent} />
                        
                        {displayedEvents.map((ev, idx) => {
                            const prevEvent = idx > 0 ? displayedEvents[idx - 1] : null;
                            const isTransition = selectedDays.length > 0 && !selectedDays.includes(ev.date);
                            const hasTransitionStart = displayedEvents.length > 0 && selectedDays.length > 0 && !selectedDays.includes(displayedEvents[0].date);
                            const label = isTransition ? 0 : (hasTransitionStart ? idx : idx + 1);
                            
                            return (
                                <React.Fragment key={ev.id}>
                                    {prevEvent && ev.transportMethod && (
                                        <RoutePolyline 
                                            from={[prevEvent.latitude, prevEvent.longitude]}
                                            to={[ev.latitude, ev.longitude]}
                                            method={ev.transportMethod}
                                        />
                                    )}
                                    <TravelEventMarker
                                        ev={ev}
                                        idx={idx}
                                        isTransition={isTransition}
                                        label={label}
                                        selectedEventId={selectedEventId}
                                        setSelectedEventId={setSelectedEventId}
                                        setSelectedDays={setSelectedDays}
                                        isSharedView={isSharedView}
                                        openEditEvent={openEditEvent}
                                        deleteEvent={deleteEvent}
                                        prevEvent={prevEvent}
                                    />
                                </React.Fragment>
                            );
                        })}
                    </MapContainer>
                </div>
            </div>

            {isPlanModalOpen && (
                <div className={css.modalBackdrop}>
                    <form className={css.modalCard} onSubmit={(e) => { e.preventDefault(); handleCreatePlan(); }}>
                        <div className={css.modalHeader}>
                            <h3>Create New Travel Plan</h3>
                            <button type="button" className={css.modalClose} onClick={() => setIsPlanModalOpen(false)}>&times;</button>
                        </div>
                        <div className={css.field}>
                            <span>Plan Name</span>
                            <input 
                                required
                                type="text" 
                                value={newPlanName} 
                                onChange={e => setNewPlanName(e.target.value)} 
                                placeholder="e.g. Summer in Japan"
                            />
                        </div>
                        <div className={css.inputGrid}>
                            <div className={css.field}>
                                <span>Start Date</span>
                                <input 
                                    required
                                    type="date" 
                                    value={newPlanStartDate} 
                                    onChange={e => setNewPlanStartDate(e.target.value)} 
                                />
                            </div>
                            <div className={css.field}>
                                <span>End Date</span>
                                <input 
                                    required
                                    type="date" 
                                    value={newPlanEndDate} 
                                    onChange={e => setNewPlanEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className={css.actionsRow}>
                            <button type="submit" className={css.primaryButton}>Create Plan</button>
                            <button type="button" className={css.secondaryButton} onClick={() => setIsPlanModalOpen(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {isEditPlanModalOpen && (
                <div className={css.modalBackdrop}>
                    <form className={css.modalCard} onSubmit={handleSavePlanSettings}>
                        <div className={css.modalHeader}>
                            <h3>Edit Travel Plan Settings</h3>
                            <button type="button" className={css.modalClose} onClick={() => setIsEditPlanModalOpen(false)}>&times;</button>
                        </div>
                        <div className={css.field}>
                            <span>Plan Name</span>
                            <input 
                                required
                                type="text" 
                                value={editPlanName} 
                                onChange={e => setEditPlanName(e.target.value)} 
                                placeholder="e.g. Summer in Japan"
                            />
                        </div>
                        <div className={css.inputGrid}>
                            <div className={css.field}>
                                <span>Start Date</span>
                                <input 
                                    required
                                    type="date" 
                                    value={editPlanStartDate} 
                                    onChange={e => setEditPlanStartDate(e.target.value)} 
                                />
                            </div>
                            <div className={css.field}>
                                <span>End Date</span>
                                <input 
                                    required
                                    type="date" 
                                    value={editPlanEndDate} 
                                    onChange={e => setEditPlanEndDate(e.target.value)} 
                                />
                            </div>
                        </div>
                        <div className={css.actionsRow}>
                            <button type="submit" className={css.primaryButton}>Save Settings</button>
                            <button type="button" className={css.secondaryButton} onClick={() => setIsEditPlanModalOpen(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}

            {isEventModalOpen && (
                <div className={css.modalBackdrop}>
                    <form className={css.modalCard} onSubmit={handleSaveEvent}>
                        <div className={css.modalHeader}>
                            <h3>{editingEventId ? 'Edit Event' : 'Add Event'}</h3>
                            <button type="button" className={css.modalClose} onClick={() => setIsEventModalOpen(false)}>&times;</button>
                        </div>
                        <div className={css.inputGrid}>
                            <label className={css.field}>
                                <span>Title</span>
                                <input required type="text" value={eventForm.title} onChange={e => setEventForm(p => ({ ...p, title: e.target.value }))} />
                            </label>
                            <label className={css.toggleLabel} style={{ marginTop: '1.5rem', alignSelf: 'center' }}>
                                <input 
                                    type="checkbox" 
                                    checked={eventForm.isAccommodation || false} 
                                    onChange={e => setEventForm(p => ({ ...p, isAccommodation: e.target.checked }))} 
                                />
                                🏠 Is Accommodation
                            </label>
                            <div className={css.inputGrid}>
                                <label className={css.field}>
                                    <span>Date</span>
                                    <input 
                                        required 
                                        type="date" 
                                        min={selectedPlan?.startDate}
                                        max={selectedPlan?.endDate}
                                        value={eventForm.date} 
                                        onChange={e => setEventForm(p => ({ ...p, date: e.target.value }))} 
                                    />
                                </label>
                                <label className={css.field}>
                                    <span>Start Time</span>
                                    <input type="time" value={eventForm.time} onChange={e => setEventForm(p => ({ ...p, time: e.target.value }))} />
                                </label>
                                <label className={css.field}>
                                    <span>End Time</span>
                                    <input type="time" value={eventForm.endTime} onChange={e => setEventForm(p => ({ ...p, endTime: e.target.value }))} />
                                </label>
                            </div>
                            <label className={`${css.field} ${css.fullWidth}`}>
                                <span>Description (locations, things to do)</span>
                                <textarea rows={3} value={eventForm.description} onChange={e => setEventForm(p => ({ ...p, description: e.target.value }))} />
                            </label>
                            <label className={`${css.field} ${css.fullWidth}`}>
                                <span>Image URL</span>
                                <input type="text" value={eventForm.imageUrl || ''} onChange={e => setEventForm(p => ({ ...p, imageUrl: e.target.value }))} placeholder="https://example.com/photo.jpg" />
                            </label>
                            <label className={`${css.field} ${css.fullWidth}`}>
                                <span>Link (Optional booking URL, website, etc.)</span>
                                <input type="text" value={eventForm.link || ''} onChange={e => setEventForm(p => ({ ...p, link: e.target.value }))} placeholder="https://example.com" />
                            </label>
                            <div className={css.inputGrid}>
                                <label className={css.field}>
                                    <span>Latitude</span>
                                    <input type="number" step="0.0001" value={eventForm.latitude} onChange={e => setEventForm(p => ({ ...p, latitude: Number(e.target.value) }))} />
                                </label>
                                <label className={css.field}>
                                    <span>Longitude</span>
                                    <input type="number" step="0.0001" value={eventForm.longitude} onChange={e => setEventForm(p => ({ ...p, longitude: Number(e.target.value) }))} />
                                </label>
                            </div>
                            <label className={`${css.field} ${css.fullWidth}`}>
                                <span>Method of travel (to this location)</span>
                                <select value={eventForm.transportMethod} onChange={e => setEventForm(p => ({ ...p, transportMethod: e.target.value as TravelTransportMethod }))}>
                                    {TRANSPORT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                </select>
                            </label>
                            
                            <div className={css.inputGrid} style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                                <label className={css.field}>
                                    <span>Cost (Optional)</span>
                                    <input 
                                        type="number" 
                                        min="0"
                                        placeholder="0"
                                        value={eventForm.cost !== undefined && eventForm.cost !== null ? eventForm.cost : ''} 
                                        onChange={e => setEventForm(p => ({ ...p, cost: e.target.value !== '' ? Number(e.target.value) : undefined }))} 
                                    />
                                </label>
                                <label className={css.field}>
                                    <span>Currency</span>
                                    <select 
                                        value={eventForm.costCurrency || 'SEK'} 
                                        onChange={e => setEventForm(p => ({ ...p, costCurrency: e.target.value as CurrencyCode }))}
                                    >
                                        <option value="SEK">SEK (kr)</option>
                                        <option value="JPY">JPY (¥)</option>
                                    </select>
                                </label>
                                <label className={css.field}>
                                    <span>Cost Type</span>
                                    <select 
                                        value={eventForm.costType || 'constant'} 
                                        onChange={e => setEventForm(p => ({ ...p, costType: e.target.value as 'constant' | 'per-person' }))}
                                    >
                                        <option value="constant">Total (Constant)</option>
                                        <option value="per-person">Per Person</option>
                                    </select>
                                </label>
                            </div>
                            
                            <div className={`${css.mapPickerBlock} ${css.fullWidth}`}>
                                <div className={css.mapPickerHeader}>Pick coordinates on map</div>
                                <div className={css.mapPickerHint}>Click anywhere on the map to set location</div>
                                <div className={css.mapPickerWrap}>
                                    <MapContainer center={[eventForm.latitude || 0, eventForm.longitude || 0]} zoom={2} scrollWheelZoom className={css.mapPickerMap}>
                                        <LeafletTileLayer
                                            attribution="&copy; Esri"
                                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                                        />
                                        <CoordinatePickerMap 
                                            value={[eventForm.latitude || 0, eventForm.longitude || 0]} 
                                            onChange={([lat, lng]) => setEventForm(p => ({ ...p, latitude: Number(lat.toFixed(6)), longitude: Number(lng.toFixed(6)) }))} 
                                        />
                                    </MapContainer>
                                </div>
                            </div>
                        </div>
                        <div className={css.actionsRow}>
                            <button type="submit" className={css.primaryButton}>Save Event</button>
                            {editingEventId && (
                                <button type="button" className={css.secondaryButton} onClick={handleDuplicateEvent}>Duplicate</button>
                            )}
                            <button type="button" className={css.secondaryButton} onClick={() => setIsEventModalOpen(false)}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
};
