"use client";
import React, { useEffect, useState } from 'react';
import mermaid from 'mermaid';
import { motion } from 'framer-motion';

export default function MermaidViewer({ chart }) {
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
        mermaid.initialize({
            startOnLoad: true,
            theme: 'dark',
            securityLevel: 'loose',
            fontFamily: 'Inter, sans-serif'
        });
    }, []);

    useEffect(() => {
        if (isClient) {
            mermaid.contentLoaded();
        }
    }, [chart, isClient]);

    if (!isClient) return <div className="p-12 text-center text-slate-500 font-bold uppercase tracking-widest text-[10px]">Initializing Engine...</div>;

    return (
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-black/40 backdrop-blur-xl p-8 rounded-[32px] border border-white-5 mt-6 overflow-auto min-h-[400px] flex items-center justify-center shadow-inner"
        >
            <div className="mermaid scale-110 origin-center transition-transform hover:scale-125 duration-700 cursor-zoom-in">
                {chart}
            </div>
        </motion.div>
    );
}
