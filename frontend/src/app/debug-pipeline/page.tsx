"use client";
import React, { useState, useRef } from "react";
import { motion } from "framer-motion";
import {
  ChevronRight, ChevronDown, Play, Loader2, CheckCircle2, XCircle,
  Clock, RefreshCw, BookOpen, Image, Mic, Subtitles, Film, Smartphone,
  AlertCircle, Wand2, ArrowRight, Lock, FileText, Sparkles,
} from "lucide-react";
import { toast } from "@/components/Toaster";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

interface Scene {
  number: number;
  title: string;
  description: string;
  duration: number;
  image_prompt: string;
  voice_text: string;
}

interface StoryResult {
  title: string;
  topic: string;
  sections: any[];
  total_duration_s: number;
  style: string;
}

interface StepResult {
  ok: boolean;
  story?: StoryResult;
  scenes?: Scene[];
  error?: string;
  traceback?: string;
}

interface StepState {
  status: "idle" | "running" | "done" | "failed";
  result?: StepResult;
}

const PIPELINE_STEPS = [
  {
    id: "story-scenes",
    label: "Story & Scenes",
    icon: BookOpen,
    desc: "Generate story structure and scene breakdown from topic.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    id: "images",
    label: "Image Generation",
    icon: Image,
    desc: "Generate scene images via Hugging Face Inference API.",
    color: "from-purple-500 to-pink-500",
    locked: true,
  },
  {
    id: "voice",
    label: "Voice Generation",
    icon: Mic,
    desc: "Text-to-speech narration using edge-tts.",
    color: "from-green-500 to-emerald-500",
    locked: true,
  },
  {
    id: "subtitles",
    label: "Subtitle Generation",
    icon: Subtitles,
    desc: "Create SRT subtitle tracks from scene dialogue.",
    color: "from-orange-500 to-amber-500",
    locked: true,
  },
  {
    id: "video",
    label: "Video Assembly",
    icon: Film,
    desc: "FFmpeg concat — images + voice + subtitles → MP4.",
    color: "from-red-500 to-rose-500",
    locked: true,
  },
  {
    id: "shorts",
    label: "Shorts",
    icon: Smartphone,
    desc: "Generate 9:16 vertical short from scene frames.",
    color: "from-violet-500 to-indigo-500",
    locked: true,
  },
];

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35 } },
};

function StepCard({
  step,
  index,
  state,
  onRun,
}: {
  step: (typeof PIPELINE_STEPS)[0];
  index: number;
  state: StepState;
  onRun: () => void;
}) {
  const isIdle = state.status === "idle";
  const isRunning = state.status === "running";
  const isDone = state.status === "done";
  const isFailed = state.status === "failed";
  const disabled = isRunning || step.locked;

  return (
    <motion.div
      variants={fadeUp}
      className={`card border-l-4 ${
        isDone
          ? "border-l-green-500"
          : isFailed
            ? "border-l-red-500"
            : isRunning
              ? "border-l-blue-500"
              : step.locked
                ? "border-l-neutral-700 opacity-60"
                : "border-l-neutral-700"
      }`}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            <div
              className={`w-10 h-10 rounded-xl bg-gradient-to-br ${step.color} flex items-center justify-center shadow-lg`}
            >
              <step.icon size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-sm">
                  Step {index + 1}: {step.label}
                </h3>
                {step.locked && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-neutral-800 text-neutral-400 border border-neutral-700 flex items-center gap-1">
                    <Lock size={10} /> Coming Soon
                  </span>
                )}
                {isDone && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                    <CheckCircle2 size={10} /> Done
                  </span>
                )}
                {isFailed && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 flex items-center gap-1">
                    <XCircle size={10} /> Failed
                  </span>
                )}
                {isRunning && (
                  <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-1">
                    <Loader2 size={10} className="animate-spin" /> Running
                  </span>
                )}
              </div>
              <p className="text-xs text-muted mt-0.5">{step.desc}</p>
            </div>
          </div>
          <button
            onClick={onRun}
            disabled={disabled}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              disabled && !isRunning
                ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                : isRunning
                  ? "bg-blue-500/20 text-blue-400 cursor-wait"
                  : isDone
                    ? "bg-green-500/20 text-green-400 hover:bg-green-500/30"
                    : isFailed
                      ? "bg-red-500/20 text-red-400 hover:bg-red-500/30"
                      : "bg-accent/10 text-accent hover:bg-accent/20"
            }`}
          >
            {isRunning ? (
              <>
                <Loader2 size={14} className="animate-spin" /> Running...
              </>
            ) : isDone ? (
              <>
                <RefreshCw size={14} /> Re-run
              </>
            ) : isFailed ? (
              <>
                <RefreshCw size={14} /> Retry
              </>
            ) : step.locked ? (
              <>
                <Lock size={14} /> Locked
              </>
            ) : (
              <>
                <Play size={14} /> Run Step
              </>
            )}
          </button>
        </div>

        {/* Results */}
        {isDone && state.result && state.result.story && (
          <div className="mt-4 space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Wand2 size={14} className="text-accent" />
              {state.result.story.title}
              <span className="text-xs text-muted font-normal">
                ({state.result.story.total_duration_s}s · {state.result.story.style})
              </span>
            </div>

            {state.result.scenes && state.result.scenes.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-2 text-muted font-medium w-12">#</th>
                      <th className="text-left py-2 px-2 text-muted font-medium">Scene</th>
                      <th className="text-left py-2 px-2 text-muted font-medium w-16">Duration</th>
                      <th className="text-left py-2 px-2 text-muted font-medium w-24">Image Prompt</th>
                      <th className="text-left py-2 px-2 text-muted font-medium">Voice Text</th>
                    </tr>
                  </thead>
                  <tbody>
                    {state.result.scenes.map((s) => (
                      <tr key={s.number} className="border-b border-border/50 hover:bg-neutral-900/50">
                        <td className="py-2 px-2 font-medium">{s.number}</td>
                        <td className="py-2 px-2">
                          <span className="font-medium">{s.title}</span>
                          {s.description && (
                            <p className="text-muted mt-0.5 line-clamp-1">{s.description}</p>
                          )}
                        </td>
                        <td className="py-2 px-2 text-muted">{s.duration}s</td>
                        <td className="py-2 px-2 text-muted max-w-[200px] truncate" title={s.image_prompt}>
                          {s.image_prompt || "—"}
                        </td>
                        <td className="py-2 px-2 text-muted max-w-[250px] truncate" title={s.voice_text}>
                          {s.voice_text?.substring(0, 80) || "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {isFailed && state.result?.error && (
          <div className="mt-4 p-3 rounded-lg bg-red-500/5 border border-red-500/20">
            <div className="flex items-start gap-2">
              <AlertCircle size={14} className="text-red-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs text-red-300 font-medium">Error</p>
                <p className="text-xs text-red-400/80 mt-0.5 font-mono">{state.result.error}</p>
                {state.result.traceback && (
                  <details className="mt-2">
                    <summary className="text-xs text-muted cursor-pointer hover:text-foreground">Traceback</summary>
                    <pre className="mt-1 text-[10px] text-muted overflow-auto max-h-32 font-mono whitespace-pre-wrap">
                      {state.result.traceback}
                    </pre>
                  </details>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}

export default function DebugPipelinePage() {
  const [topic, setTopic] = useState("Metamorphosis");
  const [summary, setSummary] = useState("A journey of transformation and change, exploring how challenges reshape us into something greater.");
  const [steps, setSteps] = useState<Record<string, StepState>>({
    "story-scenes": { status: "idle" },
    images: { status: "idle" },
    voice: { status: "idle" },
    subtitles: { status: "idle" },
    video: { status: "idle" },
    shorts: { status: "idle" },
  });

  const runStep = async (stepId: string) => {
    if (stepId !== "story-scenes") return;

    setSteps((prev) => ({ ...prev, [stepId]: { status: "running" } }));

    try {
      const res = await fetch(`${API_BASE}/debug/step1-story-scenes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topic, summary }),
      });
      const data: StepResult = await res.json();

      if (data.ok) {
        setSteps((prev) => ({ ...prev, [stepId]: { status: "done", result: data } }));
        toast.success("Story & scenes generated successfully!");
      } else {
        setSteps((prev) => ({ ...prev, [stepId]: { status: "failed", result: data } }));
        toast.error(data.error || "Step failed");
      }
    } catch (err: any) {
      setSteps((prev) => ({
        ...prev,
        [stepId]: { status: "failed", result: { ok: false, error: err.message } },
      }));
      toast.error(err.message || "Network error");
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6"
    >
      {/* Header */}
      <motion.div variants={fadeUp}>
        <h1 className="text-2xl font-bold tracking-tight">Debug Pipeline</h1>
        <p className="text-sm text-muted mt-1">
          Run each pipeline step one at a time. Test, fix bugs, then unlock the next step.
        </p>
      </motion.div>

      {/* Input */}
      <motion.div variants={fadeUp} className="card p-5">
        <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <FileText size={14} className="text-accent" /> Project Input
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs text-muted mb-1.5">Topic</label>
            <input
              type="text"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="input-field"
              placeholder="e.g. Metamorphosis"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1.5">Summary</label>
            <input
              type="text"
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              className="input-field"
              placeholder="Brief description..."
            />
          </div>
        </div>
      </motion.div>

      {/* Flow diagram */}
      <motion.div variants={fadeUp}>
        <div className="flex items-center gap-2 flex-wrap text-xs text-muted mb-4">
          <span className="text-foreground font-medium">Pipeline Flow:</span>
          {PIPELINE_STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              <span
                className={`flex items-center gap-1 px-2 py-1 rounded-md ${
                  steps[s.id].status === "done"
                    ? "bg-green-500/10 text-green-400"
                    : steps[s.id].status === "failed"
                      ? "bg-red-500/10 text-red-400"
                      : steps[s.id].status === "running"
                        ? "bg-blue-500/10 text-blue-400"
                        : "bg-neutral-800 text-muted"
                }`}
              >
                {steps[s.id].status === "done" && <CheckCircle2 size={10} />}
                {steps[s.id].status === "running" && <Loader2 size={10} className="animate-spin" />}
                {steps[s.id].status === "failed" && <XCircle size={10} />}
                {s.label}
              </span>
              {i < PIPELINE_STEPS.length - 1 && <ArrowRight size={12} className="text-muted/50" />}
            </React.Fragment>
          ))}
        </div>
      </motion.div>

      {/* Step cards */}
      <div className="space-y-4">
        {PIPELINE_STEPS.map((step, i) => (
          <StepCard
            key={step.id}
            step={step}
            index={i}
            state={steps[step.id]}
            onRun={() => runStep(step.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}
