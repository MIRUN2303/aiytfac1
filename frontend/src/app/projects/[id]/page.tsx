"use client";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Image, Film, Music, FileText, Terminal,
  ChevronDown, ChevronUp, AlertCircle, RefreshCw, Clock, Eye, Copy,
  Maximize2, FileCode, Volume2, FolderOpen, Zap, Activity,
} from "lucide-react";
import { getProject, getProjectFiles, getProjectLogs, getMediaUrl } from "@/lib/api";
import { toast } from "@/components/Toaster";

const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

const STATUS_COLORS: Record<string, string> = {
  Waiting: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Processing: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  Completed: "text-green-400 bg-green-500/10 border-green-500/20",
  Failed: "text-red-400 bg-red-500/10 border-red-500/20",
  Retrying: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20",
  Cancelled: "text-neutral-500 bg-neutral-500/10 border-neutral-500/20",
  Archived: "text-neutral-600 bg-neutral-600/10 border-neutral-600/20",
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  GENERATING_STORY: <FileText size={14} />,
  GENERATING_IMAGES: <Image size={14} />,
  GENERATING_VOICE: <Music size={14} />,
  GENERATING_SUBTITLES: <FileText size={14} />,
  GENERATING_THUMBNAIL: <Image size={14} />,
  RENDERING: <Film size={14} />,
  EDITING_VIDEO: <Film size={14} />,
  GENERATING_SHORTS: <Film size={14} />,
};

const STAGE_LABELS: Record<string, string> = {
  GENERATING_STORY: "Generating Story",
  GENERATING_IMAGES: "Generating Images",
  GENERATING_VOICE: "Generating Voice Over",
  GENERATING_SUBTITLES: "Generating Subtitles",
  GENERATING_THUMBNAIL: "Generating Thumbnail",
  RENDERING: "Rendering Video",
  EDITING_VIDEO: "Editing Video",
  GENERATING_SHORTS: "Generating Shorts",
};

function formatSize(bytes: number): string {
  if (!bytes || bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0; let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
}

function SectionCard({ title, icon, children }: { title: string | React.ReactNode; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 bg-neutral-900/50 border-b border-border">
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>
      <div className="p-4">
        {children}
      </div>
    </div>
  );
}

function CodeBlock({ title, children }: { title: string; children: React.ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 bg-neutral-900/50 hover:bg-neutral-800/50 transition-colors"
      >
        <span className="text-sm font-medium flex items-center gap-2">
          <FileCode size={14} className="text-muted" />
          {title}
        </span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
            <pre className="p-4 text-xs leading-relaxed text-muted overflow-x-auto max-h-96 overflow-y-auto whitespace-pre-wrap font-mono">
              {children}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const PIPELINE_STAGES = [
  "GENERATING_STORY", "GENERATING_IMAGES", "GENERATING_VOICE",
  "GENERATING_SUBTITLES", "GENERATING_THUMBNAIL",
  "RENDERING", "EDITING_VIDEO", "GENERATING_SHORTS",
];

function wsUrl(projectId: number): string {
  const base = API.replace(/^http/, "ws");
  const sep = base.endsWith("/") ? "" : "/";
  return `${base}${sep}ws/${projectId}`;
}

export default function ProjectDetailPage() {
  const params = useParams();
  const projectId = Number(params.id);

  const [project, setProject] = useState<any>(null);
  const [files, setFiles] = useState<any[]>([]);
  const [logs, setLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<"preview" | "files" | "logs">("preview");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // Live feed state
  const [liveMessages, setLiveMessages] = useState<{ time: string; text: string; stage?: string }[]>([]);
  const [currentStage, setCurrentStage] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const liveEndRef = useRef<HTMLDivElement>(null);

  const isRunning = project?.status === "Processing" || project?.status === "Waiting";

  // Auto-scroll live feed
  useEffect(() => {
    liveEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [liveMessages]);

  // WebSocket connection for live streaming
  useEffect(() => {
    if (projectId <= 0) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      if (closed) return;
      try {
        ws = new WebSocket(wsUrl(projectId));
        wsRef.current = ws;

        ws.onopen = () => {
          setWsConnected(true);
          addLiveMessage("Connected to live stream");
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === "pong") return;

            const stage = data.status || data.checkpoint || "";
            if (stage) setCurrentStage(stage);

            const msg = data.message || data.status || JSON.stringify(data);
            addLiveMessage(msg, stage);

            // If we got progress update, also refetch project data
            if (data.progress !== undefined || data.status) {
              refetchProject();
            }
          } catch {
            // ignore
          }
        };

        ws.onclose = () => {
          setWsConnected(false);
          wsRef.current = null;
          if (!closed) {
            reconnectTimer = setTimeout(connect, 3000);
          }
        };

        ws.onerror = () => {
          ws?.close();
        };
      } catch {
        reconnectTimer = setTimeout(connect, 5000);
      }
    }

    function addLiveMessage(text: string, stage?: string) {
      setLiveMessages((prev) => {
        const next = [...prev, { time: new Date().toLocaleTimeString(), text, stage }];
        if (next.length > 200) next.splice(0, next.length - 200);
        return next;
      });
    }

    connect();

    return () => {
      closed = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [projectId]);

  // Fetch initial data + poll when running
  const fetchData = useCallback(async () => {
    try {
      const [p, f, l] = await Promise.all([
        getProject(projectId),
        getProjectFiles(projectId).catch(() => ({ files: [] })),
        getProjectLogs(projectId).catch(() => ""),
      ]);
      setProject(p);
      setFiles(Array.isArray(f) ? f : f?.files || []);
      const logStr = typeof l === "string" ? l : l?.logs || l || "";
      setLogs(logStr.split("\n").filter(Boolean));
      setError(null);
    } catch (err: any) {
      setError(err.message || "Failed to load project");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  // Separate refetch (silent, no loading state)
  const refetchProject = useCallback(async () => {
    try {
      const [p, f] = await Promise.all([
        getProject(projectId),
        getProjectFiles(projectId).catch(() => ({ files: [] })),
      ]);
      setProject(p);
      setFiles(Array.isArray(f) ? f : f?.files || []);
    } catch {
      // silent
    }
  }, [projectId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Poll more frequently (2s) when running for live file updates
  useEffect(() => {
    if (!project || !isRunning) return;
    const interval = setInterval(refetchProject, 2000);
    return () => clearInterval(interval);
  }, [project, isRunning, refetchProject]);

  // Slow poll when completed/failed to catch final state
  useEffect(() => {
    if (!project || isRunning) return;
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, [project, isRunning, fetchData]);

  const mediaFiles = React.useMemo(() => {
    const images = files.filter((f: any) => /\.(png|jpg|jpeg|webp)$/i.test(f.filename || f.name || ""));
    const videos = files.filter((f: any) => /\.(mp4|mov|webm)$/i.test(f.filename || f.name || ""));
    const audio = files.filter((f: any) => /\.(wav|mp3|ogg)$/i.test(f.filename || f.name || ""));
    const subtitles = files.filter((f: any) => /\.(srt|vtt|txt)$/i.test(f.filename || f.name || ""));
    return { images, videos, audio, subtitles };
  }, [files]);

  // Derived current stage index for pipeline visualization
  const currentStageIdx = currentStage ? PIPELINE_STAGES.indexOf(currentStage) : -1;

  if (loading) {
    return (
      <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
        <div className="skeleton h-8 w-48" />
        <div className="skeleton h-4 w-64" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mt-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="skeleton aspect-video rounded-xl" />
            <div className="skeleton h-6 w-32" />
            <div className="grid grid-cols-3 gap-3">
              <div className="skeleton aspect-[4/3] rounded-lg" />
              <div className="skeleton aspect-[4/3] rounded-lg" />
              <div className="skeleton aspect-[4/3] rounded-lg" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="skeleton h-48 rounded-xl" />
            <div className="skeleton h-24 rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-4 text-center max-w-sm"
        >
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <AlertCircle size={32} className="text-red-400" />
          </div>
          <h2 className="text-lg font-semibold">Project not found</h2>
          <p className="text-sm text-muted">{error || "This project doesn't exist or has been deleted."}</p>
          <button onClick={() => window.location.href = "/projects"} className="btn-primary flex items-center gap-2">
            <ArrowLeft size={16} /> Back to Projects
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <button onClick={() => window.location.href = "/projects"} className="btn-ghost p-2" title="Back">
            <ArrowLeft size={18} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                {project.topic || project.title || `Project #${project.id}`}
              </h1>
              <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full border shrink-0 flex items-center gap-1 ${
                STATUS_COLORS[project.status] || "text-neutral-400 bg-neutral-800 border-neutral-700"
              }`}>
                {wsConnected && isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                {project.status || "Unknown"}
              </span>
            </div>
            <p className="text-sm text-muted mt-0.5 flex items-center gap-2">
              <Clock size={12} />
              {project.created_at ? new Date(project.created_at).toLocaleString() : "—"}
              {project.duration && <span className="capitalize">· {project.duration}</span>}
              {project.language && <span>· {project.language.toUpperCase()}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isRunning && (
            <button onClick={refetchProject} className="btn-ghost p-2" title="Refresh">
              <RefreshCw size={16} className="animate-spin" />
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {project.progress !== undefined && project.status !== "Completed" && project.status !== "Failed" && (
        <div>
          <div className="flex items-center justify-between text-xs text-muted mb-1.5">
            <span className="flex items-center gap-1.5">
              {currentStage && STAGE_LABELS[currentStage] ? (
                <>
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                  {STAGE_LABELS[currentStage]}
                </>
              ) : project.status}
            </span>
            <span className="font-medium">{project.progress || 0}%</span>
          </div>
          <div className="progress-bar max-w-md">
            <div
              className={`progress-fill ${project.status === "Failed" ? "bg-red-500" : "bg-accent"} relative overflow-hidden`}
              style={{ width: `${Math.min(project.progress || 0, 100)}%` }}
            >
              {isRunning && <div className="absolute inset-0 bg-white/10 shimmer" />}
            </div>
          </div>
        </div>
      )}

      {/* Pipeline Stage Visualization (shown when running) */}
      {isRunning && (
        <div className="flex items-center gap-1.5 flex-wrap">
          {PIPELINE_STAGES.map((stage, i) => {
            const isPast = currentStageIdx > i;
            const isCurrent = currentStageIdx === i;
            const isUpcoming = currentStageIdx < i;
            return (
              <div
                key={stage}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all ${
                  isPast
                    ? "bg-green-500/10 text-green-400 border border-green-500/20"
                    : isCurrent
                    ? "bg-blue-500/15 text-blue-300 border border-blue-500/30 shadow-[0_0_8px_rgba(59,130,246,0.15)]"
                    : "bg-neutral-800/50 text-neutral-500 border border-transparent"
                }`}
              >
                <span className={isCurrent ? "animate-pulse" : ""}>
                  {STAGE_ICONS[stage]}
                </span>
                <span className="hidden sm:inline">{STAGE_LABELS[stage]}</span>
                {i < PIPELINE_STAGES.length - 1 && (
                  <ChevronUp size={10} className="rotate-90 opacity-40 -mr-0.5" />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-neutral-900 rounded-xl p-1 w-fit">
        {(["preview", "files", "logs"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize flex items-center gap-1.5 ${
              activeTab === tab ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {tab === "preview" && <Eye size={14} />}
            {tab === "files" && <FolderOpen size={14} />}
            {tab === "logs" && <Terminal size={14} />}
            {tab}
          </button>
        ))}
      </div>

      {/* ===== PREVIEW TAB ===== */}
      {activeTab === "preview" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main */}
          <div className="lg:col-span-2 space-y-6">

            {/* Live Activity Feed (shown when running) */}
            {isRunning && liveMessages.length > 0 && (
              <SectionCard
                title={
                  <span className="flex items-center gap-2">
                    <Activity size={14} className="text-blue-400" />
                    Live Activity
                    {wsConnected && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
                  </span>
                }
                icon={null}
              >
                <div className="max-h-48 overflow-y-auto space-y-1 text-xs font-mono">
                  {liveMessages.slice(-50).map((m, i) => (
                    <div key={i} className="flex gap-2">
                      <span className="text-muted shrink-0">[{m.time}]</span>
                      <span className={m.text?.toLowerCase().includes("error") || m.text?.toLowerCase().includes("fail")
                        ? "text-red-400" : m.text?.toLowerCase().includes("complete")
                        ? "text-green-400" : "text-foreground/80"}
                      >
                        {m.text}
                      </span>
                    </div>
                  ))}
                  <div ref={liveEndRef} />
                </div>
              </SectionCard>
            )}

            {/* Summary */}
            <p className="text-sm text-muted leading-relaxed">
              {project.summary || "No summary provided."}
            </p>

            {/* Video */}
            {mediaFiles.videos.length > 0 && (
              <SectionCard title="Final Video" icon={<Film size={16} className="text-purple-400" />}>
                <video controls className="w-full rounded-lg bg-black" poster={getMediaUrl(project.thumbnail_url) || undefined}>
                  <source src={getMediaUrl(project.video_url || mediaFiles.videos[0].url)} type="video/mp4" />
                </video>
              </SectionCard>
            )}

            {/* Shorts */}
            {project.short_url && (
              <SectionCard title="Short / Reel" icon={<Film size={16} className="text-purple-400" />}>
                <video controls className="w-full max-w-sm rounded-lg bg-black mx-auto" style={{ aspectRatio: "9/16" }}>
                  <source src={getMediaUrl(project.short_url)} type="video/mp4" />
                </video>
              </SectionCard>
            )}

            {/* Thumbnail */}
            {project.thumbnail_url && (
              <SectionCard title="Thumbnail" icon={<Image size={16} className="text-blue-400" />}>
                <a href={getMediaUrl(project.thumbnail_url)} target="_blank" rel="noreferrer">
                  <img
                    src={getMediaUrl(project.thumbnail_url)}
                    alt="Thumbnail"
                    className="w-full max-w-md rounded-lg border border-border hover:opacity-90 transition-opacity cursor-pointer"
                  />
                </a>
              </SectionCard>
            )}

            {/* Voice */}
            {mediaFiles.audio.length > 0 && (
              <SectionCard title="Voice Over" icon={<Music size={16} className="text-green-400" />}>
                <audio controls className="w-full">
                  <source src={getMediaUrl(project.voice_url || mediaFiles.audio[0].url)} type="audio/wav" />
                </audio>
              </SectionCard>
            )}

            {/* Image Gallery - live updating */}
            {mediaFiles.images.length > 0 && (
              <SectionCard title={`Scene Images (${mediaFiles.images.length})`} icon={<Image size={16} className="text-blue-400" />}>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {mediaFiles.images.map((f: any, i: number) => {
                    const url = getMediaUrl(f.url || f.path);
                    return (
                      <motion.button
                        key={f.filename || i}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.05 }}
                        onClick={() => setSelectedImage(url || null)}
                        className="relative group aspect-[4/3] rounded-lg overflow-hidden border border-border bg-neutral-900"
                      >
                        <img
                          src={url}
                          alt={f.filename || `Scene ${i + 1}`}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                          <Maximize2 size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                        <span className="absolute bottom-1 left-1 px-1.5 py-0.5 text-[10px] bg-black/60 rounded text-white truncate max-w-[90%]">
                          {f.filename || `Scene ${i + 1}`}
                        </span>
                      </motion.button>
                    );
                  })}
                  {isRunning && (
                    <div className="aspect-[4/3] rounded-lg border border-dashed border-neutral-700 flex flex-col items-center justify-center gap-2 text-muted">
                      <Zap size={20} className="animate-pulse" />
                      <span className="text-[11px]">Generating...</span>
                    </div>
                  )}
                </div>
              </SectionCard>
            )}

            {/* Subtitles */}
            {mediaFiles.subtitles.length > 0 && (
              <SectionCard title="Subtitles" icon={<FileText size={16} className="text-yellow-400" />}>
                <div className="flex flex-wrap gap-2">
                  {mediaFiles.subtitles.map((f: any, i: number) => (
                    <a
                      key={i}
                      href={getMediaUrl(f.url || f.path)}
                      target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm"
                    >
                      <Download size={14} />
                      {f.filename || `subtitles.${(f.filename || "").split(".").pop() || "srt"}`}
                      <span className="text-[10px] text-muted">{formatSize(f.size)}</span>
                    </a>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Metadata */}
            {project.metadata_json && (
              <CodeBlock title="Metadata & SEO">
                {JSON.stringify(project.metadata_json, null, 2)}
              </CodeBlock>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Pipeline Status Card */}
            {isRunning && (
              <SectionCard title="Pipeline Status" icon={<Zap size={16} className="text-blue-400" />}>
                <div className="space-y-2">
                  {PIPELINE_STAGES.map((stage, i) => {
                    const isPast = currentStageIdx > i;
                    const isCurrent = currentStageIdx === i;
                    const isUpcoming = currentStageIdx < i || currentStageIdx === -1;
                    return (
                      <div key={stage} className="flex items-center gap-2 text-xs">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${
                          isPast ? "bg-green-400" : isCurrent ? "bg-blue-400 animate-pulse" : "bg-neutral-700"
                        }`} />
                        <span className={`${isPast ? "text-green-400" : isCurrent ? "text-blue-300" : "text-neutral-500"}`}>
                          {STAGE_LABELS[stage]}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </SectionCard>
            )}

            {/* Project Info */}
            <SectionCard title="Project Info" icon={<FileCode size={16} className="text-muted" />}>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted">Status</span><span className="flex items-center gap-1">{project.status}</span></div>
                <div className="flex justify-between"><span className="text-muted">Progress</span><span>{project.progress || 0}%</span></div>
                <div className="flex justify-between"><span className="text-muted">Checkpoint</span><span className="text-xs">{project.checkpoint || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Duration</span><span className="capitalize">{project.duration || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Language</span><span>{project.language || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Style</span><span className="capitalize">{project.voice_style || project.story_style || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Audience</span><span className="capitalize">{project.target_audience || "—"}</span></div>
                <div className="flex justify-between"><span className="text-muted">Files</span><span>{files.length}</span></div>
                <div className="flex justify-between"><span className="text-muted">Live</span>
                  <span className={`flex items-center gap-1 ${wsConnected ? "text-green-400" : "text-muted"}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${wsConnected ? "bg-green-400" : "bg-neutral-600"}`} />
                    {wsConnected ? "Connected" : "Offline"}
                  </span>
                </div>
              </div>
            </SectionCard>

            {/* Quick Downloads */}
            {project.project_dir && (
              <SectionCard title="Direct Downloads" icon={<Download size={16} className="text-muted" />}>
                <div className="space-y-2">
                  {project.video_url && (
                    <a href={getMediaUrl(project.video_url)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm w-full">
                      <Film size={14} className="text-purple-400" /> Download Video
                    </a>
                  )}
                  {project.short_url && (
                    <a href={getMediaUrl(project.short_url)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm w-full">
                      <Film size={14} className="text-purple-400" /> Download Short
                    </a>
                  )}
                  {project.voice_url && (
                    <a href={getMediaUrl(project.voice_url)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm w-full">
                      <Volume2 size={14} className="text-green-400" /> Download Voice
                    </a>
                  )}
                  {project.thumbnail_url && (
                    <a href={getMediaUrl(project.thumbnail_url)} target="_blank" rel="noreferrer"
                      className="flex items-center gap-2 px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-sm w-full">
                      <Image size={14} className="text-blue-400" /> Download Thumbnail
                    </a>
                  )}
                </div>
              </SectionCard>
            )}

            <SectionCard title="Quick Actions" icon={<Copy size={16} className="text-muted" />}>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => { getProject(projectId).then(p => { navigator.clipboard.writeText(JSON.stringify(p, null, 2)); toast.success("Copied"); }); }}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-xs">
                  Copy JSON
                </button>
                <button onClick={() => { navigator.clipboard.writeText(window.location.href); toast.success("Link copied"); }}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-xs">
                  Copy Link
                </button>
                <button onClick={refetchProject}
                  className="px-3 py-2 rounded-lg bg-neutral-800 hover:bg-neutral-700 transition-colors text-xs flex items-center gap-1">
                  <RefreshCw size={12} /> Refresh
                </button>
              </div>
            </SectionCard>
          </div>
        </div>
      )}

      {/* ===== FILES TAB ===== */}
      {activeTab === "files" && (
        <div className="space-y-3">
          {files.length === 0 ? (
            <div className="flex flex-col items-center py-16 text-muted">
              <FolderOpen size={40} className="mb-3 opacity-30" />
              <p className="text-sm">No files generated yet</p>
              {isRunning && <p className="text-xs mt-2 text-blue-400 animate-pulse">Pipeline is running — files will appear here as they're created...</p>}
            </div>
          ) : (
            <div className="border border-border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-neutral-900/50">
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Type</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-muted uppercase">Size</th>
                    <th className="text-right px-4 py-3 text-xs font-medium text-muted uppercase">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f: any, i: number) => {
                    const name = f.filename || f.name || `file_${i}`;
                    return (
                      <tr key={i} className="border-b border-border/50 hover:bg-neutral-800/30 transition-colors">
                        <td className="px-4 py-2.5 flex items-center gap-2">
                          {/\.(png|jpg|jpeg|webp)$/i.test(name) && <Image size={14} className="text-blue-400 shrink-0" />}
                          {/\.(mp4|mov|webm)$/i.test(name) && <Film size={14} className="text-purple-400 shrink-0" />}
                          {/\.(wav|mp3|ogg)$/i.test(name) && <Music size={14} className="text-green-400 shrink-0" />}
                          {/\.(srt|vtt|txt)$/i.test(name) && <FileText size={14} className="text-yellow-400 shrink-0" />}
                          <span className="truncate">{name}</span>
                        </td>
                        <td className="px-4 py-2.5 text-muted">{(name.split(".").pop() || "—").toUpperCase()}</td>
                        <td className="px-4 py-2.5 text-muted">{formatSize(f.size || 0)}</td>
                        <td className="px-4 py-2.5 text-right">
                          <a href={getMediaUrl(f.url || f.path)} target="_blank" rel="noreferrer"
                            className="btn-ghost p-1.5 inline-flex" title="Download">
                            <Download size={14} />
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== LOGS TAB ===== */}
      {activeTab === "logs" && (
        <div className="border border-border rounded-xl bg-neutral-950 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 bg-neutral-900/50 border-b border-border">
            <span className="text-sm font-medium flex items-center gap-2">
              <Terminal size={14} className="text-muted" />
              Pipeline Logs
              {isRunning && <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />}
            </span>
            <span className="text-xs text-muted">{logs.length} lines</span>
          </div>
          <pre className="p-4 text-xs leading-relaxed font-mono overflow-x-auto max-h-[70vh] overflow-y-auto whitespace-pre-wrap">
            {logs.length === 0 ? (
              <span className="text-muted italic">No logs available</span>
            ) : (
              logs.map((line, i) => (
                <div key={i} className={`${
                  line.includes("ERROR") || line.includes("FAILED") ? "text-red-400" :
                  line.includes("WARNING") ? "text-yellow-400" :
                  line.includes("INFO") || line.includes("SUCCESS") || line.includes("COMPLETED") ? "text-green-400" :
                  "text-gray-400"
                }`}>
                  {line}
                </div>
              ))
            )}
          </pre>
        </div>
      )}

      {/* Image lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
            onClick={() => setSelectedImage(null)}
          >
            <motion.img
              initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
              src={selectedImage}
              alt="Preview"
              className="max-w-full max-h-full rounded-xl shadow-2xl"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
