"use client";
import React, { useState, useEffect } from 'react';
import PerformanceReport from '@/components/PerformanceReport';
import MermaidViewer from '@/components/MermaidViewer';
import FileUploadZone from '@/components/FileUploadZone';
import SCPFlowDiagram from '@/components/SCPFlowDiagram';
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
  Mic,
  Clock,
  Server,
  Hash,
  Repeat,
  Star,
  AlertTriangle,
  Layers
} from 'lucide-react';
const getApiBase = () => {
  if (typeof window === 'undefined') return 'http://localhost:8000';
  const { hostname, port } = window.location;

  // If on port 8000 (standard production) or empty port (tunnels/localtunnel), use relative paths
  if (port === '8000' || port === '' || port === '443') return '';

  // On localhost dev mode? Use port 8000
  if (hostname === 'localhost' || hostname === '127.0.0.1') return 'http://localhost:8000';

  // Others (Network IPs)? Use current host on 8000
  return `http://${hostname}:8000`;
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
  const [xmlExplanation, setXmlExplanation] = useState('');
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
    cli: '',
    service_id: '',
    jobname: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    priority: '1',
    status: 'Active',
    blackout_hours: '0',
    max_retry: '1',
    remaining_retry: '1',
    starcopy: '0',
    recorddedication: '1',
    server_ip: '',
    max_obd_count: '',
    daywise: '0'
  });

  // VOIP State
  const [voipMsisdn, setVoipMsisdn] = useState('');
  const [voipShortcode, setVoipShortcode] = useState('5566');
  const [voipScript, setVoipScript] = useState('Hello, this is a test call from the Mobicom Global OBD platform. Have a great day!');
  const [voipLoading, setVoipLoading] = useState(false);
  const [voipResult, setVoipResult] = useState(null);
  const [activeVirtualCall, setActiveVirtualCall] = useState(null);
  const [publicUrl, setPublicUrl] = useState(null);

  // Force Light Theme for Visibility
  const [theme, setTheme] = useState('light');
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
    const saved = localStorage.getItem('obd-theme') || 'dark';
    setTheme(saved);
    document.documentElement.setAttribute('data-theme', saved);
  }, []);

  const themes = ['dark', 'light', 'midnight'];

  const handleVocalSyncClick = () => {
    setCurrentView('vocalsync');
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
      console.log(`POLLING JOB: ${jobId}...`);
      const res = await fetch(`${API_BASE}/scrub-job/${jobId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders()
        }
      });
      if (!res.ok) {
        console.error(`POLLING FAILED for job ${jobId}`);
        return;
      }
      const data = await res.json();
      const job = data.job;
      setScrubJobs(prev => {
        const others = prev.filter(j => j.id !== job.id);
        return [job, ...others].slice(0, 20);
      });
      // Update live counts and session stats from job metadata
      if (job.dnd_removed !== undefined) {
        setSessionStats(prev => ({
          ...prev,
          dnd: job.dnd_removed || 0,
          sub: job.sub_removed || 0,
          unsub: job.unsub_removed || 0,
          operator: job.operator_removed || 0
        }));
      }

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
              console.log(`FETCHED ${resultsData.msisdns?.length} CLEAN RECORDS.`);
              setCleanedMsisdns(resultsData.msisdns || []);
            }
          } catch (e) {
            console.error("Failed to fetch scrub results content", e);
          }
        }
      }
      return data.job;
    } catch (err) {
      console.error('Failed to poll job status', err);
      return null;
    }
  };

  const performScrub = async (listToScrub) => {
    const targetList = listToScrub || msisdnList;
    if (!targetList.length) return;

    setLoading(true);
    setCleanedMsisdns([]); // Clear previous results immediately
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
          const updatedJob = await pollJobStatus(data.job_id);
          if (updatedJob && (updatedJob.status === 'COMPLETED' || updatedJob.status === 'FAILED')) {
            clearInterval(pollInterval);
          }
        }, 500);
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

      // If XML, also get explanation
      if (studioMode === 'xml') {
        const expRes = await fetch(`${API_BASE}/generate-flow-explanation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ xml_content: xmlContent }),
        });
        if (expRes.ok) {
          const expData = await expRes.json();
          setXmlExplanation(expData.explanation);
        }
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

  const stopAllCalls = async () => {
    try {
      const res = await fetch(`${API_BASE}/voip/stop-calls`, {
        method: 'POST',
        headers: getAuthHeaders()
      });
      const data = await res.json();
      alert(data.message || "All virtual sessions stopped.");
    } catch (err) {
      console.error(err);
      alert("Failed to stop calls.");
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
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          background: '#f8fafc', // Clean minimalist light grey background
          fontFamily: "'Inter', sans-serif",
          fontSize: '18px',
          overflow: 'auto',
          zIndex: 9999,
          color: '#1e293b'
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10 w-full px-4"
          style={{ maxWidth: '440px' }}
        >
          <div style={{
            background: 'white',
            borderRadius: '24px',
            border: '1px solid #e2e8f0',
            boxShadow: '0 25px 50px -12px rgba(0,0,0,0.08)',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '48px 40px 32px', textAlign: 'center' }}>
              {/* Branded Logo */}
              <div style={{ marginBottom: '24px' }}>
                <img
                  src="/logo.png"
                  alt="blackNgreen"
                  style={{ height: '70px', margin: '0 auto', display: 'block' }}
                />
              </div>

              <h1 style={{
                fontSize: '1.8rem',
                fontWeight: '800',
                margin: '0 0 8px 0',
                color: '#0f172a',
                letterSpacing: '-0.025em'
              }}>
                {isCreatingUser ? 'Create Account' : 'Welcome Back'}
              </h1>

              <p style={{
                fontSize: '1rem',
                color: '#64748b',
                margin: 0,
                lineHeight: 1.5,
                fontWeight: '400'
              }}>
                Sign in to manage your OBD promotions.
              </p>
            </div>

            <div style={{ padding: '0 40px 48px' }}>
              <form onSubmit={isCreatingUser ? handleCreateUser : handleLogin} className="flex flex-col gap-5">
                <div className="flex flex-col gap-4">
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <User size={18} />
                    </div>
                    <input
                      type="text"
                      className="w-full pl-12 pr-4 py-4 rounded-xl"
                      style={{
                        border: '1px solid #cbd5e1',
                        fontSize: '1rem',
                        background: '#f1f5f9',
                        color: '#0f172a',
                        outline: 'none',
                        transition: 'all 0.2s ease',
                      }}
                      placeholder="Username / Email"
                      value={loginCreds.username}
                      onChange={(e) => setLoginCreds({ ...loginCreds, username: e.target.value })}
                      required
                    />
                  </div>

                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-400">
                      <Lock size={18} />
                    </div>
                    <input
                      type="password"
                      className="w-full pl-12 pr-4 py-4 rounded-xl"
                      style={{
                        border: '1px solid #cbd5e1',
                        fontSize: '1rem',
                        background: '#f1f5f9',
                        color: '#0f172a',
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

                {successMsg && (
                  <div style={{ background: '#ecfdf5', border: '1px solid #10b981', color: '#065f46', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', textAlign: 'center' }}>
                    {successMsg}
                  </div>
                )}

                {loginError && (
                  <div style={{ background: '#fff1f2', border: '1px solid #f43f5e', color: '#9f1239', padding: '12px', borderRadius: '12px', fontSize: '0.9rem', textAlign: 'center' }}>
                    {loginError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-4 mt-2 rounded-xl transition-all font-bold shadow-lg active:scale-[0.98]"
                  style={{
                    background: '#0ea5e9', // Branded primary color
                    color: 'white',
                    opacity: isLoggingIn ? 0.7 : 1,
                    cursor: isLoggingIn ? 'not-allowed' : 'pointer',
                    fontSize: '1.1rem'
                  }}
                >
                  {isLoggingIn ? 'Authenticating...' : (isCreatingUser ? 'Create Account' : 'Sign In')}
                </button>

                <div className="text-center mt-2">
                  <span
                    onClick={() => {
                      setIsCreatingUser(!isCreatingUser);
                      setLoginError('');
                      setSuccessMsg('');
                    }}
                    style={{ fontSize: '0.9rem', color: '#64748b', cursor: 'pointer', fontWeight: '500' }}
                    className="hover:text-blue-600 underline"
                  >
                    {isCreatingUser ? 'Already have an account?' : 'Need an account? Contact Admin'}
                  </span>
                </div>
              </form>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  // --- REUSABLE MODULE CARD ---
  // --- REUSABLE MODULE CARD ---
  function ModuleCard({ icon, title, desc, accent, onClick, disabled }) {
    return (
      <motion.div
        whileHover={!disabled ? { y: -12, scale: 1.02, boxShadow: `0 40px 100px -12px ${accent}33` } : {}}
        whileTap={!disabled ? { scale: 0.98 } : {}}
        onClick={!disabled ? onClick : undefined}
        className={`flex flex-col items-center text-center transition-all relative overflow-hidden group ${disabled ? 'opacity-30 grayscale cursor-not-allowed' : 'cursor-pointer'}`}
        style={{
          borderRadius: '48px',
          background: 'var(--bg-glass-heavy)',
          border: '1px solid var(--glass-border)',
          backdropFilter: 'blur(40px)',
          boxShadow: '0 20px 80px rgba(0,0,0,0.1)',
          width: '300px',
          height: '300px',
          minHeight: '300px',
          padding: '48px 40px',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0
        }}
      >
        {/* Animated Corner Accents */}
        <div className="absolute top-0 left-0 w-full h-full opacity-0 group-hover:opacity-100 transition-opacity duration-1000"
          style={{ background: `radial-gradient(circle at 50% 0%, ${accent}11, transparent 70%)` }} />

        <div className="flex flex-col items-center w-full">
          <div
            className="w-16 h-16 rounded-[24px] flex items-center justify-center mb-10 transition-all duration-500 relative group-hover:shadow-[0_0_40px_-5px_var(--accent-cyan)]"
            style={{
              background: `rgba(255, 255, 255, 0.03)`,
              color: accent,
              border: `1px solid ${accent}33`,
            }}
          >
            <div className="relative z-10 scale-100 group-hover:scale-110 transition-transform duration-500">
              {React.cloneElement(icon, { size: 28 })}
            </div>
          </div>

          <h3 className="text-xl font-black uppercase tracking-[0.25em] mb-4" style={{
            color: 'var(--text-main)',
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))'
          }}>{title}</h3>

          <p className="text-[13px] font-medium leading-relaxed opacity-40 group-hover:opacity-80 transition-opacity">
            {desc}
          </p>
        </div>

        <div className="w-full">
          {!disabled && (
            <div className="py-4 px-8 rounded-2xl border border-white-10 text-[11px] font-black uppercase tracking-[0.3em] flex items-center justify-center gap-4 group-hover:bg-white-5 group-hover:border-emerald-500/30 group-hover:text-emerald-400 transition-all shadow-xl">
              Enter Studio <ChevronRight size={16} className="group-hover:translate-x-2 transition-transform" />
            </div>
          )}

          {disabled && (
            <div className="py-3 px-8 rounded-2xl bg-white-5 border border-white-5 text-[10px] font-black uppercase tracking-[0.2em] opacity-40 flex items-center justify-center">
              Not started
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // REUSABLE MENU OPTION
  function MenuOption({ icon, title, desc, color, onClick }) {
    return (
      <motion.div
        whileHover={{ x: 6, background: 'rgba(255,255,255,0.03)' }}
        onClick={() => {
          setIsMenuOpen(false);
          onClick();
        }}
        className="flex items-center gap-4 p-4 rounded-2xl cursor-pointer group transition-all"
      >
        <div className="w-10 h-10 rounded-xl flex items-center justify-center transition-all group-hover:scale-110" style={{ background: 'rgba(255,255,255,0.05)', color: color }}>
          {React.cloneElement(icon, { size: 20 })}
        </div>
        <div className="flex flex-col">
          <span className="text-xs font-black uppercase tracking-widest">{title}</span>
          <span className="text-[8px] opacity-40 font-bold uppercase tracking-wider mt-0.5">{desc}</span>
        </div>
      </motion.div>
    );
  }

  // GLOBAL SIDEBAR COMPONENT
  const GlobalSidebar = () => {
    if (!isMenuOpen) return null;
    return (
      <div className="fixed inset-0 z-[100] flex">
        <div
          onClick={() => setIsMenuOpen(false)}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />
        <div
          className="relative h-full glass-panel flex flex-col"
          style={{
            width: 'min(280px, 80vw)',
            borderRadius: '0 24px 24px 0',
            padding: '32px 0',
            borderLeft: 'none',
            boxShadow: '20px 0 80px rgba(0,0,0,0.3)',
            zIndex: 101,
          }}
        >
          <div className="px-8 mb-8 flex justify-between items-center border-b border-white-5 pb-6">
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.3em] text-emerald-400 mb-1">Command Center</span>
              <h2 className="text-lg font-black tracking-wider uppercase">System Menu</h2>
            </div>
            <button onClick={() => setIsMenuOpen(false)} className="w-10 h-10 rounded-xl bg-white-5 flex items-center justify-center hover:bg-white-10 text-white-40 transition-all">
              <X size={18} />
            </button>
          </div>
          <div className="flex flex-col gap-2 px-3">
            <MenuOption icon={<Layout />} title="Modules Hub" desc="System Overview" color="var(--accent-cyan)" onClick={() => setCurrentView('landing')} />
            <MenuOption icon={<Database />} title="Scrubber" desc="Data Sanitation" color="var(--accent-blue)" onClick={() => setCurrentView('dashboard')} />
            <MenuOption icon={<History />} title="Scrub History" desc="Execution Logs" color="var(--accent-emerald)" onClick={() => setIsHistoryModalOpen(true)} />
            <MenuOption icon={<Activity />} title="System Activity" desc="Performance" color="var(--accent-purple)" onClick={() => { }} />
          </div>

          <div className="mt-4 px-6 pt-6 border-t border-white-5">
            <span className="text-[9px] font-black uppercase tracking-[0.2em] block mb-4 opacity-40">Themes</span>
            <div className="flex gap-2">
              {themes.map((t) => (
                <button
                  key={t}
                  onClick={() => {
                    setTheme(t);
                    localStorage.setItem('obd-theme', t);
                    document.documentElement.setAttribute('data-theme', t);
                  }}
                  className={`flex-1 h-10 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all ${theme === t
                    ? 'border-emerald-500/50 bg-emerald-500/10 text-emerald-400'
                    : 'border-white-5 bg-white-5 text-white/40 hover:text-white-60'
                    }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-auto px-8 py-8 border-t border-white-5">
            <button
              onClick={() => {
                handleLogout();
                setIsMenuOpen(false);
              }}
              className="w-full py-4 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-rose-500 font-bold uppercase tracking-widest text-xs hover:bg-rose-500 hover:text-white transition-all"
            >
              <LogOut size={16} className="inline mr-2" /> LOGOUT
            </button>
          </div>
        </div>
      </div>
    );
  };

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
        <div className="flex justify-between items-center z-50 w-full" style={{ position: 'absolute', top: 0, left: 0, right: 0, padding: '40px 80px' }}>
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
              <LogOut size={14} /> LOGOUT
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
          <div className="flex flex-col items-center text-center mb-12">
            <h1 className="font-black tracking-[0.5em] uppercase leading-none" style={{
              fontSize: '3rem',
              margin: 0,
              color: 'var(--text-main)',
              filter: 'drop-shadow(0 0 30px rgba(16, 185, 129, 0.15))',
            }}>
              BLACK N <span style={{
                color: '#00f5a0',
                textShadow: '0 0 50px rgba(0, 245, 160, 0.3)'
              }}>GREEN</span>
            </h1>
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.3em] opacity-40">Cognitive Orchestration Suite</p>
          </div>

          {/* Module Grid Row - Perfectly Symmetrical Grid */}
          <div className="flex flex-row flex-nowrap items-stretch justify-center gap-10 px-24 w-full max-w-[1600px] overflow-x-auto pb-24 custom-scrollbar no-scrollbar-at-full">
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
              title="Flow Diagram"
              desc="SCP IVR flow visualization with deep node inspection & parameter extraction."
              accent="var(--accent-emerald)"
              onClick={() => setCurrentView('flowdiagram')}
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
        <GlobalSidebar />
      </div>
    );
  }

  if (currentView === 'vocalsync') {
    const token = typeof window !== 'undefined' ? localStorage.getItem('obd_token') : '';
    const src = `http://localhost:3001?theme=${theme}${token ? `&token=${token}` : ''}`;

    return (
      <div className="dashboard-container relative" data-theme={theme} style={{ padding: 0, height: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg-main)' }}>
        {/* Top App Bar */}
        <div
          className="z-[60] w-full"
          style={{
            background: 'transparent',
            backdropFilter: 'blur(30px)',
            borderBottom: '1px solid var(--glass-border)',
            width: '100%',
          }}
        >
          <div className="flex items-center justify-between w-full px-24 py-8">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-6">
                <button
                  onClick={() => setCurrentView('landing')}
                  className="w-14 h-5 rounded-3xl glass-action flex items-center justify-center hover:scale-110 transition-all shadow-2xl relative group overflow-hidden"
                  style={{ background: 'var(--accent-purple)', border: '2px solid rgba(255,255,255,0.2)' }}
                  aria-label="Back to System Navigator"
                >
                  <Menu size={16} className="text-black" strokeWidth={2.5} />
                </button>
                <div className="flex flex-col">
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-black tracking-tighter" style={{ color: 'var(--text-main)' }}>VOCAL SYNC AI</h1>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-black tracking-widest bg-purple-500/20 text-purple-400 border border-purple-500/30">PRO HUB</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                    <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Neural Synthesis Pipeline Active</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Embedded Application */}
        <div style={{ flex: 1, position: 'relative', width: '100%', overflow: 'hidden' }}>
          <iframe
            src={src}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              background: 'transparent'
            }}
            title="Vocal Sync Core"
            allow="accelerometer; autoplay; camera; gyroscope; microphone; clipboard-read; clipboard-write;"
          />
        </div>
        <GlobalSidebar />
      </div>
    );
  }

  if (currentView === 'flowdiagram') {
    return (
      <div className="dashboard-container relative" data-theme={theme} style={{ padding: 0 }}>
        {/* Top App Bar */}
        <div
          className="sticky top-0 z-[60] w-full"
          style={{
            background: 'transparent',
            backdropFilter: 'blur(30px)',
            borderBottom: '1px solid var(--glass-border)',
            width: '100%',
          }}
        >
          <div className="flex items-center justify-between w-full px-24 py-8">
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
                  <span className="text-[16px] font-black uppercase tracking-wider">IVR Flow Diagram</span>
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

        {/* Flow Diagram Content */}
        <SCPFlowDiagram />
        <GlobalSidebar />
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
        <div className="flex items-center justify-between w-full px-24 py-8">
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

      <GlobalSidebar />


      <motion.div
        key="dashboard-flow"
        className="sequential-flow-container"
        initial="hidden"
        animate="visible"
        variants={{
          hidden: { opacity: 0 },
          visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
        }}
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(2, 1fr)',
          gap: '2.5rem',
          width: '100%',
          maxWidth: '1500px',
          margin: '0 auto',
          padding: '40px 60px 80px 60px'
        }}
      >
        {/* STEP 1: DATA INJECTION */}
        <motion.section
          className="glass-panel sequential-step"
          style={{
            padding: '32px 40px',
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
            padding: '32px 40px',
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
            padding: '32px 40px',
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
            padding: '32px 40px',
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
              disabled={loading || activeJobId}
            >
              {(loading || activeJobId) ? (
                <>
                  <div style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTop: '2px solid #fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  {activeJobId ? 'SCRUBBING IN PROGRESS...' : 'INITIALIZING PIPELINE...'}
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
                    <div className="flex items-center justify-between mb-2">
                      <label className="label flex items-center gap-2 m-0" style={{ fontSize: '0.7rem' }}><Database size={12} /> XML Blueprint</label>
                      <label className="cursor-pointer text-[10px] font-bold text-cyan-400 hover:text-cyan-300 transition-colors bg-cyan-400/10 px-3 py-1 rounded-lg border border-cyan-400/20">
                        <UploadCloud size={10} className="inline mr-1" /> UPLOAD XML
                        <input
                          type="file"
                          accept=".xml"
                          className="hidden"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (re) => setXmlContent(re.target.result);
                              reader.readAsText(file);
                            }
                          }}
                        />
                      </label>
                    </div>
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
                  <div className="flex-1 flex flex-col h-full overflow-hidden">
                    <div className="flex-1 min-h-[300px] border-b border-slate-800/50">
                      <CampaignFlowVisualizer
                        nodes={reactFlowData.nodes}
                        edges={reactFlowData.edges}
                      />
                    </div>
                    {xmlExplanation && (
                      <div className="p-6 bg-slate-900/50 overflow-y-auto max-h-[250px] scrollbar-hide">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-1 h-3 rounded bg-cyan-400" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-cyan-400">Flow Description (Plain English)</span>
                        </div>
                        <div className="prose prose-invert prose-xs max-w-none text-slate-300 leading-relaxed font-medium markdown-content" style={{ fontSize: '0.75rem', whiteSpace: 'pre-wrap' }}>
                          {xmlExplanation}
                        </div>
                      </div>
                    )}
                  </div>
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

              <div className="flex gap-4">
                <button
                  type="submit"
                  className="btn-primary flex-1 shadow-2xl transition-all hover:scale-[1.02]"
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

                <button
                  type="button"
                  onClick={stopAllCalls}
                  className="px-6 rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white transition-all font-bold text-[11px] uppercase tracking-widest flex items-center justify-center whitespace-nowrap shadow-lg"
                  title="Force stop all active sessions"
                >
                  Terminate All
                </button>
              </div>
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
          <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'fixed', inset: 0, zIndex: 10000 }} onClick={() => setIsScheduleModalOpen(false)}>
            <div className="modal-content" style={{ maxHeight: '90vh', overflowY: 'auto', display: 'block', width: '95%', maxWidth: '800px' }} onClick={(e) => e.stopPropagation()}>
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

              <div className="pr-2">

                {/* ── Section 1: Identity ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded bg-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">Identity & Routing</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2">
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Hash size={14} className="text-cyan-400" />
                        Service ID
                      </label>
                      <input type="number" className="input-field font-mono" placeholder="e.g. 1001"
                        value={scheduleData.service_id}
                        onChange={(e) => setScheduleData({ ...scheduleData, service_id: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Layout size={14} className="text-emerald-400" />
                        Job Name / OBD Name
                      </label>
                      <input type="text" className="input-field" placeholder="e.g. Summer_Campaign_V1"
                        value={scheduleData.obd_name}
                        onChange={(e) => setScheduleData({ ...scheduleData, obd_name: e.target.value, jobname: e.target.value })} />
                      <p className="text-[9px] text-slate-600 mt-1 px-1 uppercase tracking-tight">Unique namespace for reporting (max 25 chars)</p>
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Zap size={14} className="text-amber-400" />
                        Voice/Flow Logic
                      </label>
                      <div className="relative">
                        <select className="input-field pr-10 appearance-none"
                          value={scheduleData.flow_name}
                          onChange={(e) => setScheduleData({ ...scheduleData, flow_name: e.target.value })}>
                          <option value="" disabled>Select execution logic...</option>
                          <option value="Promo Flow 1">Standard Promotion Engine</option>
                          <option value="Holiday Special">Holiday Multi-tier Logic</option>
                          {mermaidFlow && <option value="AI Generated Flow">AI Generated Scrubber Flow</option>}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <ChevronRight size={16} className="rotate-90" />
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Info size={14} className="text-purple-400" />
                        CLI Masking / Caller ID
                      </label>
                      <input type="text" className="input-field" placeholder="e.g. 556677"
                        value={scheduleData.cli}
                        onChange={(e) => setScheduleData({ ...scheduleData, cli: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* ── Section 2: Schedule ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded bg-amber-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">Schedule & Timing</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2">
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Calendar size={14} className="text-emerald-400" />
                        Start Date
                      </label>
                      <input type="date" className="input-field font-mono"
                        value={scheduleData.start_date}
                        onChange={(e) => setScheduleData({ ...scheduleData, start_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Calendar size={14} className="text-rose-400" />
                        End Date
                      </label>
                      <input type="date" className="input-field font-mono"
                        value={scheduleData.end_date}
                        onChange={(e) => setScheduleData({ ...scheduleData, end_date: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-cyan-400" />
                        Start Time
                      </label>
                      <input type="time" className="input-field font-mono"
                        value={scheduleData.start_time}
                        onChange={(e) => setScheduleData({ ...scheduleData, start_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Clock size={14} className="text-rose-400" />
                        End Time
                      </label>
                      <input type="time" className="input-field font-mono"
                        value={scheduleData.end_time}
                        onChange={(e) => setScheduleData({ ...scheduleData, end_time: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <AlertTriangle size={14} className="text-amber-400" />
                        Blackout Hours
                      </label>
                      <input type="number" className="input-field font-mono" placeholder="0" min="0"
                        value={scheduleData.blackout_hours}
                        onChange={(e) => setScheduleData({ ...scheduleData, blackout_hours: e.target.value })} />
                      <p className="text-[9px] text-slate-600 mt-1 px-1 uppercase tracking-tight">Hours to skip dialling (e.g. night hours)</p>
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Layers size={14} className="text-purple-400" />
                        Day Wise
                      </label>
                      <div className="relative">
                        <select className="input-field pr-10 appearance-none font-mono"
                          value={scheduleData.daywise}
                          onChange={(e) => setScheduleData({ ...scheduleData, daywise: e.target.value })}>
                          <option value="0">0 — All Days</option>
                          <option value="1">1 — Weekdays Only</option>
                          <option value="2">2 — Weekends Only</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <ChevronRight size={16} className="rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* ── Section 3: Connection & Server ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded bg-cyan-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">Connection & Server</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 px-2">
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Activity size={14} className="text-emerald-400" />
                        MSC Connection IP Path
                      </label>
                      <input type="text" className="input-field font-mono" placeholder="10.200.XXX.XXX"
                        value={scheduleData.msc_ip}
                        onChange={(e) => setScheduleData({ ...scheduleData, msc_ip: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Server size={14} className="text-cyan-400" />
                        Server IP
                      </label>
                      <input type="text" className="input-field font-mono" placeholder="e.g. 192.168.1.100"
                        value={scheduleData.server_ip}
                        onChange={(e) => setScheduleData({ ...scheduleData, server_ip: e.target.value })} />
                    </div>
                  </div>
                </div>

                {/* ── Section 4: Execution Parameters ── */}
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded bg-purple-400" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">Execution Parameters</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6 px-2">
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <BarChart3 size={14} className="text-amber-400" />
                        Priority
                      </label>
                      <input type="number" className="input-field font-mono" placeholder="1" min="1" max="10"
                        value={scheduleData.priority}
                        onChange={(e) => setScheduleData({ ...scheduleData, priority: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <ShieldCheck size={14} className="text-emerald-400" />
                        Status
                      </label>
                      <div className="relative">
                        <select className="input-field pr-10 appearance-none"
                          value={scheduleData.status}
                          onChange={(e) => setScheduleData({ ...scheduleData, status: e.target.value })}>
                          <option value="Active">Active</option>
                          <option value="Paused">Paused</option>
                          <option value="Scheduled">Scheduled</option>
                          <option value="Completed">Completed</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <ChevronRight size={16} className="rotate-90" />
                        </div>
                      </div>
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2">
                        <Phone size={14} className="text-cyan-400" />
                        Max OBD Count
                      </label>
                      <input type="number" className="input-field font-mono" placeholder="e.g. 50000" min="0"
                        value={scheduleData.max_obd_count}
                        onChange={(e) => setScheduleData({ ...scheduleData, max_obd_count: e.target.value })} />
                      <p className="text-[9px] text-slate-600 mt-1 px-1 uppercase tracking-tight">Max concurrent OBD calls</p>
                    </div>
                  </div>
                </div>

                {/* ── Section 5: Retry & System (greyed out fields) ── */}
                <div className="mb-2">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-1 h-4 rounded bg-slate-500" />
                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Retry & System Defaults</span>
                    <span className="text-[8px] text-slate-600 ml-2 bg-slate-800 px-2 py-0.5 rounded">READ-ONLY</span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-6 px-2">
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2 opacity-50">
                        <Repeat size={14} className="text-slate-500" />
                        Max Retry
                      </label>
                      <input type="number" className="input-field font-mono !bg-slate-800/60 !text-slate-500 !border-slate-700/40 cursor-not-allowed"
                        value={scheduleData.max_retry} readOnly disabled />
                      <p className="text-[8px] text-slate-600 mt-1 px-1">System default · greyed out</p>
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2 opacity-50">
                        <Repeat size={14} className="text-slate-500" />
                        Remaining Retry
                      </label>
                      <input type="number" className="input-field font-mono" placeholder="1" min="0"
                        value={scheduleData.remaining_retry}
                        onChange={(e) => setScheduleData({ ...scheduleData, remaining_retry: e.target.value })} />
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2 opacity-50">
                        <Star size={14} className="text-slate-500" />
                        Record Dedication
                      </label>
                      <input type="number" className="input-field font-mono !bg-slate-800/60 !text-slate-500 !border-slate-700/40 cursor-not-allowed"
                        value={scheduleData.recorddedication} readOnly disabled />
                      <p className="text-[8px] text-slate-600 mt-1 px-1">System default · greyed out</p>
                    </div>
                    <div className="form-group">
                      <label className="label flex items-center gap-2 mb-2 opacity-50">
                        <Copy size={14} className="text-slate-500" />
                        Star Copy
                      </label>
                      <div className="relative">
                        <select className="input-field pr-10 appearance-none font-mono"
                          value={scheduleData.starcopy}
                          onChange={(e) => setScheduleData({ ...scheduleData, starcopy: e.target.value })}>
                          <option value="0">0 — Disabled</option>
                          <option value="1">1 — Enabled</option>
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-500">
                          <ChevronRight size={16} className="rotate-90" />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex gap-4 mt-8 pt-6 border-t border-white-5 sticky bottom-0 -mx-8 px-8 pb-2 bg-[var(--bg-main)] z-20">
                  <button
                    className="btn-secondary flex-1 py-4 font-bold tracking-widest text-xs uppercase"
                    onClick={() => setIsScheduleModalOpen(false)}
                  >
                    Discard Configuration
                  </button>
                  {successMsg ? (
                    <div className="flex-[2] flex flex-col items-center gap-4 py-4 animate-in fade-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-500/20 border-2 border-emerald-500 flex items-center justify-center">
                        <svg className="w-8 h-8 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                      <div className="text-center">
                        <div className="text-emerald-400 font-black text-sm tracking-widest uppercase mb-2">Campaign Launched Successfully!</div>
                        <div className="text-xs opacity-60 font-mono space-y-1">
                          <div>📋 Project: <span className="text-emerald-300 font-bold">{scheduleData.obd_name}</span></div>
                          <div>📊 MSISDNs Exported: <span className="text-emerald-300 font-bold">{cleanedMsisdns?.length?.toLocaleString() || '0'}</span></div>
                          <div>📡 MSC IP: <span className="text-emerald-300 font-bold">{scheduleData.msc_ip}</span></div>
                          <div>🎵 Flow: <span className="text-emerald-300 font-bold">{scheduleData.flow_name}</span></div>
                        </div>
                      </div>
                      <button
                        className="mt-2 px-8 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white font-bold tracking-widest text-xs uppercase transition-all active:scale-95"
                        onClick={() => {
                          setIsScheduleModalOpen(false);
                          setSuccessMsg('');
                        }}
                      >
                        ✓ Done
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn-primary !bg-emerald-500 hover:!bg-emerald-400 shadow-emerald-500/20 flex-[2] py-4 rounded-2xl font-bold tracking-widest text-xs uppercase flex items-center justify-center gap-3 transition-all active:scale-95"
                      disabled={isLaunching}
                      onClick={async () => {
                        if (isLaunching) return;
                        setIsLaunching(true);
                        setSuccessMsg('');
                        try {
                          // 1. Save Scheduling Details
                          const schedRes = await fetch(`${API_BASE}/schedule-promotion`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(scheduleData)
                          });

                          if (!schedRes.ok) {
                            const err = await schedRes.json();
                            setSuccessMsg('');
                            setIsLaunching(false);
                            alert(`Scheduling Failed: ${err.detail}`);
                            return;
                          }

                          // 2. Launch Campaign (save MSISDNs)
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
                            setSuccessMsg('SUCCESS');
                            setIsLaunching(false);
                          } else {
                            const err = await launchRes.json();
                            setIsLaunching(false);
                            alert(`Launch Failed: ${err.detail || 'Internal Server Error'}`);
                          }
                        } catch (err) {
                          setIsLaunching(false);
                          alert(`Network Error: ${err.message}`);
                        }
                      }}
                    >
                      <Zap size={16} fill="white" className={isLaunching ? "animate-spin" : ""} />
                      {isLaunching ? "Launching..." : "Initialize & Launch Campaign"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
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
