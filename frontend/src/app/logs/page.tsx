"use client";
import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import {
  ScrollText, Download, Filter, ChevronDown, ChevronRight,
  Copy, Check, Info, AlertTriangle, Bug, AlertCircle,
  Loader2,
} from "lucide-react";
import { getSystemLogs } from "@/lib/api";
import { toast } from "@/components/Toaster";

type LogLevel = "ALL" | "INFO" | "WARN" | "ERROR" | "DEBUG";

interface LogEntry {
  id?: number | string;
  timestamp?: string;
  level?: string;
  source?: string;
  message?: string;
  details?: any;
  [key: string]: any;
}

const levelConfig: Record<string, { icon: any; color: string; bg: string }> = {
  INFO:  { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10 border-blue-500/20" },
  WARN:  { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10 border-yellow-500/20" },
  ERROR: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10 border-red-500/20" },
  DEBUG: { icon: Bug, color: "text-neutral-400", bg: "bg-neutral-500/10 border-neutral-500/20" },
};

function getLevelConfig(level?: string) {
  return levelConfig[(level || "").toUpperCase()] || levelConfig.DEBUG;
}

function formatTimestamp(ts?: string): string {
  if (!ts) return "—";
  try {
    return new Date(ts).toLocaleString(undefined, {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    });
  } catch {
    return ts;
  }
}

function LogSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="skeleton h-5 w-16 rounded" />
            <div className="skeleton h-4 w-32" />
            <div className="skeleton h-4 flex-1" />
          </div>
          <div className="skeleton h-3 w-3/4 shimmer" />
        </div>
      ))}
    </div>
  );
}

const LogsPage = () => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState<LogLevel>("ALL");
  const [sourceFilter, setSourceFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string | number>>(new Set());
  const [copiedId, setCopiedId] = useState<string | number | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await getSystemLogs();
      const entries = Array.isArray(data) ? data :
        data?.logs ? data.logs :
        data?.entries ? data.entries : [];
      setLogs(entries);
      setError(null);
    } catch (err: any) {
      if (logs.length === 0) setError(err.message || "Failed to load logs");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  const sources = useMemo(() => {
    const s = new Set<string>();
    logs.forEach((l) => { if (l.source) s.add(l.source); });
    return Array.from(s).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (levelFilter !== "ALL" && log.level?.toUpperCase() !== levelFilter) return false;
      if (sourceFilter && log.source !== sourceFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const msg = (log.message || "").toLowerCase();
        const src = (log.source || "").toLowerCase();
        if (!msg.includes(q) && !src.includes(q)) return false;
      }
      return true;
    });
  }, [logs, levelFilter, sourceFilter, searchQuery]);

  const toggleExpand = (id: string | number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleCopy = async (log: LogEntry) => {
    const text = JSON.stringify(log, null, 2);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(log.id ?? log.timestamp ?? "log");
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleExport = () => {
    try {
      const json = JSON.stringify(filteredLogs, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `logs-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Logs exported");
    } catch {
      toast.error("Failed to export logs");
    }
  };

  const getDetailObject = (log: LogEntry) => {
    if (log.details && typeof log.details === "object" && Object.keys(log.details).length > 0) return log.details;
    const extra = { ...log };
    delete extra.id; delete extra.timestamp; delete extra.level; delete extra.source; delete extra.message; delete extra.details;
    return Object.keys(extra).length > 0 ? extra : null;
  };

  if (error && logs.length === 0) {
    return (
      <div className="flex flex-col flex-grow p-8 bg-neutral-950 text-white overflow-y-auto">
        <div className="flex flex-col items-center justify-center py-32 text-muted">
          <AlertCircle size={48} className="text-red-400 mb-4" />
          <p className="text-lg font-medium text-red-400 mb-2">Failed to load logs</p>
          <p className="text-sm text-neutral-500 mb-6">{error}</p>
          <button onClick={fetchLogs} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow p-8 bg-neutral-950 text-white overflow-y-auto">
      <header className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Logs</h1>
          <p className="text-neutral-400">System events and error logs.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`btn-ghost flex items-center gap-2 text-sm ${showFilters ? "text-accent" : ""}`}
          >
            <Filter size={14} /> Filters
          </button>
          <button
            onClick={handleExport}
            disabled={filteredLogs.length === 0}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            <Download size={14} /> Export Logs
          </button>
        </div>
      </header>

      <motion.div
        initial={false}
        animate={showFilters ? { height: "auto", opacity: 1 } : { height: 0, opacity: 0 }}
        className="overflow-hidden mb-4"
      >
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Log Level</label>
              <div className="flex gap-1 flex-wrap">
                {(["ALL","INFO","WARN","ERROR","DEBUG"] as LogLevel[]).map((lvl) => {
                  const active = levelFilter === lvl;
                  const cfg = lvl === "ALL" ? { color: "text-white", bg: "bg-neutral-700" } : getLevelConfig(lvl);
                  return (
                    <button
                      key={lvl}
                      onClick={() => setLevelFilter(lvl)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                        active
                          ? `${cfg.bg} ${cfg.color}`
                          : "text-neutral-500 hover:text-neutral-300 bg-neutral-950/50"
                      }`}
                    >
                      {lvl}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Source</label>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50 text-white"
              >
                <option value="">All Sources</option>
                {sources.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-neutral-500 mb-1.5">Search</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search messages..."
                className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:border-accent/50 text-white placeholder:text-neutral-600"
              />
            </div>
          </div>
          <div className="mt-3 text-xs text-neutral-500">
            {filteredLogs.length} of {logs.length} entries
          </div>
        </div>
      </motion.div>

      {loading ? (
        <LogSkeleton />
      ) : filteredLogs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 text-muted">
          <ScrollText size={48} className="opacity-30 mb-4" />
          <p className="text-lg">No logs recorded yet.</p>
          <p className="text-sm text-neutral-600 mt-1">
            {logs.length > 0 ? "Try adjusting your filters." : "Logs will appear here as the system runs."}
          </p>
        </div>
      ) : (
        <motion.div
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.03 } } }}
          className="space-y-2"
        >
          {filteredLogs.map((log, i) => {
            const id = log.id ?? i;
            const expanded = expandedIds.has(id);
            const cfg = getLevelConfig(log.level);
            const LevelIcon = cfg.icon;
            const detail = getDetailObject(log);
            return (
              <motion.div
                key={id}
                variants={{ hidden: { opacity: 0, y: 6 }, show: { opacity: 1, y: 0 } }}
                className="bg-neutral-900 border border-neutral-800 rounded-xl overflow-hidden"
              >
                <div
                  className="flex items-center gap-3 p-4 cursor-pointer hover:bg-neutral-800/50 transition-colors"
                  onClick={() => toggleExpand(id)}
                >
                  <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium border ${cfg.bg} ${cfg.color}`}>
                    <LevelIcon size={12} />
                    {log.level || "DEBUG"}
                  </div>
                  <span className="text-xs text-neutral-500 font-mono shrink-0 w-36">
                    {formatTimestamp(log.timestamp)}
                  </span>
                  {log.source && (
                    <span className="text-xs text-neutral-400 font-medium shrink-0">{log.source}</span>
                  )}
                  <p className="text-sm text-neutral-200 flex-1 truncate">{log.message || "—"}</p>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleCopy(log); }}
                      className="p-1.5 rounded-lg hover:bg-neutral-700 transition-colors"
                      title="Copy entry"
                    >
                      {copiedId === id ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-neutral-500" />}
                    </button>
                    {detail && (
                      <span className="text-neutral-500">
                        {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      </span>
                    )}
                  </div>
                </div>
                {expanded && detail && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="border-t border-neutral-800"
                  >
                    <pre className="p-4 text-xs text-neutral-400 font-mono overflow-x-auto whitespace-pre-wrap">
                      {JSON.stringify(detail, null, 2)}
                    </pre>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </div>
  );
};

export default LogsPage;
