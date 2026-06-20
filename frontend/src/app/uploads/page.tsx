"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Upload, ExternalLink, CheckCircle2, XCircle, Clock,
  Loader2, Film, AlertCircle, ListVideo,
} from "lucide-react";
import { getUploadHistory, uploadToYoutube, getProjects } from "@/lib/api";
import { toast } from "@/components/Toaster";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const statusBadge = (status: string) => {
  switch (status?.toLowerCase()) {
    case "completed":
    case "success":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/10 text-green-400"><CheckCircle2 size={12} /> Success</span>;
    case "failed":
    case "error":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-500/10 text-red-400"><XCircle size={12} /> Failed</span>;
    case "uploading":
    case "processing":
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400"><Loader2 size={12} className="animate-spin" /> Uploading</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-neutral-800 text-muted"><Clock size={12} /> {status || "Pending"}</span>;
  }
};

const UploadsPage = () => {
  const [uploads, setUploads] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingId, setUploadingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedProject, setSelectedProject] = useState("");

  const fetch = async () => {
    try {
      const [uData, pData] = await Promise.allSettled([
        getUploadHistory(),
        getProjects(),
      ]);
      if (uData.status === "fulfilled") {
        const arr = Array.isArray(uData.value) ? uData.value : uData.value?.uploads || uData.value?.history || [];
        setUploads(arr);
      }
      if (pData.status === "fulfilled") setProjects(Array.isArray(pData.value) ? pData.value : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 10000);
    return () => clearInterval(interval);
  }, []);

  const stats = {
    total: uploads.length,
    successful: uploads.filter((u) => u.status?.toLowerCase() === "completed" || u.status?.toLowerCase() === "success").length,
    failed: uploads.filter((u) => u.status?.toLowerCase() === "failed" || u.status?.toLowerCase() === "error").length,
    pending: uploads.filter((u) => !["completed", "success", "failed", "error"].includes(u.status?.toLowerCase() || "")).length,
  };

  const handleUpload = async () => {
    if (!selectedProject) return;
    const pid = parseInt(selectedProject, 10);
    if (isNaN(pid)) return;
    setUploadingId(pid);
    try {
      const result = await uploadToYoutube(pid);
      toast.success(result?.message || "Upload started!");
      setShowModal(false);
      setSelectedProject("");
      fetch();
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploadingId(null);
    }
  };

  const completedProjects = projects.filter((p) => p.status === "Completed");

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Uploads</h1>
          <p className="text-sm text-muted mt-1">Manage YouTube uploads and track publishing history.</p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          disabled={completedProjects.length === 0}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          <Upload size={16} /> Upload to YouTube
        </button>
      </motion.div>

      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Uploads", value: stats.total, icon: Upload, color: "text-blue-400" },
          { label: "Successful", value: stats.successful, icon: CheckCircle2, color: "text-green-400" },
          { label: "Failed", value: stats.failed, icon: AlertCircle, color: "text-red-400" },
          { label: "Pending", value: stats.pending, icon: Clock, color: "text-yellow-400" },
        ].map((s, i) => (
          <motion.div key={i} variants={item} className="stat-card">
            <div className="flex items-center justify-between mb-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center">
                <s.icon size={18} className={s.color} />
              </div>
            </div>
            <p className="text-2xl font-semibold tracking-tight">{s.value}</p>
            <p className="text-xs text-muted mt-1">{s.label}</p>
          </motion.div>
        ))}
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex gap-4">
                <div className="skeleton h-5 w-48" />
                <div className="skeleton h-5 w-24" />
                <div className="skeleton h-5 w-32" />
              </div>
              <div className="skeleton h-4 w-64" />
            </div>
          ))}
        </div>
      ) : uploads.length === 0 ? (
        <motion.div variants={item} className="flex flex-col items-center justify-center py-24 text-muted">
          <ListVideo size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No uploads yet</p>
          <p className="text-sm mt-1">Complete a video project first.</p>
          {completedProjects.length > 0 && (
            <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 mt-6">
              <Upload size={16} /> Upload a Completed Project
            </button>
          )}
        </motion.div>
      ) : (
        <motion.div variants={item} className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">Project</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">Platform</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">Video ID</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">URL</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody>
                {[...uploads].reverse().map((u, i) => (
                  <motion.tr
                    key={u.id || i}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.03 }}
                    className="border-b border-border/50 hover:bg-neutral-800/30 transition-colors"
                  >
                    <td className="px-5 py-3 font-medium truncate max-w-[200px]">{u.project_name || u.title || u.project || `Project #${u.project_id || u.id}`}</td>
                    <td className="px-5 py-3">
                      <span className="flex items-center gap-1.5 text-muted">
                        <Film size={14} className="text-red-400" /> {u.platform || "YouTube"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted font-mono text-xs">{u.video_id || u.youtube_id || "—"}</td>
                    <td className="px-5 py-3">
                      {(u.video_url || u.url) ? (
                        <a href={u.video_url || u.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-accent hover:underline">
                          <ExternalLink size={12} /> View
                        </a>
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3">{statusBadge(u.status)}</td>
                    <td className="px-5 py-3 text-right text-muted text-xs">{u.upload_date || u.created_at ? new Date(u.upload_date || u.created_at).toLocaleDateString() : "—"}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}

      {/* Upload Modal */}
      {showModal && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => { if (!uploadingId) setShowModal(false); }}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
          >
            <div className="card p-6 w-full max-w-md pointer-events-auto border border-border/50 shadow-2xl">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Film size={20} className="text-red-400" /> Upload to YouTube
                </h2>
                <button onClick={() => { if (!uploadingId) setShowModal(false); }} className="btn-ghost p-1.5">
                  <XCircle size={18} />
                </button>
              </div>
              {completedProjects.length === 0 ? (
                <div className="text-center py-8 text-muted">
                  <p>No completed projects to upload.</p>
                  <p className="text-xs mt-1">Complete a video project first.</p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs text-muted mb-1.5 font-medium">Select Project</label>
                    <select className="input-field" value={selectedProject} onChange={(e) => setSelectedProject(e.target.value)}>
                      <option value="">Choose a completed project...</option>
                      {completedProjects.map((p) => (
                        <option key={p.id} value={p.id}>{p.topic || p.title || `Project #${p.id}`}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button onClick={() => setShowModal(false)} disabled={!!uploadingId} className="btn-ghost">Cancel</button>
                    <button
                      onClick={handleUpload}
                      disabled={!selectedProject || uploadingId !== null}
                      className="btn-primary flex items-center gap-2"
                    >
                      {uploadingId ? (
                        <><Loader2 size={16} className="animate-spin" /> Uploading&hellip;</>
                      ) : (
                        <><Upload size={16} /> Start Upload</>
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </motion.div>
  );
};

export default UploadsPage;
