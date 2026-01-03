import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap text-sm font-medium tracking-wide transition-all duration-200 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-40",
  {
    variants: {
      variant: {
        default:
          "bg-[var(--gold)] text-[var(--background)] hover:bg-[var(--gold-dim)] hover:shadow-glow-sm focus-gold",
        destructive:
          "bg-destructive text-white hover:bg-destructive/90",
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--gold)] hover:text-[var(--gold)]",
        secondary:
          "bg-[var(--surface-secondary)] text-[var(--foreground)] hover:bg-[var(--surface-tertiary)]",
        ghost:
          "bg-transparent text-[var(--muted)] hover:text-[var(--foreground)] hover:bg-[var(--surface-secondary)]",
        link:
          "text-[var(--gold)] underline-offset-4 hover:underline bg-transparent",
        gold:
          "bg-transparent border border-[var(--gold)] text-[var(--gold)] hover:bg-[var(--gold)] hover:text-[var(--background)] glow-gold-sm",
      },
      size: {
        default: "h-10 px-5 py-2",
        sm: "h-8 px-3 text-xs",
        lg: "h-12 px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
