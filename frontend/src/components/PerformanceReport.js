"use client";
import React from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Clock, Target, ShieldAlert } from 'lucide-react';

export default function PerformanceReport() {
    const kpis = [
        { name: 'Success Rate', value: '68%', color: 'var(--accent-emerald)', icon: <TrendingUp size={14} />, trend: '+4%' },
        { name: 'Average Handle Time', value: '18s', color: 'var(--accent-cyan)', icon: <Clock size={14} />, trend: '-2s' },
        { name: 'Response Rate', value: '42%', color: 'var(--accent-blue)', icon: <Target size={14} />, trend: '+12%' },
        { name: 'Unsub Rate', value: '1.2%', color: 'var(--accent-purple)', icon: <ShieldAlert size={14} />, trend: '0.1%' },
    ];

    return (
        <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-panel p-8"
        >
            <h2 className="panel-title">
                <span className="accent-line" style={{ background: 'var(--accent-blue)' }}></span>
                Protocol Performance Metrics
                <span className="text-ghost ml-auto text-[10px] uppercase font-black tracking-widest opacity-50">Real-time Matrix</span>
            </h2>
            
            <div className="grid gap-6 mt-10" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))' }}>
                {kpis.map((kpi, i) => (
                    <motion.div 
                        key={i} 
                        whileHover={{ y: -5, background: 'rgba(255,255,255,0.04)' }}
                        className="flex flex-col gap-5 p-6 rounded-[32px] bg-white-2 border border-white-5 relative overflow-hidden group"
                    >
                        {/* Glow effect */}
                        <div className="absolute top-0 right-0 w-32 h-32 opacity-0 group-hover:opacity-10 transition-opacity blur-2xl" 
                             style={{ background: kpi.color }} />

                        <div className="flex justify-between items-start">
                            <div className="flex flex-col gap-2">
                                <div className="flex items-center gap-2" style={{ color: kpi.color }}>
                                    {kpi.icon}
                                    <span style={{ fontSize: '0.7rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.12em', color: 'var(--text-dim)' }}>{kpi.name}</span>
                                </div>
                                <span style={{ fontSize: '1.8rem', fontWeight: '950', color: 'var(--text-main)', letterSpacing: '-0.02em', lineHeight: 1 }}>{kpi.value}</span>
                            </div>
                            <div className="px-2 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest" style={{ background: 'rgba(255,255,255,0.03)', color: kpi.color, border: `1px solid ${kpi.color}33` }}>
                                {kpi.trend}
                            </div>
                        </div>

                        <div className="relative h-1.5 w-full bg-black/20 rounded-full overflow-hidden">
                            <motion.div 
                                initial={{ width: 0 }}
                                animate={{ width: kpi.value.includes('%') ? kpi.value : '45%' }}
                                transition={{ duration: 1.5, delay: i * 0.1 }}
                                style={{ height: '100%', background: kpi.color }} 
                            />
                        </div>
                    </motion.div>
                ))}
            </div>

            <div className="mt-12 p-6 rounded-[28px] border border-white-5 flex items-center justify-center gap-5 relative overflow-hidden bg-white-2">
                <div className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-[0_0_15px_#10b981]" />
                <p className="text-[11px] font-black uppercase tracking-[0.3em] opacity-40 italic">
                    All communication protocols are operating within peak efficiency thresholds.
                </p>
            </div>
        </motion.div>
    );
}
