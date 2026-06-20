"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Server, Cpu, Activity, Database, Globe, Wifi, WifiOff,
  CheckCircle2, XCircle, RefreshCw, BarChart3,
  AlertCircle, Users, Clock, Zap,
} from "lucide-react";
import { getSystemStatus, getSystemStats, getWorkerStatus, getHealth } from "@/lib/api";
import { toast } from "@/components/Toaster";

export default function SystemPage() {
  const [status, setStatus] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [workers, setWorkers] = useState<any[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchAll = async () => {
    try {
      const [s, st, w, h] = await Promise.all([
        getSystemStatus(), getSystemStats(), getWorkerStatus(), getHealth(),
      ]);
      setStatus(s); setStats(st); setWorkers(w?.workers || w || []); setHealth(h);
      setError("");
    } catch {
      setError("Failed to fetch system data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); const i = setInterval(fetchAll, 10000); return () => clearInterval(i); }, []);

  if (loading) {
    return (
      <div className="flex flex-col flex-grow p-8 bg-background text-foreground overflow-y-auto">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-72 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
          {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton h-24" />)}
        </div>
        <div className="skeleton h-64" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-grow p-8 bg-background text-foreground overflow-y-auto">
        <div className="card p-8 text-center">
          <AlertCircle size={48} className="mx-auto text-red-400 mb-4" />
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetchAll} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  const healthBadge = health?.status === "ok" ? { label: "Online", color: "text-green-400", icon: Wifi } : { label: "Checking...", color: "text-yellow-400", icon: WifiOff };
  const HealthIcon = healthBadge.icon;

  const statCards = [
    { label: "Backend API", value: healthBadge.label, icon: HealthIcon, color: healthBadge.color },
    { label: "Active Workers", value: workers.length || stats?.active_workers || "0", icon: Users, color: "text-blue-400" },
    { label: "Queue Size", value: stats?.queue_size ?? status?.queue_size ?? 0, icon: Activity, color: "text-purple-400" },
    { label: "Running Jobs", value: stats?.running_jobs ?? 0, icon: Zap, color: "text-orange-400" },
  ];

  return (
    <div className="flex flex-col flex-grow p-8 bg-background text-foreground overflow-y-auto">
      <div className="flex items-center gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-semibold">System Status</h1>
          <p className="text-muted mt-1">Health and configuration overview.</p>
        </div>
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ml-auto ${healthBadge.color} bg-neutral-900 border border-neutral-800`}>
          <HealthIcon size={14} />
          {healthBadge.label}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
              className="card p-5 flex items-center gap-4"
            >
              <Icon className={`w-10 h-10 ${stat.color}`} />
              <div>
                <p className="text-muted text-sm">{stat.label}</p>
                <p className="text-2xl font-bold">{String(stat.value)}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-8">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Cpu size={18} /> System Metrics</h2>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">CPU Usage</span>
                <span>{stats?.cpu_percent ?? 0}%</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill bg-blue-500" style={{ width: `${stats?.cpu_percent ?? 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Memory Usage</span>
                <span>{stats?.memory_percent ?? 0}%</span>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${(stats?.memory_percent ?? 0) > 80 ? "bg-red-500" : (stats?.memory_percent ?? 0) > 60 ? "bg-yellow-500" : "bg-green-500"}`}
                  style={{ width: `${stats?.memory_percent ?? 0}%` }} />
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted">Storage Usage</span>
                <span>{stats?.disk_percent ?? 0}%</span>
              </div>
              <div className="progress-bar">
                <div className={`progress-fill ${(stats?.disk_percent ?? 0) > 80 ? "bg-red-500" : (stats?.disk_percent ?? 0) > 60 ? "bg-yellow-500" : "bg-purple-500"}`}
                  style={{ width: `${stats?.disk_percent ?? 0}%` }} />
              </div>
            </div>
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="card p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><Server size={18} /> Server Info</h2>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between"><span className="text-muted">Backend URL</span><span className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}</span></div>
            <div className="flex justify-between"><span className="text-muted">API Docs</span><span className="font-mono text-xs">{process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000"}/docs</span></div>
            <div className="flex justify-between"><span className="text-muted">Database</span><span className="font-mono text-xs">SQLite</span></div>
            <div className="flex justify-between"><span className="text-muted">Workers</span><span className="font-mono text-xs">{workers.length} active</span></div>
            <div className="flex justify-between"><span className="text-muted">Health</span>
              <span className={`flex items-center gap-1 ${health?.status === "ok" ? "text-green-400" : "text-red-400"}`}>
                {health?.status === "ok" ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                {health?.status || "unknown"}
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="card p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2"><BarChart3 size={18} /> System Metrics Detail</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "CPU Cores", value: stats?.cpu_cores ?? "-" },
            { label: "Memory Total", value: stats?.memory_total ? `${(stats.memory_total / 1024 / 1024 / 1024).toFixed(1)} GB` : "-" },
            { label: "Memory Used", value: stats?.memory_used ? `${(stats.memory_used / 1024 / 1024 / 1024).toFixed(1)} GB` : "-" },
            { label: "Disk Free", value: stats?.disk_free ? `${(stats.disk_free / 1024 / 1024 / 1024).toFixed(1)} GB` : "-" },
          ].map((m, i) => (
            <div key={i} className="bg-neutral-900 rounded-lg p-4 text-center">
              <p className="text-muted text-xs mb-1">{m.label}</p>
              <p className="text-lg font-semibold">{m.value}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
