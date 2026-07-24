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
const DRUM_ITEM_HEIGHT = 16;
const DRUM_CENTER_OFFSET = 2;
const DRUM_LOOP_COUNT = 7;
const DRUM_HOME_POSITION = Math.floor(DRUM_LOOP_COUNT / 2) * topSearchTypes.length;
const DRUM_MIN_POSITION = topSearchTypes.length;
const DRUM_MAX_POSITION = (DRUM_LOOP_COUNT - 2) * topSearchTypes.length;
let drumPosition = DRUM_HOME_POSITION;
let drumDrag = null;

for (let loop = 0; loop < DRUM_LOOP_COUNT; loop += 1) {
  topSearchTypes.forEach((type, index) => {
    const item = document.createElement("span");
    item.className = "scope-drum-item";
    item.dataset.searchType = type;
    item.dataset.drumPosition = String(loop * topSearchTypes.length + index);
    item.textContent = topSearchTreeButtons[index].textContent;
    topSearchDrumItems.appendChild(item);
  });
}
const topSearchDrumOptions = Array.from(document.querySelectorAll(".scope-drum-item"));

function typeIndexForDrumPosition(position) {
  return ((position % topSearchTypes.length) + topSearchTypes.length) % topSearchTypes.length;
}

function moveDrumTo(position, animate = true) {
  topSearchDrumItems.style.transition = animate ? "" : "none";
  topSearchDrumItems.style.transform = `translateY(${DRUM_CENTER_OFFSET - position * DRUM_ITEM_HEIGHT}px)`;
  if (!animate) requestAnimationFrame(() => { topSearchDrumItems.style.transition = ""; });
}

function closestDrumPositionForType(type) {
  const typeIndex = Math.max(0, topSearchTypes.indexOf(type));
  let closest = typeIndex;
  let distance = Infinity;
  for (let loop = 0; loop < DRUM_LOOP_COUNT; loop += 1) {
    const candidate = loop * topSearchTypes.length + typeIndex;
    const candidateDistance = Math.abs(candidate - drumPosition);
    if (candidateDistance < distance) {
      closest = candidate;
      distance = candidateDistance;
    }
  }
  return closest;
}

function recenterDrumIfNeeded() {
  if (drumPosition > DRUM_MIN_POSITION && drumPosition < DRUM_MAX_POSITION) return;
  const scheduledPosition = drumPosition;
  const currentTypeIndex = typeIndexForDrumPosition(scheduledPosition);
  window.setTimeout(() => {
    if (drumPosition !== scheduledPosition) return;
    drumPosition = DRUM_HOME_POSITION + currentTypeIndex;
    moveDrumTo(drumPosition, false);
  }, 230);
}

function syncTopSearchType(value, preferredPosition) {
  const typeIndex = Math.max(0, topSearchTypes.indexOf(value));
  drumPosition = preferredPosition === undefined ? closestDrumPositionForType(value) : preferredPosition;
  topSearchTreeButtons.forEach(button => {
    const active = button.dataset.searchType === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
  });
  topSearchDrumOptions.forEach(item => item.classList.toggle("active", item.dataset.searchType === value));
  moveDrumTo(drumPosition);
  recenterDrumIfNeeded();
  return typeIndex;
}

function selectTopSearchType(value, preferredPosition) {
  const radio = document.querySelector(`input[name="searchType"][value="${value}"]`);
  if (radio) radio.checked = true;
  syncTopSearchType(value, preferredPosition);
  window.__userChangedType = true;
}

function selectRelativeDrumType(direction) {
  if ((direction > 0 && drumPosition >= DRUM_MAX_POSITION) || (direction < 0 && drumPosition <= DRUM_MIN_POSITION)) {
    drumPosition = DRUM_HOME_POSITION + typeIndexForDrumPosition(drumPosition);
    moveDrumTo(drumPosition, false);
  }
  const nextPosition = drumPosition + direction;
  const nextType = topSearchTypes[typeIndexForDrumPosition(nextPosition)];
  selectTopSearchType(nextType, nextPosition);
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
  drumDrag = { startY: e.clientY, startPosition: drumPosition, pointerId: e.pointerId };
  topSearchDrum.setPointerCapture(e.pointerId);
});

topSearchDrum.addEventListener("pointermove", e => {
  if (!drumDrag || e.pointerId !== drumDrag.pointerId) return;
  const position = drumDrag.startPosition - (e.clientY - drumDrag.startY) / DRUM_ITEM_HEIGHT;
  const clampedPosition = Math.max(DRUM_MIN_POSITION, Math.min(DRUM_MAX_POSITION, position));
  topSearchDrumItems.style.transition = "none";
  topSearchDrumItems.style.transform = `translateY(${DRUM_CENTER_OFFSET - clampedPosition * DRUM_ITEM_HEIGHT}px)`;
});

function finishDrumDrag(e) {
  if (!drumDrag || e.pointerId !== drumDrag.pointerId) return;
  const position = Math.round(Math.max(DRUM_MIN_POSITION, Math.min(DRUM_MAX_POSITION, drumDrag.startPosition - (e.clientY - drumDrag.startY) / DRUM_ITEM_HEIGHT)));
  drumDrag = null;
  selectTopSearchType(topSearchTypes[typeIndexForDrumPosition(position)], position);
}

topSearchDrum.addEventListener("pointerup", finishDrumDrag);
topSearchDrum.addEventListener("pointercancel", finishDrumDrag);
syncTopSearchType("all", DRUM_HOME_POSITION);

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
