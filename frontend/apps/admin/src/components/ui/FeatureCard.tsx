"use client"

import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { OptimizedImage } from "@/components/OptimizedImage"

interface FeatureCardProps {
    title: string
    body: string
    imgSrc?: string
    alt?: string
}

export function FeatureCard({ title, body, imgSrc = '/file.svg', alt = '', }: FeatureCardProps) {
    return (
        <AnimateOnScroll animation="fadeInUp" delay={200}>
            <div className="bg-white/5 backdrop-blur-sm border border-warm-brown/5 rounded-2xl p-6 flex flex-col items-center text-center hover:scale-[1.02] transition-transform duration-300 h-full min-h-[240px]">
                <div className="w-28 h-28 mb-4 rounded-lg overflow-hidden flex items-center justify-center bg-warm-brown/5">
                    <OptimizedImage src={imgSrc} alt={alt || title} className="w-16 h-16 object-contain" width={64} height={64} />
                </div>
                <h4 className="text-lg sm:text-xl font-medium text-warm-brown mb-2">{title}</h4>
                <p className="text-sm text-warm-brown/60 font-light">{body}</p>
            </div>
        </AnimateOnScroll>
    )
}
