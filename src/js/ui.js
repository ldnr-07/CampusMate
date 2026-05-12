// ===== DATETIME DISPLAY =====
function updateDateTime() {
  const datetimeEl = document.getElementById('topbar-datetime');
  if (!datetimeEl) return;

  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  datetimeEl.innerHTML = `<span class="time">${timeStr}</span> <span class="date">${dateStr}</span>`;
}

// ===== MODAL =====
function openModal(content) {
  document.getElementById('modal-content').innerHTML = content;
  document.getElementById('modal-overlay').classList.add('active');
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  window._editingClassId = null;
}

// ===== NOTIFICATION BADGE =====
function updateNotifBadge() {
  const badge = document.getElementById('notif-badge');
  if (!badge) return;
  const hasOverdue = state.tasks.some(t => t.status === 'overdue' && !t.checked);
  const hasDueSoon = state.tasks.some(t => {
    if (t.checked || t.status === 'overdue') return false;
    if (!t.dueRaw) return false;
    const diff = (new Date(t.dueRaw + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 2;
  });
  const hasUpcomingExam = state.exams.some(e => {
    if (e.status !== 'incoming' || !e.dateRaw) return false;
    const diff = (new Date(e.dateRaw + 'T00:00:00') - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 3;
  });
  badge.style.display = (hasOverdue || hasDueSoon || hasUpcomingExam) ? 'block' : 'none';
}

// ===== TOAST =====
function showToast(msg) {
  const toast = document.getElementById('toast');
  toast.textContent = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2800);
}

// ===== NOTIFICATIONS / SETTINGS =====
function showNotifications() {
  const badge = document.getElementById('notif-badge');
  if (badge) badge.style.display = 'none';
  const overdue = state.tasks.filter(t => t.status === 'overdue' && !t.checked);
  const upcoming = state.exams.filter(e => e.status === 'incoming').slice(0, 3);
  const dueSoon = state.tasks.filter(t => {
    if (t.checked || t.status === 'overdue') return false;
    if (!t.dueRaw) return false;
    const diff = (new Date(t.dueRaw) - new Date()) / (1000 * 60 * 60 * 24);
    return diff >= 0 && diff <= 7;
  });

  let items = '';
  overdue.forEach(t => {
    items += `<div style="padding:12px;background:#fff5f5;border-radius:8px;font-size:0.88rem;display:flex;gap:10px;align-items:flex-start;">
      <span style="color:#e53e3e;flex-shrink:0;margin-top:2px;">${icon('warning',16)}</span>
      <div><strong>Overdue: ${escapeHtml(t.name)}</strong><br><span style="color:#e53e3e;">Was due ${t.due}</span></div></div>`;
  });
  dueSoon.forEach(t => {
    items += `<div style="padding:12px;background:#f7f9fc;border-radius:8px;font-size:0.88rem;display:flex;gap:10px;align-items:flex-start;">
      <span style="color:var(--blue);flex-shrink:0;margin-top:2px;">${icon('tasks',16)}</span>
      <div><strong>Due Soon: ${escapeHtml(t.name)}</strong><br><span style="color:#888;">Due ${t.due}</span></div></div>`;
  });
  upcoming.forEach(e => {
    items += `<div style="padding:12px;background:#f0f7ff;border-radius:8px;font-size:0.88rem;display:flex;gap:10px;align-items:flex-start;">
      <span style="color:var(--blue);flex-shrink:0;margin-top:2px;">${icon('exam',16)}</span>
      <div><strong>Upcoming Exam: ${escapeHtml(e.name)}</strong><br><span style="color:#888;">${e.date}</span></div></div>`;
  });
  if (!items) items = `<div style="padding:20px;text-align:center;color:#888;font-size:0.9rem;">No new notifications</div>`;

  openModal(`<h3 style="display:flex;align-items:center;gap:8px;">${icon('bell',20)} Notifications</h3><div style="margin-top:12px;display:flex;flex-direction:column;gap:10px;">${items}</div>`);
}

async function showSettings(prefillAcad) {
  const darkModeChecked = localStorage.getItem('darkMode') === 'true' ? 'checked' : '';
  // Load academic data from profile (unless pre-filled data is passed to avoid re-fetch)
  let acad = { school: '', course: '', year_level: '', semester: '', academic_year: '', sem1_start: '', sem1_end: '', sem2_start: '', sem2_end: '', midyear_start: '', midyear_end: '' };
  if (prefillAcad) {
    acad = { ...acad, ...prefillAcad };
  } else {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data } = await supabase.from('profiles').select('school,course,year_level,semester,academic_year,sem1_start,sem1_end,sem2_start,sem2_end,midyear_start,midyear_end').eq('id', user.id).single();
        if (data) acad = { ...acad, ...data };
      }
    } catch (e) {}
  }
  const content = `
    <h3 style="display:flex;align-items:center;gap:8px;">${icon('settings',20)} Settings</h3>
    <div style="margin-top:12px;display:flex;flex-direction:column;gap:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 0;border-bottom:1px solid var(--gray-pale);">
        <span style="font-weight:600;color:var(--text-primary);display:flex;align-items:center;gap:8px;">${icon('moon',16)} Dark Mode</span>
        <label class="toggle-switch" style="cursor:pointer;position:relative;display:inline-block;width:48px;height:26px;">
          <input type="checkbox" id="dark-mode-setting" style="opacity:0;width:0;height:0;" onchange="toggleDarkModeFromSettings()" ${darkModeChecked}>
          <span class="toggle-slider" style="position:absolute;inset:0;background:var(--gray-200);border-radius:13px;transition:0.3s;"></span>
        </label>
      </div>

      <div style="padding:10px 0;">
        <div style="font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:8px;margin-bottom:14px;">${icon('classes',16)} Academic Setup</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="display:flex;flex-direction:column;gap:4px;">
            <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);">School / University</label>
            <input id="acad-school" type="text" value="${escapeHtml(acad.school||'')}" placeholder="e.g. University of the Philippines" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:0.88rem;background:var(--bg-input);color:var(--text-primary);" />
          </div>
          <div style="display:flex;gap:10px;">
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);">Course / Program</label>
              <input id="acad-course" type="text" value="${escapeHtml(acad.course||'')}" placeholder="e.g. BSCS" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:0.88rem;background:var(--bg-input);color:var(--text-primary);width:100%;box-sizing:border-box;" />
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);">Year Level</label>
              <select id="acad-year" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:0.88rem;background:var(--bg-input);color:var(--text-primary);">
                <option value="">Select...</option>
                ${['1st Year','2nd Year','3rd Year','4th Year','5th Year','Graduate'].map(y=>`<option value="${y}" ${acad.year_level===y?'selected':''}>${y}</option>`).join('')}
              </select>
            </div>
          </div>
          <div style="display:flex;gap:10px;">
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);">Semester</label>
              <select id="acad-semester" onchange="onSemesterFilterChange()" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:0.88rem;background:var(--bg-input);color:var(--text-primary);">
                <option value="">Select...</option>
                ${['1st Semester','2nd Semester','Summer','Midyear'].map(s=>`<option value="${s}" ${acad.semester===s?'selected':''}>${s}</option>`).join('')}
              </select>
            </div>
            <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
              <label style="font-size:0.78rem;font-weight:600;color:var(--text-muted);">Academic Year</label>
              <input id="acad-year-input" type="text" value="${escapeHtml(acad.academic_year||'')}" placeholder="e.g. 2025–2026" style="padding:8px 12px;border-radius:8px;border:1px solid var(--border);font-size:0.88rem;background:var(--bg-input);color:var(--text-primary);width:100%;box-sizing:border-box;" />
            </div>
          </div>
          <div style="margin-top:6px;border-top:1px solid var(--gray-pale);padding-top:12px;display:flex;flex-direction:column;gap:10px;">
            <div style="font-size:0.8rem;font-weight:700;color:var(--text-secondary);">Semester Dates</div>

            <div id="sem-block-1" style="background:var(--bg-input);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:0.78rem;font-weight:700;color:var(--blue);">1st Semester</div>
              <div style="display:flex;gap:10px;">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                  <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">Start Date</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="sem1-start-dp" value="${acad.sem1_start||''}" placeholder="Select date" readonly style="flex:1;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:0.85rem;background:var(--bg-card);color:var(--text-primary);" onclick="openDatePicker('sem1-start-dp','1st Sem Start','settings')" />
                    <button type="button" onclick="openDatePicker('sem1-start-dp','1st Sem Start','settings')" style="background:var(--blue);color:white;border:none;padding:7px 10px;border-radius:8px;cursor:pointer;flex-shrink:0;">📅</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                  <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">End Date</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="sem1-end-dp" value="${acad.sem1_end||''}" placeholder="Select date" readonly style="flex:1;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:0.85rem;background:var(--bg-card);color:var(--text-primary);" onclick="openDatePicker('sem1-end-dp','1st Sem End','settings')" />
                    <button type="button" onclick="openDatePicker('sem1-end-dp','1st Sem End','settings')" style="background:var(--blue);color:white;border:none;padding:7px 10px;border-radius:8px;cursor:pointer;flex-shrink:0;">📅</button>
                  </div>
                </div>
              </div>
            </div>

            <div id="sem-block-2" style="background:var(--bg-input);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:0.78rem;font-weight:700;color:var(--blue);">2nd Semester</div>
              <div style="display:flex;gap:10px;">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                  <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">Start Date</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="sem2-start-dp" value="${acad.sem2_start||''}" placeholder="Select date" readonly style="flex:1;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:0.85rem;background:var(--bg-card);color:var(--text-primary);" onclick="openDatePicker('sem2-start-dp','2nd Sem Start','settings')" />
                    <button type="button" onclick="openDatePicker('sem2-start-dp','2nd Sem Start','settings')" style="background:var(--blue);color:white;border:none;padding:7px 10px;border-radius:8px;cursor:pointer;flex-shrink:0;">📅</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                  <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">End Date</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="sem2-end-dp" value="${acad.sem2_end||''}" placeholder="Select date" readonly style="flex:1;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:0.85rem;background:var(--bg-card);color:var(--text-primary);" onclick="openDatePicker('sem2-end-dp','2nd Sem End','settings')" />
                    <button type="button" onclick="openDatePicker('sem2-end-dp','2nd Sem End','settings')" style="background:var(--blue);color:white;border:none;padding:7px 10px;border-radius:8px;cursor:pointer;flex-shrink:0;">📅</button>
                  </div>
                </div>
              </div>
            </div>

            <div id="sem-block-mid" style="background:var(--bg-input);border-radius:10px;padding:12px;display:flex;flex-direction:column;gap:8px;">
              <div style="font-size:0.78rem;font-weight:700;color:#38a169;">Midyear / Summer</div>
              <div style="display:flex;gap:10px;">
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                  <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">Start Date</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="midyear-start-dp" value="${acad.midyear_start||''}" placeholder="Select date" readonly style="flex:1;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:0.85rem;background:var(--bg-card);color:var(--text-primary);" onclick="openDatePicker('midyear-start-dp','Midyear Start','settings')" />
                    <button type="button" onclick="openDatePicker('midyear-start-dp','Midyear Start','settings')" style="background:#38a169;color:white;border:none;padding:7px 10px;border-radius:8px;cursor:pointer;flex-shrink:0;">📅</button>
                  </div>
                </div>
                <div style="display:flex;flex-direction:column;gap:4px;flex:1;">
                  <label style="font-size:0.72rem;font-weight:600;color:var(--text-muted);">End Date</label>
                  <div style="display:flex;gap:6px;align-items:center;">
                    <input type="text" id="midyear-end-dp" value="${acad.midyear_end||''}" placeholder="Select date" readonly style="flex:1;cursor:pointer;padding:7px 10px;border-radius:8px;border:1px solid var(--border);font-size:0.85rem;background:var(--bg-card);color:var(--text-primary);" onclick="openDatePicker('midyear-end-dp','Midyear End','settings')" />
                    <button type="button" onclick="openDatePicker('midyear-end-dp','Midyear End','settings')" style="background:#38a169;color:white;border:none;padding:7px 10px;border-radius:8px;cursor:pointer;flex-shrink:0;">📅</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <button onclick="saveAcademicSetup()" style="margin-top:4px;background:var(--blue);color:white;border:none;padding:9px 20px;border-radius:8px;font-weight:700;cursor:pointer;font-size:0.88rem;align-self:flex-end;">Save Academic Info</button>
        </div>
      </div>
    </div>
    <style>
      #dark-mode-setting:checked + .toggle-slider { background: var(--blue); }
      #dark-mode-setting:checked + .toggle-slider:before { transform: translateX(22px); }
      .toggle-slider:before { content: ''; position: absolute; height: 20px; width: 20px; left: 3px; bottom: 3px; background: white; border-radius: 50%; transition: 0.3s; }
    </style>
  `;
  openModal(content);
  setTimeout(onSemesterFilterChange, 30);
}

function onSemesterFilterChange() {
  const val = document.getElementById('acad-semester')?.value || '';
  const b1   = document.getElementById('sem-block-1');
  const b2   = document.getElementById('sem-block-2');
  const bmid = document.getElementById('sem-block-mid');
  if (!b1) return;
  if (val === '') {
    b1.style.display = b2.style.display = bmid.style.display = 'flex';
  } else if (val === '1st Semester') {
    b1.style.display = 'flex'; b2.style.display = 'none'; bmid.style.display = 'none';
  } else if (val === '2nd Semester') {
    b1.style.display = 'none'; b2.style.display = 'flex'; bmid.style.display = 'none';
  } else if (val === 'Summer' || val === 'Midyear') {
    b1.style.display = 'none'; b2.style.display = 'none'; bmid.style.display = 'flex';
  }
}

async function saveAcademicSetup() {
  const school        = document.getElementById('acad-school')?.value.trim() || '';
  const course        = document.getElementById('acad-course')?.value.trim() || '';
  const year_level    = document.getElementById('acad-year')?.value || '';
  const semester      = document.getElementById('acad-semester')?.value || '';
  const academic_year = document.getElementById('acad-year-input')?.value.trim() || '';
  const sem1_start    = document.getElementById('sem1-start-dp')?.value || null;
  const sem1_end      = document.getElementById('sem1-end-dp')?.value || null;
  const sem2_start    = document.getElementById('sem2-start-dp')?.value || null;
  const sem2_end      = document.getElementById('sem2-end-dp')?.value || null;
  const midyear_start = document.getElementById('midyear-start-dp')?.value || null;
  const midyear_end   = document.getElementById('midyear-end-dp')?.value || null;

  if (sem1_start && sem1_end && sem1_start > sem1_end) { showToast('1st Semester end must be after start'); return; }
  if (sem2_start && sem2_end && sem2_start > sem2_end) { showToast('2nd Semester end must be after start'); return; }
  if (midyear_start && midyear_end && midyear_start > midyear_end) { showToast('Midyear end must be after start'); return; }

  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Not logged in'); return; }
    const { error } = await supabase.from('profiles')
      .update({ school, course, year_level, semester, academic_year, sem1_start, sem1_end, sem2_start, sem2_end, midyear_start, midyear_end, updated_at: new Date().toISOString() })
      .eq('id', user.id);
    if (error) throw error;
    window._acadData = null;
    showToast('Academic info saved!');
  } catch (e) {
    console.error(e);
    showToast('Failed to save academic info');
  }
}

function toggleNotificationSetting() {
  const cb = document.getElementById('notif-setting');
  if (!cb) return;
  if (cb.checked) {
    if (!('Notification' in window)) { showToast('Notifications not supported'); cb.checked = false; return; }
    Notification.requestPermission().then(perm => {
      if (perm === 'granted') { showToast('Notifications enabled'); }
      else { showToast('Notification permission denied'); cb.checked = false; }
    });
  } else {
    showToast('Notifications disabled — you can re-enable via browser settings');
  }
}

function saveLanguageSetting(lang) {
  localStorage.setItem('appLang', lang);
  showToast('Language preference saved');
}

function handleAddNew() {
  const page = state.currentPage;
  if (page === 'page-tasks') { openAddTask(); return; }
  if (page === 'page-exam') { openAddExam(); return; }
  if (page === 'page-classes') { openAddSubject(); return; }
  if (page === 'page-quiz') { document.getElementById('quiz-topic')?.focus(); return; }

  const content = `
    <h3 style="display:flex;align-items:center;gap:8px;">${icon('plus',20)} Add New</h3>
    <p style="color:#888;margin-bottom:16px;font-size:0.88rem;">What would you like to add?</p>
    <div style="display:flex;flex-direction:column;gap:10px;">
      <button class="btn-primary" onclick="closeModal();openAddTask();">${icon('tasks',16)} New Task</button>
      <button class="btn-primary" style="background:#1a1a2e;" onclick="closeModal();openAddExam();">${icon('exam',16)} New Exam</button>
      <button class="btn-primary" style="background:#2b6cb0;" onclick="closeModal();openAddSubject();">${icon('classes',16)} New Class</button>
      <button class="btn-primary" style="background:#38a169;" onclick="closeModal();window.location.href='quiz.html';">${icon('quiz',16)} Generate Quiz</button>
    </div>
  `;
  openModal(content);
}

// ===== DARK MODE =====
function initDarkMode() {
  if (localStorage.getItem('darkMode') === 'true') {
    document.documentElement.setAttribute('data-theme', 'dark');
  }
}

function toggleDarkModeFromSettings() {
  const isDarkMode = localStorage.getItem('darkMode') === 'true';
  localStorage.setItem('darkMode', !isDarkMode);
  if (!isDarkMode) {
    document.documentElement.setAttribute('data-theme', 'dark');
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
  showToast(!isDarkMode ? 'Dark mode enabled' : 'Light mode enabled');
}

// ===== CALENDAR SYNC =====
function syncCalendarEvents() {
  state.events = []; // renderCalendar re-adds holidays each time, so clear everything here

  state.tasks.forEach(t => {
    if (t.dueRaw) {
      const timeLabel = t.dueTime ? formatTimeLabel(t.dueTime) : '';
      const startHour = t.dueTime ? parseInt(t.dueTime.split(':')[0], 10) : null;
      state.events.push({ date: t.dueRaw, title: t.name, type: 'task', timeLabel, startHour });
    }
  });

  state.exams.forEach(e => {
    if (e.dateRaw) {
      const timeLabel = e.time ? formatTimeLabel(e.time) : '';
      const startHour = e.time ? parseInt(e.time.split(':')[0], 10) : null;
      state.events.push({ date: e.dateRaw, title: e.name, type: 'exam', timeLabel, startHour });
    }
  });

// Expand recurring classes into dated events
  // Window spans from the earliest class startDate to the latest class endDate,
  // falling back to a 6-month window around today for classes with no dates set.
  const SHORT_DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const fallbackStart = new Date(); fallbackStart.setMonth(fallbackStart.getMonth() - 1); fallbackStart.setHours(0,0,0,0);
  const fallbackEnd   = new Date(); fallbackEnd.setMonth(fallbackEnd.getMonth() + 5);     fallbackEnd.setHours(0,0,0,0);
  // Compute a window that covers every class's own date range
  let winStart = new Date(fallbackStart);
  let winEnd   = new Date(fallbackEnd);
  state.classes.forEach(c => {
    if (c.startDate) { const d = new Date(c.startDate + 'T00:00:00'); if (d < winStart) winStart = d; }
    if (c.endDate)   { const d = new Date(c.endDate   + 'T00:00:00'); if (d > winEnd)   winEnd   = d; }
  });
  state.classes.forEach(c => {
    const classDays = c.days && c.days.length ? c.days : [];
    if (!classDays.length) return;
    // Parse startHour from 12h time string e.g. "9:00 AM" or 24h "09:00"
    let startHour = null;
    if (c.startTime) {
      const m12 = c.startTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
      if (m12) {
        let h = parseInt(m12[1], 10);
        const ampm = m12[3].toUpperCase();
        if (ampm === 'PM' && h !== 12) h += 12;
        if (ampm === 'AM' && h === 12) h = 0;
        startHour = h;
      } else {
        startHour = parseInt(c.startTime.split(':')[0], 10);
      }
    }
    const timeLabel = c.startTime && c.endTime ? `${c.startTime} – ${c.endTime}` : '';
    // Clamp the iteration window to the class's own start/end dates if set
    const classStart = c.startDate ? new Date(c.startDate + 'T00:00:00') : new Date(winStart);
    const classEnd   = c.endDate   ? new Date(c.endDate   + 'T00:00:00') : new Date(winEnd);
    const iterStart  = classStart > winStart ? classStart : new Date(winStart);
    const iterEnd    = classEnd   < winEnd   ? classEnd   : new Date(winEnd);
    for (let d = new Date(iterStart); d <= iterEnd; d.setDate(d.getDate() + 1)) {
      const shortDayName = SHORT_DAY_NAMES[d.getDay()];
      if (classDays.some(cd => cd.trim().toLowerCase() === shortDayName.toLowerCase())) {
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        state.events.push({ date: dateStr, title: c.subject, type: 'class', timeLabel, startHour });
      }
    }
  });
}

// ===== APP INIT (called after successful login) =====
async function initApp() {
  let loader = document.getElementById('app-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'app-loader';
    loader.innerHTML = `
      <div style="position:relative;display:flex;align-items:center;justify-content:center;">
        <div style="
          width:220px;height:220px;border-radius:25%;
          background:var(--surface);
          box-shadow:0 8px 40px rgba(0,0,0,0.18);
          display:flex;align-items:center;justify-content:center;
          flex-direction:column;gap:14px;
        ">
          <div class="quiz-spinner" style="width:44px;height:44px;border-width:5px;"></div>
          <p style="font-family:var(--brand-font);font-weight:700;color:var(--text-secondary);font-size:0.9rem;margin:0;">Loading...</p>
        </div>
      </div>`;
    loader.style.cssText = 'position:fixed;inset:0;background:transparent;z-index:9999;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(loader);
  }

await Promise.all([
    loadTasksFromSupabase(),
    loadExamsFromSupabase(),
    loadClassesFromSupabase(),
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from('profiles')
        .select('first_name,last_name,username,email,dob,sex,avatar_url,created_at,updated_at')
        .eq('id', user.id)
        .single();
      if (prof) {
        state.profile.name      = [prof.first_name, prof.last_name].filter(Boolean).join(' ');
        state.profile.username  = prof.username  || '';
        state.profile.email     = prof.email     || user.email || '';
        state.profile.dob       = prof.dob       || '';
        state.profile.sex       = prof.sex       || '';
        state.profile.avatarUrl = prof.avatar_url || '';
        state.profile.createdAt = prof.created_at || '';
        state.profile.updatedAt = prof.updated_at || '';
      } else {
        // Fall back to auth email if no profile row exists yet
        state.profile.email = user.email || '';
      }
    })(),
  ]);
  syncCalendarEvents();
  updateCounts();
  renderUpcomingSection();
  updateNotifBadge();
  renderCalendar();
  setupRealtime();

  loader.remove();
}

// ===== REALTIME =====
let _realtimeChannel = null;
let _lastSyncToast = 0;
function setupRealtime() {
  if (_realtimeChannel) supabase.removeChannel(_realtimeChannel);
  _realtimeChannel = supabase
    .channel('db-changes')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, async (payload) => {
      const wasOtherDevice = payload.session_id !== (await supabase.auth.getSession()).data.session?.user?.id;
      await loadTasksFromSupabase(); syncCalendarEvents(); updateCounts(); renderUpcomingSection(); updateNotifBadge(); renderCalendar();
      if (wasOtherDevice) debounceSyncToast('Tasks synced');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'exams' }, async (payload) => {
      const wasOtherDevice = payload.session_id !== (await supabase.auth.getSession()).data.session?.user?.id;
      await loadExamsFromSupabase(); syncCalendarEvents(); updateCounts(); renderUpcomingSection(); updateNotifBadge(); renderCalendar();
      if (wasOtherDevice) debounceSyncToast('Exams synced');
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, async (payload) => {
      const wasOtherDevice = payload.session_id !== (await supabase.auth.getSession()).data.session?.user?.id;
      await loadClassesFromSupabase(); syncCalendarEvents(); renderCalendar();
      if (wasOtherDevice) debounceSyncToast('Classes synced');
    })
    .subscribe();
}

function debounceSyncToast(msg) {
  const now = Date.now();
  if (now - _lastSyncToast > 3000) {
    _lastSyncToast = now;
    showToast(`🔄 ${msg} from cloud`);
  }
}

// ===== INIT =====
document.addEventListener('DOMContentLoaded', () => {
  if (EMAILJS_CONFIG.PUBLIC_KEY !== 'YOUR_PUBLIC_KEY') {
    emailjs.init(EMAILJS_CONFIG.PUBLIC_KEY);
  }

  initDarkMode();

  updateDateTime();
  setInterval(updateDateTime, 1000);

  document.getElementById('page-login').classList.add('active');
  state.calDate = new Date();
});