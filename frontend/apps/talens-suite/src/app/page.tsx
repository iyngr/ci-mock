"use client";
import { ProductCard } from '../components/ProductCard.tsx';
import { motion } from 'framer-motion';
import { useRef } from 'react';

const products = [
    {
        id: 'talens',
        title: 'Talens',
        subtitle: 'Faceless Real‑Time Interview',
        description: 'Multi-agent orchestration conducts unbiased, identity-minimized technical conversations with adaptive depth, real-time reasoning, and responsible AI guardrails.',
        // Updated image (previous URL unavailable). Chosen to reflect collaborative technical discussion while remaining neutral.
        image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1200&q=60',
        tint: 'from-white via-slate-50 to-slate-100'
    },
    {
        id: 'smart-mock',
        title: 'Smart Mock',
        subtitle: 'Agentic Assessment & Practice',
        description: 'Hybrid question generation + structured rubric scoring. Code, reasoning, and behavioral signals converge into explainable reports and calibrated readiness metrics.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=60',
        tint: 'from-white via-indigo-50 to-purple-50'
    },
    {
        id: 'smart-screen',
        title: 'Smart Screen',
        subtitle: 'Intelligent Resume Screening',
        description: 'Context-aware resume parsing surfaces capability signatures, trajectory patterns, and risk indicators while preserving fairness objectives and traceability.',
        image: 'https://images.unsplash.com/photo-1513258496099-48168024aec0?auto=format&fit=crop&w=1200&q=60',
        tint: 'from-white via-teal-50 to-emerald-50'
    }
];

const navItems = [
    ...products.map(p => ({ id: p.id, label: p.title })),
    { id: 'privacy', label: 'Privacy' }
];

export default function Landing() {
    const sectionsRef = useRef<Record<string, HTMLElement | null>>({});

    const scrollTo = (id: string) => {
        const el = document.getElementById(`section-${id}`);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
    };

    return (
        <main id="main" className="min-h-screen flex flex-col snap-container">
            {/* Navigation Bar */}
            <nav className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-black/5 flex items-center justify-center gap-6 py-4 px-6">
                {navItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => item.id === 'privacy' ? window.location.assign('/privacy') : scrollTo(item.id)}
                        className="text-sm font-medium tracking-wide text-ink/70 hover:text-ink transition relative after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-ink after:transition-all hover:after:w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 rounded"
                    >
                        {item.label}
                    </button>
                ))}
            </nav>

            {/* Hero Trio */}
            <header className="max-w-7xl w-full mx-auto px-6 pt-10 pb-24">
                <div className="text-center mb-14">
                    <h1 className="text-5xl md:text-6xl lg:text-7xl font-semibold tracking-tight mb-6 gradient-text">Unified Talent Intelligence</h1>
                    <p className="max-w-3xl mx-auto text-lg md:text-xl text-ink/60 leading-relaxed">
                        An integrated suite for modern hiring workflows—real-time interview orchestration, agentic scoring and practice generation, and responsible resume intelligence. Designed for internal evaluation rigor, transparency, and fairness.
                    </p>
                </div>
                <div className="product-grid">
                    {products.map(p => (
                        <ProductCard key={p.id} {...p} onClick={() => scrollTo(p.id)} />
                    ))}
                </div>
            </header>

            {/* Scroll Story Sections */}
            <div className="flex-1">
                {products.map((p, i) => (
                    <section
                        id={`section-${p.id}`}
                        key={p.id}
                        ref={el => { sectionsRef.current[p.id] = el; }}
                        className="relative min-h-screen flex items-center py-24 px-6 lg:px-20 border-t border-black/5 bg-gradient-to-b from-white to-neutralBg snap-section"
                    >
                        <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-14 items-center">
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.4 }}
                                transition={{ duration: 0.7, ease: 'easeOut' }}
                                className="space-y-8"
                            >
                                <div>
                                    <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">{p.title}</h2>
                                    <p className="text-xl font-medium text-ink/70 mb-6">{p.subtitle}</p>
                                    <p className="text-base md:text-lg leading-relaxed text-ink/70 mb-4">{p.description}</p>
                                </div>
                                <ul className="space-y-4 text-ink/70 text-sm md:text-base">
                                    {i === 0 && (
                                        <>
                                            <li>Adaptive multi-agent dialog choreography adjusts depth based on candidate signal quality.</li>
                                            <li>Privacy-preserving, face-optional interaction reduces bias vectors while retaining conversational richness.</li>
                                            <li>Fine-grained proctoring events streamed with contextual rationale for auditability.</li>
                                        </>
                                    )}
                                    {i === 1 && (
                                        <>
                                            <li>Hybrid generation combines curated blueprint templates with retrieval-augmented refinement.</li>
                                            <li>Scoring rubric agent evaluates structure, complexity handling, code clarity, and iterative reasoning traces.</li>
                                            <li>Drill-down practice mode replays scored attempts with targeted progression paths.</li>
                                        </>
                                    )}
                                    {i === 2 && (
                                        <>
                                            <li>Semantic resume parsing maps competency clusters, growth velocity, and domain adjacency.</li>
                                            <li>Signal normalization + outlier detection surfaces differentiators without amplifying noise.</li>
                                            <li>Configurable responsible AI policies enforce fairness thresholds and explanation retention.</li>
                                        </>
                                    )}
                                </ul>
                            </motion.div>
                            <motion.div
                                initial={{ opacity: 0, y: 60 }}
                                whileInView={{ opacity: 1, y: 0 }}
                                viewport={{ once: true, amount: 0.3 }}
                                transition={{ duration: 0.75, ease: 'easeOut', delay: 0.05 }}
                                className="relative h-[520px] w-full rounded-3xl overflow-hidden shadow-panel"
                            >
                                <img
                                    src={p.image}
                                    alt={p.title}
                                    className="absolute inset-0 w-full h-full object-cover object-center"
                                    loading="lazy"
                                />
                                <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-black/10 to-transparent" />
                            </motion.div>
                        </div>
                    </section>
                ))}
            </div>

            <footer className="py-16 px-6 border-t border-black/5 bg-white">
                <div className="max-w-5xl mx-auto text-center space-y-6">
                    <h3 className="text-2xl md:text-3xl font-semibold tracking-tight">Responsible, Explainable, Integrated</h3>
                    <p className="text-ink/60 max-w-3xl mx-auto text-sm md:text-base leading-relaxed">
                        Talens Suite unifies streaming interview intelligence, adaptive assessment scoring, and evidence-grounded screening into a single internal platform. Every agentic decision path, rubric verdict, and screening inference is auditable, exportable, and aligned with responsible AI principles.
                    </p>
                    <p className="text-xs text-ink/40">Design inspired by Google Store layout (internal use only). <a href="/privacy" className="underline text-ink/70 hover:text-ink">Privacy</a></p>
                </div>
            </footer>
        </main>
    );
}
