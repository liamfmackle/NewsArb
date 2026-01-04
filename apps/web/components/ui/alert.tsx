import * as React from "react";
import { cn } from "@/lib/utils";
import { AlertCircle, CheckCircle, AlertTriangle, Info } from "lucide-react";

const alertVariants = {
  error: {
    container: "border-red-500/30 bg-red-500/10",
    icon: "text-red-400",
    text: "text-red-400",
  },
  success: {
    container: "border-green-500/30 bg-green-500/10",
    icon: "text-green-400",
    text: "text-green-400",
  },
  warning: {
    container: "border-yellow-500/30 bg-yellow-500/10",
    icon: "text-yellow-400",
    text: "text-yellow-400",
  },
  info: {
    container: "border-[var(--gold)]/30 bg-[var(--gold)]/10",
    icon: "text-[var(--gold)]",
    text: "text-[var(--gold)]",
  },
};

const alertIcons = {
  error: AlertCircle,
  success: CheckCircle,
  warning: AlertTriangle,
  info: Info,
};

interface AlertProps {
  variant?: keyof typeof alertVariants;
  children: React.ReactNode;
  className?: string;
  showIcon?: boolean;
}

export function Alert({
  variant = "error",
  children,
  className,
  showIcon = true,
}: AlertProps) {
  const styles = alertVariants[variant];
  const Icon = alertIcons[variant];

  return (
    <div
      className={cn(
        "flex items-start gap-2 rounded-md border px-3 py-2 text-sm",
        styles.container,
        className
      )}
      role="alert"
    >
      {showIcon && <Icon className={cn("h-4 w-4 mt-0.5 flex-shrink-0", styles.icon)} />}
      <span className={styles.text}>{children}</span>
    </div>
  );
}

// Simple inline error for forms (no border/background)
export function FormError({ children, className }: { children: React.ReactNode; className?: string }) {
  if (!children) return null;
  return (
    <p className={cn("text-sm text-red-400 flex items-center gap-1", className)}>
      <AlertCircle className="h-3 w-3" />
      {children}
    </p>
  );
}
