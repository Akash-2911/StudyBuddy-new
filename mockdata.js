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
