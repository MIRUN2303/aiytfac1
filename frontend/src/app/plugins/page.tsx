"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Puzzle, Plus, Trash2, Settings, X, Check, Zap,
} from "lucide-react";
import { getPlugins, createPlugin, updatePlugin, deletePlugin, testPlugin } from "@/lib/api";
import { toast } from "@/components/Toaster";

const typeColors: Record<string, string> = {
  llm: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  image: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  voice: "bg-green-500/20 text-green-400 border-green-500/30",
  video: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  upload: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function PluginsPage() {
  const [plugins, setPlugins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ name: "", type: "llm", config: "{}", priority: 0 });

  const fetch = async () => {
    try {
      const data = await getPlugins();
      setPlugins(data);
      setError("");
    } catch {
      setError("Failed to load plugins");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let config = {};
      try { config = JSON.parse(form.config); } catch { toast.error("Invalid JSON config"); return; }
      await createPlugin({ name: form.name, type: form.type, config, priority: form.priority, enabled: true });
      toast.success(`Plugin "${form.name}" installed`);
      setShowModal(false);
      setForm({ name: "", type: "llm", config: "{}", priority: 0 });
      fetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleToggle = async (plugin: any) => {
    try {
      await updatePlugin(plugin.id, { enabled: !plugin.enabled });
      toast.success(`${plugin.name} ${plugin.enabled ? "disabled" : "enabled"}`);
      fetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  const handleTest = async (id: number, name: string) => {
    try {
      const res = await testPlugin(id);
      toast.success(`${name}: ${res.message || "Connection OK"}`);
    } catch (err: any) {
      toast.error(`${name}: ${err.message}`);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    try {
      await deletePlugin(id);
      toast.success(`Plugin "${name}" removed`);
      fetch();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-grow p-8 bg-background text-foreground overflow-y-auto">
        <div className="skeleton h-8 w-48 mb-2" />
        <div className="skeleton h-4 w-72 mb-8" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="skeleton h-32" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col flex-grow p-8 bg-background text-foreground overflow-y-auto">
        <div className="card p-8 text-center">
          <p className="text-red-400 mb-4">{error}</p>
          <button onClick={fetch} className="btn-primary">Retry</button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow p-8 bg-background text-foreground overflow-y-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold">Plugin Manager</h1>
          <p className="text-muted mt-1">Extend functionality with custom providers.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Install Plugin
        </button>
      </div>

      {plugins.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <Puzzle size={48} className="mx-auto text-muted mb-4" />
            <p className="text-lg text-muted">No plugins installed.</p>
            <p className="text-sm text-muted mt-1">Click "Install Plugin" to add one.</p>
          </div>
        </div>
      ) : (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {plugins.map((plugin) => (
            <motion.div key={plugin.id} variants={itemAnim} className="card-hover p-5">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-neutral-800 flex items-center justify-center">
                    <Puzzle size={18} className="text-accent" />
                  </div>
                  <div>
                    <h3 className="font-medium">{plugin.name}</h3>
                    <span className={`text-xs px-2 py-0.5 rounded-full border ${typeColors[plugin.type] || "bg-neutral-800 text-muted border-neutral-700"}`}>
                      {plugin.type}
                    </span>
                  </div>
                </div>
                <button onClick={() => handleToggle(plugin)} className={`relative w-10 h-5 rounded-full transition-colors ${plugin.enabled ? "bg-green-500" : "bg-neutral-700"}`}>
                  <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${plugin.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted mb-3">
                <span>Priority: {plugin.priority}</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => handleTest(plugin.id, plugin.name)} className="btn-ghost text-xs flex items-center gap-1">
                  <Zap size={12} /> Test
                </button>
                <button className="btn-ghost text-xs flex items-center gap-1">
                  <Settings size={12} /> Configure
                </button>
                <button onClick={() => handleDelete(plugin.id, plugin.name)} className="btn-ghost text-xs text-red-400 hover:text-red-300 flex items-center gap-1">
                  <Trash2 size={12} /> Delete
                </button>
              </div>
            </motion.div>
          ))}
        </motion.div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center" onClick={() => setShowModal(false)}>
          <div className="card p-6 w-full max-w-lg mx-4" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold">Install Plugin</h2>
              <button onClick={() => setShowModal(false)} className="btn-ghost p-1"><X size={18} /></button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-muted mb-1">Plugin Name</label>
                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="input-field" placeholder="e.g., OpenAI Image Gen" required />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Type</label>
                <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="input-field">
                  <option value="llm">LLM</option>
                  <option value="image">Image</option>
                  <option value="voice">Voice</option>
                  <option value="video">Video</option>
                  <option value="upload">Upload</option>
                </select>
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Config (JSON)</label>
                <textarea value={form.config} onChange={e => setForm({ ...form, config: e.target.value })} className="input-field h-24 font-mono text-xs" placeholder='{"api_key": "...", "endpoint": "..."}' />
              </div>
              <div>
                <label className="block text-sm text-muted mb-1">Priority</label>
                <input type="number" value={form.priority} onChange={e => setForm({ ...form, priority: Number(e.target.value) })} className="input-field" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-ghost">Cancel</button>
                <button type="submit" className="btn-primary flex items-center gap-2"><Check size={16} /> Install</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
