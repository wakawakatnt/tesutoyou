"use strict";

const API = `${SB_URL}/ai/chat`;
const HIST_KEY = "nang_hist";
const LOG_KEY = "nang_chat_log";
const MAX_CHARS = 500;
const MAX_LOG_MESSAGES = 40;

const form = document.getElementById("chatForm");
const input = document.getElementById("chatInput");
const sendButton = document.getElementById("sendButton");
const chatLog = document.getElementById("chatLog");
const chatStatus = document.getElementById("chatStatus");
const intro = document.getElementById("aiIntro");
const charCount = document.getElementById("charCount");
const modelSelect = document.getElementById("modelSelect");
const thinkingSelect = document.getElementById("thinkingSelect");
const temperatureInput = document.getElementById("temperatureInput");
const newChatButton = document.getElementById("newChatButton");

let sending = false;
let cooldownUntil = 0;
let cooldownTimer = null;
let activeController = null;

function getSavedLog() {
  try {
    const saved = JSON.parse(localStorage.getItem(LOG_KEY) || "[]");
    return Array.isArray(saved) ? saved.filter(item => item && typeof item.text === "string" && ["user", "assistant"].includes(item.role)) : [];
  } catch (_) {
    return [];
  }
}

function saveLog() {
  const messages = Array.from(chatLog.querySelectorAll(".chat-message"))
    .map(node => ({ role: node.dataset.role, text: node.querySelector(".message-content")?.textContent || "" }))
    .filter(item => item.text)
    .slice(-MAX_LOG_MESSAGES);
  try { localStorage.setItem(LOG_KEY, JSON.stringify(messages)); } catch (_) {}
}

function createMessage(role, text = "") {
  const message = document.createElement("article");
  message.className = `chat-message ${role}`;
  message.dataset.role = role;

  const avatar = document.createElement("div");
  avatar.className = "message-avatar";
  avatar.setAttribute("aria-hidden", "true");
  avatar.textContent = role === "user" ? "あなた" : "✦";

  const content = document.createElement("div");
  content.className = "message-content";
  content.textContent = text;

  message.append(avatar, content);
  chatLog.appendChild(message);
  intro.hidden = true;
  message.scrollIntoView({ block: "end", behavior: "smooth" });
  return content;
}

function restoreLog() {
  getSavedLog().forEach(item => createMessage(item.role, item.text));
}

function setStatus(text, type = "loading") {
  chatStatus.hidden = !text;
  chatStatus.classList.toggle("error", type === "error");
  chatStatus.textContent = text || "";
}

function setSending(value) {
  sending = value;
  const locked = value || Date.now() < cooldownUntil;
  input.disabled = locked;
  sendButton.disabled = locked;
  modelSelect.disabled = locked;
  thinkingSelect.disabled = locked;
  temperatureInput.disabled = locked;
  if (!locked) input.focus();
}

function updateCharCount() {
  if (input.value.length > MAX_CHARS) input.value = input.value.slice(0, MAX_CHARS);
  charCount.textContent = `${input.value.length} / ${MAX_CHARS}`;
  input.style.height = "auto";
  input.style.height = `${Math.min(input.scrollHeight, 110)}px`;
}

function buildMessage(question) {
  const temp = temperatureInput.value.trim();
  if (temp !== "" && (!Number.isFinite(Number(temp)) || Number(temp) < 0 || Number(temp) > 2)) {
    throw new Error("temperature は 0〜2 の範囲で指定してください。");
  }
  return `${modelSelect.value},${thinkingSelect.value},${temp}:${question}`;
}

function showCooldown(seconds) {
  cooldownUntil = Date.now() + seconds * 1000;
  clearTimeout(cooldownTimer);
  const tick = () => {
    const remaining = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
    if (!remaining) {
      setStatus("", "loading");
      setSending(false);
      return;
    }
    setStatus(`混雑しています。${remaining}秒後に再試行できます。`, "error");
    setSending(true);
    cooldownTimer = window.setTimeout(tick, 250);
  };
  tick();
}

async function readError(response) {
  const contentType = response.headers.get("Content-Type") || "";
  if (contentType.includes("application/json")) {
    try {
      const json = await response.json();
      return json.error || "エラーが発生しました。";
    } catch (_) {}
  }
  const text = (await response.text()).trim();
  return text || "エラーが発生しました。";
}

function processSseEvent(event, answer) {
  switch (event.type) {
    case "chunk":
      setStatus("");
      answer.textContent += event.text || "";
      answer.scrollIntoView({ block: "end", behavior: "smooth" });
      break;
    case "status":
      setStatus(event.text || "検索しています…");
      break;
    case "history":
      if (typeof event.token === "string" && event.token) localStorage.setItem(HIST_KEY, event.token);
      break;
    case "error":
      setStatus(event.text || "エラーが発生しました。", "error");
      break;
    case "done":
      return true;
  }
  return false;
}

function consumeSseLines(buffer, answer) {
  let completed = false;
  const lines = buffer.split("\n");
  const remainder = lines.pop() || "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.startsWith("data: ")) continue;
    try {
      completed = processSseEvent(JSON.parse(line.slice(6)), answer) || completed;
    } catch (_) {
      // 壊れたイベントは無視し、次のイベントを待つ。
    }
  }

  return { completed, remainder };
}

async function sendMessage(question) {
  createMessage("user", question);
  const answer = createMessage("assistant");
  const controller = new AbortController();
  activeController = controller;
  setStatus("AIが考えています…");
  setSending(true);

  try {
    const response = await fetch(API, {
      method: "POST",
      signal: controller.signal,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: buildMessage(question),
        history_token: localStorage.getItem(HIST_KEY) || null
      })
    });

    if (!response.ok) {
      if (response.status === 403) throw Object.assign(new Error("このネットワークからは利用できません。"), { status: 403 });
      if (response.status === 429) {
        const headerValue = Number(response.headers.get("Retry-After"));
        const retryAfter = Number.isFinite(headerValue) && headerValue > 0 ? Math.ceil(headerValue) : 60;
        throw Object.assign(new Error("混雑しています。しばらくしてから再試行してください。"), { status: 429, retryAfter });
      }
      throw new Error(await readError(response));
    }
    if (!response.body) throw new Error("応答ストリームを開始できませんでした。");

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let completed = false;

    while (!completed) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeSseLines(buffer, answer);
      buffer = parsed.remainder;
      completed = parsed.completed || completed;
    }
    buffer += decoder.decode();
    if (buffer.trim()) {
      const finalLine = buffer.trimEnd();
      if (finalLine.startsWith("data: ")) {
        try { processSseEvent(JSON.parse(finalLine.slice(6)), answer); } catch (_) {}
      }
    }
    if (!answer.textContent) answer.textContent = "応答を受信できませんでした。";
    saveLog();
    if (!chatStatus.classList.contains("error")) setStatus("");
  } catch (error) {
    if (error.name === "AbortError") return;
    if (answer.textContent) {
      answer.textContent += `\n\n${error.message}`;
    } else {
      answer.textContent = error.message;
    }
    saveLog();
    if (error.status === 429) {
      showCooldown(error.retryAfter);
      return;
    }
    setStatus(error.message, "error");
  } finally {
    if (activeController === controller) {
      activeController = null;
      if (Date.now() >= cooldownUntil) setSending(false);
    }
  }
}

form.addEventListener("submit", event => {
  event.preventDefault();
  if (sending || Date.now() < cooldownUntil) return;
  const question = input.value.trim();
  if (!question) {
    setStatus("質問を入力してください。", "error");
    input.focus();
    return;
  }
  try {
    buildMessage(question);
  } catch (error) {
    setStatus(error.message, "error");
    return;
  }
  input.value = "";
  updateCharCount();
  sendMessage(question);
});

input.addEventListener("input", updateCharCount);
input.addEventListener("keydown", event => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

newChatButton.addEventListener("click", () => {
  if (sending && !confirm("送信中の応答があります。新しい会話を開始しますか？")) return;
  clearTimeout(cooldownTimer);
  if (activeController) activeController.abort();
  activeController = null;
  cooldownUntil = 0;
  try {
    localStorage.removeItem(HIST_KEY);
    localStorage.removeItem(LOG_KEY);
  } catch (_) {}
  chatLog.innerHTML = "";
  intro.hidden = false;
  setStatus("");
  setSending(false);
});

restoreLog();
updateCharCount();
