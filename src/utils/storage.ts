import * as React from 'react';

const parseStoredValue = <T>(rawValue: string | null, fallbackValue: T): T => {
    if (!rawValue) {
        return fallbackValue;
    }

    try {
        return JSON.parse(rawValue) as T;
    } catch {
        return fallbackValue;
    }
};

export const loadFromStorage = <T>(key: string, fallbackValue: T): T => {
    if (typeof window === 'undefined') {
        return fallbackValue;
    }

    return parseStoredValue(window.localStorage.getItem(key), fallbackValue);
};

export const saveToStorage = <T>(key: string, value: T): void => {
    if (typeof window === 'undefined') {
        return;
    }

    window.localStorage.setItem(key, JSON.stringify(value));
};

export const usePersistedState = <T>(key: string, fallbackValue: T): [T, React.Dispatch<React.SetStateAction<T>>] => {
    const [value, setValue] = React.useState<T>(() => loadFromStorage(key, fallbackValue));

    React.useEffect(() => {
        saveToStorage(key, value);
    }, [key, value]);

    return [value, setValue];
};
