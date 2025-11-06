// ---------------- SHARED HEADER & FOOTER LOADER ----------------
document.addEventListener("DOMContentLoaded", async () => {
  // HEADER
  const headerEl = document.getElementById("header-container");
  if (headerEl) {
    try {
      const res = await fetch("header.html");
      headerEl.innerHTML = await res.text();

      // ✅ Setup active link highlight
      const page = document.documentElement.getAttribute("data-page");
      const active = headerEl.querySelector(`.nav__link[data-nav="${page}"]`);
      if (active) active.classList.add("is-active");

      // ✅ Setup StudyBucks pill
      const state = sb_all();
      const sb = headerEl.querySelector("#sb-balance");
      if (sb) sb.textContent = `${state.user.studyBucks} SB`;

      // ✅ Setup mobile menu toggle (☰)
      const menuToggle = headerEl.querySelector("#menuToggle");
      const header = headerEl.querySelector(".sb-header");
      if (menuToggle && header) {
        menuToggle.addEventListener("click", () => {
          header.classList.toggle("active");
        });
      }
    } catch (err) {
      console.error("Error loading header:", err);
    }
  }

  // FOOTER
  const footerEl = document.getElementById("footer-container");
  if (footerEl) {
    try {
      const res = await fetch("footer.html");
      footerEl.innerHTML = await res.text();
    } catch (err) {
      console.error("Error loading footer:", err);
    }
  }

  // PAGE-SPECIFIC INITIALIZERS
  const page = document.documentElement.getAttribute("data-page");
  if (page === "home") initHome();
  if (page === "store") initStore();
  if (page === "leaderboard") initLeaderboard();
  if (page === "courses") initCourses();
  if (page === "profile") initProfile();
  if (page === "upload") initUpload();
  if (page === "course-details") initCourseDetails();
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
      <a href="course-details.html" class="btn outline">View</a>
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

// Upload Page Section
function initUpload() {
  const uploadZone = document.getElementById("uploadZone");
  const fileInput = document.getElementById("fileInput");
  const warningBox = document.getElementById("warningBox");
  const summaryBox = document.getElementById("summaryOutput");
  const summaryText = document.getElementById("summaryText");
  const generateBtn = document.getElementById("generateBtn");
  const clearBtn = document.getElementById("clearBtn");
  const quizBtn = document.getElementById("quizBtn"); // ✅ Added reference

  // Ensure only one file info element exists
  let fileInfo = document.getElementById("fileInfo");
  if (!fileInfo) {
    fileInfo = document.createElement("div");
    fileInfo.id = "fileInfo";
    fileInfo.className = "file-info hidden";
    uploadZone.insertAdjacentElement("afterend", fileInfo);
  }

  let uploadedFile = null;

  // Unified handler
  function handleFileSelect(file) {
    if (!file) return;
    uploadedFile = file;
    const name = file.name.toLowerCase();

    fileInfo.classList.remove("hidden");
    fileInfo.innerHTML = `✅ <strong>${file.name}</strong> (${(file.size / 1024).toFixed(1)} KB) uploaded`;

    if (name.endsWith(".ppt") || name.endsWith(".pptx")) {
      warningBox.classList.remove("hidden");
      warningBox.textContent = "⚠️ PowerPoint files (.ppt / .pptx) are not supported.";
      generateBtn.disabled = true;
      quizBtn.disabled = true; // 🚫 disable quiz for unsupported
    } else {
      warningBox.classList.add("hidden");
      generateBtn.disabled = false;
      quizBtn.disabled = false; // ✅ enable quiz button once valid file uploaded
    }
  }

  // --- Fix double-open file dialog ---
  let fileDialogOpen = false;

  // CLICK upload (only once per user action)
  uploadZone.addEventListener("click", (event) => {
    if (fileDialogOpen) return;
    fileDialogOpen = true;
    fileInput.value = "";
    fileInput.click();
    event.stopImmediatePropagation();
  });

  // When file chosen
  fileInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (file) handleFileSelect(file);
    setTimeout(() => {
      fileDialogOpen = false;
    }, 1000);
  });

  // Drag & drop
  uploadZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    uploadZone.style.background = "#f0fdf4";
    uploadZone.style.borderColor = "#4CAF50";
  });
  uploadZone.addEventListener("dragleave", () => {
    uploadZone.style.background = "#f9fafb";
    uploadZone.style.borderColor = "#94a3b8";
  });
  uploadZone.addEventListener("drop", (e) => {
    e.preventDefault();
    uploadZone.style.background = "#f9fafb";
    uploadZone.style.borderColor = "#94a3b8";
    const file = e.dataTransfer.files[0];
    handleFileSelect(file);
  });

  // --- Generate Summary (PDF/DOCX/PPT support) ---
  generateBtn.addEventListener("click", async () => {
    if (!uploadedFile) return alert("Please upload a valid file first.");
    summaryBox.classList.remove("hidden");
    summaryText.textContent = "Uploading and analyzing your file…";

    try {
      const formData = new FormData();
      formData.append("file", uploadedFile);

      const res = await fetch("https://studybuddy-new-tau.vercel.app/api/summary", {
        method: "POST",
        body: formData
      });

      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();
      summaryText.innerHTML = `
        <div class="ai-summary">
          ${marked.parse(data.summary || "⚠️ No summary generated.")}
        </div>
      `;
    } catch (e) {
      console.error(e);
      summaryText.textContent = "⚠️ Failed to summarize file.";
    }
  });

  // 🧠 Generate quiz
quizBtn.addEventListener("click", async () => {
  if (!uploadedFile) return alert("Please upload a valid file first.");

  summaryBox.classList.add("hidden"); // hide summary
  const quizSection = document.getElementById("quizSection");
  const quizContainer = document.getElementById("quizContainer");
  const submitQuizBtn = document.getElementById("submitQuizBtn");
  const quizResultModal = document.getElementById("quizResultModal");
  const quizResultText = document.getElementById("quizResultText");
  const seeAnswersBtn = document.getElementById("seeAnswersBtn");
  const tryAgainBtn = document.getElementById("tryAgainBtn");

quizSection.classList.remove("hidden");
quizContainer.innerHTML = "<p>Generating quiz questions...</p>";
submitQuizBtn.disabled = true;
submitQuizBtn.classList.add("disabled");


  try {
    const formData = new FormData();
    formData.append("file", uploadedFile);

    const res = await fetch("https://studybuddy-new-tau.vercel.app/api/quiz", {
      method: "POST",
      body: formData,
    });

    if (!res.ok) throw new Error("Failed to generate quiz");
    const data = await res.json();

    // Render quiz
    submitQuizBtn.disabled = false;
submitQuizBtn.classList.remove("disabled");

    quizContainer.innerHTML = "";
    data.questions.forEach((q, i) => {
      const div = document.createElement("div");
      div.classList.add("quiz-question");
      div.innerHTML = `
        <p><strong>Q${i + 1}:</strong> ${q.question}</p>
        ${q.options
          .map(
            (opt, j) =>
              `<label><input type="radio" name="q${i}" value="${opt}"> ${opt}</label><br>`
          )
          .join("")}
      `;
      quizContainer.appendChild(div);
    });

    // Quiz submission
    submitQuizBtn.onclick = () => {
      let correct = 0;
      data.questions.forEach((q, i) => {
        const selected = document.querySelector(`input[name='q${i}']:checked`);
        if (selected && selected.value === q.answer) correct++;
      });

      const total = data.questions.length;
      const score = Math.round((correct / total) * 100);
      quizResultText.innerHTML = `You got <strong>${correct}</strong> out of <strong>${total}</strong> correct!<br>Score: <strong>${score}%</strong>`;
      quizResultModal.classList.remove("hidden");

      // See answers
      seeAnswersBtn.onclick = () => {
        quizResultModal.classList.add("hidden");
        quizContainer.querySelectorAll(".quiz-question").forEach((div, i) => {
          const correctAns = document.createElement("p");
          correctAns.classList.add("answer");
          correctAns.textContent = `✅ Correct answer: ${data.questions[i].answer}`;
          div.appendChild(correctAns);
        });
      };

      // Try again
      tryAgainBtn.onclick = () => {
        quizResultModal.classList.add("hidden");
        document
          .querySelectorAll("input[type='radio']")
          .forEach((el) => (el.checked = false));
        document
          .querySelectorAll(".answer")
          .forEach((el) => el.remove());
      };
    };
  } catch (e) {
    console.error(e);
    quizContainer.innerHTML = "⚠️ Failed to generate quiz questions.";
  }
});


  // --- Clear all ---
  clearBtn.addEventListener("click", () => {
    fileInput.value = "";
    uploadedFile = null;
    fileInfo.classList.add("hidden");
    warningBox.classList.add("hidden");
    summaryBox.classList.add("hidden");
    generateBtn.disabled = true;
    quizBtn.disabled = true;
  });
}

document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "upload") initUpload();
});

// ---------------- COURSE DETAILS PAGE ----------------
function initCourseDetails() {
  const params = new URLSearchParams(window.location.search);
  const courseId = params.get("id");
  const data = courseDetailsData[courseId];

  if (!data) return;

  // Header info
  document.getElementById("courseTitle").textContent = data.name;
  document.getElementById("courseInstructor").textContent = data.instructor;
  document.getElementById("courseDesc").textContent = data.desc;
  document.getElementById("coursePercent").textContent = `${data.progress}%`;
  document.getElementById("courseXP").textContent = data.xp;
  document.getElementById("courseProgress").style.width = `${data.progress}%`;

  // Chapters
  const chaptersList = document.getElementById("chaptersList");
  chaptersList.innerHTML = "";

  data.chapters.forEach((ch, index) => {
    const card = document.createElement("div");
    card.className = "chapter-card";
    card.innerHTML = `
      <h3>${index + 1}. ${ch.title}</h3>
      <p>Explore content and test your knowledge.</p>
      <div class="chapter-progress">
        <div class="chapter-progress-bar" style="width:${ch.progress}%"></div>
      </div>
      <p class="status">Progress: ${ch.progress}% • ${ch.xp} XP</p>
      <div class="chapter-actions">
        <button class="btn summary">📘 Summary</button>
        <button class="btn quiz">🧠 Quiz</button>
      </div>
    `;
    chaptersList.appendChild(card);
  });
}

// Init page
document.addEventListener("DOMContentLoaded", () => {
  const page = document.documentElement.getAttribute("data-page");
  if (page === "course-details") initCourseDetails();
});
