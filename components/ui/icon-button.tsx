"use client";

import { cn } from "@/lib/utils";

export function IconButton({
  label,
  onClick,
  children,
  className
}: {
  label: string;
  onClick?: () => void;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "inline-flex h-9 w-9 items-center justify-center rounded-full",
        "bg-black/50 text-zinc-200 ring-1 ring-zinc-800/80 backdrop-blur",
        className
      )}
    >
      {children}
    </button>
  );
}

