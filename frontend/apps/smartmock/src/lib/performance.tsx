import { lazy, Suspense, ComponentType } from 'react'

// Simplified lazy loading helper
export const createLazyComponent = (
    importFunc: () => Promise<{ default: ComponentType }>
) => {
    const LazyComponent = lazy(importFunc)

    const LazyWrapper = (props: Record<string, unknown>) => (
        <Suspense fallback={
            <div className="flex items-center justify-center p-8">
                <div className="loading-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        }>
            <LazyComponent {...props} />
        </Suspense>
    )

    LazyWrapper.displayName = 'LazyComponent'

    return LazyWrapper
}

// Performance optimization utilities
export const prefetchRoute = (route: string) => {
    if (typeof window !== 'undefined') {
        const link = document.createElement('link')
        link.rel = 'prefetch'
        link.href = route
        document.head.appendChild(link)
    }
}

// Debounce utility for performance
export const debounce = <T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let timeoutId: NodeJS.Timeout
    return (...args: Parameters<T>) => {
        clearTimeout(timeoutId)
        timeoutId = setTimeout(() => func(...args), delay)
    }
}

// Throttle utility for performance
export const throttle = <T extends (...args: unknown[]) => unknown>(
    func: T,
    delay: number
): ((...args: Parameters<T>) => void) => {
    let lastCall = 0
    return (...args: Parameters<T>) => {
        const now = Date.now()
        if (now - lastCall >= delay) {
            lastCall = now
            func(...args)
        }
    }
}
