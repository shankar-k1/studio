"use client";

import React, { useEffect, useRef, useState } from "react";
import {
  Activity,
  Check,
  ChevronDown,
  Copy,
  Download,
  FileAudio,
  Globe,
  Headphones,
  Loader2,
  LogOut,
  Mic,
  Music2,
  Shield,
  Sparkles,
  Trash2,
  Upload,
  User,
  Volume2,
  Wand2,
  History as HistoryIcon,
  X as CloseIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { fetchFile, toBlobURL } from "@ffmpeg/util";
import { useSession, signOut } from "next-auth/react";
import axios from "axios";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { ThemeSwitcher } from "./ThemeSwitcher";
import { useTheme } from "@/context/ThemeContext";

type ProcessedResult = {
  id: string;
  fileName: string;
  originalText: string;
  translatedText: string;
  detectedLang: string;
  outputUrl: string;
};

type FfmpegLike = {
  on: (event: "progress", callback: ({ progress }: { progress: number }) => void) => void;
  load: (config: { coreURL: string; wasmURL: string }) => Promise<void>;
  writeFile: (path: string, data: Uint8Array) => Promise<void>;
  exec: (args: string[]) => Promise<void>;
  readFile: (path: string) => Promise<Uint8Array>;
};

const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "es", name: "Spanish", flag: "🇪🇸" },
  { code: "fr", name: "French", flag: "🇫🇷" },
  { code: "de", name: "German", flag: "🇩🇪" },
  { code: "hi", name: "Hindi", flag: "🇮🇳" },
  { code: "ja", name: "Japanese", flag: "🇯🇵" },
  { code: "zh", name: "Chinese", flag: "🇨🇳" },
  { code: "it", name: "Italian", flag: "🇮🇹" },
  { code: "pt", name: "Portuguese", flag: "🇧🇷" },
  { code: "ru", name: "Russian", flag: "🇷🇺" },
  { code: "ko", name: "Korean", flag: "🇰🇷" },
  { code: "ar", name: "Arabic", flag: "🇸🇦" },
  { code: "tr", name: "Turkish", flag: "🇹🇷" },
  { code: "nl", name: "Dutch", flag: "🇳🇱" },
  { code: "pl", name: "Polish", flag: "🇵🇱" },
  { code: "sv", name: "Swedish", flag: "🇸🇪" },
  { code: "ta", name: "Tamil", flag: "🇮🇳" },
  { code: "te", name: "Telugu", flag: "🇮🇳" },
  { code: "ml", name: "Malayalam", flag: "🇮🇳" },
  { code: "bn", name: "Bengali", flag: "🇮🇳" },
  { code: "th", name: "Thai", flag: "🇹🇭" },
  { code: "mn", name: "Mongolian", flag: "🇲🇳" },
  { code: "vi", name: "Vietnamese", flag: "🇻🇳" },
  { code: "id", name: "Indonesian", flag: "🇮🇩" },
  { code: "uk", name: "Ukrainian", flag: "🇺🇦" },
];

const VOICE_GENDER = { MALE: "male", FEMALE: "female" };

const COUNTRY_VOICES = [
  {
    country: "Global / Universal",
    code: "gl",
    flag: "🌐",
    voices: [
      { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", gender: VOICE_GENDER.FEMALE, engine: "elevenlabs" },
      { id: "ErXw9S1QoY4hY9iRko21", name: "Antoni", gender: VOICE_GENDER.MALE, engine: "elevenlabs" },
      { id: "nova", name: "Nova", gender: VOICE_GENDER.FEMALE, engine: "openai" },
      { id: "onyx", name: "Onyx", gender: VOICE_GENDER.MALE, engine: "openai" },
      { id: "default", name: "HF (English MS)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Universal", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "United States",
    code: "us",
    flag: "🇺🇸",
    langCode: "en",
    voices: [
      { id: "pNInz6ovSYqtW4qc44s8", name: "Lily", gender: VOICE_GENDER.FEMALE, engine: "elevenlabs" },
      { id: "TxGEqnS1S6S7M9DnuTX8", name: "Josh", gender: VOICE_GENDER.MALE, engine: "elevenlabs" },
      { id: "en-US-natalie", name: "Natalie", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "en-US-sam", name: "Sam", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "alloy", name: "Alloy", gender: VOICE_GENDER.FEMALE, engine: "openai" },
      { id: "echo", name: "Echo", gender: VOICE_GENDER.MALE, engine: "openai" },
      { id: "shimmer", name: "Shimmer", gender: VOICE_GENDER.FEMALE, engine: "openai" },
      { id: "fable", name: "Fable", gender: VOICE_GENDER.MALE, engine: "openai" },
      { id: "default", name: "HF English (US)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
    ],
  },
  {
    country: "United Kingdom",
    code: "gb",
    flag: "🇬🇧",
    langCode: "en",
    voices: [
      { id: "EXAVITQu4vr4xnSDxMaL", name: "Bella", gender: VOICE_GENDER.FEMALE, engine: "elevenlabs" },
      { id: "bIH9z4p9vV8vScyCyc6G", name: "Jeremy", gender: VOICE_GENDER.MALE, engine: "elevenlabs" },
      { id: "en-GB-abigail", name: "Abigail", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "en-GB-harry", name: "Harry", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "Google UK", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "India",
    code: "in",
    flag: "🇮🇳",
    langCode: "hi",
    voices: [
      { id: "hi-IN-aditi", name: "Aditi", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "hi-IN-amit", name: "Amit", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "ta-IN-valluvar", name: "Valluvar (Tamil)", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "te-IN-venkat", name: "Venkat (Telugu)", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (Hindi)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "HF (Tamil)", gender: VOICE_GENDER.MALE, engine: "huggingface" },
      { id: "default", name: "HF (Telugu)", gender: VOICE_GENDER.MALE, engine: "huggingface" },
      { id: "default", name: "Google Hindi", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
      { id: "default", name: "Google Tamil", gender: VOICE_GENDER.MALE, engine: "gtts" },
    ],
  },
  {
    country: "Spain",
    code: "es",
    flag: "🇪🇸",
    langCode: "es",
    voices: [
      { id: "es-ES-elena", name: "Elena", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "es-ES-sergio", name: "Sergio", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (Spanish)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Spanish", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "France",
    code: "fr",
    flag: "🇫🇷",
    langCode: "fr",
    voices: [
      { id: "fr-FR-celeste", name: "Celeste", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "fr-FR-clément", name: "Clément", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (French)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google French", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Germany",
    code: "de",
    flag: "🇩🇪",
    langCode: "de",
    voices: [
      { id: "de-DE-heidi", name: "Heidi", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "de-DE-lukas", name: "Lukas", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (German)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google German", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Italy",
    code: "it",
    flag: "🇮🇹",
    langCode: "it",
    voices: [
      { id: "it-IT-giulia", name: "Giulia", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "it-IT-alessio", name: "Alessio", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (Italian)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Italian", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Japan",
    code: "jp",
    flag: "🇯🇵",
    langCode: "ja",
    voices: [
      { id: "ja-JP-nanami", name: "Nanami", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "ja-JP-keita", name: "Keita", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (Japanese)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Japanese", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "China",
    code: "cn",
    flag: "🇨🇳",
    langCode: "zh",
    voices: [
      { id: "zh-CN-xiaoxiao", name: "Xiaoxiao", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "zh-CN-yunye", name: "Yunye", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (Chinese)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Chinese", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Brazil",
    code: "br",
    flag: "🇧🇷",
    langCode: "pt",
    voices: [
      { id: "pt-BR-francisca", name: "Francisca", gender: VOICE_GENDER.FEMALE, engine: "murf" },
      { id: "pt-BR-antonio", name: "Antonio", gender: VOICE_GENDER.MALE, engine: "murf" },
      { id: "default", name: "HF (Portuguese)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Portuguese", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Russia",
    code: "ru",
    flag: "🇷🇺",
    langCode: "ru",
    voices: [
      { id: "default", name: "HF (Russian)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Russian", gender: VOICE_GENDER.MALE, engine: "gtts" },
    ],
  },
  {
    country: "Korea",
    code: "kr",
    flag: "🇰🇷",
    langCode: "ko",
    voices: [
      { id: "default", name: "HF (Korean)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Korean", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Turkey",
    code: "tr",
    flag: "🇹🇷",
    langCode: "tr",
    voices: [
      { id: "default", name: "HF (Turkish)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Turkish", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Netherlands",
    code: "nl",
    flag: "🇳🇱",
    langCode: "nl",
    voices: [
      { id: "default", name: "HF (Dutch)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Dutch", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
  {
    country: "Sweden",
    code: "se",
    flag: "🇸🇪",
    langCode: "sv",
    voices: [
      { id: "default", name: "HF (Swedish)", gender: VOICE_GENDER.FEMALE, engine: "huggingface" },
      { id: "default", name: "Google Swedish", gender: VOICE_GENDER.FEMALE, engine: "gtts" },
    ],
  },
];

type StyledSelectProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  onChange: (event: React.ChangeEvent<HTMLSelectElement>) => void;
  children: React.ReactNode;
};

function StyledSelect({ label, icon, value, onChange, children }: StyledSelectProps) {
  return (
    <div className="control-card">
      <div className="field-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="field-shell relative">
        <select value={value} onChange={onChange} className="field-select pr-11">
          {children}
        </select>
        <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
      </div>
    </div>
  );
}

function WaveformAnimation() {
  return (
    <div className="flex h-12 items-center justify-center gap-1.5">
      {[...Array(7)].map((_, index) => (
        <div key={index} className="waveform-bar" />
      ))}
    </div>
  );
}

export default function AudioApp() {
  const { data: session, status } = useSession();
  const { t } = useTheme();
  const [files, setFiles] = useState<File[]>([]);
  const [processedResults, setProcessedResults] = useState<ProcessedResult[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingIndex, setProcessingIndex] = useState(-1);
  const [processingStep, setProcessingStep] = useState("");
  const [sttEngine, setSttEngine] = useState("deepgram");
  const [ttsEngine, setTtsEngine] = useState("elevenlabs");
  const [selectedCountry, setSelectedCountry] = useState(COUNTRY_VOICES[0].code);
  const [gender, setGender] = useState(VOICE_GENDER.FEMALE);
  const [ttsVoice, setTtsVoice] = useState(COUNTRY_VOICES[0].voices[0].id);
  const [targetLang, setTargetLang] = useState("es");
  const [ffmpegLoaded, setFfmpegLoaded] = useState(false);
  const [conversionProgress, setConversionProgress] = useState(0);
  const [copied, setCopied] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [syncLanguage, setSyncLanguage] = useState(true);
  const [outputFormat, setOutputFormat] = useState("mp3");
  const [wavCodec, setWavCodec] = useState("pcm_s16le");
  const [audioChannels, setAudioChannels] = useState("2");
  const [sampleRate, setSampleRate] = useState("44100");
  const [isConvertingOutput, setIsConvertingOutput] = useState(false);
  const [bitrate, setBitrate] = useState("128k");
  const [history, setHistory] = useState<any[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  const ffmpegRef = useRef<FfmpegLike | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFFmpeg();
    if (status === "authenticated") fetchHistory();
  }, [status]);

  const fetchHistory = async () => {
    try {
      const res = await axios.get(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/vocal-sync/history`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('obd_token')}` }
      });
      setHistory(res.data.history || []);
    } catch (err) {
      console.error("Failed to fetch history:", err);
    }
  };

  const availableCountries = COUNTRY_VOICES.filter((country) =>
    country.voices.some((voice) => voice.engine === ttsEngine),
  );

  const selectedCountryVoices =
    COUNTRY_VOICES.find((country) => country.code === selectedCountry)?.voices.filter(
      (voice) => voice.gender === gender && voice.engine === ttsEngine,
    ) || [];

  const stats = [
    { label: "Queue", value: `${files.length} file${files.length === 1 ? "" : "s"}` },
    { label: "Results", value: `${processedResults.length} ready` },
    { label: "FFmpeg", value: ffmpegLoaded ? "Prepared" : "Loading" },
    { label: "Mode", value: syncLanguage ? "Voice-linked" : "Manual" },
  ];

  async function loadFFmpeg() {
    try {
      if (!ffmpegRef.current) {
        const { FFmpeg } = await import("@ffmpeg/ffmpeg");
        ffmpegRef.current = new FFmpeg();
      }

      const baseURL = "https://unpkg.com/@ffmpeg/core@0.12.6/dist/umd";
      const ffmpeg = ffmpegRef.current;
      ffmpeg.on("progress", ({ progress }: { progress: number }) => {
        setConversionProgress(Math.round(progress * 100));
      });

      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, "text/javascript"),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, "application/wasm"),
      });
      setFfmpegLoaded(true);
    } catch (error) {
      console.warn("FFmpeg load failed:", error);
    }
  }

  function handleFileUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = Array.from(event.target.files || []);
    if (selectedFiles.length === 0) return;

    const MAX_SIZE_MB = 25;
    const oversized = selectedFiles.filter((file) => file.size > MAX_SIZE_MB * 1024 * 1024);

    if (oversized.length > 0) {
      setErrorMsg(`Files exceed ${MAX_SIZE_MB}MB: ${oversized.map((file) => file.name).join(", ")}`);
      const validFiles = selectedFiles.filter((file) => file.size <= MAX_SIZE_MB * 1024 * 1024);
      if (validFiles.length > 0) {
        setFiles((current) => [...current, ...validFiles]);
      }
      return;
    }

    setErrorMsg("");
    setFiles((current) => [...current, ...selectedFiles]);
  }

  function removeFile(index: number) {
    setFiles((current) => current.filter((_, currentIndex) => currentIndex !== index));
  }

  function clearFiles() {
    setFiles([]);
    setProcessedResults([]);
  }

  async function convertGeneratedAudio(result: ProcessedResult) {
    if (!result.outputUrl || !ffmpegLoaded) return;

    setIsConvertingOutput(true);
    const ffmpeg = ffmpegRef.current;

    try {
      const response = await fetch(result.outputUrl);
      const audioBlob = await response.blob();
      const inputName = `input_${result.id}.mp3`;
      const outputName = `output_${result.id}.${outputFormat}`;

      const ffmpeg = ffmpegRef.current;
      if (!ffmpeg) return;

      await ffmpeg.writeFile(inputName, await fetchFile(audioBlob));
      const ffmpegArgs = ["-i", inputName, "-ar", sampleRate, "-ac", audioChannels];

      if (outputFormat === "wav") ffmpegArgs.push("-acodec", wavCodec);
      if (outputFormat === "mp3" || outputFormat === "ogg") ffmpegArgs.push("-b:a", bitrate);
      if (outputFormat === "flac") ffmpegArgs.push("-acodec", "flac");

      ffmpegArgs.push(outputName);

      await ffmpeg.exec(ffmpegArgs);
      const data = await ffmpeg.readFile(outputName);
      const url = URL.createObjectURL(new Blob([data.buffer as any], { type: `audio/${outputFormat}` }));
      const anchor = document.createElement("a");
      const langName = LANGUAGES.find((language) => language.code === targetLang)?.name || targetLang;

      anchor.href = url;
      anchor.download = `translated-${langName}-${result.fileName.replace(/\.[^/.]+$/, "")}.${outputFormat}`;
      anchor.click();
    } finally {
      setIsConvertingOutput(false);
    }
  }

  async function processAudio() {
    if (files.length === 0) return;

    setIsProcessing(true);
    setErrorMsg("");
    setProcessedResults([]);

    // Parallel processing with concurrency limit (e.g., 3 at a time)
    const CONCURRENCY = 3;
    const processFile = async (currentFile: File, index: number) => {
      try {
        setProcessingStep(`Processing ${currentFile.name}...`);
        const formData = new FormData();
        formData.append("file", currentFile);
        formData.append("engine", sttEngine);

        const sttResponse = await axios.post("/api/stt", formData);
        if (sttResponse.data.error) throw new Error(sttResponse.data.error);

        const sourceText = sttResponse.data.text;
        const sourceLang = sttResponse.data.language || "en";

        const translateResponse = await axios.post("/api/translate", {
          text: sourceText,
          sourceLang,
          targetLang,
        });
        if (translateResponse.data.error) throw new Error(translateResponse.data.error);

        const translated = translateResponse.data.translatedText;

        const ttsResponse = await axios.post("/api/tts", {
          text: translated,
          targetLang,
          engine: ttsEngine,
          voiceId: ttsVoice,
        });
        if (ttsResponse.data.error) throw new Error(ttsResponse.data.error);

        const result = {
          id: Math.random().toString(36).slice(2, 11),
          fileName: currentFile.name,
          originalText: sourceText,
          translatedText: translated,
          detectedLang: sourceLang,
          outputUrl: ttsResponse.data.audioUrl,
        };
        setProcessedResults((current) => [...current, result]);
        
        // Push to permanent DB history
        await axios.post(`${process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:8000'}/vocal-sync/history`, {
          ...result,
          targetLang
        }, {
          headers: { Authorization: `Bearer ${localStorage.getItem('obd_token')}` }
        });
      } catch (error: any) {
        console.error(`Error processing ${currentFile.name}:`, error);
        setErrorMsg(`Failed to process ${currentFile.name}: ${error.message}`);
      }
    };

    // Process in batches
    for (let i = 0; i < files.length; i += CONCURRENCY) {
      const batch = files.slice(i, i + CONCURRENCY);
      await Promise.all(batch.map((file, idx) => processFile(file, i + idx)));
    }

    setIsProcessing(false);
    setProcessingIndex(-1);
    setProcessingStep("");
    fetchHistory();
  }

  function copyText(text: string) {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function getLangName(code: string) {
    return LANGUAGES.find((language) => language.code === code)?.name || code;
  }

  if (status === "unauthenticated") {
    return (
      <section className="studio-shell flex min-h-screen items-center justify-center px-4 py-12">
        <div className="panel panel-strong relative w-full max-w-3xl overflow-hidden rounded-[2rem] px-8 py-14 text-center sm:px-14">
          <div className="ambient-orb left-8 top-8 h-28 w-28 bg-[rgba(238,108,77,0.16)]" />
          <div
            className="ambient-orb bottom-8 right-8 h-32 w-32 bg-[rgba(31,108,93,0.16)]"
            style={{ animationDelay: "2s" }}
          />
          <div className="eyebrow mx-auto w-fit">
            <span className="accent-dot" />
            Access required
          </div>
          <Sparkles className="mx-auto mt-6 h-12 w-12 text-[var(--accent)]" />
          <h1 className="display-title mt-6 text-5xl font-semibold sm:text-6xl">VocalSync AI</h1>
          <p className="mx-auto mt-5 max-w-xl text-lg text-[var(--muted)]">
            Enter the studio to turn source audio into multilingual, voice-matched output.
          </p>
          <button
            onClick={() => {
              window.location.href = "/auth/signin";
            }}
            className="action-primary mt-10 h-14 w-full max-w-xs rounded-[1.3rem] text-base"
          >
            <Sparkles className="h-5 w-5" />
            Sign in to continue
          </button>
        </div>
      </section>
    );
  }

  return (
    <div className="studio-shell pb-16 min-h-screen transition-colors duration-500" style={{ backgroundColor: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      <div className="ambient-orb left-[4%] top-24 h-44 w-44 opacity-20" style={{ backgroundColor: 'var(--primary)' }} />
      <div
        className="ambient-orb right-[8%] top-48 h-56 w-56 opacity-20"
        style={{ animationDelay: "1.5s", backgroundColor: 'var(--secondary)' }}
      />

      <div className="studio-grid px-1 py-8 sm:px-3 sm:py-12">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] px-2 py-2 sm:px-4 sm:py-4"
        >
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <div className="eyebrow">
                <span className="accent-dot" />
                Audio direction studio
              </div>
              <div className="mt-5 flex items-start gap-5">
                <div className="mt-1 flex h-14 w-14 shrink-0 items-center justify-center rounded-[1.4rem] bg-[var(--accent-soft)] text-[var(--accent)]">
                  <Headphones className="h-7 w-7" />
                </div>
                <div>
                  <h1 className="display-title text-4xl font-semibold leading-[0.95] sm:text-5xl">
                    Translate audio without fighting the interface.
                  </h1>
                  <p className="mt-4 max-w-xl text-base leading-7 text-[var(--muted)] sm:text-lg">
                    Keep source files on the left, settings on the right, and exports below. The flow should feel obvious.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <ThemeSwitcher />
              {(session?.user as { role?: string } | undefined)?.role === "ADMIN" && (
                <Link href="/admin" className="action-secondary h-11 px-4 text-sm font-semibold">
                  <Shield className="h-4 w-4 text-[var(--accent-alt)]" />
                  Admin
                </Link>
              )}
              <div className="soft-pill h-11 px-4">
                <User className="h-4 w-4" />
                {session?.user?.name || "User"}
              </div>
              <button onClick={() => signOut()} className="action-secondary h-11 px-4 text-sm font-semibold">
                <LogOut className="h-4 w-4" />
                Sign out
              </button>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 lg:max-w-4xl lg:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="rounded-[1.25rem] border border-[var(--line)] bg-[var(--bg-card)] px-4 py-4">
                <div className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[var(--muted)]">
                  {item.label}
                </div>
                <div className="mt-2 text-lg font-semibold text-[var(--ink)]">{item.value}</div>
              </div>
            ))}
          </div>
        </motion.header>

        <AnimatePresence>
          {errorMsg && (
            <motion.section
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="panel panel-solid mt-6 rounded-[1.4rem] border-[rgba(182,72,47,0.22)] bg-[rgba(255,244,240,0.96)] px-5 py-4"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--warning)]">Processing issue</p>
                  <p className="mt-2 max-w-5xl text-sm leading-6 text-[var(--warning)]">{errorMsg}</p>
                </div>
                <button onClick={() => setErrorMsg("")} className="rounded-full p-2 text-[var(--warning)] hover:bg-[var(--bg-card)]/70">
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </motion.section>
          )}
        </AnimatePresence>

        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]"
        >
          <div className="space-y-6">
            <div className="panel panel-solid rounded-[2rem] p-6 sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="section-kicker">Workspace</p>
                  <h2 className="display-title mt-2 text-3xl font-semibold">Source files</h2>
                  <p className="mt-2 max-w-xl text-[var(--muted)] leading-7">
                    Add clips, review the queue, and run the pipeline once your settings are ready.
                  </p>
                </div>
                <div className="soft-pill">
                  <Upload className="h-4 w-4" />
                  WAV, MP3, M4A
                </div>
              </div>

              <div
                className={cn(
                  "upload-surface mt-6 p-6 sm:p-7",
                  files.length > 0 ? "min-h-[280px]" : "min-h-[420px]",
                )}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="audio/*"
                  onChange={handleFileUpload}
                  multiple
                />

                <AnimatePresence mode="popLayout">
                  {files.length > 0 ? (
                    <motion.div
                      key="files"
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="relative z-10 flex h-full flex-col"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="soft-pill">
                            <FileAudio className="h-4 w-4" />
                            {files.length} queued
                          </span>
                          {files.length > 1 && (
                            <span className="soft-pill bg-[var(--accent-alt-soft)] text-[var(--accent-alt)]">
                              Batch
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              fileInputRef.current?.click();
                            }}
                            className="action-secondary h-10 px-4 text-sm font-semibold"
                          >
                            <Upload className="h-4 w-4" />
                            Add files
                          </button>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              clearFiles();
                            }}
                            className="action-secondary h-10 px-4 text-sm font-semibold"
                          >
                            <Trash2 className="h-4 w-4" />
                            Clear
                          </button>
                        </div>
                      </div>

                      <div className="mt-6 grid max-h-[340px] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                        {files.map((file, index) => (
                          <div
                            key={`${file.name}-${index}`}
                            className="rounded-[1.2rem] border border-[var(--line)] bg-[var(--bg-card)] p-4"
                          >
                            <div className="flex items-start gap-3">
                              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[1rem] bg-[var(--accent-soft)] text-[var(--accent)]">
                                <Music2 className="h-5 w-5" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-semibold">{file.name}</p>
                                <p className="tiny-note mt-1">
                                  {(file.size / (1024 * 1024)).toFixed(2)} MB ·{" "}
                                  {file.type.split("/")[1]?.toUpperCase() || "AUDIO"}
                                </p>
                              </div>
                              <button
                                onClick={(event) => {
                                  event.stopPropagation();
                                  removeFile(index);
                                }}
                                className="rounded-full p-2 text-[var(--muted)] transition hover:bg-black/5 hover:text-[var(--warning)]"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  ) : (
                    <motion.div
                      key="empty"
                      initial={{ opacity: 0, scale: 0.96 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="relative z-10 flex h-full flex-col items-center justify-center text-center"
                    >
                      <div className="flex h-20 w-20 items-center justify-center rounded-[1.6rem] bg-[var(--bg-card)] shadow-[0_14px_28px_rgba(0,0,0,0.05)]">
                        <Upload className="h-9 w-9 text-[var(--accent)]" />
                      </div>
                      <h3 className="display-title mt-6 text-3xl font-semibold">Drop your source audio here</h3>
                      <p className="mt-3 max-w-md text-[var(--muted)] leading-7">
                        Add one file or a batch. This area only expands when it needs to.
                      </p>
                    </motion.div>
                  )}
                </AnimatePresence>

                {isProcessing && (
                  <div className="absolute inset-4 z-20 flex flex-col items-center justify-center rounded-[1.5rem] bg-[rgba(24,22,31,0.76)] px-6 text-center text-white backdrop-blur-md">
                    <WaveformAnimation />
                    <p className="mt-4 text-lg font-semibold">{processingStep}</p>
                    <p className="mt-2 text-sm text-white/70">
                      File {processingIndex + 1} of {files.length}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {(processedResults.length > 0 || showHistory) && (
              <section className="panel panel-solid rounded-[2rem] p-6 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="section-kicker">Results</p>
                    <h2 className="display-title mt-2 text-3xl font-semibold">Generated takes</h2>
                    <p className="mt-2 text-[var(--muted)] leading-7">
                      Review transcripts and download the generated audio.
                    </p>
                  </div>
                  <div className="flex gap-3">
                    <button
                        onClick={() => setShowHistory(!showHistory)}
                        className={cn(
                          "action-secondary h-11 px-5 text-sm font-semibold",
                          showHistory && "bg-[var(--accent-alt-soft)] text-[var(--accent-alt)]"
                        )}
                      >
                        <HistoryIcon className="h-4 w-4" />
                        {showHistory ? "View Current Result" : "View History"}
                      </button>
                    <div className="soft-pill">
                      <Check className="h-4 w-4 text-[var(--accent-alt)]" />
                      {processedResults.length} ready
                    </div>
                  </div>
                </div>

                <div className="mt-6 space-y-6">
                  {processedResults.map((result) => (
                    <motion.article
                      key={result.id}
                      initial={{ opacity: 0, y: 16 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="result-card p-6"
                    >
                      <div className="flex items-start gap-4">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[1rem] bg-[var(--accent-alt-soft)] text-[var(--accent-alt)]">
                          <Music2 className="h-6 w-6" />
                        </div>
                        <div>
                          <h3 className="display-title text-2xl font-semibold">{result.fileName}</h3>
                          <p className="mt-1 text-sm text-[var(--muted)]">
                            {getLangName(result.detectedLang || "en")} to {getLangName(targetLang)}
                          </p>
                        </div>
                      </div>

                      <div className="mt-6 grid gap-4 xl:grid-cols-2">
                        <div className="text-well p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                              Original transcript
                            </p>
                            <button
                              onClick={() => copyText(result.originalText)}
                              className="action-secondary h-9 px-3 text-xs font-semibold"
                            >
                              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                              Copy
                            </button>
                          </div>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">{result.originalText}</p>
                        </div>

                        <div className="text-well p-5">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                              Translation
                            </p>
                            <button
                              onClick={() => copyText(result.translatedText)}
                              className="action-secondary h-9 px-3 text-xs font-semibold"
                            >
                              <Copy className="h-3.5 w-3.5" />
                              Copy
                            </button>
                          </div>
                          <p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--ink)]">
                            {result.translatedText}
                          </p>
                        </div>
                      </div>

                      {result.outputUrl && (
                        <div className="mt-6 rounded-[1.5rem] border border-[var(--line)] bg-[var(--bg-card)] p-5">
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                            <p className="text-sm font-extrabold uppercase tracking-[0.12em] text-[var(--muted)]">
                              Generated audio
                            </p>
                            <div className="soft-pill">
                              <Volume2 className="h-4 w-4" />
                              {ffmpegLoaded ? "Converter ready" : "Preparing converter"}
                            </div>
                          </div>

                          <div className="mt-4">
                            <audio src={result.outputUrl} controls />
                          </div>

                          <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                            <StyledSelect label="Format" icon={<Download className="h-4 w-4" />} value={outputFormat} onChange={(event) => setOutputFormat(event.target.value)}>
                              <option value="mp3">MP3</option>
                              <option value="wav">WAV</option>
                              <option value="ogg">OGG</option>
                              <option value="flac">FLAC</option>
                            </StyledSelect>

                            {outputFormat === "wav" && (
                              <StyledSelect label="Codec" icon={<Activity className="h-4 w-4" />} value={wavCodec} onChange={(event) => setWavCodec(event.target.value)}>
                                <option value="pcm_s16le">16-bit PCM</option>
                                <option value="pcm_s24le">24-bit PCM</option>
                                <option value="pcm_s32le">32-bit PCM</option>
                                <option value="pcm_u8">8-bit PCM</option>
                                <option value="pcm_alaw">A-Law</option>
                                <option value="pcm_mulaw">u-Law</option>
                              </StyledSelect>
                            )}

                            <StyledSelect label="Sample rate" icon={<Sparkles className="h-4 w-4" />} value={sampleRate} onChange={(event) => setSampleRate(event.target.value)}>
                              <option value="8000">8,000 Hz</option>
                              <option value="16000">16,000 Hz</option>
                              <option value="22050">22,050 Hz</option>
                              <option value="44100">44,100 Hz</option>
                              <option value="48000">48,000 Hz</option>
                            </StyledSelect>

                            <StyledSelect label="Channels" icon={<Headphones className="h-4 w-4" />} value={audioChannels} onChange={(event) => setAudioChannels(event.target.value)}>
                              <option value="1">Mono</option>
                              <option value="2">Stereo</option>
                            </StyledSelect>

                            {(outputFormat === "mp3" || outputFormat === "ogg") && (
                              <StyledSelect label="Bitrate" icon={<Volume2 className="h-4 w-4" />} value={bitrate} onChange={(event) => setBitrate(event.target.value)}>
                                <option value="64k">64 kbps</option>
                                <option value="128k">128 kbps</option>
                                <option value="192k">192 kbps</option>
                                <option value="256k">256 kbps</option>
                                <option value="320k">320 kbps</option>
                              </StyledSelect>
                            )}
                          </div>

                          <button
                            onClick={() => convertGeneratedAudio(result)}
                            disabled={isConvertingOutput || !ffmpegLoaded}
                            className="action-primary mt-5 h-12 w-full rounded-[1.2rem] text-sm"
                          >
                            {isConvertingOutput ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                            {isConvertingOutput ? `Converting ${conversionProgress}%` : `Download ${outputFormat.toUpperCase()}`}
                          </button>
                        </div>
                      )}
                    </motion.article>
                  ))}
                  {showHistory && history.map((h, idx) => (
                    <motion.article
                      key={`history-${idx}`}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="result-card p-6 border border-emerald-500/10 bg-emerald-500/5"
                    >
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                           <HistoryIcon size={16} className="text-emerald-500" />
                           <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500">Historical Record</span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">{new Date(h.created_at).toLocaleString()}</span>
                      </div>
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.85rem] bg-[var(--accent-soft)] text-[var(--accent)]">
                          <Music2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold">{h.filename}</h3>
                          <p className="tiny-note">{h.source_lang} to {h.target_lang}</p>
                        </div>
                      </div>
                      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                         <div className="text-well p-4 bg-black/20">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Source</p>
                            <p className="text-xs line-clamp-3">{h.original_text}</p>
                         </div>
                         <div className="text-well p-4 bg-black/20">
                            <p className="text-[9px] font-black uppercase tracking-wider text-slate-400 mb-2">Translation</p>
                            <p className="text-xs line-clamp-3">{h.translated_text}</p>
                         </div>
                      </div>
                      {h.output_url && (
                        <div className="mt-4 flex items-center gap-4">
                           <audio src={h.output_url} controls className="h-8 max-w-[200px]" />
                           <a href={h.output_url} download className="text-[10px] font-bold text-emerald-400 hover:underline">DOWNLOAD ORIGINAL</a>
                        </div>
                      )}
                    </motion.article>
                  ))}
                  {processedResults.length === 0 && !showHistory && (
                     <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-[var(--line)] rounded-[2rem] text-[var(--muted)]">
                        <HistoryIcon className="w-10 h-10 mb-4 opacity-20" />
                        <p className="font-semibold">Workflow session results will appear here</p>
                        <p className="text-sm mt-1">Or toggle 'View History' to see past explorations</p>
                     </div>
                  )}
                  {showHistory && history.length === 0 && (
                     <div className="flex flex-col items-center justify-center p-20 border-2 border-dashed border-[var(--line)] rounded-[2rem] text-[var(--muted)]">
                        <HistoryIcon className="w-10 h-10 mb-4 opacity-20" />
                        <p className="font-semibold">No historical activity found</p>
                        <p className="text-sm mt-1">Processed files will automatically sync to database</p>
                     </div>
                  )}
                </div>
              </section>
            )}
          </div>

          <aside className="sidebar-sticky panel panel-solid h-fit rounded-[2rem] p-6 sm:p-7">
            <p className="section-kicker">Settings</p>
            <h2 className="display-title mt-2 text-3xl font-semibold">Direction</h2>
            <p className="mt-2 text-[var(--muted)] leading-7">
              Pick the transcription engine, language, and voice once, then run the pass.
            </p>

            <div className="mt-6 grid gap-4">
              <StyledSelect label="Speech to text" icon={<Mic className="h-4 w-4" />} value={sttEngine} onChange={(event) => setSttEngine(event.target.value)}>
                <option value="deepgram">Deepgram Nova-2</option>
                <option value="whisper">OpenAI Whisper</option>
                <option value="assemblyai">AssemblyAI</option>
                <option value="groq">Groq</option>
                <option value="huggingface">Hugging Face</option>
              </StyledSelect>

              <div className="control-card">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="field-label mb-0">
                    <Globe className="h-4 w-4" />
                    <span>Target language</span>
                  </div>
                  <button
                    onClick={() => setSyncLanguage(!syncLanguage)}
                    className={cn(
                      "action-secondary h-9 px-3 text-sm font-semibold",
                      syncLanguage && "border-transparent bg-[var(--accent-alt-soft)] text-[var(--accent-alt)]",
                    )}
                  >
                    Sync
                  </button>
                </div>
                <div className="field-shell relative">
                  <select
                    value={targetLang}
                    onChange={(event) => setTargetLang(event.target.value)}
                    className="field-select pr-11"
                  >
                    {LANGUAGES.map((language) => (
                      <option key={language.code} value={language.code}>
                        {language.flag} {language.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                </div>
              </div>

              <StyledSelect
                label="Voice engine"
                icon={<Volume2 className="h-4 w-4" />}
                value={ttsEngine}
                onChange={(event) => {
                  const engine = event.target.value;
                  setTtsEngine(engine);
                  const firstCountry = COUNTRY_VOICES.find((country) =>
                    country.voices.some((voice) => voice.engine === engine),
                  );

                  if (firstCountry) {
                    setSelectedCountry(firstCountry.code);
                    const firstVoice = firstCountry.voices.find((voice) => voice.engine === engine);
                    if (firstVoice) setTtsVoice(firstVoice.id);
                  }
                }}
              >
                <option value="elevenlabs">ElevenLabs Premium</option>
                <option value="murf">Murf AI Studio</option>
                <option value="openai">OpenAI TTS HD</option>
                <option value="huggingface">Hugging Face</option>
                <option value="gtts">Google TTS</option>
              </StyledSelect>

              <StyledSelect
                label="Voice region"
                icon={<Globe className="h-4 w-4" />}
                value={selectedCountry}
                onChange={(event) => {
                  const nextCountryCode = event.target.value;
                  setSelectedCountry(nextCountryCode);

                  const country = COUNTRY_VOICES.find((item) => item.code === nextCountryCode);
                  if (!country) return;

                  const nextVoice = country.voices.find((voice) => voice.engine === ttsEngine);
                  if (nextVoice) setTtsVoice(nextVoice.id);
                  if (syncLanguage && country.langCode) setTargetLang(country.langCode);
                }}
              >
                {availableCountries.map((country) => (
                  <option key={country.code} value={country.code}>
                    {country.flag} {country.country}
                  </option>
                ))}
              </StyledSelect>

              <div className="control-card">
                <div className="field-label">
                  <Activity className="h-4 w-4" />
                  <span>Voice gender</span>
                </div>
                <div className="grid grid-cols-2 gap-2 rounded-[1rem] bg-[var(--line)] p-1">
                  {[{ value: VOICE_GENDER.FEMALE, label: "Female" }, { value: VOICE_GENDER.MALE, label: "Male" }].map(
                    (option) => (
                      <button
                        key={option.value}
                        onClick={() => setGender(option.value)}
                        className={cn(
                          "rounded-[0.85rem] px-4 py-2.5 text-sm font-semibold transition",
                          gender === option.value
                            ? "bg-[var(--accent)] text-white shadow-[0_10px_20px_rgba(215,90,63,0.18)]"
                            : "bg-transparent text-[var(--muted)] hover:text-[var(--ink)]",
                        )}
                      >
                        {option.label}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <StyledSelect
                label="Voice profile"
                icon={<User className="h-4 w-4" />}
                value={ttsVoice}
                onChange={(event) => setTtsVoice(event.target.value)}
              >
                {selectedCountryVoices.map((voice) => (
                  <option key={`${voice.id}-${voice.name}`} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </StyledSelect>
            </div>

            <div className="mt-6 rounded-[1.5rem] border border-[var(--line)] bg-[var(--bg-card)] p-5">
              <p className="section-kicker">Run</p>
              <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                {files.length} queued, {processedResults.length} complete.
              </p>

              <button
                onClick={processAudio}
                disabled={files.length === 0 || isProcessing}
                className="action-primary mt-5 h-14 w-full rounded-[1.2rem] px-4 text-base"
              >
                {isProcessing ? <Loader2 className="h-5 w-5 shrink-0 animate-spin" /> : <Wand2 className="h-5 w-5 shrink-0" />}
                <span className="truncate">{isProcessing ? processingStep : "Transcribe, translate, and generate"}</span>
              </button>
            </div>
          </aside>
        </motion.section>
      </div>
    </div>
  );
}
