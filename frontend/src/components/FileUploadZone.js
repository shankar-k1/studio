import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2, FileText, AlertCircle } from 'lucide-react';

export default function FileUploadZone({ onUploadSuccess }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState('');
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error

    const handleDrag = useCallback((e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.type === 'dragenter' || e.type === 'dragover') {
            setIsDragging(true);
        } else if (e.type === 'dragleave') {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = useCallback(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await uploadFile(files[0]);
        }
    }, []);

    const uploadFile = async (file) => {
        setUploading(true);
        setStatus('uploading');
        setFileName(file.name);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const res = await fetch('http://localhost:8000/upload', {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                setStatus('success');
                onUploadSuccess(data);
                // Reset to idle after 3 seconds
                setTimeout(() => setStatus('idle'), 3000);
            } else {
                setStatus('error');
            }
        } catch (err) {
            console.error("FileUploadZone: Upload failed", err);
            setStatus('error');
        } finally {
            setUploading(false);
        }
    };

    return (
        <div
            className={`relative transition-all duration-500 p-1 rounded-[28px] group ${isDragging ? 'scale-[0.8]' : 'scale-100'
                }`}
            style={{
                background: isDragging
                    ? 'linear-gradient(135deg, var(--accent-cyan), var(--accent-blue))'
                    : 'transparent',
                boxShadow: isDragging ? '0 0 40px rgba(34, 211, 238, 0.3)' : 'none'
            }}
            onDragEnter={handleDrag}
            onDragLeave={handleDrag}
            onDragOver={handleDrag}
            onDrop={handleDrop}
        >
            <div
                className="flex flex-col items-center justify-center transition-all duration-500 relative overflow-hidden"
                style={{
                    margin: '0',
                    cursor: 'pointer'
                }}
            >
                {/* Background Glow */}
                <div className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                        background: 'radial-gradient(circle at 50% 50%, var(--accent-cyan) 0%, transparent 70%)',
                        display: isDragging ? 'block' : 'none'
                    }}
                />

                <div className="z-10 text-center flex flex-col items-center">
                    {status === 'idle' && (
                        <>
                            <div className="mb-1 relative group-hover:scale-90 transition-transform duration-500">
                                <UploadCloud size={22} className="text-cyan-400" strokeWidth={1.5} />
                            </div>

                            <h3 className="text-[13px] font-bold mb-0.5 tracking-tight text-white">
                                Drop your latest OBD Base
                            </h3>
                            <p className="text-slate-400 text-[7px] mb-2 max-w-[120px] leading-tight">
                                Upload <span className="text-cyan-400 font-mono">CSV</span> or <span className="text-cyan-400 font-mono">XLSX</span>
                            </p>

                            <label className="glass-button-primary group/btn relative px-12 py-3.5 rounded-2xl cursor-pointer hover:scale-[1.02] active:scale-[0.98] mt-3"
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: 'fit-content',
                                    margin: '0 auto'
                                }}>
                                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover/btn:opacity-100 transition-opacity rounded-2xl" />
                                <span className="relative z-10 flex items-center justify-center gap-3 font-bold uppercase tracking-widest text-[11px] text-white">
                                    <FileText size={18} className="transition-transform group-hover/btn:rotate-6" />
                                    Choose Data Source
                                </span>
                                <input type="file" style={{ display: 'none' }} onChange={(e) => uploadFile(e.target.files[0])} />
                            </label>
                        </>
                    )}

                    {status === 'uploading' && (
                        <div className="flex flex-col items-center py-10">
                            <div className="relative mb-8">
                                <div className="w-20 h-20 rounded-full border-2 border-cyan-400/20" />
                                <div className="absolute inset-0 w-20 h-20 rounded-full border-t-2 border-cyan-400 animate-spin" />
                                <UploadCloud className="absolute inset-0 m-auto text-cyan-400 animate-pulse" size={30} />
                            </div>
                            <span className="text-cyan-400 font-bold tracking-widest uppercase text-xs animate-pulse">
                                Injecting Data Source
                            </span>
                            <span className="text-slate-500 text-[10px] mt-2 font-mono">{fileName}</span>
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center py-6 scale-in">
                            <div className="mb-4 p-4 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                <CheckCircle2 size={32} className="text-emerald-400" />
                            </div>
                            <h3 className="text-lg font-bold text-emerald-400 mb-1">Data Uploaded Successful</h3>
                            <p className="text-slate-400 text-sm">Target dataset compiled & indexed</p>
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center py-6 scale-in">
                            <div className="mb-4 p-4 rounded-full bg-rose-500/10 border border-rose-500/20">
                                <AlertCircle size={32} className="text-rose-400" />
                            </div>
                            <h3 className="text-lg font-bold text-rose-400 mb-1">Upload Failed</h3>
                            <button
                                onClick={() => setStatus('idle')}
                                className="text-slate-400 text-xs hover:text-white underline underline-offset-4 mt-2"
                            >
                                Try again
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Scanning line animation when dragging */}
            {
                isDragging && (
                    <div className="absolute inset-4 overflow-hidden rounded-[24px] pointer-events-none">
                        <div className="w-full h-[2px] bg-cyan-400 shadow-[0_0_15px_var(--accent-cyan)] animate-scan absolute top-0" />
                    </div>
                )
            }
        </div >
    );
}

// Add these styles to your globals.css if possible, or keep as inline if necessary.
// @keyframes scan {
//   0% { top: 0%; }
//   100% { top: 100%; }
// }
// .scale-in {
//   animation: scaleIn 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
// }
// @keyframes scaleIn {
//   from { transform: scale(0.9); opacity: 0; }
//   to { transform: scale(1); opacity: 1; }
// }
