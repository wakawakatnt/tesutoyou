"use strict";

/* ================================================================
   イベントバインド
   ================================================================ */
document.getElementById("topInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
document.getElementById("resultInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value.trim()); });
document.getElementById("detailInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value.trim()); });

const topSearchTreeButtons = Array.from(document.querySelectorAll(".scope-tree-option"));
const topSearchTypes = topSearchTreeButtons.map(button => button.dataset.searchType);
const topSearchDrum = document.getElementById("topSearchScopeDrum");
const topSearchDrumItems = document.querySelector(".scope-drum-items");
const topSearchDrumOptions = Array.from(document.querySelectorAll(".scope-drum-item"));
const DRUM_ITEM_HEIGHT = 36;
const DRUM_CENTER_OFFSET = 38;
let drumDrag = null;

function clampDrumIndex(index) {
  return Math.max(0, Math.min(topSearchTypes.length - 1, index));
}

function moveDrumTo(index, animate = true) {
  topSearchDrumItems.style.transition = animate ? "" : "none";
  topSearchDrumItems.style.transform = `translateY(${DRUM_CENTER_OFFSET - index * DRUM_ITEM_HEIGHT}px)`;
  if (!animate) requestAnimationFrame(() => { topSearchDrumItems.style.transition = ""; });
}

function syncTopSearchType(value) {
  const index = Math.max(0, topSearchTypes.indexOf(value));
  topSearchTreeButtons.forEach(button => {
    const active = button.dataset.searchType === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  topSearchDrumOptions.forEach(item => item.classList.toggle("active", item.dataset.searchType === value));
  moveDrumTo(index);
}

function selectTopSearchType(value) {
  const radio = document.querySelector(`input[name="searchType"][value="${value}"]`);
  if (radio) radio.checked = true;
  syncTopSearchType(value);
  window.__userChangedType = true;
}

function selectRelativeDrumType(direction) {
  const activeType = document.querySelector(".scope-tree-option.active")?.dataset.searchType;
  const index = clampDrumIndex(topSearchTypes.indexOf(activeType) + direction);
  selectTopSearchType(topSearchTypes[index]);
}

topSearchTreeButtons.forEach(button => button.addEventListener("click", () => {
  selectTopSearchType(button.dataset.searchType);
}));

topSearchDrum.addEventListener("wheel", e => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.preventDefault();
  selectRelativeDrumType(e.deltaY > 0 ? 1 : -1);
}, { passive: false });

topSearchDrum.addEventListener("keydown", e => {
  if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
  e.preventDefault();
  selectRelativeDrumType(e.key === "ArrowDown" ? 1 : -1);
});

topSearchDrum.addEventListener("pointerdown", e => {
  const activeType = document.querySelector(".scope-tree-option.active")?.dataset.searchType;
  drumDrag = { startY: e.clientY, startIndex: Math.max(0, topSearchTypes.indexOf(activeType)), pointerId: e.pointerId };
  topSearchDrum.setPointerCapture(e.pointerId);
});

topSearchDrum.addEventListener("pointermove", e => {
  if (!drumDrag || e.pointerId !== drumDrag.pointerId) return;
  const offset = drumDrag.startIndex - (e.clientY - drumDrag.startY) / DRUM_ITEM_HEIGHT;
  topSearchDrumItems.style.transition = "none";
  topSearchDrumItems.style.transform = `translateY(${DRUM_CENTER_OFFSET - Math.max(0, Math.min(topSearchTypes.length - 1, offset)) * DRUM_ITEM_HEIGHT}px)`;
});

function finishDrumDrag(e) {
  if (!drumDrag || e.pointerId !== drumDrag.pointerId) return;
  const index = clampDrumIndex(Math.round(drumDrag.startIndex - (e.clientY - drumDrag.startY) / DRUM_ITEM_HEIGHT));
  drumDrag = null;
  selectTopSearchType(topSearchTypes[index]);
}

topSearchDrum.addEventListener("pointerup", finishDrumDrag);
topSearchDrum.addEventListener("pointercancel", finishDrumDrag);
syncTopSearchType("all");

// ソート変更
document.querySelectorAll('input[name="sortOrder"]').forEach(r => r.addEventListener("change", () => {
  if (currentResults.length) renderAll(currentKeyword);
}));

// 検索モード・範囲変更
document.querySelectorAll('input[name="searchMode"],input[name="searchType"]').forEach(r => r.addEventListener("change", () => {
  // ユーザーが手動でラジオを操作した印。これが立っている間は
  // id:プレフィックスでも type を id に強制しない（手動選択を尊重する）。
  window.__userChangedType = true;
  if (r.name === "searchType") syncTopSearchType(r.value);
  const q = document.getElementById("resultInput").value.trim();
  if (q) doSearch(q, { userTypeChange: true });
}));


// 日付プリセット変更
document.querySelectorAll('input[name="dateRange"]').forEach(r => r.addEventListener("change", () => {
  const v = r.value;
  document.getElementById("dateCustomGroup").style.display = (v === "custom") ? "" : "none";
  if (v !== "custom") {
    const q = document.getElementById("resultInput").value.trim();
    if (q) doSearch(q, { userTypeChange: true });
  }
}));

// カスタム日付入力変更
document.getElementById("dateFrom").addEventListener("change", () => {
  const fromEl = document.getElementById("dateFrom");
  const toEl   = document.getElementById("dateTo");
  if (!fromEl.value || !toEl.value) return;
  if (fromEl.value > toEl.value) {
    [fromEl.value, toEl.value] = [toEl.value, fromEl.value];
  }
  const q = document.getElementById("resultInput").value.trim();
  if (q) doSearch(q, { userTypeChange: true });
});
document.getElementById("dateTo").addEventListener("change", () => {
  const fromEl = document.getElementById("dateFrom");
  const toEl   = document.getElementById("dateTo");
  if (!fromEl.value || !toEl.value) return;
  if (fromEl.value > toEl.value) {
    [fromEl.value, toEl.value] = [toEl.value, fromEl.value];
  }
  const q = document.getElementById("resultInput").value.trim();
  if (q) doSearch(q, { userTypeChange: true });
});


window.addEventListener("popstate", loadUrl);

// 初期化
loadUrl();
