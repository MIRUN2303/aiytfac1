"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Save, RotateCcw, Image, Mic, Video, FolderOpen, Key, Settings2,
  Sliders, ChevronDown, Globe, Volume2, BookOpen, Loader2,
} from "lucide-react";
import { getSettings, updateSettings } from "@/lib/api";
import { toast } from "@/components/Toaster";

type Tab = "general" | "image" | "voice" | "video" | "storage" | "api" | "advanced";

const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: Settings2 },
  { id: "image", label: "Image Generation", icon: Image },
  { id: "voice", label: "Voice & Subtitles", icon: Mic },
  { id: "video", label: "Video", icon: Video },
  { id: "storage", label: "Storage", icon: FolderOpen },
  { id: "api", label: "API Keys", icon: Key },
  { id: "advanced", label: "Advanced", icon: Sliders },
];

const defaults: Record<string, any> = {
  language: "en",
  target_audience: "general",
  default_duration: "medium",
  default_voice_style: "neutral",
  default_story_style: "narrative",
  pollinations_endpoint: "https://image.pollinations.ai/prompt/",
  puter_endpoint: "",
  retry_delay: 60,
  max_retries: 3,
  image_width: 1920,
  image_height: 1080,
  provider_priority: "pollinations_first",
  piper_executable_path: "",
  piper_voice_model: "",
  whisper_executable_path: "",
  whisper_model: "base",
  subtitle_font: "Arial",
  subtitle_style: "classic",
  ffmpeg_path: "ffmpeg",
  output_width: 1920,
  output_height: 1080,
  fps: 30,
  codec: "h264",
  bitrate: "8M",
  storage_location: "",
  output_location: "",
  background_music_folder: "",
  sound_effects_folder: "",
  youtube_api_key: "",
  youtube_client_id: "",
  youtube_client_secret: "",
  worker_count: 3,
  thread_count: 4,
  request_timeout: 30,
  log_level: "info",
};

function Label({ children, hint }: { children: React.ReactNode; hint?: string }) {
  return (
    <div className="mb-1.5">
      <label className="block text-xs font-medium text-muted">{children}</label>
      {hint && <p className="text-[11px] text-muted/60 mt-0.5">{hint}</p>}
    </div>
  );
}

function Field({ children }: { children: React.ReactNode }) {
  return <div className="space-y-1">{children}</div>;
}

function Input({ value, onChange, type = "text", placeholder, ...rest }: {
  value: string | number;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="input-field"
      placeholder={placeholder}
      {...rest}
    />
  );
}

function Select({ value, onChange, options }: {
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input-field appearance-none pr-10"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
      <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
    </div>
  );
}

function SectionTitle({ icon: Icon, title }: { icon: React.ElementType; title: string }) {
  return (
    <h3 className="text-sm font-semibold flex items-center gap-2 mb-4 pb-3 border-b border-border">
      <Icon size={16} className="text-accent" />
      {title}
    </h3>
  );
}

function SkeletonField() {
  return (
    <div className="space-y-1.5">
      <div className="skeleton h-3 w-24" />
      <div className="skeleton h-9 w-full" />
    </div>
  );
}

const SettingsPage = () => {
  const [activeTab, setActiveTab] = useState<Tab>("general");
  const [form, setForm] = useState<Record<string, any>>({ ...defaults });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getSettings()
      .then((data) => setForm({ ...defaults, ...data }))
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  const set = (key: string, value: any) => setForm((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    setSaving(true);
    try {
      await updateSettings(form);
      toast.success("Settings saved successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm({ ...defaults });
    toast.info("Settings reset to defaults");
  };

  const tabContent = (tab: Tab) => {
    switch (tab) {
      case "general":
        return (
          <div className="space-y-5">
            <SectionTitle icon={Globe} title="General Configuration" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>Language</Label>
                <Select
                  value={form.language || "en"}
                  onChange={(v) => set("language", v)}
                  options={[
                    { value: "en", label: "English" },
                    { value: "es", label: "Spanish" },
                    { value: "fr", label: "French" },
                    { value: "de", label: "German" },
                    { value: "pt", label: "Portuguese" },
                    { value: "ja", label: "Japanese" },
                    { value: "zh", label: "Chinese" },
                    { value: "auto", label: "Auto Detect" },
                  ]}
                />
              </Field>
              <Field>
                <Label>Target Audience</Label>
                <Input
                  value={form.target_audience || ""}
                  onChange={(v) => set("target_audience", v)}
                  placeholder="e.g., general, tech enthusiasts"
                />
              </Field>
              <Field>
                <Label>Default Duration</Label>
                <Select
                  value={form.default_duration || "medium"}
                  onChange={(v) => set("default_duration", v)}
                  options={[
                    { value: "short", label: "Short (30s)" },
                    { value: "medium", label: "Medium (1-3 min)" },
                    { value: "long", label: "Long (3-5 min)" },
                  ]}
                />
              </Field>
              <Field>
                <Label>Default Voice Style</Label>
                <Select
                  value={form.default_voice_style || "neutral"}
                  onChange={(v) => set("default_voice_style", v)}
                  options={[
                    { value: "neutral", label: "Neutral" },
                    { value: "energetic", label: "Energetic" },
                    { value: "calm", label: "Calm" },
                    { value: "dramatic", label: "Dramatic" },
                    { value: "friendly", label: "Friendly" },
                  ]}
                />
              </Field>
              <Field>
                <Label>Default Story Style</Label>
                <Select
                  value={form.default_story_style || "narrative"}
                  onChange={(v) => set("default_story_style", v)}
                  options={[
                    { value: "narrative", label: "Narrative" },
                    { value: "educational", label: "Educational" },
                    { value: "entertainment", label: "Entertainment" },
                    { value: "documentary", label: "Documentary" },
                    { value: "vlog", label: "Vlog Style" },
                  ]}
                />
              </Field>
            </div>
          </div>
        );

      case "image":
        return (
          <div className="space-y-5">
            <SectionTitle icon={Image} title="Image Generation" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>Pollinations Endpoint</Label>
                <Input
                  value={form.pollinations_endpoint || ""}
                  onChange={(v) => set("pollinations_endpoint", v)}
                  placeholder="https://image.pollinations.ai/prompt/"
                />
              </Field>
              <Field>
                <Label>Puter Endpoint</Label>
                <Input
                  value={form.puter_endpoint || ""}
                  onChange={(v) => set("puter_endpoint", v)}
                  placeholder="https://api.puter.com/v1/images"
                />
              </Field>
              <Field>
                <Label hint="Seconds between retry attempts">Retry Delay</Label>
                <Input
                  type="number"
                  value={form.retry_delay ?? 60}
                  onChange={(v) => set("retry_delay", Number(v))}
                  min={1}
                />
              </Field>
              <Field>
                <Label>Max Retries</Label>
                <Input
                  type="number"
                  value={form.max_retries ?? 3}
                  onChange={(v) => set("max_retries", Number(v))}
                  min={0}
                />
              </Field>
              <Field>
                <Label>Image Width</Label>
                <Input
                  type="number"
                  value={form.image_width ?? 1920}
                  onChange={(v) => set("image_width", Number(v))}
                  min={256}
                  max={4096}
                />
              </Field>
              <Field>
                <Label>Image Height</Label>
                <Input
                  type="number"
                  value={form.image_height ?? 1080}
                  onChange={(v) => set("image_height", Number(v))}
                  min={256}
                  max={4096}
                />
              </Field>
              <Field>
                <Label>Provider Priority</Label>
                <Select
                  value={form.provider_priority || "pollinations_first"}
                  onChange={(v) => set("provider_priority", v)}
                  options={[
                    { value: "pollinations_first", label: "Pollinations First" },
                    { value: "puter_first", label: "Puter First" },
                  ]}
                />
              </Field>
            </div>
          </div>
        );

      case "voice":
        return (
          <div className="space-y-5">
            <SectionTitle icon={Volume2} title="Voice Generation" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>Piper Executable Path</Label>
                <Input
                  value={form.piper_executable_path || ""}
                  onChange={(v) => set("piper_executable_path", v)}
                  placeholder="/usr/bin/piper"
                />
              </Field>
              <Field>
                <Label>Piper Voice Model</Label>
                <Input
                  value={form.piper_voice_model || ""}
                  onChange={(v) => set("piper_voice_model", v)}
                  placeholder="en_US-less-medium"
                />
              </Field>
              <Field>
                <Label>Whisper Executable Path</Label>
                <Input
                  value={form.whisper_executable_path || ""}
                  onChange={(v) => set("whisper_executable_path", v)}
                  placeholder="/usr/bin/whisper"
                />
              </Field>
              <Field>
                <Label>Whisper Model</Label>
                <Select
                  value={form.whisper_model || "base"}
                  onChange={(v) => set("whisper_model", v)}
                  options={[
                    { value: "tiny", label: "Tiny (fastest)" },
                    { value: "base", label: "Base" },
                    { value: "small", label: "Small" },
                    { value: "medium", label: "Medium" },
                    { value: "large", label: "Large (best)" },
                  ]}
                />
              </Field>
            </div>

            <SectionTitle icon={BookOpen} title="Subtitles" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>Subtitle Font</Label>
                <Input
                  value={form.subtitle_font || "Arial"}
                  onChange={(v) => set("subtitle_font", v)}
                  placeholder="Arial"
                />
              </Field>
              <Field>
                <Label>Subtitle Style</Label>
                <Select
                  value={form.subtitle_style || "classic"}
                  onChange={(v) => set("subtitle_style", v)}
                  options={[
                    { value: "classic", label: "Classic" },
                    { value: "modern", label: "Modern" },
                    { value: "minimal", label: "Minimal" },
                    { value: "neon", label: "Neon" },
                    { value: "cinematic", label: "Cinematic" },
                  ]}
                />
              </Field>
            </div>
          </div>
        );

      case "video":
        return (
          <div className="space-y-5">
            <SectionTitle icon={Video} title="Video Output" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>FFmpeg Path</Label>
                <Input
                  value={form.ffmpeg_path || "ffmpeg"}
                  onChange={(v) => set("ffmpeg_path", v)}
                  placeholder="ffmpeg"
                />
              </Field>
              <Field>
                <Label>Output Width</Label>
                <Input
                  type="number"
                  value={form.output_width ?? 1920}
                  onChange={(v) => set("output_width", Number(v))}
                  min={320}
                  max={7680}
                />
              </Field>
              <Field>
                <Label>Output Height</Label>
                <Input
                  type="number"
                  value={form.output_height ?? 1080}
                  onChange={(v) => set("output_height", Number(v))}
                  min={240}
                  max={4320}
                />
              </Field>
              <Field>
                <Label>FPS</Label>
                <Input
                  type="number"
                  value={form.fps ?? 30}
                  onChange={(v) => set("fps", Number(v))}
                  min={12}
                  max={120}
                />
              </Field>
              <Field>
                <Label>Codec</Label>
                <Select
                  value={form.codec || "h264"}
                  onChange={(v) => set("codec", v)}
                  options={[
                    { value: "h264", label: "H.264" },
                    { value: "h265", label: "H.265 / HEVC" },
                    { value: "vp9", label: "VP9" },
                    { value: "av1", label: "AV1" },
                  ]}
                />
              </Field>
              <Field>
                <Label>Bitrate</Label>
                <Input
                  value={form.bitrate || "8M"}
                  onChange={(v) => set("bitrate", v)}
                  placeholder="8M"
                />
              </Field>
            </div>
          </div>
        );

      case "storage":
        return (
          <div className="space-y-5">
            <SectionTitle icon={FolderOpen} title="Storage Locations" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>Storage Location</Label>
                <Input
                  value={form.storage_location || ""}
                  onChange={(v) => set("storage_location", v)}
                  placeholder="/data/storage"
                />
              </Field>
              <Field>
                <Label>Output Location</Label>
                <Input
                  value={form.output_location || ""}
                  onChange={(v) => set("output_location", v)}
                  placeholder="/data/output"
                />
              </Field>
              <Field>
                <Label>Background Music Folder</Label>
                <Input
                  value={form.background_music_folder || ""}
                  onChange={(v) => set("background_music_folder", v)}
                  placeholder="/data/music"
                />
              </Field>
              <Field>
                <Label>Sound Effects Folder</Label>
                <Input
                  value={form.sound_effects_folder || ""}
                  onChange={(v) => set("sound_effects_folder", v)}
                  placeholder="/data/sfx"
                />
              </Field>
            </div>
          </div>
        );

      case "api":
        return (
          <div className="space-y-5">
            <SectionTitle icon={Key} title="API Credentials" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label>YouTube API Key</Label>
                <Input
                  type="password"
                  value={form.youtube_api_key || ""}
                  onChange={(v) => set("youtube_api_key", v)}
                  placeholder="AIzaSy..."
                />
              </Field>
              <Field>
                <Label>YouTube Client ID</Label>
                <Input
                  value={form.youtube_client_id || ""}
                  onChange={(v) => set("youtube_client_id", v)}
                  placeholder="123456789-xxxx.apps.googleusercontent.com"
                />
              </Field>
              <Field>
                <Label>YouTube Client Secret</Label>
                <Input
                  type="password"
                  value={form.youtube_client_secret || ""}
                  onChange={(v) => set("youtube_client_secret", v)}
                  placeholder="GOCSPX-..."
                />
              </Field>
            </div>
          </div>
        );

      case "advanced":
        return (
          <div className="space-y-5">
            <SectionTitle icon={Sliders} title="Advanced Configuration" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <Field>
                <Label hint={`Current: ${form.worker_count || 3} workers`}>Worker Count</Label>
                <input
                  type="range"
                  min={1}
                  max={16}
                  value={form.worker_count ?? 3}
                  onChange={(e) => set("worker_count", Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[11px] text-muted">
                  <span>1</span>
                  <span className="tabular-nums">{form.worker_count ?? 3}</span>
                  <span>16</span>
                </div>
              </Field>
              <Field>
                <Label>Thread Count</Label>
                <Input
                  type="number"
                  value={form.thread_count ?? 4}
                  onChange={(v) => set("thread_count", Number(v))}
                  min={1}
                  max={64}
                />
              </Field>
              <Field>
                <Label hint="Seconds before a request times out">Request Timeout</Label>
                <Input
                  type="number"
                  value={form.request_timeout ?? 30}
                  onChange={(v) => set("request_timeout", Number(v))}
                  min={5}
                  max={300}
                />
              </Field>
              <Field>
                <Label>Log Level</Label>
                <Select
                  value={form.log_level || "info"}
                  onChange={(v) => set("log_level", v)}
                  options={[
                    { value: "debug", label: "Debug" },
                    { value: "info", label: "Info" },
                    { value: "warning", label: "Warning" },
                    { value: "error", label: "Error" },
                    { value: "critical", label: "Critical" },
                  ]}
                />
              </Field>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col flex-grow p-6 lg:p-8 bg-background text-foreground overflow-y-auto">
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-8">
          <div className="skeleton h-7 w-32 mb-2" />
          <div className="skeleton h-4 w-64" />
        </motion.div>
        <div className="flex gap-2 mb-8">
          {tabs.map((t, i) => (
            <div key={i} className="skeleton h-9 w-28 rounded-lg" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {Array.from({ length: 6 }).map((_, i) => (
            <SkeletonField key={i} />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col flex-grow p-6 lg:p-8 bg-background text-foreground overflow-y-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
        <p className="text-sm text-muted mt-1">Configure your AI YouTube Factory pipeline.</p>
      </motion.div>

      <div className="flex gap-1.5 overflow-x-auto pb-2 mb-6 -mx-1 px-1 scrollbar-none">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 ${
                active
                  ? "bg-accent text-white shadow-lg shadow-accent/20"
                  : "text-muted hover:text-foreground hover:bg-card border border-transparent"
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className="flex-1"
      >
        <div className="card p-6 mb-6">
          {tabContent(activeTab)}
        </div>

        <div className="flex items-center gap-3 pb-8">
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn-primary flex items-center gap-2 text-sm"
          >
            {saving ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Save size={15} />
            )}
            {saving ? "Saving..." : "Save Settings"}
          </button>
          <button
            onClick={handleReset}
            className="btn-ghost flex items-center gap-2 text-sm border border-border"
          >
            <RotateCcw size={15} />
            Reset to Defaults
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default SettingsPage;
