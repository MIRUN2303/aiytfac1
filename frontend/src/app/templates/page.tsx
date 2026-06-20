"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutTemplate, Plus, Pencil, Trash2, Play, Clock,
  Mic, BookOpen, Loader2, X, Copy, Check, AlertCircle,
} from "lucide-react";
import { toast } from "@/components/Toaster";

interface Template {
  id: string;
  name: string;
  topic: string;
  summary: string;
  language: string;
  target_audience: string;
  duration: string;
  voice_style: string;
  story_style: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = "aiyt_templates";
const emptyForm: Omit<Template, "id" | "useCount" | "createdAt" | "updatedAt"> = {
  name: "",
  topic: "",
  summary: "",
  language: "auto",
  target_audience: "general",
  duration: "medium",
  voice_style: "neutral",
  story_style: "narrative",
};

const languages = ["English", "Spanish", "French", "German", "Chinese", "Japanese", "auto"];
const durations = [
  { value: "short", label: "Short (~3 min)" },
  { value: "medium", label: "Medium (~8 min)" },
  { value: "long", label: "Long (~15 min)" },
];
const voiceStyles = ["neutral", "cinematic", "calm", "energetic", "professional"];
const storyStyles = ["narrative", "documentary", "educational", "cinematic", "emotional", "comedic"];

const styleColors: Record<string, string> = {
  narrative: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  documentary: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20",
  educational: "bg-green-500/10 text-green-400 border-green-500/20",
  cinematic: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  emotional: "bg-pink-500/10 text-pink-400 border-pink-500/20",
  comedic: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

function generateId() {
  return "tpl_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

const TemplatesPage = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const list: Template[] = raw ? JSON.parse(raw) : [];
      setTemplates(list);
    } catch {
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(load, 400);
    return () => clearTimeout(timer);
  }, [load]);

  function persist(list: Template[]) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    setTemplates(list);
  }

  function openCreate() {
    setForm(emptyForm);
    setEditingId(null);
    setShowModal(true);
  }

  function openEdit(tpl: Template) {
    setForm({
      name: tpl.name,
      topic: tpl.topic,
      summary: tpl.summary,
      language: tpl.language,
      target_audience: tpl.target_audience,
      duration: tpl.duration,
      voice_style: tpl.voice_style,
      story_style: tpl.story_style,
    });
    setEditingId(tpl.id);
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || !form.topic.trim() || !form.summary.trim()) {
      toast.error("Please fill in all required fields.");
      return;
    }
    setSaving(true);
    const now = new Date().toISOString();
    if (editingId) {
      const updated = templates.map((t) =>
        t.id === editingId
          ? { ...t, ...form, updatedAt: now }
          : t
      );
      persist(updated);
      toast.success("Template updated.");
    } else {
      const tpl: Template = {
        id: generateId(),
        ...form,
        useCount: 0,
        createdAt: now,
        updatedAt: now,
      };
      persist([tpl, ...templates]);
      toast.success("Template created.");
    }
    setSaving(false);
    closeModal();
  }

  function confirmDelete() {
    if (!deleteId) return;
    const list = templates.filter((t) => t.id !== deleteId);
    persist(list);
    toast.success("Template deleted.");
    setDeleteId(null);
  }

  function handleUse(tpl: Template) {
    const updated = templates.map((t) =>
      t.id === tpl.id ? { ...t, useCount: t.useCount + 1, updatedAt: new Date().toISOString() } : t
    );
    persist(updated);
    toast.success(`"${tpl.name}" applied.`);
  }

  function handleDuplicate(tpl: Template) {
    const now = new Date().toISOString();
    const copy: Template = {
      id: generateId(),
      name: tpl.name + " (copy)",
      topic: tpl.topic,
      summary: tpl.summary,
      language: tpl.language,
      target_audience: tpl.target_audience,
      duration: tpl.duration,
      voice_style: tpl.voice_style,
      story_style: tpl.story_style,
      useCount: 0,
      createdAt: now,
      updatedAt: now,
    };
    persist([copy, ...templates]);
    toast.success("Template duplicated.");
  }

  const durationLabel = (d: string) => durations.find((x) => x.value === d)?.label || d;
  const voiceLabel = (v: string) => v.charAt(0).toUpperCase() + v.slice(1);

  return (
    <div className="flex flex-col flex-grow p-8 bg-neutral-950 text-white overflow-y-auto">
      <header className="flex items-start justify-between mb-8">
        <div>
          <h1 className="text-3xl font-semibold flex items-center gap-3">
            <LayoutTemplate className="w-7 h-7 text-blue-400" />
            Templates
          </h1>
          <p className="text-neutral-400 mt-1">
            Save and reuse content templates for consistent video creation.
          </p>
        </div>
        <button onClick={openCreate} className="btn-primary flex items-center gap-2">
          <Plus size={18} />
          Create Template
        </button>
      </header>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
              <div className="skeleton h-5 w-3/4" />
              <div className="skeleton h-4 w-full" />
              <div className="skeleton h-4 w-5/6" />
              <div className="flex gap-2">
                <div className="skeleton h-6 w-20 rounded-full" />
                <div className="skeleton h-6 w-20 rounded-full" />
              </div>
              <div className="flex gap-3 pt-2">
                <div className="skeleton h-8 w-16 rounded-lg" />
                <div className="skeleton h-8 w-16 rounded-lg" />
              </div>
            </div>
          ))}
        </div>
      ) : templates.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center text-center py-24 px-4"
        >
          <div className="w-16 h-16 rounded-2xl bg-neutral-900 border border-neutral-800 flex items-center justify-center mb-5">
            <LayoutTemplate className="w-8 h-8 text-neutral-500" />
          </div>
          <h3 className="text-xl font-medium mb-2">No templates yet</h3>
          <p className="text-neutral-500 max-w-md mb-6">
            Create your first template to speed up video creation.
          </p>
          <button onClick={openCreate} className="btn-primary flex items-center gap-2">
            <Plus size={18} />
            Create Template
          </button>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {templates.map((tpl, i) => (
            <motion.div
              key={tpl.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="group glass rounded-xl border border-neutral-800/50 hover:border-neutral-700/60 transition-all duration-300 p-5 flex flex-col"
            >
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-base font-semibold truncate flex-1 mr-2">{tpl.name}</h3>
                <span
                  className={`text-xs font-medium px-2.5 py-0.5 rounded-full border shrink-0 ${
                    styleColors[tpl.story_style] || "bg-neutral-800 text-neutral-300 border-neutral-700"
                  }`}
                >
                  {tpl.story_style}
                </span>
              </div>

              <p className="text-sm text-neutral-400 mb-1 truncate">
                <span className="text-neutral-500">Topic:</span> {tpl.topic}
              </p>
              <p className="text-xs text-neutral-500 mb-3 line-clamp-2 leading-relaxed">{tpl.summary}</p>

              <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-neutral-400 mb-4 mt-auto">
                <span className="flex items-center gap-1">
                  <Clock size={12} />
                  {durationLabel(tpl.duration)}
                </span>
                <span className="flex items-center gap-1">
                  <Mic size={12} />
                  {voiceLabel(tpl.voice_style)}
                </span>
                <span className="flex items-center gap-1">
                  <BookOpen size={12} />
                  {tpl.language === "auto" ? "Auto" : tpl.language}
                </span>
                <span className="flex items-center gap-1">
                  <Play size={12} />
                  Used {tpl.useCount} {tpl.useCount === 1 ? "time" : "times"}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-3 border-t border-neutral-800/50">
                <button
                  onClick={() => handleUse(tpl)}
                  className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium bg-blue-600/10 hover:bg-blue-600/20 text-blue-400 border border-blue-500/20 rounded-lg py-1.5 transition-all duration-200"
                >
                  <Play size={14} />
                  Use
                </button>
                <button
                  onClick={() => openEdit(tpl)}
                  className="btn-ghost p-1.5"
                  title="Edit"
                >
                  <Pencil size={15} />
                </button>
                <button
                  onClick={() => handleDuplicate(tpl)}
                  className="btn-ghost p-1.5"
                  title="Duplicate"
                >
                  <Copy size={15} />
                </button>
                <button
                  onClick={() => setDeleteId(tpl.id)}
                  className="btn-ghost p-1.5 hover:text-red-400"
                  title="Delete"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={closeModal}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2 }}
              className="glass rounded-2xl border border-neutral-700/50 w-full max-w-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-5 border-b border-neutral-800/50">
                <h2 className="text-lg font-semibold">
                  {editingId ? "Edit Template" : "Create Template"}
                </h2>
                <button onClick={closeModal} className="btn-ghost p-1">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSave} className="p-5 space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      Template Name <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Cinematic Documentary"
                      className="input-field"
                      required
                    />
                  </div>
                  <div className="col-span-2 sm:col-span-1">
                    <label className="block text-xs text-neutral-400 mb-1.5">
                      Topic <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.topic}
                      onChange={(e) => setForm({ ...form, topic: e.target.value })}
                      placeholder="e.g. Space Exploration"
                      className="input-field"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs text-neutral-400 mb-1.5">
                    Summary <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={form.summary}
                    onChange={(e) => setForm({ ...form, summary: e.target.value })}
                    placeholder="Brief description of the template..."
                    rows={3}
                    className="input-field resize-none"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Language</label>
                    <select
                      value={form.language}
                      onChange={(e) => setForm({ ...form, language: e.target.value })}
                      className="input-field"
                    >
                      {languages.map((l) => (
                        <option key={l} value={l.toLowerCase()}>{l}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Target Audience</label>
                    <input
                      type="text"
                      value={form.target_audience}
                      onChange={(e) => setForm({ ...form, target_audience: e.target.value })}
                      placeholder="general"
                      className="input-field"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Duration</label>
                    <select
                      value={form.duration}
                      onChange={(e) => setForm({ ...form, duration: e.target.value })}
                      className="input-field"
                    >
                      {durations.map((d) => (
                        <option key={d.value} value={d.value}>{d.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Voice Style</label>
                    <select
                      value={form.voice_style}
                      onChange={(e) => setForm({ ...form, voice_style: e.target.value })}
                      className="input-field"
                    >
                      {voiceStyles.map((v) => (
                        <option key={v} value={v}>{voiceLabel(v)}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs text-neutral-400 mb-1.5">Story Style</label>
                    <select
                      value={form.story_style}
                      onChange={(e) => setForm({ ...form, story_style: e.target.value })}
                      className="input-field"
                    >
                      {storyStyles.map((s) => (
                        <option key={s} value={s}>{voiceLabel(s)}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-2 border-t border-neutral-800/50">
                  <button type="button" onClick={closeModal} className="btn-ghost px-4 py-2">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="btn-primary flex items-center gap-2"
                  >
                    {saving ? (
                      <Loader2 size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    {saving ? "Saving..." : editingId ? "Update Template" : "Save Template"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
            onClick={() => setDeleteId(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="glass rounded-2xl border border-neutral-700/50 w-full max-w-sm p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                  <AlertCircle className="w-5 h-5 text-red-400" />
                </div>
                <div>
                  <h3 className="font-semibold">Delete Template</h3>
                  <p className="text-sm text-neutral-400">
                    Are you sure? This cannot be undone.
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={() => setDeleteId(null)}
                  className="btn-ghost px-4 py-2"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="bg-red-600 hover:bg-red-700 text-white font-medium px-4 py-2 rounded-lg transition-all duration-200 flex items-center gap-2"
                >
                  <Trash2 size={15} />
                  Delete
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default TemplatesPage;
