"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export type ToastType = "error" | "success" | "info";

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose?: () => void;
}

const STYLES: Record<ToastType, string> = {
  error: "bg-red-600/95 text-white ring-2 ring-red-500/50",
  success: "bg-emerald-600/95 text-white ring-2 ring-emerald-500/50",
  info: "bg-blue-600/95 text-white ring-2 ring-blue-500/50"
};

function ToastInner({ message, type = "error", duration = 3000, onClose }: ToastProps) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => {
      setVisible(false);
      onClose?.();
    }, duration);
    return () => clearTimeout(t);
  }, [duration, onClose]);

  if (!visible) return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 z-[9999] -translate-x-1/2 rounded-xl px-6 py-3 text-sm font-semibold shadow-xl backdrop-blur",
        STYLES[type]
      )}
      role="alert"
    >
      {message}
    </div>
  );
}

interface ToastState {
  message: string;
  type: ToastType;
}

let listeners: Array<(s: ToastState | null) => void> = [];
let state: ToastState | null = null;

function setState(s: ToastState | null) {
  state = s;
  listeners.forEach((fn) => fn(s));
}

export function showToast(message: string, type: ToastType = "error") {
  setState({ message, type });
}

export function ToastProvider() {
  const [toast, setToast] = useState<ToastState | null>(null);

  useEffect(() => {
    listeners.push(setToast);
    if (state) setToast(state);
    return () => {
      listeners = listeners.filter((l) => l !== setToast);
    };
  }, []);

  if (!toast) return null;

  return createPortal(
    <ToastInner
      message={toast.message}
      type={toast.type}
      onClose={() => setState(null)}
    />,
    document.body
  );
}
