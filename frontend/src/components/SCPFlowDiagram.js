import { useState, useRef, useMemo, useCallback, useEffect } from "react";

const getApiBase = () => {
  if (typeof window === "undefined") return "http://localhost:8000";
  const { hostname, port } = window.location;
  if (port === '8000' || port === '' || port === '443') return '';
  if (hostname === "localhost" || hostname === "127.0.0.1") return "http://localhost:8000";
  return `http://${hostname}:8000`;
};
const API_BASE = getApiBase();

// ─── Themes ───────────────────────────────────────────────────────────────────
const THEMES = {
  dark: {
    name: "Dark", icon: "🌑",
    appBg: "#0b1220", headerBg: "#0e1829", panelBg: "#0d1726", tabBg: "#0c1522",
    borderCol: "#1c2e47", canvasBg: "#0b1220", dotCol: "#111f33",
    textH1: "#e8f4ff", textH2: "#8aafd4", textH3: "#4d7299", textFaint: "#253d55",
    rowAlt: "rgba(255,255,255,0.035)", rowHdr: "#111f33",
    nodeTypes: {
      Start: { c: "#34d399", bg: "#052013", b: "#059669" }, Exit: { c: "#f87171", bg: "#1a0808", b: "#dc2626" },
      Navigation: { c: "#60a5fa", bg: "#071828", b: "#2563eb" }, Play: { c: "#2dd4bf", bg: "#051a17", b: "#0d9488" },
      Database: { c: "#fbbf24", bg: "#1c1206", b: "#d97706" }, URL: { c: "#4ade80", bg: "#051a0b", b: "#16a34a" },
      Processing: { c: "#c084fc", bg: "#120920", b: "#9333ea" },
    },
    edges: { DTMF: "#34d399", DB: "#fb923c", Normal: "#3b82f6" }, arrowFill: "#3b82f6",
  },
  light: {
    name: "Light", icon: "☀️",
    appBg: "#f1f5f9", headerBg: "#ffffff", panelBg: "#ffffff", tabBg: "#f8fafc",
    borderCol: "#cbd5e1", canvasBg: "#e8eef6", dotCol: "#c8d8e8",
    textH1: "#0f172a", textH2: "#334155", textH3: "#64748b", textFaint: "#94a3b8",
    rowAlt: "rgba(0,0,0,0.03)", rowHdr: "#f1f5f9",
    nodeTypes: {
      Start: { c: "#047857", bg: "#ecfdf5", b: "#059669" }, Exit: { c: "#b91c1c", bg: "#fef2f2", b: "#dc2626" },
      Navigation: { c: "#1d4ed8", bg: "#eff6ff", b: "#2563eb" }, Play: { c: "#0f766e", bg: "#f0fdfa", b: "#0d9488" },
      Database: { c: "#b45309", bg: "#fffbeb", b: "#d97706" }, URL: { c: "#15803d", bg: "#f0fdf4", b: "#16a34a" },
      Processing: { c: "#7e22ce", bg: "#faf5ff", b: "#9333ea" },
    },
    edges: { DTMF: "#059669", DB: "#ea580c", Normal: "#2563eb" }, arrowFill: "#2563eb",
  },
};

// ─── Node catalog ─────────────────────────────────────────────────────────────
const NODE_CATEGORIES = [
  { id: "flow", label: "Flow Control", icon: "▶", color: "#34d399" },
  { id: "audio", label: "Audio & Playback", icon: "♪", color: "#60a5fa" },
  { id: "input", label: "Input & Collection", icon: "🔢", color: "#fbbf24" },
  { id: "telephony", label: "Telephony", icon: "📞", color: "#f87171" },
  { id: "api", label: "API & Logic", icon: "⇡", color: "#4ade80" },
  { id: "branching", label: "Branching & Logic", icon: "⬡", color: "#fb923c" },
  { id: "recording", label: "Recording", icon: "⏺", color: "#c084fc" },
  { id: "content", label: "Content & Misc", icon: "📦", color: "#2dd4bf" },
];
const ALL_NODES = [
  { name: "Start", cat: "flow", desc: "Entry point of every IVR flow. Configures call type, service, short code, language and session.", params: ["calltype", "service", "shortcode", "defaultlang", "autoanswer", "exittimer"] },
  { name: "Exit", cat: "flow", desc: "Terminates the call and releases the channel.", params: ["releasereason"] },
  { name: "GoTo", cat: "flow", desc: "Unconditional jump to another node by cell ID.", params: ["jumpFor"] },
  { name: "JumpFor", cat: "flow", desc: "Conditional jump to a target node based on a bookmark or variable.", params: ["jumpFor"] },
  { name: "ExternalFlow", cat: "flow", desc: "Delegates execution to an external SCP flow file.", params: ["cellId"] },
  { name: "NavigationPrompt", cat: "audio", desc: "Plays a prompt and optionally collects DTMF. Core menu/announcement node.", params: ["promptfile", "timeout", "repeatcount", "bargein", "voicedetection", "dtmf"] },
  { name: "MultiPlay", cat: "audio", desc: "Plays a list of audio files with prev/next navigation and bookmark support.", params: ["repeatcount", "nextdtmf", "previousdtmf", "seekdtmf", "random", "seek"] },
  { name: "PlayContent", cat: "audio", desc: "Plays a content file with random play and repeat options.", params: ["contentFile", "randomplay", "repeatcount", "nextdtmf", "previousdtmf"] },
  { name: "DynamicPlay", cat: "audio", desc: "Plays audio dynamically from a DB-driven list with chapter navigation.", params: ["repeatcount", "nextdtmf", "previousdtmf"] },
  { name: "PlayFileFromUrl", cat: "audio", desc: "Fetches and plays an audio file from a remote URL at runtime.", params: ["serviceName", "modeOfCall", "timeout", "methodCallingType"] },
  { name: "Playstreaming", cat: "audio", desc: "Streams live audio with barge-in and timeout control.", params: ["bargein", "timeout", "url"] },
  { name: "Live", cat: "audio", desc: "Plays a live streaming service by service ID.", params: ["liveService", "nextDtmf", "previousDtmf"] },
  { name: "CrbtContentPlay", cat: "audio", desc: "Plays CRBT content via a dedicated URL.", params: ["crbturltextfield", "timeout", "crbtmodeofcall"] },
  { name: "ReadNumber", cat: "audio", desc: "Reads a number, date or score as audio digits.", params: ["readnumber", "contentFile", "singleDigit", "useOrdinal"] },
  { name: "DigitCollect", cat: "input", desc: "Collects DTMF digits with min/max length, timeout and termination character.", params: ["maxlen", "minlen", "timeout", "terminationchar", "confirmation", "digittype"] },
  { name: "Listener", cat: "input", desc: "Listens for caller DTMF or voice input.", params: ["timer", "silentTime"] },
  { name: "Validation", cat: "input", desc: "Validates A-party/B-party number format against IOC codes and length constraints.", params: ["ioccode", "countrycode", "bpartylength", "apartylength"] },
  { name: "Transfer", cat: "telephony", desc: "Transfers the active call to a new B-party number.", params: ["bpartydialnumber"] },
  { name: "Dial", cat: "telephony", desc: "Dials out to an external number with optional cut-on-ringing.", params: ["dialOut", "dialouttime", "cutonringing", "resourceUrl"] },
  { name: "Answer", cat: "telephony", desc: "Answers an incoming call.", params: ["recordFilePath"] },
  { name: "ConferenceCall", cat: "telephony", desc: "Sets up a multi-party conference call.", params: ["promptfile", "maxUsers", "nextListenerDtmf"] },
  { name: "ConferenceCallNew", cat: "telephony", desc: "Enhanced conference call with dynamic listener timer.", params: ["promptfile", "maxUsers"] },
  { name: "ConferenceCallBeta", cat: "telephony", desc: "Beta conference call with experimental features.", params: ["promptfile", "maxUsers"] },
  { name: "Patch", cat: "telephony", desc: "Bridges two call legs together.", params: ["patchWith"] },
  { name: "UnPatch", cat: "telephony", desc: "Removes the patch between two call legs.", params: [] },
  { name: "CheckCall", cat: "telephony", desc: "Checks the current call status before routing.", params: ["name"] },
  { name: "Url", cat: "api", desc: "Makes an HTTP API call (Subscription, Billing, SMS, CRBT, Generic etc.).", params: ["urltype", "method", "mode", "url", "responsetype"] },
  { name: "GenericAPIActionHandler", cat: "api", desc: "Advanced generic API handler with field mapping and JSON transformation.", params: ["genericApiBaseUrl", "genericApiMethodType", "genericApiSuccessCriteria"] },
  { name: "Processing", cat: "api", desc: "Executes a server-side action: SetLanguage, SetVoiceEffect, SetVariable and more.", params: ["processing", "setlanguage", "setvoiceeffect"] },
  { name: "CheckDB", cat: "api", desc: "Queries the database for subscriber status, blacklist, language and more.", params: ["checkdb", "servicename", "value"] },
  { name: "UserTracker", cat: "api", desc: "Tracks unique user visits and call counts per session.", params: ["bitSet"] },
  { name: "RTStatus", cat: "api", desc: "Checks real-time service status before routing.", params: [] },
  { name: "Wait", cat: "api", desc: "Pauses the flow waiting for B-party DTMF or sub-event.", params: ["noOfAcceptableBpartyDtmfs"] },
  { name: "Randomizer", cat: "branching", desc: "Generates a random DTMF digit or routes calls randomly within a range.", params: ["Dtmfmintime", "dtmfmaxtime", "generateDTMF", "percentage"] },
  { name: "Probability", cat: "branching", desc: "Routes calls to different branches based on probability percentages.", params: ["objectType", "probability"] },
  { name: "PercentageCalculator", cat: "branching", desc: "Splits traffic across up to 8 service paths using percentage weights.", params: ["percentageOfService1", "percentageOfService2"] },
  { name: "StartTimer", cat: "branching", desc: "Starts a named timer that fires after a configurable interval.", params: ["timerCellId", "timerValue", "chargeTimerValue"] },
  { name: "StartRecord", cat: "recording", desc: "Begins recording call audio with configurable end DTMF and Magic Parrot.", params: ["timeout", "recordFilePath", "recordenddtmf", "recordbg"] },
  { name: "StopRecord", cat: "recording", desc: "Stops an active recording session.", params: [] },
  { name: "MagicParrotCheck", cat: "recording", desc: "Checks if a Magic Parrot recording sample passes quality criteria.", params: ["sampleCheckTimer", "voiceEffect", "exitDtmf"] },
  { name: "Assistant", cat: "content", desc: "AI assistant node with TTS support.", params: ["ttsLangCode", "ttsLangName"] },
  { name: "Fyndr", cat: "content", desc: "Fyndr service integration for content discovery.", params: [] },
  { name: "Resources", cat: "content", desc: "Declares and manages shared resources across the flow.", params: [] },
  { name: "Vxml", cat: "content", desc: "Integrates a VXML endpoint into the SCP flow.", params: ["url"] },
  { name: "Quiz", cat: "content", desc: "Runs an interactive quiz with scoring and winner detection.", params: [] },
];

// ─── SCP XML schema — exact format from CoreEngine_4.jar ──────────────────────
// Each node type's style, imageName, xmlParamsData, and param schema
const SCP_NODE_SCHEMA = {
  Start: {
    style: "image;image=mxgraph/stencils/clipart/Start_128x128.png", imageName: "Start", xmlParamsData: "x", xmlFileData: null,
    params: [
      { id: "servicedescription", n: "Description", type: "textbox", defaultVal: "" },
      { id: "calltype", n: "Call Type", type: "select", defaultVal: "IVR" },
      { id: "exittimer", n: "Exit Timer", type: "textbox", defaultVal: "0" },
      { id: "service", n: "Service Name", type: "textbox", defaultVal: "" },
      { id: "shortcode", n: "Short Code", type: "textbox", defaultVal: "" },
      { id: "autoanswer", n: "Auto Answer", type: "checkbox", defaultVal: "true" },
      { id: "defaultlang", n: "Default Language", type: "select", defaultVal: "_E" },
    ]
  },
  Navigation: {
    style: "image;image=mxgraph/stencils/clipart/Navigation_128x128.png", imageName: "Navigation", xmlParamsData: "x|mxgraph/NP.html", xmlFileData: "",
    params: [
      { id: "servicedescription", n: "Description", type: "textbox", defaultVal: "" },
      { id: "promptfile", n: "File/s", type: "selectmul", defaultVal: "" },
      { id: "bargein", n: "Barge In", type: "checkbox", defaultVal: "true" },
      { id: "voicedetection", n: "Voice Detection", type: "checkbox", defaultVal: "false" },
      { id: "timeout", n: "Timeout (sec)", type: "textbox", defaultVal: "0" },
      { id: "repeatcount", n: "Repeat Count", type: "textbox", defaultVal: "0" },
    ]
  },
  Play: {
    style: "image;image=mxgraph/stencils/clipart/Play_128x128.png", imageName: "Play", xmlParamsData: "x|mxgraph/PlayContent.html", xmlFileData: "",
    params: [
      { id: "servicedescription", n: "Description", type: "textbox", defaultVal: "" },
      { id: "contentlist", n: "Content Files", type: "selectmul", defaultVal: "" },
      { id: "seek", n: "Seek", type: "checkbox", defaultVal: "false" },
      { id: "resetbytes", n: "Reset Bytes", type: "checkbox", defaultVal: "false" },
      { id: "randomplay", n: "Random Play", type: "checkbox", defaultVal: "false" },
      { id: "previousdtmf", n: "Previous DTMF", type: "textbox", defaultVal: "0" },
      { id: "nextdtmf", n: "Next DTMF", type: "textbox", defaultVal: "0" },
      { id: "repeatcount", n: "Repeat Count", type: "textbox", defaultVal: "0" },
      { id: "repeatcurrent", n: "Repeat Current DTMF", type: "textbox", defaultVal: "0" },
      { id: "wheeloffortune", n: "Wheel Of Fortune", type: "checkbox", defaultVal: "false" },
    ]
  },
  Database: {
    style: "image;image=mxgraph/stencils/clipart/Database_128x128.png", imageName: "Database", xmlParamsData: "x", xmlFileData: null,
    params: [
      { id: "servicedescription", n: "Description", type: "textbox", defaultVal: "" },
      { id: "checkdb", n: "Check DB", type: "select", defaultVal: "GetUserDetail" },
      { id: "servicename", n: "Service Name", type: "textbox", defaultVal: "" },
      { id: "bpartyminlength", n: "B-Party Min Length", type: "textbox", defaultVal: "0" },
    ]
  },
  URL: {
    style: "image;image=mxgraph/stencils/clipart/URL_128x128.png", imageName: "URL", xmlParamsData: "x", xmlFileData: null,
    params: [
      { id: "servicedescription", n: "Description", type: "textbox", defaultVal: "" },
      { id: "callmode", n: "Call Mode", type: "select", defaultVal: "Asynchronous" },
      { id: "synchronous", n: "Timeout (sec)", type: "textbox", defaultVal: "0" },
      { id: "urltype", n: "URL Type", type: "select", defaultVal: "Subscription" },
      { id: "subservicename", n: "Sub-Service Name", type: "textbox", defaultVal: "" },
      { id: "url", n: "URL", type: "textbox", defaultVal: "" },
      { id: "method", n: "Method", type: "select", defaultVal: "Get" },
      { id: "urlresptype", n: "Response Type", type: "select", defaultVal: "Text" },
    ]
  },
  Processing: {
    style: "image;image=mxgraph/stencils/clipart/Processing_128x128.png", imageName: "Processing", xmlParamsData: "x", xmlFileData: null,
    params: [
      { id: "servicedescription", n: "Description", type: "textbox", defaultVal: "" },
      { id: "processing", n: "Processing", type: "select", defaultVal: "SetLanguage" },
      { id: "setlanguage", n: "Set Language", type: "select", defaultVal: "_E" },
      { id: "setvoiceeffect", n: "Set Voice Effect", type: "textbox", defaultVal: "101" },
    ]
  },
  Exit: {
    style: "image;image=mxgraph/stencils/clipart/Exit_128x128.png", imageName: "Exit", xmlParamsData: null, xmlFileData: null,
    params: []
  },
};

// Edge schemas
const EDGE_STYLES = {
  Normal: "edgeStyle=elbowEdgeStyle;elbow=horizontal;strokeWidth=3;strokeColor=grey;exitX=1;exitY=0.5;entryX=0;entryY=0.5",
  DTMF: "edgeStyle=elbowEdgeStyle;elbow=horizontal;strokeWidth=3;strokeColor=green;exitX=1;exitY=0.5;entryX=0;entryY=0.5",
  DB: "edgeStyle=elbowEdgeStyle;elbow=horizontal;strokeWidth=3;strokeColor=red;exitX=1;exitY=0.5;entryX=0;entryY=0.5",
};

// ─── XML Generator — produces CoreEngine_4.jar-compatible mxGraphModel XML ────
function buildParamXml(paramId, paramName, paramType, value) {
  return `            <rec>
              <id>
${paramId}              </id>
              <n>
${paramName}              </n>
              <type>
${paramType}              </type>
              <dependency>
                <id>
null                </id>
                <value>
null                </value>
                <action>
null                </action>
              </dependency>
              <values>
                <value dependency="null">
${value}                </value>
              </values>
            </rec>`;
}

function buildNodeXml(node, idCounter) {
  const schema = SCP_NODE_SCHEMA[node.type];
  if (!schema) return "";
  const cellId = idCounter;
  const x = node.x ?? 100;
  const y = node.y ?? 100;
  const w = 100, h = 100;

  // Build params
  const paramLines = schema.params.map(p => {
    const val = node.params?.[p.id] ?? p.defaultVal;
    return buildParamXml(p.id, p.n, p.type, val);
  }).join("\n");

  const fileDataAttr = schema.xmlFileData !== null ? ` xmlFileData="${schema.xmlFileData}"` : "";
  const paramsDataAttr = schema.xmlParamsData ? ` xmlParamsData="${schema.xmlParamsData}"` : "";

  if (node.type === "Exit") {
    return `    <mxCell id="${cellId}" value="${node.label || ""}" style="${schema.style}" parent="1" vertex="1" imageName="${schema.imageName}" type="Exit">
      <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>
    </mxCell>`;
  }

  const mxParamsBlock = schema.params.length > 0 ? `
      <mxParams as="params">
        <recs>
${paramLines}
        </recs>
      </mxParams>` : "";

  return `    <mxCell id="${cellId}" value="${node.label || ""}" style="${schema.style}" parent="1" vertex="1" imageName="${schema.imageName}" type="${node.type}"${fileDataAttr}${paramsDataAttr}>
      <mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/>${mxParamsBlock}
    </mxCell>`;
}

function buildEdgeXml(edge, idCounter) {
  const style = EDGE_STYLES[edge.type] || EDGE_STYLES.Normal;
  const valueAttr = edge.label || "";
  const typeAttr = edge.type;
  const paramsXml = (edge.type === "DTMF" || edge.type === "DB") ? `
      <mxParams as="params">
        <recs>
${buildParamXml("value", "Display", "textbox", edge.label || "")}
${edge.type === "DTMF" ? buildParamXml("dtmf", "DTMF", "select", edge.label || "Any") : buildParamXml("dbconnector", "DB Connector", "select", edge.connector || "GetUserDetail")}
        </recs>
      </mxParams>` : "";
  return `    <mxCell id="${idCounter}" value="${valueAttr}" style="${style}" parent="1" source="${edge.source}" target="${edge.target}" edge="1" type="${typeAttr}"${edge.type !== "Normal" ? ' xmlParamsData="x"' : ""}>
      <mxGeometry x="0" y="0" width="100" height="100" as="geometry">
        <mxPoint as="sourcePoint"/>
        <mxPoint as="targetPoint"/>
      </mxGeometry>${paramsXml}
    </mxCell>`;
}

function generateSCPXml(flowName, nodes, edges) {
  const header = `<?xml version="1.0" encoding="UTF-8"?>
<mxGraphModel scale="0.694" grid="1" guides="1" tooltips="1" connect="1" fold="1" page="0" pageScale="1" pageWidth="826" pageHeight="1169">
  <root>
    <mxCell id="0"/>
    <mxCell id="1" parent="0"/>`;

  let idCounter = 2;
  const idMap = {};
  nodes.forEach(n => { idMap[n.id] = idCounter++; });

  const nodeXmls = nodes.map(n => buildNodeXml({ ...n, x: n.x, y: n.y }, idMap[n.id]));
  const edgeXmls = edges.map(e => buildEdgeXml({ ...e, source: idMap[e.source], target: idMap[e.target] }, idCounter++));

  return header + "\n" + nodeXmls.join("\n") + "\n" + edgeXmls.join("\n") + "\n  </root>\n</mxGraphModel>";
}

// ─── AI-powered flow parser (calls Claude API) ────────────────────────────────
async function parseFlowWithAI(inputText, inputType) {
  const resp = await fetch(`${API_BASE}/generate-scp-flow`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ doc_text: inputText })
  });
  if (!resp.ok) {
    const err = await resp.json();
    throw new Error(err.detail || "AI Generation failed");
  }
  return await resp.json();
}

// ─── Node metadata for diagram rendering ─────────────────────────────────────
const NODE_META = {
  Start: { icon: "▶", label: "Start", diamond: false }, Exit: { icon: "■", label: "Exit", diamond: false },
  Navigation: { icon: "♪", label: "Navigation", diamond: false }, Play: { icon: "▶▶", label: "Play", diamond: false },
  Database: { icon: "⬡", label: "Database", diamond: true }, URL: { icon: "⇡", label: "URL", diamond: false },
  Processing: { icon: "⚙", label: "Processing", diamond: false },
};
const NODE_ROWS = {
  Navigation: [
    { key: "promptfile", icon: "🎵", label: "Prompt", fmt: v => v === "1" ? "(not set)" : v.replace(/^\d+-/, "").split("/").pop() },
    { key: "timeout", icon: "⏱", label: "Timeout", fmt: v => v && v !== "0" ? v + "s" : null },
    { key: "repeatcount", icon: "🔁", label: "Repeat", fmt: v => v && v !== "0" ? "×" + v + " times" : null },
    { key: "bargein", icon: "↩", label: "Barge-in", fmt: v => v === "true" ? "Enabled" : null },
    { key: "dtmf", icon: "🔢", label: "DTMF", fmt: v => v && v !== "Any" ? "Key: " + v : v === "Any" ? "Any key" : null },
  ],
  Play: [
    { key: "contentlist", icon: "🎵", label: "Content", fmt: v => v.replace(/^\d+-/, "").split("/").pop() },
    { key: "seek", icon: "⏩", label: "Seek", fmt: v => v === "true" ? "Enabled" : null },
    { key: "previousdtmf", icon: "◀", label: "Prev", fmt: v => v && v !== "0" ? "DTMF: " + v : null },
    { key: "nextdtmf", icon: "▶", label: "Next", fmt: v => v && v !== "0" ? "DTMF: " + v : null },
    { key: "repeatcurrent", icon: "🔁", label: "Repeat", fmt: v => v && v !== "0" ? "DTMF: " + v : null },
  ],
  Database: [
    { key: "checkdb", icon: "🗄", label: "Check", fmt: v => v },
    { key: "servicename", icon: "📋", label: "Service", fmt: v => v },
    { key: "value", icon: "📌", label: "Result", fmt: v => v && v !== "Any" ? v : null },
  ],
  URL: [
    { key: "urltype", icon: "📡", label: "Type", fmt: v => v },
    { key: "callmode", icon: "⚡", label: "Mode", fmt: v => v },
    { key: "method", icon: "🔧", label: "Method", fmt: v => v },
    { key: "url", icon: "🔗", label: "Endpoint", fmt: v => { const m = v.match(/:\d+(.+?)(?:\?|$)/); return m ? "…" + m[1] : v.slice(-28); } },
  ],
  Processing: [
    { key: "processing", icon: "⚙", label: "Action", fmt: v => v },
    { key: "setlanguage", icon: "🌐", label: "Lang", fmt: v => v === "_A" ? "Arabic" : v === "_E" ? "English" : v },
  ],
  Start: [
    { key: "calltype", icon: "📞", label: "Call Type", fmt: v => v },
    { key: "service", icon: "🏷", label: "Service", fmt: v => v },
    { key: "shortcode", icon: "#", label: "Short Code", fmt: v => v },
    { key: "defaultlang", icon: "🌐", label: "Lang", fmt: v => v === "_A" ? "Arabic" : v === "_E" ? "English" : v },
  ],
  Exit: [],
};
const NW = 260, ROW_H = 18, HEADER_H = 48, FOOTER_H = 12, H_GAP = 75, V_GAP = 35;
function calcNodeH(type, params) {
  if (type === "Exit") return 44;
  if (NODE_META[type]?.diamond) return 76;
  const rows = (NODE_ROWS[type] || []).filter(r => { const v = params?.[r.key]; return v && r.fmt(v, params) !== null; });
  return HEADER_H + Math.max(type === "Start" ? 4 : 1, rows.length) * ROW_H + FOOTER_H;
}

// ─── XML Parser ───────────────────────────────────────────────────────────────
function parseXML(xmlText) {
  const esc = s => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  // Fix malformed attribute spacing (common in older generated flows)
  const sanitized = xmlText.trim().replace(/"([a-zA-Z0-9_-]+)=/g, '" $1=');
  const doc = new DOMParser().parseFromString(sanitized, "application/xml");
  const pErr = doc.querySelector("parsererror");
  if (pErr) {
    console.error("XML Parse Error:", pErr.textContent);
    throw new Error("Invalid XML: " + pErr.textContent.split("\n")[0]);
  }
  const rawNodes = [], edges = [], nodeIds = new Set();
  doc.querySelectorAll("mxCell").forEach(cell => {
    const id = (cell.getAttribute("id") || "").trim();
    const value = (cell.getAttribute("value") || "").trim();
    const type = cell.getAttribute("type") || "";
    const style = cell.getAttribute("style") || "";
    const isExit = type === "Exit" || style.includes("Exit_128x128");
    if (!id || id === "0" || id === "1") return;
    if (cell.getAttribute("edge") === "1") {
      const src = cell.getAttribute("source"), tgt = cell.getAttribute("target");
      if (src && tgt) edges.push({ id, label: value, source: src, target: tgt, etype: type || "Normal" });
    } else if (cell.getAttribute("vertex") === "1") {
      const nodeType = isExit ? "Exit" : (NODE_META[type] ? type : "Navigation");
      const geo = cell.querySelector("mxGeometry");
      const origX = geo ? parseFloat(geo.getAttribute("x") || 0) : 0;
      const origY = geo ? parseFloat(geo.getAttribute("y") || 0) : 0;
      const params = {};
      cell.querySelectorAll("rec").forEach(rec => {
        const p = rec.querySelector("id"), v = rec.querySelector("values > value");
        if (p && v) { const raw = v.textContent.trim(); if (raw && raw !== "null" && raw !== "SELECT") params[p.textContent.trim()] = raw; }
      });
      rawNodes.push({ id, label: value || nodeType, type: nodeType, origX, origY, params });
      nodeIds.add(id);
    }
  });
  const validEdges = edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));
  rawNodes.forEach(n => { n.h = calcNodeH(n.type, n.params); n.w = NW; });
  const layers = {};
  rawNodes.forEach(n => { layers[n.id] = 0; });
  for (let i = 0; i < 80; i++)validEdges.forEach(e => { if (layers[e.source] + 1 > layers[e.target]) layers[e.target] = layers[e.source] + 1; });
  const ul = [...new Set(Object.values(layers))].sort((a, b) => a - b);
  const lm = {}; ul.forEach((l, i) => lm[l] = i);
  rawNodes.forEach(n => { n.layer = lm[layers[n.id]] || 0; });
  const byLayer = {};
  rawNodes.forEach(n => { if (!byLayer[n.layer]) byLayer[n.layer] = []; byLayer[n.layer].push(n); });
  Object.values(byLayer).forEach(ns => ns.sort((a, b) => a.origX - b.origX));
  const sortedLayers = Object.keys(byLayer).map(Number).sort((a, b) => a - b);
  const layerMaxH = {}; sortedLayers.forEach(l => { layerMaxH[l] = Math.max(...byLayer[l].map(n => n.h)); });
  const layerY = {}; let curY = 70;
  sortedLayers.forEach(l => { layerY[l] = curY; curY += layerMaxH[l] + V_GAP; });
  rawNodes.forEach(n => { const arr = byLayer[n.layer]; n.lx = 70 + arr.indexOf(n) * (NW + H_GAP); n.ly = layerY[n.layer]; });
  return { nodes: rawNodes, edges: validEdges };
}

// ─── SVG Node ─────────────────────────────────────────────────────────────────
function SvgNode({ n, sel, onSel, th }) {
  const meta = NODE_META[n.type] || NODE_META.Navigation;
  const tc = th.nodeTypes[n.type] || th.nodeTypes.Navigation;
  const { x, y, w, h } = n, cx = x + w / 2;
  const rows = (NODE_ROWS[n.type] || []).map(r => { const v = n.params?.[r.key]; if (!v) return null; const f = r.fmt(v, n.params); return f ? { ...r, f } : null; }).filter(Boolean);
  const isRound = n.type === "Start" || n.type === "Exit";
  if (meta.diamond) { const hw = w / 2 + 14, hh = h / 2, bcy = y + hh; return (<g onClick={() => onSel(n)} style={{ cursor: "pointer" }}><polygon points={`${cx},${y - 5} ${cx + hw},${bcy} ${cx},${y + h + 5} ${cx - hw},${bcy}`} fill={tc.bg} stroke={sel ? tc.c : tc.b} strokeWidth={sel ? 2.5 : 1.5} /><text x={cx} y={bcy - 13} textAnchor="middle" fill={tc.c} fontSize={18} fontWeight="700" fontFamily="'JetBrains Mono',monospace">{meta.icon} {n.label.slice(0, 16)}</text><text x={cx} y={bcy + 2} textAnchor="middle" fill={th.textH2} fontSize={15} fontFamily="monospace" opacity={0.7}>{meta.label}</text>{rows[0] && <text x={cx} y={bcy + 16} textAnchor="middle" fill={tc.c} fontSize={14} fontFamily="monospace">{rows[0].icon} {rows[0].f.slice(0, 24)}</text>}</g>); }
  const lbl = n.label.length > 25 ? n.label.slice(0, 23) + "…" : n.label;
  return (<g onClick={() => onSel(n)} style={{ cursor: "pointer" }}>
    <rect x={x + 3} y={y + 3} width={w} height={h} rx={isRound ? h / 2 : 9} fill="rgba(0,0,0,0.18)" />
    <rect x={x} y={y} width={w} height={h} rx={isRound ? h / 2 : 9} fill={tc.bg} stroke={sel ? tc.c : tc.b} strokeWidth={sel ? 2.5 : 1.5} />
    {isRound ? (<><text x={cx} y={y + h / 2 - 5} textAnchor="middle" fill={tc.c} fontSize={16} fontWeight="700" fontFamily="'JetBrains Mono',monospace">{meta.icon} {lbl}</text><text x={cx} y={y + h / 2 + 10} textAnchor="middle" fill={th.textH3} fontSize={15} fontFamily="monospace">{meta.label}</text></>) : (<>
      <rect x={x} y={y} width={4} height={HEADER_H} rx={9} fill={tc.c} />
      <text x={x + 14} y={y + 15} fill={tc.c} fontSize={18} fontWeight="700" fontFamily="'JetBrains Mono',monospace">{lbl}</text>
      <rect x={x + 14} y={y + 21} width={meta.label.length * 6 + 10} height={13} rx={3} fill={tc.c + "22"} stroke={tc.c + "44"} strokeWidth={0.8} />
      <text x={x + 18} y={y + 31} fill={th.textH2} fontSize={14} fontFamily="monospace" fontWeight="600">{meta.label}</text>
      <text x={x + w - 6} y={y + 12} textAnchor="end" fill={th.textFaint} fontSize={12} fontFamily="monospace">#{n.id}</text>
      <line x1={x + 4} y1={y + HEADER_H} x2={x + w} y2={y + HEADER_H} stroke={tc.c + "30"} strokeWidth={0.8} />
      {rows.map((row, i) => {
        const ry = y + HEADER_H + i * ROW_H; return (<g key={row.key}>
          {i % 2 === 0 && <rect x={x + 4} y={ry} width={w - 4} height={ROW_H} fill={th.rowAlt} />}
          <text x={x + 9} y={ry + ROW_H - 4} fill={tc.c + "aa"} fontSize={11} fontFamily="monospace">{row.icon}</text>
          <text x={x + 22} y={ry + ROW_H - 4} fill={th.textH3} fontSize={7} fontFamily="monospace">{row.label}</text>
          <line x1={x + 78} y1={ry + 3} x2={x + 78} y2={ry + ROW_H - 2} stroke={tc.c + "25"} strokeWidth={0.6} />
          <text x={x + 83} y={ry + ROW_H - 4} fill={th.textH1} fontSize={7.5} fontFamily="'JetBrains Mono',monospace" fontWeight="600">{row.f.length > 22 ? row.f.slice(0, 20) + "…" : row.f}</text>
        </g>);
      })}
      <line x1={x + 4} y1={y + h - FOOTER_H} x2={x + w} y2={y + h - FOOTER_H} stroke={tc.c + "18"} strokeWidth={0.5} />
    </>)}
  </g>);
}

function SvgEdge({ edge, nm, th }) {
  const s = nm[edge.source], t = nm[edge.target];
  if (!s || !t) return null;
  const sx = s.x + s.w / 2, sy = s.y + s.h / 2, tx = t.x + t.w / 2, ty = t.y + t.h / 2;
  const color = th.edges[edge.etype] || "#446688";
  if (edge.source === edge.target) { return (<g><path d={`M${sx + 18} ${sy - s.h / 2} A 36 24 0 1 1 ${sx - 18} ${sy - s.h / 2}`} fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#arr)" opacity={0.7} />{edge.label && <text x={sx} y={sy - s.h / 2 - 22} textAnchor="middle" fill={color} fontSize={11} fontFamily="monospace" fontWeight="700">{edge.label}</text>}</g>); }
  const mx = (sx + tx) / 2, my = (sy + ty) / 2;
  return (<g><path d={`M${sx} ${sy} C${mx} ${sy},${mx} ${ty},${tx} ${ty}`} fill="none" stroke={color} strokeWidth={1.5} markerEnd="url(#arr)" opacity={0.7} />{edge.label && <text x={mx} y={my - 5} textAnchor="middle" fill={color} fontSize={11} fontFamily="'JetBrains Mono',monospace" fontWeight="700">{edge.label}</text>}</g>);
}

// ─── Inspector ────────────────────────────────────────────────────────────────
function Inspector({ node, edges, nm, onClose, th }) {
  if (!node) return null;
  const meta = NODE_META[node.type] || NODE_META.Navigation;
  const tc = th.nodeTypes[node.type] || th.nodeTypes.Navigation;
  const outs = edges.filter(e => e.source === node.id);
  const ins = edges.filter(e => e.target === node.id);
  const visRows = (NODE_ROWS[node.type] || []).map(r => { const v = node.params?.[r.key]; if (!v) return null; const f = r.fmt(v, node.params); return f ? { ...r, f } : null; }).filter(Boolean);
  const TH = ({ c }) => <th style={{ textAlign: "left", padding: "5px 8px", color: th.textH3, fontSize: 11, fontWeight: "600", letterSpacing: 1, borderBottom: `1px solid ${th.borderCol}`, background: th.rowHdr, fontFamily: "monospace", textTransform: "uppercase" }}>{c}</th>;
  const TD = ({ c, col, mono }) => <td style={{ padding: "5px 8px", color: col || th.textH2, fontSize: 9, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", wordBreak: "break-all", verticalAlign: "top" }}>{c}</td>;
  return (<div style={{ width: 285, background: th.panelBg, borderLeft: `1px solid ${th.borderCol}`, display: "flex", flexDirection: "column", overflow: "hidden", flexShrink: 0 }}>
    <div style={{ padding: "12px 14px", borderBottom: `1px solid ${th.borderCol}`, background: `linear-gradient(135deg,${tc.bg},${th.panelBg})` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <div style={{ width: 32, height: 32, borderRadius: 7, background: tc.bg, border: `2px solid ${tc.b}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: tc.c }}>{meta.icon}</div>
          <div>
            <div style={{ fontSize: 15, fontWeight: "700", color: tc.c, fontFamily: "monospace", maxWidth: 170, wordBreak: "break-word" }}>{node.label || "(unnamed)"}</div>
            <div style={{ display: "flex", gap: 4, marginTop: 4 }}>
              <span style={{ fontSize: 7, padding: "2px 7px", borderRadius: 3, background: tc.c + "22", border: `1px solid ${tc.c}44`, color: tc.c, fontFamily: "monospace", textTransform: "uppercase", letterSpacing: 1 }}>{meta.label}</span>
              <span style={{ fontSize: 7, padding: "2px 7px", borderRadius: 3, background: th.borderCol, color: th.textH3, fontFamily: "monospace" }}>#{node.id}</span>
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: th.textH3, cursor: "pointer", fontSize: 15 }}>✕</button>
      </div>
    </div>
    <div style={{ flex: 1, overflow: "auto", padding: 12, display: "flex", flexDirection: "column", gap: 12 }}>
      {visRows.length > 0 && (<div>
        <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 6, fontFamily: "monospace" }}>Configuration</div>
        <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${th.borderCol}`, borderRadius: 6, overflow: "hidden" }}>
          <thead><tr><TH c="Field" /><TH c="Value" /></tr></thead>
          <tbody>{visRows.map((row, i) => (<tr key={row.key} style={{ background: i % 2 === 0 ? "transparent" : th.rowAlt }}><TD c={`${row.icon} ${row.label}`} col={th.textH3} /><TD c={row.f} col={th.textH1} mono /></tr>))}</tbody>
        </table>
      </div>)}
      {outs.length > 0 && (<div>
        <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5, fontFamily: "monospace" }}>Goes To ({outs.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${th.borderCol}`, borderRadius: 5, overflow: "hidden" }}>
          <thead><tr><TH c="Trigger" /><TH c="Type" /><TH c="Node" /></tr></thead>
          <tbody>{outs.map((e, i) => { const tn = nm[e.target]; const ec = th.edges[e.etype] || th.textH3; const tc2 = tn ? th.nodeTypes[tn.type] || th.nodeTypes.Navigation : null; return (<tr key={e.id} style={{ background: i % 2 === 0 ? "transparent" : th.rowAlt }}><TD c={e.label || "(auto)"} col={ec} mono /><TD c={<span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 2, background: ec + "22", color: ec, fontFamily: "monospace" }}>{e.etype}</span>} /><TD c={`${NODE_META[tn?.type]?.icon || ""} ${tn?.label || "?"}`} col={tc2?.c || th.textH2} mono /></tr>); })}</tbody>
        </table>
      </div>)}
      {ins.length > 0 && (<div>
        <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 2, textTransform: "uppercase", marginBottom: 5, fontFamily: "monospace" }}>Comes From ({ins.length})</div>
        <table style={{ width: "100%", borderCollapse: "collapse", border: `1px solid ${th.borderCol}`, borderRadius: 5, overflow: "hidden" }}>
          <thead><tr><TH c="Trigger" /><TH c="Type" /><TH c="Node" /></tr></thead>
          <tbody>{ins.map((e, i) => { const sn = nm[e.source]; const ec = th.edges[e.etype] || th.textH3; const sc = sn ? th.nodeTypes[sn.type] || th.nodeTypes.Navigation : null; return (<tr key={e.id} style={{ background: i % 2 === 0 ? "transparent" : th.rowAlt }}><TD c={e.label || "(auto)"} col={ec} mono /><TD c={<span style={{ fontSize: 7, padding: "1px 5px", borderRadius: 2, background: ec + "22", color: ec, fontFamily: "monospace" }}>{e.etype}</span>} /><TD c={`${NODE_META[sn?.type]?.icon || ""} ${sn?.label || "?"}`} col={sc?.c || th.textH2} mono /></tr>); })}</tbody>
        </table>
      </div>)}
    </div>
  </div>);
}

// ─── Prompts Tab ──────────────────────────────────────────────────────────────
function PromptsTab({ nodes, th }) {
  const [filter, setFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const promptNodes = useMemo(() => nodes.filter(n => {
    const has = (n.type === "Navigation" && n.params?.promptfile) || (n.type === "Play" && n.params?.contentlist);
    if (!has) return false;
    const path = (n.params?.promptfile || n.params?.contentlist || "").toLowerCase();
    return (!filter || n.label.toLowerCase().includes(filter.toLowerCase()) || path.includes(filter.toLowerCase())) && (typeFilter === "All" || n.type === typeFilter);
  }), [nodes, filter, typeFilter]);
  const nc = nodes.filter(n => n.type === "Navigation" && n.params?.promptfile).length;
  const pc = nodes.filter(n => n.type === "Play" && n.params?.contentlist).length;
  const TH = ({ c, w }) => <th style={{ textAlign: "left", padding: "7px 10px", color: th.textH3, fontSize: 11, fontWeight: "700", letterSpacing: 1.5, textTransform: "uppercase", fontFamily: "monospace", background: th.rowHdr, borderBottom: `2px solid ${th.borderCol}`, whiteSpace: "nowrap", minWidth: w || "auto" }}>{c}</th>;
  return (<div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
    <div style={{ padding: "10px 18px", borderBottom: `1px solid ${th.borderCol}`, background: th.headerBg, display: "flex", gap: 10, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
      {[["All", nc + pc, "#60a5fa"], ["Navigation", nc, "#60a5fa"], ["Play", pc, "#2dd4bf"]].map(([l, v, c]) => (<div key={l} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 10px", borderRadius: 6, background: th.rowHdr, border: `1px solid ${th.borderCol}` }}><span style={{ fontSize: 18, fontWeight: "700", color: c, fontFamily: "monospace" }}>{v}</span><span style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>{l}</span></div>))}
      <div style={{ flex: 1 }} />
      {["All", "Navigation", "Play"].map(t => (<button key={t} onClick={() => setTypeFilter(t)} style={{ padding: "5px 11px", borderRadius: 5, border: `1px solid ${typeFilter === t ? "#3b82f6" : th.borderCol}`, background: typeFilter === t ? "rgba(59,130,246,0.1)" : "transparent", color: typeFilter === t ? "#60a5fa" : th.textH3, fontSize: 9, fontFamily: "monospace", cursor: "pointer", fontWeight: typeFilter === t ? "700" : "400" }}>{t === "All" ? "All" : t === "Navigation" ? "♪ Nav" : "▶▶ Play"}</button>))}
      <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Search…" style={{ padding: "6px 11px", borderRadius: 6, border: `1px solid ${th.borderCol}`, background: th.rowHdr, color: th.textH1, fontSize: 12, fontFamily: "monospace", width: 180, outline: "none" }} />
    </div>
    <div style={{ flex: 1, overflow: "auto" }}>
      {promptNodes.length === 0 ? (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", flexDirection: "column", gap: 8, color: th.textH3 }}><div style={{ fontSize: 28 }}>🎵</div><div style={{ fontSize: 11, fontFamily: "monospace" }}>No prompts found</div></div>) : (
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 5 }}><tr><TH c="#" w="36" /><TH c="Type" w="55" /><TH c="Node Name" w="120" /><TH c="ID" w="50" /><TH c="Filename" /><TH c="Full Path" /><TH c="Timeout" w="60" /><TH c="Repeat" w="60" /><TH c="Barge-in" w="60" /></tr></thead>
          <tbody>{promptNodes.map((n, i) => {
            const tc = th.nodeTypes[n.type] || th.nodeTypes.Navigation;
            const meta = NODE_META[n.type] || NODE_META.Navigation;
            const fullPath = n.params?.promptfile || n.params?.contentlist || "";
            const filename = fullPath.replace(/^\d+-/, "").split("/").pop();
            const td = (ch, col, mono, sm) => <td style={{ padding: "8px 10px", color: col || th.textH2, fontFamily: mono ? "'JetBrains Mono',monospace" : "inherit", fontSize: sm ? 8 : 9.5, borderBottom: `1px solid ${th.borderCol}`, verticalAlign: "middle", wordBreak: "break-all" }}>{ch}</td>;
            return (<tr key={n.id} style={{ background: i % 2 === 0 ? "transparent" : th.rowAlt }}>
              {td(i + 1, th.textH3, false, true)}
              {td(<span style={{ padding: "2px 7px", borderRadius: 4, background: tc.c + "20", border: `1px solid ${tc.c}44`, color: tc.c, fontFamily: "monospace", fontSize: 11, whiteSpace: "nowrap" }}>{meta.icon} {n.type}</span>)}
              {td(n.label, th.textH1, true)}
              {td("#" + n.id, th.textH3, true, true)}
              {td(filename === "1" ? "(not set)" : filename, filename === "1" ? th.textH3 : th.textH1, true)}
              {td(fullPath === "1" ? "—" : fullPath, th.textH3, true, true)}
              {td(n.params?.timeout && n.params.timeout !== "0" ? n.params.timeout + "s" : "—", th.textH3, true, true)}
              {td(n.params?.repeatcount && n.params.repeatcount !== "0" ? "×" + n.params.repeatcount : "—", th.textH3, true, true)}
              {td(n.params?.bargein === "true" ? "Yes" : "—", n.params?.bargein === "true" ? "#34d399" : th.textFaint, false, true)}
            </tr>);
          })}</tbody>
        </table>
      )}
    </div>
    <div style={{ padding: "6px 18px", borderTop: `1px solid ${th.borderCol}`, background: th.headerBg, fontSize: 11, color: th.textH3, fontFamily: "monospace" }}>Showing {promptNodes.length} of {nc + pc} prompt nodes</div>
  </div>);
}

// ─── Flow Builder Tab — interactive canvas with drag, connect, edit, XML export ─
// ─── Builder constants ────────────────────────────────────────────────────────
const B_NODE_W = 144, B_NODE_H = 54;
const B_COLORS = { Start: "#34d399", Exit: "#f87171", Navigation: "#60a5fa", Play: "#2dd4bf", Database: "#fbbf24", URL: "#4ade80", Processing: "#c084fc", DigitCollect: "#fb923c", StartRecord: "#e879f9", Transfer: "#f97316" };
const B_BG = { Start: "rgba(52,211,153,0.13)", Exit: "rgba(248,113,113,0.13)", Navigation: "rgba(96,165,250,0.13)", Play: "rgba(45,212,191,0.13)", Database: "rgba(251,191,36,0.13)", URL: "rgba(74,222,128,0.13)", Processing: "rgba(192,132,252,0.13)", DigitCollect: "rgba(251,146,60,0.13)", StartRecord: "rgba(232,121,249,0.13)", Transfer: "rgba(249,115,22,0.13)" };
const B_EDGE_COLORS = { DTMF: "#34d399", DB: "#fb923c", Normal: "#6b7280" };
const B_PARAMS_SCHEMA = {
  Start: { fields: [{ k: "service", l: "Service Name" }, { k: "shortcode", l: "Short Code" }, { k: "calltype", l: "Call Type", opts: ["IVR", "OBD"] }, { k: "defaultlang", l: "Default Lang", opts: ["_E", "_A", "_MN"] }] },
  Navigation: { fields: [{ k: "promptfile", l: "Prompt File" }, { k: "timeout", l: "Timeout (s)" }, { k: "repeatcount", l: "Repeat Count" }, { k: "bargein", l: "Barge In", opts: ["true", "false"] }] },
  Play: { fields: [{ k: "contentlist", l: "Content File" }, { k: "nextdtmf", l: "Next DTMF" }, { k: "previousdtmf", l: "Prev DTMF" }, { k: "repeatcurrent", l: "Repeat DTMF" }, { k: "randomplay", l: "Random", opts: ["false", "true"] }] },
  Database: { fields: [{ k: "checkdb", l: "Check DB", opts: ["GetUserDetail", "GetLanguage", "GetBPartyStatus"] }, { k: "servicename", l: "Service Name" }] },
  URL: { fields: [{ k: "urltype", l: "URL Type", opts: ["Subscription", "Unsubscription", "Generic", "SMS", "Billing"] }, { k: "url", l: "URL" }, { k: "method", l: "Method", opts: ["Get", "Post"] }, { k: "callmode", l: "Call Mode", opts: ["Synchronous", "Asynchronous"] }] },
  Processing: { fields: [{ k: "processing", l: "Action", opts: ["SetLanguage", "SetVoiceEffect", "SetUserDefinedVariable"] }, { k: "setlanguage", l: "Set Language", opts: ["_E", "_A", "_MN"] }] },
  DigitCollect: { fields: [{ k: "maxlen", l: "Max Length" }, { k: "minlen", l: "Min Length" }, { k: "timeout", l: "Timeout (s)" }, { k: "terminationchar", l: "Term Char" }] },
  StartRecord: { fields: [{ k: "timeout", l: "Timeout (s)" }, { k: "recordFilePath", l: "File Path" }, { k: "recordenddtmf", l: "End DTMF" }] },
  Transfer: { fields: [{ k: "bpartydialnumber", l: "Dial Number" }] },
  Exit: { fields: [] }
};

// ─── XML helpers (JAR-exact schema) ──────────────────────────────────────────
function bRecBlock(pid, pname, ptype, val) {
  return `          <rec>\n            <id>\n${pid}            </id>\n            <n>\n${pname}            </n>\n            <type>\n${ptype}            </type>\n            <dependency><id>\nnull            </id><value>\nnull            </value><action>\nnull            </action></dependency>\n            <values><value dependency="null">\n${val}            </value></values>\n          </rec>`;
}
function bNodeToXml(n) {
  const STYLES = { Start: "image;image=mxgraph/stencils/clipart/Start_128x128.png", Exit: "image;image=mxgraph/stencils/clipart/Exit_128x128.png", Navigation: "image;image=mxgraph/stencils/clipart/Navigation_128x128.png", Play: "image;image=mxgraph/stencils/clipart/Play_128x128.png", Database: "image;image=mxgraph/stencils/clipart/Database_128x128.png", URL: "image;image=mxgraph/stencils/clipart/URL_128x128.png", Processing: "image;image=mxgraph/stencils/clipart/Processing_128x128.png", DigitCollect: "image;image=mxgraph/stencils/clipart/DigitCollect_128x128.png", StartRecord: "image;image=mxgraph/stencils/clipart/StartRecord_128x128.png", Transfer: "image;image=mxgraph/stencils/clipart/Transfer_128x128.png" };
  const XMLPARAMS = { Navigation: "x|mxgraph/NP.html", Play: "x|mxgraph/PlayContent.html", Start: "x", Database: "x", URL: "x", Processing: "x", DigitCollect: "x", StartRecord: "x", Transfer: "x" };
  const XMLFILE = { Navigation: "", Play: "" };
  const style = STYLES[n.type] || STYLES.Navigation;
  
  const xpd = XMLPARAMS[n.type] ? `xmlParamsData="${XMLPARAMS[n.type]}"` : "";
  const xfd = XMLFILE[n.type] !== undefined ? `xmlFileData="${XMLFILE[n.type]}"` : "";
  const esc = s => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  
  if (n.type === "Exit") {
    const exitAttrs = [`id="${n.id}"`, `value="${esc(n.label)}"`, `style="${style}"`, `parent="1"`, `vertex="1"`, `imageName="Exit"`, `type="Exit"`].join(" ");
    return `  <mxCell ${exitAttrs}>\n    <mxGeometry x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="100" height="100" as="geometry"/>\n  </mxCell>`;
  }
  const FIELDS = {
    Start: [["servicedescription", "Description", "textbox", n.label], ["calltype", "Call Type", "select", n.params?.calltype || "IVR"], ["exittimer", "Exit Timer", "textbox", "0"], ["service", "Service Name", "textbox", n.params?.service || ""], ["shortcode", "Short Code", "textbox", n.params?.shortcode || ""], ["autoanswer", "Auto Answer", "checkbox", "true"], ["defaultlang", "Default Language", "select", n.params?.defaultlang || "_E"]],
    Navigation: [["servicedescription", "Description", "textbox", n.label], ["promptfile", "File/s", "selectmul", n.params?.promptfile || ""], ["bargein", "Barge In", "checkbox", "true"], ["voicedetection", "Voice Detection", "checkbox", "false"], ["timeout", "Timeout (sec)", "textbox", n.params?.timeout || "0"], ["repeatcount", "Repeat Count", "textbox", n.params?.repeatcount || "0"]],
    Play: [["servicedescription", "Description", "textbox", n.label], ["contentlist", "Content Files", "selectmul", n.params?.contentlist || ""], ["seek", "Seek", "checkbox", "false"], ["randomplay", "Random Play", "checkbox", n.params?.randomplay || "false"], ["previousdtmf", "Previous DTMF", "textbox", n.params?.previousdtmf || "0"], ["nextdtmf", "Next DTMF", "textbox", n.params?.nextdtmf || "0"], ["repeatcurrent", "Repeat Current DTMF", "textbox", n.params?.repeatcurrent || "0"]],
    Database: [["servicedescription", "Description", "textbox", n.label], ["checkdb", "Check DB", "select", n.params?.checkdb || "GetUserDetail"], ["servicename", "Service Name", "textbox", n.params?.servicename || ""], ["bpartyminlength", "B-Party Min Length", "textbox", "0"]],
    URL: [["servicedescription", "Description", "textbox", n.label], ["callmode", "Call Mode", "select", n.params?.callmode || "Asynchronous"], ["synchronous", "Timeout (sec)", "textbox", "30"], ["urltype", "URL Type", "select", n.params?.urltype || "Subscription"], ["subservicename", "Sub-Service Name", "textbox", "MagicVoice"], ["url", "URL", "textbox", n.params?.url || ""], ["method", "Method", "select", n.params?.method || "Get"], ["urlresptype", "Response Type", "select", "Text"]],
    Processing: [["servicedescription", "Description", "textbox", n.label], ["processing", "Processing", "select", n.params?.processing || "SetLanguage"], ["setlanguage", "Set Language", "select", n.params?.setlanguage || "_E"]],
    DigitCollect: [["servicedescription", "Description", "textbox", n.label], ["maxlen", "Max Length", "textbox", n.params?.maxlen || "4"], ["minlen", "Min Length", "textbox", n.params?.minlen || "1"], ["timeout", "Timeout (sec)", "textbox", n.params?.timeout || "10"], ["terminationchar", "Termination Char", "textbox", n.params?.terminationchar || "#"], ["confirmation", "Confirmation", "checkbox", "false"]],
    StartRecord: [["servicedescription", "Description", "textbox", n.label], ["timeout", "Timeout (sec)", "textbox", n.params?.timeout || "60"], ["recordFilePath", "Record File Path", "textbox", n.params?.recordFilePath || "/recordings/"], ["recordenddtmf", "Record End DTMF", "textbox", n.params?.recordenddtmf || "#"], ["recordbg", "Background Music", "checkbox", "false"]],
    Transfer: [["servicedescription", "Description", "textbox", n.label]],
  };
  const fields = FIELDS[n.type] || FIELDS.Navigation;
  const recs = fields.map(([k, pn, pt, v]) => bRecBlock(k, pn, pt, esc(v))).join("\n");
  const nodeAttrs = [
    `id="${n.id}"`,
    `value="${esc(n.label)}"`,
    `style="${style}"`,
    `parent="1"`,
    `vertex="1"`,
    `imageName="${n.type}"`,
    xfd,
    `type="${n.type}"`,
    xpd
  ].filter(Boolean).join(" ");

  return `  <mxCell ${nodeAttrs}>\n    <mxGeometry x="${Math.round(n.x)}" y="${Math.round(n.y)}" width="100" height="100" as="geometry"/>\n    <mxParams as="params">\n      <recs>\n${recs}\n      </recs>\n    </mxParams>\n  </mxCell>`;
}
function bEdgeToXml(e) {
  const ecol = { DTMF: "green", DB: "red", Normal: "grey" }[e.type] || "grey";
  const style = `edgeStyle=elbowEdgeStyle;elbow=horizontal;strokeWidth=3;strokeColor=${ecol};exitX=1;exitY=0.5;entryX=0;entryY=0.5`;
  const xpd = e.type !== "Normal" ? `xmlParamsData="x"` : "";
  const esc = (s) => (s || "").toString().replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
  let px = "";
  if (e.type === "DTMF") px = `\n    <mxParams as="params"><recs>\n${bRecBlock("value", "Display", "textbox", esc(e.label))}\n${bRecBlock("dtmf", "DTMF", "select", esc(e.label) || "Any")}\n    </recs></mxParams>`;
  else if (e.type === "DB") px = `\n    <mxParams as="params"><recs>\n${bRecBlock("value", "Display", "textbox", esc(e.label))}\n${bRecBlock("dbconnector", "DB Connector", "select", "GetUserDetail")}\n    </recs></mxParams>`;
  
  const edgeAttrs = [
    `id="${e.id}"`,
    `value="${esc(e.label)}"`,
    `style="${style}"`,
    `parent="1"`,
    `source="${e.source}"`,
    `target="${e.target}"`,
    `edge="1"`,
    `type="${e.type}"`,
    xpd
  ].filter(Boolean).join(" ");

  return `  <mxCell ${edgeAttrs}>\n    <mxGeometry x="0" y="0" width="100" height="100" as="geometry"><mxPoint as="sourcePoint"/><mxPoint as="targetPoint"/></mxGeometry>${px}\n  </mxCell>`;
}
function buildXML(nodes, edges) {
  return `<?xml version="1.0" encoding="UTF-8"?>\n<mxGraphModel scale="0.694" grid="1" guides="1" tooltips="1" connect="1" fold="1" page="0" pageScale="1" pageWidth="826" pageHeight="1169">\n  <root>\n    <mxCell id="0"/>\n    <mxCell id="1" parent="0"/>\n${nodes.map(bNodeToXml).join("\n")}\n${edges.map(bEdgeToXml).join("\n")}\n  </root>\n</mxGraphModel>`;
}

// ─── Magic Voice loader ───────────────────────────────────────────────────────
function buildMagicVoiceFlow() {
  let seq = 2;
  const nds = [], eds = [];
  const mk = (type, label, x, y, params = {}) => { const n = { id: String(seq++), type, label, x, y, params }; nds.push(n); return n; };
  const ed = (s, t, label, type) => eds.push({ id: "e" + (seq++), source: s.id, target: t.id, label, type });
  // A-Party
  const ST = mk("Start", "MagicVoice", 400, 30, { service: "MagicVoice", shortcode: "422", calltype: "IVR", defaultlang: "_E" });
  const LS = mk("Navigation", "Language_Selection", 400, 220, { promptfile: "/MagicVoice/IVR/language_select.wav", timeout: "5", repeatcount: "1" });
  const PMN = mk("Processing", "Set_Mongolian", 80, 380, { processing: "SetLanguage", setlanguage: "_MN" });
  const PEN = mk("Processing", "Set_English", 720, 380, { processing: "SetLanguage", setlanguage: "_E" });
  const DBS = mk("Database", "User_Status_Check", 400, 540, { checkdb: "GetUserDetail", servicename: "MagicVoice" });
  // New user
  const WM = mk("Navigation", "Welcome_Message", -120, 700, { promptfile: "/MagicVoice/IVR/welcome.wav", timeout: "5", repeatcount: "1" });
  const SA1 = mk("Navigation", "Sub_Attempt_1", -120, 880, { promptfile: "/MagicVoice/IVR/sub_att1.wav", timeout: "5", repeatcount: "1" });
  const SA2 = mk("Navigation", "Sub_Attempt_2", -120, 1060, { promptfile: "/MagicVoice/IVR/sub_att2.wav", timeout: "5", repeatcount: "1" });
  const NI = mk("Navigation", "No_Input_Prompt", -120, 1240, { promptfile: "/MagicVoice/IVR/noinput.wav", timeout: "0" });
  const SUB = mk("URL", "Subscription_API", 200, 880, { urltype: "Subscription", url: "http://$host$/MagicVoice/subscription/sync", method: "Get", callmode: "Synchronous" });
  const SRC = mk("Database", "Sub_Result_Check", 200, 1060, { checkdb: "GetUserDetail", servicename: "MagicVoice" });
  const GF = mk("Navigation", "Grace_Failure", -120, 1240, { promptfile: "/MagicVoice/IVR/grace_fail.wav" });
  const SS = mk("Navigation", "Sub_Success", 400, 1060, { promptfile: "/MagicVoice/IVR/sub_success.wav", timeout: "5" });
  const MOC = mk("Navigation", "Message_Or_Call", 400, 1240, { promptfile: "/MagicVoice/IVR/msg_or_call.wav", timeout: "10", repeatcount: "1" });
  // Record path
  const FVM = mk("Navigation", "First_Time_VoiceMenu", 80, 1400, { promptfile: "/MagicVoice/IVR/voice_menu.wav", timeout: "10", repeatcount: "1" });
  const RM1 = mk("Navigation", "Record_Message_1", 80, 1580, { promptfile: "/MagicVoice/IVR/record1.wav" });
  const REC = mk("StartRecord", "Start_Recording", 80, 1760, { timeout: "60", recordFilePath: "/MagicVoice/rec/", recordenddtmf: "#" });
  const RM2 = mk("Navigation", "Record_Message_2", 80, 1940, { promptfile: "/MagicVoice/IVR/record2.wav", timeout: "30", repeatcount: "1" });
  const SNA = mk("URL", "Send_Now_API", -120, 2100, { urltype: "Generic", url: "http://$host$/MagicVoice/send?type=now", method: "Post", callmode: "Synchronous" });
  const SNS = mk("Navigation", "Send_Now_Success", -120, 2280, { promptfile: "/MagicVoice/IVR/send_ok.wav" });
  const SLP = mk("Navigation", "Send_Later_Prompt", 280, 2100, { promptfile: "/MagicVoice/IVR/send_later.wav", timeout: "15" });
  const DC = mk("DigitCollect", "Collect_Send_Time", 280, 2280, { maxlen: "2", minlen: "1", timeout: "15", terminationchar: "#" });
  const MT = mk("Navigation", "Message_Timing", 280, 2460, { promptfile: "/MagicVoice/IVR/msg_timing.wav", timeout: "10" });
  const SCA = mk("URL", "Schedule_Msg_API", 280, 2640, { urltype: "Generic", url: "http://$host$/MagicVoice/send?type=scheduled", method: "Post", callmode: "Synchronous" });
  const MSN = mk("Navigation", "Message_Sent", 280, 2820, { promptfile: "/MagicVoice/IVR/msg_sent.wav" });
  const EX1 = mk("Exit", "Exit", 280, 3000);
  // Call path
  const MM2 = mk("Navigation", "Main_Menu_2", 720, 1400, { promptfile: "/MagicVoice/IVR/main_menu2.wav", timeout: "10", repeatcount: "1" });
  const SVF = mk("Processing", "Set_Voice_Effect", 720, 1580, { processing: "SetVoiceEffect" });
  const TRF = mk("Transfer", "Connecting_Call", 720, 1760, { bpartydialnumber: "" });
  const EX2 = mk("Exit", "Exit_Call", 720, 1940);
  // Active user
  const WB = mk("Navigation", "Welcome_Back", 920, 700, { promptfile: "/MagicVoice/IVR/welcome_back.wav", timeout: "5" });
  const AMC = mk("Navigation", "Active_Msg_Or_Call", 920, 880, { promptfile: "/MagicVoice/IVR/msg_or_call.wav", timeout: "10", repeatcount: "1" });
  // Grace
  const GFU = mk("Navigation", "Grace_User_Failure", 1160, 700, { promptfile: "/MagicVoice/IVR/grace_fail.wav" });
  const EX3 = mk("Exit", "Exit_Grace", 1160, 880);
  // B-Party
  const BS = mk("Start", "MagicVoice_BParty", 1520, 30, { service: "MagicVoice", shortcode: "422", calltype: "IVR", defaultlang: "_E" });
  const BWM = mk("Navigation", "B_Welcome_Message", 1520, 220, { promptfile: "/MagicVoice/IVR/b_welcome.wav" });
  const BUS = mk("Database", "B_User_Status", 1520, 400, { checkdb: "GetUserDetail", servicename: "MagicVoice" });
  const BAP = mk("Navigation", "B_Active_Prompt", 1320, 560, { promptfile: "/MagicVoice/IVR/b_active.wav" });
  const BX1 = mk("Exit", "Exit_B_Active", 1320, 740);
  const BS1 = mk("Navigation", "B_Sub_Attempt_1", 1720, 560, { promptfile: "/MagicVoice/IVR/b_sub1.wav", timeout: "5", repeatcount: "1" });
  const BS2 = mk("Navigation", "B_Sub_Attempt_2", 1720, 740, { promptfile: "/MagicVoice/IVR/b_sub2.wav", timeout: "5", repeatcount: "1" });
  const BSA = mk("URL", "B_Subscription_API", 1970, 650, { urltype: "Subscription", url: "http://$host$/MagicVoice/subscription/sync", method: "Get", callmode: "Synchronous" });
  const BTM = mk("Navigation", "B_Thanks_Message", 1720, 920, { promptfile: "/MagicVoice/IVR/b_thanks.wav" });
  const BX2 = mk("Exit", "Exit_B", 1720, 1100);
  // Edges
  ed(ST, LS, "", "Normal"); ed(LS, PMN, "1", "DTMF"); ed(LS, PEN, "2", "DTMF"); ed(LS, DBS, "Any", "DTMF");
  ed(PMN, DBS, "", "Normal"); ed(PEN, DBS, "", "Normal");
  ed(DBS, WM, "new", "DB"); ed(DBS, WB, "active", "DB"); ed(DBS, GFU, "grace", "DB");
  ed(WM, SUB, "1", "DTMF"); ed(WM, SA1, "NoInput", "DTMF");
  ed(SA1, SUB, "1", "DTMF"); ed(SA1, SA2, "NoInput", "DTMF");
  ed(SA2, SUB, "1", "DTMF"); ed(SA2, NI, "NoInput", "DTMF"); ed(NI, EX1, "", "Normal");
  ed(SUB, SRC, "", "Normal"); ed(SRC, GF, "grace", "DB"); ed(SRC, SS, "active", "DB"); ed(GF, EX1, "Any", "DTMF");
  ed(SS, MOC, "Any", "DTMF"); ed(MOC, FVM, "1", "DTMF"); ed(MOC, MM2, "2", "DTMF");
  ed(FVM, RM1, "1-6", "DTMF"); ed(RM1, REC, "", "Normal"); ed(REC, RM2, "", "Normal");
  ed(RM2, SNA, "1", "DTMF"); ed(RM2, SLP, "2", "DTMF"); ed(RM2, RM1, "3", "DTMF");
  ed(SNA, SNS, "", "Normal"); ed(SNS, EX1, "Any", "DTMF");
  ed(SLP, DC, "", "Normal"); ed(DC, MT, "", "Normal"); ed(MT, SCA, "1", "DTMF"); ed(SCA, MSN, "", "Normal"); ed(MSN, EX1, "Any", "DTMF");
  ed(MM2, SVF, "1-6", "DTMF"); ed(SVF, TRF, "", "Normal"); ed(TRF, EX2, "", "Normal");
  ed(WB, AMC, "Any", "DTMF"); ed(AMC, FVM, "1", "DTMF"); ed(AMC, MM2, "2", "DTMF");
  ed(GFU, EX3, "Any", "DTMF");
  ed(BS, BWM, "", "Normal"); ed(BWM, BUS, "", "Normal");
  ed(BUS, BAP, "active", "DB"); ed(BUS, BS1, "new", "DB"); ed(BAP, BX1, "", "Normal");
  ed(BS1, BSA, "1", "DTMF"); ed(BS1, BS2, "NoInput", "DTMF"); ed(BS2, BSA, "1", "DTMF"); ed(BS2, BTM, "NoInput", "DTMF");
  ed(BSA, BTM, "", "Normal"); ed(BTM, BX2, "Any", "DTMF");
  return { nodes: nds, edges: eds };
}



function FlowBuilderTab({ th }) {
  const NW = 200, NH = 70;
  const COLS = {
    Start: "#34d399", Exit: "#f87171", Navigation: "#60a5fa", Play: "#2dd4bf",
    Database: "#fbbf24", URL: "#4ade80", Processing: "#c084fc", DigitCollect: "#fb923c",
    StartRecord: "#e879f9", Transfer: "#f97316"
  };
  const ECOLS = { DTMF: "#34d399", DB: "#fb923c", Normal: "#6b7280" };
  const SCHEMA = {
    Start: [{ k: "service", l: "Service" }, { k: "shortcode", l: "Short Code" }, { k: "calltype", l: "Call Type", o: ["IVR", "OBD"] }, { k: "defaultlang", l: "Default Lang", o: ["_E", "_A", "_MN"] }],
    Navigation: [{ k: "promptfile", l: "Prompt File" }, { k: "timeout", l: "Timeout (s)" }, { k: "repeatcount", l: "Repeat" }, { k: "bargein", l: "Barge In", o: ["true", "false"] }],
    Play: [{ k: "contentlist", l: "Content File" }, { k: "nextdtmf", l: "Next DTMF" }, { k: "previousdtmf", l: "Prev DTMF" }, { k: "randomplay", l: "Random", o: ["false", "true"] }],
    Database: [{ k: "checkdb", l: "Check DB", o: ["GetUserDetail", "GetLanguage", "GetBPartyStatus"] }, { k: "servicename", l: "Service Name" }],
    URL: [{ k: "urltype", l: "URL Type", o: ["Subscription", "Unsubscription", "Generic", "SMS", "Billing"] }, { k: "url", l: "URL" }, { k: "method", l: "Method", o: ["Get", "Post"] }, { k: "callmode", l: "Call Mode", o: ["Synchronous", "Asynchronous"] }],
    Processing: [{ k: "processing", l: "Action", o: ["SetLanguage", "SetVoiceEffect", "SetUserDefinedVariable"] }, { k: "setlanguage", l: "Set Lang", o: ["_E", "_A", "_MN"] }],
    DigitCollect: [{ k: "maxlen", l: "Max Len" }, { k: "minlen", l: "Min Len" }, { k: "timeout", l: "Timeout" }, { k: "terminationchar", l: "Term Char" }],
    StartRecord: [{ k: "timeout", l: "Timeout" }, { k: "recordFilePath", l: "File Path" }, { k: "recordenddtmf", l: "End DTMF" }],
    Transfer: [{ k: "bpartydialnumber", l: "Dial Number" }],
    Exit: [],
  };

  const idRef = useRef(500);
  const nextId = () => String(idRef.current++);
  const pdfRef = useRef(null);

  const [nodes, setNodes] = useState([]);
  const [edges, setEdges] = useState([]);
  const [sel, setSel] = useState(null);
  const [connFrom, setConnFrom] = useState(null);
  const [connecting, setConnect] = useState(false);
  const [zoom, setZoom] = useState(0.18);
  const [pan, setPan] = useState({ x: 20, y: 20 });
  const [drag, setDrag] = useState(null);
  const [panDrag, setPanDrag] = useState(null);
  const [edgeDlg, setEdgeDlg] = useState(null);
  const [edgeLbl, setEdgeLbl] = useState("");
  const [edgeTyp, setEdgeTyp] = useState("DTMF");
  const [pdfStatus, setPdfStatus] = useState(null); // null | "reading" | "parsing" | "done" | "error"
  const [pdfErr, setPdfErr] = useState("");
  const [pdfName, setPdfName] = useState("");
  const [pdfDrop, setPdfDrop] = useState(false);
  const containerRef = useRef(null);

  // Convert client coords → world coords
  const c2w = (cx, cy) => {
    const r = containerRef.current.getBoundingClientRect();
    return { wx: (cx - r.left - pan.x) / zoom, wy: (cy - r.top - pan.y) / zoom };
  };

  // ── fit view after loading nodes ───────────────────────────────────────────
  function fitNodes(ns) {
    if (!ns || !ns.length) return;
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    const minX = Math.min(...xs) - 30, minY = Math.min(...ys) - 30;
    const maxX = Math.max(...xs) + NW + 30, maxY = Math.max(...ys) + NH + 30;
    const cw = containerRef.current?.clientWidth || 700;
    const ch = containerRef.current?.clientHeight || 500;
    const z = Math.min((cw - 40) / (maxX - minX), (ch - 40) / (maxY - minY), 0.55);
    setZoom(z); setPan({ x: -minX * z + 20, y: -minY * z + 20 });
  }

  // ── parse PDF via Anthropic API ───────────────────────────────────────────
  async function parsePdfFlow(file) {
    setPdfStatus("reading"); setPdfErr(""); setPdfName(file.name);
    setSel(null); setConnFrom(null); setConnect(false);

    try {
      // ── Step 1: Extract text from PDF using pdf.js ──────────────────────
      let pdfText = "";
      try {
        const pdfjsLib = await import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js");
        // pdf.js needs its worker
        const pdfjsWorker = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
        // Access the global set by the CDN script
        const pdfjs = window["pdfjs-dist/build/pdf"] || pdfjsLib.default || pdfjsLib;
        if (pdfjs && pdfjs.GlobalWorkerOptions) pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;

        const ab = await file.arrayBuffer();
        const loadingTask = pdfjs.getDocument ? pdfjs.getDocument({ data: ab }) : null;
        if (loadingTask) {
          const pdf = await loadingTask.promise;
          const pages = [];
          for (let i = 1; i <= pdf.numPages; i++) {
            const page = await pdf.getPage(i);
            const content = await page.getTextContent();
            pages.push(content.items.map(s => s.str).join(" "));
          }
          pdfText = pages.join("\n\n");
        }
      } catch (pdfErr) {
        // pdf.js failed — fall back to filename-based hint
        pdfText = `[PDF file: ${file.name}] Could not extract text automatically. Please describe the IVR flow.`;
      }

      if (!pdfText.trim()) pdfText = `[PDF: ${file.name}] No text could be extracted from this PDF.`;

      setPdfStatus("parsing");

      const SYSTEM = `You are an expert BnG SCP IVR flow designer. Given an IVR flow description, extract all nodes and connections and return ONLY valid JSON — no markdown, no explanation, no code blocks.

Node types MUST be one of: Start, Navigation, Play, Database, URL, Processing, Exit, DigitCollect, StartRecord, Transfer
Edge types MUST be one of: DTMF, DB, Normal
- DTMF = key press routing (label = digit pressed: "1","2","Any","NoInput","#")
- DB = database result routing (label = result value: "active","new","grace","parking")
- Normal = unconditional flow (label = "")

Layout rules:
- Start node at x:400 y:50
- Each layer ~200px below the previous
- Sibling nodes spread ~280px apart horizontally
- Every node must have unique short id (letters/numbers only, no spaces)

Return ONLY this JSON structure, nothing else:
{
  "flowName": "ServiceName",
  "nodes": [
    {"id":"start","type":"Start","label":"ServiceName","x":400,"y":50,"params":{"calltype":"IVR","service":"ServiceName","shortcode":"","defaultlang":"_E"}},
    {"id":"lang","type":"Navigation","label":"Language_Selection","x":400,"y":250,"params":{"promptfile":"/IVR/lang.wav","timeout":"5","repeatcount":"1","bargein":"true"}}
  ],
  "edges": [
    {"id":"e1","source":"start","target":"lang","type":"Normal","label":""},
    {"id":"e2","source":"lang","target":"menu","type":"DTMF","label":"1"}
  ]
}`;

      const resp = await fetch(`${API_BASE}/generate-scp-flow`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ doc_text: pdfText })
      });

      if (!resp.ok) {
        const errText = await resp.text();
        throw new Error(`API error ${resp.status}: ${errText.slice(0, 300)}`);
      }

      const data = await resp.json();
      if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));

      // The backend returns the flow JSON directly now (cleansed by OBDPromptAgent)
      let flow = data;
      
      // If the response is wrapped in an Anthropic-style 'content' array (fallback), extract it
      if (data.content && Array.isArray(data.content)) {
        const rawText = data.content.find(c => c.type === "text")?.text || "";
        if (!rawText) throw new Error("Empty response from API");
        const cleanText = rawText.replace(/^```(?:json)?\s*/m, "").replace(/\s*```\s*$/m, "").trim();
        try { flow = JSON.parse(cleanText); } catch (e) {
             const match = rawText.match(/\{[\s\S]+\}/);
             if (match) flow = JSON.parse(match[0]);
             else throw new Error("Could not parse JSON from content: " + rawText.slice(0, 100));
        }
      }

      if (!flow || !flow.nodes?.length) throw new Error("No nodes found in AI response.");


      // ── Step 3: Map to internal node format ────────────────────────────
      const idMap = {};
      const ns = flow.nodes.map(n => {
        const newId = String(idRef.current++);
        idMap[n.id] = newId;
        const params = {};
        (SCHEMA[n.type] || []).forEach(f => { params[f.k] = n.params?.[f.k] || ""; });
        return {
          id: newId, type: n.type || "Navigation", label: n.label || n.type,
          x: Number(n.x) || 100, y: Number(n.y) || 100, params
        };
      });
      const es = (flow.edges || []).map(e => ({
        id: "e" + String(idRef.current++),
        source: idMap[e.source] || "",
        target: idMap[e.target] || "",
        label: e.label || "", type: e.type || "Normal"
      })).filter(e => e.source && e.target && ns.find(n => n.id === e.source) && ns.find(n => n.id === e.target));

      setNodes(ns); setEdges(es);
      setPdfStatus("done");
      setTimeout(() => fitNodes(ns), 80);

    } catch (err) {
      setPdfErr(err.message || "Unknown error");
      setPdfStatus("error");
    }
  }


  // ── PDF drop zone on empty canvas ─────────────────────────────────────────
  function handlePdfFile(file) {
    if (!file || !file.name.match(/\.pdf$/i)) { setPdfErr("Please drop a PDF file"); setPdfStatus("error"); return; }
    parsePdfFlow(file);
  }

  // ── drop on canvas: PDF → parse, nodeType → add node ─────────────────────
  function handleDrop(e) {
    e.preventDefault();
    const type = e.dataTransfer.getData("nodeType");
    if (type) {
      // palette node drop
      const { wx, wy } = c2w(e.clientX, e.clientY);
      const id = nextId();
      const params = {};
      (SCHEMA[type] || []).forEach(f => { params[f.k] = ""; });
      setNodes(prev => [...prev, { id, type, label: type, x: wx - NW / 2, y: wy - NH / 2, params }]);
      return;
    }
    // PDF drop on canvas
    const file = e.dataTransfer.files?.[0];
    if (file) handlePdfFile(file);
  }

  // ── mouse handlers on the overlay div ────────────────────────────────────
  function handleMouseDown(e) {
    if (e.button !== 0) return;
    // hit test nodes
    const { wx, wy } = c2w(e.clientX, e.clientY);
    const hit = [...nodes].reverse().find(n => wx >= n.x && wx <= n.x + NW && wy >= n.y && wy <= n.y + NH);

    if (connecting) {
      if (hit) {
        if (!connFrom) { setConnFrom(hit); }
        else if (connFrom.id !== hit.id) {
          setEdgeDlg({ src: connFrom.id, tgt: hit.id });
          setEdgeLbl(""); setEdgeTyp("DTMF");
          setConnFrom(null);
        }
      }
      return;
    }

    if (hit) {
      e.preventDefault();
      setSel(hit);
      setDrag({ nodeId: hit.id, startWx: wx, startWy: wy, nodeX0: hit.x, nodeY0: hit.y });
    } else {
      setSel(null);
      setPanDrag({ startCx: e.clientX, startCy: e.clientY, panX0: pan.x, panY0: pan.y });
    }
  }

  function handleMouseMove(e) {
    if (drag) {
      const { wx, wy } = c2w(e.clientX, e.clientY);
      const dx = wx - drag.startWx, dy = wy - drag.startWy;
      setNodes(prev => prev.map(n => n.id === drag.nodeId ? { ...n, x: drag.nodeX0 + dx, y: drag.nodeY0 + dy } : n));
    } else if (panDrag) {
      setPan({
        x: panDrag.panX0 + (e.clientX - panDrag.startCx),
        y: panDrag.panY0 + (e.clientY - panDrag.startCy),
      });
    }
  }

  function handleMouseUp() {
    setDrag(null);
    setPanDrag(null);
  }

  function handleWheel(e) {
    e.preventDefault();
    const r = containerRef.current.getBoundingClientRect();
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const nz = Math.min(3, Math.max(0.05, zoom * factor));
    setPan({ x: cx - (cx - pan.x) * (nz / zoom), y: cy - (cy - pan.y) * (nz / zoom) });
    setZoom(nz);
  }

  // ── edge path ─────────────────────────────────────────────────────────────
  function getEdgePath(e) {
    const sn = nodes.find(n => n.id === e.source), tn = nodes.find(n => n.id === e.target);
    if (!sn || !tn) return null;
    const sx = sn.x + NW / 2, sy = sn.y + NH, tx = tn.x + NW / 2, ty = tn.y;
    if (e.source === e.target) {
      return { d: `M ${sx} ${sy - NH * 0.4} A 50 35 0 1 1 ${sx + 1} ${sy - NH * 0.4}`, mx: sx + 55, my: sn.y + NH / 2 };
    }
    const my = (sy + ty) / 2;
    return { d: `M ${sx} ${sy} C ${sx} ${my}, ${tx} ${my}, ${tx} ${ty}`, mx: (sx + tx) / 2, my: my - 8 };
  }

  function getArrow(e) {
    const sn = nodes.find(n => n.id === e.source), tn = nodes.find(n => n.id === e.target);
    if (!sn || !tn || e.source === e.target) return "";
    const sx = sn.x + NW / 2, sy = sn.y + NH, tx = tn.x + NW / 2, ty = tn.y;
    const my = (sy + ty) / 2;
    const a = Math.atan2(ty - my, tx - (sx + tx) / 2);
    const L = 8;
    return `M ${tx} ${ty} L ${tx - L * Math.cos(a - 0.4)} ${ty - L * Math.sin(a - 0.4)} L ${tx - L * Math.cos(a + 0.4)} ${ty - L * Math.sin(a + 0.4)} Z`;
  }

  // ── node update helpers ───────────────────────────────────────────────────
  function updateLabel(id, v) { setNodes(p => p.map(n => n.id === id ? { ...n, label: v } : n)); if (sel?.id === id) setSel(p => ({ ...p, label: v })); }
  function updateParam(id, k, v) { setNodes(p => p.map(n => { if (n.id !== id) return n; const params = { ...n.params, [k]: v }; if (sel?.id === id) setSel({ ...n, params }); return { ...n, params }; })); }
  function deleteNode(id) { setNodes(p => p.filter(n => n.id !== id)); setEdges(p => p.filter(e => e.source !== id && e.target !== id)); setSel(null); }
  function addEdgeConfirm() { setEdges(p => [...p, { id: "e" + nextId(), source: edgeDlg.src, target: edgeDlg.tgt, label: edgeLbl.trim(), type: edgeTyp }]); setEdgeDlg(null); }

  function fitView() { fitNodes(nodes); }

  // ── live selection ─────────────────────────────────────────────────────────
  const liveSel = sel ? nodes.find(n => n.id === sel.id) : null;

  // ── render ────────────────────────────────────────────────────────────────
  const btnBase = { fontSize: 12, padding: "4px 10px", borderRadius: 5, border: `1px solid ${th.borderCol}`, background: "transparent", color: th.textH3, cursor: "pointer", fontFamily: "monospace" };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: th.appBg }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "6px 12px", borderBottom: `1px solid ${th.borderCol}`, background: th.headerBg, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: "700", color: th.textH1, marginRight: 4 }}>⚒ Flow Builder</span>
        {/* PDF Upload — always visible, prominent */}
        <button onClick={() => pdfRef.current?.click()}
          disabled={pdfStatus === "reading" || pdfStatus === "parsing"}
          style={{
            display: "flex", alignItems: "center", gap: 6, padding: "5px 14px", borderRadius: 6,
            border: `1px solid ${pdfStatus === "parsing" || pdfStatus === "reading" ? "#3b82f6" : "rgba(59,130,246,0.5)"}`,
            background: pdfStatus === "parsing" || pdfStatus === "reading" ? "rgba(59,130,246,0.1)" : "rgba(59,130,246,0.08)",
            color: pdfStatus === "parsing" || pdfStatus === "reading" ? "#60a5fa" : "#60a5fa",
            cursor: pdfStatus === "parsing" || pdfStatus === "reading" ? "wait" : "pointer",
            fontFamily: "monospace", fontSize: 12, fontWeight: "700"
          }}>
          {pdfStatus === "reading" ? "⏳ Reading…" : pdfStatus === "parsing" ? "⚙ Parsing…" : "📄 Upload PDF Flow"}
        </button>
        <input ref={pdfRef} type="file" accept=".pdf" style={{ display: "none" }}
          onChange={e => { if (e.target.files[0]) handlePdfFile(e.target.files[0]); e.target.value = ""; }} />
        <button onClick={() => { setNodes([]); setEdges([]); setSel(null); setConnFrom(null); setConnect(false); setPdfStatus(null); setPdfName(""); }} style={btnBase}>Clear</button>
        <span style={{ width: 1, height: 16, background: th.borderCol, display: "inline-block" }} />
        <button onClick={() => { setConnect(c => !c); setConnFrom(null); }} style={{ ...btnBase, border: `1px solid ${connecting ? "#3b82f6" : th.borderCol}`, background: connecting ? "rgba(59,130,246,0.15)" : "transparent", color: connecting ? "#60a5fa" : th.textH3, fontWeight: connecting ? "700" : "400" }}>
          {connecting ? "● Connecting…" : "Connect Nodes"}
        </button>
        <button onClick={() => liveSel && deleteNode(liveSel.id)} style={{ ...btnBase, color: "#f87171", border: `1px solid ${liveSel ? "rgba(248,113,113,0.4)" : th.borderCol}` }}>Delete</button>
        <span style={{ width: 1, height: 16, background: th.borderCol, display: "inline-block" }} />
        <button onClick={fitView} style={btnBase}>Fit View</button>
        <button onClick={() => setZoom(z => Math.min(3, +(z + 0.1).toFixed(2)))} style={{ ...btnBase, padding: "4px 8px" }}>＋</button>
        <button onClick={() => setZoom(z => Math.max(0.05, +(z - 0.1).toFixed(2)))} style={{ ...btnBase, padding: "4px 8px" }}>－</button>
        <span style={{ fontSize: 9, color: th.textFaint, fontFamily: "monospace" }}>{Math.round(zoom * 100)}%</span>
        <span style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace", marginLeft: "auto" }}>
          {pdfName && <span style={{ color: th.textH3, marginRight: 8 }}>📄 {pdfName}</span>}
          {nodes.length} nodes · {edges.length} edges
        </span>
        <button onClick={() => {
          const xml = buildXML(nodes, edges);
          // Save to DB
          const startN = nodes.find(n => n.type === "Start");
          dbSave({
            flowName: startN?.params?.service || startN?.label || "Builder_Flow",
            serviceName: startN?.params?.service || null,
            shortCode: startN?.params?.shortcode || null,
            callType: startN?.params?.calltype || "IVR",
            defaultLang: startN?.params?.defaultlang || "_E",
            source: "builder", filename: "SCP_Flow.xml",
            xmlContent: xml, nodes, edges,
          });
          // Download
          const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([xml], { type: "application/xml" })); a.download = "SCP_Flow.xml"; a.click();
        }}
          style={{ fontSize: 12, padding: "5px 14px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#059669,#0d9488)", color: "#fff", cursor: "pointer", fontFamily: "monospace", fontWeight: "700" }}>
          ⬇ Download XML
        </button>
      </div>

      {/* PDF status strip */}
      {(pdfStatus === "reading" || pdfStatus === "parsing") && (
        <div style={{ padding: "6px 14px", borderBottom: `1px solid ${th.borderCol}`, background: "rgba(59,130,246,0.08)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#3b82f6", flexShrink: 0, opacity: 0.9 }} />
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "#60a5fa", fontWeight: "600" }}>
            {pdfStatus === "reading" ? "⏳ Reading PDF…" : "⚙ Parsing IVR flow with AI…"}
          </span>
          {pdfName && <span style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>· {pdfName}</span>}
        </div>
      )}
      {pdfStatus === "done" && nodes.length > 0 && (
        <div style={{ padding: "5px 14px", borderBottom: `1px solid ${th.borderCol}`, background: "rgba(52,211,153,0.07)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "#34d399", fontWeight: "600" }}>✓ Flow generated from PDF</span>
          {pdfName && <span style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>· {pdfName}</span>}
          <button onClick={() => pdfRef.current?.click()}
            style={{ marginLeft: 8, padding: "2px 10px", borderRadius: 4, border: "1px solid rgba(59,130,246,0.4)", background: "transparent", color: "#60a5fa", cursor: "pointer", fontSize: 9, fontFamily: "monospace" }}>
            📄 Upload another PDF
          </button>
          <button onClick={() => { setPdfStatus(null); setPdfName(""); }} style={{ marginLeft: "auto", background: "none", border: "none", color: th.textH3, cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      )}
      {pdfStatus === "error" && (
        <div style={{ padding: "5px 14px", borderBottom: `1px solid ${th.borderCol}`, background: "rgba(248,113,113,0.08)", display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 12, fontFamily: "monospace", color: "#f87171", fontWeight: "600" }}>✗ PDF parse failed</span>
          <span style={{ fontSize: 9, color: "#f87171aa", fontFamily: "monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{pdfErr}</span>
          <button onClick={() => pdfRef.current?.click()}
            style={{ padding: "2px 10px", borderRadius: 4, border: "1px solid rgba(248,113,113,0.4)", background: "transparent", color: "#f87171", cursor: "pointer", fontSize: 9, fontFamily: "monospace" }}>
            Try again
          </button>
          <button onClick={() => { setPdfStatus(null); setPdfErr(""); }} style={{ background: "none", border: "none", color: th.textH3, cursor: "pointer", fontSize: 13 }}>✕</button>
        </div>
      )}

      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        <div style={{ width: 142, flexShrink: 0, background: th.headerBg, borderRight: `1px solid ${th.borderCol}`, overflowY: "auto", padding: "8px 6px" }}>
          {[{ l: "Flow", items: ["Start", "Exit"] }, { l: "Audio", items: ["Navigation", "Play"] }, { l: "Logic", items: ["Database", "URL", "Processing"] }, { l: "Input", items: ["DigitCollect", "StartRecord", "Transfer"] }].map(g => (
            <div key={g.l} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 5, padding: "0 4px", fontFamily: "monospace" }}>{g.l}</div>
              {g.items.map(type => (
                <div key={type} draggable onDragStart={e => e.dataTransfer.setData("nodeType", type)}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 7px", borderRadius: 5, border: `0.5px solid ${th.borderCol}`, background: th.rowHdr, marginBottom: 4, cursor: "grab", fontSize: 12, color: th.textH2, userSelect: "none", fontFamily: "monospace" }}>
                  <div style={{ width: 7, height: 7, borderRadius: 2, flexShrink: 0, background: COLS[type] || "#888" }} />
                  {type}
                </div>
              ))}
            </div>
          ))}
          <div style={{ padding: "6px 4px", borderTop: `1px solid ${th.borderCol}`, marginTop: 4 }}>
            <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 1, fontFamily: "monospace", marginBottom: 5, textTransform: "uppercase" }}>Edges</div>
            {Object.entries(ECOLS).map(([k, c]) => (
              <div key={k} style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 4 }}>
                <div style={{ width: 12, height: 2, background: c, borderRadius: 1 }} />
                <span style={{ fontSize: 9, color: c, fontFamily: "monospace" }}>{k}</span>
              </div>
            ))}
          </div>
        </div>

        {/* SVG canvas area */}
        <div ref={containerRef} style={{
          flex: 1, overflow: "hidden", position: "relative", background: th.canvasBg,
          cursor: drag ? "grabbing" : panDrag ? "grabbing" : connecting ? "crosshair" : "grab"
        }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onWheel={handleWheel}
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}>

          <svg width="100%" height="100%" style={{ display: "block", position: "absolute", inset: 0 }}>
            {/* dot grid */}
            <defs>
              <pattern id="fbgrid" width={28 * zoom} height={28 * zoom} patternUnits="userSpaceOnUse"
                x={pan.x % (28 * zoom)} y={pan.y % (28 * zoom)}>
                <circle cx={0} cy={0} r="0.8" fill={th.dotCol} />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#fbgrid)" />

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>

              {/* edges */}
              {edges.map(e => {
                const ep = getEdgePath(e); if (!ep) return null;
                const ah = getArrow(e);
                const col = ECOLS[e.type] || "#6b7280";
                return (
                  <g key={e.id} style={{ pointerEvents: "none" }}>
                    <path d={ep.d} fill="none" stroke={col} strokeWidth={2} opacity={0.85} />
                    {ah && <path d={ah} fill={col} />}
                    {e.label && <text x={ep.mx} y={ep.my} textAnchor="middle"
                      style={{ fontSize: 12, fontFamily: "monospace", fontWeight: "600", fill: col }}>{e.label}</text>}
                  </g>
                );
              })}

              {/* nodes */}
              {nodes.map(n => {
                const c = COLS[n.type] || "#888";
                const isSel = liveSel && liveSel.id === n.id;
                const isCF = connFrom && connFrom.id === n.id;
                const isRound = n.type === "Start" || n.type === "Exit";
                const rx = isRound ? NH / 2 : 8;
                const lbl = n.label.length > 17 ? n.label.slice(0, 15) + "…" : n.label;
                return (
                  <g key={n.id} style={{ cursor: connecting ? "pointer" : "move" }}>
                    <rect x={n.x + 2} y={n.y + 2} width={NW} height={NH} rx={rx} fill="rgba(0,0,0,0.22)" />
                    <rect x={n.x} y={n.y} width={NW} height={NH} rx={rx}
                      fill={c + "1a"} stroke={isSel || isCF ? c : c + "55"} strokeWidth={isSel || isCF ? 2.5 : 1.2} />
                    {!isRound && <rect x={n.x} y={n.y + 8} width={4} height={NH - 16} rx={2} fill={c} />}
                    <text x={isRound ? n.x + NW / 2 : n.x + 13} y={n.y + NH * 0.37} dominantBaseline="middle"
                      textAnchor={isRound ? "middle" : "start"}
                      style={{ fontSize: 15, fontFamily: "monospace", fontWeight: "600", fill: c, pointerEvents: "none" }}>
                      {lbl}
                    </text>
                    <text x={isRound ? n.x + NW / 2 : n.x + 13} y={n.y + NH * 0.67} dominantBaseline="middle"
                      textAnchor={isRound ? "middle" : "start"}
                      style={{ fontSize: 9, fontFamily: "monospace", fill: c + "99", pointerEvents: "none" }}>
                      {n.type}
                    </text>
                    {connecting && (
                      <circle cx={n.x + NW / 2} cy={n.y + NH} r={7} fill="#3b82f6" stroke="#fff" strokeWidth={1.5}
                        style={{ pointerEvents: "none" }} />
                    )}
                  </g>
                );
              })}
            </g>
          </svg>

          {nodes.length === 0 && (
            <div
              onDragOver={e => { e.preventDefault(); setPdfDrop(true); }}
              onDragLeave={() => setPdfDrop(false)}
              onDrop={e => { e.preventDefault(); setPdfDrop(false); const f = e.dataTransfer.files?.[0]; if (f) handlePdfFile(f); }}
              style={{
                position: "absolute", inset: 0, display: "flex", flexDirection: "column",
                alignItems: "center", justifyContent: "center", gap: 14, pointerEvents: "auto",
                background: pdfDrop ? "rgba(59,130,246,0.06)" : "transparent", transition: "background .15s"
              }}>
              {pdfStatus === "reading" || pdfStatus === "parsing" ? (
                <>
                  <div style={{ fontSize: 32, opacity: 0.4, animation: "spin 2s linear infinite" }}>⚙</div>
                  <div style={{ fontSize: 13, color: th.textH2, fontWeight: "600" }}>
                    {pdfStatus === "reading" ? "Reading PDF…" : "Parsing IVR flow with AI…"}
                  </div>
                  <div style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>{pdfName}</div>
                  <div style={{ fontSize: 9, color: th.textFaint }}>This may take a few seconds…</div>
                </>
              ) : (
                <>
                  <div style={{
                    width: 90, height: 90, borderRadius: 14,
                    border: `2px dashed ${pdfDrop ? "#3b82f6" : th.borderCol}`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 36, opacity: pdfDrop ? 1 : 0.25, transition: "all .2s",
                    background: pdfDrop ? "rgba(59,130,246,0.08)" : "transparent"
                  }}>📄</div>
                  <div style={{ fontSize: 14, color: th.textH2, fontWeight: "700" }}>
                    {pdfDrop ? "Drop to parse" : "Drop your IVR flow PDF here"}
                  </div>
                  <div style={{ fontSize: 12, color: th.textH3 }}>or</div>
                  <button onClick={() => pdfRef.current?.click()}
                    style={{
                      padding: "8px 24px", borderRadius: 8, border: "1px solid rgba(59,130,246,0.5)",
                      background: "rgba(59,130,246,0.12)", color: "#60a5fa", cursor: "pointer",
                      fontSize: 15, fontFamily: "monospace", fontWeight: "700"
                    }}>
                    📄 Browse PDF file
                  </button>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 4 }}>
                    <div style={{ height: 1, width: 60, background: th.borderCol }} />
                    <span style={{ fontSize: 9, color: th.textFaint }}>or drag nodes from palette</span>
                    <div style={{ height: 1, width: 60, background: th.borderCol }} />
                  </div>
                  <div style={{ fontSize: 9, color: th.textFaint, textAlign: "center", lineHeight: 1.7 }}>
                    Claude reads your PDF and builds the complete<br />SCP flow with nodes, edges and parameters
                  </div>
                </>
              )}
            </div>
          )}
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          {connecting && (
            <div style={{
              position: "absolute", bottom: 12, left: "50%", transform: "translateX(-50%)",
              background: "rgba(59,130,246,0.18)", border: "1px solid rgba(59,130,246,0.5)",
              borderRadius: 6, padding: "5px 14px", fontSize: 12, color: "#60a5fa", fontFamily: "monospace", pointerEvents: "none"
            }}>
              {connFrom ? `"${connFrom.label}" → click target` : "Click source node first"}
            </div>
          )}
        </div>

        {/* Inspector */}
        <div style={{ width: 240, flexShrink: 0, borderLeft: `1px solid ${th.borderCol}`, background: th.panelBg, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!liveSel ? (
            <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 8, color: th.textH3, padding: 20, textAlign: "center" }}>
              <div style={{ fontSize: 22, opacity: 0.2 }}>🖱</div>
              <div style={{ fontSize: 12, lineHeight: 1.6 }}>Click a node to edit its parameters</div>
              <div style={{ fontSize: 9, color: th.textFaint, lineHeight: 1.6, marginTop: 4 }}>Use Connect Nodes to wire edges</div>
            </div>
          ) : (
            <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
              <div style={{ padding: "10px 12px", borderBottom: `1px solid ${th.borderCol}`, background: `linear-gradient(135deg,${COLS[liveSel.type] || "#888"}1a,${th.panelBg})` }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  <div style={{ width: 9, height: 9, borderRadius: 2, background: COLS[liveSel.type] || "#888" }} />
                  <span style={{ fontSize: 11, fontWeight: "700", color: COLS[liveSel.type] || "#888", fontFamily: "monospace" }}>{liveSel.type}</span>
                  <span style={{ fontSize: 11, color: th.textFaint, fontFamily: "monospace", marginLeft: "auto" }}>#{liveSel.id}</span>
                </div>
                <div style={{ fontSize: 11, color: th.textH3, fontFamily: "monospace", marginBottom: 3 }}>Label</div>
                <input value={liveSel.label || ""} onChange={e => updateLabel(liveSel.id, e.target.value)}
                  style={{ width: "100%", padding: "5px 7px", borderRadius: 5, border: `1px solid ${th.borderCol}`, background: th.rowHdr, color: th.textH1, fontSize: 12, fontFamily: "monospace", outline: "none", boxSizing: "border-box" }} />
              </div>
              {(SCHEMA[liveSel.type] || []).length > 0 && (
                <div style={{ padding: "10px 12px", borderBottom: `1px solid ${th.borderCol}`, display: "flex", flexDirection: "column", gap: 7 }}>
                  <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace" }}>Parameters</div>
                  {(SCHEMA[liveSel.type] || []).map(f => (
                    <div key={f.k} style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      <div style={{ fontSize: 11, color: th.textH3, fontFamily: "monospace" }}>{f.l}</div>
                      {f.o ? (
                        <select value={liveSel.params?.[f.k] || ""} onChange={e => updateParam(liveSel.id, f.k, e.target.value)}
                          style={{ padding: "4px 7px", borderRadius: 4, border: `1px solid ${th.borderCol}`, background: th.rowHdr, color: th.textH1, fontSize: 9, fontFamily: "monospace", outline: "none", cursor: "pointer" }}>
                          {f.o.map(o => <option key={o} value={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={liveSel.params?.[f.k] || ""} placeholder={f.l + "…"} onChange={e => updateParam(liveSel.id, f.k, e.target.value)}
                          style={{ padding: "4px 7px", borderRadius: 4, border: `1px solid ${th.borderCol}`, background: th.rowHdr, color: th.textH1, fontSize: 9, fontFamily: "monospace", outline: "none" }} />
                      )}
                    </div>
                  ))}
                </div>
              )}
              {(() => {
                const outs = edges.filter(e => e.source === liveSel.id);
                const ins = edges.filter(e => e.target === liveSel.id);
                if (!outs.length && !ins.length) return null;
                return (
                  <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 4 }}>
                    <div style={{ fontSize: 11, color: th.textH3, letterSpacing: 2, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 2 }}>Connections</div>
                    {outs.map(e => {
                      const tn = nodes.find(x => x.id === e.target); const ec = ECOLS[e.type] || "#888"; return (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 7px", borderRadius: 4, background: th.rowHdr, borderLeft: `2px solid ${ec}` }}>
                          <div style={{ flex: 1, fontSize: 11, color: ec, fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>→ {e.label || "auto"} · {tn?.label || "?"}</div>
                          <span style={{ fontSize: 7, color: ec + "88", fontFamily: "monospace" }}>{e.type}</span>
                        </div>
                      );
                    })}
                    {ins.map(e => {
                      const sn = nodes.find(x => x.id === e.source); const ec = ECOLS[e.type] || "#888"; return (
                        <div key={e.id} style={{ display: "flex", alignItems: "center", gap: 5, padding: "4px 7px", borderRadius: 4, background: th.rowHdr, borderLeft: `2px solid ${ec}66` }}>
                          <div style={{ flex: 1, fontSize: 11, color: ec + "bb", fontFamily: "monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>← {e.label || "auto"} · {sn?.label || "?"}</div>
                          <span style={{ fontSize: 7, color: ec + "55", fontFamily: "monospace" }}>{e.type}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })()}
              <div style={{ padding: "10px 12px", marginTop: "auto", borderTop: `1px solid ${th.borderCol}` }}>
                <button onClick={() => deleteNode(liveSel.id)}
                  style={{ width: "100%", padding: "6px", borderRadius: 5, border: "1px solid rgba(248,113,113,0.35)", background: "rgba(248,113,113,0.08)", color: "#f87171", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                  Delete node
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edge dialog modal */}
      {edgeDlg && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999 }}>
          <div style={{ background: th.panelBg, border: `1px solid ${th.borderCol}`, borderRadius: 10, padding: "20px 24px", width: 300, display: "flex", flexDirection: "column", gap: 12, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }}>
            <div style={{ fontSize: 15, fontWeight: "700", color: th.textH1 }}>Add Edge</div>
            <div>
              <div style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace", marginBottom: 4 }}>
                {nodes.find(n => n.id === edgeDlg.src)?.label} → {nodes.find(n => n.id === edgeDlg.tgt)?.label}
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>Label</div>
              <input value={edgeLbl} onChange={e => setEdgeLbl(e.target.value)}
                placeholder="e.g. 1, Any, active, new…"
                style={{ padding: "7px 9px", borderRadius: 6, border: `1px solid ${th.borderCol}`, background: th.rowHdr, color: th.textH1, fontSize: 11, fontFamily: "monospace", outline: "none" }} />
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <div style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>Type</div>
              <div style={{ display: "flex", gap: 6 }}>
                {["DTMF", "DB", "Normal"].map(t => (
                  <button key={t} onClick={() => setEdgeTyp(t)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: 5, cursor: "pointer", fontFamily: "monospace", fontSize: 12, fontWeight: edgeTyp === t ? "700" : "400",
                      border: `1px solid ${edgeTyp === t ? ECOLS[t] : th.borderCol}`,
                      background: edgeTyp === t ? ECOLS[t] + "22" : "transparent",
                      color: edgeTyp === t ? ECOLS[t] : th.textH3
                    }}>
                    {t}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
              <button onClick={() => setEdgeDlg(null)}
                style={{ flex: 1, padding: "8px", borderRadius: 6, border: `1px solid ${th.borderCol}`, background: "transparent", color: th.textH3, cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>
                Cancel
              </button>
              <button onClick={addEdgeConfirm}
                style={{ flex: 1, padding: "8px", borderRadius: 6, border: "none", background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: "700" }}>
                Add Edge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


// ─── Download helpers ─────────────────────────────────────────────────────────
function dlSVG(el, name) { const s = new XMLSerializer().serializeToString(el); const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([s], { type: "image/svg+xml" })); a.download = name; a.click(); }
function dlPNG(el, name, w, h) { const s = new XMLSerializer().serializeToString(el); const c = document.createElement("canvas"); c.width = w * 2; c.height = h * 2; const img = new Image(); img.onload = () => { c.getContext("2d").drawImage(img, 0, 0, w * 2, h * 2); const a = document.createElement("a"); a.href = c.toDataURL("image/png"); a.download = name; a.click(); }; img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(s))); }

// ─── DB API helper ────────────────────────────────────────────────────────────
  const API = (typeof window !== "undefined" && window.SCP_API_URL) || (typeof window !== "undefined" && window.location.hostname === "localhost" ? "http://localhost:8000" : API_BASE);
  const getAuthHeaders = () => {
    const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
    return { "Content-Type": "application/json", ...(token ? { "Authorization": `Bearer ${token}` } : {}) };
  };

async function dbSave(payload) { try { const r = await fetch(`${API}/api/flows`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(payload) }); return await r.json(); } catch (e) { return { ok: false, error: e.message }; } }
async function dbSaveExplanation(uuid, sections) { try { const r = await fetch(`${API}/api/flows/${uuid}/explanation`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ sections }) }); return await r.json(); } catch (e) { return { ok: false, error: e.message }; } }
async function dbList() { try { const r = await fetch(`${API}/api/flows`, { headers: getAuthHeaders() }); return await r.json(); } catch (e) { return { ok: false, flows: [] }; } }
async function dbGet(uuid) { try { const r = await fetch(`${API}/api/flows/${uuid}`, { headers: getAuthHeaders() }); return await r.json(); } catch (e) { return { ok: false, error: e.message }; } }
async function dbDelete(uuid) { try { const r = await fetch(`${API}/api/flows/${uuid}`, { method: "DELETE", headers: getAuthHeaders() }); return await r.json(); } catch (e) { return { ok: false, error: e.message }; } }

// ─── Flow Explain Tab ─────────────────────────────────────────────────────────
function FlowExplainTab({ graph, displayNodes, edges, fname, flowUuid, originalXmlProp, th }) {
  const [status, setStatus] = useState("idle"); // idle|loading|done|error
  const [sections, setSections] = useState([]);      // [{title, body}]
  const [errMsg, setErrMsg] = useState("");
  const [xmlInput, setXmlInput] = useState("");
  const [originalXml, setOriginalXml] = useState(originalXmlProp || "");
  const [dragging, setDragging] = useState(false);
  const [localUuid, setLocalUuid] = useState(null);   // uuid when XML uploaded in this tab
  const [dbSaveMsg, setDbSaveMsg] = useState(null);   // "saved"|"error"
  const fileRef = useRef(null);

  useEffect(() => {
    if (originalXmlProp) setOriginalXml(originalXmlProp);
  }, [originalXmlProp]);

  // Build a compact text summary of the parsed graph for the prompt
  function buildFlowSummary(nodes, edgeList) {
    const lines = [];
    lines.push(`Flow: ${fname || "Unknown"}`);
    lines.push(`Total nodes: ${nodes.length}, Total edges: ${edgeList.length}`);
    lines.push("");
    lines.push("NODES:");
    nodes.forEach(n => {
      const params = Object.entries(n.params || {})
        .filter(([, v]) => v && v !== "null" && v !== "0" && v !== "false")
        .map(([k, v]) => `${k}=${v}`).join(", ");
      lines.push(`  [${n.type}] ${n.label}${params ? ` (${params})` : ""}  id:${n.id}`);
    });
    lines.push("");
    lines.push("CONNECTIONS:");
    edgeList.forEach(e => {
      const sn = nodes.find(n => n.id === e.source), tn = nodes.find(n => n.id === e.target);
      if (sn && tn) lines.push(`  ${sn.label} --[${e.etype}${e.label ? ": " + e.label : ""}]--> ${tn.label}`);
    });
    return lines.join("\n");
  }

  async function generateExplanation(nodes, edgeList, filename) {
    setStatus("loading"); setErrMsg(""); setSections([]);
    const summary = buildFlowSummary(nodes, edgeList);
    const SYSTEM = `You are a telecom IVR flow analyst. Given a technical BnG SCP IVR flow structure, explain it clearly in plain English for a non-technical business stakeholder.

Structure your response as clearly labelled sections. Use this exact format for each section — a line starting with ### followed by the title, then the content:

### Overview
[2-3 sentences describing what this IVR service does, who it serves, and what the caller experience is]

### Call Entry & Language
[How the call starts, what short code, what language options are offered]

### User Journey — New User
[Step by step what a new/unsubscribed caller experiences. Use numbered steps. Be specific about key presses, prompts played, subscription attempts]

### User Journey — Active User
[Step by step what an active/subscribed caller experiences]

### User Journey — Grace/Low Balance User
[What happens to users with insufficient balance]

### Subscription & Billing
[How subscription works, what URLs are called, what happens on success/failure]

### Audio Prompts
[List the key prompt files played and what each one says/does]

### B-Party Flow
[If there is a B-party/recipient flow, explain it. If not, write "No B-party flow detected."]

### Technical Summary
[Brief: node count by type, edge types used, any notable technical patterns]

Write in plain English. Use bullet points and numbered lists. Avoid technical jargon. Make it useful for a product manager reading a business requirements document.`;

    try {
      let resp;
      if (originalXml) {
        // Use the specialized XML-to-English generator
        resp = await fetch(`${API}/generate-flow-explanation`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({ xml_content: originalXml })
        });
      } else {
        // Fallback to text-based summary explanation
        resp = await fetch(`${API}/explain-flow`, {
          method: "POST",
          headers: getAuthHeaders(),
          body: JSON.stringify({
            system: SYSTEM,
            message: `Here is the IVR flow structure from "${filename}":\n\n${summary}\n\nPlease explain this IVR flow in plain English as described.`
          })
        });
      }
      if (!resp.ok) { const t = await resp.text(); throw new Error(`API ${resp.status}: ${t.slice(0, 200)}`); }
      const data = await resp.json();
      const raw = data.explanation || "";
      if (!raw) throw new Error("Empty response from API");

      // Parse sections by ### heading
      const parts = raw.split(/^###\s+/m).filter(Boolean);
      const parsed = parts.map(p => {
        const nl = p.indexOf("\n");
        return { title: p.slice(0, nl).trim(), body: p.slice(nl + 1).trim() };
      });
      setSections(parsed.length ? parsed : [{ title: "Explanation", body: raw }]);
      setStatus("done");
      // Save to DB if we have a flow uuid
      const targetUuid = flowUuid || localUuid;
      if (targetUuid && parsed.length) {
        dbSaveExplanation(targetUuid, parsed.map((s, i) => ({ title: s.title, body: s.body, order: i })));
      }
    } catch (e) {
      setErrMsg(e.message || "Failed to generate explanation");
      setStatus("error");
    }
  }

  // Parse an XML file dropped/uploaded directly in this tab
  function handleXmlFile(file) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const xmlText = e.target.result;
        setOriginalXml(xmlText);
        const parsed = parseXML(xmlText);
        if (!parsed.nodes.length) throw new Error("No nodes found in XML");
        const dn = parsed.nodes.map(n => ({ ...n, x: n.lx, y: n.ly }));
        // Save to DB first, then generate explanation
        const startNode = parsed.nodes.find(n => n.type === "Start");
        const payload = {
          flowName: startNode?.params?.service || startNode?.label || file.name.replace(/\.[^.]+$/, ""),
          serviceName: startNode?.params?.service || null,
          shortCode: startNode?.params?.shortcode || null,
          callType: startNode?.params?.calltype || "IVR",
          defaultLang: startNode?.params?.defaultlang || "_E",
          source: "xml_upload",
          filename: file.name,
          xmlContent: xmlText,
          nodes: dn,
          edges: parsed.edges,
        };
        dbSave(payload).then(res => {
          if (res.ok) { setLocalUuid(res.uuid); setDbSaveMsg("saved"); }
          else setDbSaveMsg("error");
        });
        generateExplanation(dn, parsed.edges, file.name);
      } catch (err) {
        setErrMsg(err.message);
        setStatus("error");
      }
    };
    reader.readAsText(file);
  }

  function handleDrop(e) {
    e.preventDefault(); setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleXmlFile(file);
  }

  function downloadMD() {
    const md = sections.map(s => `## ${s.title}\n\n${s.body}`).join("\n\n---\n\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([md], { type: "text/markdown" }));
    a.download = (fname || "flow").replace(/\.[^.]+$/, "") + "_explanation.md";
    a.click();
  }

  const btnBase = { fontSize: 12, padding: "5px 13px", borderRadius: 6, border: `1px solid ${th.borderCol}`, background: "transparent", color: th.textH3, cursor: "pointer", fontFamily: "monospace" };

  // Colour map for section titles
  const SECTION_COLORS = {
    "Overview": "#60a5fa", "Call Entry": "#34d399", "User Journey — New": "#fbbf24",
    "User Journey — Active": "#4ade80", "User Journey — Grace": "#fb923c",
    "Subscription": "#c084fc", "Audio Prompts": "#2dd4bf",
    "B-Party": "#f87171", "Technical": "#8aafd4"
  };
  function sectionColor(title) {
    for (const [k, v] of Object.entries(SECTION_COLORS)) if (title.includes(k)) return v;
    return "#8aafd4";
  }

  // Format body text — bold **…**, bullet lists, numbered lists
  function renderBody(body) {
    return body.split("\n").map((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return <div key={i} style={{ height: 8 }} />;
      // Bullet
      const isBullet = /^[-•*]\s/.test(trimmed);
      // Numbered
      const isNum = /^\d+\.\s/.test(trimmed);
      const text = trimmed.replace(/^[-•*\d.]\s*/, "");
      // Bold inline **...**
      const parts = text.split(/\*\*(.+?)\*\*/g);
      const rendered = parts.map((p, j) => j % 2 === 1 ? <strong key={j} style={{ color: th.textH1, fontWeight: "700" }}>{p}</strong> : p);
      return (
        <div key={i} style={{ display: "flex", gap: 8, marginBottom: 4, alignItems: "flex-start" }}>
          {(isBullet || isNum) && <span style={{ color: th.textH3, flexShrink: 0, fontFamily: "monospace", fontSize: 12, marginTop: 2 }}>{isNum ? trimmed.match(/^\d+/)[0] + "." : "•"}</span>}
          <span style={{ fontSize: 11, color: th.textH2, lineHeight: 1.7 }}>{rendered}</span>
        </div>
      );
    });
  }

  const hasGraph = displayNodes && displayNodes.length > 0;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", background: th.appBg }}>

      {/* Toolbar */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 16px", borderBottom: `1px solid ${th.borderCol}`, background: th.headerBg, flexShrink: 0, flexWrap: "wrap" }}>
        <span style={{ fontSize: 11, fontWeight: "700", color: th.textH1 }}>📖 Flow Explanation</span>
        <div style={{ width: 1, height: 16, background: th.borderCol }} />
        {hasGraph && (
          <button onClick={() => generateExplanation(displayNodes, edges, fname || "flow.xml")}
            disabled={status === "loading"}
            style={{
              ...btnBase, border: `1px solid ${status === "loading" ? "#3b82f6" : th.borderCol}`,
              color: status === "loading" ? "#60a5fa" : th.textH2, fontWeight: "600"
            }}>
            {status === "loading" ? "⚙ Generating…" : "⚙ Explain Current Flow"}
          </button>
        )}
        <button onClick={() => fileRef.current?.click()} style={btnBase}>
          📂 Upload XML File
        </button>
        <input ref={fileRef} type="file" accept=".xml,.txt" style={{ display: "none" }}
          onChange={e => e.target.files[0] && handleXmlFile(e.target.files[0])} />
        {status === "done" && <button onClick={downloadMD} style={btnBase}>⬇ Download .md</button>}
        {status === "error" && <span style={{ fontSize: 9, color: "#f87171", fontFamily: "monospace" }}>{errMsg.slice(0, 80)}</span>}
        {dbSaveMsg && (
          <span style={{
            fontSize: 9, padding: "3px 9px", borderRadius: 4, fontFamily: "monospace",
            background: dbSaveMsg === "saved" ? "rgba(52,211,153,0.12)" : "rgba(248,113,113,0.12)",
            border: `1px solid ${dbSaveMsg === "saved" ? "rgba(52,211,153,0.3)" : "rgba(248,113,113,0.3)"}`,
            color: dbSaveMsg === "saved" ? "#34d399" : "#f87171"
          }}>
            {dbSaveMsg === "saved" ? "✓ Saved to DB" : "✗ DB Error"}
          </span>
        )}
        <span style={{ marginLeft: "auto", fontSize: 9, color: th.textFaint, fontFamily: "monospace" }}>
          {fname && `📄 ${fname}`}
        </span>
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column", gap: 0 }}>

        {/* Idle / empty state */}
        {status === "idle" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              style={{
                display: "flex", flexDirection: "column", alignItems: "center", gap: 14,
                padding: 40, borderRadius: 14, border: `2px dashed ${dragging ? "#3b82f6" : th.borderCol}`,
                background: dragging ? "rgba(59,130,246,0.05)" : "transparent",
                transition: "all .2s", maxWidth: 480, textAlign: "center"
              }}>
              <div style={{ fontSize: 40, opacity: 0.2 }}>📖</div>
              <div style={{ fontSize: 13, fontWeight: "700", color: th.textH2 }}>
                {dragging ? "Drop XML to explain" : "Explain any SCP flow in plain English"}
              </div>
              <div style={{ fontSize: 12, color: th.textH3, lineHeight: 1.7 }}>
                Upload an XML flow file or use a flow already loaded in the Flow Diagram tab.<br />
                Claude will generate a full plain-English walkthrough of every user journey,<br />
                subscription logic, prompts and technical structure.
              </div>
              <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
                <button onClick={() => fileRef.current?.click()}
                  style={{
                    padding: "8px 20px", borderRadius: 7, border: "1px solid rgba(59,130,246,0.4)",
                    background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer",
                    fontSize: 11, fontFamily: "monospace", fontWeight: "600"
                  }}>
                  📂 Upload XML
                </button>
                {hasGraph && (
                  <button onClick={() => generateExplanation(displayNodes, edges, fname || "flow.xml")}
                    style={{
                      padding: "8px 20px", borderRadius: 7, border: "1px solid rgba(52,211,153,0.4)",
                      background: "rgba(52,211,153,0.1)", color: "#34d399", cursor: "pointer",
                      fontSize: 11, fontFamily: "monospace", fontWeight: "600"
                    }}>
                    ⚙ Explain Current Flow
                  </button>
                )}
              </div>
              {!hasGraph && (
                <div style={{ fontSize: 9, color: th.textFaint, marginTop: 4 }}>
                  Tip: Upload a flow in the Flow Diagram tab first to use "Explain Current Flow"
                </div>
              )}
            </div>
          </div>
        )}

        {/* Loading */}
        {status === "loading" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, color: th.textH3 }}>
            <div style={{ fontSize: 32, opacity: 0.4 }}>📖</div>
            <div style={{ fontSize: 15, color: th.textH2, fontWeight: "600" }}>Analysing IVR flow…</div>
            <div style={{ fontSize: 9, color: th.textFaint }}>Claude is reading every node and connection</div>
          </div>
        )}

        {/* Error */}
        {status === "error" && (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
            <div style={{ fontSize: 28, opacity: 0.4 }}>⚠</div>
            <div style={{ fontSize: 15, color: "#f87171", fontWeight: "600" }}>Explanation failed</div>
            <div style={{
              fontSize: 9, color: "#f87171aa", fontFamily: "monospace", maxWidth: 440, textAlign: "center",
              padding: "10px 14px", borderRadius: 7, background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.25)", wordBreak: "break-word", lineHeight: 1.7
            }}>
              {errMsg}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => fileRef.current?.click()} style={{ padding: "6px 16px", borderRadius: 6, border: `1px solid ${th.borderCol}`, background: "transparent", color: th.textH3, cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Upload Different File</button>
              {hasGraph && <button onClick={() => generateExplanation(displayNodes, edges, fname || "flow.xml")} style={{ padding: "6px 16px", borderRadius: 6, border: "1px solid rgba(59,130,246,0.4)", background: "rgba(59,130,246,0.1)", color: "#60a5fa", cursor: "pointer", fontSize: 12, fontFamily: "monospace" }}>Retry Current Flow</button>}
            </div>
          </div>
        )}

        {/* Results */}
        {status === "done" && sections.length > 0 && (
          <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 0 }}>

            {/* Section nav pills */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 20 }}>
              {sections.map((s, i) => (
                <a key={i} href={`#section-${i}`}
                  style={{
                    fontSize: 9, padding: "3px 10px", borderRadius: 20,
                    border: `1px solid ${sectionColor(s.title)}44`,
                    background: sectionColor(s.title) + "15",
                    color: sectionColor(s.title), fontFamily: "monospace",
                    textDecoration: "none", cursor: "pointer"
                  }}>
                  {s.title}
                </a>
              ))}
            </div>

            {/* Section cards */}
            {sections.map((s, i) => {
              const col = sectionColor(s.title);
              return (
                <div key={i} id={`section-${i}`}
                  style={{
                    marginBottom: 16, borderRadius: 10, overflow: "hidden",
                    border: `1px solid ${th.borderCol}`, background: th.panelBg
                  }}>
                  {/* Section header */}
                  <div style={{
                    padding: "10px 16px", borderBottom: `1px solid ${th.borderCol}`,
                    background: `linear-gradient(90deg,${col}18,transparent)`,
                    display: "flex", alignItems: "center", gap: 10
                  }}>
                    <div style={{ width: 3, height: 18, borderRadius: 2, background: col, flexShrink: 0 }} />
                    <span style={{ fontSize: 15, fontWeight: "700", color: col, fontFamily: "monospace", letterSpacing: 0.3 }}>
                      {s.title}
                    </span>
                  </div>
                  {/* Section body */}
                  <div style={{ padding: "14px 16px 16px" }}>
                    {renderBody(s.body)}
                  </div>
                </div>
              );
            })}

            <div style={{ textAlign: "center", padding: "8px 0 4px", fontSize: 9, color: th.textFaint, fontFamily: "monospace" }}>
              Generated from {fname || "flow"} · {displayNodes?.length || 0} nodes · {edges?.length || 0} edges
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [graph, setGraph] = useState(null);
  const [sel, setSel] = useState(null);
  const [err, setErr] = useState(null);
  const [fname, setFname] = useState(null);
  const [isDragging, setDrag] = useState(false);
  const [tab, setTab] = useState("upload");
  const [showLeg, setLeg] = useState(true);
  const [zoom, setZoom] = useState(0.7);
  const [pan, setPan] = useState({ x: 30, y: 20 });
  const [themeKey, setThemeKey] = useState("light");
  const [showDlMenu, setDlMenu] = useState(false);
  const [flowUuid, setFlowUuid] = useState(null);   // DB uuid for current flow
  const [dbStatus, setDbStatus] = useState(null);   // null|"saving"|"saved"|"error"
  const [originalXml, setOriginalXml] = useState("");
  const panRef = useRef(null), fileRef = useRef(), svgRef = useRef();
  const th = THEMES[themeKey];

  // ── Save current flow to DB ───────────────────────────────────────────────
  async function saveFlowToDB(g, filename, xmlText, existingUuid) {
    if (!g || !g.nodes.length) return null;
    setDbStatus("saving");
    const startNode = g.nodes.find(n => n.type === "Start");
    const payload = {
      uuid: existingUuid || null,
      flowName: startNode?.params?.service || startNode?.label || filename?.replace(/\.[^.]+$/, "") || "Unnamed",
      serviceName: startNode?.params?.service || null,
      shortCode: startNode?.params?.shortcode || null,
      callType: startNode?.params?.calltype || "IVR",
      defaultLang: startNode?.params?.defaultlang || "_E",
      source: "xml_upload",
      filename: filename || null,
      xmlContent: xmlText || null,
      nodes: g.nodes.map(n => ({ ...n, x: n.lx || n.x || 0, y: n.ly || n.y || 0 })),
      edges: g.edges,
    };
    const res = await dbSave(payload);
    if (res.ok) {
      setFlowUuid(res.uuid);
      setDbStatus("saved");
      setTimeout(() => setDbStatus(null), 3000);
      return res.uuid;
    } else {
      setDbStatus("error");
      setTimeout(() => setDbStatus(null), 5000);
      return null;
    }
  }

  async function handleFile(file) {
    setErr(null); setSel(null);
    try {
      let txt = "";
      if (file.name.match(/\.(jar|zip)$/i)) {
        const Z = (await import("https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js")).default;
        const zip = await Z.loadAsync(file);
        const xf = Object.keys(zip.files).filter(n => n.match(/\.(xml|txt)$/i));
        for (const f of xf) { const t = await zip.files[f].async("string"); if (t.includes("mxGraphModel")) { txt = t; break; } }
        if (!txt) throw new Error("No SCP XML found in JAR");
      } else txt = await file.text();
      setOriginalXml(txt);
      const g = parseXML(txt);
      if (!g.nodes.length) throw new Error("No nodes found — check this is a BnG SCP flow file");
      setGraph(g); setFname(file.name); setTab("diagram"); setZoom(0.7); setPan({ x: 30, y: 20 });
      // Auto-save to MySQL
      saveFlowToDB(g, file.name, txt, null);
    } catch (e) { setErr(e.message); }
  }

  const { displayNodes, edges } = useMemo(() => { if (!graph) return { displayNodes: [], edges: [] }; return { displayNodes: graph.nodes.map(n => ({ ...n, x: n.lx, y: n.ly })), edges: graph.edges }; }, [graph]);
  const nm = useMemo(() => { const m = {}; displayNodes.forEach(n => m[n.id] = n); return m; }, [displayNodes]);
  const typeCounts = useMemo(() => { const c = {}; displayNodes.forEach(n => { c[n.type] = (c[n.type] || 0) + 1; }); return c; }, [displayNodes]);
  const svgW = displayNodes.length ? Math.max(1400, ...displayNodes.map(n => n.x + n.w + 100)) : 1400;
  const svgH = displayNodes.length ? Math.max(700, ...displayNodes.map(n => n.y + n.h + 100)) : 700;
  const baseName = (fname || "flow").replace(/\.[^.]+$/, "");

  const TABS = [{ id: "upload", label: "↑ Upload" }, { id: "diagram", label: "⬡ Flow Diagram" }, { id: "prompts", label: "🎵 Prompt Details" }, { id: "builder", label: "⚒ Flow Builder" }, { id: "explain", label: "📖 Flow Explanation" }];

  return (
    <div style={{ height: "100vh", display: "flex", flexDirection: "column", background: th.appBg, color: th.textH1, fontFamily: "'JetBrains Mono','Fira Code',monospace" }} onClick={() => setDlMenu(false)}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 20px", borderBottom: `1px solid ${th.borderCol}`, background: th.headerBg, flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 36, height: 36, borderRadius: 8, background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "900", fontSize: 15, color: "#fff" }}>SCP</div>
          <div>
            <div style={{ fontSize: 13, fontWeight: "700", color: th.textH1, letterSpacing: 1 }}>IVR FLOW TOOL</div>
            <div style={{ fontSize: 7, color: th.textFaint, letterSpacing: 3, textTransform: "uppercase" }}>BnG CoreEngine 4 · Visualizer + Builder</div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
          {graph && [["Nodes", displayNodes.length], ["Edges", edges.length]].map(([k, v]) => (<div key={k} style={{ textAlign: "center" }}><div style={{ fontSize: 18, fontWeight: "700", color: "#3b82f6", lineHeight: 1 }}>{v}</div><div style={{ fontSize: 7, color: th.textFaint, textTransform: "uppercase", letterSpacing: 2 }}>{k}</div></div>))}
          {fname && <span style={{ fontSize: 9, color: th.textH3 }}>📄 {fname}</span>}
          {/* DB status indicator */}
          {dbStatus && (
            <span style={{
              fontSize: 9, padding: "3px 9px", borderRadius: 4, fontFamily: "monospace",
              background: dbStatus === "saved" ? "rgba(52,211,153,0.12)" : dbStatus === "saving" ? "rgba(59,130,246,0.12)" : "rgba(248,113,113,0.12)",
              border: `1px solid ${dbStatus === "saved" ? "rgba(52,211,153,0.3)" : dbStatus === "saving" ? "rgba(59,130,246,0.3)" : "rgba(248,113,113,0.3)"}`,
              color: dbStatus === "saved" ? "#34d399" : dbStatus === "saving" ? "#60a5fa" : "#f87171"
            }}>
              {dbStatus === "saving" ? "⏳ Saving…" : dbStatus === "saved" ? "✓ Saved to DB" : "✗ DB Error"}
            </span>
          )}
          {/* Theme switcher removed as requested for forced Light Mode */}
          {graph && (<div style={{ position: "relative" }} onClick={e => e.stopPropagation()}>
            <button onClick={() => setDlMenu(v => !v)} style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, background: "linear-gradient(135deg,#1d4ed8,#0ea5e9)", border: "none", color: "#fff", cursor: "pointer", fontSize: 12, fontFamily: "monospace", fontWeight: "700" }}>⬇ Download</button>
            {showDlMenu && (<div style={{ position: "absolute", right: 0, top: 36, background: th.panelBg, border: `1px solid ${th.borderCol}`, borderRadius: 8, padding: 6, zIndex: 200, minWidth: 145, boxShadow: "0 8px 28px rgba(0,0,0,0.35)" }}>
              <button onClick={() => { if (svgRef.current) dlSVG(svgRef.current, baseName + ".svg"); setDlMenu(false); }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", color: th.textH1, cursor: "pointer", fontSize: 12, fontFamily: "monospace", textAlign: "left", borderRadius: 4 }}>📐 SVG (vector)</button>
              <button onClick={() => { if (svgRef.current) dlPNG(svgRef.current, baseName + ".png", svgW, svgH); setDlMenu(false); }} style={{ display: "block", width: "100%", padding: "8px 12px", background: "none", border: "none", color: th.textH1, cursor: "pointer", fontSize: 12, fontFamily: "monospace", textAlign: "left", borderRadius: 4 }}>🖼 PNG (2×)</button>
            </div>)}
          </div>)}
        </div>
      </header>

      <div style={{ display: "flex", borderBottom: `1px solid ${th.borderCol}`, background: th.tabBg, flexShrink: 0 }}>
        {TABS.map(({ id, label }) => (<button key={id} onClick={() => setTab(id)} style={{ padding: "9px 22px", background: "none", border: "none", cursor: "pointer", borderBottom: `2px solid ${tab === id ? "#3b82f6" : "transparent"}`, color: tab === id ? "#60a5fa" : th.textH3, fontSize: 12, fontFamily: "monospace", letterSpacing: 1, textTransform: "uppercase", fontWeight: tab === id ? "700" : "400" }}>{label}</button>))}
      </div>

      {/* Upload Tab */}
      {tab === "upload" && (<div style={{ flex: 1, overflow: "auto", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "16px 28px", borderBottom: `1px solid ${th.borderCol}`, background: th.headerBg, display: "flex", gap: 14, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
          <div onDragOver={e => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); e.dataTransfer.files[0] && handleFile(e.dataTransfer.files[0]); }}
            onClick={() => fileRef.current.click()}
            style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 18px", borderRadius: 10, border: `2px dashed ${isDragging ? "#3b82f6" : th.borderCol}`, cursor: "pointer", background: isDragging ? "rgba(59,130,246,0.06)" : "transparent", flexShrink: 0 }}>
            <input ref={fileRef} type="file" accept=".xml,.txt,.jar,.zip" style={{ display: "none" }} onChange={e => e.target.files[0] && handleFile(e.target.files[0])} />
            <div style={{ fontSize: 22, opacity: 0.35 }}>☏</div>
            <div><div style={{ fontSize: 11, color: th.textH2, fontWeight: "700", marginBottom: 2 }}>Drop SCP XML or JAR here</div><div style={{ fontSize: 11, color: th.textH3 }}>Accepts .xml · .txt · .jar · .zip</div></div>
            <div style={{ padding: "5px 14px", borderRadius: 6, background: "rgba(59,130,246,0.12)", border: "1px solid rgba(59,130,246,0.35)", fontSize: 9, color: "#60a5fa", fontWeight: "700", marginLeft: 6, whiteSpace: "nowrap" }}>Browse Files</div>
          </div>
          {err ? <div style={{ padding: "9px 14px", borderRadius: 7, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.3)", color: "#f87171", fontSize: 12, flex: 1 }}>⚠ {err}</div>
            : <div style={{ fontSize: 9, color: th.textH3, lineHeight: 1.7 }}>Upload a BnG SCP flow file to visualize · Or use <strong style={{ color: "#60a5fa" }}>⚒ Flow Builder</strong> to create a new SCP XML from PDF or text.</div>}
        </div>
        <div style={{ padding: "20px 28px", flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: "700", color: th.textH1 }}>SCP Node Catalog</div>
            <div style={{ fontSize: 9, color: th.textH3, fontFamily: "monospace" }}>{ALL_NODES.length} node types · CoreEngine_4.jar</div>
          </div>
          <div style={{ fontSize: 8.5, color: th.textH3, marginBottom: 20, lineHeight: 1.6 }}>All node types available in BnG CoreEngine 4 — extracted from the JAR. These are the exact types the Flow Builder uses when generating XML.</div>
          {NODE_CATEGORIES.map(cat => {
            const catNodes = ALL_NODES.filter(n => n.cat === cat.id);
            if (!catNodes.length) return null;
            return (<div key={cat.id} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: cat.color, flexShrink: 0 }} />
                <div style={{ width: 26, height: 26, borderRadius: 6, background: cat.color + "18", border: `1px solid ${cat.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, color: cat.color, flexShrink: 0 }}>{cat.icon}</div>
                <span style={{ fontSize: 11, fontWeight: "700", color: cat.color, fontFamily: "monospace" }}>{cat.label}</span>
                <span style={{ fontSize: 11, color: th.textH3, fontFamily: "monospace" }}>({catNodes.length} nodes)</span>
                <div style={{ flex: 1, height: 1, background: th.borderCol }} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(210px,1fr))", gap: 8 }}>
                {catNodes.map(node => (<div key={node.name} style={{ padding: "11px 13px", borderRadius: 9, background: th.panelBg, border: `1px solid ${th.borderCol}`, display: "flex", flexDirection: "column", gap: 6, transition: "border-color .15s,box-shadow .15s" }}
                  onMouseEnter={e => { e.currentTarget.style.borderColor = cat.color + "66"; e.currentTarget.style.boxShadow = `0 0 0 1px ${cat.color}22`; }}
                  onMouseLeave={e => { e.currentTarget.style.borderColor = th.borderCol; e.currentTarget.style.boxShadow = "none"; }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <div style={{ width: 26, height: 26, borderRadius: 6, background: cat.color + "18", border: `1px solid ${cat.color}44`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, color: cat.color, flexShrink: 0 }}>{cat.icon}</div>
                    <span style={{ fontSize: 12, fontWeight: "700", color: th.textH1, fontFamily: "monospace", wordBreak: "break-word", lineHeight: 1.3 }}>{node.name}</span>
                  </div>
                  <div style={{ fontSize: 8.5, color: th.textH3, lineHeight: 1.55, paddingLeft: 34 }}>{node.desc}</div>
                  {node.params?.length > 0 && (<div style={{ paddingLeft: 34, display: "flex", flexWrap: "wrap", gap: 3, marginTop: 2 }}>
                    {node.params.slice(0, 5).map(p => (<span key={p} style={{ fontSize: 6.5, padding: "2px 5px", borderRadius: 3, background: cat.color + "12", border: `1px solid ${cat.color}28`, color: cat.color, fontFamily: "monospace" }}>{p}</span>))}
                    {node.params.length > 5 && <span style={{ fontSize: 6.5, color: th.textFaint, fontFamily: "monospace", alignSelf: "center" }}>+{node.params.length - 5}</span>}
                  </div>)}
                </div>))}
              </div>
            </div>);
          })}
        </div>
      </div>)}

      {/* Diagram Tab */}
      {tab === "diagram" && (<div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {!graph ? (<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, color: th.textH3 }}>
            <div style={{ fontSize: 40, opacity: 0.3 }}>⬡</div>
            <div style={{ fontSize: 12 }}>Upload an SCP flow file to visualize</div>
            <button onClick={() => setTab("upload")} style={{ padding: "7px 18px", borderRadius: 6, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", cursor: "pointer", fontFamily: "monospace", fontSize: 10 }}>← Upload</button>
          </div>) : (<>
            <div style={{ flex: 1, overflow: "hidden", background: th.canvasBg, position: "relative", cursor: "grab" }}
              onWheel={e => { e.preventDefault(); setZoom(z => Math.min(3, Math.max(0.1, z - e.deltaY * 0.001))); }}
              onMouseDown={e => { panRef.current = { sx: e.clientX - pan.x, sy: e.clientY - pan.y }; }}
              onMouseMove={e => { if (panRef.current) setPan({ x: e.clientX - panRef.current.sx, y: e.clientY - panRef.current.sy }); }}
              onMouseUp={() => panRef.current = null} onMouseLeave={() => panRef.current = null}>
              <div style={{ position: "absolute", top: 12, right: 12, zIndex: 20, display: "flex", flexDirection: "column", gap: 3 }}>
                {[["＋", () => setZoom(z => Math.min(3, z + 0.1))], ["－", () => setZoom(z => Math.max(0.1, z - 0.1))], ["⟳", () => { setZoom(0.7); setPan({ x: 30, y: 20 }); }]].map(([l, fn], i) => (<button key={i} onClick={fn} style={{ width: 27, height: 27, borderRadius: 5, background: th.headerBg, border: `1px solid ${th.borderCol}`, color: th.textH2, cursor: "pointer", fontSize: 13, fontFamily: "monospace", display: "flex", alignItems: "center", justifyContent: "center" }}>{l}</button>))}
                <div style={{ fontSize: 11, color: th.textH3, textAlign: "center", fontFamily: "monospace", marginTop: 2 }}>{Math.round(zoom * 100)}%</div>
              </div>
              <svg ref={svgRef} width={svgW} height={svgH} style={{ transform: `scale(${zoom}) translate(${pan.x / zoom}px,${pan.y / zoom}px)`, transformOrigin: "top left" }}>
                <defs>
                  <marker id="arr" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto"><path d="M0,0.5 L0,6.5 L7,3.5 z" fill={th.arrowFill} /></marker>
                  <pattern id="dot" width="28" height="28" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.7" fill={th.dotCol} /></pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#dot)" />
                {edges.map(e => <SvgEdge key={e.id} edge={e} nm={nm} th={th} />)}
                {displayNodes.map(n => <SvgNode key={n.id} n={n} sel={sel?.id === n.id} onSel={setSel} th={th} />)}
              </svg>
            </div>
            <div style={{ borderTop: `1px solid ${th.borderCol}`, background: th.tabBg, flexShrink: 0 }}>
              <button onClick={() => setLeg(v => !v)} style={{ background: "none", border: "none", color: th.textH3, cursor: "pointer", fontSize: 11, fontFamily: "monospace", letterSpacing: 2, textTransform: "uppercase", padding: "5px 14px", display: "block" }}>{showLeg ? "▼" : "►"} Legend</button>
              {showLeg && (<div style={{ padding: "6px 14px 10px", display: "flex", flexWrap: "wrap", gap: 12, alignItems: "center" }}>
                {Object.entries(typeCounts).map(([type, count]) => { const tc = th.nodeTypes[type] || th.nodeTypes.Navigation; const meta = NODE_META[type] || NODE_META.Navigation; return (<div key={type} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 8, height: 8, borderRadius: 2, background: tc.c }} /><span style={{ fontSize: 8.5, color: th.textH2, fontFamily: "monospace" }}>{meta.icon} {type} <span style={{ color: th.textH3 }}>×{count}</span></span></div>); })}
                <div style={{ width: "100%", height: 1, background: th.borderCol }} />
                {Object.entries(th.edges).map(([k, c]) => (<div key={k} style={{ display: "flex", alignItems: "center", gap: 5 }}><div style={{ width: 16, height: 2, background: c, borderRadius: 1 }} /><span style={{ fontSize: 8.5, color: th.textH2, fontFamily: "monospace" }}>{k}</span></div>))}
              </div>)}
            </div>
          </>)}
        </div>
        {sel && <Inspector node={sel} edges={edges} nm={nm} onClose={() => setSel(null)} th={th} />}
      </div>)}

      {/* Prompts Tab */}
      {tab === "prompts" && (!graph ? (<div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 14, color: th.textH3 }}><div style={{ fontSize: 36, opacity: 0.3 }}>🎵</div><div style={{ fontSize: 12 }}>Upload an SCP flow file first</div><button onClick={() => setTab("upload")} style={{ padding: "7px 18px", borderRadius: 6, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", color: "#60a5fa", cursor: "pointer", fontFamily: "monospace", fontSize: 10 }}>← Upload</button></div>) : <PromptsTab nodes={displayNodes} th={th} />)}

      {/* Builder Tab */}
      {tab === "builder" && <FlowBuilderTab th={th} />}

      {/* Explain Tab */}
      {tab === "explain" && <FlowExplainTab graph={graph} displayNodes={displayNodes} edges={edges} fname={fname} flowUuid={flowUuid} originalXmlProp={originalXml} th={th} />}
    </div>
  );
}
