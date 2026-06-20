"use client";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Key, Plus, Copy, Eye, EyeOff, Trash2, AlertCircle,
  Loader2, Check, X, Shield,
} from "lucide-react";
import { getSettings, updateSetting } from "@/lib/api";
import { toast } from "@/components/Toaster";

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0 },
};

const maskKey = (key: string): string => {
  if (!key) return "";
  if (key.length <= 8) return "•".repeat(key.length);
  return key.substring(0, 3) + "•".repeat(Math.min(key.length - 6, 16)) + key.substring(key.length - 3);
};

const generateKey = (): string => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let result = "yt-";
  for (let i = 0; i < 40; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
};

const ApiKeysPage = () => {
  const [keys, setKeys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<number>>(new Set());
  const [copiedId, setCopiedId] = useState<number | null>(null);

  const fetchKeys = async () => {
    try {
      const settings = await getSettings();
      const stored = settings?.api_keys || settings?.apiKeys || [];
      if (Array.isArray(stored) && stored.length > 0) {
        setKeys(stored);
      } else {
        const legacy = settings?.api_key || settings?.apiKey;
        if (legacy) {
          setKeys([{ id: 1, name: "Default Key", key: legacy, created_at: settings?.created_at || new Date().toISOString(), active: true }]);
        } else {
          setKeys([]);
        }
      }
    } catch {
      setKeys([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKeys();
  }, []);

  const persistKeys = async (updatedKeys: any[]) => {
    try {
      await updateSetting("api_keys", updatedKeys);
      setKeys(updatedKeys);
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    }
  };

  const handleGenerate = async () => {
    if (!newKeyName.trim()) return;
    setGenerating(true);
    const newKey = {
      id: Date.now(),
      name: newKeyName.trim(),
      key: generateKey(),
      created_at: new Date().toISOString(),
      active: true,
    };
    try {
      const updated = [...keys, newKey];
      await updateSetting("api_keys", updated);
      setKeys(updated);
      setGeneratedKey(newKey.key);
      toast.success("API key generated");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate key");
    } finally {
      setGenerating(false);
    }
  };

  const handleRevoke = async (id: number) => {
    const updated = keys.map((k) => k.id === id ? { ...k, active: false } : k);
    await persistKeys(updated);
    toast.success("Key revoked");
  };

  const handleDelete = async (id: number) => {
    const updated = keys.filter((k) => k.id !== id);
    await persistKeys(updated);
    toast.success("Key deleted");
  };

  const handleCopy = async (key: string, id: number) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopiedId(id);
      toast.success("Copied to clipboard");
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const toggleReveal = (id: number) => {
    setRevealedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const closeModal = () => {
    setShowModal(false);
    setNewKeyName("");
    setGeneratedKey(null);
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
          <h1 className="text-2xl font-semibold tracking-tight">API Management</h1>
          <p className="text-sm text-muted mt-1">Manage API keys for external integrations.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2">
          <Plus size={16} /> Generate New Key
        </button>
      </motion.div>

      <motion.div variants={item} className="flex items-start gap-3 card p-4 border-yellow-500/20 bg-yellow-500/5">
        <Shield size={18} className="text-yellow-400 shrink-0 mt-0.5" />
        <div className="text-sm text-muted">
          <strong className="text-foreground">Security Notice:</strong> API keys grant access to your AI YouTube Factory. Keep them secret and rotate regularly. Never share keys in client-side code or public repositories.
        </div>
      </motion.div>

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="skeleton h-5 w-36" />
                <div className="skeleton h-5 w-20" />
              </div>
              <div className="skeleton h-4 w-72" />
              <div className="skeleton h-4 w-24" />
            </div>
          ))}
        </div>
      ) : keys.length === 0 ? (
        <motion.div variants={item} className="flex flex-col items-center justify-center py-24 text-muted">
          <Key size={48} className="mb-4 opacity-20" />
          <p className="text-lg font-medium">No API keys yet</p>
          <p className="text-sm mt-1">Generate your first API key to integrate with external tools.</p>
          <button onClick={() => setShowModal(true)} className="btn-primary flex items-center gap-2 mt-6">
            <Plus size={16} /> Generate New Key
          </button>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {keys.map((k, i) => (
            <motion.div
              key={k.id}
              variants={item}
              className={`card-hover p-5 ${!k.active ? "opacity-50" : ""}`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <Key size={16} className="text-accent" />
                    <h3 className="font-semibold">{k.name}</h3>
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      k.active !== false
                        ? "bg-green-500/10 text-green-400"
                        : "bg-red-500/10 text-red-400"
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${k.active !== false ? "bg-green-400" : "bg-red-400"}`} />
                      {k.active !== false ? "Active" : "Revoked"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="text-sm font-mono bg-neutral-900 px-2 py-1 rounded border border-border">
                      {revealedIds.has(k.id) ? k.key : maskKey(k.key)}
                    </code>
                    <button onClick={() => toggleReveal(k.id)} className="btn-ghost p-1.5" title={revealedIds.has(k.id) ? "Hide" : "Reveal"}>
                      {revealedIds.has(k.id) ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                    <button onClick={() => handleCopy(k.key, k.id)} className="btn-ghost p-1.5" title="Copy">
                      {copiedId === k.id ? <Check size={14} className="text-green-400" /> : <Copy size={14} />}
                    </button>
                  </div>
                  <p className="text-xs text-muted mt-2">
                    Created {new Date(k.created_at).toLocaleDateString()} {new Date(k.created_at).toLocaleTimeString()}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {k.active !== false && (
                    <button onClick={() => handleRevoke(k.id)} className="btn-ghost p-2 text-xs text-yellow-400 hover:text-yellow-300" title="Revoke">
                      Revoke
                    </button>
                  )}
                  <button onClick={() => handleDelete(k.id)} className="btn-ghost p-2" title="Delete">
                    <Trash2 size={16} className="text-red-400" />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
              onClick={closeModal}
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
                    <Key size={18} className="text-accent" /> {generatedKey ? "Key Generated" : "Generate New API Key"}
                  </h2>
                  <button onClick={closeModal} className="btn-ghost p-1.5">
                    <X size={18} />
                  </button>
                </div>

                {generatedKey ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 text-green-400 text-sm">
                      <Check size={16} /> Key created successfully
                    </div>
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Your API Key</label>
                      <div className="flex items-center gap-2">
                        <code className="flex-1 text-xs font-mono bg-neutral-900 px-3 py-2 rounded border border-border break-all">{generatedKey}</code>
                        <button onClick={() => handleCopy(generatedKey, 0)} className="btn-ghost p-2">
                          {copiedId === 0 ? <Check size={16} className="text-green-400" /> : <Copy size={16} />}
                        </button>
                      </div>
                    </div>
                    <div className="p-3 rounded-lg bg-yellow-500/10 text-yellow-400 text-xs flex items-start gap-2">
                      <AlertCircle size={14} className="shrink-0 mt-0.5" />
                      <span>Make sure to copy your key now. You won&apos;t be able to see it again.</span>
                    </div>
                    <div className="flex justify-end">
                      <button onClick={closeModal} className="btn-primary">Done</button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs text-muted mb-1.5 font-medium">Key Name</label>
                      <input
                        type="text"
                        className="input-field"
                        value={newKeyName}
                        onChange={(e) => setNewKeyName(e.target.value)}
                        placeholder="e.g., Production Integration"
                        autoFocus
                      />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                      <button onClick={closeModal} className="btn-ghost">Cancel</button>
                      <button
                        onClick={handleGenerate}
                        disabled={!newKeyName.trim() || generating}
                        className="btn-primary flex items-center gap-2"
                      >
                        {generating ? <><Loader2 size={16} className="animate-spin" /> Generating&hellip;</> : <><Plus size={16} /> Generate</>}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default ApiKeysPage;
