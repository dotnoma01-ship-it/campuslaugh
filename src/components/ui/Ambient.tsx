import { motion, useReducedMotion } from "framer-motion";

/**
 * Layered ambient wallpaper: slow-moving light fields, a fine grain and a
 * faint dot matrix. It gives the frosted glass something real to refract.
 */
export function AmbientBackdrop() {
  const reduce = useReducedMotion();
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-bg">
      {/* base wash */}
      <div className="absolute inset-0 bg-[radial-gradient(120%_80%_at_50%_-10%,var(--c-surface-2),transparent_60%)]" />

      {/* light fields */}
      <motion.div
        animate={reduce ? undefined : { x: [0, 40, -20, 0], y: [0, -30, 20, 0] }}
        transition={{ duration: 38, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -left-[18%] -top-[22%] h-[62vw] w-[62vw] min-h-[420px] min-w-[420px] rounded-full opacity-90 blur-[90px]"
        style={{ background: "radial-gradient(circle at 40% 40%, var(--mesh-1), transparent 66%)" }}
      />
      <motion.div
        animate={reduce ? undefined : { x: [0, -50, 20, 0], y: [0, 40, -10, 0] }}
        transition={{ duration: 46, repeat: Infinity, ease: "easeInOut" }}
        className="absolute -right-[16%] top-[6%] h-[52vw] w-[52vw] min-h-[360px] min-w-[360px] rounded-full blur-[100px]"
        style={{ background: "radial-gradient(circle at 50% 50%, var(--mesh-2), transparent 68%)" }}
      />
      <motion.div
        animate={reduce ? undefined : { x: [0, 30, -40, 0], y: [0, -20, 30, 0] }}
        transition={{ duration: 54, repeat: Infinity, ease: "easeInOut" }}
        className="absolute bottom-[-24%] left-[22%] h-[58vw] w-[58vw] min-h-[380px] min-w-[380px] rounded-full blur-[110px]"
        style={{ background: "radial-gradient(circle at 50% 50%, var(--mesh-3), transparent 70%)" }}
      />
      <div
        className="absolute bottom-[8%] right-[12%] h-[34vw] w-[34vw] min-h-[260px] min-w-[260px] rounded-full blur-[95px]"
        style={{ background: "radial-gradient(circle at 50% 50%, var(--mesh-4), transparent 70%)" }}
      />

      {/* dot matrix */}
      <div
        className="absolute inset-0 opacity-[0.16] dark:opacity-[0.12]"
        style={{
          backgroundImage: "radial-gradient(currentColor 0.6px, transparent 0.6px)",
          backgroundSize: "26px 26px",
          color: "var(--c-text)",
          maskImage: "radial-gradient(90% 60% at 50% 0%, #000 20%, transparent 78%)",
          WebkitMaskImage: "radial-gradient(90% 60% at 50% 0%, #000 20%, transparent 78%)",
        }}
      />

      {/* travelling specular sweep */}
      {!reduce && (
        <motion.div
          initial={{ x: "-40%", opacity: 0 }}
          animate={{ x: "140%", opacity: [0, 0.5, 0] }}
          transition={{ duration: 16, repeat: Infinity, repeatDelay: 9, ease: "easeInOut" }}
          className="absolute top-0 h-full w-[22vw] skew-x-[-14deg] blur-3xl"
          style={{
            background:
              "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)",
          }}
        />
      )}

      {/* grain */}
      <div className="grain absolute inset-0 opacity-[0.22] mix-blend-overlay dark:opacity-[0.16]" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-bg to-transparent" />
    </div>
  );
}
