(function () {
  "use strict";

  const LANE_COLORS = {
    do: "#ff6b4a",
    buy: "#3dd6c6",
    look: "#7c9cff",
    waiting: "#ffc857",
    later: "#c084fc",
    parked: "#6b7280",
  };

  let boardData = null;
  let currentView = "all"; // "all" | "work"

  function getViewFromURL() {
    const params = new URLSearchParams(window.location.search);
    const v = (params.get("view") || "").toLowerCase();
    return v === "work" ? "work" : "all";
  }

  function setViewInURL(view) {
    const url = new URL(window.location.href);
    if (view === "work") {
      url.searchParams.set("view", "work");
    } else {
      url.searchParams.delete("view");
    }
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

  function itemVisible(item) {
    if (currentView === "work") {
      return item.privacy !== "personal";
    }
    return true;
  }

  function countVisibleItems(lane) {
    if (lane.groups) {
      return lane.groups.reduce(
        (n, g) => n + g.items.filter(itemVisible).length,
        0
      );
    }
    return (lane.items || []).filter(itemVisible).length;
  }

  function countAllVisible(lanes) {
    return lanes.reduce((n, lane) => n + countVisibleItems(lane), 0);
  }

  function renderCard(item, laneColor) {
    const who = item.who
      ? `<span class="card-who">${escapeHtml(item.who)}</span>`
      : "";
    const detail = item.detail
      ? `<div class="card-detail">${escapeHtml(item.detail)}</div>`
      : `<div class="card-detail"></div>`;
    return `
      <article class="card" data-id="${escapeHtml(item.id)}" data-privacy="${escapeHtml(item.privacy || "")}" style="--lane-color:${laneColor}">
        <div class="card-title">${escapeHtml(item.title)}</div>
        ${detail}
        ${who}
      </article>`;
  }

  function renderLane(lane) {
    const color = lane.color || LANE_COLORS[lane.id] || "#888";
    const visibleCount = countVisibleItems(lane);
    let body = "";

    if (lane.groups) {
      body = lane.groups
        .map((group) => {
          const visible = group.items.filter(itemVisible);
          if (visible.length === 0) {
            return `<div class="group hidden" data-group="${escapeHtml(group.id)}"></div>`;
          }
          const cards = visible
            .map((item) => renderCard(item, color))
            .join("");
          return `
            <div class="group" data-group="${escapeHtml(group.id)}">
              <div class="group-label">${escapeHtml(group.label)}</div>
              ${cards}
            </div>`;
        })
        .join("");
      if (visibleCount === 0) {
        body = `<div class="empty-hint">Nothing in this view</div>`;
      }
    } else {
      const visible = (lane.items || []).filter(itemVisible);
      if (visible.length === 0) {
        body = `<div class="empty-hint">Nothing in this view</div>`;
      } else {
        body = visible.map((item) => renderCard(item, color)).join("");
      }
    }

    return `
      <section class="lane" data-lane="${escapeHtml(lane.id)}" style="--lane-color:${color}">
        <header class="lane-header">
          <div class="lane-title">
            <span class="lane-dot"></span>
            ${escapeHtml(lane.label)}
          </div>
          <span class="lane-count">${visibleCount}</span>
        </header>
        <div class="lane-body">${body}</div>
      </section>`;
  }

  function formatUpdated(iso) {
    if (!iso) return "";
    try {
      const d = new Date(iso + "T12:00:00");
      return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function render() {
    if (!boardData) return;
    const root = document.getElementById("app");
    const lanes = boardData.lanes || [];
    const total = countAllVisible(lanes);

    const countPills = lanes
      .map((lane) => {
        const n = countVisibleItems(lane);
        return `<span class="count-pill" data-lane="${escapeHtml(lane.id)}"><span class="n">${n}</span>${escapeHtml(lane.label.split("·")[0].trim())}</span>`;
      })
      .join("");

    root.innerHTML = `
      <header class="header">
        <div class="header-left">
          <div class="logo"><span class="logo-dot"></span>${escapeHtml(boardData.title || "Catch-all")}</div>
          <div class="meta">Updated <strong>${escapeHtml(formatUpdated(boardData.updated))}</strong> · <strong>${total}</strong> open</div>
        </div>
        <div class="header-right">
          <div class="counts">${countPills}</div>
          <div class="view-toggle" role="group" aria-label="Privacy view">
            <button type="button" data-view="all" class="${currentView === "all" ? "active" : ""}">All</button>
            <button type="button" data-view="work" class="${currentView === "work" ? "active" : ""}">Work</button>
          </div>
        </div>
      </header>
      <main class="board">
        ${lanes.map(renderLane).join("")}
      </main>
      <p class="footer-note">Dump anything. Sort later. Calm board for Amber.</p>
    `;

    root.querySelectorAll(".view-toggle button").forEach((btn) => {
      btn.addEventListener("click", () => {
        const v = btn.getAttribute("data-view");
        if (v === currentView) return;
        currentView = v;
        setViewInURL(currentView);
        render();
      });
    });
  }

  function showError(msg) {
    const root = document.getElementById("app");
    root.innerHTML = `<div class="error-banner">${escapeHtml(msg)}</div>`;
  }

  async function loadBoard() {
    // Prefer embedded data (standalone), else fetch board.json
    if (window.BOARD_DATA) {
      boardData = window.BOARD_DATA;
      return;
    }
    const res = await fetch("board.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Could not load board.json (" + res.status + ")");
    boardData = await res.json();
  }

  async function init() {
    currentView = getViewFromURL();
    try {
      await loadBoard();
      render();
    } catch (err) {
      console.error(err);
      showError(
        "Could not load board data. If you opened index.html via file://, use board-standalone.html instead, or serve the folder with a local server."
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
