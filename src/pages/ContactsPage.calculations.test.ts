import { Contact } from '../utils/portalTypes';

jest.mock('leaflet', () => ({
    divIcon: () => ({}),
    point: () => ({}),
}));

jest.mock('react-leaflet', () => ({
    MapContainer: (): null => null,
    Marker: (): null => null,
    Popup: (): null => null,
    TileLayer: (): null => null,
    useMap: () => ({
        setView: (): void => undefined,
        fitBounds: (): void => undefined,
        getZoom: (): number => 10,
        flyTo: (): void => undefined,
        once: (): void => undefined,
        off: (): void => undefined,
    }),
    useMapEvents: (): null => null,
}));

// eslint-disable-next-line @typescript-eslint/no-var-requires
const {
    contactToSearchText,
    extractInstagramHandle,
    getAgeFromDateOfBirth,
    getCountryLabel,
    getInstagramProxyAvatarUrl,
    normalizeCountryCode,
} = require('./ContactsPage');

describe('ContactsPage calculations', () => {
    test('extracts instagram handle from various inputs', () => {
        expect(extractInstagramHandle('@my.handle')).toBe('my.handle');
        expect(extractInstagramHandle('https://instagram.com/example_user/')).toBe('example_user');
        expect(extractInstagramHandle('')).toBeNull();
    });

    test('builds instagram proxy avatar URL', () => {
        expect(getInstagramProxyAvatarUrl('@my.handle')).toBe('http://localhost:8787/api/instagram-photo/my.handle?v=2');
        expect(getInstagramProxyAvatarUrl('')).toBeNull();
    });

    test('normalizes and labels country codes', () => {
        expect(normalizeCountryCode(' se ')).toBe('SE');
        expect(getCountryLabel('jp')).toBe('Japan');
        expect(getCountryLabel('xx')).toBe('XX');
    });

    test('calculates age from date of birth and handles invalid values', () => {
        expect(getAgeFromDateOfBirth('1995-04-18')).toMatch(/\dy/);
        expect(getAgeFromDateOfBirth('not-a-date')).toBeNull();
        expect(getAgeFromDateOfBirth('3000-01-01')).toBeNull();
    });

    test('builds lowercase searchable contact text', () => {
        const contact: Contact = {
            id: 'c1',
            name: 'Ava Miller',
            nationalityCode: 'US',
            avatarUrl: 'avatar-url',
            useInstagramAvatar: false,
            dateOfBirth: '1990-11-22',
            occupation: 'Operations Manager',
            linkedInUrl: 'https://linkedin.com',
            instagramUrl: '@avam',
            latitude: 40.7128,
            longitude: -74.006,
            city: 'New York',
            notes: 'Travel collaborator',
        };

        const text = contactToSearchText(contact);
        expect(text).toContain('ava miller');
        expect(text).toContain('new york');
        expect(text).toContain('us');
    });
});
