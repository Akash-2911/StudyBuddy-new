// Load shared header & footer
document.addEventListener("DOMContentLoaded", async () => {
  // Header
  const headerEl = document.getElementById("header-container");
  if (headerEl) {
    const res = await fetch("header.html");
    headerEl.innerHTML = await res.text();
    // update nav active state
    const page = document.documentElement.getAttribute("data-page");
    const active = document.querySelector(`.nav__link[data-nav="${page}"]`);
    if (active) active.classList.add("is-active");

    // update SB balance pill
    const state = sb_all();
    const sb = document.getElementById("sb-balance");
    if (sb) sb.textContent = `${state.user.studyBucks} SB`;
  }

  // Footer
  const footerEl = document.getElementById("footer-container");
  if (footerEl) {
    const res = await fetch("footer.html");
    footerEl.innerHTML = await res.text();
  }

  // Page-specific initializers
  const page = document.documentElement.getAttribute("data-page");
  if (page === "home") initHome();
});

// ---------------- HOME PAGE ----------------
function initHome() {
  const state = sb_all();

  // Stats
  const xpPct = Math.max(0, Math.min(100, Math.round((state.user.xp / state.user.xpMax) * 100)));
  document.getElementById("xpBar").style.width = xpPct + "%";
  document.getElementById("xpText").textContent = `Level ${state.user.level} • ${state.user.xp}/${state.user.xpMax} XP`;
  document.getElementById("streakDays").textContent = state.user.streak;
  document.getElementById("quizCount").textContent = state.user.quizzes;
  document.getElementById("badgeCount").textContent = state.user.badges;

  // Courses
  const grid = document.getElementById("coursesGrid");
  const empty = document.getElementById("noCourses");
  grid.innerHTML = "";
  if (!state.courses.length) {
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    state.courses.forEach(c => grid.appendChild(courseCard(c)));
  }

  // Buttons
  document.getElementById("goUpload").onclick = () => location.href = "upload.html";
  document.getElementById("openStore").onclick = () => location.href = "store.html";

  const challBtn = document.getElementById("doChallenge");
  const challStatus = document.getElementById("challengeStatus");
  challBtn.onclick = () => {
    const res = sb_completeDailyChallenge();
    challStatus.textContent = res.message;
    // refresh header SB pill + stats
    const s2 = sb_all();
    document.getElementById("xpText").textContent = `Level ${s2.user.level} • ${s2.user.xp}/${s2.user.xpMax} XP`;
    document.getElementById("xpBar").style.width = Math.round((s2.user.xp / s2.user.xpMax) * 100) + "%";
    document.getElementById("sb-balance").textContent = `${s2.user.studyBucks} SB`;
    document.getElementById("streakDays").textContent = s2.user.streak;
  };

  document.getElementById("addCourseBtn").onclick = addCourseFlow;
  document.getElementById("createFirstCourse").onclick = addCourseFlow;
}

function courseCard(c) {
  const wrap = document.createElement("div");
  wrap.className = "card course";
  wrap.innerHTML = `
    <span class="course__code">${c.code}</span>
    <div class="course__title">${c.title}</div>
    <div class="muted">Instructor: ${c.instructor}</div>
    <div class="progress" aria-label="Progress">
      <div class="progress__bar" style="width:${Math.max(0, Math.min(100, c.progress))}%"></div>
    </div>
    <div class="actions-row">
      <button class="btn green">Summary</button>
      <button class="btn outline">View</button>
    </div>
  `;
  // mock: clicking Summary gives a tiny XP boost
  wrap.querySelector(".btn.green").onclick = () => {
    sb_addXP(25);
    const s = sb_all();
    document.getElementById("xpText").textContent = `Level ${s.user.level} • ${s.user.xp}/${s.user.xpMax} XP`;
    document.getElementById("xpBar").style.width = Math.round((s.user.xp / s.user.xpMax) * 100) + "%";
  };
  return wrap;
}

function addCourseFlow() {
  const modal = document.getElementById("addCourseModal");
  modal.classList.remove("hidden");

  const saveBtn = document.getElementById("saveCourse");
  const cancelBtn = document.getElementById("cancelCourse");
  const overlay = modal.querySelector(".modal__overlay");

  function closeModal() {
    modal.classList.add("hidden");
    saveBtn.removeEventListener("click", handleSave);
    cancelBtn.removeEventListener("click", closeModal);
    overlay.removeEventListener("click", closeModal);
  }

  function handleSave() {
    const code = document.getElementById("courseCode").value.trim();
    const title = document.getElementById("courseTitle").value.trim();
    const instructor = document.getElementById("courseInstructor").value.trim();
    if (!code || !title) return alert("Please enter both Course Code and Title.");

    const course = {
      id: crypto.randomUUID(),
      code,
      title,
      instructor: instructor || "Instructor",
      progress: Math.floor(Math.random() * 20) + 10
    };

    sb_addCourse(course);
    closeModal();
    initHome(); // refresh
  }

  saveBtn.addEventListener("click", handleSave);
  cancelBtn.addEventListener("click", closeModal);
  overlay.addEventListener("click", closeModal);
}
