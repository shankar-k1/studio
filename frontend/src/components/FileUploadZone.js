import React, { useState, useCallback } from 'react';
import { UploadCloud, CheckCircle2, FileText, AlertCircle, ChevronDown, Globe } from 'lucide-react';

const ACCOUNTS = [
  { value: 'cameroon', label: 'Cameroon', flag: '🇨🇲' },
  { value: 'mobicom', label: 'Mobicom', flag: '🇲🇳' },
  { value: 'unitel', label: 'Unitel', flag: '🇦🇴' },
  { value: 'ghana', label: 'Ghana', flag: '🇬🇭' },
  { value: 'ivorycoast', label: 'Ivory Coast', flag: '🇨🇮' },
  { value: 'nigeria', label: 'Nigeria', flag: '🇳🇬' },
];

export default function FileUploadZone({ onUploadSuccess, apiBase }) {
    const [isDragging, setIsDragging] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [fileName, setFileName] = useState('');
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [selectedAccount, setSelectedAccount] = useState('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

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

        if (!selectedAccount) {
            alert('Please select an account before uploading a file.');
            return;
        }

        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            await uploadFile(files[0]);
        }
    }, [selectedAccount]);

    const uploadFile = async (file) => {
        if (!selectedAccount) {
            alert('Please select an account before uploading a file.');
            return;
        }

        setUploading(true);
        setStatus('uploading');
        setFileName(file.name);

        const formData = new FormData();
        formData.append('file', file);
        formData.append('account', selectedAccount);

        try {
            const res = await fetch(`${apiBase}/upload`, {
                method: 'POST',
                body: formData,
            });
            if (res.ok) {
                const data = await res.json();
                data.account = selectedAccount;
                setStatus('success');
                onUploadSuccess(data);
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

    const selectedAccountObj = ACCOUNTS.find(a => a.value === selectedAccount);

    return (
        <div
            className={`relative transition-all duration-500 p-1 rounded-[28px] group ${isDragging ? 'scale-[0.8]' : 'scale-100'
                }`}
            style={{
                background: isDragging
                    ? 'linear-gradient(135deg, var(--accent-emerald), var(--accent-blue))'
                    : 'transparent',
                boxShadow: isDragging ? '0 0 40px rgba(0, 245, 160, 0.3)' : 'none',
                width: '100%',
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

                <div className="z-10 text-center flex flex-col items-center" style={{ width: '100%', maxWidth: '400px' }}>
                    {status === 'idle' && (
                        <>
                            {/* Account Selector Dropdown */}
                            <div style={{ width: '100%', maxWidth: '280px', marginBottom: '20px', position: 'relative' }}>
                                <label style={{
                                    display: 'block',
                                    fontSize: '0.75rem',
                                    fontWeight: '700',
                                    textTransform: 'uppercase',
                                    letterSpacing: '0.1em',
                                    color: 'var(--text-dim)',
                                    marginBottom: '8px',
                                    textAlign: 'left'
                                }}>
                                    <Globe size={12} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                    Target Account
                                </label>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsDropdownOpen(!isDropdownOpen); }}
                                    className="input-field flex items-center justify-between"
                                    style={{
                                        border: selectedAccount ? `2px solid var(--accent-cyan)` : '1px solid var(--glass-border)',
                                        background: 'var(--bg-glass-heavy)',
                                        color: selectedAccount ? 'var(--text-main)' : 'var(--text-dim)',
                                    }}
                                >
                                    <span className="flex items-center gap-2">
                                        {selectedAccountObj ? (
                                            <>
                                                <span className="text-lg">{selectedAccountObj.flag}</span>
                                                {selectedAccountObj.label}
                                            </>
                                        ) : (
                                            'Select Protocol Target...'
                                        )}
                                    </span>
                                    <ChevronDown size={14} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                </button>

                                {isDropdownOpen && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '100%',
                                        left: 0,
                                        right: 0,
                                        marginTop: '6px',
                                        background: 'var(--bg-glass-heavy)',
                                        border: '1px solid var(--glass-border)',
                                        borderRadius: '14px',
                                        overflow: 'hidden',
                                        zIndex: 100,
                                        boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                                        backdropFilter: 'blur(20px)',
                                    }}>
                                        {ACCOUNTS.map((acc) => (
                                            <button
                                                key={acc.value}
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedAccount(acc.value);
                                                    setIsDropdownOpen(false);
                                                }}
                                                style={{
                                                    width: '100%',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '10px',
                                                    padding: '11px 16px',
                                                    background: selectedAccount === acc.value ? 'rgba(34, 211, 238, 0.1)' : 'transparent',
                                                    border: 'none',
                                                    borderBottom: '1px solid var(--glass-border)',
                                                    color: selectedAccount === acc.value ? 'var(--accent-cyan)' : 'var(--text-main)',
                                                    fontSize: '0.813rem',
                                                    fontWeight: selectedAccount === acc.value ? '700' : '500',
                                                    cursor: 'pointer',
                                                    textAlign: 'left',
                                                    transition: 'all 0.15s ease',
                                                }}
                                                onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                                                onMouseLeave={(e) => { e.currentTarget.style.background = selectedAccount === acc.value ? 'rgba(34,211,238,0.1)' : 'transparent'; }}
                                            >
                                                <span style={{ fontSize: '1.1rem' }}>{acc.flag}</span>
                                                {acc.label}
                                                {selectedAccount === acc.value && (
                                                    <CheckCircle2 size={14} style={{ marginLeft: 'auto', color: 'var(--accent-cyan)' }} />
                                                )}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>

                            <div className="mb-1 relative group-hover:scale-90 transition-transform duration-500">
                                <UploadCloud size={22} style={{ color: 'var(--accent-cyan)' }} strokeWidth={1.5} />
                            </div>

                            <h3 style={{
                                fontSize: '0.813rem',
                                fontWeight: '700',
                                marginBottom: '4px',
                                letterSpacing: '-0.01em',
                                color: 'var(--text-main)'
                            }}>
                                Drop your latest OBD Base
                            </h3>
                            <p style={{
                                color: 'var(--text-dim)',
                                fontSize: '0.75rem',
                                marginBottom: '12px',
                                maxWidth: '200px',
                                lineHeight: '1.4'
                            }}>
                                Upload <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>CSV</span> or <span style={{ color: 'var(--accent-cyan)', fontFamily: 'JetBrains Mono, monospace' }}>XLSX</span>
                            </p>

                            <label className="btn-primary"
                                style={{
                                    width: 'fit-content',
                                    margin: '0 auto',
                                    opacity: selectedAccount ? 1 : 0.4,
                                    pointerEvents: selectedAccount ? 'auto' : 'none',
                                    padding: '12px 32px'
                                }}>
                                <span className="flex items-center justify-center gap-3 font-black uppercase tracking-[0.2em] text-[10px]">
                                    <FileText size={16} />
                                    Choose Data Source
                                </span>
                                <input type="file" style={{ display: 'none' }} onChange={(e) => {
                                    if (e.target.files[0]) uploadFile(e.target.files[0]);
                                }} />
                            </label>
                            {!selectedAccount && (
                                <p style={{
                                    color: 'var(--accent-amber, #f59e0b)',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    marginTop: '12px'
                                }}>
                                    ⚠ Select an account first
                                </p>
                            )}
                        </>
                    )}

                    {status === 'uploading' && (
                        <div className="flex flex-col items-center py-10">
                            <div className="relative mb-8">
                                <div style={{
                                    width: '80px', height: '80px', borderRadius: '50%',
                                    border: '2px solid rgba(34, 211, 238, 0.2)'
                                }} />
                                <div className="absolute inset-0 animate-spin" style={{
                                    width: '80px', height: '80px', borderRadius: '50%',
                                    borderTop: '2px solid var(--accent-cyan)',
                                    borderRight: '2px solid transparent',
                                    borderBottom: '2px solid transparent',
                                    borderLeft: '2px solid transparent',
                                }} />
                                <UploadCloud className="absolute inset-0 m-auto animate-pulse" size={30} style={{ color: 'var(--accent-cyan)' }} />
                            </div>
                            <span style={{
                                color: 'var(--accent-cyan)',
                                fontWeight: '700',
                                letterSpacing: '0.1em',
                                textTransform: 'uppercase',
                                fontSize: '0.75rem',
                            }} className="animate-pulse">
                                Injecting Data Source
                            </span>
                            <span style={{ color: 'var(--text-dim)', fontSize: '0.75rem', marginTop: '8px', fontFamily: 'JetBrains Mono, monospace' }}>
                                {fileName}
                            </span>
                            {selectedAccountObj && (
                                <span style={{
                                    marginTop: '6px',
                                    fontSize: '0.75rem',
                                    color: 'var(--accent-emerald)',
                                    fontWeight: '600'
                                }}>
                                    {selectedAccountObj.flag} {selectedAccountObj.label}
                                </span>
                            )}
                        </div>
                    )}

                    {status === 'success' && (
                        <div className="flex flex-col items-center py-6 scale-in">
                            <div style={{
                                marginBottom: '16px', padding: '16px', borderRadius: '50%',
                                background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)'
                            }}>
                                <CheckCircle2 size={32} style={{ color: 'var(--accent-emerald)' }} />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-emerald)', marginBottom: '4px' }}>Data Uploaded Successfully</h3>
                            <p style={{ color: 'var(--text-dim)', fontSize: '0.813rem' }}>Target dataset compiled & indexed</p>
                            {selectedAccountObj && (
                                <span style={{
                                    marginTop: '8px',
                                    padding: '4px 12px',
                                    borderRadius: '20px',
                                    background: 'rgba(16, 185, 129, 0.1)',
                                    border: '1px solid rgba(16, 185, 129, 0.2)',
                                    fontSize: '0.75rem',
                                    fontWeight: '600',
                                    color: 'var(--accent-emerald)'
                                }}>
                                    {selectedAccountObj.flag} {selectedAccountObj.label}
                                </span>
                            )}
                        </div>
                    )}

                    {status === 'error' && (
                        <div className="flex flex-col items-center py-6 scale-in">
                            <div style={{
                                marginBottom: '16px', padding: '16px', borderRadius: '50%',
                                background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)'
                            }}>
                                <AlertCircle size={32} style={{ color: 'var(--accent-rose)' }} />
                            </div>
                            <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--accent-rose)', marginBottom: '4px' }}>Upload Failed</h3>
                            <button
                                onClick={() => setStatus('idle')}
                                style={{
                                    color: 'var(--text-dim)',
                                    fontSize: '0.75rem',
                                    textDecoration: 'underline',
                                    textUnderlineOffset: '4px',
                                    marginTop: '8px',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer'
                                }}
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
                        <div className="w-full h-[2px] animate-scan absolute top-0" style={{
                            background: 'var(--accent-cyan)',
                            boxShadow: '0 0 15px var(--accent-cyan)'
                        }} />
                    </div>
                )
            }
        </div >
    );
}
