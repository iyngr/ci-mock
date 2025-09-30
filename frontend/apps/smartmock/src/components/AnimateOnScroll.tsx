"use client"

import { useEffect, useRef, useState } from "react"
import { cn } from "@/lib/utils"

interface AnimateOnScrollProps {
    children: React.ReactNode
    animation?: "fadeInUp" | "fadeInDown" | "slideInLeft" | "slideInRight" | "scaleIn" | "rotateIn" | "bounceIn"
    delay?: number
    duration?: number
    threshold?: number
    triggerOnce?: boolean
    className?: string
    hover?: boolean
    stagger?: boolean
}

export function AnimateOnScroll({
    children,
    animation = "fadeInUp",
    delay = 0,
    duration = 600,
    threshold = 0.1,
    triggerOnce = true,
    className,
    hover = false,
    stagger = false,
}: AnimateOnScrollProps) {
    const [isVisible, setIsVisible] = useState(false)
    const [hasAnimated, setHasAnimated] = useState(false)
    const [isHovered, setIsHovered] = useState(false)
    const elementRef = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const element = elementRef.current
        if (!element) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    // Use requestAnimationFrame for better performance
                    requestAnimationFrame(() => {
                        setTimeout(() => {
                            setIsVisible(true)
                            if (triggerOnce) {
                                setHasAnimated(true)
                            }
                        }, delay)
                    })
                } else {
                    // Reset animation if triggerOnce is false and element is out of view
                    if (!triggerOnce && !hasAnimated) {
                        setIsVisible(false)
                    }
                }
            },
            {
                threshold,
                rootMargin: "50px", // Start animation 50px before element enters viewport
            }
        )

        observer.observe(element)

        return () => {
            observer.unobserve(element)
        }
    }, [delay, threshold, triggerOnce, hasAnimated])

    const getAnimationClass = () => {
        if (!isVisible) {
            return "opacity-0"
        }

        switch (animation) {
            case "fadeInUp":
                return "animate-fade-in-up"
            case "fadeInDown":
                return "animate-fade-in-down"
            case "slideInLeft":
                return "animate-slide-in-left"
            case "slideInRight":
                return "animate-slide-in-right"
            case "scaleIn":
                return "animate-scale-in"
            case "rotateIn":
                return "animate-rotate-in"
            case "bounceIn":
                return "animate-bounce-in"
            default:
                return "animate-fade-in-up"
        }
    }

    const getInitialTransform = () => {
        if (isVisible) return ""

        switch (animation) {
            case "fadeInUp":
                return "translate-y-5"
            case "fadeInDown":
                return "-translate-y-5"
            case "slideInLeft":
                return "-translate-x-5"
            case "slideInRight":
                return "translate-x-5"
            case "scaleIn":
                return "scale-75"
            case "rotateIn":
                return "rotate-12 scale-75"
            case "bounceIn":
                return "scale-50"
            default:
                return "translate-y-5"
        }
    }

    return (
        <div
            ref={elementRef}
            className={cn(
                "transition-all ease-out",
                getInitialTransform(),
                getAnimationClass(),
                hover && "hover:scale-105 hover:shadow-lg cursor-pointer",
                stagger && "stagger-children",
                isHovered && hover && "scale-105 shadow-lg",
                className
            )}
            style={{
                transitionDuration: `${duration}ms`,
                transitionDelay: isVisible ? `${delay}ms` : "0ms",
            }}
            onMouseEnter={() => hover && setIsHovered(true)}
            onMouseLeave={() => hover && setIsHovered(false)}
        >
            {children}
        </div>
    )
}

// Alternative hook-based approach for more complex usage
export function useAnimateOnScroll(
    threshold: number = 0.1,
    delay: number = 0,
    triggerOnce: boolean = true
) {
    const [isVisible, setIsVisible] = useState(false)
    const [hasAnimated, setHasAnimated] = useState(false)
    const elementRef = useRef<HTMLElement>(null)

    useEffect(() => {
        const element = elementRef.current
        if (!element) return

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setTimeout(() => {
                        setIsVisible(true)
                        if (triggerOnce) {
                            setHasAnimated(true)
                        }
                    }, delay)
                } else {
                    if (!triggerOnce && !hasAnimated) {
                        setIsVisible(false)
                    }
                }
            },
            {
                threshold,
                rootMargin: "50px",
            }
        )

        observer.observe(element)

        return () => {
            observer.unobserve(element)
        }
    }, [delay, threshold, triggerOnce, hasAnimated])

    return { isVisible, elementRef }
}

// Staggered animation wrapper for lists
interface StaggeredAnimateProps {
    children: React.ReactNode[]
    staggerDelay?: number
    animation?: AnimateOnScrollProps["animation"]
    className?: string
}

export function StaggeredAnimate({
    children,
    staggerDelay = 100,
    animation = "fadeInUp",
    className,
}: StaggeredAnimateProps) {
    return (
        <div className={className}>
            {children.map((child, index) => (
                <AnimateOnScroll
                    key={index}
                    animation={animation}
                    delay={index * staggerDelay}
                    triggerOnce={true}
                >
                    {child}
                </AnimateOnScroll>
            ))}
        </div>
    )
}
