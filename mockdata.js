/* Persistent mock “backend” using localStorage.
   - stores user, courses, lastChallengeDate
   - exposes functions for XP/StudyBucks/streak/progress updates
*/

const SB_KEY = "sb_state_v1";

const SB_DEFAULT_STATE = {
  user: {
    name: "Student",
    studyBucks: 115,
    level: 1,
    xp: 350,
    xpMax: 1000,
    streak: 3,                 // computed again each day
    quizzes: 2,
    badges: 1,
    lastSeen: new Date().toISOString()
  },
  meta: {
    lastChallengeDate: null,   // ISO date when daily challenge was completed
    lastStreakDate: null       // last day user checked in
  },
  courses: [
    { id: "py101", code: "PY 101", title: "Python Programming", instructor: "Dr. Olivia Stone", progress: 35 },
    { id: "wd201", code: "WD 201", title: "HTML & Web Design", instructor: "Prof. Daniel Reed", progress: 60 },
    { id: "dm301", code: "DM 301", title: "Digital Marketing", instructor: "Dr. Sophia Green", progress: 85 }
  ]
};

function sb_load() {
  const raw = localStorage.getItem(SB_KEY);
  if (!raw) {
    localStorage.setItem(SB_KEY, JSON.stringify(SB_DEFAULT_STATE));
    return structuredClone(SB_DEFAULT_STATE);
  }
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.setItem(SB_KEY, JSON.stringify(SB_DEFAULT_STATE));
    return structuredClone(SB_DEFAULT_STATE);
  }
}

function sb_save(state) {
  localStorage.setItem(SB_KEY, JSON.stringify(state));
}

function sb_todayStr() {
  const d = new Date();
  return d.toISOString().slice(0,10); // YYYY-MM-DD
}

/* Recalculate streak:
   - If lastStreakDate is yesterday → streak +1
   - If lastStreakDate is today → keep
   - Else reset to 1
*/
function sb_recalcStreak(state) {
  const today = sb_todayStr();
  const last = state.meta.lastStreakDate?.slice(0,10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);

  if (!last) {
    state.user.streak = Math.max(1, state.user.streak || 1);
  } else if (last === today) {
    // unchanged
  } else if (last === yesterday) {
    state.user.streak = (state.user.streak || 0) + 1;
  } else {
    state.user.streak = 1;
  }
  state.meta.lastStreakDate = new Date().toISOString();
  sb_save(state);
  return state.user.streak;
}

function sb_addStudyBucks(amount) {
  const s = sb_load();
  s.user.studyBucks += amount;
  sb_save(s);
  return s.user.studyBucks;
}

function sb_addXP(amount) {
  const s = sb_load();
  s.user.xp += amount;
  while (s.user.xp >= s.user.xpMax) {
    s.user.xp -= s.user.xpMax;
    s.user.level += 1;
    // gently scale max XP
    s.user.xpMax = Math.round(s.user.xpMax * 1.25);
  }
  sb_save(s);
  return { xp: s.user.xp, xpMax: s.user.xpMax, level: s.user.level };
}

function sb_completeDailyChallenge() {
  const s = sb_load();
  const today = sb_todayStr();
  const last = s.meta.lastChallengeDate?.slice(0,10);
  if (last === today) {
    return { ok:false, message: "Already completed today ✅" };
  }
  s.meta.lastChallengeDate = new Date().toISOString();
  // reward
  s.user.studyBucks += 10;
  sb_addXP(50); // little XP boost
  sb_save(s);
  return { ok:true, message: "Challenge complete! +10 SB, +50 XP" };
}

function sb_addCourse(course) {
  const s = sb_load();
  s.courses.push(course);
  sb_save(s);
}


function sb_all() {
  const s = sb_load();
  // ensure streak refresh on each load
  sb_recalcStreak(s);
  return s;
}

// ---------- STORE MOCK DATA ----------
const SB_STORE_ITEMS = [
  { id: "course_1", name: "Advanced Python Course", type: "Course", cost: 60 },
  { id: "course_2", name: "UI/UX Design Masterclass", type: "Course", cost: 80 },
  { id: "sub_1", name: "1-Month Premium Subscription", type: "Subscription", cost: 50 },
  { id: "sub_2", name: "6-Month Premium Subscription", type: "Subscription", cost: 200 },
  { id: "merch_1", name: "StudyBuddy Notebook", type: "Merchandise", cost: 30 },
  { id: "merch_2", name: "Coffee Mug", type: "Merchandise", cost: 25 }
];

function sb_storeItems() {
  return SB_STORE_ITEMS;
}

function sb_redeem(itemId) {
  const s = sb_load();
  const item = SB_STORE_ITEMS.find(i => i.id === itemId);
  if (!item) return { ok:false, message:"Item not found." };

  if (s.user.studyBucks < item.cost) {
    return { ok:false, message:"Not enough StudyBucks to redeem this item." };
  }

  s.user.studyBucks -= item.cost;
  sb_addXP(20); // small XP reward
  sb_save(s);
  return { ok:true, message:`You redeemed "${item.name}" for ${item.cost} SB! 🎉` };
}

// ---------- LEADERBOARD (XP-only) ----------
const SB_LB_KEY = "sb_leaderboard_competitors_v2";

function sb_lbEnsureCompetitors() {
  const raw = localStorage.getItem(SB_LB_KEY);
  if (raw) return JSON.parse(raw);

  const names = [
    "Ava Patel","Liam Wong","Mia Chen","Noah Singh","Emma Thompson",
    "Lucas Martin","Olivia Brown","Ethan Davis","Isabella Garcia","Mason Lee"
  ];
  const peers = names.map(n => ({
    id: crypto.randomUUID(),
    name: n,
    xp: Math.floor(Math.random() * 1800) + 100   // XP range 100–1900
  }));
  localStorage.setItem(SB_LB_KEY, JSON.stringify(peers));
  return peers;
}

function sb_leaderboardData() {
  const state = sb_all();
  const peers = sb_lbEnsureCompetitors();

  const me = {
    id: "me",
    name: state.user.name || "Student",
    xp: state.user.xp
  };

  const merged = [me, ...peers.filter(p => p.id !== "me")];
  merged.sort((a, b) => b.xp - a.xp);

  merged.forEach((u, i) => {
    u.rank = i + 1;
  });

  return { list: merged };
}

// ---------- DISCOVER COURSES MOCK ----------
const SB_DISCOVER = [
  { id: "ml01", code: "ML 101", title: "Machine Learning Basics", instructor: "Dr. Kate Li", desc: "Learn foundational AI concepts and models." },
  { id: "ps01", code: "PS 201", title: "Public Speaking Skills", instructor: "Prof. Amir Khan", desc: "Boost confidence and presentation skills." },
  { id: "ai01", code: "AI 205", title: "AI for Everyone", instructor: "Dr. Lisa Moore", desc: "Understand AI's impact on modern life." }
];

function sb_discoverCourses() {
  return SB_DISCOVER;
}

function sb_requestCourse(id) {
  const s = sb_load();
  const found = SB_DISCOVER.find(c => c.id === id);
  if (!found) return false;
  if (s.courses.some(c => c.id === id)) return false;

  const newCourse = {
    id: found.id,
    code: found.code,
    title: found.title,
    instructor: found.instructor,
    progress: 0,
    status: "requested"
  };
  s.courses.push(newCourse);
  sb_save(s);
  return true;
}

// ---------- PROFILE FUNCTIONS ----------
function sb_updateName(newName) {
  const s = sb_load();
  s.user.name = newName;
  sb_save(s);
  return s.user.name;
}

function sb_badges() {
  const s = sb_all();
  const badges = [
    {
      id:"quizmaster", name:"Quiz Master", icon:"🧠",
      desc:"Completed 50 quizzes", unlocked: s.user.quizzes >= 50
    },
    {
      id:"dailychamp", name:"Daily Champ", icon:"🔥",
      desc:"7-day login streak", unlocked: s.user.streak >= 7
    },
    {
      id:"knowledgeseeker", name:"Knowledge Seeker", icon:"📘",
      desc:"Reached 1000 XP", unlocked: s.user.xp >= 1000
    },
    {
      id:"consistencystar", name:"Consistency Star", icon:"⭐",
      desc:"15-day streak", unlocked: s.user.streak >= 15
    },
    {
      id:"brainiac", name:"Brainiac", icon:"🏆",
      desc:"Achieved Level 5+", unlocked: s.user.level >= 5
    }
  ];
  return badges;
}

