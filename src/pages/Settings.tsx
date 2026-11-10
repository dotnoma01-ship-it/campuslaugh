import { AnimatePresence, motion } from "framer-motion";
import {
  Archive,
  Bell,
  BellOff,
  Brush,
  Check,
  ChevronRight,
  Eye,
  KeyRound,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Radio,
  Shield,
  Sparkles,
  Sun,
  Trash2,
  UserCog,
  Volume2,
  Vibrate,
  WifiOff,
} from "lucide-react";
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useStore } from "@/context/StoreContext";
import { useSystem } from "@/context/SystemContext";
import { useTheme, defaultSettings } from "@/context/ThemeContext";
import type { Settings as SettingsType, ThemeMode, WallpaperId } from "@/types";
import { cn } from "@/utils/format";
import { Avatar, Badge, Button, Segmented, Switch } from "@/components/ui/primitives";
import { spring, springSnappy } from "@/components/ui/primitives";
import { BottomSheet } from "@/components/ui/overlays";
import { pageVariants } from "@/components/ui/motion";
import { request, setAccessToken } from "@/services/http";

type SectionId = "account" | "appearance" | "privacy" | "notifications" | "chat" | "safety" | "about";

const SECTIONS: { id: SectionId; label: string; icon: React.ReactNode }[] = [
  { id: "account", label: "Account", icon: <UserCog className="h-4 w-4" /> },
  { id: "appearance", label: "Appearance", icon: <Brush className="h-4 w-4" /> },
  { id: "privacy", label: "Privacy", icon: <Shield className="h-4 w-4" /> },
  { id: "notifications", label: "Notifications", icon: <Bell className="h-4 w-4" /> },
  { id: "chat", label: "Chat settings", icon: <Palette className="h-4 w-4" /> },
  { id: "safety", label: "Safety", icon: <Shield className="h-4 w-4" /> },
  { id: "about", label: "About this build", icon: <Sparkles className="h-4 w-4" /> },
];

const WALLPAPERS: { id: WallpaperId; label: string; chip: string }[] = [
  { id: "midnight", label: "Midnight", chip: "linear-gradient(140deg,#0d0f13,#1a1d24)" },
  { id: "linen", label: "Linen", chip: "linear-gradient(140deg,#fdfdfd,#e6e8ee)" },
  { id: "aurora", label: "Citrus", chip: "linear-gradient(140deg,#b7f34a,#4fd8b0)" },
  { id: "graphite", label: "Graphite", chip: "linear-gradient(140deg,#2b2f36,#111318)" },
  { id: "lime", label: "Lime haze", chip: "linear-gradient(140deg,#d9fb9b,#8fd42c)" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { settings, update, reset, resolved } = useTheme();
  const { me, conversations, resetDemoData, setAmbient, notifications, pushNotification, markNotificationRead, userById } = useStore();
  const { toast, confirm, actionSheet, pushBanner, showIsland } = useSystem();
  const [section, setSection] = useState<SectionId>((params.get("tab") as SectionId) ?? "account");
  const [wallpaperSheet, setWallpaperSheet] = useState(false);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [pw, setPw] = useState({ current: "", next: "", confirm: "" });
  const [passwordBusy, setPasswordBusy] = useState(false);

  const go = (id: SectionId) => {
    setSection(id);
    setParams({ tab: id }, { replace: true });
  };

  const Toggle = ({ setting, label, hint, icon }: { setting: keyof SettingsType; label: string; hint?: string; icon?: React.ReactNode }) => {
    const value = settings[setting];
    if (typeof value !== "boolean") return null;
    return (
      <Row
        icon={icon}
        label={label}
        hint={hint}
        trailing={<Switch checked={value} onChange={(v) => update(setting, v as never)} label={label} />}
      />
    );
  };

  return (
    <motion.div variants={pageVariants} initial="initial" animate="enter" exit="exit" className="pb-28 lg:pb-8">
      <div className="mb-4 flex flex-wrap items-end gap-3 px-3 pt-2 lg:px-0">
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-[26px] font-extrabold leading-none tracking-[-0.035em] text-ink lg:text-[34px]">
            Settings
          </h1>
          <p className="mt-1.5 text-[12.5px] font-semibold text-ink2">
            Theme, privacy, notifications and chat preferences — all stored on this device.
          </p>
        </div>
        <div className="glass flex items-center gap-2.5 rounded-[22px] p-2">
          <Avatar src={me.avatar} name={me.name} size={38} online />
          <div className="min-w-0 pr-1">
            <p className="truncate text-[13px] font-extrabold text-ink">{me.name}</p>
            <p className="truncate text-[11.5px] text-ink3">@{me.username}</p>
          </div>
          <Button size="xs" variant="outline" onClick={() => navigate("/profile")}>View</Button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)] lg:px-0">
        {/* section rail */}
        <div className="px-3 lg:px-0">
          <div className="glass flex gap-1 overflow-x-auto no-scrollbar rounded-[22px] p-1.5 lg:sticky lg:top-2 lg:flex-col lg:overflow-visible">
            {SECTIONS.map((s) => {
              const active = section === s.id;
              return (
                <button
                  key={s.id}
                  onClick={() => go(s.id)}
                  className={cn(
                    "relative flex shrink-0 items-center gap-2.5 rounded-2xl px-3 py-2.5 text-[13px] font-bold transition-colors lg:w-full",
                    active ? "text-onbrand" : "text-ink2 hover:text-ink",
                  )}
                >
                  {active && <motion.span layoutId="settings-section" transition={spring} className="absolute inset-0 rounded-2xl bg-brand" />}
                  <span className="relative">{s.icon}</span>
                  <span className="relative whitespace-nowrap">{s.label}</span>
                  {active && <ChevronRight className="relative ml-auto hidden h-4 w-4 lg:block" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* panel */}
        <div className="min-w-0 px-3 lg:px-0">
          <AnimatePresence mode="wait">
            <motion.div
              key={section}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={springSnappy}
              className="glass overflow-hidden rounded-[26px]"
            >
              {section === "account" && (
                <Group title="Account">
                  <Row
                    icon={<UserCog className="h-4 w-4" />}
                    label="Account details"
                    hint={`${me.name} · @${me.username} · ${me.institution}`}
                    onClick={() => navigate("/profile")}
                  />
                  <Row icon={<Brush className="h-4 w-4" />} label="Edit profile" hint="Photo, name, bio and course" onClick={() => navigate("/profile?edit=1")} />
                  <Row icon={<KeyRound className="h-4 w-4" />} label="Change password" hint="Update your account credentials" onClick={() => setPasswordSheet(true)} />
                  <Row
                    icon={<LogOut className="h-4 w-4" />}
                    label="Log out"
                    hint="End your CampusLaugh session"
                    danger
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Log out of CampusLaugh?",
                        message: "Local demo data stays on this device, but the interface session will be reset.",
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
                  />
                </Group>
              )}

              {section === "appearance" && (
                <Group title="Appearance">
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-bold text-ink">Theme</p>
                    <p className="mb-2.5 text-[11.5px] text-ink3">Currently rendering in {resolved} mode</p>
                    <Segmented
                      value={settings.theme}
                      onChange={(v: ThemeMode) => update("theme", v)}
                      options={[
                        { value: "light", label: "Light", icon: <Sun className="h-3.5 w-3.5" /> },
                        { value: "dark", label: "Dark", icon: <Moon className="h-3.5 w-3.5" /> },
                        { value: "system", label: "System", icon: <Monitor className="h-3.5 w-3.5" /> },
                      ]}
                    />
                  </div>
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-bold text-ink">Accent</p>
                    <p className="mb-2.5 text-[11.5px] text-ink3">Applies to highlights, buttons and the island</p>
                    <div className="flex gap-2">
                      {(["lime", "mint", "coral"] as const).map((a) => (
                        <button
                          key={a}
                          onClick={() => update("accent", a)}
                          aria-label={`${a} accent`}
                          className={cn(
                            "relative grid h-11 flex-1 place-items-center rounded-2xl border-2 transition-all",
                            settings.accent === a ? "border-ink/40" : "border-line",
                          )}
                          style={{
                            background:
                              a === "lime" ? "linear-gradient(140deg,#B7F34A,#7ED321)" : a === "mint" ? "linear-gradient(140deg,#4FD8B0,#2AA88A)" : "linear-gradient(140deg,#FF7A59,#FF4D6D)",
                          }}
                        >
                          {settings.accent === a && <Check className="h-4 w-4 text-black/70" strokeWidth={3} />}
                        </button>
                      ))}
                    </div>
                  </div>
                  <Toggle setting="compactFeed" label="Compact feed" hint="Shorter cards, fewer posts on screen" icon={<Brush className="h-4 w-4" />} />
                  <Toggle setting="reduceMotion" label="Reduce motion" hint="Shortens transitions and disables ambient drift" icon={<Eye className="h-4 w-4" />} />
                  <Toggle setting="mediaAutoplay" label="Autoplay videos" hint="Videos in the feed start muted" icon={<Radio className="h-4 w-4" />} />
                </Group>
              )}

              {section === "privacy" && (
                <Group title="Privacy">
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-bold text-ink">Who can message me</p>
                    <p className="mb-2.5 text-[11.5px] text-ink3">Applies to new conversation requests</p>
                    <Segmented
                      value={settings.whoCanMessage}
                      onChange={(v) => update("whoCanMessage", v)}
                      options={[
                        { value: "everyone", label: "Everyone" },
                        { value: "campus", label: "My campus" },
                        { value: "following", label: "Following" },
                      ]}
                    />
                  </div>
                  <Toggle setting="onlineVisibility" label="Show online status" hint="Others see when you're active" icon={<Eye className="h-4 w-4" />} />
                  <Toggle setting="readReceipts" label="Read receipts" hint="Send blue ticks when you read a message" icon={<Check className="h-4 w-4" />} />
                  <Toggle setting="institutionVisibility" label="Show my institution" hint="Displayed on your posts and profile" icon={<Shield className="h-4 w-4" />} />
                </Group>
              )}

              {section === "notifications" && (
                <Group title="Notifications">
                  <Toggle setting="banners" label="Floating banners" hint="System-style banners at the top of the screen" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="island" label="Capsule alerts" hint="CampusLaugh's floating capsule for live activity" icon={<Radio className="h-4 w-4" />} />
                  <Toggle setting="notifyMessages" label="Messages" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="notifyLikes" label="Likes" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="notifyComments" label="Comments & replies" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="notifyFollowers" label="New followers" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="notifyMentions" label="Mentions" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="notifyCampus" label="Campus announcements" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="sound" label="Sound" hint="Plays a soft tone after your first tap" icon={<Volume2 className="h-4 w-4" />} />
                  <Toggle setting="vibration" label="Vibration" hint="Where the device supports it" icon={<Vibrate className="h-4 w-4" />} />
                  <Row
                    icon={<Radio className="h-4 w-4" />}
                    label="Demo activity stream"
                    hint="Simulated likes, messages and banners arriving in the background"
                    trailing={
                      <Switch
                        checked={settings.demoActivity}
                        onChange={(v) => {
                          update("demoActivity", v);
                          setAmbient(v);
                          toast({ title: v ? "Demo activity on" : "Demo activity paused", tone: "info" });
                        }}
                        label="Demo activity"
                      />
                    }
                  />
                  <Row
                    icon={<BellOff className="h-4 w-4" />}
                    label="Test a notification"
                    hint="Fires a banner, capsule alert and centre entry"
                    onClick={() =>
                      actionSheet({
                        title: "Send a test notification",
                        actions: [
                          { id: "message", label: "New message", icon: <Bell className="h-4 w-4" />, onSelect: () => fireTest("message") },
                          { id: "like", label: "Someone liked your post", icon: <Bell className="h-4 w-4" />, onSelect: () => fireTest("like") },
                          { id: "campus", label: "Campus announcement", icon: <Bell className="h-4 w-4" />, onSelect: () => fireTest("campus") },
                        ],
                      })
                    }
                  />
                </Group>
              )}

              {section === "chat" && (
                <Group title="Chat settings">
                  <Row icon={<Palette className="h-4 w-4" />} label="Default wallpaper" hint={WALLPAPERS.find((w) => w.id === settings.wallpaper)?.label} onClick={() => setWallpaperSheet(true)} />
                  <Row
                    icon={<Archive className="h-4 w-4" />}
                    label="Archived conversations"
                    hint={`${conversations.filter((c) => c.archived).length} archived`}
                    onClick={() => navigate("/chats")}
                  />
                  <Row
                    icon={<BellOff className="h-4 w-4" />}
                    label="Muted conversations"
                    hint={`${conversations.filter((c) => c.muted).length} muted`}
                    onClick={() => navigate("/chats")}
                  />
                  <Toggle setting="readReceipts" label="Send read receipts" icon={<Check className="h-4 w-4" />} />
                  <Row
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Media auto-download"
                    hint="Attachments are created locally in the browser"
                    onClick={() => toast({ title: "Media preference saved", tone: "success" })}
                  />
                </Group>
              )}

              {section === "safety" && (
                <Group title="Safety">
                  <Row icon={<Shield className="h-4 w-4" />} label="Blocked users" hint="Nobody is blocked in this demo session" onClick={() => toast({ title: "Blocked list is empty", tone: "info" })} />
                  <Row icon={<BellOff className="h-4 w-4" />} label="Muted users" hint={`${conversations.filter((c) => c.muted).length} muted conversation(s)`} onClick={() => navigate("/chats")} />
                  <Row icon={<Archive className="h-4 w-4" />} label="Report history" hint={`${notifications.filter((n) => n.kind === "account").length} account events logged locally`} onClick={() => navigate("/notifications")} />
                  <Row
                    icon={<WifiOff className="h-4 w-4" />}
                    label="Simulate connection errors"
                    hint="Shows the offline / error states across the app"
                    danger={settings.simulateErrors}
                    trailing={<Switch checked={settings.simulateErrors} onChange={(v) => { update("simulateErrors", v); toast({ title: v ? "Offline mode simulated" : "Back online", tone: v ? "warning" : "success" }); }} label="Simulate errors" />}
                  />
                  <Row
                    icon={<Trash2 className="h-4 w-4" />}
                    label="Reset demo data"
                    hint="Restores posts, chats, notifications and your profile"
                    danger
                    onClick={async () => {
                      const ok = await confirm({
                        title: "Reset all demo data?",
                        message: "Everything stored in localStorage for CampusLaugh will be replaced with the original demonstration content.",
                        confirmLabel: "Reset data",
                        tone: "danger",
                      });
                      if (ok) resetDemoData();
                    }}
                  />
                </Group>
              )}

              {section === "about" && (
                <Group title="About this build">
                  <div className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="brand">Frontend only</Badge>
                      <Badge tone="mint">No backend calls</Badge>
                      <Badge>localStorage persistence</Badge>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-ink2">
                      CampusLaugh is a student social platform for memes, pictures, videos, jokes, discussions and
                      messages. This build is the complete interface: every screen, gesture, sheet and notification
                      behaves for real, but the data is demonstration content created in the browser.
                    </p>
                    <p className="mt-2 text-[13px] leading-relaxed text-ink2">
                      A service layer (<code className="rounded bg-ink/8 px-1 py-0.5 text-[12px]">src/services/api.ts</code>)
                      isolates all data access, so a real API can be connected without rebuilding the UI.
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      {[
                        ["Design system", "Liquid Glass 27"],
                        ["Motion", "Framer Motion springs"],
                        ["Posts in demo", String(20)],
                        ["Conversations", String(conversations.length)],
                      ].map(([k, v]) => (
                        <div key={k} className="rounded-2xl border border-line bg-glass px-3 py-2">
                          <dt className="font-bold uppercase tracking-wide text-ink3 text-[10.5px]">{k}</dt>
                          <dd className="mt-0.5 font-bold text-ink">{v}</dd>
                        </div>
                      ))}
                    </dl>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => { reset(); toast({ title: "Preferences restored to defaults", tone: "info" }); }}>
                        Reset preferences
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => navigate("/home")}>Back to feed</Button>
                    </div>
                  </div>
                </Group>
              )}
            </motion.div>
          </AnimatePresence>

          <p className="mt-3 px-2 text-[11px] leading-relaxed text-ink3">
            Preferences are saved with <code>localStorage</code>. Nothing leaves this browser.
          </p>
        </div>
      </div>

      {/* wallpaper sheet */}
      <BottomSheet open={wallpaperSheet} onClose={() => setWallpaperSheet(false)} title="Chat wallpaper" desktop="center" className="max-h-none">
        <div className="grid grid-cols-3 gap-2.5 p-4">
          {WALLPAPERS.map((w, i) => (
            <motion.button
              key={w.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.04, ...springSnappy }}
              whileTap={{ scale: 0.94 }}
              onClick={() => {
                update("wallpaper", w.id);
                setWallpaperSheet(false);
                toast({ title: `Wallpaper set to ${w.label}`, description: "Applies to new conversations", tone: "success" });
              }}
              className={cn(
                "relative h-24 overflow-hidden rounded-2xl border-2",
                settings.wallpaper === w.id ? "border-brand" : "border-line",
              )}
              style={{ background: w.chip }}
            >
              <span className="absolute inset-x-0 bottom-0 bg-black/45 py-1 text-[11px] font-bold text-white">{w.label}</span>
              {settings.wallpaper === w.id && (
                <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-brand text-onbrand">
                  <Check className="h-3.5 w-3.5" strokeWidth={3} />
                </span>
              )}
            </motion.button>
          ))}
        </div>
      </BottomSheet>

      {/* password settings */}
      <BottomSheet open={passwordSheet} onClose={() => setPasswordSheet(false)} title="Change password" desktop="center" className="max-h-none">
        <form
          className="space-y-3 p-4"
          onSubmit={async (e) => {
            e.preventDefault();
            if (pw.next.length < 8) return toast({ title: "Password too short", description: "Use at least 8 characters", tone: "error" });
            if (pw.next !== pw.confirm) return toast({ title: "Passwords don't match", tone: "error" });
            if (!pw.current) return toast({ title: "Enter your current password", tone: "warning" });
            if (!/[A-Za-z]/.test(pw.next) || !/[0-9]/.test(pw.next)) return toast({ title: "Choose a stronger password", description: "Include at least one letter and one number.", tone: "error" });
            setPasswordBusy(true);
            try {
              const result = await request<{message:string}>("/auth/password", { method: "PATCH", body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.next }) });
              setPasswordSheet(false);
              setPw({ current: "", next: "", confirm: "" });
              toast({ title: "Password updated", description: result.message, tone: "success" });
              setAccessToken(null);
              navigate("/login", { replace: true });
            } catch (error) {
              toast({ title: "Could not update password", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
            } finally { setPasswordBusy(false); }
          }}
        >
          {(
            [
              ["Current password", "current", "••••••••"],
              ["New password", "next", "At least 8 characters"],
              ["Confirm new password", "confirm", "Repeat it"],
            ] as const
          ).map(([label, key, placeholder]) => (
            <label key={key} className="block">
              <span className="mb-1.5 block text-[11.5px] font-bold uppercase tracking-wide text-ink3">{label}</span>
              <input
                type="password"
                value={pw[key]}
                placeholder={placeholder}
                onChange={(e) => setPw((p) => ({ ...p, [key]: e.target.value }))}
                className="field h-11 w-full rounded-2xl px-3.5 text-[14px] outline-none"
              />
            </label>
          ))}
          <div className="glass flex items-start gap-2 rounded-2xl p-3">
            <Shield className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
            <p className="text-[11.5px] leading-relaxed text-ink2">Your current password is checked by the CampusLaugh API. You’ll sign in again after it changes.</p>
          </div>
          <Button type="submit" variant="brand" block loading={passwordBusy} icon={<KeyRound className="h-4 w-4" />}>Update password</Button>
        </form>
      </BottomSheet>
    </motion.div>
  );

  function fireTest(kind: "message" | "like" | "campus") {
    const actor = userById("u4");
    const copy =
      kind === "message"
        ? { title: `${actor.name} sent you a message`, body: "Are you coming to the comedy night on Friday?", to: "/chats/cv1" }
        : kind === "like"
          ? { title: `${actor.name} liked your post`, body: "\u201cShipped a tiny feature tonight\u2026\u201d", to: "/home" }
          : { title: "UNILAG \u00b7 Comedy Night", body: "Friday 7pm, Main Auditorium. Doors close at 7:30.", to: "/explore" };
    const n = pushNotification({ kind, actorId: kind === "campus" ? undefined : actor.id, ...copy });
    pushBanner({
      title: copy.title,
      body: copy.body,
      avatar: kind === "campus" ? undefined : actor.avatar,
      time: "now",
      tone: kind === "message" ? "message" : "default",
      expandedBody: "Tap to open · swipe sideways or up to dismiss",
      onOpen: () => navigate(copy.to),
      onMarkRead: () => {
        markNotificationRead(n.id);
        navigate("/notifications");
      },
    });
    showIsland({ title: "CampusLaugh", subtitle: copy.title, duration: 4200, onOpen: () => navigate(copy.to) });
    toast({ title: "Test notification fired", description: "Banner, capsule and notification centre updated", tone: "info" });
  }
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="px-4 pb-1 pt-3.5 text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink3">{title}</p>
      <div className="divide-y divide-[var(--c-border)]">{children}</div>
    </div>
  );
}

function Row({
  icon,
  label,
  hint,
  trailing,
  onClick,
  danger,
}: {
  icon?: React.ReactNode;
  label: string;
  hint?: string;
  trailing?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const content = (
    <>
      {icon && (
        <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", danger ? "bg-coral/14 text-coral" : "bg-brand/12 text-brand")}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block truncate text-[13.5px] font-bold", danger ? "text-coral" : "text-ink")}>{label}</span>
        {hint && <span className="mt-0.5 block truncate text-[11.5px] text-ink2">{hint}</span>}
      </span>
      {trailing ?? (onClick && <ChevronRight className="h-4 w-4 shrink-0 text-ink3" />)}
    </>
  );

  if (onClick)
    return (
      <motion.button whileTap={{ scale: 0.99 }} onClick={onClick} className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-ink/4">
        {content}
      </motion.button>
    );
  return <div className="flex w-full items-center gap-3 px-4 py-3">{content}</div>;
}

export { defaultSettings };
