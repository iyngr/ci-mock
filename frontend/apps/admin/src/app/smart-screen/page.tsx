"use client"

import { useState, useEffect, useMemo } from "react"
import { useRouter } from "next/navigation"
import { AnimateOnScroll } from "@/components/AnimateOnScroll"
import { buildApiUrl } from "@/lib/apiClient"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ROLE_OPTIONS = [
    "Springboot Java Developer",
    "Full Stack Developer",
    "AI Engineer",
    "Python Developer"
]

const RECOMMENDED_SKILLS: Record<string, string[]> = {
    "Springboot Java Developer": ["Java", "Spring Boot", "REST APIs", "Microservices", "SQL"],
    "Full Stack Developer": ["React", "Node.js", "TypeScript", "APIs", "SQL"],
    "AI Engineer": ["Python", "Machine Learning", "Deep Learning", "LLMs", "Vector DB"],
    "Python Developer": ["Python", "Django", "Flask", "APIs", "PostgreSQL"],
}

export default function SmartScreenPage() {
    const router = useRouter()
    const [activeTab, setActiveTab] = useState<"auto" | "customized">("auto")
    const [file, setFile] = useState<File | null>(null)
    const [role, setRole] = useState<string>(ROLE_OPTIONS[0])
    const [skills, setSkills] = useState<string[]>([])
    const [extraSkillInput, setExtraSkillInput] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string>("")
    const [result, setResult] = useState<{ summary: string[]; recommendation: string } | null>(null)

    useEffect(() => {
        const token = localStorage.getItem("adminToken")
        if (!token) { router.push("/admin") }
    }, [router])

    // Pre-load recommended skills when role changes (top 5 already in map)
    useEffect(() => {
        if (activeTab === "customized") {
            setSkills(RECOMMENDED_SKILLS[role] || [])
        }
    }, [role, activeTab])

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0]
        if (!f) return
        if (!f.name.toLowerCase().endsWith('.pdf')) {
            setError("Only PDF files accepted")
            setFile(null)
            return
        }
        if (f.size > 5 * 1024 * 1024) {
            setError("File larger than 5MB")
            setFile(null)
            return
        }
        setError("")
        setFile(f)
    }

    const addExtraSkill = () => {
        const s = extraSkillInput.trim()
        if (!s) return
        if (!skills.includes(s)) setSkills(prev => [...prev, s])
        setExtraSkillInput("")
    }

    const toggleSkill = (skill: string) => {
        setSkills(prev => prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill])
    }

    const allSkills = useMemo(() => {
        const rec = RECOMMENDED_SKILLS[role] || []
        const others = skills.filter(s => !rec.includes(s))
        return { rec, others }
    }, [role, skills])

    const handleSubmit = async () => {
        if (!file) { setError("Please upload a PDF resume first"); return }
        setError("")
        setLoading(true)
        setResult(null)
        try {
            const fd = new FormData()
            fd.append('file', file)
            fd.append('mode', activeTab)
            if (activeTab === 'customized') {
                fd.append('role', role)
                fd.append('skills', skills.join(', '))
            }
            const token = localStorage.getItem('adminToken')
            // SSRF mitigation: Only allow trusted API URLs
            const ALLOWED_API_URLS = [
                'http://localhost:8000',
                'https://your-prod-api.com' // Add your real prod API URL(s) here
            ]
            let candidateBaseUrl = process.env.NEXT_PUBLIC_API_URL
            let baseUrl = ALLOWED_API_URLS[0]
            if (
                candidateBaseUrl &&
                typeof candidateBaseUrl === "string" &&
                ALLOWED_API_URLS.includes(candidateBaseUrl)
            ) {
                baseUrl = candidateBaseUrl
            }
            const resp = await fetch(buildApiUrl('/api/admin/smartscreen'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
                body: fd
            })
            if (!resp.ok) {
                const detail = await resp.json().catch(() => ({ detail: resp.statusText }))
                throw new Error(detail.detail || detail.message || 'Request failed')
            }
            const data = await resp.json()
            setResult(data)
        } catch (e: any) {
            setError(e.message || 'Failed to screen resume')
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-warm-background">
            <div className="max-w-6xl mx-auto px-6 pt-24 pb-12">{/* match Add Questions container width */}
                <AnimateOnScroll animation="fadeInUp" delay={150}>
                    <div className="mb-10">
                        <Button
                            variant="ghost"
                            onClick={() => router.push("/dashboard")}
                            className="mb-6 text-warm-brown/60 hover:text-warm-brown"
                        >
                            ← Back to Dashboard
                        </Button>

                        <h1 className="text-4xl lg:text-5xl font-light text-warm-brown mb-4 tracking-tight">Smart Screen</h1>
                        <div className="w-24 h-px bg-warm-brown/30 mb-4"></div>
                        <p className="text-lg text-warm-brown/60 font-light max-w-2xl">Upload a resume PDF and get an AI powered unbiased screening summary.</p>
                    </div>
                </AnimateOnScroll>

                {/* Tabs inside a boxed container like Add Questions */}
                <AnimateOnScroll animation="fadeInUp" delay={220}>
                    <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-2 mb-8 inline-flex">
                        <button
                            onClick={() => setActiveTab('auto')}
                            className={`px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeTab === 'auto'
                                ? 'bg-white text-warm-brown ring-1 ring-warm-brown/10 shadow-sm'
                                : 'text-warm-brown/80 hover:text-warm-brown hover:bg-warm-brown/5'
                                }`}
                        >
                            Auto
                        </button>
                        <button
                            onClick={() => setActiveTab('customized')}
                            className={`ml-3 px-6 py-3 text-sm font-medium rounded-xl transition-all duration-300 ${activeTab === 'customized'
                                ? 'bg-white text-warm-brown ring-1 ring-warm-brown/10 shadow-sm'
                                : 'text-warm-brown/80 hover:text-warm-brown hover:bg-warm-brown/5'
                                }`}
                        >
                            Customized
                        </button>
                    </div>
                </AnimateOnScroll>

                {/* Upload - large file browser similar to Bulk Upload */}
                <AnimateOnScroll animation="fadeInUp" delay={260}>
                    <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 mb-8">
                        <label className="block text-sm font-medium text-warm-brown/70 mb-2">Resume (PDF only, &lt; 5MB)</label>

                        <div className="border-2 border-dashed border-warm-brown/20 rounded-xl p-8 text-center hover:border-warm-brown/40 transition-colors">
                            <input
                                id="resume-upload"
                                type="file"
                                accept="application/pdf"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label htmlFor="resume-upload" className="cursor-pointer">
                                <div className="w-16 h-16 bg-warm-brown/10 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <svg className="w-8 h-8 text-warm-brown/60" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                    </svg>
                                </div>
                                <p className="text-warm-brown font-light mb-2">{file ? file.name : 'Click to upload or drag and drop'}</p>
                                <p className="text-xs text-warm-brown/60">PDF only, max 5MB</p>
                            </label>
                        </div>

                        {file && <p className="text-xs text-warm-brown/50 mt-3">Selected: {file.name}</p>}
                    </div>
                </AnimateOnScroll>

                {activeTab === 'customized' && (
                    <div className="bg-white/60 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 mb-8 space-y-6">
                        <div>
                            <label className="block text-sm font-medium text-warm-brown/70 mb-2">Role</label>
                            <select value={role} onChange={e => setRole(e.target.value)} className="w-full bg-white/80 border border-warm-brown/20 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-warm-brown/30">
                                {ROLE_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                            </select>
                        </div>
                        <div>
                            <p className="text-sm font-medium text-warm-brown/70 mb-2">Recommended for {role}</p>
                            <div className="flex flex-wrap gap-2 mb-4">
                                {allSkills.rec.map(s => (
                                    <button key={s} onClick={() => toggleSkill(s)} className={`px-3 py-1 rounded-full text-xs transition-all ${skills.includes(s) ? 'bg-warm-brown/30 text-warm-brown ring-1 ring-warm-brown/20' : 'bg-warm-brown/10 text-warm-brown/80 hover:bg-warm-brown/20'}`}>{s}</button>
                                ))}
                            </div>
                            {allSkills.others.length > 0 && (
                                <div className="mb-4">
                                    <p className="text-xs uppercase tracking-wide text-warm-brown/50 mb-2">Additional</p>
                                    <div className="flex flex-wrap gap-2">
                                        {allSkills.others.map(s => (
                                            <button key={s} onClick={() => toggleSkill(s)} className={`px-3 py-1 rounded-full text-xs transition-all ${skills.includes(s) ? 'bg-warm-brown/30 text-warm-brown ring-1 ring-warm-brown/20' : 'bg-warm-brown/10 text-warm-brown/80 hover:bg-warm-brown/20'}`}>{s}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            <div className="flex items-center space-x-2">
                                <Input placeholder="Add skill" value={extraSkillInput} onChange={e => setExtraSkillInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addExtraSkill(); } }} />
                                <Button type="button" onClick={addExtraSkill} variant="secondary">Add</Button>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex items-center space-x-4 mb-8">
                    <Button onClick={handleSubmit} disabled={loading || !file} className="px-8 py-3 text-sm tracking-wide">
                        {loading ? 'Screening...' : 'Smart Screen'}
                    </Button>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>

                {result && (
                    <div className="bg-white/70 backdrop-blur-sm border border-warm-brown/10 rounded-2xl p-6 space-y-4 animate-fade-in">
                        <h2 className="text-xl font-light text-warm-brown">Summary</h2>
                        <ul className="list-disc pl-6 space-y-1 text-sm text-warm-brown/80">
                            {result.summary.map((s, i) => <li key={i}>{s}</li>)}
                        </ul>
                        <div className="pt-2 border-t border-warm-brown/10">
                            <p className="text-sm font-medium text-warm-brown/70 mb-1">Recommendation</p>
                            <p className="text-warm-brown/90 text-sm">{result.recommendation}</p>
                        </div>
                    </div>
                )}

                {/* Persistent warning shown even when no result is present */}
                <div className="mt-4">
                    <p className="text-xs text-warm-brown/60 italic">Warning: AI-generated responses may not be 100% accurate and should be used as a supplementary tool.</p>
                    <p className="text-xs text-warm-brown/60 italic">Privacy Notice: No personal data from the uploaded resume is collected, stored, or used for training the AI model.</p>
                </div>
            </div>
        </div>
    )
}
