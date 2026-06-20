"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Clock, CheckCircle2, XCircle, X, RefreshCw,
  ExternalLink, Activity, ListVideo, Trash2, Loader2, AlertCircle,
} from "lucide-react";
import { getProjects, cancelProject, retryJob } from "@/lib/api";
import { toast } from "@/components/Toaster";

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.05 },
  },
};

const itemAnim = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

type Status = "Waiting" | "Completed" | "Failed" | "Cancelled" | "Archived" | "Generating Script" | "Generating Metadata" | "Generating Scenes" | "Generating Images" | "Generating Voice" | "Generating Subtitles" | "Generating Thumbnail" | "Editing Video" | "Rendering" | "Uploading" | "Retrying";

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  Waiting: { label: "Waiting", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: Clock },
  Completed: { label: "Completed", color: "text-green-400", bg: "bg-green-500/10", icon: CheckCircle2 },
  Failed: { label: "Failed", color: "text-red-400", bg: "bg-red-500/10", icon: XCircle },
  Cancelled: { label: "Cancelled", color: "text-neutral-500", bg: "bg-neutral-500/10", icon: XCircle },
  Archived: { label: "Archived", color: "text-neutral-600", bg: "bg-neutral-600/10", icon: Trash2 },
  "Generating Script": { label: "Generating Script", color: "text-blue-400", bg: "bg-blue-500/10", icon: Loader2 },
  "Generating Metadata": { label: "Generating Metadata", color: "text-blue-400", bg: "bg-blue-500/10", icon: Loader2 },
  "Generating Scenes": { label: "Generating Scenes", color: "text-blue-400", bg: "bg-blue-500/10", icon: Loader2 },
  "Generating Images": { label: "Generating Images", color: "text-purple-400", bg: "bg-purple-500/10", icon: Loader2 },
  "Generating Voice": { label: "Generating Voice", color: "text-purple-400", bg: "bg-purple-500/10", icon: Loader2 },
  "Generating Subtitles": { label: "Generating Subtitles", color: "text-purple-400", bg: "bg-purple-500/10", icon: Loader2 },
  "Generating Thumbnail": { label: "Generating Thumbnail", color: "text-purple-400", bg: "bg-purple-500/10", icon: Loader2 },
  "Editing Video": { label: "Editing Video", color: "text-orange-400", bg: "bg-orange-500/10", icon: Loader2 },
  Rendering: { label: "Rendering", color: "text-orange-400", bg: "bg-orange-500/10", icon: Loader2 },
  Uploading: { label: "Uploading", color: "text-cyan-400", bg: "bg-cyan-500/10", icon: Loader2 },
  Retrying: { label: "Retrying", color: "text-yellow-400", bg: "bg-yellow-500/10", icon: RefreshCw },
};

const isRunning = (s: string) =>
  !["Waiting", "Completed", "Failed", "Cancelled", "Archived"].includes(s);

function SkeletonRow() {
  return (
    <div className="card p-5 flex items-center gap-4">
      <div className="skeleton w-10 h-10 rounded-lg shrink-0" />
      <div className="flex-1 min-w-0 space-y-2">
        <div className="skeleton h-4 w-3/5" />
        <div className="skeleton h-3 w-2/5" />
      </div>
      <div className="skeleton h-8 w-24 rounded-lg shrink-0" />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <motion.div
      variants={itemAnim}
      className="card p-5 flex items-center gap-4 transition-all duration-200 hover:border-neutral-700"
    >
      <div className={`w-11 h-11 rounded-xl ${color.replace("text-", "bg-").replace("400", "500/15")} flex items-center justify-center`}>
        <Icon size={20} className={color} />
      </div>
      <div>
        <p className="text-2xl font-semibold tracking-tight">{value}</p>
        <p className="text-xs text-muted mt-0.5">{label}</p>
      </div>
    </motion.div>
  );
}

const QueuePage = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const data = await getProjects();
      setProjects(Array.isArray(data) ? data : []);
      setError("");
    } catch (err: any) {
      setError(err.message || "Failed to load projects");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 3000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const waiting = projects.filter((p) => p.status === "Waiting");
  const running = projects.filter((p) => isRunning(p.status));
  const completed = projects.filter((p) => p.status === "Completed");
  const failed = projects.filter((p) => p.status === "Failed");

  const handleCancel = async (id: number) => {
    setActionLoading(id);
    try {
      await cancelProject(id);
      toast.success(`Project #${id} cancelled`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to cancel project");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async (id: number) => {
    setActionLoading(id);
    try {
      await retryJob(id);
      toast.success(`Project #${id} re-queued`);
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Failed to retry project");
    } finally {
      setActionLoading(null);
    }
  };

  const sorted = [...projects].sort((a, b) => new Date(b.created_at || b.id).getTime() - new Date(a.created_at || a.id).getTime());

  return (
    <div className="flex flex-col flex-grow p-6 lg:p-8 bg-background text-foreground overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-semibold tracking-tight">Queue</h1>
          <span className="flex items-center gap-1.5 text-xs text-muted bg-card border border-border rounded-full px-3 py-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
            </span>
            Live
          </span>
        </div>
        <p className="text-sm text-muted mt-1">Monitor your video generation pipeline in real-time.</p>
      </motion.div>

      {error && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-3"
        >
          <AlertCircle size={18} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-300 flex-1">{error}</p>
          <button onClick={fetchData} className="btn-ghost text-xs flex items-center gap-1.5">
            <RefreshCw size={14} /> Retry
          </button>
        </motion.div>
      )}

      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatCard icon={Clock} label="Waiting" value={waiting.length} color="text-yellow-400" />
        <StatCard icon={Activity} label="Running" value={running.length} color="text-blue-400" />
        <StatCard icon={CheckCircle2} label="Completed" value={completed.length} color="text-green-400" />
        <StatCard icon={XCircle} label="Failed" value={failed.length} color="text-red-400" />
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      ) : sorted.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex-1 flex items-center justify-center"
        >
          <div className="flex flex-col items-center text-center max-w-sm">
            <div className="w-16 h-16 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
              <ListVideo size={28} className="text-muted" />
            </div>
            <p className="text-base font-medium">Queue is empty</p>
            <p className="text-sm text-muted mt-1">Create a project from the Dashboard to get started.</p>
          </div>
        </motion.div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="space-y-2">
          {sorted.map((p, i) => {
            const cfg = statusConfig[p.status] || statusConfig.Waiting;
            const Icon = cfg.icon;
            const running = isRunning(p.status);
            const canCancel = running || p.status === "Waiting";
            const canRetry = p.status === "Failed";

            return (
              <motion.div
                key={p.id}
                variants={itemAnim}
                layout
                className={`card p-5 transition-all duration-200 ${running ? "border-blue-500/20 bg-blue-500/5" : "hover:border-neutral-700"}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center shrink-0`}>
                    {running ? (
                      <Loader2 size={18} className={`${cfg.color} animate-spin`} />
                    ) : (
                      <Icon size={18} className={cfg.color} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">{p.topic || `Project #${p.id}`}</p>
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-muted">
                      <div className="flex-1 max-w-md">
                        <div className="progress-bar">
                          <div
                            className={`progress-fill ${p.status === "Completed" ? "bg-green-500" : p.status === "Failed" ? "bg-red-500" : "bg-accent"}`}
                            style={{ width: `${Math.min(p.progress || 0, 100)}%` }}
                          />
                        </div>
                      </div>
                      <span className="tabular-nums">{p.progress || 0}%</span>
                      {p.duration && <span>{p.duration}</span>}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    {canCancel && (
                      <button
                        onClick={() => handleCancel(p.id)}
                        disabled={actionLoading === p.id}
                        className="btn-ghost p-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                        title="Cancel"
                      >
                        {actionLoading === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <X size={14} />
                        )}
                      </button>
                    )}
                    {canRetry && (
                      <button
                        onClick={() => handleRetry(p.id)}
                        disabled={actionLoading === p.id}
                        className="btn-ghost p-2 text-yellow-400 hover:text-yellow-300 hover:bg-yellow-500/10 disabled:opacity-50"
                        title="Retry"
                      >
                        {actionLoading === p.id ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <RefreshCw size={14} />
                        )}
                      </button>
                    )}
                    {p.status === "Completed" && (
                      <button
                        className="btn-ghost p-2 text-accent hover:text-accent-light hover:bg-accent/10"
                        title="View"
                      >
                        <ExternalLink size={14} />
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default QueuePage;
