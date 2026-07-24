"use strict";

/* ================================================================
   イベントバインド
   ================================================================ */
document.getElementById("topInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(); });
document.getElementById("resultInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value.trim()); });
document.getElementById("detailInput").addEventListener("keydown", e => { if (e.key === "Enter") doSearch(e.target.value.trim()); });

const topSearchTypeButtons = Array.from(document.querySelectorAll(".top-search-scope-option"));
const topSearchTypes = topSearchTypeButtons.map(button => button.dataset.searchType);

function syncTopSearchType(value) {
  topSearchTypeButtons.forEach(button => {
    const active = button.dataset.searchType === value;
    button.classList.toggle("active", active);
    button.setAttribute("aria-pressed", String(active));
    if (active) button.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  });
}

function selectTopSearchType(value) {
  const radio = document.querySelector(`input[name="searchType"][value="${value}"]`);
  if (radio) radio.checked = true;
  syncTopSearchType(value);
  window.__userChangedType = true;
}

topSearchTypeButtons.forEach(button => button.addEventListener("click", () => {
  selectTopSearchType(button.dataset.searchType);
}));

const topSearchScopeRail = document.getElementById("topSearchScopeRail");
topSearchScopeRail.addEventListener("wheel", e => {
  if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return;
  e.preventDefault();
  const activeType = document.querySelector(".top-search-scope-option.active")?.dataset.searchType;
  const activeIndex = Math.max(0, topSearchTypes.indexOf(activeType));
  const nextIndex = Math.max(0, Math.min(topSearchTypes.length - 1, activeIndex + (e.deltaY > 0 ? 1 : -1)));
  if (nextIndex !== activeIndex) selectTopSearchType(topSearchTypes[nextIndex]);
}, { passive: false });

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
