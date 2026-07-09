/**
 * main.js — WanderAI Global JS
 * Dark mode, toast system, markdown renderer, shared utilities
 */

/* ─── Dark Mode ─── */
const DarkMode = {
  key: 'wanderai_theme',

  init() {
    const saved = localStorage.getItem(this.key) || 'light';
    this.apply(saved);
    const btn = document.getElementById('darkModeToggle');
    if (btn) btn.addEventListener('click', () => this.toggle());
  },

  apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const icon = document.getElementById('darkModeIcon');
    if (icon) {
      icon.className = theme === 'dark' ? 'bi bi-sun-fill' : 'bi bi-moon-stars-fill';
    }
    localStorage.setItem(this.key, theme);
  },

  toggle() {
    const current = document.documentElement.getAttribute('data-theme');
    this.apply(current === 'dark' ? 'light' : 'dark');
  },
};

/* ─── Toast System ─── */
const WanderToast = {
  container: null,

  _getContainer() {
    if (!this.container) {
      this.container = document.getElementById('toastContainer');
    }
    return this.container;
  },

  show(message, type = 'info', duration = 3500) {
    const icons = { success: 'bi-check-circle-fill', error: 'bi-x-circle-fill', info: 'bi-info-circle-fill' };
    const colors = { success: '#22c55e', error: '#ef4444', info: '#3b82d4' };

    const el = document.createElement('div');
    el.className = `wander-toast ${type}`;
    el.innerHTML = `
      <span class="toast-icon" style="color:${colors[type]}">
        <i class="bi ${icons[type] || icons.info}"></i>
      </span>
      <span class="toast-msg">${message}</span>
    `;

    const container = this._getContainer();
    if (container) {
      container.appendChild(el);
      setTimeout(() => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(10px)';
        el.style.transition = '0.3s ease';
        setTimeout(() => el.remove(), 300);
      }, duration);
    }
  },

  success(msg, dur) { this.show(msg, 'success', dur); },
  error(msg, dur)   { this.show(msg, 'error',   dur); },
  info(msg, dur)    { this.show(msg, 'info',     dur); },
};

/* ─── Markdown → HTML renderer ─── */
function markdownToHtml(text) {
  if (!text) return '';
  return text
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm,  '<h3>$1</h3>')
    .replace(/^## (.+)$/gm,   '<h2>$1</h2>')
    .replace(/^# (.+)$/gm,    '<h1>$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code inline
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Horizontal rule
    .replace(/^---+$/gm, '<hr />')
    // Unordered lists
    .replace(/^\s*[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, (m) => `<ul>${m}</ul>`)
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Paragraphs
    .replace(/\n{2,}/g, '</p><p>')
    .replace(/^(?!<[hulo])(.+)$/gm, (m) => `<p>${m}</p>`)
    // Clean up empty paragraphs
    .replace(/<p><\/p>/g, '')
    .replace(/<p>(<[uh])/g, '$1')
    .replace(/(<\/[uh][l1-6]>)<\/p>/g, '$1');
}

/* ─── Navbar active state ─── */
function setActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    if (href && href !== '/' && path.startsWith(href)) {
      link.classList.add('active');
    } else if (href === '/' && path === '/') {
      link.classList.add('active');
    }
  });
}

/* ─── Mobile sidebar toggle (chat page) ─── */
function initSidebarToggle() {
  const toggleBtn = document.getElementById('sidebarToggle');
  const sidebar   = document.getElementById('chatSidebar');
  if (!toggleBtn || !sidebar) return;

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
  });

  // Close on outside click
  document.addEventListener('click', (e) => {
    if (sidebar.classList.contains('open') &&
        !sidebar.contains(e.target) &&
        !toggleBtn.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

/* ─── Scroll reveal ─── */
function initScrollReveal() {
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.style.opacity    = '1';
        entry.target.style.transform  = 'translateY(0)';
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  document.querySelectorAll('.feature-card, .step-item, .kpi-card').forEach(el => {
    el.style.opacity   = '0';
    el.style.transform = 'translateY(20px)';
    el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
    observer.observe(el);
  });
}

/* ─── Health check banner ─── */
async function checkApiHealth() {
  try {
    const res  = await fetch('/api/health');
    const data = await res.json();
    if (!data.env_configured) {
      WanderToast.error(
        '⚠️ IBM watsonx.ai credentials not configured. Please check your .env file.',
        6000
      );
    }
  } catch {}
}

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', () => {
  DarkMode.init();
  setActiveNav();
  initSidebarToggle();

  // Reveal animations only on non-chat pages
  if (!document.querySelector('.chat-layout')) {
    initScrollReveal();
  }

  // Only run health check on first page load
  if (sessionStorage.getItem('health_checked') !== '1') {
    checkApiHealth();
    sessionStorage.setItem('health_checked', '1');
  }
});
