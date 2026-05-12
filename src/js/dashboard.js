// ===== DASHBOARD =====
function updateCounts() {
  // Sync overdue status before counting
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  state.tasks.forEach(t => {
    if ((t.status === 'current' || t.status === 'pending') && !t.checked && t.dueRaw && t.dueRaw !== 'TBD') {
      const due = new Date(t.dueRaw + 'T00:00:00');
      due.setHours(0, 0, 0, 0);
      if (due < now) t.status = 'overdue';
    }
  });

  const pending = state.tasks.filter(t => (t.status === 'current' || t.status === 'pending') && !t.checked).length;
  const overdue = state.tasks.filter(t => t.status === 'overdue').length;
  const completed = state.tasks.filter(t => t.checked || t.status === 'past' || t.status === 'completed').length;
  const el1 = document.getElementById('pending-count');
  const el2 = document.getElementById('overdue-count');
  const el3 = document.getElementById('completed-count');
  if (el1) el1.textContent = pending;
  if (el2) el2.textContent = overdue;
  if (el3) el3.textContent = completed;
}

function toggleClass(el) {
  el.classList.toggle('open');
  const detail = el.querySelector('.class-detail');
  if (detail) detail.style.display = el.classList.contains('open') ? 'block' : 'none';
}

function renderDashboardName() {
  const heroName = document.querySelector('.dashboard-hero h1');
  if (heroName) heroName.textContent = state.profile.name || 'Welcome!';
}

function renderUpcomingSection() {
  const container = document.getElementById('dashboard-upcoming');
  if (!container) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const in7 = new Date(today);
  in7.setDate(in7.getDate() + 7);

  const upTasks = state.tasks
    .filter(t => !t.checked && t.status !== 'past' && t.dueRaw && t.dueRaw !== 'TBD')
    .map(t => ({ ...t, _date: new Date(t.dueRaw + 'T00:00:00'), _kind: 'task' }))
    .filter(t => t._date >= today && t._date <= in7)
    .sort((a, b) => a._date - b._date)
    .slice(0, 5);

  const upExams = state.exams
    .filter(e => e.status === 'incoming' && e.dateRaw)
    .map(e => ({ ...e, _date: new Date(e.dateRaw + 'T00:00:00'), _kind: 'exam' }))
    .filter(e => e._date >= today && e._date <= in7)
    .sort((a, b) => a._date - b._date)
    .slice(0, 5);

  const all = [...upTasks, ...upExams].sort((a, b) => a._date - b._date);

  if (!all.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:0.88rem;padding:12px 0;">Nothing due in the next 7 days 🎉</p>';
    return;
  }

  container.innerHTML = all.map(item => {
    const icon = item._kind === 'exam' ? '📄' : '📋';
    const label = item._kind === 'exam' ? item.name : item.name;
    const subj = item.subject || '';
    const dateStr = item._date.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' });
    const timeStr = (item._kind === 'task' ? item.dueTime : item.time) ? ' · ' + formatTimeLabel(item._kind === 'task' ? item.dueTime : item.time) : '';
    const color = item._kind === 'exam' ? 'var(--blue)' : (item.status === 'overdue' ? 'var(--danger)' : 'var(--success)');
    return `<div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--border);">
      <span style="font-size:1.2rem;">${icon}</span>
      <div style="flex:1;min-width:0;">
        <div style="font-weight:600;font-size:0.9rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(label)}</div>
        <div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(subj)} · ${dateStr}${timeStr}</div>
      </div>
      <span style="font-size:0.75rem;font-weight:700;color:${color};white-space:nowrap;">${item._kind === 'exam' ? 'EXAM' : item.type || 'TASK'}</span>
    </div>`;
  }).join('');
}

function renderClasses() {
  renderDashboardName();
  const markup = state.classes.map(c => `
    <div class="class-card" onclick="window.location.href='classes.html';">
      <span>${escapeHtml(c.subject)}</span>
      ${c.section ? `<span class="card-section">${escapeHtml(c.section)}</span>` : ''}
    </div>
  `).join('');
  const dashboardGrid = document.getElementById('classes-grid');
  if (dashboardGrid) dashboardGrid.innerHTML = markup;
  const classesPageGrid = document.getElementById('classes-page-grid');
  if (classesPageGrid) classesPageGrid.innerHTML = markup;
}
