import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useSystem } from "@/context/SystemContext";
import { useBodyScrollLock, useEscape, useMediaQuery, useOnClickOutside } from "@/hooks";
import type { SheetAction } from "@/types";
import { cn } from "@/utils/format";
import { Button, Divider, IconButton, spring, springSoft } from "./primitives";
import { X } from "lucide-react";

/* ------------------------------------------------------------------ */

export function Portal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}

export function Scrim({
  show,
  onClose,
  blur = true,
  zIndex = 60,
}: {
  show: boolean;
  onClose?: () => void;
  blur?: boolean;
  zIndex?: number;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="scrim"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          onClick={onClose}
          style={{ zIndex, backdropFilter: blur ? "blur(18px) saturate(120%)" : undefined }}
          className="fixed inset-0 bg-[#04050700] supports-[backdrop-filter]:bg-black/38 [-webkit-backdrop-filter:blur(18px)] dark:bg-black/55 bg-black/28"
        />
      )}
    </AnimatePresence>
  );
}

/* ------------------------------ Modal ------------------------------ */

export function Modal({
  open,
  onClose,
  children,
  title,
  subtitle,
  footer,
  width = "max-w-lg",
  dismissable = true,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  title?: string;
  subtitle?: string;
  footer?: React.ReactNode;
  width?: string;
  dismissable?: boolean;
}) {
  const reduce = useReducedMotion();
  useBodyScrollLock(open);
  useEscape(onClose, open && dismissable);

  return (
    <Portal>
      <Scrim show={open} onClose={dismissable ? onClose : undefined} zIndex={70} />
      <AnimatePresence>
        {open && (
          <div className="pointer-events-none fixed inset-0 z-[71] grid place-items-center p-4">
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label={title}
              initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.9, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 12 }}
              transition={springSoft}
              drag={dismissable && !reduce ? "y" : false}
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.05, bottom: 0.6 }}
              onDragEnd={(_, info) => {
                if (dismissable && (info.offset.y > 140 || info.velocity.y > 700)) onClose();
              }}
              className={cn(
                "glass-solid pointer-events-auto w-full overflow-hidden rounded-[28px]",
                width,
              )}
            >
              {(title || dismissable) && (
                <div className="flex items-start gap-3 px-5 pb-3 pt-5">
                  <div className="min-w-0 flex-1">
                    {title && <h2 className="truncate text-[17px] font-extrabold text-ink">{title}</h2>}
                    {subtitle && <p className="mt-0.5 text-[13px] leading-snug text-ink2">{subtitle}</p>}
                  </div>
                  {dismissable && (
                    <IconButton label="Close" size="sm" onClick={onClose}>
                      <X className="h-4 w-4" />
                    </IconButton>
                  )}
                </div>
              )}
              <div className="max-h-[70vh] overflow-y-auto thin-scrollbar px-5 pb-5">{children}</div>
              {footer && <div className="border-t border-line px-5 py-4">{footer}</div>}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/* --------------------------- BottomSheet --------------------------- */

/**
 * Mobile-first sheet that slides up from the bottom with drag-to-dismiss.
 * On desktop (`lg:`) it becomes a docked side panel unless `desktop="center"`.
 */
export function BottomSheet({
  open,
  onClose,
  children,
  title,
  desktop = "panel",
  grabber = true,
  footer,
  className,
}: {
  open: boolean;
  onClose: () => void;
  children?: React.ReactNode;
  title?: React.ReactNode;
  desktop?: "panel" | "center";
  grabber?: boolean;
  footer?: React.ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const isDesktop = useMediaQuery("(min-width: 1024px)");
  useBodyScrollLock(open);
  useEscape(onClose, open);

  const asPanel = isDesktop && desktop === "panel";

  return (
    <Portal>
      <Scrim show={open} onClose={onClose} zIndex={70} />
      <AnimatePresence>
        {open && (
          <motion.div
            key="sheet"
            role="dialog"
            aria-modal="true"
            initial={
              reduce
                ? { opacity: 0 }
                : asPanel
                  ? { opacity: 0, x: 60, scale: 0.98 }
                  : { opacity: 0, y: "100%", scale: 0.98 }
            }
            animate={{ opacity: 1, x: 0, y: 0, scale: 1 }}
            exit={
              reduce
                ? { opacity: 0 }
                : asPanel
                  ? { opacity: 0, x: 40, scale: 0.98 }
                  : { opacity: 0, y: "100%", scale: 0.98 }
            }
            transition={asPanel ? springSoft : spring}
            drag={asPanel || reduce ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.55 }}
            onDragEnd={(_, info) => {
              if (!asPanel && (info.offset.y > 120 || info.velocity.y > 650)) onClose();
            }}
            className={cn(
              "glass-solid fixed z-[71] flex flex-col overflow-hidden",
              asPanel
                ? "right-4 top-1/2 max-h-[82vh] w-[420px] -translate-y-1/2 rounded-[28px]"
                : desktop === "center" && isDesktop
                  ? "left-1/2 top-1/2 max-h-[82vh] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-[28px]"
                  : "inset-x-0 bottom-0 max-h-[88vh] rounded-t-[30px]",
              className,
            )}
            style={!asPanel && desktop !== "center" ? { paddingBottom: "env(safe-area-inset-bottom)" } : undefined}
          >
            {grabber && !asPanel && desktop !== "center" && (
              <div className="flex justify-center pt-2.5">
                <span className="h-1.5 w-10 rounded-full bg-ink/22" />
              </div>
            )}
            {title && (
              <div className="flex items-center gap-3 px-5 pb-2 pt-3">
                <div className="min-w-0 flex-1 text-[16px] font-extrabold text-ink">{title}</div>
                <IconButton label="Close sheet" size="sm" onClick={onClose}>
                  <X className="h-4 w-4" />
                </IconButton>
              </div>
            )}
            <div className="min-h-0 flex-1 overflow-y-auto thin-scrollbar">{children}</div>
            {footer && <div className="shrink-0 border-t border-line px-4 py-3">{footer}</div>}
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/* --------------------------- ActionSheet --------------------------- */

export function ActionSheet({
  open,
  onClose,
  title,
  message,
  actions,
  cancelLabel = "Cancel",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actions: SheetAction[];
  cancelLabel?: string;
}) {
  useEscape(onClose, open);
  return (
    <BottomSheet open={open} onClose={onClose} grabber desktop="center" className="max-h-none">
      <div className="p-4">
        {(title || message) && (
          <div className="px-2 pb-3 text-center">
            {title && <h3 className="text-[15px] font-extrabold text-ink">{title}</h3>}
            {message && <p className="mt-1 text-[13px] leading-relaxed text-ink2">{message}</p>}
          </div>
        )}
        <div className="space-y-1.5">
          {actions.map((a, i) => (
            <motion.button
              key={a.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...springSoft, delay: 0.03 * i }}
              whileTap={{ scale: 0.975 }}
              disabled={a.disabled}
              onClick={() => {
                a.onSelect?.();
                onClose();
              }}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl border px-4 py-3.5 text-left text-[15px] font-semibold disabled:opacity-40",
                a.tone === "danger"
                  ? "border-coral/25 bg-coral/10 text-coral"
                  : a.tone === "brand"
                    ? "border-brand/35 bg-brand/14 text-brand"
                    : "border-line bg-glass text-ink hover:bg-glass2",
              )}
            >
              {a.icon && <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-ink/8">{a.icon}</span>}
              <span className="flex-1">{a.label}</span>
            </motion.button>
          ))}
        </div>
        <button
          onClick={onClose}
          className="press mt-3 w-full rounded-2xl bg-brand py-3.5 text-[15px] font-extrabold text-onbrand"
        >
          {cancelLabel}
        </button>
      </div>
    </BottomSheet>
  );
}

/* --------------------------- ContextMenu --------------------------- */

export interface ContextItem {
  id: string;
  label: string;
  icon?: React.ReactNode;
  tone?: "default" | "danger" | "brand";
  onSelect?: () => void;
  keepOpen?: boolean;
}

export function ContextMenu({
  open,
  onClose,
  x,
  y,
  items,
  header,
}: {
  open: boolean;
  onClose: () => void;
  x: number;
  y: number;
  items: ContextItem[];
  header?: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x, y });
  useOnClickOutside(ref, onClose, open);
  useEscape(onClose, open);

  useLayoutEffect(() => {
    if (!open || !ref.current) return;
    const r = ref.current.getBoundingClientRect();
    const nx = Math.min(Math.max(12, x), window.innerWidth - r.width - 12);
    let ny = y;
    if (y + r.height > window.innerHeight - 12) ny = Math.max(12, y - r.height);
    setPos({ x: nx, y: ny });
  }, [open, x, y, items.length]);

  return (
    <Portal>
      <Scrim show={open} onClose={onClose} blur={false} zIndex={80} />
      <AnimatePresence>
        {open && (
          <motion.div
            ref={ref}
            role="menu"
            initial={{ opacity: 0, scale: 0.9, y: -6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: -4 }}
            transition={spring}
            style={{ left: pos.x, top: pos.y, transformOrigin: "top left" }}
            className="glass-solid fixed z-[81] w-[248px] overflow-hidden rounded-[22px] p-1.5"
          >
            {header && <div className="px-3 pb-2 pt-1.5">{header}</div>}
            {header && <Divider className="mb-1.5" />}
            {items.map((it, i) => (
              <motion.button
                key={it.id}
                role="menuitem"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.02 * i, duration: 0.2 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => {
                  it.onSelect?.();
                  if (!it.keepOpen) onClose();
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[14px] font-semibold",
                  it.tone === "danger"
                    ? "text-coral hover:bg-coral/12"
                    : it.tone === "brand"
                      ? "text-brand hover:bg-brand/12"
                      : "text-ink hover:bg-ink/8",
                )}
              >
                <span className="grid h-5 w-5 place-items-center opacity-85">{it.icon}</span>
                {it.label}
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </Portal>
  );
}

/** Hook: fire a context menu from a pointer/long-press position. */
export function useContextMenu() {
  const [state, setState] = useState<{ open: boolean; x: number; y: number }>({ open: false, x: 0, y: 0 });
  const openAt = useCallback((x: number, y: number) => setState({ open: true, x, y }), []);
  const openFromEvent = useCallback((e: React.MouseEvent | React.PointerEvent | { clientX: number; clientY: number }) => {
    setState({ open: true, x: e.clientX, y: e.clientY });
  }, []);
  const close = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return { ...state, openAt, openFromEvent, close };
}

/* --------------------- System-driven hosts -------------------------- */

export function ConfirmHost() {
  const { confirmState, resolveConfirm } = useSystem();
  const open = !!confirmState;
  return (
    <Modal
      open={open}
      onClose={() => resolveConfirm(false)}
      title={confirmState?.title}
      width="max-w-sm"
      footer={
        <div className="flex gap-2.5">
          <Button variant="outline" block onClick={() => resolveConfirm(false)}>
            {confirmState?.cancelLabel ?? "Cancel"}
          </Button>
          <Button
            variant={confirmState?.tone === "danger" ? "danger" : "brand"}
            block
            onClick={() => resolveConfirm(true)}
          >
            {confirmState?.confirmLabel ?? "Confirm"}
          </Button>
        </div>
      }
    >
      <p className="text-[14px] leading-relaxed text-ink2">{confirmState?.message}</p>
    </Modal>
  );
}

export function ActionSheetHost() {
  const { sheetState, resolveSheet } = useSystem();
  const actions = (sheetState?.actions ?? []).map((a) => ({
    ...a,
    onSelect: () => {
      a.onSelect?.();
      resolveSheet(a.id);
    },
  }));
  return (
    <ActionSheet
      open={!!sheetState}
      onClose={() => resolveSheet(null)}
      title={sheetState?.title}
      message={sheetState?.message}
      actions={actions}
    />
  );
}
