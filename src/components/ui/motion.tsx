import { motion, type Variants } from "framer-motion";
import { cn } from "@/utils/format";
import { springSoft } from "@/components/ui/primitives";

/** Shared page-transition choreography used by the router outlet. */
export const pageVariants: Variants = {
  initial: { opacity: 0, y: 14, scale: 0.99, filter: "blur(6px)" },
  enter: {
    opacity: 1,
    y: 0,
    scale: 1,
    filter: "blur(0px)",
    transition: { ...springSoft, staggerChildren: 0.045, delayChildren: 0.03 },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.985,
    filter: "blur(5px)",
    transition: { duration: 0.2, ease: [0.32, 0.72, 0, 1] },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 16 },
  enter: { opacity: 1, y: 0, transition: springSoft },
  exit: { opacity: 0, y: -6 },
};

export function Stagger({
  children,
  className,
  as = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "main";
}) {
  const Tag = motion[as] as typeof motion.div;
  return (
    <Tag variants={pageVariants} initial="initial" animate="enter" className={className}>
      {children}
    </Tag>
  );
}

export function Reveal({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      variants={staggerItem}
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ ...springSoft, delay }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
