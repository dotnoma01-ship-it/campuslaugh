import { AnimatePresence, motion } from "framer-motion";
import {
  Bell,
  Bookmark,
  Compass,
  Home,
  LogOut,
  MessageCircle,
  Monitor,
  Moon,
  Plus,
  Search,
  Settings,
  Sun,
  User as UserIcon,
} from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";
import { useSystem } from "@/context/SystemContext";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import { useScrollDirection } from "@/hooks";
import { CAMPUS_LAUGH } from "@/data/constants";
import { Avatar, IconButton } from "@/components/ui/primitives";
import { spring, springSnappy } from "@/components/ui/primitives";
import { cn } from "@/utils/format";
import type { ThemeMode } from "@/types";
import { request, setAccessToken } from "@/services/http";

export function LogoMark({ size = 34 }: { size?: number }) {
  return (
    <span
      className="relative grid shrink-0 place-items-center rounded-[30%] bg-brand shadow-[0_8px_22px_-10px_rgba(183,243,74,.9),inset_0_1px_0_rgba(255,255,255,.55)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 32 32" style={{ width: size * 0.66, height: size * 0.66 }} fill="none">
        <path
          d="M8 19.5c0-5.2 3.1-8.6 8-8.6s8 3.4 8 8.6"
          stroke="#10140a"
          strokeWidth="2.8"
          strokeLinecap="round"
        />
        <circle cx="12.4" cy="13.6" r="1.9" fill="#10140a" />
        <circle cx="19.6" cy="13.6" r="1.9" fill="#10140a" />
      </svg>
    </span>
  );
}

const NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: UserIcon },
  { to: "/settings", label: "Settings", icon: Settings },
];

/* ------------------------------------------------------------------ */
/*  Desktop sidebar                                                     */
/* ------------------------------------------------------------------ */

export function Sidebar() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { me, unreadTotal, unreadNotifications } = useStore();
  const { toast, confirm } = useSystem();
  const { settings, update } = useTheme();

  const themeOptions: { value: ThemeMode; icon: React.ReactNode; label: string }[] = [
    { value: "light", icon: <Sun className="h-3.5 w-3.5" />, label: "Light" },
    { value: "dark", icon: <Moon className="h-3.5 w-3.5" />, label: "Dark" },
    { value: "system", icon: <Monitor className="h-3.5 w-3.5" />, label: "System" },
  ];

  return (
    <aside className="sticky top-0 hidden h-dvh w-[264px] shrink-0 flex-col gap-3 p-4 pr-2 lg:flex">
      <div className="glass flex h-full flex-col gap-1 rounded-[28px] p-3">
        <button
          onClick={() => navigate("/home")}
          className="press group flex items-center gap-2.5 rounded-2xl px-2 py-2.5 text-left"
        >
          <LogoMark />
          <span className="min-w-0">
            <span className="block truncate font-display text-[17px] font-extrabold leading-none tracking-[-0.03em] text-ink">
              Campus<span className="text-brand">Laugh</span>
            </span>
            <span className="mt-1 block truncate text-[10.5px] font-semibold uppercase tracking-[0.14em] text-ink3">
              {CAMPUS_LAUGH.version}
            </span>
          </span>
        </button>

        <nav className="mt-1 flex flex-col gap-0.5">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.to);
            const badge = item.to === "/chats" ? unreadTotal : item.to === "/notifications" ? unreadNotifications : 0;
            const Icon = item.icon;
            return (
              <motion.button
                key={item.to}
                onClick={() => navigate(item.to)}
                whileTap={{ scale: 0.97 }}
                className={cn(
                  "relative flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[14px] font-semibold transition-colors",
                  active ? "text-ink" : "text-ink2 hover:text-ink",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="nav-active-desktop"
                    transition={spring}
                    className="absolute inset-0 rounded-2xl border border-brand/30 bg-brand/14"
                  />
                )}
                {active && (
                  <motion.span
                    layoutId="nav-bar-desktop"
                    transition={spring}
                    className="absolute -left-3 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-full bg-brand"
                  />
                )}
                <Icon className="relative h-[19px] w-[19px]" strokeWidth={active ? 2.4 : 2} />
                <span className="relative flex-1 text-left">{item.label}</span>
                {badge > 0 && (
                  <span className="relative grid h-[19px] min-w-[19px] place-items-center rounded-full bg-brand px-1 text-[10.5px] font-extrabold text-onbrand">
                    {badge > 99 ? "99+" : badge}
                  </span>
                )}
              </motion.button>
            );
          })}
        </nav>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => navigate("/home?compose=1")}
          className="mt-2 flex items-center justify-center gap-2 rounded-2xl bg-brand py-3 text-[14px] font-extrabold text-onbrand shadow-[0_14px_34px_-14px_rgba(183,243,74,.9)]"
        >
          <Plus className="h-[18px] w-[18px]" strokeWidth={2.8} />
          Create post
        </motion.button>

        <button
          onClick={() => navigate("/bookmarks")}
          className="press mt-1 flex items-center gap-3 rounded-2xl px-3 py-2.5 text-[13.5px] font-semibold text-ink2 hover:text-ink"
        >
          <Bookmark className="h-[18px] w-[18px]" />
          Bookmarks
        </button>

        <div className="mt-auto space-y-2">
          <div className="glass flex items-center gap-1 rounded-full p-1">
            {themeOptions.map((t) => (
              <button
                key={t.value}
                onClick={() => update("theme", t.value)}
                aria-label={`${t.label} theme`}
                title={`${t.label} theme`}
                className={cn(
                  "relative grid h-8 flex-1 place-items-center rounded-full transition-colors",
                  settings.theme === t.value ? "text-onbrand" : "text-ink2 hover:text-ink",
                )}
              >
                {settings.theme === t.value && (
                  <motion.span
                    layoutId="theme-pill"
                    transition={springSnappy}
                    className="absolute inset-0 rounded-full bg-brand"
                  />
                )}
                <span className="relative">{t.icon}</span>
              </button>
            ))}
          </div>

          <button
            onClick={() => navigate("/profile")}
            className="glass-sheen press flex w-full items-center gap-2.5 rounded-2xl border border-line p-2 text-left hover:bg-glass2"
          >
            <Avatar src={me.avatar} name={me.name} size={36} online />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold text-ink">{me.name}</span>
              <span className="block truncate text-[11.5px] text-ink3">@{me.username}</span>
            </span>
          </button>

          <button
            onClick={async () => {
              const ok = await confirm({
                title: "Log out of CampusLaugh?",
                message: "You’ll be signed out of this account on this device.",
                confirmLabel: "Log out",
                tone: "danger",
              });
              if (ok) {
                try {
                  await request("/auth/logout", { method: "POST" });
                  setAccessToken(null);
                  toast({ title: "You’re signed out", tone: "success" });
                  navigate("/login", { replace: true });
                } catch (error) {
                  toast({ title: "Could not sign out", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
                }
              }
            }}
            className="press flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-[13px] font-semibold text-ink3 hover:text-coral"
          >
            <LogOut className="h-4 w-4" />
            Log out
          </button>
        </div>
      </div>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile floating tab bar                                             */
/* ------------------------------------------------------------------ */

const MOBILE_NAV = [
  { to: "/home", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Compass },
  { to: "/chats", label: "Chats", icon: MessageCircle },
  { to: "/profile", label: "Profile", icon: UserIcon },
];

export function BottomNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { unreadTotal } = useStore();
  const { direction } = useScrollDirection(window, 8);
  const hidden = pathname.startsWith("/chats/");

  return (
    <AnimatePresence>
      {!hidden && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: direction === "down" ? 110 : 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={spring}
          className="fixed inset-x-0 bottom-0 z-50 flex justify-center px-3"
          style={{ paddingBottom: "max(10px, env(safe-area-inset-bottom))" }}
        >
          <div className="glass-bar relative flex w-full max-w-md items-center justify-between gap-1 rounded-[26px] px-2 py-2">
            {MOBILE_NAV.slice(0, 2).map((item) => (
              <TabButton key={item.to} item={item} pathname={pathname} navigate={navigate} />
            ))}

            <motion.button
              whileTap={{ scale: 0.86 }}
              whileHover={{ scale: 1.06 }}
              transition={springSnappy}
              onClick={() => navigate("/home?compose=1")}
              aria-label="Create post"
              className="relative -mt-7 grid h-14 w-14 shrink-0 place-items-center rounded-full bg-brand text-onbrand shadow-[0_16px_34px_-12px_rgba(183,243,74,.95),inset_0_1px_0_rgba(255,255,255,.6)]"
            >
              <motion.span
                animate={{ rotate: [0, 90, 0] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
              >
                <Plus className="h-6 w-6" strokeWidth={2.8} />
              </motion.span>
              <span className="live-ring absolute inset-0 rounded-full" />
            </motion.button>

            <TabButton
              item={MOBILE_NAV[2]!}
              pathname={pathname}
              navigate={navigate}
              badge={unreadTotal}
            />
            <TabButton item={MOBILE_NAV[3]!} pathname={pathname} navigate={navigate} />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  item,
  pathname,
  navigate,
  badge,
}: {
  item: { to: string; label: string; icon: React.ElementType };
  pathname: string;
  navigate: ReturnType<typeof useNavigate>;
  badge?: number;
}) {
  const active = pathname.startsWith(item.to);
  const Icon = item.icon;
  return (
    <motion.button
      whileTap={{ scale: 0.9 }}
      onClick={() => navigate(item.to)}
      aria-label={item.label}
      aria-current={active ? "page" : undefined}
      className="relative grid h-12 flex-1 place-items-center"
    >
      {active && (
        <motion.span
          layoutId="nav-active-mobile"
          transition={spring}
          className="absolute inset-0 rounded-2xl bg-brand/16"
        />
      )}
      <motion.span
        animate={active ? { y: -1, scale: 1.08 } : { y: 0, scale: 1 }}
        transition={springSnappy}
        className={cn("relative", active ? "text-brand" : "text-ink3")}
      >
        <Icon className="h-[22px] w-[22px]" strokeWidth={active ? 2.5 : 2} />
        {badge ? (
          <span className="absolute -right-2 -top-1 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-brand px-1 text-[9.5px] font-extrabold text-onbrand">
            {badge > 9 ? "9+" : badge}
          </span>
        ) : null}
      </motion.span>
    </motion.button>
  );
}

/* ------------------------------------------------------------------ */
/*  Mobile top header                                                   */
/* ------------------------------------------------------------------ */

export function MobileHeader({ title }: { title?: string }) {
  const navigate = useNavigate();
  const { me, unreadNotifications } = useStore();
  const { direction, y } = useScrollDirection(window, 8);
  const compact = y > 40;

  return (
    <motion.header
      animate={{ y: direction === "down" && y > 180 ? -90 : 0 }}
      transition={spring}
      className="sticky top-0 z-40 px-3 pt-3 lg:hidden"
      style={{ paddingTop: "max(10px, env(safe-area-inset-top))" }}
    >
      <div
        className={cn(
          "glass-bar flex items-center gap-2 overflow-hidden rounded-[24px] transition-all duration-300",
          compact ? "px-2.5 py-2" : "px-3 py-2.5",
        )}
      >
        <button onClick={() => navigate("/home")} aria-label="CampusLaugh home" className="press flex items-center gap-2">
          <LogoMark size={compact ? 28 : 32} />
          <AnimatePresence initial={false}>
            {!compact && (
              <motion.span
                initial={{ opacity: 0, width: 0 }}
                animate={{ opacity: 1, width: "auto" }}
                exit={{ opacity: 0, width: 0 }}
                className="overflow-hidden whitespace-nowrap font-display text-[16px] font-extrabold tracking-[-0.03em] text-ink"
              >
                {title ?? (
                  <>
                    Campus<span className="text-brand">Laugh</span>
                  </>
                )}
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <div className="ml-auto flex items-center gap-1.5">
          <IconButton label="Search" size="sm" onClick={() => navigate("/explore?focus=1")}>
            <Search className="h-[17px] w-[17px]" />
          </IconButton>
          <IconButton label="Notifications" size="sm" badge={unreadNotifications} onClick={() => navigate("/notifications")}>
            <Bell className="h-[17px] w-[17px]" />
          </IconButton>
          <button
            onClick={() => navigate("/profile")}
            aria-label="Your profile"
            className="press ml-0.5"
          >
            <Avatar src={me.avatar} name={me.name} size={30} online />
          </button>
        </div>
      </div>
    </motion.header>
  );
}
