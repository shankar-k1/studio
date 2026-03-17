"use client";
import React, { useState, useEffect } from 'react';
import PerformanceReport from '@/components/PerformanceReport';
import MermaidViewer from '@/components/MermaidViewer';
import FileUploadZone from '@/components/FileUploadZone';
import { motion, AnimatePresence } from 'framer-motion';
import CampaignFlowVisualizer from './components/CampaignFlowVisualizer';
import {
  Database,
  ShieldCheck,
  Zap,
  BarChart3,
  Wand2,
  Layout,
  ChevronRight,
  Download,
  Calendar,
  Copy,
  UploadCloud,
  Smartphone,
  Info,
  CheckCircle2,
  XCircle,
  Activity,
  Menu,
  History,
  Lock,
  User,
  LogOut,
  Settings,
  X,
  Users,
  PieChart,
  Palette,
  ChevronDown,
  Phone,
  PhoneOutgoing,
  Globe,
  Mic
} from 'lucide-react';
const getApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  if (window.location.hostname === 'localhost') return 'http://localhost:8000';

  const envUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!envUrl) return 'http://localhost:8000';

  // If it's a protocol-less host from Render (e.g. obd-backend.onrender.com)
  if (!envUrl.startsWith('http')) {
    return `https://${envUrl}`;
  }
  return envUrl;
};

const API_BASE = getApiBase();

export default function Dashboard() {
  const [selectedAccount, setSelectedAccount] = useState('');
  const [counts, setCounts] = useState({ total: 0, scrubbed: 0, final: 0 });
  const [prompts, setPrompts] = useState([
    "Win a new car today! Press 1 to join our lucky draw.",
    "Exclusive offer for you! Subscribe now and get 50% extra talk time.",
    "Stay connected with our best plans. Press 1 to see details."
  ]);
  const [scrubOptions, setScrubOptions] = useState({
    dnd: true,
    sub: true,
    unsub: true,
    operator: true
  });
  const [docText, setDocText] = useState('');
  const [mermaidFlow, setMermaidFlow] = useState('');
  const [reactFlowData, setReactFlowData] = useState({ nodes: [], edges: [] });
  const [flowLoading, setFlowLoading] = useState(false);
  const [flowError, setFlowError] = useState('');

  const [msisdnList, setMsisdnList] = useState([]);
  const [cleanedMsisdns, setCleanedMsisdns] = useState([]);
  const [loading, setLoading] = useState(false);
  const [xmlContent, setXmlContent] = useState('');
  const [studioMode, setStudioMode] = useState('strategy'); // 'strategy' or 'xml'
  const [pdfLoading, setPdfLoading] = useState(false);
  const [dbStats, setDbStats] = useState({ dnd_count: null, sub_count: null, unsub_count: null });
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const [backendStatus, setBackendStatus] = useState('Checking...');
  const [apiColor, setApiColor] = useState('var(--text-dim)');
  const [aiStatus, setAiStatus] = useState('Checking...');
  const [aiColor, setAiColor] = useState('var(--accent-cyan)');
  const [scheduleData, setScheduleData] = useState({
    obd_name: '',
    flow_name: '',
    msc_ip: '',
    cli: ''
  });

  // VOIP State
  const [voipMsisdn, setVoipMsisdn] = useState('');
  const [voipShortcode, setVoipShortcode] = useState('5566');
  const [voipScript, setVoipScript] = useState('Hello, this is a test call from the Outsmart Global OBD platform. Have a great day!');
  const [voipLoading, setVoipLoading] = useState(false);
  const [voipResult, setVoipResult] = useState(null);
  const [activeVirtualCall, setActiveVirtualCall] = useState(null);
  const [publicUrl, setPublicUrl] = useState(null);

  // Theme State & Persistence
  const [theme, setTheme] = useState('dark');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [historyData, setHistoryData] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Authentication State
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [currentView, setCurrentView] = useState('landing');
  const [didAutoRoute, setDidAutoRoute] = useState(false);
  const [loginCreds, setLoginCreds] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isCreatingUser, setIsCreatingUser] = useState(false);
  const [isLaunching, setIsLaunching] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('obd_token');
    if (token) setIsAuthenticated(true);
  }, []);

  // If authenticated, default into the dashboard view ONCE.
  // Do not block manually switching to the Module Hub (landing) from the menu.
  useEffect(() => {
    if (isAuthenticated && !didAutoRoute) {
      setCurrentView('landing');
      setDidAutoRoute(true);
    }
  }, [isAuthenticated, didAutoRoute]);

  const getAuthHeaders = () => {
    if (typeof window === 'undefined') return {};
    const token = localStorage.getItem('obd_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginError('');
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginCreds)
      });
      if (res.ok) {
        const data = await res.json();
        localStorage.setItem('obd_token', data.token);
        setIsAuthenticated(true);
        setCurrentView('landing');
        setDidAutoRoute(true);
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Invalid credentials');
      }
    } catch (err) {
      setLoginError('Network Error. Is backend running?');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setLoginError('');
    setSuccessMsg('');
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${API_BASE}/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginCreds)
      });
      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(data.message || 'User created. Please log in.');
        setIsCreatingUser(false);
      } else {
        const err = await res.json();
        setLoginError(err.detail || 'Failed to create user');
      }
    } catch (err) {
      setLoginError('Network Error. Is backend running?');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('obd_token');
    setIsAuthenticated(false);
    setCurrentView('landing');
    setDidAutoRoute(false);
  };


  useEffect(() => {
    const savedTheme = localStorage.getItem('obd-theme') || 'dark';
    setTheme(savedTheme);
    document.documentElement.setAttribute('data-theme', savedTheme);
  }, []);

  const themes = ['dark', 'light', 'midnight'];

  const handleVocalSyncClick = () => {
    const token = localStorage.getItem('obd_token');
    window.open(`http://localhost:3001?theme=${theme}${token ? `&token=${token}` : ''}`, '_blank');
  };
  const toggleTheme = () => {
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    const nextTheme = themes[nextIndex];
    setTheme(nextTheme);
    localStorage.setItem('obd-theme', nextTheme);
    document.documentElement.setAttribute('data-theme', nextTheme);
  };

  useEffect(() => {
    const fetchEnv = () => {
      fetch(`${API_BASE}/public-url`)
        .then(res => res.json())
        .then(data => data.public_url && setPublicUrl(data.public_url))
        .catch(() => { });
    };

    const fetchStats = () => {
      fetch(`${API_BASE}/db-stats`)
        .then(res => {
          if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
          setBackendStatus('Connected');
          setApiColor('var(--accent-emerald)');
          return res.json();
        })
        .then(data => setDbStats(data))
        .catch((err) => {
          console.error("Failed to fetch DB stats:", err);
          setBackendStatus('Disconnected');
          setApiColor('var(--accent-rose)');
        });

      fetch(`${API_BASE}/ai-status`)
        .then(res => res.json())
        .then(data => {
          setAiStatus(data.status || 'Offline');
          setAiColor(data.status === 'Online' ? 'var(--accent-emerald)' : 'var(--accent-rose)');
        })
        .catch(() => {
          setAiStatus('Offline');
          setAiColor('var(--accent-rose)');
        });
    };

    fetchEnv();
    fetchStats();
    const interval = setInterval(fetchStats, 20000); // Check every 20s for better responsiveness
    return () => clearInterval(interval);
  }, []);

  const [sessionStats, setSessionStats] = useState({ dnd: 0, sub: 0, unsub: 0, operator: 0 });

  const [scrubJobs, setScrubJobs] = useState([]);
  const [activeJobId, setActiveJobId] = useState(null);

  const pollJobStatus = async (jobId) => {
    try {
      const res = await fetch(`${API_BASE}/scrub-job/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      if (!res.ok) return;
      const data = await res.json();
      const job = data.job;
      setScrubJobs(prev => {
        const others = prev.filter(j => j.id !== job.id);
        return [job, ...others].slice(0, 20);
      });
      if (job.status === 'COMPLETED') {
        setActiveJobId(null);
        setCounts(prev => ({
          ...prev,
          scrubbed: job.final_count || 0,
          final: job.final_count || 0
        }));
        
        // Fetch the actual results to show in terminal
        if (job.results_table) {
          try {
            const resultsRes = await fetch(`${API_BASE}/scrub-results/${job.results_table}`, {
              headers: getAuthHeaders()
            });
            if (resultsRes.ok) {
              const resultsData = await resultsRes.json();
              setCleanedMsisdns(resultsData.msisdns || []);
            }
          } catch (e) {
            console.error("Failed to fetch scrub results content", e);
          }
        }
      } else if (job.status === 'FAILED') {
        setActiveJobId(null);
      }
    } catch (err) {
      console.error('Failed to poll job status', err);
    }
  };

  const performScrub = async (listToScrub) => {
    const targetList = listToScrub || msisdnList;
    if (!targetList.length) return;

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/scrub`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          msisdn_list: targetList,
          options: scrubOptions
        }),
      });

      if (res.status === 413) {
        throw new Error("File too large for cloud transfer. Please split your file into smaller chunks (e.g. 50k names).");
      }

      if (!res.ok) {
        const errInfo = await res.json();
        throw new Error(errInfo.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();

      // Job-based response: enqueue and start polling
      if (data.job_id) {
        setActiveJobId(data.job_id);
        setScrubJobs(prev => [
          {
            id: data.job_id,
            status: data.status || 'QUEUED',
            total_input: data.total_input || targetList.length
          },
          ...prev
        ].slice(0, 20));

        // Initial optimistic counts
        setCounts(prev => ({
          ...prev,
          total: data.total_input || targetList.length,
          scrubbed: 0,
          final: 0
        }));

        // Start a lightweight polling loop for this job
        const pollInterval = setInterval(async () => {
          if (!data.job_id) {
            clearInterval(pollInterval);
            return;
          }
          await pollJobStatus(data.job_id);
          const job = scrubJobs.find(j => j.id === data.job_id);
          if (job && (job.status === 'COMPLETED' || job.status === 'FAILED')) {
            clearInterval(pollInterval);
          }
        }, 3000);
      }
    } catch (err) {
      console.error("Scrubbing failed", err);
      alert(`Scrubbing Failed: ${err.message || 'Network Error'}. Check file size or backend status.`);
    } finally {
      setLoading(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!cleanedMsisdns.length) {
      alert("No verified targets found. Please run the scrubbing pipeline first.");
      return;
    }

    const chunkSizeInput = prompt("Enter custom chunk size for campaign launch (e.g., 5000):", "5000");
    if (chunkSizeInput === null) return; // User cancelled

    const chunkSize = parseInt(chunkSizeInput);
    if (isNaN(chunkSize) || chunkSize <= 0) {
      alert("Invalid chunk size. Please enter a positive number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/launch-campaign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msisdn_list: cleanedMsisdns,
          chunk_size: chunkSize
        }),
      });

      if (!res.ok) {
        const errInfo = await res.json();
        throw new Error(errInfo.detail || `Server returned ${res.status}`);
      }

      const data = await res.json();
      alert(`CAMPAIGN LAUNCHED: ${data.message}`);
    } catch (err) {
      console.error("Launch failed", err);
      alert(`Launch Failed: ${err.message || 'Network Error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = (data) => {
    console.log("Dashboard: Upload Success intercepted", data.total);
    setLoading(true);
    setSessionStats({ dnd: 0, sub: 0, unsub: 0, operator: 0 });
    setCleanedMsisdns([]);
    if (data.account) setSelectedAccount(data.account);

    const newList = data.msisdns || [];
    setMsisdnList(newList);
    setCounts({ total: data.total, scrubbed: 0, final: 0 });

    // Auto-trigger scrubbing after setting the list
    if (newList.length > 0) {
      performScrub(newList);
    } else {
      setLoading(false);
    }
  };

  const handleRunScrub = () => performScrub();

  const downloadCleanedBase = () => {
    if (!cleanedMsisdns.length) {
      alert("No data to download yet. Please run a scrub first.");
      return;
    }
    try {
      const csvContent = "msisdn\n" + cleanedMsisdns.join("\n");
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", `scrubbed_base_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error("Download failed", err);
      alert("Download failed. Please try the 'Copy All' option as a workaround.");
    }
  };

  const handleLogScrubEntry = async () => {
    try {
      const res = await fetch(`${API_BASE}/log-scrub-entry`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          total_input: counts.total,
          final_count: counts.final,
          dnd_removed: sessionStats.dnd,
          sub_removed: sessionStats.sub,
          unsub_removed: sessionStats.unsub,
          operator_removed: sessionStats.operator,
          msisdn_list: cleanedMsisdns
        })
      });
      const data = await res.json();
      if (res.ok) alert(`SUCCESS: ${data.message}`);
      else alert(`ERROR: ${data.detail || 'Failed to log entry'}`);
    } catch (err) {
      alert(`Network Error: ${err.message}`);
    }
  };

  const fetchScrubHistory = async () => {
    setIsHistoryModalOpen(true);
    setIsMenuOpen(false);
    setHistoryLoading(true);
    try {
      const res = await fetch(`${API_BASE}/scrub-history`, {
        headers: {
          ...getAuthHeaders()
        }
      });
      if (res.ok) {
        const data = await res.json();
        setHistoryData(data.data || []);
      } else {
        alert("Failed to fetch history.");
      }
    } catch (err) {
      console.error(err);
      alert("Error fetching history.");
    } finally {
      setHistoryLoading(false);
    }
  };

  const generateFlowFromDoc = async () => {
    if (studioMode === 'strategy' && !docText.trim()) return;
    if (studioMode === 'xml' && !xmlContent.trim()) return;

    setFlowLoading(true);
    setFlowError('');
    setReactFlowData({ nodes: [], edges: [] });
    try {
      let endpoint = `${API_BASE}/generate-flow-json`;
      let payload = {};

      if (studioMode === 'xml') {
        payload = { xml_content: xmlContent };
        endpoint = `${API_BASE}/generate-flow-json-from-xml`;
      } else {
        payload = { doc_text: docText };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.detail || 'Internal AI Error');
      }

      const data = await res.json();

      if (data.nodes && data.nodes.length > 0) {
        // Auto-layout logic (Simple grid/tree)
        const layoutedNodes = data.nodes.map((node, index) => ({
          ...node,
          position: { x: (index % 3) * 300 + 100, y: Math.floor(index / 3) * 200 + 50 }
        }));
        setReactFlowData({ nodes: layoutedNodes, edges: data.edges || [] });
      } else {
        setFlowError('The AI Architect could not detect logical nodes in this input. Try being more specific or simplifying the strategy.');
      }
    } catch (err) {
      console.error('Flow generation failed', err);
      setFlowError(`AI Architect Failed: ${err.message}`);
    } finally {
      setFlowLoading(false);
    }
  };

  const downloadFlowPdf = async () => {
    if (!mermaidFlow) return;
    setPdfLoading(true);
    try {
      const formData = new FormData();
      formData.append('mermaid_code', mermaidFlow);
      formData.append('campaign_name', scheduleData.obd_name || 'AI Campaign Studio');

      const res = await fetch(`${API_BASE}/export-flow-pdf`, {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Campaign_Flow_${Date.now()}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
      } else {
        const err = await res.json();
        alert(`PDF Export Failed: ${err.detail || 'Server error'}`);
      }
    } catch (err) {
      console.error('PDF export failed', err);
      alert('Network error during PDF export.');
    } finally {
      setPdfLoading(false);
    }
  };

  const handleVoipCall = async (e) => {
    e.preventDefault();
    if (!voipMsisdn) return;
    setVoipLoading(true);
    setVoipResult(null);
    try {
      const res = await fetch(`${API_BASE}/trigger-voip-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          msisdn: voipMsisdn,
          shortcode: voipShortcode,
          script: voipScript
        })
      });
      const data = await res.json();
      if (res.ok) {
        setVoipResult({ success: true, message: data.message });
      } else {
        setVoipResult({ success: false, message: data.detail || 'Call failed' });
      }
    } catch (err) {
      setVoipResult({ success: false, message: 'Network Error' });
    } finally {
      setVoipLoading(false);
    }
  };

  // Virtual VOIP Polling & Simulation
  useEffect(() => {
    let pollInterval;
    if (isAuthenticated) {
      pollInterval = setInterval(async () => {
        try {
          const res = await fetch(`${API_BASE}/voip/virtual-calls`);
          const data = await res.json();
          const calls = Object.entries(data.calls || {});
          if (calls.length > 0) {
            const [id, callData] = calls[0];
            setActiveVirtualCall({ id, ...callData });
          } else {
            setActiveVirtualCall(null);
          }
        } catch (err) {
          console.error("Signal Error:", err);
        }
      }, 2000);
    }
    return () => clearInterval(pollInterval);
  }, [isAuthenticated]);

  const handleVirtualRespond = async (action) => {
    if (!activeVirtualCall) return;
    const body = new FormData();
    body.append('call_id', activeVirtualCall.id);
    body.append('action', action);

    await fetch(`${API_BASE}/voip/virtual-respond`, {
      method: 'POST',
      body
    });

    if (action === 'answered') {
      // Simulate IVR Audio
      const msg = new SpeechSynthesisUtterance(activeVirtualCall.script);
      msg.rate = 0.9;
      window.speechSynthesis.speak(msg);
    } else if (action === 'hangup') {
      window.speechSynthesis.cancel();
      setActiveVirtualCall(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div
        className="flex items-center justify-center relative overflow-hidden"
        data-theme={theme}
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          background: 'var(--bg-main)',
          fontFamily: "'Inter', sans-serif",
          overflow: 'auto',
          zIndex: 9999,
          color: 'var(--text-main)'
        }}
      >
        {/* Background Accents */}
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full opacity-[0.15] blur-[140px]" style={{ background: 'var(--accent-cyan)' }} />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-[0.1] blur-[120px]" style={{ background: 'var(--accent-purple)' }} />

        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, var(--text-main) 1px, transparent 0)', backgroundSize: '40px 40px' }} />

        {/* Theme Dropdown for Login */}
        <div style={{
          position: 'absolute',
          top: '40px',
          right: '40px',
          zIndex: 10000
        }}>
          <div className="relative">
            <button
              onClick={toggleTheme}
              className="flex items-center gap-3 px-5 h-12 rounded-2xl glass-action shadow-xl hover:scale-105 transition-all"
              style={{ background: 'var(--bg-glass-heavy)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', cursor: 'pointer' }}
            >
              <div className="flex flex-col items-start leading-tight">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50">Theme</span>
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">{theme}</span>
              </div>
              <Palette size={14} className="ml-2" />
            </button>
          </div>
        </div>

        {/* Top-left Brand Logo and System Status */}
        <div style={{ position: 'absolute', top: '30px', left: '40px', zIndex: 10 }}>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 font-black text-xl tracking-tighter" style={{ color: 'var(--text-main)' }}>
              <Database size={24} className="text-emerald-400" />
              <span className="text-emerald-400">BLACKNGREEN</span>
            </div>

            {/* Login Page Status Indicators */}
            <div className="hidden sm:flex items-center gap-4 px-4 h-10 rounded-xl bg-white-5 border border-white-10 backdrop-blur-md ml-4">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: apiColor, boxShadow: `0 0 8px ${apiColor}` }} />
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">Backend</span>
              </div>
              <div className="w-[1px] h-3 bg-white-10" />
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: aiColor, boxShadow: `0 0 8px ${aiColor}` }} />
                <span className="text-[8px] font-black uppercase tracking-widest opacity-40">AI Engine</span>
              </div>
            </div>
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="relative z-10 w-full px-3"
          style={{ maxWidth: '420px' }}
        >
          <div style={{
            background: 'var(--bg-glass-heavy)',
            borderRadius: '24px',
            backdropFilter: 'blur(30px)',
            border: '1px solid var(--glass-border)',
            boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '40px 32px 32px', textAlign: 'center' }}>
              <div className="mx-auto w-14 h-14 rounded-2xl flex items-center justify-center mb-6 shadow-md" style={{ background: 'var(--bg-glass)', border: '1px solid var(--glass-border)' }}>
                <LogOut size={24} style={{ transform: 'rotate(180deg)', color: 'var(--text-main)' }} />
              </div>

              <h1 style={{
                fontSize: '1.5rem',
                fontWeight: '700',
                margin: '0 0 8px 0',
                color: 'var(--text-main)',
              }}>
                {isCreatingUser ? 'Create an account' : 'Sign in with email'}
              </h1>

              <p style={{
                fontSize: '0.875rem',
                color: 'var(--text-dim)',
                margin: 0,
                lineHeight: 1.5,
                fontWeight: '500'
              }}>
                Secure access to military-grade MSISDN sanitation & communication protocols.
              </p>
            </div>

            <div style={{ padding: '0 32px 40px' }}>
              <form onSubmit={isCreatingUser ? handleCreateUser : handleLogin} className="flex flex-col gap-4">
                <div className="flex flex-col gap-3">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <User size={16} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5"
                      style={{
                        border: '1px solid var(--glass-border)',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      placeholder="Email address"
                      value={loginCreds.username}
                      onChange={(e) => setLoginCreds({ ...loginCreds, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-200">
                      <Lock size={14} />
                    </div>
                    <input
                      type="password"
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-black/5 dark:bg-white/5"
                      style={{
                        border: '1px solid var(--glass-border)',
                        fontSize: '0.9rem',
                        color: 'var(--text-main)',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      placeholder="Password"
                      value={loginCreds.password}
                      onChange={(e) => setLoginCreds({ ...loginCreds, password: e.target.value })}
                      required
                    />
                  </div>
                </div>

                <div className="text-right">
                  <span
                    onClick={() => {
                      setIsCreatingUser(!isCreatingUser);
                      setLoginError('');
                      setSuccessMsg('');
                    }}
                    style={{ fontSize: '0.8rem', color: 'var(--text-main)', cursor: 'pointer', fontWeight: '500' }}
                    className="hover:underline"
                  >
                    {isCreatingUser ? 'Already have an account?' : 'Forgot password or register?'}
                  </span>
                </div>

                {successMsg && (
                  <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', color: 'var(--accent-emerald)', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
                    {successMsg}
                  </div>
                )}

                {loginError && (
                  <div style={{ background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', color: 'var(--accent-rose)', padding: '12px', borderRadius: '12px', fontSize: '0.85rem', textAlign: 'center' }}>
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 mt-2 rounded-xl transition-all font-semibold shadow-md active:scale-[0.98]"
                  style={{
                    background: 'var(--text-main)',
                    color: 'var(--bg-main)',
                    opacity: isLoggingIn ? 0.7 : 1,
                    cursor: isLoggingIn ? 'not-allowed' : 'pointer'
                  }}
                >
                  {isLoggingIn ? 'Authenticating...' : (isCreatingUser ? 'Create Account' : 'Sign In')}
                </button>
              </form>

              {/* Social Login Divider */}
              <div className="relative flex py-6 items-center">
                <div className="flex-grow border-t" style={{ borderColor: 'var(--glass-border)' }}></div>
                <span className="flex-shrink-0 mx-4 text-[0.7rem] text-slate-400 font-medium">Or sign in with</span>
                <div className="flex-grow border-t" style={{ borderColor: 'var(--glass-border)' }}></div>
              </div>

              {/* Social Login Buttons */}
              <div className="flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setLoginError('Google Auth integration pending.')}
                  className="flex-1 py-3 rounded-xl flex items-center justify-center transition-colors border shadow-sm active:scale-95 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                  style={{ borderColor: 'var(--glass-border)' }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setLoginError('GitHub Auth integration pending.')}
                  className="flex-1 py-3 rounded-xl flex items-center justify-center transition-colors border shadow-sm active:scale-95 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--text-main)' }}
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-3.975-1.395-.15-.45-.825-1.395-1.41-1.68-.465-.225-1.14-.84-.015-.855 1.065-.015 1.83.975 2.085 1.395 1.2 2.07 3.165 1.485 3.93 1.14.12-.87.465-1.485.855-1.83-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.48.405.9 1.23.9 2.475 0 1.785-.015 3.225-.015 3.645 0 .33.225.705.84.57 4.755-1.59 8.16-6.075 8.16-11.385C24 5.37 18.63 0 12 0z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setLoginError('Apple Auth integration pending.')}
                  className="flex-1 py-3 rounded-xl flex items-center justify-center transition-colors border shadow-sm active:scale-95 bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10"
                  style={{ borderColor: 'var(--glass-border)', color: 'var(--text-main)' }}
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.365 7.114c.732-.888 1.226-2.13 1.092-3.374-1.07.043-2.366.713-3.12 1.611-.676.804-1.268 2.078-1.114 3.298 1.187.091 2.394-.632 3.142-1.535zm-2.825 2.768c-1.42 0-2.68.966-3.411.966-.732 0-1.801-.893-2.95-.893-1.516 0-2.91.879-3.69 2.228-1.583 2.748-.403 6.816 1.144 9.043.757 1.09 1.649 2.315 2.825 2.27 1.137-.046 1.57-.736 2.94-.736 1.369 0 1.764.736 2.957.712 1.23-.021 2.008-1.115 2.755-2.203.864-1.26 1.222-2.484 1.243-2.549-.026-.011-2.383-.914-2.411-3.637-.024-2.278 1.859-3.376 1.947-3.424-1.066-1.558-2.716-1.77-3.349-1.777z" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- REUSABLE MODULE CARD ---
  function ModuleCard({ icon, title, desc, accent, onClick, disabled }) {
    return (
      <motion.div
        whileHover={!disabled ? { y: -4, scale: 1.01, boxShadow: `0 20px 40px -10px ${accent}22` } : {}}
        whileTap={!disabled ? { scale: 0.99 } : {}}
        onClick={!disabled ? onClick : undefined}
        className={`p-6 flex flex-col items-center text-center transition-all relative overflow-hidden group ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          minHeight: '220px',
          width: '280px',
          borderRadius: '24px',
          background: 'var(--bg-glass)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
        }}
      >
        {/* Animated Corner Accents */}
        <div className="absolute top-0 left-0 w-20 h-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
          style={{ background: `radial-gradient(circle at 0% 0%, ${accent}33, transparent 70%)` }} />

        <div
          className="absolute top-0 left-0 w-full h-[2px]"
          style={{ background: `linear-gradient(to right, transparent, ${accent}, transparent)`, opacity: 0.4 }}
        />

        <div
          className="w-12 h-12 rounded-[14px] flex items-center justify-center mb-4 transition-all duration-500 relative group-hover:shadow-[0_0_20px_-5px_var(--accent-cyan)]"
          style={{
            background: `rgba(255, 255, 255, 0.03)`,
            color: accent,
            border: `1px solid ${accent}33`,
            boxShadow: `inset 0 0 10px ${accent}11`
          }}
        >
          <div className="relative z-10 scale-100 group-hover:scale-110 transition-transform duration-500">
            {icon}
          </div>
        </div>

        <h3 className="text-[0.9rem] font-black uppercase tracking-[0.15em] mb-2" style={{
          color: 'var(--text-main)',
        }}>{title}</h3>

        <p className="text-[11px] font-medium leading-relaxed text-dim opacity-50 px-2 mb-6 group-hover:opacity-100 transition-opacity">
          {desc}
        </p>

        {!disabled && (
          <div className="mt-auto py-2.5 px-6 rounded-full border border-white-5 text-[9px] font-black uppercase tracking-[0.25em] flex items-center gap-2 group-hover:bg-white-5 group-hover:border-white-10 transition-all">
            Click Here <ChevronRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        )}

        {disabled && (
          <div className="mt-auto py-2 px-6 rounded-full bg-white-5 text-[8px] font-black uppercase tracking-[0.2em] opacity-30">
            Encrypted
          </div>
        )}
      </motion.div>
    );
  }

  // REUSABLE MENU OPTION
  function MenuOption({ icon, title, desc, color, onClick }) {
    return (
      <motion.div
        whileHover={{ x: 10, background: 'rgba(255,255,255,0.01)' }}
        onClick={() => {
          // Close menu immediately after selection
          setIsMenuOpen(false);
          onClick();
        }}
        className="flex items-center gap-6 p-6 rounded-3xl cursor-pointer group"
      >
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all group-hover:scale-110" style={{ background: 'rgba(255,255,255,0.05)', color: color }}>
          {icon}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-black uppercase tracking-widest">{title}</span>
          <span className="text-[10px] opacity-40 font-bold uppercase tracking-wider mt-1">{desc}</span>
        </div>
      </motion.div>
    );
  }

  if (currentView === 'landing') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen relative overflow-hidden" data-theme={theme} style={{
        background: 'var(--bg-main)',
        minHeight: '100vh',
        position: 'relative',
        overflow: 'hidden'
      }}>

        {/* Cinematic Background (Grid Removed as per request) */}

        {/* Premium Background Engine */}
        <div className="main-background-layer">
          <motion.div
            animate={{
              scale: [1, 1.2, 1],
              x: [-100, 100, -100],
              y: [-50, 50, -50]
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: 'absolute', top: '10%', left: '15%', width: '600px', height: '600px',
              background: 'radial-gradient(circle, var(--accent-blue) 0%, transparent 70%)',
              opacity: 0.08, filter: 'blur(100px)', borderRadius: '50%'
            }}
          />
          <motion.div
            animate={{
              scale: [1.2, 1, 1.2],
              x: [100, -100, 100],
              y: [50, -50, 50]
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "easeInOut" }}
            style={{
              position: 'absolute', bottom: '10%', right: '15%', width: '700px', height: '700px',
              background: 'radial-gradient(circle, var(--accent-purple) 0%, transparent 70%)',
              opacity: 0.08, filter: 'blur(120px)', borderRadius: '50%'
            }}
          />

          {/* Subtle Digital Orbitals */}
          <div className="orbital-container">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 120, repeat: Infinity, ease: "linear" }}
              className="orbital-ring"
              style={{ width: '100%', height: '100%' }}
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 180, repeat: Infinity, ease: "linear" }}
              className="orbital-ring"
              style={{ width: '80%', height: '80%', borderStyle: 'dashed' }}
            />
          </div>
        </div>

        {/* Cinematic Header */}
        <div className="flex justify-between items-center z-50 w-full" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '40px 60px' }}>
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
            <button
              onClick={toggleTheme}
              className="group flex items-center gap-4 px-6 h-14 rounded-2xl glass-action shadow-2xl transition-all duration-500 overflow-hidden"
            >
              <Palette size={18} className="text-emerald-400" />
              <div className="flex flex-col items-start leading-none gap-1">
                <span className="text-[12px] font-bold uppercase tracking-widest">{theme} Mode</span>
              </div>
            </button>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="flex items-center gap-10">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-50">Backend:</span>
              <span className="text-[12px] font-black uppercase tracking-widest transition-colors duration-500" style={{
                color: backendStatus === 'Connected' ? '#00f5a0' : 'var(--accent-rose)',
                textShadow: backendStatus === 'Connected' ? '0 0 10px rgba(0, 245, 160, 0.3)' : '0 0 10px rgba(244, 63, 94, 0.3)'
              }}>{backendStatus === 'Connected' ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-black uppercase tracking-widest opacity-50">AI Engine:</span>
              <span className="text-[12px] font-black uppercase tracking-widest transition-colors duration-500" style={{
                color: aiStatus === 'Online' ? '#00f5a0' : 'var(--accent-rose)',
                textShadow: aiStatus === 'Online' ? '0 0 10px rgba(0, 245, 160, 0.3)' : '0 0 10px rgba(244, 63, 94, 0.3)'
              }}>{aiStatus === 'Online' ? 'CONNECTED' : 'DISCONNECTED'}</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="flex items-center gap-4">
            <button
              onClick={handleLogout}
              className="flex items-center gap-3 px-6 h-14 rounded-2xl border border-rose-500/20 bg-rose-500/5 text-rose-500 font-bold tracking-widest text-[11px] uppercase hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-xl"
            >
              <LogOut size={16} /> LOGOUT
            </button>
          </motion.div>
        </div>

        {/* Global Hub Interface */}
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-10 w-full flex flex-col items-center justify-center min-h-screen pt-20"
        >
          {/* Centered Brand Header */}
          <div className="flex flex-col items-center text-center mb-10">
            <h1 className="font-black tracking-[0.4em] uppercase leading-none" style={{
              fontSize: '3.5rem',
              margin: 0,
              filter: 'drop-shadow(0 0 40px rgba(16, 185, 129, 0.25))',
            }}>
              <span style={{ color: '#000000' }}>BLACK N </span>
              <span style={{
                color: '#00f5a0',
                textShadow: '0 0 20px rgba(0, 245, 160, 0.4)'
              }}>GREEN</span>
            </h1>
            <div className="h-[3px] w-32 bg-gradient-to-r from-transparent via-emerald-400 to-transparent mt-8 rounded-full opacity-60" />
          </div>

          {/* Module Grid Row */}
          <div className="flex flex-row flex-nowrap items-center justify-center gap-8 px-12 w-full max-w-[1500px] overflow-x-auto pb-16 custom-scrollbar no-scrollbar-at-full">
            <ModuleCard
              icon={<Database size={24} strokeWidth={1.5} />}
              title="Scrubber"
              desc="Military-grade MSISDN sanitation & ultra-fast database profiling engine."
              accent="var(--accent-cyan)"
              onClick={() => setCurrentView('dashboard')}
            />
            <ModuleCard
              icon={<Mic size={24} strokeWidth={1.5} />}
              title="Vocal Sync"
              desc="Next-generation AI voice synthesis with multilingual emotional direction."
              accent="var(--accent-purple)"
              onClick={handleVocalSyncClick}
            />
            <ModuleCard
              icon={<Users size={24} strokeWidth={1.5} />}
              title="Access Control"
              desc="Manage global administrative privileges and deep security hierarchy."
              accent="var(--accent-emerald)"
              disabled
            />
            <ModuleCard
              icon={<Settings size={24} strokeWidth={1.5} />}
              title="Architecture"
              desc="Global environment tuning and automated microservice orchestration."
              accent="var(--accent-amber)"
              disabled
            />
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="dashboard-container relative" data-theme={theme} style={{ padding: 0 }}>
      {/* Top App Bar (always visible) */}
      <div
        className="sticky top-0 z-[60] w-full"
        style={{
          background: 'transparent',
          backdropFilter: 'blur(30px)',
          borderBottom: '1px solid var(--glass-border)',
          width: '100%',
        }}
      >
        <div className="flex items-center justify-between w-full px-10 py-5">
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-6">
              <button
                onClick={() => setIsMenuOpen(v => !v)}
                className="w-14 h-14 rounded-3xl glass-action flex items-center justify-center hover:scale-110 transition-all shadow-2xl relative group overflow-hidden"
                style={{ background: 'var(--accent-cyan)', border: '2px solid rgba(255,255,255,0.2)' }}
                aria-label="Open menu"
                title="System Menu"
              >
                <div className="absolute inset-0 bg-white opacity-0 group-hover:opacity-10 transition-opacity" />
                <Menu size={24} className="text-black" strokeWidth={2.5} />
              </button>

              <div className="flex flex-col leading-none">
                <span className="text-[10px] font-black uppercase tracking-[0.4em] opacity-40">Outsmart OBD</span>
                <span className="text-[16px] font-black uppercase tracking-wider">Scrubbing Studio</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-10">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-40">Backend:</span>
                <span className="text-[12px] font-black uppercase tracking-widest transition-colors duration-500" style={{
                  color: backendStatus === 'Connected' ? '#00f5a0' : 'var(--accent-rose)',
                  textShadow: backendStatus === 'Connected' ? '0 0 10px rgba(0, 245, 160, 0.4)' : '0 0 10px rgba(244, 63, 94, 0.4)'
                }}>{backendStatus === 'Connected' ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-[11px] font-black uppercase tracking-widest opacity-40">AI Engine:</span>
                <span className="text-[12px] font-black uppercase tracking-widest transition-colors duration-500" style={{
                  color: aiStatus === 'Online' ? '#00f5a0' : 'var(--accent-rose)',
                  textShadow: aiStatus === 'Online' ? '0 0 10px rgba(0, 245, 160, 0.4)' : '0 0 10px rgba(244, 63, 94, 0.4)'
                }}>{aiStatus === 'Online' ? 'CONNECTED' : 'DISCONNECTED'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <button
                onClick={toggleTheme}
                className="w-11 h-11 rounded-2xl glass-action flex items-center justify-center hover:scale-105 transition-all"
                style={{ background: 'var(--bg-glass-heavy)', border: '1px solid var(--glass-border)' }}
                aria-label="Toggle theme"
                title="Toggle theme"
              >
                <Palette size={18} />
              </button>

              <button
                onClick={handleLogout}
                className="flex items-center gap-4 px-7 h-11 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-extrabold tracking-[0.2em] text-[11px] uppercase hover:bg-rose-500 hover:text-white transition-all duration-300 shadow-xl"
              >
                <LogOut size={16} /> LOGOUT
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Sidebar Navigation */}
        <AnimatePresence>
          {isMenuOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsMenuOpen(false)}
                className="fixed inset-0 z-40"
                style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(10px)' }}
              />
              <motion.div
                initial={{ x: -400 }}
                animate={{ x: 0 }}
                exit={{ x: -400 }}
                className="fixed top-0 left-0 h-full z-50 glass-panel"
                style={{
                  width: 'min(340px, 88vw)',
                  borderRadius: '0 32px 32px 0',
                  padding: '48px 0',
                  borderLeft: 'none'
                }}
              >
                <div className="px-12 mb-16 flex justify-between items-center">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-black uppercase tracking-[0.4em] text-emerald-400 mb-2">Command Center</span>
                    <h2 className="text-2xl font-black tracking-wider uppercase">System Menu</h2>
                  </div>
                  <button onClick={() => setIsMenuOpen(false)} className="w-12 h-12 rounded-2xl bg-white-5 flex items-center justify-center hover:bg-white-10 text-white-40 transition-all">
                    <X size={20} />
                  </button>
                </div>
                <div className="flex flex-col gap-4 px-4">
                  <MenuOption icon={<Layout size={28} />} title="Modules Hub" desc="Switch system modules" color="var(--accent-cyan)" onClick={() => setCurrentView('landing')} />
                  <MenuOption icon={<History size={28} />} title="Scrub History" desc="View past execution logs" color="var(--accent-emerald)" onClick={() => setIsHistoryModalOpen(true)} />
                  <MenuOption icon={<Database size={28} />} title="Database Engine" desc="Manage clean records" color="var(--accent-blue)" onClick={() => { }} />
                  <MenuOption icon={<Activity size={28} />} title="System Activity" desc="Real-time performance" color="var(--accent-purple)" onClick={() => { }} />
                </div>

                {/* DESIGN STUDIO */}
                <div className="mt-4 px-8 pt-8 border-t border-white-5">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] block mb-6" style={{ color: 'var(--accent-cyan)' }}>Design Studio</span>
                  <div className="grid grid-cols-2 gap-4 pb-8">
                    {themes.map((t) => (
                      <motion.button
                        key={t}
                        whileHover={{ y: -4, scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => {
                          setTheme(t);
                          localStorage.setItem('obd-theme', t);
                          document.documentElement.setAttribute('data-theme', t);
                        }}
                        className={`group flex flex-col items-center justify-center p-4 rounded-3xl border transition-all duration-500 overflow-hidden relative ${theme === t
                          ? 'border-emerald-400 bg-emerald-400/5 shadow-[0_0_30px_rgba(34,211,238,0.15)]'
                          : 'border-white-5 bg-white-5 hover:border-white-20'
                          }`}
                      >
                        {/* THEME SWATCH */}
                        <div className="w-12 h-12 rounded-2xl mb-3 flex items-center justify-center relative overflow-hidden shadow-2xl border border-white-10 group-hover:rotate-6 transition-transform">
                          <div className="absolute inset-0" style={{
                            background: t === 'dark' ? 'linear-gradient(135deg, #020617 0%, #172554 100%)' :
                              t === 'light' ? 'linear-gradient(135deg, #fff 0%, #dbeafe 100%)' :
                                t === 'midnight' ? 'linear-gradient(135deg, #050510 0%, #312e81 100%)' :
                                  'linear-gradient(135deg, #1a1a61ff 0%, #4c1d95 100%)'
                          }} />

                          {/* Accent preview dots */}
                          <div className="relative z-10 flex gap-1">
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: t === 'midnight' ? '#818cf8' : 'var(--accent-cyan)' }} />
                            <div className="w-1.5 h-1.5 rounded-full" style={{ background: t === 'midnight' ? '#c084fc' : 'var(--accent-blue)' }} />
                          </div>

                          {theme === t && (
                            <motion.div
                              layoutId="active-indicator"
                              className="absolute inset-0 border-2 border-emerald-400 z-20 rounded-2xl"
                            />
                          )}
                        </div>

                        <div className="flex flex-col items-center gap-1">
                          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-main)' }}>{t}</span>
                          {theme === t && (
                            <span className="text-[7px] font-bold text-emerald-400 uppercase tracking-tighter">Active</span>
                          )}
                        </div>
                      </motion.button>
                    ))}
                  </div>
                </div>

                <div className="mt-auto px-8 py-8 border-t border-white-5">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-2xl bg-emerald-400/10 border border-emerald-400/20 flex items-center justify-center text-emerald-400 font-black text-sm">AD</div>
                      <div className="absolute -bottom-1 -right-1 w-3 h-3 rounded-full bg-emerald-500 border-2 border-slate-900 animate-pulse" />
                    </div>
                    <div className="flex flex-col">
                      <span className="text-xs font-black text-white uppercase tracking-widest">Admin User</span>
                      <span className="text-[10px] text-emerald-500/80 font-bold uppercase tracking-tighter">System Online</span>
                    </div>
                  </div>
                  <div className="flex justify-between items-center opacity-40 mb-6">
                    <span className="text-[9px] font-bold uppercase tracking-[0.2em]">OBD OUTSMART v2.0</span>
                    <span className="text-[9px] font-bold uppercase tracking-tighter">© 2026 PR</span>
                  </div>
                  <button
                    onClick={() => {
                      handleLogout();
                      setIsMenuOpen(false);
                    }}
                    style={{
                      width: '100%',
                      padding: '16px',
                      borderRadius: '20px',
                      background: 'rgba(244, 63, 94, 0.1)',
                      color: 'var(--accent-rose)',
                      border: '1px solid rgba(244, 63, 94, 0.2)',
                      fontSize: '0.75rem',
                      fontWeight: '800',
                      textTransform: 'uppercase',
                      letterSpacing: '0.2em',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      transition: 'all 0.3s'
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.2)'}
                    onMouseLeave={e => e.currentTarget.style.background = 'rgba(244, 63, 94, 0.1)'}
                  >
                    <LogOut size={16} /> LOGOUT
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        <motion.div
          key="dashboard-flow"
          className="sequential-flow-container p-6"
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
          }}
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
            gap: '2rem',
            width: '100%',
            maxWidth: '1600px',
            margin: '0 auto',
            paddingTop: '40px'
          }}
        >
          {/* STEP 1: DATA INJECTION */}
          <motion.section
            className="glass-panel sequential-step"
            style={{
              padding: '20px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.02)',
              border: '1px solid var(--glass-border)',
              width: '100%',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              margin: '0',
            }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <div className="step-badge"><UploadCloud size={20} /></div>
            <h2 className="panel-title">
              <span className="accent-line" style={{ background: 'var(--accent-emerald)' }}></span>
              Step 1: Data Injection
              <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.74rem' }}>Lead Base Upload</span>
            </h2>
            {selectedAccount && (
              <div style={{ marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Active Account:</span>
                <span style={{ fontSize: '0.813rem', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'capitalize', padding: '4px 12px', borderRadius: '20px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)' }}>{selectedAccount}</span>
              </div>
            )}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <FileUploadZone onUploadSuccess={handleFileUpload} apiBase={API_BASE} />
            </div>
          </motion.section>

          {/* STEP 2: DATABASE ANALYTICS */}
          <motion.section
            className="glass-panel sequential-step"
            style={{
              padding: '20px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.02)',
              border: '1px solid var(--glass-border)',
              width: '100%',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              margin: '0',
            }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <div className="step-badge"><Database size={20} /></div>
            <h2 className="panel-title">
              <span className="accent-line" style={{ background: 'var(--accent-emerald)' }}></span>
              Step 2: Database Analytics
              <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Global Cross-Reference</span>
            </h2>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', justifyContent: 'center' }}>
              {/* ROW 1: DND, SUB, UNSUB */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full">
                <div className="stat-card group" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 20px', borderRadius: '20px', borderLeft: '4px solid var(--accent-emerald)' }}>
                  <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--accent-emerald)', display: 'flex' }}>
                    <ShieldCheck size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>Global DND</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '950', color: 'var(--text-main)', lineHeight: 1 }}>
                      {dbStats.dnd_count === null ? '...' : dbStats.dnd_count.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="stat-card group" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 20px', borderRadius: '20px', borderLeft: '4px solid var(--accent-cyan)' }}>
                  <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(34, 211, 238, 0.1)', color: 'var(--accent-cyan)', display: 'flex' }}>
                    <Smartphone size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>Subscriptions</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '950', color: 'var(--text-main)', lineHeight: 1 }}>
                      {dbStats.sub_count === null ? '...' : dbStats.sub_count.toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="stat-card group" style={{ display: 'flex', alignItems: 'center', gap: '15px', padding: '16px 20px', borderRadius: '20px', borderLeft: '4px solid var(--accent-rose)' }}>
                  <div style={{ padding: '10px', borderRadius: '12px', background: 'rgba(244, 63, 92, 0.1)', color: 'var(--accent-rose)', display: 'flex' }}>
                    <XCircle size={20} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', color: 'var(--text-dim)', letterSpacing: '0.1em' }}>Unsub Archive</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: '950', color: 'var(--text-main)', lineHeight: 1 }}>
                      {dbStats.unsub_count === null ? '...' : dbStats.unsub_count.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* STEP 3: VERIFICATION INTELLIGENCE */}
          <motion.section
            className="glass-panel sequential-step"
            style={{
              padding: '20px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.02)',
              border: '1px solid var(--glass-border)',
              width: '100%',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              margin: '0',
            }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <div className="step-badge"><ShieldCheck size={20} /></div>
            <h2 className="panel-title">
              <span className="accent-line" style={{ background: 'var(--accent-purple)' }}></span>
              Step 3: Verification Intelligence
              <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Scrubbing Outcome Preview</span>
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="stat-card" style={{ display: 'flex', alignItems: 'center', padding: '12px 20px' }}>
                <div className="flex flex-col">
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.6rem' }}>Initial Lead Load</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-dim)', fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}><Info size={10} /> Total volume</div>
                </div>
                <div className="stat-value" style={{ color: 'var(--accent-blue)', fontSize: '1.4rem', marginLeft: 'auto' }}>
                  {loading ? <span style={{ fontSize: '0.75rem' }} className="animate-pulse">Syncing...</span> : counts.total.toLocaleString()}
                </div>
              </div>
              <div className="stat-card" style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', borderLeft: '3px solid var(--accent-emerald)' }}>
                <div className="flex flex-col">
                  <div className="stat-label" style={{ marginBottom: 0, fontSize: '0.6rem' }}>Verified Clean Base</div>
                  <div style={{ fontSize: '0.65rem', color: 'var(--accent-emerald)', opacity: 0.8, fontWeight: '700', display: 'flex', alignItems: 'center', gap: '4px', textTransform: 'uppercase' }}><CheckCircle2 size={10} /> Ready</div>
                </div>
                <div className="stat-value" style={{ color: 'var(--accent-emerald)', fontSize: '1.4rem', marginLeft: 'auto' }}>
                  {loading ? <span style={{ fontSize: '0.75rem' }} className="animate-pulse">Wait...</span> : counts.final.toLocaleString()}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <div className="stat-label" style={{ marginBottom: 8, fontSize: '0.6rem', color: 'var(--accent-purple)' }}>DND Removals</div>
                <div className="stat-value" style={{ color: 'var(--text-main)', fontSize: '1.5rem' }}>
                  {sessionStats.dnd.toLocaleString()}
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-purple-400" style={{ width: counts.total ? `${(sessionStats.dnd / counts.total) * 100}%` : '0%' }}></div>
                </div>
              </div>
              <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <div className="stat-label" style={{ marginBottom: 8, fontSize: '0.6rem', color: 'var(--accent-cyan)' }}>Sub Removals</div>
                <div className="stat-value" style={{ color: 'var(--text-main)', fontSize: '1.5rem' }}>
                  {sessionStats.sub.toLocaleString()}
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-emerald-400" style={{ width: counts.total ? `${(sessionStats.sub / counts.total) * 100}%` : '0%' }}></div>
                </div>
              </div>
              <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <div className="stat-label" style={{ marginBottom: 8, fontSize: '0.6rem', color: '#f87171' }}>Unsub Blocks</div>
                <div className="stat-value" style={{ color: 'var(--text-main)', fontSize: '1.5rem' }}>
                  {sessionStats.unsub.toLocaleString()}
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-red-400" style={{ width: counts.total ? `${(sessionStats.unsub / counts.total) * 100}%` : '0%' }}></div>
                </div>
              </div>
              <div className="stat-card" style={{ display: 'flex', flexDirection: 'column', padding: '20px' }}>
                <div className="stat-label" style={{ marginBottom: 8, fontSize: '0.6rem', color: 'var(--accent-blue)' }}>Operator Filter</div>
                <div className="stat-value" style={{ color: 'var(--text-main)', fontSize: '1.5rem' }}>
                  {sessionStats.operator.toLocaleString()}
                </div>
                <div className="h-1 w-full bg-slate-800 rounded-full mt-3 overflow-hidden">
                  <div className="h-full bg-blue-400" style={{ width: counts.total ? `${(sessionStats.operator / counts.total) * 100}%` : '0%' }}></div>
                </div>
              </div>
            </div>
          </motion.section>

          {/* STEP 4: SCRUBBING CONFIGURATION */}
          <motion.section
            className="glass-panel sequential-step"
            style={{
              padding: '20px 24px',
              boxShadow: '0 8px 32px rgba(0,0,0,0.02)',
              border: '1px solid var(--glass-border)',
              width: '100%',
              minHeight: '220px',
              display: 'flex',
              flexDirection: 'column',
              margin: '0',
              position: 'relative',
              overflow: 'hidden',
            }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <div className="step-badge"><Zap size={20} /></div>
            <h2 className="panel-title">
              <span className="accent-line" style={{ background: 'var(--accent-blue)' }}></span>
              Step 4: Scrubber Configuration
              <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Filter Logic & Execution</span>
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 px-2">
              {Object.keys(scrubOptions).map((opt) => (
                <motion.div
                  key={opt}
                  whileHover={{ y: -4, background: 'rgba(255,255,255,0.08)' }}
                  className={`glass-card-interactive flex flex-col gap-3 p-5 transition-all relative overflow-hidden ${scrubOptions[opt] ? 'ring-1 ring-cyan-500/50' : ''}`}
                  style={{ borderRadius: '20px', border: '1px solid var(--glass-border)', background: 'var(--bg-glass-heavy)' }}
                  onClick={() => setScrubOptions(prev => ({ ...prev, [opt]: !prev[opt] }))}
                >
                  <div className="flex items-center justify-between">
                    <span style={{ fontSize: '0.65rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.15em', color: scrubOptions[opt] ? 'var(--accent-cyan)' : 'var(--text-dim)' }}>
                      {opt}
                    </span>
                    <div className={`flex items-center justify-center rounded-lg transition-all ${scrubOptions[opt] ? 'bg-cyan-500' : 'border-2 border-slate-700'}`} style={{ width: '20px', height: '20px' }}>
                      {scrubOptions[opt] && <CheckCircle2 size={12} strokeWidth={3} style={{ color: '#020617' }} />}
                    </div>
                  </div>
                  <p style={{ fontSize: '0.6rem', color: 'var(--text-dim)', lineHeight: '1.5', margin: 0, fontWeight: '600', opacity: 0.7 }}>
                    {opt === 'dnd' ? 'National DND Check' :
                      opt === 'sub' ? 'Subscriber Filter' :
                        opt === 'unsub' ? 'Opt-out Verification' :
                          'Carrier Validation'}
                  </p>
                </motion.div>
              ))}
            </div>
            <div className="flex flex-row flex-wrap gap-3 mt-6" style={{ position: 'relative' }}>
              <button
                className="btn-primary glow-hover"
                style={{ padding: '12px 16px', fontSize: '0.813rem', flex: 2, minWidth: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer', position: 'relative' }}
                onClick={handleRunScrub}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                    SCRUBBING PIPELINE...
                  </>
                ) : (
                  <>
                    <Zap size={14} fill="currentColor" />
                    EXECUTE SCRUBBING PIPELINE
                  </>
                )}
              </button>
              <button
                className="btn-secondary glow-hover"
                style={{ padding: '10px 16px', fontSize: '0.75rem', flex: 1, minWidth: '120px', cursor: 'pointer' }}
                onClick={downloadCleanedBase}
                disabled={cleanedMsisdns.length === 0}
              >
                <Download size={14} />
                EXPORT CSV
              </button>
              <button
                className="btn-secondary glow-hover"
                style={{ padding: '10px 16px', fontSize: '0.75rem', flex: 1, minWidth: '140px', cursor: 'pointer' }}
                onClick={handleLogScrubEntry}
                disabled={cleanedMsisdns.length === 0}
              >
                <Database size={14} />
                LOG ENTRY
              </button>
              <button
                className="btn-secondary glow-hover"
                style={{ padding: '10px 16px', fontSize: '0.75rem', flex: 1, minWidth: '160px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', color: cleanedMsisdns.length > 0 ? 'var(--accent-emerald)' : 'inherit', borderColor: cleanedMsisdns.length > 0 ? 'var(--accent-emerald)' : 'var(--glass-border)', cursor: 'pointer' }}
                onClick={() => setIsScheduleModalOpen(true)}
                disabled={cleanedMsisdns.length === 0}
              >
                <Calendar size={14} />
                SCHEDULE
              </button>
            </div>

            {/* SCRUBBING FULL-SECTION OVERLAY SPINNER */}
            {loading && (
              <div style={{
                position: 'absolute',
                inset: 0,
                background: 'rgba(0,0,0,0.6)',
                backdropFilter: 'blur(6px)',
                borderRadius: '32px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                zIndex: 50,
                gap: '20px',
              }}>
                <div style={{ position: 'relative', width: '64px', height: '64px' }}>
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '3px solid rgba(16,185,129,0.15)'
                  }} />
                  <div style={{
                    position: 'absolute', inset: 0, borderRadius: '50%',
                    border: '3px solid transparent',
                    borderTopColor: 'var(--accent-emerald)',
                    borderRightColor: 'var(--accent-emerald)',
                    animation: 'spin 0.8s linear infinite'
                  }} />
                  <Zap size={24} style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', color: 'var(--accent-emerald)' }} />
                </div>
                <div style={{ textAlign: 'center' }}>
                  <p style={{ fontSize: '0.813rem', fontWeight: '700', color: 'var(--accent-emerald)', textTransform: 'uppercase', letterSpacing: '0.15em', marginBottom: '4px' }}>Scrubbing Pipeline Active</p>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>Cross-referencing {counts.total.toLocaleString()} records...</p>
                </div>
              </div>
            )}
          </motion.section>

          {/* STEP 5: VERIFIED RESULTS TERMINAL */}
          < AnimatePresence >
            {
              cleanedMsisdns.length > 0 && (
                <motion.section
                  className="glass-panel sequential-step"
                  style={{
                    padding: '10px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.03)',
                    border: '1px solid var(--glass-border)',
                    width: '100%',
                    minHeight: '300px',
                    display: 'flex',
                    flexDirection: 'column',
                    margin: '0 auto 40px auto'
                  }}
                  initial={{ opacity: 0, height: 0, marginTop: -40 }}
                  animate={{ opacity: 1, height: 'auto', marginTop: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="step-badge"><Layout size={20} /></div>
                  <h2 className="panel-title">
                    <span className="accent-line" style={{ background: 'var(--accent-emerald)' }}></span>
                    Step 5: Verified Results Output
                    <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Real-time Terminal View</span>
                  </h2>
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex items-center gap-2">
                      <div className="animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent-emerald)' }}></div>
                      <span style={{ fontSize: '0.688rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)' }}>Live Session MSISDN Feed</span>
                    </div>
                    <button
                      className="glass-pill transition-all"
                      style={{ fontSize: '0.688rem', fontWeight: '700', color: 'var(--accent-emerald)' }}
                      onClick={() => {
                        navigator.clipboard.writeText(cleanedMsisdns.join('\n'));
                        alert('Copied to clipboard!');
                      }}
                    >
                      <Copy size={12} style={{ display: 'inline', marginRight: '8px' }} />
                      COPY ALL TO CLIPBOARD
                    </button>
                  </div>
                  <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: '20px', border: '1px solid var(--glass-border)', padding: '24px', height: '220px', overflowY: 'auto' }}>
                    <pre style={{ fontSize: '0.85rem', color: 'var(--accent-emerald)', fontFamily: 'JetBrains Mono, monospace', lineHeight: '1.6' }}>{cleanedMsisdns.join('\n')}</pre>
                  </div>
                </motion.section>
              )
            }
          </AnimatePresence >

          {/* STEP 6: AI CAMPAIGN STUDIO */}
          <motion.section
            className="glass-panel sequential-step"
            style={{
              padding: '40px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.03)',
              border: '1px solid var(--glass-border)',
              width: '100%',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              margin: '0 auto 40px auto'
            }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <div className="step-badge"><Wand2 size={20} /></div>
            <h2 className="panel-title">
              <span className="accent-line" style={{ background: 'var(--accent-rose)' }}></span>
              Step 6: AI Campaign Studio
              <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Content & Flow Engineering</span>
            </h2>

            <div className="flex gap-4 mb-8">
              <button
                onClick={() => { setStudioMode('strategy'); setFlowError(''); }}
                className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all border-2 ${studioMode === 'strategy' ? 'bg-rose-500 text-white border-rose-400 shadow-[0_4px_25px_rgba(244,63,94,0.4)] scale-105' : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:bg-slate-700/50 hover:text-slate-300'}`}
              >
                AI Strategy
              </button>
              <button
                onClick={() => { setStudioMode('xml'); setFlowError(''); }}
                className={`px-8 py-3 rounded-2xl text-[11px] font-black uppercase tracking-[0.2em] transition-all border-2 ${studioMode === 'xml' ? 'bg-cyan-500 text-white border-emerald-400 shadow-[0_4px_25px_rgba(34,211,238,0.4)] scale-105' : 'bg-slate-800/50 text-slate-500 border-slate-700 hover:bg-slate-700/50 hover:text-slate-300'}`}
              >
                XML Blueprint
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="flex flex-col gap-6">
                <div className="form-group" style={{ marginBottom: 0 }}>
                  {studioMode === 'strategy' ? (
                    <>
                      <label className="label flex items-center gap-2" style={{ fontSize: '0.7rem' }}><BarChart3 size={12} /> AI Strategy & Goals</label>
                      <textarea
                        className="input-field"
                        rows="8"
                        style={{ fontSize: '0.8rem', padding: '16px' }}
                        placeholder="e.g. Create a holiday promotion for prepaid users..."
                        value={docText}
                        onChange={(e) => setDocText(e.target.value)}
                      />
                    </>
                  ) : (
                    <>
                      <label className="label flex items-center gap-2" style={{ fontSize: '0.7rem' }}><Database size={12} /> XML Blueprint</label>
                      <textarea
                        className="input-field font-mono text-[10px]"
                        rows="8"
                        style={{ lineHeight: '1.5', padding: '16px' }}
                        placeholder='<campaign name="Loyalty Program">...'
                        value={xmlContent}
                        onChange={(e) => setXmlContent(e.target.value)}
                      />
                    </>
                  )}

                  <button className="btn-primary w-full mt-4" style={{ background: 'var(--accent-rose)', padding: '14px', fontSize: '0.75rem' }} onClick={generateFlowFromDoc} disabled={flowLoading}>
                    <Wand2 size={14} className="mr-2 inline" />
                    {flowLoading ? 'ENGINEERING...' : (studioMode === 'xml' ? 'GENERATE FROM XML' : 'GENERATE AI PROMPT')}
                  </button>
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <label className="label flex items-center gap-2 m-0" style={{ fontSize: '0.7rem' }}><Layout size={12} /> Visualization</label>
                  {mermaidFlow && (
                    <button
                      onClick={downloadFlowPdf}
                      disabled={pdfLoading}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all shadow-md disabled:opacity-50"
                    >
                      {pdfLoading ? <Activity size={12} className="animate-spin" /> : <Download size={12} />}
                      PDF
                    </button>
                  )}
                </div>
                <div style={{ background: '#020617', borderRadius: '24px', border: '1px solid #1e293b', padding: '10px', minHeight: '360px', flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' }}>
                  {(!reactFlowData.nodes || reactFlowData.nodes.length === 0) && (
                    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-slate-500">
                      <Activity size={32} strokeWidth={1} className="opacity-20 animate-pulse" />
                      <span className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40">Awaiting Input...</span>
                    </div>
                  )}
                  {reactFlowData.nodes && reactFlowData.nodes.length > 0 && (
                    <CampaignFlowVisualizer
                      nodes={reactFlowData.nodes}
                      edges={reactFlowData.edges}
                    />
                  )}
                </div>
              </div>
            </div>
          </motion.section >

          {/* STEP 7: VOIP COMMUNICATION CENTER */}
          <motion.section
            className="glass-panel sequential-step"
            style={{
              padding: '40px',
              boxShadow: '0 12px 40px rgba(0,0,0,0.03)',
              border: '1px solid var(--glass-border)',
              width: '100%',
              minHeight: '200px',
              display: 'flex',
              flexDirection: 'column',
              margin: '0 auto 40px auto'
            }}
            variants={{
              hidden: { opacity: 0, y: 20 },
              visible: { opacity: 1, y: 0 }
            }}
          >
            <div className="step-badge"><Smartphone size={20} /></div>
            <h2 className="panel-title">
              <span className="accent-line" style={{ background: 'var(--accent-cyan)' }}></span>
              Step 7: Global VOIP Dialer
              <span className="text-ghost" style={{ marginLeft: 'auto', fontSize: '0.75rem' }}>Multi-Carrier Routing (Airtel, Jio, MTN, etc.)</span>
            </h2>
            <div className="flex justify-center mb-6">
              <span style={{ padding: '4px 12px', borderRadius: '9999px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', color: 'var(--accent-emerald)', fontSize: '0.688rem', fontWeight: '900', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                ⚡ LIVE TELECOM INTEGRATION ACTIVE
              </span>
            </div>
            <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full">
              <p style={{ fontSize: '0.75rem', color: 'var(--text-dim)', textAlign: 'center', marginBottom: '16px' }}>Trigger manual test calls or high-priority alerts directly via the integrated VOIP shortcode platform.</p>

              <form onSubmit={handleVoipCall} className="flex flex-col gap-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label style={{ fontSize: '0.688rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', paddingLeft: '8px' }}>Target MSISDN (Global Format)</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. +91 99XXXXXXX"
                      value={voipMsisdn}
                      onChange={(e) => setVoipMsisdn(e.target.value)}
                      style={{ background: 'var(--bg-glass-heavy)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <label style={{ fontSize: '0.688rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', paddingLeft: '8px' }}>Caller Shortcode</label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 5566"
                      value={voipShortcode}
                      onChange={(e) => setVoipShortcode(e.target.value)}
                      style={{ background: 'var(--bg-glass-heavy)', border: '1px solid var(--glass-border)' }}
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <label style={{ fontSize: '0.688rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-dim)', paddingLeft: '8px' }}>Campaign Script (AI Voice)</label>
                  <textarea
                    className="input-field min-h-[80px] py-3 text-xs"
                    placeholder="What should the AI say to the customer?"
                    value={voipScript}
                    onChange={(e) => setVoipScript(e.target.value)}
                    style={{ background: 'var(--bg-glass-heavy)', border: '1px solid var(--glass-border)' }}
                  />
                </div>

                <button
                  type="submit"
                  className="btn-primary w-full shadow-2xl transition-all hover:scale-[1.02]"
                  style={{ background: 'linear-gradient(135deg, var(--accent-cyan) 0%, var(--accent-blue) 100%)', height: '54px' }}
                  disabled={voipLoading || !voipMsisdn}
                >
                  {voipLoading ? (
                    <Activity className="animate-spin mr-2 inline" size={18} />
                  ) : (
                    <Zap size={18} className="mr-2 inline" />
                  )}
                  {voipLoading ? 'CONNECTING VOIP...' : 'TRIGGER VOIP CALL NOW'}
                </button>
              </form>

              <AnimatePresence>
                {voipResult && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl border flex items-center gap-4 ${voipResult.success ? 'bg-emerald-400/10 border-emerald-400/20 text-emerald-400' : 'bg-rose-400/10 border-rose-400/20 text-rose-400'}`}
                  >
                    {voipResult.success ? <CheckCircle2 size={20} /> : <XCircle size={20} />}
                    <div className="flex flex-col">
                      <span className="text-[10px] font-black uppercase tracking-widest">{voipResult.success ? 'Call Initiated' : 'Call Failed'}</span>
                      <span className="text-xs font-bold">{voipResult.message}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </motion.section >

          {/* Performance Overview */}
          < motion.section
            style={{ gridColumn: '1 / -1', marginTop: '60px' }}
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1 }
            }}
          >
            <PerformanceReport />
          </motion.section >
        </motion.div >

        {/* HISTORY MODAL OVERLAY */}
        {
          isHistoryModalOpen && (
            <div className="modal-overlay" onClick={() => setIsHistoryModalOpen(false)}>
              <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                  <h2 className="modal-title">Scrub History Log</h2>
                  <p className="text-xs text-slate-400 mt-2">Past verified results execution logs</p>
                </div>

                <div className="p-4 overflow-x-auto" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                  {historyLoading ? (
                    <div className="flex justify-center p-10"><Activity className="animate-pulse text-emerald-400" /></div>
                  ) : historyData.length === 0 ? (
                    <div className="text-center p-10 text-slate-500 text-sm">No history found.</div>
                  ) : (
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-slate-700/50">
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-widest min-w-[150px]">Date</th>
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Input</th>
                          <th className="p-3 text-xs font-bold text-emerald-400 uppercase tracking-widest text-right">Final</th>
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-widest text-right">Filtered</th>
                          <th className="p-3 text-xs font-bold text-slate-400 uppercase tracking-widest pl-6">Results Table</th>
                        </tr>
                      </thead>
                      <tbody>
                        {historyData.map((row) => {
                          const date = new Date(row.logged_at).toLocaleString();
                          const filtered = row.dnd_removed + row.sub_removed + row.unsub_removed + row.operator_removed;
                          return (
                            <tr key={row.id} className="border-b border-slate-800/50 hover:bg-white-5 transition-colors">
                              <td className="p-3 text-xs text-slate-300">{date}</td>
                              <td className="p-3 text-xs text-slate-300 text-right">{row.total_input.toLocaleString()}</td>
                              <td className="p-3 text-xs font-bold text-emerald-400 text-right">{row.final_count.toLocaleString()}</td>
                              <td className="p-3 text-xs text-rose-400 text-right">-{filtered.toLocaleString()}</td>
                              <td className="p-3 text-xs text-emerald-400 font-mono pl-6" style={{ fontSize: '0.65rem' }}>{row.results_table || 'N/A'}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                </div>

                <div className="modal-footer">
                  <button className="btn-secondary" onClick={() => setIsHistoryModalOpen(false)}>Close</button>
                </div>
              </div>
            </div>
          )
        }

        {/* MODAL OVERLAY */}
        {
          isScheduleModalOpen && (
            <div className="modal-overlay overflow-y-auto py-10" onClick={() => setIsScheduleModalOpen(false)}>
              <div className="modal-content !max-w-[700px]" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header border-b border-white-5 pb-6 mb-8">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                      <Calendar size={24} />
                    </div>
                    <div>
                      <h2 className="modal-title !text-2xl">Configuration Studio</h2>
                      <p className="text-xs text-slate-500 tracking-wider uppercase font-bold">Campaign Scheduling & MSC Routing</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 px-2">
                  <div className="form-group">
                    <label className="label flex items-center gap-2 mb-3">
                      <Layout size={14} className="text-emerald-400" />
                      OBD Project Identifier
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. Summer_Campaign_V1"
                      value={scheduleData.obd_name}
                      onChange={(e) => setScheduleData({ ...scheduleData, obd_name: e.target.value })}
                    />
                    <p className="text-[9px] text-slate-600 mt-2 px-1 uppercase tracking-tighter">Unique namespace for reporting</p>
                  </div>

                  <div className="form-group">
                    <label className="label flex items-center gap-2 mb-3">
                      <Zap size={14} className="text-amber-400" />
                      Voice/Flow Logic selection
                    </label>
                    <div className="relative">
                      <select
                        className="input-field pr-10 appearance-none"
                        value={scheduleData.flow_name}
                        onChange={(e) => setScheduleData({ ...scheduleData, flow_name: e.target.value })}
                      >
                        <option value="" disabled>Select execution logic...</option>
                        <option value="Promo Flow 1">Standard Promotion Engine</option>
                        <option value="Holiday Special">Holiday Multi-tier Logic</option>
                        {mermaidFlow && <option value="AI Generated Flow">AI Generated Scrubber Flow</option>}
                      </select>
                      <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500 line-height-1">
                        <ChevronRight size={16} className="rotate-90" />
                      </div>
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="label flex items-center gap-2 mb-3">
                      <Activity size={14} className="text-emerald-400" />
                      MSC Connection IP Path
                    </label>
                    <input
                      type="text"
                      className="input-field font-mono"
                      placeholder="10.200.XXX.XXX"
                      value={scheduleData.msc_ip}
                      onChange={(e) => setScheduleData({ ...scheduleData, msc_ip: e.target.value })}
                    />
                  </div>

                  <div className="form-group">
                    <label className="label flex items-center gap-2 mb-3">
                      <Info size={14} className="text-purple-400" />
                      CLI Masking / Caller ID
                    </label>
                    <input
                      type="text"
                      className="input-field"
                      placeholder="e.g. 556677"
                      value={scheduleData.cli}
                      onChange={(e) => setScheduleData({ ...scheduleData, cli: e.target.value })}
                    />
                  </div>
                </div>

                <div className="flex gap-4 mt-12 pt-8 border-t border-white-5">
                  <button
                    className="btn-secondary flex-1 py-4 font-bold tracking-widest text-xs uppercase"
                    onClick={() => setIsScheduleModalOpen(false)}
                  >
                    Discard Configuration
                  </button>
                  <button
                    className="btn-primary !bg-emerald-500 hover:!bg-emerald-400 shadow-emerald-500/20 flex-[2] py-4 rounded-2xl font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-3 transition-all active:scale-95"
                    onClick={async () => {
                      if (isLaunching) return;
                      setIsLaunching(true);
                      setSuccessMsg('');
                      try {
                        // 1. Save Scheduling Details FIRST
                        const schedRes = await fetch(`${API_BASE}/schedule-promotion`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify(scheduleData)
                        });

                        if (!schedRes.ok) {
                          const err = await schedRes.json();
                          alert(`Scheduling Failed: ${err.detail}`);
                          setIsLaunching(false);
                          return;
                        }

                        // 2. Trigger Launch
                        const launchRes = await fetch(`${API_BASE}/launch-campaign`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            msisdn_list: cleanedMsisdns,
                            project_name: scheduleData.obd_name
                          })
                        });

                        if (launchRes.ok) {
                          const data = await launchRes.json();
                          setSuccessMsg(`CAMPAIGN LIVE! 🚀`);
                          setIsLaunching(false);

                          // Close modal and clear success message after a brief delay
                          setTimeout(() => {
                            setIsScheduleModalOpen(false);
                            setSuccessMsg('');
                            // Show a final browser alert for confirmation
                            alert("Campaign Scheduled & Targets Exported Successfully!");
                          }, 1500);
                        } else {
                          const err = await launchRes.json();
                          alert(`Launch Failed: ${err.detail || 'Internal Server Error'}`);
                          setIsLaunching(false);
                        }
                      } catch (err) {
                        alert(`Network Error: ${err.message}`);
                        setIsLaunching(false);
                      }
                    }}
                  >
                    <Zap size={16} fill="white" className={isLaunching ? "animate-spin" : ""} />
                    {isLaunching ? "Launching..." : successMsg || "Initialize & Launch Campaign"}
                  </button >
                </div >
              </div >
            </div >
          )
        }
        {/* VIRTUAL IVR SIMULATOR MODAL */}
        <AnimatePresence>
          {activeVirtualCall && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 100 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 100 }}
              style={{
                position: 'fixed',
                bottom: '40px',
                right: '40px',
                width: '320px',
                background: 'var(--bg-glass-heavy)',
                backdropFilter: 'blur(40px)',
                border: '2px solid var(--accent-cyan)',
                borderRadius: '32px',
                padding: '32px',
                zIndex: 2000,
                boxShadow: '0 20px 60px rgba(0,0,0,0.8), 0 0 30px rgba(34,211,238,0.2)'
              }}
            >
              <div className="flex flex-col items-center gap-6">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-emerald-400/20 flex items-center justify-center text-emerald-400 animate-pulse">
                    <Phone size={40} />
                  </div>
                  <div className="absolute inset-0 rounded-full border-2 border-emerald-400 animate-ping" />
                </div>

                <div className="text-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-400">Incoming Virtual Call</span>
                  <h3 className="text-xl font-bold mt-1">{activeVirtualCall.msisdn}</h3>
                  <p className="text-[10px] text-slate-500 uppercase tracking-widest mt-1">Shortcode: {activeVirtualCall.shortcode}</p>
                </div>

                {activeVirtualCall.status === 'ringing' ? (
                  <div className="flex gap-4 w-full">
                    <button
                      onClick={() => handleVirtualRespond('hangup')}
                      className="flex-1 h-14 rounded-2xl bg-rose-500/20 border border-rose-500/40 text-rose-400 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                    >
                      <X size={24} />
                    </button>
                    <button
                      onClick={() => handleVirtualRespond('answered')}
                      className="flex-1 h-14 rounded-2xl bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 hover:bg-emerald-500 hover:text-white transition-all flex items-center justify-center animate-bounce"
                    >
                      <PhoneOutgoing size={24} />
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-6 w-full">
                    <div className="p-4 rounded-2xl bg-white-5 border border-white-10 text-[11px] font-medium leading-relaxed italic text-slate-300">
                      "{activeVirtualCall.script}"
                    </div>
                    <div className="grid grid-cols-3 gap-2 w-full">
                      {[1, 2, 3, 4, 5, 6, 7, 8, 9, '*', 0, '#'].map(key => (
                        <button
                          key={key}
                          className="h-10 rounded-lg bg-white-5 hover:bg-emerald-400/20 transition-all font-mono text-xs text-slate-400"
                          onClick={() => console.log(`DTMF: ${key}`)}
                        >
                          {key}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={() => handleVirtualRespond('hangup')}
                      className="w-full h-12 rounded-xl bg-rose-500 text-white font-bold uppercase tracking-widest text-[10px]"
                    >
                      End Simulation
                    </button>
                  </div>
                )}
              </div>
            </motion.div>
          )}
      </AnimatePresence>
    </div>
  );
}
