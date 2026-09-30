import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const LANE_META = [
  { id: "do", label: "Do · now", color: "#ff6b4a", groups: [
    { id: "work", label: "Work" },
    { id: "estate", label: "Estate" },
    { id: "life", label: "Life" },
  ]},
  { id: "buy", label: "Buy", color: "#3dd6c6" },
  { id: "look", label: "Look into", color: "#7c9cff" },
  // Work Ideas: always work (never hidden in Work view). Tag lives in board_items.grp.
  { id: "ideas", label: "Work Ideas", color: "#f472b6", alwaysWork: true, tagged: true,
    emptyHint: "Text HBIC \u2018idea: \u2026\u2019 to add one" },
  { id: "waiting", label: "Waiting", color: "#ffc857" },
  { id: "later", label: "Later", color: "#c084fc" },
  { id: "parked", label: "Parked", color: "#6b7280" },
];

// Idea tags. Stored in board_items.grp (no schema change); a future `tag` column also works.
const IDEA_TAGS = {
  connectms: { label: "ConnectMS", color: "#3dd6c6" },
  "sterling-hill": { label: "Sterling Hill", color: "#ffc857" },
  other: { label: "Other", color: "#9aa3b2" },
};
const ALWAYS_WORK_LANES = new Set(LANE_META.filter((m) => m.alwaysWork).map((m) => m.id));

function ideaTag(item) {
  const raw = String(item.tag || item.grp || "other").trim().toLowerCase().replace(/\s+/g, "-");
  return IDEA_TAGS[raw] || { label: item.tag || item.grp || "Other", color: IDEA_TAGS.other.color };
}

function ideaAdded(item) {
  if (item.added) return String(item.added).slice(0, 10);
  const m = /^idea-(\d{4})(\d{2})(\d{2})-/.exec(item.id || "");
  return m ? `${m[1]}-${m[2]}-${m[3]}` : "";
}

function shortDate(iso) {
  if (!iso) return "";
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const cfg = window.CATCHALL_CONFIG;
if (!cfg?.supabaseUrl || !cfg?.supabaseAnonKey) {
  document.getElementById("meta").textContent = "Missing config.js";
  throw new Error("Missing CATCHALL_CONFIG");
}

const supabase = createClient(cfg.supabaseUrl, cfg.supabaseAnonKey);

let items = [];
let session = null;
let currentView = getViewFromURL();
let doneCollapsed = true;
let authBusy = false;

function getViewFromURL() {
  const v = (new URLSearchParams(location.search).get("view") || "").toLowerCase();
  return v === "work" ? "work" : "all";
}

function setViewInURL(view) {
  const url = new URL(location.href);
  if (view === "work") url.searchParams.set("view", "work");
  else url.searchParams.delete("view");
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isWorkItem(item) {
  return ALWAYS_WORK_LANES.has(item.lane) || item.privacy !== "personal";
}

function itemVisible(item) {
  if (item.done) return true; // filtered by section
  if (currentView === "work") return isWorkItem(item);
  return true;
}

function openItems() {
  return items.filter((i) => !i.done && itemVisible(i));
}

function doneItems() {
  return items
    .filter((i) => i.done && (currentView !== "work" || isWorkItem(i)))
    .sort((a, b) => String(b.done_at || "").localeCompare(String(a.done_at || "")));
}

async function loadItems() {
  const { data, error } = await supabase
    .from("board_items")
    .select("*")
    .order("sort", { ascending: true });
  if (error) throw error;
  items = data || [];
}

async function setDone(id, done) {
  if (!session) {
    flashAuth("Sign in to mark done (magic link).");
    return;
  }
  const payload = {
    done,
    done_at: done ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  };
  const { error } = await supabase.from("board_items").update(payload).eq("id", id);
  if (error) {
    flashAuth(error.message || "Could not update", true);
    return;
  }
  const row = items.find((i) => i.id === id);
  if (row) Object.assign(row, payload);
  render();
}

function flashAuth(msg, isError) {
  const el = document.querySelector(".auth-msg");
  if (!el) return;
  el.textContent = msg;
  el.className = "auth-msg " + (isError ? "error" : "ok");
}

function renderAuth() {
  const box = document.getElementById("auth-box");
  if (session?.user) {
    box.innerHTML = `
      <span class="email-label">${escapeHtml(session.user.email || "Signed in")}</span>
      <button type="button" id="signout-btn">Sign out</button>
      <div class="auth-msg"></div>`;
    document.getElementById("signout-btn").onclick = async () => {
      await supabase.auth.signOut();
    };
    return;
  }
  box.innerHTML = `
    <input type="email" id="auth-email" placeholder="you@email.com" autocomplete="email" />
    <button type="button" class="primary" id="signin-btn">Sign in to edit</button>
    <div class="auth-msg">Viewing is open. Sign in once to mark done on any device.</div>`;
  document.getElementById("signin-btn").onclick = async () => {
    if (authBusy) return;
    const email = document.getElementById("auth-email").value.trim();
    if (!email) { flashAuth("Enter your email", true); return; }
    authBusy = true;
    flashAuth("Sending magic link…");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: location.origin + location.pathname },
    });
    authBusy = false;
    if (error) flashAuth(error.message, true);
    else flashAuth("Check your email for the link, then come back here.");
  };
}

function renderCard(item, laneColor) {
  let who = item.who ? `<span class="card-who">${escapeHtml(item.who)}</span>` : "";
  if (item.lane === "ideas") {
    const t = ideaTag(item);
    const added = ideaAdded(item);
    who = `<div class="card-chips"><span class="tag-chip" style="--tag-color:${t.color}">${escapeHtml(t.label)}</span>` +
      (item.who ? `<span class="card-who">${escapeHtml(item.who)}</span>` : "") +
      (added ? `<span class="card-added">added ${escapeHtml(shortDate(added))}</span>` : "") + `</div>`;
  }
  const detail = item.detail
    ? `<div class="card-detail">${escapeHtml(item.detail)}</div>`
    : `<div class="card-detail"></div>`;
  const locked = !session ? `<div class="lock-hint">Sign in to check off</div>` : "";
  return `
    <article class="card ${item.done ? "done-card" : ""}" data-id="${escapeHtml(item.id)}" style="--lane-color:${laneColor}">
      <input class="card-check" type="checkbox" ${item.done ? "checked" : ""} aria-label="Mark done" data-id="${escapeHtml(item.id)}" />
      <div class="card-title">${escapeHtml(item.title)}</div>
      ${detail}
      ${who}
      ${item.done ? "" : locked}
    </article>`;
}

function renderOpenLanes(root) {
  for (const meta of LANE_META) {
    const laneItems = openItems().filter((i) => i.lane === meta.id);
    const emptyHint = meta.emptyHint || "Nothing in this view";
    const color = meta.color;
    let body = "";
    if (meta.groups) {
      body = meta.groups.map((g) => {
        const cards = laneItems.filter((i) => i.grp === g.id);
        if (!cards.length) return "";
        return `<div class="group"><div class="group-label">${escapeHtml(g.label)}</div>${cards.map((c) => renderCard(c, color)).join("")}</div>`;
      }).join("");
      // ungrouped leftovers
      const other = laneItems.filter((i) => !meta.groups.some((g) => g.id === i.grp));
      if (other.length) body += `<div class="group">${other.map((c) => renderCard(c, color)).join("")}</div>`;
      if (!body) body = `<div class="empty-hint">Nothing in this view</div>`;
    } else {
      body = laneItems.length
        ? laneItems.map((c) => renderCard(c, color)).join("")
        : `<div class="empty-hint">${escapeHtml(emptyHint)}</div>`;
    }
    root.insertAdjacentHTML("beforeend", `
      <section class="lane" data-lane="${meta.id}" style="--lane-color:${color}">
        <div class="lane-header">
          <span class="lane-dot" style="background:${color}"></span>
          <span class="lane-title">${escapeHtml(meta.label)}</span>
          <span class="lane-count">${laneItems.length}</span>
        </div>
        <div class="lane-body">${body}</div>
      </section>`);
  }
}

function renderDone(root) {
  const list = doneItems();
  const color = "#3dd6c6";
  const body = list.length
    ? list.map((c) => renderCard(c, color)).join("")
    : `<div class="empty-hint">Nothing marked done yet</div>`;
  root.insertAdjacentHTML("beforeend", `
    <section class="lane done-lane ${doneCollapsed ? "done-collapsed" : ""}" data-lane="done">
      <div class="lane-header" id="done-toggle">
        <span class="lane-dot" style="background:${color}"></span>
        <span class="lane-title">Done</span>
        <span class="lane-count">${list.length}</span>
      </div>
      <div class="lane-body">${body}</div>
    </section>`);
  document.getElementById("done-toggle").onclick = () => {
    doneCollapsed = !doneCollapsed;
    render();
  };
}

function renderCounts() {
  const el = document.getElementById("counts");
  if (!el) return;
  const open = openItems();
  el.innerHTML = LANE_META.map((m) => {
    const n = open.filter((i) => i.lane === m.id).length;
    return `<span class="count-pill" data-lane="${m.id}" style="--lane-color:${m.color}"><span class="n">${n}</span>${escapeHtml(m.label.split("·")[0].trim())}</span>`;
  }).join("");
}

function render() {
  const open = openItems().length;
  const done = doneItems().length;
  document.getElementById("meta").textContent =
    `Live sync · ${open} open` + (done ? ` · ${done} done` : "") +
    (session ? " · editing on" : " · view only");

  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.view === currentView);
  });

  renderAuth();
  renderCounts();
  const board = document.getElementById("board");
  board.innerHTML = "";
  renderOpenLanes(board);
  renderDone(board);

  board.querySelectorAll(".card-check").forEach((box) => {
    box.addEventListener("click", (e) => e.stopPropagation());
    box.addEventListener("change", async (e) => {
      const id = e.target.getAttribute("data-id");
      const want = e.target.checked;
      if (!session) {
        e.target.checked = !want;
        flashAuth("Sign in to mark done (magic link).");
        return;
      }
      await setDone(id, want);
    });
  });
}

function bindViewToggle() {
  document.querySelectorAll(".view-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      currentView = btn.dataset.view === "work" ? "work" : "all";
      setViewInURL(currentView);
      render();
    });
  });
}

async function init() {
  bindViewToggle();
  const { data: { session: s } } = await supabase.auth.getSession();
  session = s;
  supabase.auth.onAuthStateChange((_event, next) => {
    session = next;
    render();
  });

  try {
    await loadItems();
  } catch (err) {
    document.getElementById("meta").textContent = "Could not load board";
    console.error(err);
    return;
  }

  supabase
    .channel("board")
    .on("postgres_changes", { event: "*", schema: "public", table: "board_items" }, async () => {
      try { await loadItems(); render(); } catch (e) { console.error(e); }
    })
    .subscribe();

  render();
}

init();
