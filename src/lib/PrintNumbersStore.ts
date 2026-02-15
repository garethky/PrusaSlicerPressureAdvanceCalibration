import { writable } from 'svelte/store';

const STORAGE_KEY = 'printNumbers';

function loadInitialValue(): boolean {
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return stored === null ? true : stored === 'true';
    } catch {
        return true;
    }
}

function createPrintNumbersStore() {
    const { subscribe, set, update } = writable(loadInitialValue());

    return {
        subscribe,
        set(value: boolean) {
            set(value);
            try { localStorage.setItem(STORAGE_KEY, String(value)); } catch {}
        },
    };
}

export const printNumbersStore = createPrintNumbersStore();
