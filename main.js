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

// ---------------- STORE PAGE ----------------
function initStore() {
  const state = sb_all();
  const grid = document.getElementById("storeGrid");
  const balanceEl = document.getElementById("sbBalance");
  balanceEl.textContent = `${state.user.studyBucks} SB`;

  const items = sb_storeItems();
  grid.innerHTML = "";
  items.forEach(item => {
    const card = document.createElement("div");
    card.className = "card";
    const affordable = state.user.studyBucks >= item.cost;
    card.innerHTML = `
      <div>
        <div class="item-title">${item.name}</div>
        <div class="item-type">${item.type}</div>
        <div class="item-cost">${item.cost} SB</div>
      </div>
      <button class="btn redeem ${!affordable ? "disabled" : ""}" data-id="${item.id}">
        ${affordable ? "Redeem" : "Not enough SB"}
      </button>
    `;
    grid.appendChild(card);
  });

  // redeem button actions
  grid.querySelectorAll(".btn.redeem").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.dataset.id;
      const item = sb_storeItems().find(i => i.id === id);
      if (!item || e.target.classList.contains("disabled")) return;

      openRedeemModal(item);
    });
  });
}

// MODAL CONTROL
function openRedeemModal(item) {
  const modal = document.getElementById("redeemModal");
  const text = document.getElementById("redeemText");
  const confirm = document.getElementById("confirmRedeem");
  const cancel = document.getElementById("cancelRedeem");
  const overlay = modal.querySelector(".modal__overlay");

  text.textContent = `Redeem "${item.name}" for ${item.cost} StudyBucks?`;
  modal.classList.remove("hidden");

  function close() {
    modal.classList.add("hidden");
    confirm.removeEventListener("click", redeemNow);
    cancel.removeEventListener("click", close);
    overlay.removeEventListener("click", close);
  }

  function redeemNow() {
    const res = sb_redeem(item.id);
    alert(res.message);
    close();
    initStore(); // refresh
    // also refresh balance in header
    const s2 = sb_all();
    const sb = document.getElementById("sb-balance");
    if (sb) sb.textContent = `${s2.user.studyBucks} SB`;
  }

  confirm.addEventListener("click", redeemNow);
  cancel.addEventListener("click", close);
  overlay.addEventListener("click", close);
}

// Attach initStore automatically
document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "store") initStore();
});

// ---------------- LEADERBOARD PAGE ----------------
function initLeaderboard() {
  const { list } = sb_leaderboardData();
  const listEl = document.getElementById("lbList");
  listEl.innerHTML = "";

  list.forEach(u => {
    const you = u.id === "me";
    const row = document.createElement("div");
    row.className = "lb-row" + (you ? " lb-row--you" : "");

    let rankClass = "";
    if (u.rank === 1) rankClass = "gold";
    else if (u.rank === 2) rankClass = "silver";
    else if (u.rank === 3) rankClass = "bronze";

    const initials = u.name.split(" ").map(x => x[0]).join("").slice(0,2).toUpperCase();

    row.innerHTML = `
      <div><div class="rank ${rankClass}">${u.rank}</div></div>
      <div class="person">
        <div class="avatar">${initials}</div>
        <div>
          <div class="name">${u.name}</div>
          ${you ? '<span class="subtle">Current user</span>' : ''}
        </div>
      </div>
      <div class="right">${u.xp}</div>
    `;
    listEl.appendChild(row);
  });
}

// Extend existing DOMContentLoaded handler to include leaderboard
document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "leaderboard") initLeaderboard();
});

// ---------------- COURSES PAGE ----------------
function initCourses() {
  const s = sb_all();
  const grid = document.getElementById("yourCourses");
  const empty = document.getElementById("emptyCourses");
  const discoverGrid = document.getElementById("discoverGrid");

  // Render user's courses
  grid.innerHTML = "";
  if (!s.courses.length) {
    empty.classList.remove("hidden");
  } else {
    empty.classList.add("hidden");
    s.courses.forEach(c => grid.appendChild(courseCardFull(c)));
  }

  // Discover section
  discoverGrid.innerHTML = "";
  sb_discoverCourses().forEach(c => {
    const card = document.createElement("div");
    card.className = "card discover-card";
    card.innerHTML = `
      <div class="course-code">${c.code}</div>
      <div class="course-title">${c.title}</div>
      <p class="muted">${c.desc}</p>
      <button class="btn blue" data-id="${c.id}">Request Access</button>
    `;
    discoverGrid.appendChild(card);
  });

  discoverGrid.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", e => {
      const id = e.target.dataset.id;
      if (sb_requestCourse(id)) {
        alert("Course request sent successfully ✅");
        initCourses();
      } else {
        alert("Already requested or added.");
      }
    });
  });

  // Buttons
  document.getElementById("addCourseBtn").onclick = openCourseModal;
  document.getElementById("createFirstCourse").onclick = openCourseModal;
}

function courseCardFull(c) {
  const card = document.createElement("div");
  card.className = "card";
  card.innerHTML = `
    <div class="course-code">${c.code}</div>
    <div class="course-title">${c.title}</div>
    <div class="course-instructor">${c.instructor}</div>
    <div class="progress"><div class="progress__bar" style="width:${Math.min(100, c.progress)}%"></div></div>
    <span class="status ${c.status || "active"}">${(c.status || "active").toUpperCase()}</span>
    <div class="actions-row">
      <button class="btn green">Summary</button>
      <button class="btn outline">View</button>
    </div>
  `;
  return card;
}

// Modal open/close reuse
function openCourseModal() {
  const modal = document.getElementById("addCourseModal");
  modal.classList.remove("hidden");
  const save = document.getElementById("saveCourse");
  const cancel = document.getElementById("cancelCourse");
  const overlay = modal.querySelector(".modal__overlay");

  function close() {
    modal.classList.add("hidden");
    save.removeEventListener("click", saveCourse);
    cancel.removeEventListener("click", close);
    overlay.removeEventListener("click", close);
  }

  function saveCourse() {
    const code = document.getElementById("courseCode").value.trim();
    const title = document.getElementById("courseTitle").value.trim();
    const instructor = document.getElementById("courseInstructor").value.trim();
    if (!code || !title) return alert("Please enter course code and title.");
    const course = {
      id: crypto.randomUUID(),
      code, title, instructor: instructor || "Instructor",
      progress: 0, status: "active"
    };
    sb_addCourse(course);
    close();
    initCourses();
  }

  save.addEventListener("click", saveCourse);
  cancel.addEventListener("click", close);
  overlay.addEventListener("click", close);
}

// Auto init
document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "courses") initCourses();
});

// ---------------- PROFILE PAGE ----------------
function initProfile() {
  const s = sb_all();

  // Avatar initials
  const avatar = document.getElementById("profileAvatar");
  const initials = (s.user.name || "Student").split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
  avatar.textContent = initials;

  // Stats
  document.getElementById("userName").value = s.user.name;
  document.getElementById("profileLevel").textContent = s.user.level;
  document.getElementById("profileXP").textContent = `${s.user.xp}/${s.user.xpMax}`;
  document.getElementById("profileSB").textContent = s.user.studyBucks;
  document.getElementById("profileStreak").textContent = `${s.user.streak}🔥`;
  document.getElementById("xpBar").style.width = Math.min(100, Math.round((s.user.xp / s.user.xpMax) * 100)) + "%";

  // Badges
  const badgeGrid = document.getElementById("badgeGrid");
  badgeGrid.innerHTML = "";
  const badges = sb_badges();
badges.forEach((b, i) => {
  const div = document.createElement("div");
  let className = "badge";
  
  // Force highlight first two badges for demo if not unlocked
  if (i < 2) b.unlocked = true;
  
  if (!b.unlocked) className += " locked";
  else className += " active";
  
  div.className = className;
  div.innerHTML = `
    <span>${b.icon}</span>
    <h4>${b.name}</h4>
    <p>${b.desc}</p>
  `;
  badgeGrid.appendChild(div);
});


  // Edit name
  const input = document.getElementById("userName");
  const editBtn = document.getElementById("editNameBtn");
  let editing = false;

  editBtn.onclick = () => {
    if (!editing) {
      input.removeAttribute("readonly");
      input.focus();
      editBtn.textContent = "Save";
      editing = true;
    } else {
      const newName = input.value.trim() || "Student";
      sb_updateName(newName);
      input.setAttribute("readonly", true);
      editBtn.textContent = "Edit";
      editing = false;
      // update avatar
      avatar.textContent = newName.split(" ").map(n=>n[0]).join("").toUpperCase().slice(0,2);
      alert("Name updated successfully ✅");
    }
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "profile") initProfile();
});

// ---------------- UPLOAD PAGE ----------------
function initUpload() {
  const fileInput = document.getElementById("fileInput");
  const uploadZone = document.getElementById("uploadZone");
  const warningBox = document.getElementById("warningBox");
  const summaryBox = document.getElementById("summaryOutput");
  const summaryText = document.getElementById("summaryText");
  const generateBtn = document.getElementById("generateBtn");
  const clearBtn = document.getElementById("clearBtn");

  let uploadedFile = null;

  // Handle file select
fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const name = file.name.toLowerCase();
  uploadedFile = file;

    // Reject only PPT and PPTX
    if (name.endsWith(".ppt") || name.endsWith(".pptx")) {
      warningBox.classList.remove("hidden");
      warningBox.textContent = "⚠️ PowerPoint files (.ppt / .pptx) are not supported.";
      generateBtn.disabled = true;
    } else {
      warningBox.classList.add("hidden");
      generateBtn.disabled = false;
    }
  });

  // Click zone trigger
  uploadZone.addEventListener("click", () => fileInput.click());

  // Generate Summary (mock logic for now)
  generateBtn.addEventListener("click", () => {
    if (!uploadedFile) return alert("Please upload a valid file first.");

    summaryBox.classList.remove("hidden");
    summaryText.textContent = "Processing your file... please wait.";

    // Mock AI output delay
    setTimeout(() => {
      summaryText.innerHTML = `
        <p>✨ <strong>Summary:</strong> The uploaded document discusses key learning materials and insights from your notes.</p>
        <p>⚡ Highlight: The system identifies the main concepts, simplifying complex terms for faster study.</p>
        <p>🧠 Tip: Verify your content source for more accurate AI summaries.</p>
      `;
    }, 1500);
  });

  // Clear
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    uploadedFile = null;
    warningBox.classList.add("hidden");
    summaryBox.classList.add("hidden");
    generateBtn.disabled = true;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "upload") initUpload();
});



