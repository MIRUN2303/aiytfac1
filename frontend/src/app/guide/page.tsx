"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Terminal, Server, Globe, Play, CheckCircle2,
  ArrowRight, Copy, Check, ChevronDown, ChevronUp,
  Cpu, Package, Settings, FileJson, Box, ExternalLink,
} from "lucide-react";

const sections = [
  {
    id: "prerequisites",
    label: "Prerequisites",
    icon: Settings,
    content: [
      { label: "Python 3.11+", desc: "Required for the FastAPI backend and AI pipeline" },
      { label: "Node.js 18+", desc: "Required for the Next.js frontend" },
      { label: "FFmpeg", desc: "Required for video rendering (download from ffmpeg.org)" },
      { label: "Git", desc: "Required for cloning the repository" },
      { label: "Docker (Optional)", desc: "For one-command setup via docker-compose" },
    ],
  },
  {
    id: "clone",
    label: "Clone & Configure",
    icon: Terminal,
    steps: [
      "git clone <repo-url> AI-Youtube-Factory",
      "cd AI-Youtube-Factory",
      `copy .env.example .env`,
      "# Edit .env with your settings",
    ],
    note: "The .env file contains API keys for Pollinations, Puter.js, and YouTube upload. Fill in what you have — the app will still run without them (some features will be simulated).",
  },
  {
    id: "backend",
    label: "Backend Setup",
    icon: Server,
    steps: [
      "cd backend",
      "python -m venv venv",
      `# Windows: venv\\Scripts\\activate`,
      `# Mac/Linux: source venv/bin/activate`,
      "pip install -r requirements.txt",
      "python main.py",
    ],
    note: "The backend starts on http://localhost:8000. API docs available at /docs. You should see workers starting and the health endpoint responding.",
  },
  {
    id: "frontend",
    label: "Frontend Setup",
    icon: Globe,
    steps: [
      "cd frontend",
      "npm install",
      "npm run dev",
    ],
    note: "The frontend starts on http://localhost:3000. Make sure the backend is running first.",
  },
  {
    id: "docker",
    label: "Docker (One-Click)",
    icon: Box,
    steps: [
      "# From the project root:",
      "docker-compose up --build",
    ],
    note: "This starts both backend (port 8000) and frontend (port 3000) with health checks and automatic restarts.",
  },
  {
    id: "usage",
    label: "How to Use",
    icon: Play,
    content: [
      { label: "1. Create a Project", desc: "Go to Dashboard, enter a Topic and Summary, select language and style, then click Generate" },
      { label: "2. Monitor Progress", desc: "Watch real-time progress in the Queue page — each stage updates as it completes" },
      { label: "3. View Results", desc: "Completed projects appear in the Projects page with download links for video, thumbnail, assets" },
      { label: "4. Upload to YouTube", desc: "Use the Uploads page to publish directly (configure YouTube API credentials in Settings)" },
      { label: "5. Schedule", desc: "Use the Calendar page to schedule recurring video generation jobs" },
    ],
  },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

function CodeBlock({ lines }: { lines: string[] }) {
  const [copied, setCopied] = useState(false);
  const code = lines.join("\n");
  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <div className="relative group my-3">
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-900/90 border border-neutral-800 rounded-t-lg">
        <span className="text-xs text-muted font-mono">Terminal</span>
        <button onClick={handleCopy} className="flex items-center gap-1.5 text-xs text-muted hover:text-foreground transition-colors">
          {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="bg-black/60 border-x border-b border-neutral-800 rounded-b-lg p-4 overflow-x-auto text-sm font-mono leading-relaxed text-green-400">
        {code}
      </pre>
    </div>
  );
}

export default function GuidePage() {
  const [activeSection, setActiveSection] = useState<string | null>("prerequisites");
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null);

  return (
    <div className="flex flex-col flex-grow bg-background text-foreground overflow-y-auto">
      <motion.div variants={container} initial="hidden" animate="show" className="max-w-4xl w-full mx-auto p-8">
        <motion.div variants={item} className="mb-10">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <BookOpen size={20} className="text-white" />
            </div>
            <h1 className="text-3xl font-semibold">Getting Started</h1>
          </div>
          <p className="text-muted text-base max-w-2xl">
            Follow this guide to set up and run the AI YouTube Factory on your machine.
            Choose the setup path that works best for you.
          </p>
        </motion.div>

        <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 mb-10">
          {[
            { icon: Terminal, label: "Manual Setup", desc: "Clone, install deps, run backend & frontend separately" },
            { icon: Box, label: "Docker", desc: "Single command with docker-compose" },
            { icon: Play, label: "First Video", desc: "Expected in ~5 minutes on modern hardware" },
          ].map((c, i) => {
            const Icon = c.icon;
            return (
              <div key={i} className="card p-4 flex items-start gap-3">
                <Icon size={20} className="text-blue-400 mt-0.5 shrink-0" />
                <div><p className="font-medium text-sm">{c.label}</p><p className="text-xs text-muted mt-0.5">{c.desc}</p></div>
              </div>
            );
          })}
        </motion.div>

        <motion.div variants={item} className="flex flex-wrap gap-2 mb-10">
          {sections.map((s) => {
            const Icon = s.icon;
            const active = activeSection === s.id;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(activeSection === s.id ? null : s.id)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                  active
                    ? "bg-accent/10 text-accent border-accent/20"
                    : "bg-neutral-900 text-muted border-neutral-800 hover:border-neutral-700"
                }`}
              >
                <Icon size={14} />
                {s.label}
              </button>
            );
          })}
        </motion.div>

        {sections.map((section) => {
          const isOpen = activeSection === section.id;
          if (!isOpen) return null;
          const Icon = section.icon;

          return (
            <motion.div key={section.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="card p-6 mb-6"
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center">
                  <Icon size={16} className="text-accent" />
                </div>
                <h2 className="text-xl font-semibold">{section.label}</h2>
              </div>

              {"content" in section && section.content && (
                <div className="space-y-3">
                  {section.content.map((c: any, i: number) => (
                    <div key={i} className="flex items-start gap-3 bg-neutral-900/60 rounded-lg p-3 border border-neutral-800/50">
                      <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0 mt-0.5">
                        <CheckCircle2 size={12} className="text-accent" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{c.label}</p>
                        <p className="text-xs text-muted mt-0.5">{c.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {"steps" in section && (
                <>
                  <CodeBlock lines={section.steps || []} />
                  {"note" in section && section.note && (
                    <div className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg p-3 text-xs text-yellow-400">
                      <span className="font-medium shrink-0">Note:</span>
                      <span>{section.note}</span>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })}

        <motion.div variants={item} className="card p-6 mb-10 bg-gradient-to-br from-blue-500/5 to-purple-600/5 border-blue-500/10">
          <h2 className="text-lg font-semibold mb-4">Pipeline Stages</h2>
          <p className="text-sm text-muted mb-4">
            Once running, each project goes through these stages automatically:
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {[
              "Generate Story", "Plan Scenes", "Generate Images", "Generate Voice",
              "Generate Subtitles", "Create Video", "Generate Thumbnail", "Generate Short",
            ].map((stage, i) => (
              <div key={i} className="flex items-center gap-2 text-sm bg-black/30 rounded-lg px-3 py-2 border border-neutral-800/50">
                <div className="w-5 h-5 rounded-full bg-accent/10 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold text-accent">{i + 1}</span>
                </div>
                {stage}
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div variants={item} className="card p-6">
          <h2 className="text-lg font-semibold mb-4">FAQ</h2>
          <div className="space-y-2">
            {[
              { q: "Port 8000 is already in use", a: "Change BACKEND_PORT in .env or edit docker-compose.yml to map a different port." },
              { q: "FFmpeg not found errors", a: "Install FFmpeg from ffmpeg.org and add it to your system PATH." },
              { q: "How to add custom voice models?", a: "Drop .onnx voice model files into the backend/voices/ directory — Piper TTS will pick them up automatically." },
              { q: "Can I use a different LLM / image generator?", a: "Yes — install a plugin via the Plugin Manager, or implement a custom provider following the provider interface pattern." },
            ].map((faq, i) => {
              const open = expandedFaq === `faq-${i}`;
              return (
                <div key={i} className="bg-neutral-900/60 rounded-lg border border-neutral-800/50 overflow-hidden">
                  <button onClick={() => setExpandedFaq(open ? null : `faq-${i}`)}
                    className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-left hover:bg-neutral-800/30 transition-colors"
                  >
                    {faq.q}
                    {open ? <ChevronUp size={14} className="text-muted shrink-0" /> : <ChevronDown size={14} className="text-muted shrink-0" />}
                  </button>
                  {open && <div className="px-4 pb-3 text-xs text-muted leading-relaxed">{faq.a}</div>}
                </div>
              );
            })}
          </div>
        </motion.div>
      </motion.div>
    </div>
  );
}
