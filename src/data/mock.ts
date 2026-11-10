import type { AppNotification, Conversation, MediaItem, Message, Post, User } from "@/types";

/* ------------------------------------------------------------------
   CampusLaugh demonstration data.
   Everything in this file is static mock content used by the
   frontend only. The service layer in `src/services/api.ts` is the
   single seam where a real backend can later be plugged in.
   ------------------------------------------------------------------ */

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;
const now = Date.now();

const px = (id: number, w = 200, h = 200) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=${h}&w=${w}`;

const img = (id: number, w = 940, h = 700) =>
  `https://images.pexels.com/photos/${id}/pexels-photo-${id}.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=${h}&w=${w}`;

const m = (
  id: string,
  src: string,
  alt: string,
  kind: MediaItem["kind"] = "image",
  poster?: string,
): MediaItem => ({ id, kind, src, alt, poster });

export const CAMPUS_LAUGH = {
  name: "CampusLaugh",
  tagline: "Your campus. Your people. Your laughs.",
  version: "27.1 · Liquid Glass",
};

/* ------------------------------ users ------------------------------ */

export const ME = "me";

export const users: Record<string, User> = {
  [ME]: {
    id: ME,
    username: "tobilol",
    name: "Tobi Adeyemi",
    institution: "University of Lagos",
    campus: "UNILAG · Akoka",
    avatar: px(29615996),
    cover: img(7972544, 1400, 500),
    bio: "400L Computer Science. I collect bad lecture jokes and great hostel stories. Founder of @campuslaugh 🍋",
    course: "B.Sc Computer Science · 400 Level",
    followers: 4820,
    following: 612,
    verified: true,
    online: true,
  },
  u1: {
    id: "u1",
    username: "zainab.jpeg",
    name: "Zainab Yusuf",
    institution: "Covenant University",
    campus: "Covenant · Ota",
    avatar: px(40322798),
    bio: "Design nerd. Poster goddess. I will roast your UI.",
    followers: 12400,
    following: 380,
    verified: true,
    online: true,
  },
  u2: {
    id: "u2",
    username: "kwamevibes",
    name: "Kwame Mensah",
    institution: "University of Ghana",
    campus: "UG · Legon",
    avatar: px(6102841),
    bio: "Hall President 🏛️ Jollof disputes resolved here.",
    followers: 8930,
    following: 512,
    online: true,
  },
  u3: {
    id: "u3",
    username: "chidibantuu",
    name: "Chidi Nwosu",
    institution: "University of Lagos",
    campus: "UNILAG · Akoka",
    avatar: px(5554275),
    bio: "Medicine student with zero sleep and 100% humour.",
    followers: 2210,
    following: 903,
    lastSeen: `${Math.round(now / MIN) % 60}m ago`,
  },
  u4: {
    id: "u4",
    username: "aminah.exe",
    name: "Amina Hassan",
    institution: "Ahmadu Bello University",
    campus: "ABU · Zaria",
    avatar: px(3936894),
    bio: "Software engineering, tea, and existential group chats.",
    followers: 6540,
    following: 240,
    verified: true,
    online: true,
  },
  u5: {
    id: "u5",
    username: "siphoza",
    name: "Sipho Dlamini",
    institution: "University of Cape Town",
    campus: "UCT · Rondebosch",
    avatar: px(36586364),
    bio: "Kasi comedy. I turn lectures into skits.",
    followers: 18700,
    following: 154,
    verified: true,
  },
  u6: {
    id: "u6",
    username: "njeri.dev",
    name: "Njeri Kamau",
    institution: "University of Nairobi",
    campus: "UoN · Main",
    avatar: px(34930167),
    bio: "Building things. Breaking curfew.",
    followers: 3320,
    following: 688,
    online: true,
  },
  u7: {
    id: "u7",
    username: "fatimas",
    name: "Fatima Sallah",
    institution: "KNUST",
    campus: "KNUST · Kumasi",
    avatar: px(16160871),
    bio: "Architecture student. My drafts are funnier than my jokes.",
    followers: 5110,
    following: 421,
  },
  u8: {
    id: "u8",
    username: "emekameme",
    name: "Emeka Obi",
    institution: "University of Nigeria, Nsukka",
    campus: "UNN · Nsukka",
    avatar: px(27544052),
    bio: "Lion of the meme jungle 🦁",
    followers: 9820,
    following: 733,
  },
  u9: {
    id: "u9",
    username: "leratom",
    name: "Lerato Mokoena",
    institution: "Wits University",
    campus: "Wits · Braamfontein",
    avatar: px(34081654),
    bio: "Law, but make it funny.",
    followers: 7410,
    following: 289,
    online: true,
  },
  u10: {
    id: "u10",
    username: "kwesi",
    name: "Kwesi Appiah",
    institution: "Ashesi University",
    campus: "Ashesi · Berekuso",
    avatar: px(29790577),
    bio: "Robotics club. I laugh at my own bugs.",
    followers: 1980,
    following: 344,
  },
  u11: {
    id: "u11",
    username: "toludeb",
    name: "Tolu Adewale",
    institution: "Lagos State University",
    campus: "LASU · Ojo",
    avatar: px(27300388),
    bio: "Final year. Barely. Comedian. Always.",
    followers: 4402,
    following: 610,
  },
  anon: {
    id: "anon",
    username: "anonymous",
    name: "Anonymous",
    institution: "Hidden identity",
    campus: "Unknown",
    avatar: "",
    bio: "Posting without a name tag.",
    followers: 0,
    following: 0,
  },
  campus_ila: {
    id: "campus_ila",
    username: "campuslaugh",
    name: "CampusLaugh HQ",
    institution: "All campuses",
    campus: "Pan-African",
    avatar: px(7972508),
    bio: "Official account. Weekly laughs, campus announcements and meme of the day.",
    followers: 214000,
    following: 12,
    verified: true,
    online: true,
  },
};

export const userArray = Object.values(users).filter((u) => u.id !== "anon");

/* ------------------------------ videos ------------------------------ */

const V1 = "https://videos.pexels.com/video-files/7683405/7683405-hd_1920_1080_30fps.mp4";
const V1P =
  "https://images.pexels.com/videos/7683405/pexels-photo-7683405.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200";
const V2 = "https://videos.pexels.com/video-files/7683403/7683403-hd_1080_1920_30fps.mp4";
const V2P =
  "https://images.pexels.com/videos/7683403/pexels-photo-7683403.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=1200&w=630";
const V3 = "https://videos.pexels.com/video-files/7683866/7683866-hd_1920_1080_30fps.mp4";
const V3P =
  "https://images.pexels.com/videos/7683866/adult-campus-chair-coffee-7683866.jpeg?auto=compress&cs=tinysrgb&fit=crop&h=630&w=1200";

/* ------------------------------- posts ------------------------------ */

export const posts: Post[] = [
  {
    id: "p1",
    authorId: "u5",
    campus: "UCT · Rondebosch",
    text: "Lecturer: “This question is very simple.”\nThe whole class: *collective trauma*\n\n9 weeks of content compressed into 4 lectures and they expect us to be fine 😭 #FinalYearMood #ExamSeason",
    media: [m("p1m1", img(7972544, 1200, 800), "Students grouped together on campus")],
    hashtags: ["FinalYearMood", "ExamSeason"],
    createdAt: now - 12 * MIN,
    likes: 1284,
    reposts: 214,
    views: 48210,
    comments: [
      {
        id: "c1",
        authorId: "u1",
        text: "“Simple” is their favourite horror genre 💀",
        createdAt: now - 9 * MIN,
        likes: 142,
        replies: [
          { id: "c1r1", authorId: "u5", text: "FR. They whisper it right before the massacre.", createdAt: now - 7 * MIN, likes: 38 },
        ],
      },
      { id: "c2", authorId: "u3", text: "I felt this in my spine. Med school edition.", createdAt: now - 6 * MIN, likes: 51 },
    ],
  },
  {
    id: "p2",
    authorId: "u1",
    campus: "Covenant · Ota",
    text: "Redesigned the whole faculty poster at 2am because the first one was committing crimes against typography. No notes. 🍋 #DesignLife",
    media: [
      m("p2m1", img(37882792, 800, 1000), "Students chatting in a sunlit corridor"),
      m("p2m2", img(30714883, 800, 1000), "Friends laughing outdoors on campus"),
    ],
    hashtags: ["DesignLife"],
    createdAt: now - 48 * MIN,
    likes: 3411,
    liked: true,
    reposts: 502,
    views: 91230,
    comments: [
      { id: "c3", authorId: "u4", text: "The kerning alone deserves a scholarship.", createdAt: now - 40 * MIN, likes: 210 },
      { id: "c4", authorId: ME, text: "This is the standard. Everyone else take notes 📝", createdAt: now - 31 * MIN, likes: 88 },
    ],
  },
  {
    id: "p3",
    authorId: "u2",
    campus: "UG · Legon",
    text: "POV: hall week and the whole campus just moves as one 😮‍💨",
    media: [m("p3m1", V1, "Students having fun on campus", "video", V1P)],
    hashtags: ["HallWeek", "CampusCulture"],
    createdAt: now - 2 * HOUR,
    likes: 8720,
    reposts: 1902,
    views: 402110,
    comments: [
      { id: "c5", authorId: "u9", text: "The energy!!! We need this at Wits 😩", createdAt: now - 100 * MIN, likes: 64 },
      { id: "c6", authorId: "u6", text: "Saved this for my highlight reel.", createdAt: now - 88 * MIN, likes: 22 },
    ],
  },
  {
    id: "p4",
    authorId: "anon",
    anonymous: true,
    campus: "UNILAG · Akoka",
    text: "Anonymous confession: I've been using the same “sorry I had network issues” excuse for three deadlines. My lecturer now asks about my data plan before asking for the assignment. #HostelChronicles",
    hashtags: ["HostelChronicles"],
    createdAt: now - 3 * HOUR,
    likes: 5210,
    reposts: 940,
    views: 188400,
    comments: [
      { id: "c7", authorId: "u3", text: "Bro the lecturer is tracking your MTN 😭", createdAt: now - 2.6 * HOUR, likes: 402 },
      { id: "c8", authorId: "u11", text: "This is me and I am tired of pretending.", createdAt: now - 2 * HOUR, likes: 188 },
    ],
  },
  {
    id: "p5",
    authorId: "u4",
    campus: "ABU · Zaria",
    text: "Debugging at 1am is a spiritual activity. The bug isn't in the code, it's in my decisions. #CodingLife",
    media: [m("p5m1", img(37071199, 1200, 780), "Students filming content with a stabilizer")],
    hashtags: ["CodingLife"],
    createdAt: now - 5 * HOUR,
    likes: 2290,
    reposts: 311,
    views: 61120,
    comments: [{ id: "c9", authorId: ME, text: "console.log('here 4') is my personality now.", createdAt: now - 4 * HOUR, likes: 130 }],
  },
  {
    id: "p6",
    authorId: "u11",
    campus: "LASU · Ojo",
    text: "Which one is your hostel reality? Vote before I make it a skit 👇",
    hashtags: ["RoommateStories"],
    createdAt: now - 6 * HOUR,
    likes: 940,
    reposts: 88,
    views: 22300,
    poll: {
      question: "The worst part of hostel life is…",
      options: [
        { id: "o1", label: "Water runs at 3am only", votes: 1820 },
        { id: "o2", label: "Roommate's alarm (not yours)", votes: 2411 },
        { id: "o3", label: "NEPA / power cuts mid-assignment", votes: 3104 },
        { id: "o4", label: "Shared kitchen politics", votes: 760 },
      ],
    },
    comments: [{ id: "c10", authorId: "u7", text: "Option 3 chose violence today.", createdAt: now - 5 * HOUR, likes: 44 }],
  },
  {
    id: "p7",
    authorId: "u6",
    campus: "UoN · Main",
    text: "Filmed our group project presentation like it's a music video. Professor gave us an A and asked for the raw footage 😂",
    media: [m("p7m1", V3, "Friends having a conversation on campus", "video", V3P)],
    hashtags: ["CampusCreators"],
    createdAt: now - 9 * HOUR,
    likes: 6110,
    reposts: 1204,
    views: 231000,
    comments: [
      { id: "c11", authorId: "u2", text: "Send the link, this is going viral.", createdAt: now - 8 * HOUR, likes: 71 },
      { id: "c12", authorId: "u10", text: "Cinematography for a distinction. Respect.", createdAt: now - 7 * HOUR, likes: 39 },
    ],
  },
  {
    id: "p8",
    authorId: "campus_ila",
    campus: "Pan-African",
    text: "🍋 MEME OF THE WEEK is live! 40 campuses submitted, 1 winner takes the CampusLaugh trophy + a data bundle. Tag the friend who needs to enter. #MemeOfTheWeek",
    media: [m("p8m1", img(7972508, 1200, 800), "Two university students chatting outdoors")],
    hashtags: ["MemeOfTheWeek"],
    createdAt: now - 11 * HOUR,
    likes: 15220,
    reposted: true,
    reposts: 4821,
    views: 892000,
    comments: [
      { id: "c13", authorId: "u9", text: "Entering with my whole law faculty energy.", createdAt: now - 10 * HOUR, likes: 512 },
      { id: "c14", authorId: "u8", text: "@tobilol we're collabing on this one.", createdAt: now - 9.4 * HOUR, likes: 240, },
    ],
  },
  {
    id: "p9",
    authorId: "u8",
    campus: "UNN · Nsukka",
    text: "The way my roommate narrates his village stories with sound effects — this man deserves a Netflix special. #RoommateStories",
    hashtags: ["RoommateStories"],
    createdAt: now - 14 * HOUR,
    likes: 3320,
    reposts: 402,
    views: 74110,
    comments: [],
  },
  {
    id: "p10",
    authorId: "u7",
    campus: "KNUST · Kumasi",
    text: "Studio critique day. They said my model looked like a “very confident mistake”. Sir, that's brutalism.",
    media: [
      m("p10m1", img(6140610, 800, 1000), "Students walking through a university corridor"),
      m("p10m2", img(39192315, 800, 1000), "Graduates celebrating outdoors"),
      m("p10m3", img(31040289, 800, 1000), "Graduation portrait with a bouquet"),
    ],
    hashtags: ["StudioLife", "Architecture"],
    createdAt: now - 20 * HOUR,
    likes: 4410,
    reposts: 611,
    views: 121300,
    comments: [{ id: "c15", authorId: "u1", text: "Confident mistake is a whole design movement 😭", createdAt: now - 19 * HOUR, likes: 288 }],
  },
  {
    id: "p11",
    authorId: ME,
    campus: "UNILAG · Akoka",
    text: "Shipped a tiny feature tonight and 400 people used it before I slept. Small wins, big feelings. Thank you for laughing with me 🍋 #BuildInPublic",
    media: [m("p11m1", V2, "Two friends walking and talking", "video", V2P)],
    hashtags: ["BuildInPublic"],
    createdAt: now - 26 * HOUR,
    likes: 1880,
    reposts: 122,
    views: 40210,
    comments: [
      { id: "c16", authorId: "u4", text: "Proud of you. Now sleep.", createdAt: now - 25 * HOUR, likes: 90 },
      { id: "c17", authorId: "u5", text: "The consistency is the flex.", createdAt: now - 24 * HOUR, likes: 61 },
    ],
  },
  {
    id: "p12",
    authorId: "u9",
    campus: "Wits · Braamfontein",
    text: "Law school taught me to argue. CampusLaugh taught me to lose the argument but win the comments section. #CampusDebates",
    hashtags: ["CampusDebates"],
    createdAt: now - 30 * HOUR,
    likes: 2710,
    reposts: 240,
    views: 58110,
    comments: [],
  },
  {
    id: "p13",
    authorId: "u3",
    campus: "UNILAG · Akoka",
    text: "Cafeteria rice has a personal vendetta against my digestive system yet I keep going back. This is what love looks like. #CampusFood",
    hashtags: ["CampusFood"],
    createdAt: now - 2 * DAY,
    likes: 1520,
    reposts: 90,
    views: 31200,
    comments: [{ id: "c18", authorId: "u11", text: "The rice is a relationship, not a meal.", createdAt: now - 44 * HOUR, likes: 77 }],
  },
  {
    id: "p14",
    authorId: "u10",
    campus: "Ashesi · Berekuso",
    text: "Our robotics club bot just waved at the dean. He waved back and asked if it could sit exams. Sir… please no.",
    hashtags: ["CampusInnovation"],
    createdAt: now - 3 * DAY,
    likes: 3980,
    reposts: 502,
    views: 88210,
    comments: [],
  },
];

/* -------------------------- trending / explore ---------------------- */

export const trending = [
  { tag: "HostelChronicles", posts: 12400, delta: "+38%" },
  { tag: "FinalYearMood", posts: 9810, delta: "+21%" },
  { tag: "MemeOfTheWeek", posts: 8420, delta: "+120%" },
  { tag: "CampusFood", posts: 6210, delta: "+9%" },
  { tag: "LectureNotes", posts: 5400, delta: "-4%" },
  { tag: "RoommateStories", posts: 4110, delta: "+16%" },
  { tag: "CodingLife", posts: 3820, delta: "+27%" },
  { tag: "ExamSeason", posts: 3310, delta: "+52%" },
];

export const campusAnnouncements = [
  {
    id: "a1",
    campus: "UNILAG · Akoka",
    title: "Comedy Night — Main Auditorium",
    body: "Friday 7pm. 12 student comedians, one trophy, free popcorn until it runs out.",
    time: "Fri · 7:00 PM",
  },
  {
    id: "a2",
    campus: "Pan-African",
    title: "Meme Of The Week submissions close soon",
    body: "40 campuses competing. Submit before Sunday 11:59pm.",
    time: "Closes in 2 days",
  },
  {
    id: "a3",
    campus: "KNUST · Kumasi",
    title: "Studio critique marathon",
    body: "Bring your model, bring your confidence, leave your ego at the gate.",
    time: "Tomorrow · 10:00 AM",
  },
];

export const recentSearches = ["hostel stories", "#CampusFood", "zainab.jpeg", "comedy night UNILAG"];

/* --------------------------- conversations -------------------------- */

const msg = (
  partial: Omit<Message, "conversationId"> & { conversationId: string },
): Message => partial as Message;

export const conversations: Conversation[] = [
  {
    id: "cv1",
    participantIds: ["u1"],
    pinned: true,
    unread: 2,
    typing: false,
    wallpaper: "midnight",
    messages: [
      msg({ id: "m1", conversationId: "cv1", authorId: "u1", mine: false, kind: "text", text: "Did you see the poster I sent? Be honest 😬", createdAt: now - 3 * HOUR, status: "read" }),
      msg({ id: "m2", conversationId: "cv1", authorId: ME, mine: true, kind: "text", text: "Honest? It's insane. The type hierarchy is doing gymnastics.", createdAt: now - 3 * HOUR + 2 * MIN, status: "read" }),
      msg({ id: "m3", conversationId: "cv1", authorId: "u1", mine: false, kind: "text", text: "STOP 😭 I've been staring at it since 6am", createdAt: now - 3 * HOUR + 3 * MIN, status: "read", reactions: [{ emoji: "😂", count: 1, byMe: true }] }),
      msg({ id: "m4", conversationId: "cv1", authorId: "u1", mine: false, kind: "image", media: m("m4i", img(37882792, 900, 1200), "Corridor poster mock"), text: "v2 with the lime accent", createdAt: now - 40 * MIN, status: "read" }),
      msg({ id: "m5", conversationId: "cv1", authorId: ME, mine: true, kind: "text", text: "v2 wins. Ship it 🍋", createdAt: now - 38 * MIN, status: "read", edited: true }),
      msg({ id: "m6", conversationId: "cv1", authorId: "u1", mine: false, kind: "text", text: "Also — the comedy night lineup just dropped, you're hosting right?", createdAt: now - 12 * MIN, status: "delivered" }),
      msg({ id: "m7", conversationId: "cv1", authorId: "u1", mine: false, kind: "text", text: "Please say yes before I volunteer you 😂", createdAt: now - 11 * MIN, status: "delivered" }),
    ],
  },
  {
    id: "cv2",
    participantIds: ["u2", "u4", "u6", "u9"],
    group: true,
    title: "Meme Council 🍋",
    unread: 5,
    wallpaper: "aurora",
    messages: [
      msg({ id: "g1", conversationId: "cv2", authorId: "u2", mine: false, kind: "text", text: "Council meeting. Submissions are due Sunday.", createdAt: now - 6 * HOUR, status: "read" }),
      msg({ id: "g2", conversationId: "cv2", authorId: "u9", mine: false, kind: "text", text: "I have three from Wits that will end careers", createdAt: now - 6 * HOUR + 4 * MIN, status: "read", reactions: [{ emoji: "🔥", count: 3 }] }),
      msg({ id: "g3", conversationId: "cv2", authorId: ME, mine: true, kind: "text", text: "Send them to the shared drive, I'll queue them for review", createdAt: now - 5 * HOUR, status: "read" }),
      msg({ id: "g4", conversationId: "cv2", authorId: "u4", mine: false, kind: "voice", duration: 24, text: "Voice message", createdAt: now - 90 * MIN, status: "delivered" }),
      msg({ id: "g5", conversationId: "cv2", authorId: "u6", mine: false, kind: "text", text: "Amina just described the UNILAG cafeteria in 24 seconds. I'm crying.", createdAt: now - 88 * MIN, status: "delivered", replyTo: { id: "g4", authorId: "u4", text: "Voice message · 0:24" } }),
      msg({ id: "g6", conversationId: "cv2", authorId: "u2", mine: false, kind: "text", text: "Also someone leaked the results sheet 😭😭", createdAt: now - 22 * MIN, status: "sent" }),
    ],
  },
  {
    id: "cv3",
    participantIds: ["u5"],
    unread: 0,
    muted: true,
    wallpaper: "graphite",
    messages: [
      msg({ id: "s1", conversationId: "cv3", authorId: "u5", mine: false, kind: "text", text: "Your video post is doing numbers in Cape Town", createdAt: now - 20 * HOUR, status: "read" }),
      msg({ id: "s2", conversationId: "cv3", authorId: ME, mine: true, kind: "text", text: "No way. How many views?", createdAt: now - 20 * HOUR + 5 * MIN, status: "read" }),
      msg({ id: "s3", conversationId: "cv3", authorId: "u5", mine: false, kind: "text", text: "400K and climbing. You owe us a collab.", createdAt: now - 19 * HOUR, status: "read", reactions: [{ emoji: "🤯", count: 1, byMe: true }] }),
      msg({ id: "s4", conversationId: "cv3", authorId: "u5", mine: false, kind: "text", text: "This message was deleted", createdAt: now - 18 * HOUR, status: "read", deleted: true }),
    ],
  },
  {
    id: "cv4",
    participantIds: ["u3"],
    unread: 0,
    messages: [
      msg({ id: "d1", conversationId: "cv4", authorId: ME, mine: true, kind: "text", text: "Did you submit the assignment?", createdAt: now - 2 * DAY, status: "read" }),
      msg({ id: "d2", conversationId: "cv4", authorId: "u3", mine: false, kind: "text", text: "Brother. I submitted my soul.", createdAt: now - 2 * DAY + 6 * MIN, status: "read" }),
      msg({ id: "d3", conversationId: "cv4", authorId: "u3", mine: false, kind: "document", fileName: "Med-Surgery-Notes-Wk9.pdf", fileSize: "2.4 MB", text: "Here, you'll need it", createdAt: now - 2 * DAY + 7 * MIN, status: "read" }),
      msg({ id: "d4", conversationId: "cv4", authorId: ME, mine: true, kind: "text", text: "You're a lifesaver. Truly.", createdAt: now - 2 * DAY + 20 * MIN, status: "read", reactions: [{ emoji: "❤️", count: 1 }] }),
    ],
  },
  {
    id: "cv5",
    participantIds: ["campus_ila"],
    unread: 1,
    pinned: true,
    messages: [
      msg({ id: "h1", conversationId: "cv5", authorId: "campus_ila", mine: false, kind: "text", text: "🍋 Reminder: Comedy Night auditions open Monday. Reply AUDIT to get the form.", createdAt: now - 8 * HOUR, status: "delivered" }),
    ],
  },
  {
    id: "cv6",
    participantIds: ["u7"],
    unread: 0,
    archived: true,
    messages: [
      msg({ id: "i1", conversationId: "cv6", authorId: "u7", mine: false, kind: "text", text: "Sent you the studio photos", createdAt: now - 4 * DAY, status: "read" }),
      msg({ id: "i2", conversationId: "cv6", authorId: ME, mine: true, kind: "text", text: "Got them, thank you!", createdAt: now - 4 * DAY + 12 * MIN, status: "read" }),
    ],
  },
  {
    id: "cv7",
    participantIds: ["u8"],
    unread: 0,
    messages: [
      msg({ id: "j1", conversationId: "cv7", authorId: "u8", mine: false, kind: "video", media: { id: "j1v", kind: "video", src: V3, poster: V3P, alt: "Campus clip" }, text: "Watch till the end 😂", createdAt: now - 30 * HOUR, status: "read" }),
      msg({ id: "j2", conversationId: "cv7", authorId: ME, mine: true, kind: "text", text: "THE ENDING 💀💀 I can't", createdAt: now - 29 * HOUR, status: "read" }),
    ],
  },
];

/* --------------------------- notifications -------------------------- */

export const notifications: AppNotification[] = [
  { id: "n1", kind: "like", actorId: "u1", title: "Zainab Yusuf liked your post", body: "“Shipped a tiny feature tonight and 400 people used it…”", createdAt: now - 4 * MIN, read: false, postId: "p11", to: "/home" },
  { id: "n2", kind: "message", actorId: "u1", title: "Zainab Yusuf sent you a message", body: "Please say yes before I volunteer you 😂", preview: "Please say yes before I volunteer you 😂", createdAt: now - 11 * MIN, read: false, conversationId: "cv1", to: "/chats/cv1" },
  { id: "n3", kind: "comment", actorId: "u4", title: "Amina Hassan commented", body: "Proud of you. Now sleep.", createdAt: now - 26 * MIN, read: false, postId: "p11", to: "/home" },
  { id: "n4", kind: "follow", actorId: "u9", title: "Lerato Mokoena started following you", body: "Wits University · Law, but make it funny.", createdAt: now - 52 * MIN, read: false, to: "/profile/u9" },
  { id: "n5", kind: "mention", actorId: "u8", title: "Emeka Obi mentioned you", body: "@tobilol we're collabing on this one.", createdAt: now - 1.4 * HOUR, read: true, postId: "p8", to: "/home" },
  { id: "n6", kind: "repost", actorId: "u2", title: "Kwame Mensah reposted your post", body: "Reached 12,400 students across 6 campuses", createdAt: now - 2 * HOUR, read: true, postId: "p11", to: "/home" },
  { id: "n7", kind: "campus", actorId: "campus_ila", title: "UNILAG · Comedy Night", body: "Friday 7pm, Main Auditorium. 12 comedians, one trophy.", createdAt: now - 3 * HOUR, read: true, to: "/explore" },
  { id: "n8", kind: "like", actorId: "u5", title: "Sipho Dlamini and 213 others liked your post", body: "“Building things. Breaking curfew.”", createdAt: now - 5 * HOUR, read: true, postId: "p11", to: "/home" },
  { id: "n9", kind: "comment", actorId: "u3", title: "Chidi Nwosu replied to your comment", body: "This is me and I am tired of pretending.", createdAt: now - 7 * HOUR, read: true, postId: "p4", to: "/home" },
  { id: "n10", kind: "account", title: "Weekly recap is ready", body: "Your posts reached 48,210 students this week. +38% laughs.", createdAt: now - 10 * HOUR, read: true, to: "/profile" },
  { id: "n11", kind: "follow", actorId: "u10", title: "Kwesi Appiah started following you", body: "Ashesi University · Robotics club", createdAt: now - 14 * HOUR, read: true, to: "/profile/u10" },
  { id: "n12", kind: "message", actorId: "u2", title: "Meme Council 🍋 · Kwame Mensah", body: "Also someone leaked the results sheet 😭😭", preview: "Also someone leaked the results sheet 😭😭", createdAt: now - 22 * MIN, read: false, conversationId: "cv2", to: "/chats/cv2" },
  { id: "n13", kind: "mention", actorId: "u6", title: "Njeri Kamau mentioned you in a comment", body: "@tobilol come film ours next week", createdAt: now - 20 * HOUR, read: true, postId: "p7", to: "/home" },
  { id: "n14", kind: "like", actorId: "u7", title: "Fatima Sallah liked your comment", body: "“This is the standard. Everyone else take notes 📝”", createdAt: now - 26 * HOUR, read: true, postId: "p2", to: "/home" },
  { id: "n15", kind: "campus", actorId: "campus_ila", title: "Meme Of The Week closes Sunday", body: "40 campuses competing. Winner takes the trophy + data bundle.", createdAt: now - 28 * HOUR, read: true, to: "/explore" },
  { id: "n16", kind: "repost", actorId: "u11", title: "Tolu Adewale reposted your post", body: "Reached 3,120 LASU students", createdAt: now - 2 * DAY, read: true, postId: "p11", to: "/home" },
];

/* ------------------------- simulated activity ----------------------- */

/** Canned incoming messages used to demonstrate a live-feeling inbox. */
export const demoIncoming = [
  "Bro I just saw your post 😭😭",
  "Are you coming to the comedy night?",
  "Send me the link when you're done",
  "This is the funniest thing I've read all semester",
  "I'm outside the library, where are you?",
  "Okay but why is this actually true though",
  "Please don't post that one, my lecturer follows you 💀",
  "Voice note incoming, brace yourself",
];

export const demoReactions = ["❤️", "😂", "🔥", "👏", "😮", "😢"];

export const quickReplies = ["😂😂😂", "Say less 🍋", "On my way", "That's insane", "Fr fr"];

export const emojiGroups: { label: string; emojis: string[] }[] = [
  { label: "Frequently used", emojis: ["😂", "🍋", "🔥", "💀", "😭", "🙌", "❤️", "👀"] },
  { label: "Faces", emojis: ["😀", "😁", "😅", "🤣", "😊", "😉", "😍", "😘", "😜", "🤪", "🤔", "🤨", "😐", "😴", "🤯", "🥳", "😎", "🤓", "😬", "🥺"] },
  { label: "Gestures", emojis: ["👍", "👎", "👏", "🙌", "🤝", "🙏", "💪", "✌️", "🤞", "👌", "🫶", "👋", "☝️", "🫡"] },
  { label: "Campus", emojis: ["🎓", "📚", "✏️", "🧪", "💻", "🎤", "🎬", "⚽", "🏀", "🍕", "☕", "🚌", "🏠", "⏰", "📵"] },
  { label: "Hearts & fun", emojis: ["❤️", "🧡", "💛", "💚", "💙", "💜", "🖤", "💯", "✨", "🎉", "🎊", "🏆", "🥇", "🍿"] },
];

export const shareTargets = [
  { id: "u1", label: "Zainab Yusuf" },
  { id: "u2", label: "Kwame Mensah" },
  { id: "u4", label: "Amina Hassan" },
  { id: "u5", label: "Sipho Dlamini" },
  { id: "cv2", label: "Meme Council 🍋" },
  { id: "u9", label: "Lerato Mokoena" },
];

export const reportReasons = [
  "Harassment or bullying",
  "Hate speech",
  "Spam or scam",
  "Nudity or sexual content",
  "Violence",
  "False information",
  "Impersonation",
  "Something else",
];

export const institutions = [
  "University of Lagos",
  "Covenant University",
  "University of Ghana",
  "Ahmadu Bello University",
  "University of Cape Town",
  "University of Nairobi",
  "KNUST",
  "University of Nigeria, Nsukka",
  "Wits University",
  "Ashesi University",
  "Lagos State University",
];
