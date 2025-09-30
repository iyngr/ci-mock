"use client"

import { useState, useRef, useEffect } from "react"
import Image, { ImageProps } from "next/image"

interface OptimizedImageProps extends Omit<ImageProps, "onLoad" | "onError"> {
    fallbackSrc?: string
    lazy?: boolean
    threshold?: number
}

export function OptimizedImage({
    src,
    alt,
    fallbackSrc,
    lazy = true,
    threshold = 0.1,
    className = "",
    ...props
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false)
    const [isInView, setIsInView] = useState(!lazy)
    const [error, setError] = useState(false)
    const imgRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        if (!lazy) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true)
                    observer.disconnect()
                }
            },
            { threshold }
        )

        if (imgRef.current) {
            observer.observe(imgRef.current)
        }

        return () => observer.disconnect()
    }, [lazy, threshold])

    const handleLoad = () => {
        setIsLoaded(true)
    }

    const handleError = () => {
        setError(true)
    }

    return (
        <div
            ref={imgRef}
            className={`relative overflow-hidden ${className}`}
            style={{ backgroundColor: "rgba(42, 24, 22, 0.05)" }}
        >
            {/* Loading skeleton */}
            {!isLoaded && isInView && (
                <div className="absolute inset-0 bg-warm-brown/5 animate-pulse" />
            )}

            {/* Image */}
            {isInView && (
                <Image
                    src={error && fallbackSrc ? fallbackSrc : src}
                    alt={alt}
                    onLoad={handleLoad}
                    onError={handleError}
                    className={`transition-opacity duration-500 ${isLoaded ? "opacity-100" : "opacity-0"
                        }`}
                    {...props}
                />
            )}
        </div>
    )
}
