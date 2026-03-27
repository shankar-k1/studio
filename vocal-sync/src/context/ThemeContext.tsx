"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

export type ThemeKey = "dark" | "light" | "midnight";

interface ThemeColors {
    name: string;
    primary: string;
    secondary: string;
    accent: string;
    bg: string;
    bgCard: string;
    sidebarBg: string;
    dot: string;
    isDark: boolean;
    textPrimary: string;
    textSecondary: string;
    textMuted: string;
    border: string;
    inputBg: string;
    cardBorder: string;
    hoverBg: string;
    topBarBg: string;
}

const themes: Record<ThemeKey, ThemeColors> = {
    dark: {
        name: "Standard Dark",
        primary: "#60a5fa",
        secondary: "#3b82f6",
        accent: "#34d399",
        bg: "#0b1220",
        bgCard: "rgba(14, 24, 41, 0.7)",
        sidebarBg: "rgba(11, 18, 32, 1)",
        dot: "#60a5fa",
        isDark: true,
        textPrimary: "#e8f4ff",
        textSecondary: "#8aafd4",
        textMuted: "#4d7299",
        border: "#1c2e47",
        inputBg: "rgba(11, 18, 32, 0.9)",
        cardBorder: "#1c2e47",
        hoverBg: "rgba(255, 255, 255, 0.05)",
        topBarBg: "rgba(11, 18, 32, 0.8)",
    },
    midnight: {
        name: "Midnight",
        primary: "#818cf8",
        secondary: "#6366f1",
        accent: "#a855f7",
        bg: "#05070a",
        bgCard: "rgba(7, 9, 15, 0.85)",
        sidebarBg: "rgba(5, 7, 12, 1)",
        dot: "#818cf8",
        isDark: true,
        textPrimary: "#f8fafc",
        textSecondary: "#94a3b8",
        textMuted: "#475569",
        border: "#1e293b",
        inputBg: "rgba(5, 7, 12, 0.98)",
        cardBorder: "#1e293b",
        hoverBg: "rgba(255, 255, 255, 0.03)",
        topBarBg: "rgba(5, 7, 12, 0.8)",
    },
    light: {
        name: "Light",
        primary: "#3b82f6",
        secondary: "#60a5fa",
        accent: "#34d399",
        bg: "#f1f5f9",
        bgCard: "rgba(255, 255, 255, 0.7)",
        sidebarBg: "#ffffff",
        dot: "#3b82f6",
        isDark: false,
        textPrimary: "#0f172a",
        textSecondary: "#334155",
        textMuted: "#64748b",
        border: "#cbd5e1",
        inputBg: "rgba(255, 255, 255, 0.9)",
        cardBorder: "#cbd5e1",
        hoverBg: "rgba(0, 0, 0, 0.03)",
        topBarBg: "rgba(255, 255, 255, 0.8)",
    },
};

interface ThemeContextType {
    theme: ThemeKey;
    t: ThemeColors;
    setTheme: (t: ThemeKey) => void;
    allThemes: typeof themes;
}

const ThemeContext = createContext<ThemeContextType>({
    theme: "dark",
    t: themes.dark,
    setTheme: () => { },
    allThemes: themes,
});

export const useTheme = () => useContext(ThemeContext);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
    const [theme, setThemeState] = useState<ThemeKey>("dark");

    useEffect(() => {
        // Sync with main app via Query Param or LocalStorage
        const params = new URLSearchParams(window.location.search);
        const urlTheme = params.get("theme") as ThemeKey | null;
        const saved = localStorage.getItem("obd-theme") as ThemeKey | null;
        
        const targetTheme = (urlTheme && themes[urlTheme]) ? urlTheme : 
                           (saved && themes[saved]) ? saved : "dark";
                           
        setTheme(targetTheme);
    }, []);

    const setTheme = (key: ThemeKey) => {
        setThemeState(key);
        localStorage.setItem("obd-theme", key);
        applyTheme(key);
    };

    const applyTheme = (key: ThemeKey) => {
        const c = themes[key];
        const root = document.documentElement;
        
        root.style.setProperty("--primary", c.primary);
        root.style.setProperty("--secondary", c.secondary);
        root.style.setProperty("--accent", c.accent);
        root.style.setProperty("--bg-primary", c.bg);
        root.style.setProperty("--bg-card", c.bgCard);
        root.style.setProperty("--text-primary", c.textPrimary);
        root.style.setProperty("--text-secondary", c.textSecondary);
        root.style.setProperty("--text-muted", c.textMuted);
        root.style.setProperty("--line", c.border);
        root.style.setProperty("--input-bg", c.inputBg);
        
        root.setAttribute("data-theme", key);
        
        if (c.isDark) {
            root.classList.add("dark");
        } else {
            root.classList.remove("dark");
        }
    };

    useEffect(() => {
        applyTheme(theme);
    }, [theme]);

    return (
        <ThemeContext.Provider value={{ theme, t: themes[theme], setTheme, allThemes: themes }}>
            {children}
        </ThemeContext.Provider>
    );
}
