"use client";
import { useEffect, useState } from "react";
import { X } from "lucide-react";

let addToastFn: (msg: string, type: "success" | "error" | "info") => void = () => {};

export const toast = {
  success: (msg: string) => addToastFn(msg, "success"),
  error: (msg: string) => addToastFn(msg, "error"),
  info: (msg: string) => addToastFn(msg, "info"),
};

export function Toaster() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: string }[]>([]);
  useEffect(() => {
    addToastFn = (msg, type) => {
      const id = Date.now();
      setToasts((prev) => [...prev, { id, msg, type }]);
      setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
    };
  }, []);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`glass rounded-lg px-4 py-3 text-sm flex items-center gap-3 min-w-[300px] animate-slide-up ${
            t.type === "error" ? "border-red-500/30" : t.type === "success" ? "border-green-500/30" : "border-blue-500/30"
          }`}
        >
          <span className="flex-1">{t.msg}</span>
          <button onClick={() => setToasts((prev) => prev.filter((x) => x.id !== t.id))} className="text-muted hover:text-foreground">
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
