import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../lib/cn";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "primary", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition",
        "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-brand-200",
        "disabled:cursor-not-allowed disabled:opacity-50",
        size === "sm" && "min-h-9 rounded-lg px-3 text-sm",
        variant === "primary" && "bg-brand-600 text-white shadow-sm hover:bg-brand-700",
        variant === "secondary" && "border border-slate-200 bg-white text-ink-900 hover:bg-slate-50",
        variant === "ghost" && "text-ink-700 hover:bg-slate-100",
        variant === "danger" && "bg-danger-600 text-white hover:bg-danger-700",
        className,
      )}
      {...props}
    />
  ),
);

Button.displayName = "Button";
