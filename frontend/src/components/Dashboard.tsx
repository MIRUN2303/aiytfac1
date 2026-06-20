"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Clock, CheckCircle2, Play, Loader2, Cpu, Activity, Zap, Radio, TrendingUp, Calendar, AlertCircle,
  RefreshCw, Film, HardDrive,
} from "lucide-react";
import { createProject, getProjects, getSystemStats, getWorkerStatus } from "@/lib/api";
import { toast } from "@/components/Toaster";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const LANGUAGES = [
  { value: "auto", label: "Auto-detect" },
  { value: "en", label: "English" },
  { value: "es", label: "Spanish" },
  { value: "fr", label: "French" },
  { value: "de", label: "German" },
  { value: "pt", label: "Portuguese" },
  { value: "ja", label: "Japanese" },
  { value: "ko", label: "Korean" },
  { value: "zh", label: "Chinese" },
  { value: "ar", label: "Arabic" },
  { value: "hi", label: "Hindi" },
  { value: "ru", label: "Russian" },
];

const DURATIONS = [
  { value: "short", label: "Short (~60s)" },
  { value: "medium", label: "Medium (~3min)" },
  { value: "long", label: "Long (~8min)" },
];

const VOICE_STYLES = [
  { value: "neutral", label: "Neutral" },
  { value: "cinematic", label: "Cinematic" },
  { value: "calm", label: "Calm" },
  { value: "energetic", label: "Energetic" },
];

const STORY_STYLES = [
  { value: "narrative", label: "Narrative" },
  { value: "documentary", label: "Documentary" },
  { value: "educational", label: "Educational" },
  { value: "cinematic", label: "Cinematic" },
  { value: "emotional", label: "Emotional" },
  { value: "comedic", label: "Comedic" },
];

const AUDIENCES = [
  { value: "general", label: "General" },
  { value: "kids", label: "Kids" },
  { value: "teens", label: "Teens" },
  { value: "young_adults", label: "Young Adults" },
  { value: "adults", label: "Adults" },
  { value: "professionals", label: "Professionals" },
];

function SkeletonCard() {
  return (
    <div className="card p-5 space-y-3">
      <div className="skeleton h-9 w-9" />
      <div className="skeleton h-7 w-20" />
      <div className="skeleton h-3 w-28" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, trend, loading }: { icon: any; label: string; value: string; trend?: string; loading?: boolean }) {
  return (
    <motion.div variants={item} className="stat-card relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
      <div className="relative">
        <div className="flex items-center justify-between mb-3">
          <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
            <Icon size={18} className="text-accent" />
          </div>
          {trend && (
            <span className="text-xs text-green-400 font-medium flex items-center gap-1 bg-green-500/10 px-2 py-0.5 rounded-full">
              <TrendingUp size={10} /> {trend}
            </span>
          )}
        </div>
        {loading ? (
          <div className="skeleton h-7 w-16 mb-1" />
        ) : (
          <p className="text-2xl font-bold tracking-tight">{value}</p>
        )}
        <p className="text-xs text-muted mt-1">{label}</p>
      </div>
    </motion.div>
  );
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <div>
      <label className="block text-xs text-muted mb-1.5 font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field appearance-none cursor-pointer"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
    </div>
  );
}

export default function Dashboard() {
  const [topic, setTopic] = useState("");
  const [summary, setSummary] = useState("");
  const [language, setLanguage] = useState("auto");
  const [audience, setAudience] = useState("general");
  const [duration, setDuration] = useState("medium");
  const [voiceStyle, setVoiceStyle] = useState("neutral");
  const [storyStyle, setStoryStyle] = useState("narrative");

  const [loading, setLoading] = useState(false);
  const [projects, setProjects] = useState<any[]>([]);
  const [systemStats, setSystemStats] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [projData, statsData, workerData] = await Promise.all([
        getProjects(),
        getSystemStats().catch(() => null),
        getWorkerStatus().catch(() => []),
      ]);
      setProjects(Array.isArray(projData) ? projData : []);
      if (statsData) setSystemStats(statsData);
      if (Array.isArray(workerData)) setWorkers(workerData);
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load data");
    } finally {
      setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const projectsList = Array.isArray(projects) ? projects : [];
  const upcoming = projectsList.filter((p: any) => p.status === "queued" || p.status === "Waiting" || p.status === "waiting").length;
  const completed = projectsList.filter((p: any) => p.status === "completed" || p.status === "Completed").length;
  const running = projectsList.filter((p: any) => p.status === "running" || p.status === "Processing" || p.status === "processing").length;
  const queueSize = projectsList.filter((p: any) => p.status === "queued" || p.status === "Waiting" || p.status === "waiting" || p.status === "running" || p.status === "Processing" || p.status === "processing").length;
  const cpuUsage = systemStats?.cpu_percent ?? systemStats?.cpu ?? 0;
  const memoryUsage = systemStats?.memory_percent ?? systemStats?.memory ?? 0;

  const activeWorkers = Array.isArray(workers) ? workers.filter((w: any) => w.status === "active" || w.status === "busy").length : 0;
  const idleWorkers = Array.isArray(workers) ? workers.filter((w: any) => w.status === "idle").length : 0;
  const totalWorkers = Array.isArray(workers) ? workers.length : 0;

  const recentProjects = [...projectsList].reverse().slice(0, 8);

  const monthlyStats = React.useMemo(() => {
    const months: Record<string, number> = {};
    projects.forEach((p: any) => {
      const d = p.created_at || p.createdAt;
      if (!d) return;
      const key = new Date(d).toLocaleString("default", { month: "short", year: "2-digit" });
      months[key] = (months[key] || 0) + 1;
    });
    return Object.entries(months).slice(-6);
  }, [projects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim() || !summary.trim()) {
      toast.error("Please fill in Topic and Summary");
      return;
    }
    setLoading(true);
    try {
      await createProject({
        topic: topic.trim(),
        summary: summary.trim(),
        language,
        target_audience: audience,
        duration,
        voice_style: voiceStyle,
        story_style: storyStyle,
      });
      toast.success(`"${topic}" created and queued!`);
      setTopic("");
      setSummary("");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to create project");
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex-1 flex flex-col p-6 lg:p-8 space-y-8">
        <div className="space-y-3">
          <div className="skeleton h-10 w-64" />
          <div className="skeleton h-4 w-96" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-6 space-y-4">
            <div className="skeleton h-5 w-40" />
            <div className="space-y-3">
              <div className="skeleton h-10 w-full" />
              <div className="skeleton h-24 w-full" />
              <div className="skeleton h-10 w-40" />
            </div>
          </div>
          <div className="card p-6 space-y-4">
            <div className="skeleton h-5 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="skeleton h-4 w-4 rounded-full" />
                <div className="flex-1 space-y-1">
                  <div className="skeleton h-4 w-48" />
                  <div className="skeleton h-3 w-32" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted">{error}</p>
          <button onClick={fetchData} className="btn-primary flex items-center gap-2">
            <RefreshCw size={16} /> Retry
          </button>
        </motion.div>
      </div>
    );
  }

  const statusIcon = (status: string) => {
    switch (status) {
      case "completed": case "Completed": return <CheckCircle2 size={14} className="text-green-400" />;
      case "failed": case "Failed": return <AlertCircle size={14} className="text-red-400" />;
      case "running": case "Processing": case "processing": return <Loader2 size={14} className="text-blue-400 animate-spin" />;
      default: return <Clock size={14} className="text-yellow-400" />;
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8"
    >
      {/* Hero */}
      <motion.div variants={item} className="relative overflow-hidden rounded-2xl p-8 card">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-500/10 via-purple-500/5 to-transparent" />
        <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-purple-500/10 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <Radio size={16} className="text-white" />
            </div>
            <span className="text-xs font-medium text-muted uppercase tracking-widest">AI YouTube Factory</span>
          </div>
          <h1 className="text-4xl lg:text-5xl font-bold text-gradient mb-3">
            Welcome to AI YouTube Factory
          </h1>
          <p className="text-muted text-lg max-w-2xl">
            Autonomous content creation platform. Generate cinematic, fully-produced YouTube videos from just a topic and summary.
          </p>
          <div className="flex flex-wrap gap-6 mt-6">
            <div className="flex items-center gap-2 text-sm text-muted">
              <CheckCircle2 size={16} className="text-green-400" />
              AI Scriptwriting
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <CheckCircle2 size={16} className="text-green-400" />
              Auto Voiceover
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <CheckCircle2 size={16} className="text-green-400" />
              Scene Generation
            </div>
            <div className="flex items-center gap-2 text-sm text-muted">
              <CheckCircle2 size={16} className="text-green-400" />
              One-Click Upload
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stats Grid */}
      <motion.div variants={item}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <BarChart3 size={16} className="text-accent" />
            Overview
          </h2>
          <button onClick={fetchData} className="btn-ghost p-1.5" title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          <StatCard icon={Clock} label="Upcoming" value={String(upcoming)} />
          <StatCard icon={CheckCircle2} label="Completed" value={String(completed)} trend="+2" />
          <StatCard icon={Play} label="Running Jobs" value={String(running)} />
          <StatCard icon={BarChart3} label="Queue Size" value={String(queueSize)} />
          <StatCard icon={Cpu} label="CPU Usage" value={`${(typeof cpuUsage === "number" ? cpuUsage : 0).toFixed(0)}%`} />
          <StatCard icon={HardDrive} label="Memory" value={`${(typeof memoryUsage === "number" ? memoryUsage : 0).toFixed(0)}%`} />
        </div>
      </motion.div>

      {/* Workers Status */}
      <motion.div variants={item} className="card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Activity size={16} className="text-accent" />
            Workers
          </h2>
          <span className="text-xs text-muted">{totalWorkers} total</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2.5 bg-neutral-800 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 via-blue-500 to-purple-500 rounded-full transition-all duration-700"
              style={{ width: `${totalWorkers > 0 ? (activeWorkers / totalWorkers) * 100 : 0}%` }}
            />
          </div>
          <div className="flex items-center gap-4 text-xs">
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {activeWorkers} active
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-neutral-600" />
              {idleWorkers} idle
            </span>
          </div>
        </div>
        {Array.isArray(workers) && workers.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-3">
            {workers.map((w: any, i: number) => (
              <div
                key={w.id || i}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                  w.status === "active" || w.status === "busy"
                    ? "bg-green-500/10 text-green-400"
                    : "bg-neutral-800 text-muted"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${w.status === "active" || w.status === "busy" ? "bg-green-500 animate-pulse" : "bg-neutral-500"}`} />
                Worker {w.id || i + 1}
              </div>
            ))}
          </div>
        )}
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Start Form */}
        <motion.div variants={item} className="card p-6">
          <h2 className="text-sm font-semibold mb-5 flex items-center gap-2">
            <Zap size={16} className="text-accent" />
            Quick Start Project
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <SelectField label="Language" value={language} onChange={setLanguage} options={LANGUAGES} />
              <SelectField label="Target Audience" value={audience} onChange={setAudience} options={AUDIENCES} />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <SelectField label="Duration" value={duration} onChange={setDuration} options={DURATIONS} />
              <SelectField label="Voice Style" value={voiceStyle} onChange={setVoiceStyle} options={VOICE_STYLES} />
              <SelectField label="Story Style" value={storyStyle} onChange={setStoryStyle} options={STORY_STYLES} />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">Topic</label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="input-field"
                placeholder="e.g., The Dark Truth About Ancient Civilizations"
                required
                disabled={loading}
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1.5 font-medium">Summary</label>
              <textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                className="input-field resize-none h-24"
                placeholder="e.g., Explain mysterious civilizations through cinematic storytelling..."
                required
                disabled={loading}
              />
            </div>
            <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 py-2.5">
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Queuing...</>
              ) : (
                <><Play size={16} /> Start Generation</>
              )}
            </button>
          </form>
        </motion.div>

        {/* Recent Activity */}
        <motion.div variants={item} className="card p-6">
          <h2 className="text-sm font-semibold mb-5 flex items-center gap-2">
            <Activity size={16} className="text-accent" />
            Recent Activity
          </h2>
          {recentProjects.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted">
              <div className="w-12 h-12 rounded-xl bg-neutral-800 flex items-center justify-center mb-3">
                <Film size={24} className="opacity-30" />
              </div>
              <p className="text-sm font-medium">No projects yet</p>
              <p className="text-xs mt-1">Fill in the form and start generating!</p>
            </div>
          ) : (
            <div className="space-y-1">
              {recentProjects.map((p: any, i: number) => (
                <motion.div
                  key={p.id || i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-neutral-800/50 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center">
                    {statusIcon(p.status)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.topic || p.title || `Project #${p.id}`}</p>
                    <p className="text-xs text-muted truncate">{p.status || "—"}</p>
                  </div>
                  <span className="text-xs text-muted">
                    {p.created_at || p.createdAt ? new Date(p.created_at || p.createdAt).toLocaleDateString() : ""}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* Monthly Statistics */}
      {monthlyStats.length > 0 && (
        <motion.div variants={item} className="card p-6">
          <h2 className="text-sm font-semibold mb-5 flex items-center gap-2">
            <Calendar size={16} className="text-accent" />
            Monthly Videos
          </h2>
          <div className="flex items-end gap-3 h-32">
            {monthlyStats.map(([month, count], i) => {
              const maxCount = Math.max(...monthlyStats.map(([, c]) => c), 1);
              const height = (count / maxCount) * 100;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                  <span className="text-xs text-muted">{count}</span>
                  <motion.div
                    initial={{ height: 0 }}
                    animate={{ height: `${height}%` }}
                    transition={{ duration: 0.6, delay: i * 0.05, ease: "easeOut" }}
                    className="w-full rounded-t-lg bg-gradient-to-t from-accent/40 to-accent/20"
                    style={{ minHeight: 4 }}
                  />
                  <span className="text-xs text-muted">{month}</span>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
