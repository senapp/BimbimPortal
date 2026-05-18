import * as React from 'react';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import { Contact, ContactsState } from '../utils/portalTypes';
import { usePersistedState } from '../utils/storage';
import css from './ContactsPage.module.css';

type CountryOption = {
    code: string;
    label: string;
};

const COUNTRY_OPTIONS: CountryOption[] = [
    { code: 'SE', label: 'Sweden' },
    { code: 'JP', label: 'Japan' },
    { code: 'US', label: 'United States' },
    { code: 'GB', label: 'United Kingdom' },
    { code: 'DE', label: 'Germany' },
    { code: 'FR', label: 'France' },
    { code: 'NO', label: 'Norway' },
    { code: 'DK', label: 'Denmark' },
    { code: 'FI', label: 'Finland' },
    { code: 'NL', label: 'Netherlands' },
    { code: 'IT', label: 'Italy' },
    { code: 'ES', label: 'Spain' },
    { code: 'BR', label: 'Brazil' },
    { code: 'IN', label: 'India' },
    { code: 'CN', label: 'China' },
    { code: 'RU', label: 'Russia' },
    { code: 'CA', label: 'Canada' },
    { code: 'AU', label: 'Australia' },
    { code: 'BD', label: 'Bangladesh' },
    { code: 'IN', label: 'India' },
    { code: 'MX', label: 'Mexico' },
];

function createAvatarDataUrl(seed: string, color: string): string {
    const initials = seed
        .split(' ')
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? '')
        .join('');

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
            <defs>
                <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
                    <stop offset="0%" stop-color="${color}" />
                    <stop offset="100%" stop-color="#1f2937" />
                </linearGradient>
            </defs>
            <rect width="80" height="80" rx="40" fill="url(#g)" />
            <text x="40" y="48" text-anchor="middle" font-family="Verdana, sans-serif" font-size="28" font-weight="700" fill="white">${initials}</text>
        </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export const extractInstagramHandle = (instagramUrl: string): string | null => {
    const trimmed = instagramUrl.trim();

    if (!trimmed) {
        return null;
    }

    const noAtPrefix = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    const directHandle = noAtPrefix.match(/^[a-zA-Z0-9._]+$/)?.[0];

    if (directHandle) {
        return directHandle;
    }

    const urlMatch = trimmed.match(/instagram\.com\/([a-zA-Z0-9._]+)/i);
    return urlMatch?.[1] ?? null;
};

const INSTAGRAM_PROXY_BASE_URL = 'http://localhost:8787';

export const getInstagramProxyAvatarUrl = (instagramUrl: string): string | null => {
    const handle = extractInstagramHandle(instagramUrl);

    if (!handle) {
        return null;
    }

    return `${INSTAGRAM_PROXY_BASE_URL}/api/instagram-photo/${encodeURIComponent(handle)}?v=2`;
};

export const getInstagramAvatarUrl = (instagramUrl: string): string | null => {
    const handle = extractInstagramHandle(instagramUrl);

    if (!handle) {
        return null;
    }

    // Generate a stylized avatar with Instagram colors based on the handle
    // This is more reliable than trying to fetch from Instagram's restricted API
    const colors = ['#FF6B35', '#F7931E', '#FDB833', '#ED1C24', '#C1272D', '#AD1457', '#6A1B9A', '#3949AB', '#00838F'];
    const hashCode = handle.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const color = colors[hashCode % colors.length];
    
    const initials = handle
        .split(/[._]/)
        .filter(Boolean)
        .slice(0, 2)
        .map(part => part[0]?.toUpperCase() ?? '')
        .join('');

    const svg = `
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 80 80">
            <defs>
                <linearGradient id="ig-${handle}" x1="0%" y1="100%" x2="100%" y2="0%">
                    <stop offset="0%" stop-color="${color}" />
                    <stop offset="100%" stop-color="#FFD700" />
                </linearGradient>
            </defs>
            <rect width="80" height="80" rx="16" fill="url(#ig-${handle})" />
            <circle cx="40" cy="32" r="14" fill="white" opacity="0.2" />
            <circle cx="40" cy="40" r="20" fill="none" stroke="white" stroke-width="2" />
            <circle cx="40" cy="40" r="5" fill="white" />
            <text x="40" y="64" text-anchor="middle" font-family="Verdana, sans-serif" font-size="14" font-weight="700" fill="white">${initials || handle.slice(0, 1)}</text>
        </svg>
    `;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
};

export const normalizeCountryCode = (code: string): string => code.trim().toUpperCase();

const getFlagImageUrl = (code: string): string => `https://flagcdn.com/w40/${normalizeCountryCode(code).toLowerCase()}.png`;

const countryLabelByCode = COUNTRY_OPTIONS.reduce<Record<string, string>>((acc, option) => {
    acc[normalizeCountryCode(option.code)] = option.label;
    return acc;
}, {});

export const getCountryLabel = (code: string): string => countryLabelByCode[normalizeCountryCode(code)] ?? normalizeCountryCode(code);

export const getAgeFromDateOfBirth = (dateOfBirth: string): string | null => {
    const parts = dateOfBirth.split('-').map((part) => Number(part));

    if (parts.length !== 3 || parts.some((part) => Number.isNaN(part))) {
        return null;
    }

    const [year, month, day] = parts;
    const today = new Date();
    let age = today.getFullYear() - year;
    const hasHadBirthdayThisYear = today.getMonth() + 1 > month || (today.getMonth() + 1 === month && today.getDate() >= day);

    if (!hasHadBirthdayThisYear) {
        age -= 1;
    }

    if (age < 0 || age > 130) {
        return null;
    }

    return `${age}y`;
};

const createId = (): string => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

const normalizeContact = (contact?: Partial<Contact>): Contact => {
    const useInsta = contact?.useInstagramAvatar ?? false;
    const instaUrl = contact?.instagramUrl ?? '';
    
    // Regenerate Instagram avatar URL if enabled (fixes old cached unavatar links)
    let avatarUrl = contact?.avatarUrl ?? '';
    if (useInsta && instaUrl) {
        const instagramUrl = getInstagramAvatarUrl(instaUrl);
        if (instagramUrl) {
            avatarUrl = instagramUrl;
        }
    }
    
    return {
        id: contact?.id ?? createId(),
        name: contact?.name ?? '',
        nationalityCode: normalizeCountryCode(contact?.nationalityCode ?? 'SE'),
        avatarUrl,
        useInstagramAvatar: useInsta,
        dateOfBirth: contact?.dateOfBirth ?? '',
        occupation: contact?.occupation ?? '',
        linkedInUrl: contact?.linkedInUrl ?? '',
        instagramUrl: instaUrl,
        latitude: contact?.latitude ?? 59.3293,
        longitude: contact?.longitude ?? 18.0686,
        city: contact?.city ?? '',
        notes: contact?.notes ?? '',
    };
};

const DEFAULT_CONTACTS: Contact[] = [
    {
        id: 'contact-maria',
        name: 'Maria Andersson',
        nationalityCode: 'SE',
        avatarUrl: createAvatarDataUrl('Maria Andersson', '#3b82f6'),
        useInstagramAvatar: false,
        dateOfBirth: '1994-04-18',
        occupation: 'Product Designer',
        linkedInUrl: 'https://www.linkedin.com/',
        instagramUrl: '',
        latitude: 59.3293,
        longitude: 18.0686,
        city: 'Stockholm',
        notes: 'Design partner and long-term friend.',
    },
    {
        id: 'contact-ryo',
        name: 'Ryo Tanaka',
        nationalityCode: 'JP',
        avatarUrl: createAvatarDataUrl('Ryo Tanaka', '#ef4444'),
        useInstagramAvatar: false,
        dateOfBirth: '1992-09-07',
        occupation: 'Software Architect',
        linkedInUrl: 'https://www.linkedin.com/',
        instagramUrl: '',
        latitude: 35.6762,
        longitude: 139.6503,
        city: 'Tokyo',
        notes: 'Met during a software conference.',
    },
    {
        id: 'contact-ava',
        name: 'Ava Miller',
        nationalityCode: 'US',
        avatarUrl: createAvatarDataUrl('Ava Miller', '#10b981'),
        useInstagramAvatar: false,
        dateOfBirth: '1990-11-22',
        occupation: 'Operations Manager',
        linkedInUrl: 'https://www.linkedin.com/',
        instagramUrl: '',
        latitude: 40.7128,
        longitude: -74.006,
        city: 'New York',
        notes: 'Travel contact and product collaborator.',
    },
];

const DEFAULT_STATE: ContactsState = {
    contacts: DEFAULT_CONTACTS,
    filter: '',
};

const normalizeContactsState = (state?: Partial<ContactsState>): ContactsState => ({
    contacts: (state?.contacts ?? DEFAULT_CONTACTS).map((contact) => normalizeContact(contact)),
    filter: state?.filter ?? '',
});

const DEFAULT_CENTER: [number, number] = [20, 0];
const LeafletTileLayer = TileLayer as React.ComponentType<any>;
const LeafletMarker = Marker as React.ComponentType<any>;
const LeafletPopup = Popup as React.ComponentType<any>;

const escapeHtml = (value: string): string => value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const countryFlag = (code: string): string => {
    const normalizedCode = normalizeCountryCode(code);

    if (normalizedCode.length !== 2) {
        return '🏳';
    }

    const [first, second] = normalizedCode.split('');
    return String.fromCodePoint(127397 + first.charCodeAt(0), 127397 + second.charCodeAt(0));
};

export const contactToSearchText = (contact: Contact): string => [
    contact.name,
    normalizeCountryCode(contact.nationalityCode),
    getCountryLabel(contact.nationalityCode),
    contact.dateOfBirth,
    contact.occupation,
    contact.linkedInUrl,
    contact.instagramUrl,
    contact.city,
    contact.notes,
    contact.latitude.toString(),
    contact.longitude.toString(),
    contact.avatarUrl,
].join(' ').toLowerCase();

const contactMarkerIcon = (avatarUrl: string, selected: boolean): L.DivIcon => L.divIcon({
    className: css.mapMarkerWrapper,
    html: `<div class="${css.mapMarker} ${selected ? css.mapMarkerSelected : ''}" style="background-image:url('${escapeHtml(avatarUrl)}')"></div>`,
    iconSize: [52, 52],
    iconAnchor: [26, 26],
});

const userMarkerIcon = (): L.DivIcon => L.divIcon({
    className: css.userMarkerWrapper,
    html: '<div class="user-marker-dot"></div>',
    iconSize: [26, 26],
    iconAnchor: [13, 13],
});

const pickerMarkerIcon = (): L.DivIcon => L.divIcon({
    className: css.pickerMarkerWrapper,
    html: `<div class="${css.pickerMarkerPin}"><div class="${css.pickerMarkerDot}"></div></div>`,
    iconSize: [26, 34],
    iconAnchor: [13, 32],
    popupAnchor: [0, -28],
});

const MapAutoFit: React.FC<{ contacts: Contact[]; userPosition: [number, number] | null }> = ({ contacts, userPosition }) => {
    const map = useMap();

    React.useEffect(() => {
        if (contacts.length === 0 && !userPosition) {
            map.setView(DEFAULT_CENTER, 2);
            return;
        }

        const points = contacts.map((contact) => [contact.latitude, contact.longitude] as [number, number]);

        if (points.length === 0 && userPosition) {
            map.setView(userPosition, 10);
            return;
        }

        if (points.length === 1) {
            map.setView(points[0], 10);
            return;
        }

        map.fitBounds(points, { padding: [48, 48] });
    }, [contacts, map, userPosition]);

    return null;
};

const MapFocusContact: React.FC<{
    selectedContact: Contact | null;
    markerByContactIdRef: React.MutableRefObject<Record<string, L.Marker>>;
}> = ({ selectedContact, markerByContactIdRef }) => {
    const map = useMap();

    React.useEffect(() => {
        if (!selectedContact) {
            return;
        }

        const targetZoom = Math.max(map.getZoom(), 7);
        map.flyTo([selectedContact.latitude, selectedContact.longitude], targetZoom, {
            animate: true,
            duration: 0.35,
        });

        const openPopupAfterMove = (): void => {
            const marker = markerByContactIdRef.current[selectedContact.id];
            if (marker) {
                marker.openPopup();
            }
        };

        map.once('moveend', openPopupAfterMove);

        return () => {
            map.off('moveend', openPopupAfterMove);
        };
    }, [map, markerByContactIdRef, selectedContact]);

    return null;
};

const CoordinatePickerMap: React.FC<{
    value: [number, number];
    onChange: (nextValue: [number, number]) => void;
}> = ({ value, onChange }) => {
    const map = useMap();

    useMapEvents({
        click: (event: L.LeafletMouseEvent) => {
            onChange([event.latlng.lat, event.latlng.lng]);
        },
    });

    React.useEffect(() => {
        map.setView(value, map.getZoom());
    }, [map, value]);

    return (
        <LeafletMarker position={value} icon={pickerMarkerIcon()}>
            <Popup>📍 Tap anywhere to update</Popup>
        </LeafletMarker>
    );
};

export const ContactsPage: React.FC = () => {
    const [storedContactsState, setStoredContactsState] = usePersistedState<ContactsState>('contacts-state', DEFAULT_STATE);
    const contactsState = React.useMemo(() => normalizeContactsState(storedContactsState), [storedContactsState]);
    const [formState, setFormState] = React.useState<Contact>(normalizeContact());
    const [editingContactId, setEditingContactId] = React.useState<string | null>(null);
    const [isFormModalOpen, setIsFormModalOpen] = React.useState(false);
    const [userPosition, setUserPosition] = React.useState<[number, number] | null>(null);
    const [instagramProxyFailedByContactId, setInstagramProxyFailedByContactId] = React.useState<Record<string, boolean>>({});
    const [selectedContactId, setSelectedContactId] = React.useState<string | null>(null);
    const markerByContactIdRef = React.useRef<Record<string, L.Marker>>({});

    const updateContactsState = (mutator: (previous: ContactsState) => ContactsState): void => {
        setStoredContactsState((previous) => mutator(normalizeContactsState(previous)));
    };

    React.useEffect(() => {
        if (!navigator.geolocation) {
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => setUserPosition([position.coords.latitude, position.coords.longitude]),
            () => setUserPosition(null),
            { enableHighAccuracy: false, timeout: 5000 },
        );
    }, []);

    const filteredContacts = React.useMemo(() => {
        const query = contactsState.filter.trim().toLowerCase();

        if (!query) {
            return contactsState.contacts;
        }

        return contactsState.contacts.filter((contact) => contactToSearchText(contact).includes(query));
    }, [contactsState.contacts, contactsState.filter]);

    const selectedContact = React.useMemo(
        () => filteredContacts.find((contact) => contact.id === selectedContactId) ?? null,
        [filteredContacts, selectedContactId],
    );

    React.useEffect(() => {
        if (!selectedContactId) {
            return;
        }

        const stillExists = filteredContacts.some((contact) => contact.id === selectedContactId);
        if (!stillExists) {
            setSelectedContactId(null);
        }
    }, [filteredContacts, selectedContactId]);

    const saveContact = (event: React.FormEvent): void => {
        event.preventDefault();

        const instagramAvatar = formState.useInstagramAvatar ? getInstagramAvatarUrl(formState.instagramUrl) : null;

        const preparedContact: Contact = {
            ...formState,
            avatarUrl: instagramAvatar || formState.avatarUrl.trim() || createAvatarDataUrl(formState.name || 'Friend', '#6366f1'),
        };

        updateContactsState((previous) => {
            const nextContacts = editingContactId
                ? previous.contacts.map((contact) => (contact.id === editingContactId ? preparedContact : contact))
                : [...previous.contacts, preparedContact];

            return {
                ...previous,
                contacts: nextContacts,
            };
        });

        setEditingContactId(null);
        setFormState(normalizeContact());
        setIsFormModalOpen(false);
    };

    const openAddModal = (): void => {
        setEditingContactId(null);
        setFormState(normalizeContact());
        setIsFormModalOpen(true);
    };

    const editContact = (contact: Contact): void => {
        setEditingContactId(contact.id);
        setFormState(normalizeContact(contact));
        setIsFormModalOpen(true);
    };

    const deleteContact = (contactId: string): void => {
        updateContactsState((previous) => ({
            ...previous,
            contacts: previous.contacts.filter((contact) => contact.id !== contactId),
        }));

        if (editingContactId === contactId) {
            setEditingContactId(null);
            setFormState(normalizeContact());
            setIsFormModalOpen(false);
        }
    };

    const closeModal = (): void => {
        setIsFormModalOpen(false);
        setEditingContactId(null);
        setFormState(normalizeContact());
    };

    const getContactAvatarSrc = (contact: Contact): string => {
        if (contact.useInstagramAvatar) {
            const proxyFailedForContact = instagramProxyFailedByContactId[contact.id] ?? false;
            const instagramProxyAvatar = !proxyFailedForContact ? getInstagramProxyAvatarUrl(contact.instagramUrl) : null;

            if (instagramProxyAvatar) {
                return instagramProxyAvatar;
            }

            const instagramFallbackAvatar = getInstagramAvatarUrl(contact.instagramUrl);
            if (instagramFallbackAvatar) {
                return instagramFallbackAvatar;
            }
        }

        return contact.avatarUrl || createAvatarDataUrl(contact.name || 'Friend', '#6366f1');
    };

    const onContactAvatarError = (event: React.SyntheticEvent<HTMLImageElement>, contact: Contact): void => {
        if (contact.useInstagramAvatar) {
            setInstagramProxyFailedByContactId((previous) => ({
                ...previous,
                [contact.id]: true,
            }));
        }

        const fallbackAvatar = getInstagramAvatarUrl(contact.instagramUrl)
            || contact.avatarUrl
            || createAvatarDataUrl(contact.name || 'Friend', '#6366f1');

        if (event.currentTarget.src !== fallbackAvatar) {
            event.currentTarget.src = fallbackAvatar;
        }
    };

    return (
        <section className={css.page}>
            <div className={css.headerRow}>
                <div>
                    <h2 className={css.title}>Contacts</h2>
                    <p className={css.subtitle}>Filter across all fields, add new friends, and keep the map synced to the list.</p>
                </div>

                <label className={css.searchField}>
                    <span>Filter contacts</span>
                    <input
                        type="search"
                        value={contactsState.filter}
                        onChange={(event) => updateContactsState((previous) => ({ ...previous, filter: event.target.value }))}
                        placeholder="Search name, flag, city, notes, coordinates"
                    />
                </label>
            </div>

            <div className={css.layout}>
                <aside className={css.leftPane}>
                    <div className={css.actionsRow}>
                        <button type="button" className={css.primaryButton} onClick={openAddModal}>Add friend</button>
                    </div>

                    <div className={css.listCard}>
                        <h3 className={css.panelTitle}>Contact list ({filteredContacts.length})</h3>

                        <div className={css.contactList}>
                            {filteredContacts.length === 0 ? (
                                <div className={css.emptyState}>No contacts match the current filter.</div>
                            ) : filteredContacts.map((contact) => (
                                <article
                                    key={contact.id}
                                    className={`${css.contactItem} ${selectedContactId === contact.id ? css.contactItemSelected : ''}`.trim()}
                                    onClick={() => setSelectedContactId(contact.id)}
                                >
                                    <img className={css.avatar} src={getContactAvatarSrc(contact)} alt={contact.name} onError={(event) => onContactAvatarError(event, contact)} />

                                    <div className={css.contactBody}>
                                        <div className={css.contactHeader}>
                                            <strong>{contact.name}</strong>
                                            <span className={css.flagBadge}>
                                                <img className={css.flagImage} src={getFlagImageUrl(contact.nationalityCode)} alt={getCountryLabel(contact.nationalityCode)} />
                                                <span>{getCountryLabel(contact.nationalityCode)}</span>
                                            </span>
                                        </div>
                                        <p className={css.occupation}>{contact.occupation || 'Occupation not set'}</p>
                                        <p>{contact.city || 'No city specified'}</p>
                                        {/*<p className={css.meta}>{contact.latitude.toFixed(4)}, {contact.longitude.toFixed(4)}</p>*/}
                                    </div>

                                    <div className={css.contactButtons}>
                                        <button type="button" className={css.secondaryButton} onClick={(event) => { event.stopPropagation(); editContact(contact); }}>Edit</button>
                                        <button type="button" className={css.secondaryButtonDanger} onClick={(event) => { event.stopPropagation(); deleteContact(contact.id); }}>Delete</button>
                                    </div>
                                </article>
                            ))}
                        </div>
                    </div>
                </aside>

                <section className={css.mapPane}>
                    <div className={css.mapCard}>
                        <h3 className={css.panelTitle}>Map</h3>
                        <div className={css.mapWrap}>
                            <MapContainer center={DEFAULT_CENTER} zoom={2} scrollWheelZoom className={css.map}>
                                <LeafletTileLayer
                                    attribution="Tiles &copy; Esri"
                                    url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                                />
                                <MapAutoFit contacts={filteredContacts} userPosition={userPosition} />
                                <MapFocusContact selectedContact={selectedContact} markerByContactIdRef={markerByContactIdRef} />
                                {filteredContacts.map((contact) => {
                                    const ageLabel = getAgeFromDateOfBirth(contact.dateOfBirth);

                                    return (
                                    <LeafletMarker
                                        key={contact.id}
                                        ref={(markerInstance) => {
                                            if (!markerInstance) {
                                                delete markerByContactIdRef.current[contact.id];
                                                return;
                                            }

                                            markerByContactIdRef.current[contact.id] = markerInstance;
                                        }}
                                        position={[contact.latitude, contact.longitude]}
                                        icon={contactMarkerIcon(getContactAvatarSrc(contact), selectedContactId === contact.id)}
                                    >
                                        <LeafletPopup {...({ offset: L.point(0, -20) } as any)}>
                                            <div className={css.contactPopup}>
                                                <div className={css.popupCard}>
                                                    <div className={css.popupHeader}>
                                                        <img className={css.popupAvatar} src={getContactAvatarSrc(contact)} alt={contact.name} onError={(event) => onContactAvatarError(event, contact)} />
                                                        <div className={css.popupHeaderContent}>
                                                            <div className={css.popupHeaderTop}>
                                                                <div>
                                                                    <h4>{contact.name}</h4>
                                                                    <p>{contact.occupation || 'Occupation not set'}</p>
                                                                </div>
                                                                <div className={css.popupHeaderMeta}>
                                                                    {ageLabel && <span className={css.popupAgeBadge}>{ageLabel}</span>}
                                                                    <img className={css.popupNationalityFlag} src={getFlagImageUrl(contact.nationalityCode)} alt={getCountryLabel(contact.nationalityCode)} />
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className={css.popupRow}><strong>City:</strong> {contact.city || 'Not set'}</div>
                                                    <div className={css.popupRow}><strong>Date of birth:</strong> {contact.dateOfBirth || 'Not set'}</div>
                                                    {/*<div className={css.popupRow}><strong>Coordinates:</strong> {contact.latitude.toFixed(4)}, {contact.longitude.toFixed(4)}</div>*/}
                                                    {contact.linkedInUrl && (
                                                        <div className={css.popupRow}><strong>LinkedIn:</strong> <a href={contact.linkedInUrl} target="_blank" rel="noreferrer">Open profile</a></div>
                                                    )}
                                                    {contact.instagramUrl && (
                                                        <div className={css.popupRow}><strong>Instagram:</strong> <a href={contact.instagramUrl} target="_blank" rel="noreferrer">Open profile</a></div>
                                                    )}
                                                    {contact.notes.trim() && (
                                                        <div className={css.popupNotes}>{contact.notes}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </LeafletPopup>
                                    </LeafletMarker>
                                );})}
                                {userPosition && (
                                    <LeafletMarker position={userPosition} icon={userMarkerIcon()}>
                                        <Popup>Your current position.</Popup>
                                    </LeafletMarker>
                                )}
                            </MapContainer>
                            {filteredContacts.length === 0 && <div className={css.emptyMapState}>No result to display on the map.</div>}
                        </div>
                    </div>
                </section>
            </div>

            {isFormModalOpen && (
                <div className={css.modalBackdrop} role="dialog" aria-modal="true" aria-label={editingContactId ? 'Edit friend' : 'Add friend'}>
                    <form className={css.modalCard} onSubmit={saveContact}>
                        <div className={css.modalHeader}>
                            <h3 className={css.panelTitle}>{editingContactId ? 'Edit friend' : 'Add new friend'}</h3>
                            <button type="button" className={css.modalClose} onClick={closeModal}>Close</button>
                        </div>

                        <div className={css.inputGrid}>
                            <label className={css.field}>
                                <span>Name</span>
                                <input type="text" required value={formState.name} onChange={(event) => setFormState((previous) => ({ ...previous, name: event.target.value }))} />
                            </label>

                            <label className={css.field}>
                                <span>Nationality</span>
                                <select value={formState.nationalityCode} onChange={(event) => setFormState((previous) => ({ ...previous, nationalityCode: normalizeCountryCode(event.target.value) }))}>
                                    {COUNTRY_OPTIONS.map((country) => (
                                        <option key={country.code} value={country.code}>{country.label}</option>
                                    ))}
                                </select>
                            </label>

                            <label className={css.field}>
                                <span>Date of birth</span>
                                <input type="date" value={formState.dateOfBirth} onChange={(event) => setFormState((previous) => ({ ...previous, dateOfBirth: event.target.value }))} />
                            </label>

                            <label className={css.field}>
                                <span>Occupation</span>
                                <input type="text" value={formState.occupation} onChange={(event) => setFormState((previous) => ({ ...previous, occupation: event.target.value }))} />
                            </label>

                            <label className={css.field}>
                                <span>LinkedIn URL</span>
                                <input type="url" value={formState.linkedInUrl} onChange={(event) => setFormState((previous) => ({ ...previous, linkedInUrl: event.target.value }))} placeholder="https://linkedin.com/in/..." />
                            </label>

                            <label className={css.field}>
                                <span>Instagram URL or handle</span>
                                <input type="text" value={formState.instagramUrl} onChange={(event) => setFormState((previous) => ({ ...previous, instagramUrl: event.target.value }))} placeholder="https://instagram.com/... or @handle" />
                            </label>

                            <label className={`${css.field} ${css.fullWidth} ${css.checkboxField}`}>
                                <input type="checkbox" checked={formState.useInstagramAvatar} onChange={(event) => setFormState((previous) => ({ ...previous, useInstagramAvatar: event.target.checked }))} />
                                <span>Use Instagram profile picture as avatar</span>
                            </label>

                            <label className={css.field}>
                                <span>Avatar URL</span>
                                <input type="url" value={formState.avatarUrl} onChange={(event) => setFormState((previous) => ({ ...previous, avatarUrl: event.target.value }))} placeholder="Optional custom image URL" disabled={formState.useInstagramAvatar} />
                            </label>

                            <label className={css.field}>
                                <span>City</span>
                                <input type="text" value={formState.city} onChange={(event) => setFormState((previous) => ({ ...previous, city: event.target.value }))} />
                            </label>

                            <label className={css.field}>
                                <span>Latitude</span>
                                <input type="number" step="0.0001" value={formState.latitude} onChange={(event) => setFormState((previous) => ({ ...previous, latitude: Number(event.target.value) }))} />
                            </label>

                            <label className={css.field}>
                                <span>Longitude</span>
                                <input type="number" step="0.0001" value={formState.longitude} onChange={(event) => setFormState((previous) => ({ ...previous, longitude: Number(event.target.value) }))} />
                            </label>

                            <div className={`${css.mapPickerBlock} ${css.fullWidth}`}>
                                <div className={css.mapPickerHeader}>Pick coordinates on map</div>
                                <div className={css.mapPickerHint}>Click on the map to set latitude and longitude directly.</div>
                                <div className={css.mapPickerWrap}>
                                    <MapContainer
                                        center={[formState.latitude, formState.longitude]}
                                        zoom={5}
                                        scrollWheelZoom
                                        className={css.mapPickerMap}
                                    >
                                        <LeafletTileLayer
                                            attribution="Tiles &copy; Esri"
                                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
                                        />
                                        <CoordinatePickerMap
                                            value={[formState.latitude, formState.longitude]}
                                            onChange={(nextValue) => setFormState((previous) => ({
                                                ...previous,
                                                latitude: Number(nextValue[0].toFixed(6)),
                                                longitude: Number(nextValue[1].toFixed(6)),
                                            }))}
                                        />
                                    </MapContainer>
                                </div>
                            </div>

                            <label className={`${css.field} ${css.fullWidth}`}>
                                <span>Notes</span>
                                <textarea rows={3} value={formState.notes} onChange={(event) => setFormState((previous) => ({ ...previous, notes: event.target.value }))} />
                            </label>
                        </div>

                        <div className={css.actionsRow}>
                            <button type="submit" className={css.primaryButton}>{editingContactId ? 'Update friend' : 'Save friend'}</button>
                            <button type="button" className={css.secondaryButton} onClick={closeModal}>Cancel</button>
                        </div>
                    </form>
                </div>
            )}
        </section>
    );
};