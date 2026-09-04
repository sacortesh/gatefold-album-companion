import type { ButtonHTMLAttributes } from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/cn";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-bg disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        primary: "bg-primary text-primary-ink hover:bg-primary/90",
        secondary: "border border-border text-ink hover:bg-surface-2",
        ghost: "text-ink-muted hover:bg-surface-2 hover:text-ink",
        danger: "bg-danger text-ink hover:bg-danger/90",
      },
      // Fitts's Law floor: 44px is the mobile-touch-target guideline, but a
      // dense list of text-labeled buttons doesn't need every row at 44px
      // (width plus a text label already lowers the precision cost) — icon
      // and lg get the full 44px+ since those are the cases where a small,
      // imprecise target actually hurts (single icon glyph, primary CTA).
      size: {
        sm: "h-9 px-3 text-xs",
        md: "h-10 px-4",
        lg: "h-12 px-5",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "secondary",
      size: "md",
    },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  /** Render the child element (e.g. a router `Link`) styled as this button,
   * instead of a `<button>` wrapping it — avoids nesting interactive
   * elements. */
  asChild?: boolean;
}

// React 19: ref is a plain prop, no forwardRef needed.
export function Button({
  className,
  variant,
  size,
  type = "button",
  asChild,
  ref,
  ...props
}: ButtonProps & { ref?: React.Ref<HTMLButtonElement> }) {
  if (asChild) {
    return (
      <Slot
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
  return (
    <button
      ref={ref}
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
