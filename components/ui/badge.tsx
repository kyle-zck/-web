import { cn } from "@/lib/utils";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "outline" | "pill";
  className?: string;
}

export function Badge({ children, variant = "default", className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium",
        variant === "default" &&
          "bg-brand/15 text-brand-foreground border border-brand/40",
        variant === "outline" &&
          "border border-zinc-700/80 text-zinc-300 bg-black/40",
        variant === "pill" &&
          "bg-zinc-900/80 text-zinc-200 border border-zinc-800/80",
        className
      )}
    >
      {children}
    </span>
  );
}
