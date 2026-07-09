/**
 * chat.js — WanderAI AI Chat Interface
 * Handles: message sending, history management, context modes,
 *          markdown rendering, quick prompts, auto-resize textarea
 */

/* ─── State ─── */
let chatHistory = [];        // { role: 'user'|'assistant', content: string }[]
let isSending   = false;
let contextMode = 'general'; // 'general' | 'itinerary' | 'budget'

const contextLabels = {
  general:   'Mode: General Travel Chat',
  itinerary: 'Mode: Itinerary Builder',
  budget:    'Mode: Budget Planner',
};

const contextPrefixes = {
  general:   '',
  itinerary: '[ITINERARY MODE] Please help me build a detailed travel itinerary. ',
  budget:    '[BUDGET MODE] Please help me plan a travel budget. ',
};

/* ─── DOM Refs ─── */
const messagesEl    = () => document.getElementById('chatMessages');
const inputEl       = () => document.getElementById('userInput');
const sendBtnEl     = () => document.getElementById('sendBtn');
const typingEl      = () => document.getElementById('typingIndicator');
const aiStatusEl    = () => document.getElementById('aiStatus');
const charCountEl   = () => document.getElementById('charCount');
const contextLblEl  = () => document.getElementById('contextLabel');

/* ─── Init ─── */
document.addEventListener('DOMContentLoaded', () => {
  const input = inputEl();
  if (!input) return;

  input.addEventListener('keydown', handleKeydown);
  input.addEventListener('input', () => {
    adjustTextarea(input);
    updateCharCount(input.value.length);
  });

  // Load persisted history
  const saved = sessionStorage.getItem('wanderai_chat_history');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (Array.isArray(parsed) && parsed.length) {
        chatHistory = parsed;
        renderSavedHistory();
      }
    } catch {}
  }
});

/* ─── Auto-resize textarea ─── */
function adjustTextarea(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

/* ─── Char counter ─── */
function updateCharCount(len) {
  const el = charCountEl();
  if (el) {
    el.textContent = `${len}/2000`;
    el.style.color = len > 1800 ? 'var(--red)' : '';
  }
}

/* ─── Keyboard handler ─── */
function handleKeydown(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
}

/* ─── Context mode ─── */
function setContext(mode) {
  contextMode = mode;
  document.querySelectorAll('.chip-btn').forEach(b => b.classList.remove('active'));
  const btn = document.getElementById(`chip${mode.charAt(0).toUpperCase() + mode.slice(1)}`);
  if (btn) btn.classList.add('active');
  const lbl = contextLblEl();
  if (lbl) lbl.textContent = contextLabels[mode] || contextLabels.general;
}

/* ─── Quick prompt injection ─── */
function injectPrompt(btn) {
  const prompt = btn.dataset.prompt;
  if (!prompt) return;
  const input = inputEl();
  input.value = prompt;
  adjustTextarea(input);
  updateCharCount(prompt.length);
  input.focus();

  // On mobile: close sidebar
  const sidebar = document.getElementById('chatSidebar');
  if (sidebar && window.innerWidth < 992) sidebar.classList.remove('open');
}

/* ─── Send message ─── */
async function sendMessage() {
  if (isSending) return;

  const input = inputEl();
  const rawText = input.value.trim();
  if (!rawText) return;

  const messageText = contextPrefixes[contextMode] + rawText;

  // Render user bubble
  appendMessage('user', rawText);
  chatHistory.push({ role: 'user', content: messageText });

  // Clear input
  input.value = '';
  adjustTextarea(input);
  updateCharCount(0);

  // Show typing
  isSending = true;
  setLoading(true);

  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: messageText,
        history: chatHistory.slice(0, -1), // send history without current message (backend appends it)
      }),
    });

    const data = await res.json();
    setLoading(false);

    if (data.error) {
      appendMessage('ai', `⚠️ Error: ${data.error}`, data.timestamp || now());
    } else {
      const reply = data.reply || '⚠️ No response received.';
      appendMessage('ai', reply, data.timestamp || now());
      chatHistory.push({ role: 'assistant', content: reply });
      persistHistory();
    }

    // If itinerary/budget, show dashboard CTA
    if (chatHistory.length === 4 && contextMode !== 'general') {
      appendSystemNote(`💡 Tip: Visit the <a href="/dashboard">Dashboard</a> to see your trip summary, or use the <a href="/${contextMode}">dedicated ${contextMode} planner</a> for a structured plan.`);
    }
  } catch (err) {
    setLoading(false);
    appendMessage('ai', '⚠️ Connection error. Please check your network and try again.');
  }

  isSending = false;
}

/* ─── Append a message bubble ─── */
function appendMessage(role, content, time = null) {
  const container = messagesEl();
  if (!container) return;

  const isAI = role === 'ai' || role === 'assistant';
  const t    = time || now();

  const row = document.createElement('div');
  row.className = `message-row ${isAI ? 'ai-row' : 'user-row'}`;

  if (isAI) {
    row.innerHTML = `
      <div class="ai-avatar-sm"><i class="bi bi-airplane-fill"></i></div>
      <div class="message-bubble ai-bubble">
        <div class="bubble-content markdown-render">${markdownToHtml(content)}</div>
        <div class="bubble-time">${t}</div>
      </div>`;
  } else {
    row.innerHTML = `
      <div class="message-bubble">
        <div class="bubble-content user-bubble">${escapeHtml(content)}</div>
        <div class="bubble-time">${t}</div>
      </div>`;
  }

  container.appendChild(row);
  scrollToBottom();
}

/* ─── System note (subtle banner) ─── */
function appendSystemNote(html) {
  const container = messagesEl();
  if (!container) return;
  const note = document.createElement('div');
  note.className = 'text-center my-2';
  note.innerHTML = `<span class="badge bg-surface text-muted border" style="font-size:.8rem;font-weight:500;">${html}</span>`;
  container.appendChild(note);
  scrollToBottom();
}

/* ─── Typing / loading state ─── */
function setLoading(on) {
  const typing = typingEl();
  const btn    = sendBtnEl();
  const status = aiStatusEl();

  if (typing) typing.classList.toggle('d-none', !on);
  if (btn)    btn.disabled = on;
  if (status) status.textContent = on ? 'Thinking…' : 'Ready to plan your trip';

  if (on) scrollToBottom();
}

/* ─── Clear chat ─── */
function clearChat() {
  chatHistory = [];
  sessionStorage.removeItem('wanderai_chat_history');
  const container = messagesEl();
  if (!container) return;

  // Remove all messages except welcome
  const welcome = document.getElementById('welcomeMsg');
  [...container.children].forEach(child => {
    if (child !== welcome) child.remove();
  });
  WanderToast.info('Chat cleared.');
}

/* ─── Render saved history on page load ─── */
function renderSavedHistory() {
  // Clear welcome message
  const welcome = document.getElementById('welcomeMsg');
  if (welcome) welcome.remove();

  chatHistory.forEach(msg => {
    appendMessage(msg.role, msg.content);
  });
}

/* ─── Persist history to sessionStorage ─── */
function persistHistory() {
  try {
    // Keep only last 30 turns to avoid sessionStorage overflow
    const trimmed = chatHistory.slice(-30);
    sessionStorage.setItem('wanderai_chat_history', JSON.stringify(trimmed));
  } catch {}
}

/* ─── Scroll chat to bottom ─── */
function scrollToBottom() {
  const container = messagesEl();
  if (container) {
    requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight;
    });
  }
}

/* ─── Helpers ─── */
function now() {
  return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(str) {
  const d = document.createElement('div');
  d.appendChild(document.createTextNode(str));
  return d.innerHTML;
}
