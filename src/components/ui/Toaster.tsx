import { AnimatePresence, motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from "lucide-react";
import { useSystem } from "@/context/SystemContext";
import { cn } from "@/utils/format";
import { Portal } from "./overlays";
import { spring } from "./primitives";

const tones = {
  success: { icon: CheckCircle2, ring: "text-brand", bar: "bg-brand" },
  error: { icon: XCircle, ring: "text-coral", bar: "bg-coral" },
  warning: { icon: AlertTriangle, ring: "text-[#ffcb5c]", bar: "bg-[#ffcb5c]" },
  info: { icon: Info, ring: "text-sky2", bar: "bg-sky2" },
};

export function Toaster() {
  const { toasts, dismissToast } = useSystem();
  return (
    <Portal>
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[95] flex flex-col items-center gap-2 px-4 lg:bottom-6 lg:left-auto lg:right-6 lg:items-end lg:px-0">
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const tone = tones[t.tone ?? "success"];
            const Icon = tone.icon;
            return (
              <motion.div
                key={t.id}
                layout
                initial={{ opacity: 0, y: 28, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 14, scale: 0.92, filter: "blur(6px)" }}
                transition={spring}
                className="pointer-events-auto w-full max-w-sm overflow-hidden"
              >
                <div className="glass-solid relative flex items-start gap-3 rounded-[22px] px-3.5 py-3">
                  <span className={cn("absolute inset-y-0 left-0 w-[3px]", tone.bar)} />
                  <Icon className={cn("mt-0.5 h-[18px] w-[18px] shrink-0", tone.ring)} strokeWidth={2.3} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold leading-tight text-ink">{t.title}</p>
                    {t.description && (
                      <p className="mt-0.5 truncate text-[12.5px] leading-snug text-ink2">{t.description}</p>
                    )}
                  </div>
                  {t.actionLabel && (
                    <button
                      onClick={() => {
                        t.onAction?.();
                        dismissToast(t.id);
                      }}
                      className="press shrink-0 rounded-full bg-brand/16 px-2.5 py-1 text-[12px] font-bold text-brand"
                    >
                      {t.actionLabel}
                    </button>
                  )}
                  <button
                    onClick={() => dismissToast(t.id)}
                    aria-label="Dismiss notification"
                    className="press -mr-1 grid h-6 w-6 shrink-0 place-items-center rounded-full text-ink3 hover:bg-ink/10 hover:text-ink"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </Portal>
  );
}
