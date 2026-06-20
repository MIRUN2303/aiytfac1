"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, Plus, Play, Pencil, Trash2, ToggleLeft, ToggleRight,
  Clock, RefreshCw, AlertCircle, Loader2, X, Check,
} from "lucide-react";
import { getSchedules, createSchedule, updateSchedule, deleteSchedule, runScheduleNow } from "@/lib/api";
import { toast } from "@/components/Toaster";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const CRON_PRESETS: Record<string, string> = {
  daily: "0 9 * * *",
  weekly: "0 9 * * 1",
  monthly: "0 9 1 * *",
};

const humanCron = (expr: string): string => {
  if (!expr) return "—";
  const m: Record<string, string> = {
    "0 9 * * *": "Daily at 09:00",
    "0 9 * * 1": "Weekly on Monday at 09:00",
    "0 9 1 * *": "Monthly on 1st at 09:00",
  };
  if (m[expr]) return m[expr];
  const parts = expr.trim().split(/\s+/);
  if (parts.length === 5) {
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    return `${parts[0]} ${parts[1]} * * ${days[+parts[4]] || parts[4]} (custom)`.replace(/  +/g, " ");
  }
  return expr;
};

const relativeTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  const diff = Date.now() - new Date(dateStr).getTime();
  const sec = Math.floor(Math.abs(diff) / 1000);
  if (sec < 60) return `${sec}s ago`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return `${Math.floor(sec / 86400)}d ago`;
};

const absTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleString();
};

interface FormData {
  name: string;
  topic: string;
  summary: string;
  language: string;
  target_audience: string;
  duration: string;
  voice_style: string;
  story_style: string;
  schedule_type: string;
  cron_expression: string;
  enabled: boolean;
}

const defaultForm: FormData = {
  name: "",
  topic: "",
  summary: "",
  language: "auto",
  target_audience: "general",
  duration: "medium",
  voice_style: "neutral",
  story_style: "narrative",
  schedule_type: "daily",
  cron_expression: CRON_PRESETS.daily,
  enabled: true,
};

const CalendarPage = () => {
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [form, setForm] = useState<FormData>(defaultForm);
  const [saving, setSaving] = useState(false);

  const fetch = async () => {
    try {
      const data = await getSchedules();
      setSchedules(Array.isArray(data) ? data : []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch();
    const interval = setInterval(fetch, 15000);
    return () => clearInterval(interval);
  }, []);

  const openAdd = () => {
    setEditing(null);
    setForm(defaultForm);
    setModal(true);
  };

  const openEdit = (s: any) => {
    setEditing(s);
    const st = s.cron_expression === "0 9 * * *" ? "daily" : s.cron_expression === "0 9 * * 1" ? "weekly" : s.cron_expression === "0 9 1 * *" ? "monthly" : "custom";
    setForm({
      name: s.name || "",
      topic: s.topic || "",
      summary: s.summary || "",
      language: s.language || "auto",
      target_audience: s.target_audience || "general",
      duration: s.duration || "medium",
      voice_style: s.voice_style || "neutral",
      story_style: s.story_style || "narrative",
      schedule_type: st,
      cron_expression: s.cron_expression || CRON_PRESETS.daily,
      enabled: s.enabled !== false,
    });
    setModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = { ...form, cron_expression: form.cron_expression || CRON_PRESETS[form.schedule_type] || CRON_PRESETS.daily };
      if (editing) {
        await updateSchedule(editing.id, payload);
        toast.success("Schedule updated");
      } else {
        await createSchedule(payload);
        toast.success("Schedule created");
      }
      setModal(false);
      fetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to save schedule");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await deleteSchedule(id);
      toast.success("Schedule deleted");
      fetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  const handleToggle = async (s: any) => {
    try {
      await updateSchedule(s.id, { enabled: !s.enabled });
      toast.success(s.enabled ? "Schedule disabled" : "Schedule enabled");
      fetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to toggle");
    }
  };

  const handleRunNow = async (id: number) => {
    try {
      await runScheduleNow(id);
      toast.success("Job triggered!");
      fetch();
    } catch (err: any) {
      toast.error(err.message || "Failed to trigger");
    }
  };

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="flex-1 overflow-y-auto p-6 lg:p-8 space-y-8"
    >
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted mt-1">Schedule and automate your content publishing.</p>
        </div>
        <button onClick={openAdd} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Add Schedule
        </button>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="skeleton h-5 w-48" />
              <div className="skeleton h-4 w-96" />
              <div className="flex gap-4">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-4 w-32" />
              </div>
            </div>
          ))}
        </div>
      ) : schedules.length === 0 ? (
        <motion.div variants={item} className="flex flex-col items-center justify-center py-24 text-muted">
          <CalendarDays size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No schedules yet</p>
          <p className="text-sm mt-1">Click &quot;Add Schedule&quot; to automate your content.</p>
          <button onClick={openAdd} className="btn-primary flex items-center gap-2 mt-6">
            <Plus size={16} /> Add Schedule
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          <AnimatePresence mode="popLayout">
            {[...schedules].reverse().map((s) => (
              <motion.div
                key={s.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="card-hover p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="font-semibold truncate">{s.name || s.topic || `Schedule #${s.id}`}</h3>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                        s.enabled !== false
                          ? "bg-green-500/10 text-green-400"
                          : "bg-neutral-800 text-muted"
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${s.enabled !== false ? "bg-green-400" : "bg-neutral-600"}`} />
                        {s.enabled !== false ? "Active" : "Disabled"}
                      </span>
                    </div>
                    <p className="text-sm text-muted line-clamp-2 mb-2">{s.summary || "No summary"}</p>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span className="flex items-center gap-1"><Clock size={12} /> {humanCron(s.cron_expression)}</span>
                      {s.next_run && (
                        <span className="flex items-center gap-1">
                          <RefreshCw size={12} />
                          Next: {relativeTime(s.next_run)} &mdash; {absTime(s.next_run)}
                        </span>
                      )}
                      {s.last_run && (
                        <span className="flex items-center gap-1">
                          Last: {relativeTime(s.last_run)}
                        </span>
                      )}
                      {s.topic && <span className="text-accent">Topic: {s.topic}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleToggle(s)}
                      className="btn-ghost p-2"
                      title={s.enabled !== false ? "Disable" : "Enable"}
                    >
                      {s.enabled !== false ? <ToggleRight size={18} className="text-accent" /> : <ToggleLeft size={18} />}
                    </button>
                    <button onClick={() => handleRunNow(s.id)} className="btn-ghost p-2" title="Run Now">
                      <Play size={16} className="text-green-400" />
                    </button>
                    <button onClick={() => openEdit(s)} className="btn-ghost p-2" title="Edit">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => handleDelete(s.id)} className="btn-ghost p-2" title="Delete">
                      <Trash2 size={16} className="text-red-400" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      <AnimatePresence>
        {modal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={() => setModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto pointer-events-auto border border-border/50 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">{editing ? "Edit Schedule" : "Add Schedule"}</h2>
                  <button onClick={() => setModal(false)} className="btn-ghost p-1.5">
                    <X size={18} />
                  </button>
                </div>
                <form onSubmit={handleSave} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Name</label>
                      <input type="text" className="input-field" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My Schedule" required />
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Topic</label>
                      <input type="text" className="input-field" value={form.topic} onChange={(e) => setForm({ ...form, topic: e.target.value })} placeholder="Video topic" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-muted mb-1.5 font-medium">Summary</label>
                    <textarea className="input-field resize-none h-20" value={form.summary} onChange={(e) => setForm({ ...form, summary: e.target.value })} placeholder="Brief description..." />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Language</label>
                      <select className="input-field" value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })}>
                        <option value="auto">Auto-detect</option>
                        <option value="en">English</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="ja">Japanese</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Target Audience</label>
                      <input type="text" className="input-field" value={form.target_audience} onChange={(e) => setForm({ ...form, target_audience: e.target.value })} placeholder="general" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Duration</label>
                      <select className="input-field" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })}>
                        <option value="short">Short (&lt;3 min)</option>
                        <option value="medium">Medium (3-8 min)</option>
                        <option value="long">Long (&gt;8 min)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Voice Style</label>
                      <select className="input-field" value={form.voice_style} onChange={(e) => setForm({ ...form, voice_style: e.target.value })}>
                        <option value="neutral">Neutral</option>
                        <option value="energetic">Energetic</option>
                        <option value="calm">Calm</option>
                        <option value="dramatic">Dramatic</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Story Style</label>
                      <select className="input-field" value={form.story_style} onChange={(e) => setForm({ ...form, story_style: e.target.value })}>
                        <option value="narrative">Narrative</option>
                        <option value="educational">Educational</option>
                        <option value="documentary">Documentary</option>
                        <option value="entertainment">Entertainment</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Schedule Type</label>
                      <select className="input-field" value={form.schedule_type} onChange={(e) => {
                        const st = e.target.value;
                        setForm({ ...form, schedule_type: st, cron_expression: CRON_PRESETS[st] || form.cron_expression });
                      }}>
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                        <option value="monthly">Monthly</option>
                        <option value="custom">Custom Cron</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Cron Expression</label>
                      <input type="text" className="input-field font-mono" value={form.cron_expression} onChange={(e) => setForm({ ...form, cron_expression: e.target.value })} placeholder="0 9 * * *" />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, enabled: !form.enabled })}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        form.enabled ? "bg-accent" : "bg-neutral-700"
                      }`}
                    >
                      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        form.enabled ? "translate-x-6" : "translate-x-1"
                      }`} />
                    </button>
                    <span className="text-sm text-muted">{form.enabled ? "Enabled" : "Disabled"}</span>
                  </div>
                  <div className="flex justify-end gap-3 pt-2">
                    <button type="button" onClick={() => setModal(false)} className="btn-ghost">Cancel</button>
                    <button type="submit" disabled={saving} className="btn-primary flex items-center gap-2">
                      {saving ? <><Loader2 size={16} className="animate-spin" /> Saving&hellip;</> : <><Check size={16} /> {editing ? "Update" : "Create"}</>}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default CalendarPage;
