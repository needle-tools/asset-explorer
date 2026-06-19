// Thin, SSR-safe wrapper around Rybbit custom events.
// Rybbit exposes `window.rybbit.event(name, properties)` once the script in
// +layout.svelte has loaded. Calls are no-ops on the server or before load.

declare global {
    interface Window {
        rybbit?: {
            event: (name: string, properties?: Record<string, unknown>) => void;
            pageview?: () => void;
        };
    }
}

export function track(name: string, properties?: Record<string, unknown>) {
    if (typeof window === "undefined") return;
    try {
        window.rybbit?.event(name, properties);
    } catch (e) {
        // never let analytics break the app
        console.debug("analytics event failed", name, e);
    }
}
