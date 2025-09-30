"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll, StaggeredAnimate } from "@/components/AnimateOnScroll"
import { Users, Shield, Brain, Clock, TrendingUp } from "lucide-react"
import { FeatureCard } from "@/components/ui/FeatureCard"

export default function LandingPage() {
    const router = useRouter()

    return (
        <div className="min-h-screen bg-warm-background">
            {/* Hero Section */}
            <section className="relative min-h-[70vh] flex items-center justify-center overflow-hidden">
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-warm-background via-warm-background to-warm-background/95"></div>

                {/* Floating geometric elements inspired by Microsoft AI */}
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                    <div className="absolute top-1/4 left-1/4 w-2 h-2 bg-warm-brown/20 rounded-full animate-float"></div>
                    <div className="absolute top-1/3 right-1/3 w-1 h-1 bg-warm-brown/30 rounded-full animate-float-delayed"></div>
                    <div className="absolute bottom-1/3 left-1/2 w-3 h-3 bg-warm-brown/15 rounded-full animate-float"></div>
                    <div className="absolute top-3/4 right-1/4 w-1.5 h-1.5 bg-warm-brown/25 rounded-full animate-float-delayed"></div>
                </div>

                {/* Main content */}
                <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6 pt-24 sm:pt-28 lg:pt-32">
                    <AnimateOnScroll animation="fadeInUp" delay={200}>
                        <div className="mb-4 sm:mb-6">
                            <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-light text-warm-brown mb-4 sm:mb-6 tracking-tight leading-none">
                                Talens
                            </h1>
                            <div className="w-24 sm:w-32 h-px bg-gradient-to-r from-transparent via-warm-brown/30 to-transparent mx-auto mb-4 sm:mb-6"></div>
                            <p className="text-lg sm:text-xl md:text-2xl text-warm-brown/70 font-light leading-relaxed max-w-2xl mx-auto px-4">
                                Intelligent Technical Assessment Platform
                            </p>
                        </div>
                    </AnimateOnScroll>
                    <section className="py-8 sm:py-10 px-4 sm:px-6">
                        <div className="max-w-6xl mx-auto">
                            <StaggeredAnimate className="grid gap-6 sm:gap-8 md:grid-cols-3">
                                <FeatureCard
                                    title="Multi-Agentic Scoring"
                                    body="Combine multiple AI agents for holistic scoring and readable, detailed reports that explain decisions."
                                    imgSrc="/images/feature-scoring.svg"
                                />

                                <FeatureCard
                                    title="Question Enhancer"
                                    body="Generate high-quality technical questions, tune difficulty, and automatically improve candidate prompts."
                                    imgSrc="/images/feature-questions.svg"
                                />

                                <FeatureCard
                                    title="AI Resume Screening"
                                    body="Fast, AI-assisted resume review to shortlist top candidates based on role-specific rubrics and skills."
                                    imgSrc="/images/feature-resume.svg"
                                />
                            </StaggeredAnimate>
                        </div>
                    </section>
                    <AnimateOnScroll animation="fadeInUp" delay={400}>
                        <div className="mb-12 sm:mb-16">
                            <div className="flex flex-col gap-4 sm:gap-8 justify-center items-center max-w-sm sm:max-w-lg mx-auto px-4">
                                <Button
                                    size="lg"
                                    className="w-full h-14 sm:h-16 text-base sm:text-lg font-medium group btn-touch"
                                    onClick={() => router.push('/login')}
                                >
                                    <Users className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                                    Moderate
                                </Button>
                            </div>
                        </div>
                    </AnimateOnScroll>

                    <AnimateOnScroll animation="fadeInUp" delay={600}>
                        <div className="text-sm text-warm-brown/50 font-light">
                            <p>Secure • Intelligent • Comprehensive</p>
                        </div>
                    </AnimateOnScroll>
                </div>
            </section>

            {/* Features Section */}
        </div>
    )
}
