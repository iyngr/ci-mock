"use client";

import { useEffect } from 'react';
import { removeJSON } from '@/lib/safeJson';

// Runs once on app mount to perform lightweight housekeeping (e.g., migrate/remove legacy keys)
export function ClientBoot() {
    useEffect(() => {
        // Legacy key cleanup: old autosave format replaced by assessmentState
        removeJSON('assessment_autosave');

        // Secondary (runtime) instrumentation & error correlation
        const unhandled = (e: PromiseRejectionEvent) => {
            if (typeof e.reason === 'object' && e.reason?.message?.includes('is not valid JSON')) {
                console.groupCollapsed('[storage-diagnostics] Unhandled rejection related to JSON parse');
                console.log('Reason:', e.reason);
                try {
                    const keys = Object.keys(localStorage);
                    const suspicious = keys.filter(k => localStorage.getItem(k) === '[object Object]');
                    console.log('Suspicious keys snapshot:', suspicious);
                } catch { }
                console.groupEnd();
            }
        };
        window.addEventListener('unhandledrejection', unhandled);
        return () => {
            window.removeEventListener('unhandledrejection', unhandled);
        };
    }, []);
    return null;
}
