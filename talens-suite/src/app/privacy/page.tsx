"use client";
import React from 'react';

const navItems = [
    { id: 'talens', label: 'Talens', href: '/#section-talens' },
    { id: 'smart-mock', label: 'Smart Mock', href: '/#section-smart-mock' },
    { id: 'smart-screen', label: 'Smart Screen', href: '/#section-smart-screen' },
    { id: 'privacy', label: 'Privacy', href: '/privacy' }
];

export default function PrivacyPage() {
    return (
        <main id="main" className="min-h-screen flex flex-col snap-container">
            {/* Navigation Bar */}
            <nav className="sticky top-0 z-40 backdrop-blur bg-white/80 border-b border-black/5 flex items-center justify-center gap-6 py-4 px-6">
                {navItems.map(item => (
                    <a key={item.id} href={item.href} className="text-sm font-medium tracking-wide text-ink/70 hover:text-ink transition relative after:absolute after:left-0 after:-bottom-1 after:h-0.5 after:w-0 after:bg-ink after:transition-all hover:after:w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink/30 rounded">
                        {item.label}
                    </a>
                ))}
            </nav>

            <header className="max-w-5xl w-full mx-auto px-6 pt-10 pb-12">
                <div className="text-center mb-8">
                    <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">Privacy, Security & Responsible AI Policy</h1>
                    <p className="text-ink/70">Applies to: Talens, Smart Mock, and Smart Screen (internal deployments)</p>
                </div>
            </header>

            <div className="flex-1">
                <div className="max-w-5xl mx-auto px-6 pb-16">
                    <ol className="list-none space-y-10 text-ink/80">
                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">1</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Purpose & Scope</h2>
                                    <div className="mt-3">
                                        <div className="inline-block bg-ink/5 text-ink/70 px-3 py-1 rounded-md text-sm font-medium mb-3">Summary</div>
                                        <p className="mt-2">This policy explains how the solution <strong>collects, uses, protects, and governs</strong> data and how it operationalizes Responsible AI across Talens, Smart Mock, and Smart Screen. It covers all Organization environments (dev, test, prod), operators, and internal reviewers.</p>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">2</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Privacy by Design & Data Minimization</h2>
                                    <div className="mt-3">
                                        <div className="inline-block bg-ink/5 text-ink/70 px-3 py-1 rounded-md text-sm font-medium mb-3">Principles</div>
                                        <ol className="list-decimal list-inside ml-4 space-y-2">
                                            <li><strong>No persistent storage of personal data by default.</strong> Systems avoid processing raw PII and mask any inadvertent identifiers before prompts are constructed. Raw PII is not persisted in application stores or logs.</li>
                                            <li><strong>Ephemeral processing.</strong> Inputs and model outputs are processed in memory and not retained beyond the request lifecycle unless operational telemetry (non‑PII) is required for reliability or fraud/abuse investigation.</li>
                                            <li><strong>Transparency & notices.</strong> Internal flows disclose AI usage consistent with Organization policy on AI disclosures.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">3</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">What Each Application Processes</h2>
                                    <div className="mt-3 space-y-4">
                                        <div>
                                            <div className="inline-block bg-ink/5 text-ink/70 px-3 py-1 rounded-md text-sm font-medium mb-2">Talens</div>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li><strong>Inputs:</strong> interview questions, candidate text (or live transcripts).</li>
                                                <li><strong>PII handling:</strong> PII is masked before prompt construction; no image/face or voiceprints captured or stored.</li>
                                                <li><strong>Outputs/Storage:</strong> Structured scores and explanations; no raw conversation retained by default.</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <div className="inline-block bg-ink/5 text-ink/70 px-3 py-1 rounded-md text-sm font-medium mb-2">Smart Mock</div>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li><strong>Inputs:</strong> prompts, candidate text and code.</li>
                                                <li><strong>PII handling:</strong> Detector masks identifiers in free text and comments prior to evaluation.</li>
                                                <li><strong>Outputs/Storage:</strong> De‑identified evaluation artifacts may be retained for calibration/QA when approved.</li>
                                            </ul>
                                        </div>

                                        <div>
                                            <div className="inline-block bg-ink/5 text-ink/70 px-3 py-1 rounded-md text-sm font-medium mb-2">Smart Screen</div>
                                            <ul className="list-disc ml-6 space-y-1">
                                                <li><strong>Inputs:</strong> résumés via secure channel; PII scrubber removes identifiers before summarization.</li>
                                                <li><strong>Outputs/Storage:</strong> De‑identified embeddings/summaries may be retained only with documented approval and a retention schedule.</li>
                                            </ul>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">4</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Legal Roles & Lawful Basis</h2>
                                    <div className="mt-3">
                                        <p><strong>Controller/Processor:</strong> For internal deployments, Organization is the Controller and Processor. Any alternative hosting or operational arrangement must define roles contractually.</p>
                                        <p><strong>Lawful basis:</strong> Recruitment processing may rely on legitimate interests and/or consent (jurisdiction dependent). When consent is used, interfaces include clear notice and opt‑in where required.</p>
                                        <p><strong>Data subject rights:</strong> Because PII is not persisted by default, access/erasure requests commonly return "no personal data retained." Where retention is approved, Organization’s privacy processes support subject rights workflows.</p>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">5</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Where and How Data is Processed</h2>
                                    <div className="mt-3">
                                        <p>The model endpoints run in Azure OpenAI within an isolated Azure subscription. Representative controls include:</p>
                                        <ul className="list-disc ml-6 space-y-1">
                                            <li>Private networking (VNet + Private Endpoints) and egress controls.</li>
                                            <li>Azure Key Vault for secrets and managed identities for access.</li>
                                            <li>Observability with PII suppression in Azure Monitor / Log Analytics.</li>
                                        </ul>
                                        <p className="mt-2">Microsoft’s Azure OpenAI assurances note that prompts/outputs are not used to train OpenAI models and are not shared with other customers.</p>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">6</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Content Safety & Abuse Prevention</h2>
                                    <div className="mt-3">
                                        <p>All inputs and outputs pass through a two-stage safety process:</p>
                                        <ol className="list-decimal ml-6 space-y-1">
                                            <li>Application-layer guardrails (blocklists, regex/ML checks, policy handlers).</li>
                                            <li>Azure AI Content Safety for sexual content, violence, hate, self-harm, and prompt‑injection detection.</li>
                                        </ol>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">7</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Data Retention, Deletion & Logging</h2>
                                    <div className="mt-3">
                                        <ul className="list-disc ml-6 space-y-2">
                                            <li><strong>Default:</strong> 0 retention for raw inputs/outputs and résumés; only non‑PII telemetry retained briefly for reliability and abuse analysis.</li>
                                            <li><strong>Configurable retention:</strong> Where retention is required/approved, de‑identified summaries/embeddings are retained per a documented schedule and secure deletion workflow.</li>
                                            <li><strong>Secure deletion:</strong> Azure-native secure wipe semantics and ticketed evidence for deletion events.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">8</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Incident Response & Reporting</h2>
                                    <div className="mt-3">
                                        <p>Abuse signals, anomalous access, and policy violations trigger alerts and incident workflows. Breach handling follows Organization security operations with internal notifications and regulatory reporting where required.</p>
                                    </div>
                                </div>
                            </div>
                        </li>

                        <li>
                            <div className="flex items-start gap-6">
                                <div className="text-6xl md:text-7xl font-extrabold text-ink/10 leading-none">9</div>
                                <div className="flex-1">
                                    <h2 className="text-2xl font-semibold">Contact & Governance</h2>
                                    <div className="mt-3">
                                        <ul className="list-disc ml-6 space-y-1">
                                            <li><strong>Operational contact:</strong> solution owner (internal directory).</li>
                                            <li><strong>Privacy requests:</strong> route via Organization’s DPO or privacy portal.</li>
                                            <li><strong>AI governance:</strong> register use cases with the Data & AI Compliance Program for approvals and risk screening.</li>
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </li>
                    </ol>
                </div>
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
