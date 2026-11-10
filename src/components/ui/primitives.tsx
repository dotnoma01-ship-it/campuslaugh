import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef, useState } from "react";
import { cn, gradientFor, initials } from "@/utils/format";

/* ------------------------------------------------------------------ */
/*  Motion presets shared by the whole design system                    */
/* ------------------------------------------------------------------ */

export const spring = { type: "spring", stiffness: 420, damping: 34, mass: 0.9 } as const;
export const springSoft = { type: "spring", stiffness: 260, damping: 30 } as const;
export const springSnappy = { type: "spring", stiffness: 620, damping: 38, mass: 0.7 } as const;

/* ------------------------------------------------------------------ */
/*  Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = "brand" | "glass" | "ghost" | "outline" | "danger" | "solid";
type Size = "xs" | "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  brand:
    "bg-brand text-onbrand border border-transparent shadow-[0_10px_30px_-12px_rgba(183,243,74,0.75),inset_0_1px_0_rgba(255,255,255,0.5)] hover:brightness-105",
  solid: "bg-surface text-ink border border-line hover:border-line2",
  glass: "glass text-ink hover:bg-glass2",
  ghost: "text-ink2 hover:text-ink hover:bg-ink/8",
  outline: "border border-line2 text-ink hover:bg-ink/6",
  danger: "bg-coral/14 text-coral border border-coral/30 hover:bg-coral/22",
};

const sizes: Record<Size, string> = {
  xs: "h-7 px-2.5 text-[12px] rounded-full gap-1",
  sm: "h-9 px-3.5 text-[13px] rounded-full gap-1.5",
  md: "h-11 px-5 text-sm rounded-full gap-2",
  lg: "h-13 px-6 text-[15px] rounded-2xl gap-2 py-3.5",
};

export interface ButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: React.ReactNode;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  icon?: React.ReactNode;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "glass", size = "md", loading, icon, block, className, children, disabled, ...rest },
  ref,
) {
  return (
    <motion.button
      ref={ref}
      whileHover={disabled || loading ? undefined : { y: -1 }}
      whileTap={disabled || loading ? undefined : { scale: 0.955 }}
      transition={springSnappy}
      disabled={disabled || loading}
      className={cn(
        "press relative inline-flex select-none items-center justify-center font-semibold tracking-[-0.01em]",
        "disabled:pointer-events-none disabled:opacity-45",
        variants[variant],
        sizes[size],
        block && "w-full",
        className,
      )}
      {...rest}
    >
      {loading ? <Spinner className="h-4 w-4" /> : icon}
      {children}
    </motion.button>
  );
});

export interface IconButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: React.ReactNode;
  label: string;
  active?: boolean;
  tone?: "default" | "brand" | "danger";
  size?: "sm" | "md" | "lg";
  badge?: number;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(function IconButton(
  { label, active, tone = "default", size = "md", badge, className, children, ...rest },
  ref,
) {
  const dims = size === "sm" ? "h-8 w-8 rounded-xl" : size === "lg" ? "h-12 w-12 rounded-2xl" : "h-10 w-10 rounded-xl";
  return (
    <motion.button
      ref={ref}
      whileTap={{ scale: 0.88 }}
      whileHover={{ scale: 1.06 }}
      transition={springSnappy}
      aria-label={label}
      title={label}
      className={cn(
        "press relative inline-grid place-items-center border",
        dims,
        active
          ? "border-brand/40 bg-brand/16 text-brand"
          : tone === "danger"
            ? "border-line text-coral hover:bg-coral/12"
            : "border-line bg-glass text-ink2 hover:bg-glass2 hover:text-ink",
        "backdrop-blur-xl",
        className,
      )}
      {...rest}
    >
      {children}
      {badge ? (
        <span className="absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-brand px-1 text-[10px] font-extrabold text-onbrand shadow-[0_0_0_2px_var(--c-bg)]">
          {badge > 99 ? "99+" : badge}
        </span>
      ) : null}
    </motion.button>
  );
});

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={cn("h-5 w-5 animate-spin", className)} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2.6" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/*  Surfaces                                                            */
/* ------------------------------------------------------------------ */

export function GlassCard({
  className,
  children,
  interactive,
  ...rest
}: Omit<HTMLMotionProps<"div">, "children"> & { interactive?: boolean; children?: React.ReactNode }) {
  return (
    <motion.div
      whileHover={interactive ? { y: -2 } : undefined}
      transition={springSoft}
      className={cn("glass glass-sheen relative overflow-hidden rounded-3xl", className)}
      {...rest}
    >
      {children}
    </motion.div>
  );
}

export function Chip({
  active,
  children,
  className,
  ...rest
}: Omit<HTMLMotionProps<"button">, "children"> & { active?: boolean; children?: React.ReactNode }) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      className={cn(
        "press shrink-0 rounded-full border px-3 py-1.5 text-[12.5px] font-semibold whitespace-nowrap",
        active
          ? "border-brand/45 bg-brand/16 text-brand"
          : "border-line bg-glass text-ink2 hover:text-ink",
        className,
      )}
      {...rest}
    >
      {children}
    </motion.button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: React.ReactNode;
  tone?: "neutral" | "brand" | "mint" | "coral" | "sky";
  className?: string;
}) {
  const tones = {
    neutral: "bg-ink/8 text-ink2 border-line",
    brand: "bg-brand/16 text-brand border-brand/30",
    mint: "bg-mint/14 text-mint border-mint/30",
    coral: "bg-coral/14 text-coral border-coral/30",
    sky: "bg-sky2/14 text-sky2 border-sky2/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("hairline h-px w-full", className)} />;
}

/* ------------------------------------------------------------------ */
/*  Avatar                                                              */
/* ------------------------------------------------------------------ */

export function Avatar({
  src,
  name,
  size = 40,
  online,
  ring,
  className,
  anonymous,
}: {
  src?: string;
  name: string;
  size?: number;
  online?: boolean;
  ring?: boolean;
  className?: string;
  anonymous?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const showImage = src && !broken;
  return (
    <span className={cn("relative inline-block shrink-0", className)} style={{ width: size, height: size }}>
      <span
        className={cn(
          "grid h-full w-full place-items-center overflow-hidden rounded-full",
          ring && "ring-2 ring-brand/70 ring-offset-2 ring-offset-[var(--c-bg)]",
        )}
        style={showImage ? undefined : { background: gradientFor(name) }}
      >
        {showImage ? (
          <img
            src={src}
            alt={name}
            loading="lazy"
            decoding="async"
            onError={() => setBroken(true)}
            className="h-full w-full object-cover"
            style={{ width: size, height: size }}
          />
        ) : (
          <span
            className="font-extrabold text-white/95"
            style={{ fontSize: Math.max(10, size * 0.36), fontFamily: "var(--font-display)" }}
          >
            {anonymous ? "👤" : initials(name)}
          </span>
        )}
      </span>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[var(--c-bg)] bg-mint"
          style={{ width: Math.max(8, size * 0.26), height: Math.max(8, size * 0.26) }}
        />
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Inputs                                                              */
/* ------------------------------------------------------------------ */

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "field h-11 w-full rounded-2xl px-4 text-sm outline-none placeholder:text-ink3",
          className,
        )}
        {...rest}
      />
    );
  },
);

export const TextArea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function TextArea({ className, ...rest }, ref) {
    return (
      <textarea
        ref={ref}
        className={cn(
          "field w-full resize-none rounded-2xl px-4 py-3 text-sm leading-relaxed outline-none placeholder:text-ink3",
          className,
        )}
        {...rest}
      />
    );
  },
);

export function SearchField({
  value,
  onChange,
  placeholder = "Search",
  autoFocus,
  onFocus,
  className,
  leading,
  inputRef,
  onEnter,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  onFocus?: () => void;
  className?: string;
  leading?: React.ReactNode;
  inputRef?: React.RefObject<HTMLInputElement | null>;
  onEnter?: () => void;
}) {
  return (
    <div className={cn("field flex h-11 items-center gap-2 rounded-2xl px-3", className)}>
      <span className="text-ink3">{leading}</span>
      <input
        ref={inputRef}
        value={value}
        autoFocus={autoFocus}
        onFocus={onFocus}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && onEnter?.()}
        placeholder={placeholder}
        aria-label={placeholder}
        className="h-full w-full bg-transparent text-sm outline-none placeholder:text-ink3"
      />
      {value && (
        <motion.button
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          whileTap={{ scale: 0.85 }}
          onClick={() => onChange("")}
          aria-label="Clear search"
          className="grid h-6 w-6 place-items-center rounded-full bg-ink/12 text-ink2 hover:bg-ink/20"
        >
          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </motion.button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Switch                                                              */
/* ------------------------------------------------------------------ */

export function Switch({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
  disabled?: boolean;
}) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={cn(
        "relative h-[30px] w-[52px] shrink-0 rounded-full border transition-colors duration-300 disabled:opacity-40",
        checked ? "border-brand/50 bg-brand" : "border-line bg-ink/12",
      )}
    >
      <motion.span
        layout
        transition={springSnappy}
        className={cn(
          "absolute top-1/2 h-[24px] w-[24px] -translate-y-1/2 rounded-full shadow-md",
          checked ? "left-[25px] bg-onbrand" : "left-[3px] bg-white",
        )}
        style={{ boxShadow: "0 2px 8px rgba(0,0,0,.28), inset 0 1px 0 rgba(255,255,255,.6)" }}
      />
    </button>
  );
}

/* ------------------------------------------------------------------ */
/*  Segmented control                                                   */
/* ------------------------------------------------------------------ */

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
  size = "md",
}: {
  options: { value: T; label: string; icon?: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: "sm" | "md";
}) {
  return (
    <div className={cn("glass relative flex rounded-full p-1", className)} role="tablist">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={cn(
              "relative z-10 flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold transition-colors",
              size === "sm" ? "h-7 px-2.5 text-[12px]" : "h-9 px-3 text-[13px]",
              active ? "text-onbrand" : "text-ink2 hover:text-ink",
            )}
          >
            {active && (
              <motion.span
                layoutId={`seg-${options.map((x) => x.value).join("")}`}
                transition={spring}
                className="absolute inset-0 -z-10 rounded-full bg-brand shadow-[0_6px_18px_-8px_rgba(183,243,74,.9)]"
              />
            )}
            {o.icon}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Feed states                                                         */
/* ------------------------------------------------------------------ */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton rounded-xl", className)} />;
}

export function PostSkeleton() {
  return (
    <div className="glass rounded-3xl p-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-11 w-11 rounded-full" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-20" />
        </div>
        <Skeleton className="h-7 w-7 rounded-full" />
      </div>
      <div className="mt-4 space-y-2">
        <Skeleton className="h-3 w-full" />
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-2/3" />
      </div>
      <Skeleton className="mt-4 h-52 w-full rounded-2xl" />
      <div className="mt-4 flex gap-4">
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
        <Skeleton className="h-4 w-14" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={springSoft}
      className={cn("glass flex flex-col items-center gap-3 rounded-3xl px-6 py-12 text-center", className)}
    >
      {icon && <div className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/14 text-brand">{icon}</div>}
      <h3 className="text-lg font-bold text-ink">{title}</h3>
      {body && <p className="max-w-sm text-sm leading-relaxed text-ink2">{body}</p>}
      {action}
    </motion.div>
  );
}

export function ProgressBar({ value, className }: { value: number; className?: string }) {
  return (
    <div className={cn("h-1 w-full overflow-hidden rounded-full bg-ink/12", className)}>
      <motion.div
        className="h-full rounded-full bg-brand"
        initial={{ width: 0 }}
        animate={{ width: `${Math.min(100, Math.max(0, value * 100))}%` }}
        transition={{ ease: "linear", duration: 0.1 }}
      />
    </div>
  );
}
