"use client"

import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { Users, Shield, Brain, Clock, TrendingUp } from "lucide-react"

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-warm-background">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
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
        <div className="relative z-10 max-w-4xl mx-auto text-center px-4 sm:px-6">
          <AnimateOnScroll animation="fadeInUp" delay={200}>
            <div className="mb-12 sm:mb-16">
              <h1 className="text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-light text-warm-brown mb-4 sm:mb-6 tracking-tight leading-none">
                Smart Mock
              </h1>
              <div className="w-24 sm:w-32 h-px bg-gradient-to-r from-transparent via-warm-brown/30 to-transparent mx-auto mb-6 sm:mb-8"></div>
              <p className="text-lg sm:text-xl md:text-2xl text-warm-brown/70 font-light leading-relaxed max-w-2xl mx-auto px-4">
                Intelligent Technical Assessment Platform
              </p>
            </div>
          </AnimateOnScroll>

          <AnimateOnScroll animation="fadeInUp" delay={400}>
            <div className="mb-12 sm:mb-16">
              <p className="text-base sm:text-lg text-warm-brown/60 mb-8 sm:mb-12 font-light">
                Choose your experience
              </p>

              <div className="flex flex-col gap-4 sm:gap-8 justify-center items-center max-w-sm sm:max-w-lg mx-auto px-4">
                <Button
                  size="lg"
                  className="w-full h-14 sm:h-16 text-base sm:text-lg font-medium group btn-touch"
                  onClick={() => router.push('/candidate')}
                >
                  <Users className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  I&apos;m a Candidate
                </Button>

                <Button
                  variant="outline"
                  size="lg"
                  className="w-full h-14 sm:h-16 text-base sm:text-lg font-medium group btn-touch"
                  onClick={() => router.push('/admin')}
                >
                  <Shield className="w-5 h-5 mr-3 group-hover:scale-110 transition-transform duration-300" />
                  I&apos;m an Admin
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
      <section className="py-16 sm:py-24 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <AnimateOnScroll animation="fadeInUp" delay={200}>
            <div className="text-center mb-16 sm:mb-20">
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-light text-warm-brown mb-4 sm:mb-6">
                Advanced Assessment
              </h2>
              <div className="w-20 sm:w-24 h-px bg-warm-brown/30 mx-auto mb-6 sm:mb-8"></div>
              <p className="text-lg sm:text-xl text-warm-brown/70 font-light max-w-2xl mx-auto px-4">
                Cutting-edge technology meets intuitive design for comprehensive technical evaluation
              </p>
            </div>
          </AnimateOnScroll>

          <div className="grid gap-8 sm:gap-12 md:grid-cols-3">
            <AnimateOnScroll animation="fadeInUp" delay={300}>
              <div className="text-center group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-warm-brown/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-warm-brown/20 transition-colors duration-300">
                  <Brain className="w-6 h-6 sm:w-8 sm:h-8 text-warm-brown" />
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-warm-brown mb-3 sm:mb-4">AI-Powered Evaluation</h3>
                <p className="text-sm sm:text-base text-warm-brown/60 font-light leading-relaxed px-2">
                  Advanced algorithms analyze code quality, problem-solving approach, and technical competency
                </p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll animation="fadeInUp" delay={400}>
              <div className="text-center group">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-warm-brown/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-warm-brown/20 transition-colors duration-300">
                  <Clock className="w-6 h-6 sm:w-8 sm:h-8 text-warm-brown" />
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-warm-brown mb-3 sm:mb-4">Real-time Monitoring</h3>
                <p className="text-sm sm:text-base text-warm-brown/60 font-light leading-relaxed px-2">
                  Comprehensive proctoring system ensures assessment integrity while maintaining candidate comfort
                </p>
              </div>
            </AnimateOnScroll>

            <AnimateOnScroll animation="fadeInUp" delay={500}>
              <div className="text-center group md:col-span-3 md:max-w-md md:mx-auto lg:col-span-1 lg:max-w-none">
                <div className="w-14 h-14 sm:w-16 sm:h-16 bg-warm-brown/10 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6 group-hover:bg-warm-brown/20 transition-colors duration-300">
                  <TrendingUp className="w-6 h-6 sm:w-8 sm:h-8 text-warm-brown" />
                </div>
                <h3 className="text-lg sm:text-xl font-medium text-warm-brown mb-3 sm:mb-4">Detailed Analytics</h3>
                <p className="text-sm sm:text-base text-warm-brown/60 font-light leading-relaxed px-2">
                  Comprehensive reporting provides deep insights into candidate performance and skill assessment
                </p>
              </div>
            </AnimateOnScroll>
          </div>
        </div>
      </section>
    </div>
  )
}
