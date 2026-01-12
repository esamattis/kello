import { signal, effect, type Signal } from "@preact/signals";

export function urlSignal<T>(key: string, initialValue: T): Signal<T> {
    const params = new URLSearchParams(window.location.search);
    const saved = params.get(key);

    let value: T;
    if (saved !== null) {
        try {
            value = JSON.parse(saved) as T;
        } catch {
            value = initialValue;
        }
    } else {
        value = initialValue;
    }

    const sig = signal<T>(value);
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    effect(() => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
        }
        console.log("Value changed:", key, sig.value);

        timeoutId = setTimeout(() => {
            console.log("Updating URL parameter:", key, sig.value);
            const params = new URLSearchParams(window.location.search);
            if (sig.value === initialValue) {
                params.delete(key);
            } else {
                params.set(key, JSON.stringify(sig.value));
            }
            const newUrl = `${window.location.pathname}?${params.toString()}`;
            window.history.replaceState({}, "", newUrl);
        }, 100);
    });

    return sig;
}
