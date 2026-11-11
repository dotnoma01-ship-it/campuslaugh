import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { useEffect } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import { AmbientBackdrop } from "@/components/ui/Ambient";
import { BottomNav, MobileHeader, Sidebar } from "@/components/navigation/Nav";
import { GlobalOverlays } from "@/components/overlays/GlobalOverlays";
import { BannerHost, Island } from "@/components/notifications/SystemUI";
import { Toaster } from "@/components/ui/Toaster";
import { useStore } from "@/context/StoreContext";
import { useTheme } from "@/context/ThemeContext";
import Home from "@/pages/Home";
import Explore from "@/pages/Explore";
import Chats from "@/pages/Chats";
import NotificationsPage from "@/pages/Notifications";
import Profile, { BookmarksPage } from "@/pages/Profile";
import SettingsPage from "@/pages/Settings";
import { LoginPage, RegisterPage, ForgotPasswordPage, ResetPasswordPage } from "@/pages/auth/AuthPages";
import { getAccessToken, request, setAccessToken } from "@/services/http";
import { useState } from "react";

const TITLES: Record<string, string> = {
  "/home": "CampusLaugh",
  "/explore": "Explore",
  "/notifications": "Alerts",
  "/chats": "Messages",
  "/profile": "Profile",
  "/bookmarks": "Bookmarks",
  "/settings": "Settings",
};

export default function AppShell() {
  const location = useLocation();
  const { settings } = useTheme();
  const [sessionReady, setSessionReady] = useState(false);

  useEffect(() => {
    let live = true;
    if (getAccessToken()) { setSessionReady(true); return () => { live = false; }; }
    request<{accessToken:string}>("/auth/refresh", { method: "POST" })
      .then(({accessToken}) => setAccessToken(accessToken))
      .catch(() => undefined)
      .finally(() => { if (live) setSessionReady(true); });
    return () => { live = false; };
  }, []);

  if (["/login", "/register", "/forgot-password", "/reset-password"].includes(location.pathname)) {
    return <Routes><Route path="/login" element={<LoginPage/>}/><Route path="/register" element={<RegisterPage/>}/><Route path="/forgot-password" element={<ForgotPasswordPage/>}/><Route path="/reset-password" element={<ResetPasswordPage/>}/><Route path="*" element={<LoginPage/>}/></Routes>;
  }
  if (!sessionReady) return <div className="grid min-h-[100dvh] place-items-center bg-bg text-ink2"><div className="animate-pulse text-sm font-semibold">Restoring your campus session…</div></div>;
  if (!getAccessToken()) return <Navigate to="/login" replace state={{from:location.pathname}}/>;

  const isChatThread = /^\/chats\/.+/.test(location.pathname);
  const root = `/${location.pathname.split("/")[1] ?? ""}`;

  return (
    <MotionConfig reducedMotion={settings.reduceMotion ? "always" : "user"}>
      <AmbientBackdrop />

      <div className="mx-auto flex w-full max-w-[1440px] lg:px-4">
        <Sidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          {!isChatThread && <MobileHeader title={TITLES[root]} />}

          <main className="min-w-0 flex-1 lg:pt-2">
            <div className="mx-auto w-full max-w-[1180px]">
              <AnimatePresence mode="wait" initial={false}>
                <Routes location={location} key={location.pathname}>
                  <Route path="/" element={<Navigate to="/home" replace />} />
                  <Route path="/home" element={<Home />} />
                  <Route path="/explore" element={<Explore />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/chats" element={<Chats />} />
                  <Route path="/chats/:id" element={<Chats />} />
                  <Route path="/profile" element={<Profile />} />
                  <Route path="/profile/:userId" element={<Profile />} />
                  <Route path="/bookmarks" element={<BookmarksPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Navigate to="/home" replace />} />
                </Routes>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>

      <BottomNav />
      <Island />
      <BannerHost />
      <Toaster />
      <GlobalOverlays />
    </MotionConfig>
  );
}

/** Liquid-glass boot splash shown while the application session hydrates. */
export function BootScreen() {
  const { ready } = useStore();
  return (
    <AnimatePresence>
      {!ready && (
        <motion.div
          key="boot"
          exit={{ opacity: 0, scale: 1.04, filter: "blur(10px)" }}
          transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
          className="fixed inset-0 z-[120] grid place-items-center bg-bg"
        >
          <div className="flex flex-col items-center gap-5">
            <motion.div
              initial={{ scale: 0.6, opacity: 0, rotate: -12 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 260, damping: 18 }}
              className="relative grid h-24 w-24 place-items-center rounded-[32%] bg-brand shadow-[0_30px_70px_-24px_rgba(183,243,74,.85)]"
            >
              <motion.span
                animate={{ scale: [1, 1.25, 1], opacity: [0.35, 0, 0.35] }}
                transition={{ duration: 2.2, repeat: Infinity }}
                className="absolute inset-0 rounded-[32%] bg-brand"
              />
              <svg viewBox="0 0 32 32" className="relative h-14 w-14" fill="none">
                <path d="M8 19.5c0-5.2 3.1-8.6 8-8.6s8 3.4 8 8.6" stroke="#10140a" strokeWidth="2.8" strokeLinecap="round" />
                <circle cx="12.4" cy="13.6" r="1.9" fill="#10140a" />
                <circle cx="19.6" cy="13.6" r="1.9" fill="#10140a" />
              </svg>
            </motion.div>

            <div className="text-center">
              <motion.h1
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="font-display text-[26px] font-extrabold tracking-[-0.04em] text-ink"
              >
                Campus<span className="text-brand">Laugh</span>
              </motion.h1>
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.28 }}
                className="mt-1 text-[12.5px] font-semibold text-ink2"
              >
                Your campus. Your people. Your laughs.
              </motion.p>
            </div>

            <motion.div
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
              className="h-1 w-40 origin-left overflow-hidden rounded-full bg-ink/10"
            >
              <div className="h-full w-full rounded-full bg-brand" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
