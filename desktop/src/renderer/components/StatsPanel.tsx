import { useMemo, useEffect, useState, useRef } from 'react'
import {
    AreaChart,
    Area,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    Cell
} from 'recharts'
import { useBackendStore } from '@/stores/backend-store'
import type { Backend } from '@/types/backend'

// ── Activity history tracker ─────────────────────────────────────────
interface ActivityPoint {
    time: string
    tools: number
    backends: number
}

function useActivityHistory(backends: Backend[], maxPoints = 20) {
    const [history, setHistory] = useState<ActivityPoint[]>([])
    const prevRef = useRef<{ tools: number; backends: number }>({ tools: 0, backends: 0 })

    useEffect(() => {
        const totalTools = backends.reduce((sum, b) => sum + (b.state === 'connected' ? b.tool_count : 0), 0)
        const connected = backends.filter((b) => b.state === 'connected').length

        // Only push new point if data changed or periodically
        const now = new Date()
        const timeLabel = now.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })

        setHistory((prev) => {
            const next = [...prev, { time: timeLabel, tools: totalTools, backends: connected }]
            return next.slice(-maxPoints)
        })

        prevRef.current = { tools: totalTools, backends: connected }
    }, [backends, maxPoints])

    return history
}

// ── Custom tooltip ───────────────────────────────────────────────────
function CyberTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null
    return (
        <div className="bg-background/95 border border-primary/50 px-3 py-2 shadow-[0_0_20px_rgba(0,240,255,0.2)] backdrop-blur-md clip-chamfer">
            <p className="font-mono text-[10px] text-primary/70 tracking-widest uppercase mb-1">{label}</p>
            {payload.map((entry: any, i: number) => (
                <p key={i} className="font-mono text-xs" style={{ color: entry.color }}>
                    {entry.name}: <span className="font-bold">{entry.value}</span>
                </p>
            ))}
        </div>
    )
}

// ── Animated counter ─────────────────────────────────────────────────
function AnimatedNumber({ value, duration = 600 }: { value: number; duration?: number }) {
    const [display, setDisplay] = useState(0)
    const ref = useRef({ start: 0, end: 0, startTime: 0 })

    useEffect(() => {
        ref.current.start = display
        ref.current.end = value
        ref.current.startTime = performance.now()

        const animate = (time: number) => {
            const elapsed = time - ref.current.startTime
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3) // ease-out cubic
            const current = Math.round(ref.current.start + (ref.current.end - ref.current.start) * eased)
            setDisplay(current)
            if (progress < 1) requestAnimationFrame(animate)
        }
        requestAnimationFrame(animate)
    }, [value, duration])

    return <>{display}</>
}

// ── Progress bar with gradient ───────────────────────────────────────
function NeonProgressBar({
    label,
    value,
    max,
    gradient
}: {
    label: string
    value: number
    max: number
    gradient: string
}) {
    const pct = max > 0 ? (value / max) * 100 : 0
    return (
        <div className="flex items-center gap-3">
            <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase w-24 shrink-0">{label}</span>
            <div className="flex-1 h-2 bg-muted/30 rounded-none relative overflow-hidden">
                <div
                    className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out rounded-none"
                    style={{ width: `${pct}%`, background: gradient }}
                />
                <div
                    className="absolute inset-y-0 left-0 transition-all duration-1000 ease-out opacity-50 blur-sm"
                    style={{ width: `${pct}%`, background: gradient }}
                />
            </div>
            <span className="font-mono text-xs font-bold text-foreground w-8 text-right">{value}</span>
        </div>
    )
}

// ── Main StatsPanel ──────────────────────────────────────────────────
export function StatsPanel() {
    const backends = useBackendStore((s) => s.backends)
    const serverInfo = useBackendStore((s) => s.serverInfo)
    const theme = useBackendStore((s) => s.theme)
    const activityHistory = useActivityHistory(backends)

    // Theme-aware colors
    const colors = useMemo(() => {
        return theme === 'optik'
            ? { primary: '#3B82F6', secondary: '#10B981', warning: '#F59E0B', error: '#EF4444' }
            : { primary: '#00f0ff', secondary: '#ff0055', warning: '#ffcc00', error: '#ff3333' }
    }, [theme])

    const stats = useMemo(() => {
        const connected = backends.filter((b) => b.state === 'connected').length
        const error = backends.filter((b) => b.state === 'error').length
        const disabled = backends.filter((b) => !b.enabled).length
        const totalTools = backends.reduce((sum, b) => sum + (b.state === 'connected' ? b.tool_count : 0), 0)
        return { connected, error, disabled, totalTools, total: backends.length }
    }, [backends])

    // Per-backend tool distribution for bar chart
    const toolData = useMemo(() => {
        return backends
            .filter((b) => b.state === 'connected' && b.tool_count > 0)
            .map((b) => ({
                name: b.prefix.length > 10 ? b.prefix.slice(0, 10) + '…' : b.prefix,
                tools: b.tool_count,
                type: b.type
            }))
            .sort((a, b) => b.tools - a.tools)
    }, [backends])

    if (!serverInfo || backends.length === 0) return null

    return (
        <div className="shrink-0 border-b border-border px-6 py-4 animate-fade-in">
            <div className="grid gap-4" style={{ gridTemplateColumns: '1fr 1.4fr 1fr' }}>

                {/* ── Left: Status indicators with progress bars ── */}
                <div className="bg-card/50 border border-border p-4 clip-chamfer relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-primary/60 via-transparent to-secondary/60"></div>
                    <h4 className="font-mono text-[10px] text-primary/60 tracking-[0.3em] uppercase mb-3">System Status</h4>

                    <div className="flex flex-col gap-2.5">
                        <NeonProgressBar
                            label="Online"
                            value={stats.connected}
                            max={stats.total}
                            gradient={`linear-gradient(90deg, ${colors.secondary}, ${colors.primary})`}
                        />
                        <NeonProgressBar
                            label="Error"
                            value={stats.error}
                            max={stats.total}
                            gradient={`linear-gradient(90deg, #ff3333, ${colors.error})`}
                        />
                        <NeonProgressBar
                            label="Suspended"
                            value={stats.disabled}
                            max={stats.total}
                            gradient={`linear-gradient(90deg, #ff9900, ${colors.warning})`}
                        />
                    </div>

                    {/* Big number */}
                    <div className="mt-3 pt-3 border-t border-border/50 flex items-baseline gap-2">
                        <span className="font-mono text-3xl font-bold text-primary drop-shadow-[0_0_10px_rgba(0,240,255,0.6)]">
                            <AnimatedNumber value={stats.totalTools} />
                        </span>
                        <span className="font-mono text-[10px] text-primary/50 tracking-widest uppercase">Total Ops</span>
                    </div>
                </div>

                {/* ── Center: Activity area chart ── */}
                <div className="bg-card/50 border border-border p-4 clip-chamfer relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/60 to-transparent"></div>
                    <div className="flex items-center justify-between mb-2">
                        <h4 className="font-mono text-[10px] text-primary/60 tracking-[0.3em] uppercase">Activity Feed</h4>
                        <div className="flex items-center gap-3">
                            <span className="flex items-center gap-1.5 font-mono text-[9px] text-info/80 tracking-wider">
                                <span className="w-2 h-2 bg-info rounded-none shadow-[0_0_4px_rgba(0,240,255,0.5)]"></span>
                                TOOLS
                            </span>
                            <span className="flex items-center gap-1.5 font-mono text-[9px] text-secondary/80 tracking-wider">
                                <span className="w-2 h-2 bg-secondary rounded-none shadow-[0_0_4px_rgba(255,0,85,0.5)]"></span>
                                NODES
                            </span>
                        </div>
                    </div>
                    <ResponsiveContainer width="100%" height={110}>
                        <AreaChart data={activityHistory} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <defs>
                                <linearGradient id="gradTools" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors.primary} stopOpacity={0.4} />
                                    <stop offset="95%" stopColor={colors.primary} stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="gradNodes" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor={colors.secondary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={colors.secondary} stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#6b86a3', fontFamily: 'Chakra Petch' }} tickLine={false} axisLine={{ stroke: '#222240' }} />
                            <YAxis tick={{ fontSize: 8, fill: '#6b86a3', fontFamily: 'Chakra Petch' }} tickLine={false} axisLine={false} />
                            <Tooltip content={<CyberTooltip />} />
                            <Area type="monotone" dataKey="tools" name="Tools" stroke={colors.primary} strokeWidth={2} fill="url(#gradTools)" dot={false} animationDuration={800} />
                            <Area type="monotone" dataKey="backends" name="Nodes" stroke={colors.secondary} strokeWidth={2} fill="url(#gradNodes)" dot={false} animationDuration={800} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>

                {/* ── Right: Tool distribution bar chart ── */}
                <div className="bg-card/50 border border-border p-4 clip-chamfer relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-secondary/60 via-transparent to-primary/60"></div>
                    <h4 className="font-mono text-[10px] text-primary/60 tracking-[0.3em] uppercase mb-2">Ops Distribution</h4>
                    <ResponsiveContainer width="100%" height={130}>
                        <BarChart data={toolData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fontSize: 8, fill: '#6b86a3', fontFamily: 'Chakra Petch' }} tickLine={false} axisLine={{ stroke: '#222240' }} interval={0} />
                            <YAxis tick={{ fontSize: 8, fill: '#6b86a3', fontFamily: 'Chakra Petch' }} tickLine={false} axisLine={false} />
                            <Tooltip content={<CyberTooltip />} />
                            <Bar dataKey="tools" name="Ops" radius={[2, 2, 0, 0]} animationDuration={1200}>
                                {toolData.map((entry, index) => (
                                    <Cell
                                        key={`cell-${index}`}
                                        fill={entry.type === 'http' ? colors.primary : colors.secondary}
                                        fillOpacity={0.8}
                                    />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    )
}
