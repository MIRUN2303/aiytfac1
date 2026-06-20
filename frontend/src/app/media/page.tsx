"use client";
import React, { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import {
  Image, Film, Music, FileText, Download, Search, Grid3X3, List,
  FolderOpen, HardDrive, } from "lucide-react";
import { getProjects, getProjectFiles } from "@/lib/api";
import { toast } from "@/components/Toaster";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const typeIcon = (type: string) => {
  const t = type?.toLowerCase() || "";
  if (t.includes("image") || t.match(/\.(png|jpg|jpeg|webp|gif)$/)) return <Image size={20} className="text-blue-400" />;
  if (t.includes("video") || t.match(/\.(mp4|mov|avi|webm)$/)) return <Film size={20} className="text-purple-400" />;
  if (t.includes("audio") || t.match(/\.(mp3|wav|ogg|aac)$/)) return <Music size={20} className="text-green-400" />;
  if (t.includes("subtitle") || t.match(/\.(srt|vtt|ass)$/)) return <FileText size={20} className="text-yellow-400" />;
  return <FileText size={20} className="text-muted" />;
};

const typeFilterOptions = [
  { label: "All", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Audio", value: "audio" },
  { label: "Subtitles", value: "subtitle" },
];

const formatSize = (bytes: number): string => {
  if (!bytes || bytes === 0) return "—";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let size = bytes;
  while (size >= 1024 && i < units.length - 1) { size /= 1024; i++; }
  return `${size.toFixed(1)} ${units[i]}`;
};

const MediaPage = () => {
  const [projects, setProjects] = useState<any[]>([]);
  const [filesByProject, setFilesByProject] = useState<Record<number, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [typeFilter, setTypeFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [expandedProject, setExpandedProject] = useState<number | null>(null);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageTotal, setStorageTotal] = useState(10 * 1024 * 1024 * 1024); // 10GB mock

  const fetch = async () => {
    try {
      const pData = await getProjects();
      const projectsArr = Array.isArray(pData) ? pData : [];
      setProjects(projectsArr);

      const fileMap: Record<number, any[]> = {};
      let totalSize = 0;

      for (const p of projectsArr) {
        try {
          const files = await getProjectFiles(p.id);
          const fileList = Array.isArray(files) ? files : files?.files || files?.items || [];
          fileMap[p.id] = fileList;
          for (const f of fileList) totalSize += f.size || f.file_size || 0;
        } catch {
          fileMap[p.id] = [];
        }
      }

      setFilesByProject(fileMap);
      setStorageUsed(totalSize);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
  }, []);

  const allFiles = useMemo(() => {
    const result: { projectId: number; projectName: string; file: any }[] = [];
    for (const p of projects) {
      const files = filesByProject[p.id] || [];
      for (const f of files) {
        result.push({ projectId: p.id, projectName: p.topic || p.title || `Project #${p.id}`, file: f });
      }
    }
    return result;
  }, [projects, filesByProject]);

  const filtered = useMemo(() => {
    return allFiles.filter(({ file }) => {
      const name = (file.filename || file.name || "").toLowerCase();
      if (search && !name.includes(search.toLowerCase())) return false;
      if (typeFilter === "all") return true;
      const ext = name.split(".").pop() || "";
      const type = typeFilter.toLowerCase();
      if (type === "image") return /\.(png|jpg|jpeg|webp|gif|bmp|svg)$/i.test(name);
      if (type === "video") return /\.(mp4|mov|avi|webm|mkv|flv)$/i.test(name);
      if (type === "audio") return /\.(mp3|wav|ogg|aac|flac|m4a)$/i.test(name);
      if (type === "subtitle") return /\.(srt|vtt|ass|ssa)$/i.test(name);
      return true;
    });
  }, [allFiles, search, typeFilter]);

  const storagePercent = Math.min((storageUsed / storageTotal) * 100, 100);
  const grouped = useMemo(() => {
    const map: Record<string, typeof filtered> = {};
    for (const entry of filtered) {
      const key = entry.projectName;
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    }
    return map;
  }, [filtered]);

  const handleDownload = (file: any) => {
    const url = file.url || file.path || file.download_url;
    if (url) {
      window.open(url, "_blank");
      toast.info("Download started");
    } else {
      toast.error("No download URL available");
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8"
    >
      <motion.div variants={item}>
        <h1 className="text-2xl font-semibold tracking-tight">Media Library</h1>
        <p className="text-sm text-muted mt-1">Browse files generated by your projects.</p>
      </motion.div>

      <motion.div variants={item} className="card p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <HardDrive size={18} className="text-muted" />
            <span className="text-sm font-medium">Storage</span>
          </div>
          <span className="text-xs text-muted">{formatSize(storageUsed)} / {formatSize(storageTotal)}</span>
        </div>
        <div className="progress-bar">
          <div
            className={`progress-fill ${storagePercent > 90 ? "bg-red-500" : storagePercent > 70 ? "bg-yellow-500" : "bg-accent"}`}
            style={{ width: `${storagePercent}%` }}
          />
        </div>
      </motion.div>

      <motion.div variants={item} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 flex-wrap">
          {typeFilterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setTypeFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                typeFilter === opt.value
                  ? "bg-accent text-white"
                  : "bg-neutral-800 text-muted hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="input-field pl-9 w-full sm:w-56"
              placeholder="Search files..."
            />
          </div>
          <div className="flex items-center gap-1 bg-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setView("grid")}
              className={`p-1.5 rounded-md transition-colors ${view === "grid" ? "bg-neutral-700 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setView("list")}
              className={`p-1.5 rounded-md transition-colors ${view === "list" ? "bg-neutral-700 text-foreground" : "text-muted hover:text-foreground"}`}
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </motion.div>

      {loading ? (
        <div className="space-y-4">
          <div className="skeleton h-6 w-48 mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card p-3 space-y-3">
                <div className="skeleton aspect-video rounded-lg" />
                <div className="skeleton h-4 w-24" />
                <div className="skeleton h-3 w-16" />
              </div>
            ))}
          </div>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <motion.div variants={item} className="flex flex-col items-center justify-center py-24 text-muted">
          <FolderOpen size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No media files yet</p>
          <p className="text-sm mt-1">Generate a video project first.</p>
        </motion.div>
      ) : (
        <div className="space-y-8">
          {Object.entries(grouped).map(([projectName, entries]) => (
            <motion.div key={projectName} variants={item}>
              <button
                onClick={() => setExpandedProject(expandedProject === entries[0].projectId ? null : entries[0].projectId)}
                className="flex items-center gap-2 text-sm font-medium mb-3 hover:text-foreground transition-colors"
              >
                <FolderOpen size={16} className="text-accent" />
                {projectName}
                <span className="text-muted text-xs ml-1">({entries.length} files)</span>
                <motion.span
                  animate={{ rotate: expandedProject === entries[0].projectId ? 90 : 0 }}
                  className="text-muted ml-1"
                >
                  ▸
                </motion.span>
              </button>

              {expandedProject === entries[0].projectId && (
                view === "grid" ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                    {entries.map(({ file }) => {
                      const name = file.filename || file.name || "untitled";
                      return (
                        <motion.div
                          key={file.id || name}
                          layout
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="card-hover group overflow-hidden"
                        >
                          <div className="aspect-video bg-neutral-900 flex items-center justify-center relative">
                            {typeIcon(name)}
                            <button
                              onClick={() => handleDownload(file)}
                              className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              <Download size={20} className="text-white" />
                            </button>
                          </div>
                          <div className="p-3">
                            <p className="text-xs font-medium truncate" title={name}>{name}</p>
                            <p className="text-[10px] text-muted mt-1">{formatSize(file.size || file.file_size || 0)}</p>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="card overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">File</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Type</th>
                          <th className="text-left px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Size</th>
                          <th className="text-right px-4 py-2.5 text-xs font-medium text-muted uppercase tracking-wider">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {entries.map(({ file }) => {
                          const name = file.filename || file.name || "untitled";
                          return (
                            <tr key={file.id || name} className="border-b border-border/50 hover:bg-neutral-800/30 transition-colors">
                              <td className="px-4 py-2.5 flex items-center gap-2">
                                {typeIcon(name)}
                                <span className="truncate max-w-[200px]">{name}</span>
                              </td>
                              <td className="px-4 py-2.5 text-muted">{(name.split(".").pop() || "—").toUpperCase()}</td>
                              <td className="px-4 py-2.5 text-muted">{formatSize(file.size || file.file_size || 0)}</td>
                              <td className="px-4 py-2.5 text-right">
                                <button onClick={() => handleDownload(file)} className="btn-ghost p-1.5">
                                  <Download size={14} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )
              )}
              {expandedProject !== entries[0].projectId && (
                <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-8 xl:grid-cols-10 gap-2">
                  {entries.slice(0, 10).map(({ file }) => {
                    const name = file.filename || file.name || "untitled";
                    return (
                      <button
                        key={file.id || name}
                        onClick={() => setExpandedProject(entries[0].projectId)}
                        className="card-hover p-2 flex flex-col items-center gap-1 text-center group"
                      >
                        <div className="w-10 h-10 rounded-lg bg-neutral-900 flex items-center justify-center">{typeIcon(name)}</div>
                        <p className="text-[10px] text-muted truncate w-full">{name.length > 12 ? name.substring(0, 10) + "…" : name}</p>
                      </button>
                    );
                  })}
                  {entries.length > 10 && (
                    <button
                      onClick={() => setExpandedProject(entries[0].projectId)}
                      className="card-hover p-2 flex flex-col items-center justify-center text-xs text-muted"
                    >
                      +{entries.length - 10} more
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </motion.div>
  );
};

export default MediaPage;
