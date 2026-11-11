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
} from "lucide-react";
import { useEffect, useState } from "react";
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

type AccountPrivacy = { whoCanMessage: "everyone" | "following" | "campus"; showFollowers: boolean; showFollowing: boolean; showOnlineStatus: boolean; showActivity: boolean; allowPostInteractions: boolean; showReadReceipts: boolean };
type NotificationPreferences = { likes: boolean; comments: boolean; replies: boolean; followers: boolean; mentions: boolean; reposts: boolean; messages: boolean; announcements: boolean; administrative: boolean };
type SafetyFollowRequest = { _id: string; requesterId: { _id: string; name: string; username: string; avatar?: string } };
const defaultAccountPrivacy: AccountPrivacy = { whoCanMessage: "everyone", showFollowers: true, showFollowing: true, showOnlineStatus: true, showActivity: true, allowPostInteractions: true, showReadReceipts: true };
const defaultNotificationPreferences: NotificationPreferences = { likes: true, comments: true, replies: true, followers: true, mentions: true, reposts: true, messages: true, announcements: true, administrative: true };

export default function SettingsPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { settings, update, reset, resolved } = useTheme();
  const { me, apiUserId, conversations, notifications, posts } = useStore();
  const { toast, confirm } = useSystem();
  const [accountSettings, setAccountSettings] = useState({ isPrivate: false, privacy: defaultAccountPrivacy, notificationPreferences: defaultNotificationPreferences });
  const [accountSettingsLoading, setAccountSettingsLoading] = useState(false);
  const [accountSettingsSaving, setAccountSettingsSaving] = useState(false);
  const [section, setSection] = useState<SectionId>((params.get("tab") as SectionId) ?? "account");
  const [wallpaperSheet, setWallpaperSheet] = useState(false);
  const [passwordSheet, setPasswordSheet] = useState(false);
  const [deleteAccountSheet, setDeleteAccountSheet] = useState(false);
  const [deleteAccountPassword, setDeleteAccountPassword] = useState("");
  const [deleteAccountConfirmation, setDeleteAccountConfirmation] = useState("");
  const [deleteAccountBusy, setDeleteAccountBusy] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState<{ _id: string; name: string; username: string; avatar?: string }[]>([]);
  const [followRequests, setFollowRequests] = useState<SafetyFollowRequest[]>([]);
  const [safetyLoading, setSafetyLoading] = useState(false);

  useEffect(() => {
    let live = true;
    if (!apiUserId) { setAccountSettingsLoading(false); return; }
    setAccountSettingsLoading(true);
    void request<{ user: { isPrivate?: boolean; privacy?: Partial<typeof defaultAccountPrivacy>; notificationPreferences?: Partial<typeof defaultNotificationPreferences> } }>("/users/me")
      .then(({ user }) => { if (live) setAccountSettings({ isPrivate: user.isPrivate ?? false, privacy: { ...defaultAccountPrivacy, ...user.privacy }, notificationPreferences: { ...defaultNotificationPreferences, ...user.notificationPreferences } }); })
      .catch((error) => { if (live) toast({ title: "Could not load account preferences", description: error instanceof Error ? error.message : "Try again.", tone: "error" }); })
      .finally(() => { if (live) setAccountSettingsLoading(false); });
    return () => { live = false; };
  }, [apiUserId, toast]);

  const saveAccountSettings = async (patch: Record<string, unknown>) => {
    setAccountSettingsSaving(true);
    try {
      const { settings: saved } = await request<{ settings: { isPrivate?: boolean; privacy?: Partial<typeof defaultAccountPrivacy>; notificationPreferences?: Partial<typeof defaultNotificationPreferences> } }>("/users/me/settings", { method: "PATCH", body: JSON.stringify(patch) });
      setAccountSettings((previous) => ({ isPrivate: saved.isPrivate ?? previous.isPrivate, privacy: { ...previous.privacy, ...saved.privacy }, notificationPreferences: { ...previous.notificationPreferences, ...saved.notificationPreferences } }));
      toast({ title: "Account preferences saved", tone: "success" });
    } catch (error) {
      toast({ title: "Account preferences weren’t saved", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally { setAccountSettingsSaving(false); }
  };
  const loadSafetyItems = async () => {
    if (!apiUserId) return;
    setSafetyLoading(true);
    try {
      const [blocked, requests] = await Promise.all([
        request<{ items: typeof blockedUsers }>("/users/blocked"),
        request<{ items: SafetyFollowRequest[] }>("/follow-requests/incoming"),
      ]);
      setBlockedUsers(blocked.items);
      setFollowRequests(requests.items);
    } catch (error) {
      toast({ title: "Safety settings couldn’t be loaded", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally { setSafetyLoading(false); }
  };
  useEffect(() => { if (section === "safety") void loadSafetyItems(); }, [section, apiUserId]);
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
                  <Row icon={<Trash2 className="h-4 w-4" />} label="Delete account" hint="Permanently remove your account and personal content" danger onClick={() => setDeleteAccountSheet(true)} />
                  <Row
                    icon={<LogOut className="h-4 w-4" />}
                    label="Log out"
                    hint="End your CampusLaugh session"
                    danger
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
                  <Row icon={<Shield className="h-4 w-4" />} label="Private account" hint="Only approved followers can see your posts" trailing={<Switch checked={accountSettings.isPrivate} disabled={accountSettingsLoading || accountSettingsSaving || !apiUserId} label="Private account" onChange={(value) => void saveAccountSettings({ isPrivate: value })} />} />
                  <div className="px-4 py-3.5">
                    <p className="text-[13px] font-bold text-ink">Who can message me</p>
                    <p className="mb-2.5 text-[11.5px] text-ink3">Saved to your account and enforced for new messages</p>
                    <Segmented
                      value={accountSettings.privacy.whoCanMessage}
                      onChange={(whoCanMessage) => void saveAccountSettings({ privacy: { whoCanMessage } })}
                      options={[
                        { value: "everyone", label: "Everyone" },
                        { value: "campus", label: "My campus" },
                        { value: "following", label: "Following" },
                      ]}
                    />
                  </div>
                  {([
                    ["showFollowers", "Show followers", "Allow people who can view your profile to see your followers."],
                    ["showFollowing", "Show following", "Allow people who can view your profile to see who you follow."],
                    ["showOnlineStatus", "Show online status", "Show when your account is active."],
                    ["showActivity", "Show activity", "Allow your activity to appear in discovery."],
                    ["allowPostInteractions", "Allow post interactions", "Allow likes and comments on your posts."],
                    ["showReadReceipts", "Send read receipts", "Let message senders see when you have read their messages."],
                  ] as const).map(([key, label, hint]) => <Row key={key} icon={<Eye className="h-4 w-4" />} label={label} hint={hint} trailing={<Switch checked={accountSettings.privacy[key]} disabled={accountSettingsLoading || accountSettingsSaving || !apiUserId} label={label} onChange={(value) => void saveAccountSettings({ privacy: { [key]: value } })} />} />)}
                </Group>
              )}

              {section === "notifications" && (
                <Group title="Notifications">
                  <Toggle setting="banners" label="Floating banners" hint="System-style banners at the top of the screen" icon={<Bell className="h-4 w-4" />} />
                  <Toggle setting="island" label="Capsule alerts" hint="CampusLaugh's floating capsule for live activity" icon={<Radio className="h-4 w-4" />} />
                  {([
                    ["likes", "Likes"], ["comments", "Comments"], ["replies", "Replies"], ["followers", "New followers"], ["mentions", "Mentions"], ["reposts", "Reposts"], ["messages", "Direct messages"], ["announcements", "Announcements"], ["administrative", "Administrative notices"],
                  ] as const).map(([key, label]) => <Row key={key} icon={<Bell className="h-4 w-4" />} label={label} trailing={<Switch checked={accountSettings.notificationPreferences[key]} disabled={accountSettingsLoading || accountSettingsSaving || !apiUserId} label={label} onChange={(value) => void saveAccountSettings({ notificationPreferences: { [key]: value } })} />} />)}
                  <Toggle setting="sound" label="Sound" hint="Plays a soft tone after your first tap" icon={<Volume2 className="h-4 w-4" />} />
                  <Toggle setting="vibration" label="Vibration" hint="Where the device supports it" icon={<Vibrate className="h-4 w-4" />} />
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
                </Group>
              )}

              {section === "safety" && (
                <Group title="Safety">
                  <div className="px-4 py-3.5"><p className="text-[13px] font-bold text-ink">Follow requests</p>{safetyLoading ? <p className="py-3 text-sm text-ink3">Loading requests…</p> : followRequests.length ? <div className="mt-2 space-y-2">{followRequests.map((item) => <div key={item._id} className="flex items-center gap-2 rounded-2xl border border-line p-2.5"><Avatar src={item.requesterId.avatar} name={item.requesterId.name} size={36}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{item.requesterId.name}</p><p className="text-xs text-ink3">@{item.requesterId.username}</p></div><Button size="xs" variant="brand" onClick={async()=>{try{await request(`/follow-requests/${item._id}`,{method:"PATCH",body:JSON.stringify({status:"accepted"})});await loadSafetyItems();toast({title:"Follow request accepted",tone:"success"})}catch(error){toast({title:"Request wasn’t updated",description:error instanceof Error?error.message:"Try again.",tone:"error"})}}}>Accept</Button><Button size="xs" variant="outline" onClick={async()=>{try{await request(`/follow-requests/${item._id}`,{method:"PATCH",body:JSON.stringify({status:"rejected"})});await loadSafetyItems()}catch(error){toast({title:"Request wasn’t updated",description:error instanceof Error?error.message:"Try again.",tone:"error"})}}}>Decline</Button></div>)}</div> : <p className="py-3 text-sm text-ink3">No pending follow requests.</p>}</div>
                  <div className="px-4 py-3.5"><p className="text-[13px] font-bold text-ink">Blocked accounts</p>{safetyLoading ? <p className="py-3 text-sm text-ink3">Loading blocked accounts…</p> : blockedUsers.length ? <div className="mt-2 space-y-2">{blockedUsers.map((user) => <div key={user._id} className="flex items-center gap-2 rounded-2xl border border-line p-2.5"><Avatar src={user.avatar} name={user.name} size={36}/><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-ink">{user.name}</p><p className="text-xs text-ink3">@{user.username}</p></div><Button size="xs" variant="outline" onClick={async()=>{try{await request(`/users/${user._id}/block`,{method:"DELETE"});setBlockedUsers((items)=>items.filter((item)=>item._id!==user._id));toast({title:`@${user.username} unblocked`,tone:"success"})}catch(error){toast({title:"Could not unblock account",description:error instanceof Error?error.message:"Try again.",tone:"error"})}}}>Unblock</Button></div>)}</div> : <p className="py-3 text-sm text-ink3">No blocked accounts.</p>}</div>
                  <Row icon={<BellOff className="h-4 w-4" />} label="Muted conversations" hint={`${conversations.filter((c) => c.muted).length} muted`} onClick={() => navigate("/chats")} />
                </Group>
              )}

              {section === "about" && (
                <Group title="About this build">
                  <div className="px-4 py-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={apiUserId ? "mint" : "neutral"}>{apiUserId ? "Authenticated API" : "Sign in required"}</Badge>
                      <Badge>Liquid Glass 27</Badge>
                    </div>
                    <p className="mt-3 text-[13px] leading-relaxed text-ink2">
                      CampusLaugh is a student social platform for memes, pictures, videos, jokes, discussions and
                      messages. Feed, profile, messaging and notifications use authenticated account data from the API.
                      Appearance and interface preferences are saved in this browser.
                    </p>
                    <dl className="mt-3 grid grid-cols-2 gap-2 text-[12px]">
                      {[
                        ["Design system", "Liquid Glass 27"],
                        ["Motion", "Framer Motion springs"],
                        ["Posts loaded", String(posts.length)],
                        ["Conversations", String(conversations.length)],
                        ["Notifications", String(notifications.length)],
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
            Appearance preferences are saved in this browser. Account content is loaded from CampusLaugh.
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
      <BottomSheet open={deleteAccountSheet} onClose={() => setDeleteAccountSheet(false)} title="Delete account" desktop="center" className="max-h-none">
        <form className="space-y-3 p-4" onSubmit={async (event) => {
          event.preventDefault();
          if (deleteAccountConfirmation !== "DELETE") return toast({ title: "Type DELETE to confirm", tone: "error" });
          if (!deleteAccountPassword) return toast({ title: "Enter your current password", tone: "error" });
          setDeleteAccountBusy(true);
          try {
            const result = await request<{ mediaCleanupComplete: boolean }>("/users/me", { method: "DELETE", body: JSON.stringify({ currentPassword: deleteAccountPassword, confirmation: deleteAccountConfirmation }) });
            setAccessToken(null);
            setDeleteAccountSheet(false);
            if (!result.mediaCleanupComplete) toast({ title: "Account deleted", description: "Your account data was removed, but some external media may need administrator cleanup.", tone: "warning" });
            navigate("/login", { replace: true });
          } catch (error) {
            toast({ title: "Account wasn’t deleted", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
          } finally { setDeleteAccountBusy(false); }
        }}>
          <p className="rounded-2xl border border-coral/30 bg-coral/10 p-3 text-sm text-ink2">Your posts, comments, notifications and direct conversations will be removed. Messages in shared groups will be cleared, and your group memberships will end. This cannot be undone.</p>
          <label className="block"><span className="mb-1 block text-xs font-bold text-ink2">Current password</span><input className="field h-11 w-full rounded-xl px-3 text-sm" type="password" autoComplete="current-password" value={deleteAccountPassword} onChange={(event) => setDeleteAccountPassword(event.target.value)} required /></label>
          <label className="block"><span className="mb-1 block text-xs font-bold text-ink2">Type DELETE to confirm</span><input className="field h-11 w-full rounded-xl px-3 text-sm" value={deleteAccountConfirmation} onChange={(event) => setDeleteAccountConfirmation(event.target.value)} autoComplete="off" required /></label>
          <Button type="submit" variant="danger" block loading={deleteAccountBusy} icon={<Trash2 className="h-4 w-4" />}>Delete my account</Button>
        </form>
      </BottomSheet>

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
