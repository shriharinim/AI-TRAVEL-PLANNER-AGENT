/**
 * dashboard.js — WanderAI Travel Dashboard
 * Populates KPIs, itinerary, checklist, weather, transport from session trip data.
 */

/* ─── Boot ─── */
document.addEventListener('DOMContentLoaded', async () => {
  // tripData is injected by Jinja2 in dashboard.html
  const data = (typeof tripData !== 'undefined' && Object.keys(tripData).length > 0)
    ? tripData
    : await fetchTripData();

  if (data && Object.keys(data).length > 0) {
    showDashboard(data);
  }

  loadChecklist();
});

/* ─── Fetch trip data from server session ─── */
async function fetchTripData() {
  try {
    const res  = await fetch('/api/trip-stats');
    const json = await res.json();
    return json.trip_data || {};
  } catch {
    return {};
  }
}

/* ─── Populate dashboard ─── */
function showDashboard(data) {
  const noTrip  = document.getElementById('noTripState');
  const content = document.getElementById('dashboardContent');
  if (noTrip)  noTrip.classList.add('d-none');
  if (content) content.classList.remove('d-none');

  // KPIs
  setKpi('kpiDestination', data.destination || '—');
  setKpi('kpiDuration',    data.days ? `${data.days} days` : '—');
  setKpi('kpiBudget',      data.budget ? capitalise(data.budget) : '—');
  setKpi('kpiTravelers',   data.travelers ? `${data.travelers} pax` : '—');

  // Itinerary
  const itinEl = document.getElementById('itineraryContent');
  if (itinEl && data.itinerary_text) {
    itinEl.innerHTML = markdownToHtml(data.itinerary_text);
  }

  // Transport
  setEl('flightPref',         data.transport      ? capitalise(data.transport)       : 'Flexible');
  setEl('localTransport',     data.transport      ? capitalise(data.transport)       : '—');
  setEl('accommodationType',  data.accommodation  ? capitalise(data.accommodation)   : '—');

  // Generated at
  if (data.generated_at) {
    const d   = new Date(data.generated_at);
    const str = d.toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });
    appendSystemNote(`Plan generated on ${str}`);
  }
}

/* ─── Weather fetch ─── */
async function fetchWeather() {
  const dest = document.getElementById('kpiDestination')?.textContent;
  if (!dest || dest === '—') {
    WanderToast.error('No destination found. Please generate a trip first.');
    return;
  }

  const widget = document.getElementById('weatherWidget');
  if (widget) {
    widget.innerHTML = `
      <div class="text-center py-3">
        <div class="ai-spinner mb-2"></div>
        <p class="text-muted small">Fetching weather advice for ${dest}…</p>
      </div>`;
  }

  try {
    const month = new Date().toLocaleString('en', { month: 'long' });
    const res   = await fetch('/api/weather-advice', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ destination: dest, month }),
    });
    const data = await res.json();
    if (widget && data.weather_advice) {
      widget.innerHTML = `
        <div class="markdown-render" style="font-size:.88rem;max-height:220px;overflow-y:auto;">
          ${markdownToHtml(data.weather_advice)}
        </div>`;
    }
  } catch {
    if (widget) widget.innerHTML = '<p class="text-muted small text-center">Failed to load weather data.</p>';
    WanderToast.error('Could not fetch weather advice.');
  }
}

/* ─── Travel checklist persistence ─── */
function saveChecklist() {
  const checkboxes = document.querySelectorAll('#travelChecklist input[type="checkbox"]');
  const state = [...checkboxes].map(cb => cb.checked);
  localStorage.setItem('wanderai_checklist', JSON.stringify(state));
}

function loadChecklist() {
  const saved = localStorage.getItem('wanderai_checklist');
  if (!saved) return;
  try {
    const state = JSON.parse(saved);
    const checkboxes = document.querySelectorAll('#travelChecklist input[type="checkbox"]');
    checkboxes.forEach((cb, i) => {
      if (state[i] !== undefined) cb.checked = state[i];
    });
  } catch {}
}

function resetChecklist() {
  document.querySelectorAll('#travelChecklist input[type="checkbox"]')
    .forEach(cb => { cb.checked = false; });
  localStorage.removeItem('wanderai_checklist');
  WanderToast.info('Checklist reset.');
}

/* ─── Print ─── */
function printDashboard() {
  window.print();
}

/* ─── Helpers ─── */
function setKpi(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function setEl(id, value) {
  const el = document.getElementById(id);
  if (el) el.textContent = value;
}

function capitalise(str) {
  if (!str) return str;
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function appendSystemNote(text) {
  const container = document.querySelector('.dash-card-body .markdown-render');
  if (!container) return;
  const note = document.createElement('p');
  note.className = 'text-muted small mt-2';
  note.textContent = text;
  container.appendChild(note);
}
