// ===== CLASS SCHEDULE VIEW =====
let clsTab = 'current';
let currentSelectedClassId = null;

async function loadClassesFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase.from('classes').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) { console.error('Error loading classes:', error); return; }
  // Normalize full day name to short form used by checkboxes
  const toShortDay = d => ({ monday:'Mon',tuesday:'Tue',wednesday:'Wed',thursday:'Thu',friday:'Fri',saturday:'Sat',sunday:'Sun' }[d.toLowerCase().trim()] || d.trim());
  // Parse time string in either '9:00 AM - 12:00 PM' or '17:00-19:00' format
  const parseTimeParts = (t) => {
    if (!t) return ['', ''];
    // 12h format with ' - '
    if (t.includes(' - ')) return t.split(' - ').map(s => s.trim());
    // 24h format with '-'
    const parts = t.split('-');
    if (parts.length === 2) return parts.map(s => s.trim());
    return [t.trim(), ''];
  };
  state.classes = data.map(c => ({
    id: c.id,
    subject: c.subject,
    section: c.section || '',
    schedule: `${c.day || ''} ${c.time || ''}`.trim(),
    teacher: c.instructor || '',
    room: c.room || '',
    building: '',
    days: c.day ? c.day.split('/').map(toShortDay).filter(Boolean) : [],
    startTime: parseTimeParts(c.time)[0],
    endTime: parseTimeParts(c.time)[1],
    mode: 'In Person',
    occurs: 'Repeating',
    startDate: '',
    endDate: '',
  }));
  renderClasses();
  renderClassSchedule();
  populateClassFilter();
}

function switchClassTab(tab) {
  clsTab = tab;
  document.getElementById('cls-tab-current').style.background = tab === 'current' ? 'var(--blue)' : 'transparent';
  document.getElementById('cls-tab-current').style.color = tab === 'current' ? '#fff' : 'var(--blue)';
  document.getElementById('cls-tab-past').style.background = tab === 'past' ? 'var(--blue)' : 'transparent';
  document.getElementById('cls-tab-past').style.color = tab === 'past' ? '#fff' : 'var(--blue)';
  renderClassSchedule();
}

function populateClassFilter() {
  const select = document.getElementById('cls-subject-filter');
  if (!select) return;
  const currentValue = select.value;
  const subjects = ['', ...Array.from(new Set(state.classes.map(c => c.subject)))];
  select.innerHTML = subjects.map(s =>
    `<option value="${s}" ${s === currentValue ? 'selected' : ''}>${s === '' ? 'Select Subject' : s}</option>`
  ).join('') + `<option value="__add_new__">＋ Add New Subject</option>`;
}

function onClassFilterChange() {
  const select = document.getElementById('cls-subject-filter');
  if (!select) return;
  if (select.value === '__add_new__') {
    select.value = '';
    openAddSubject();
    return;
  }
  renderClassSchedule();
}

function getClassOccurrences(cls) {
  // Generate weekly occurrences for the next 8 weeks from today
  const today = new Date();
  today.setHours(0,0,0,0);
  const dayMap = { Sun:0, Mon:1, Tue:2, Wed:3, Thu:4, Fri:5, Sat:6 };
  const days = (cls.days || []).map(d => dayMap[d]).filter(d => d !== undefined);
  const results = [];

  for (let w = 0; w < 8; w++) {
    days.forEach(dayNum => {
      const d = new Date(today);
      d.setDate(today.getDate() + (dayNum - today.getDay() + 7) % 7 + w * 7);
      if (w === 0 && d < today) return;
      results.push(new Date(d));
    });
  }

  return results.sort((a,b) => a - b);
}

function groupByTime(dates) {
  const today = new Date(); today.setHours(0,0,0,0);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate() + 6);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const groups = { Today:[], Tomorrow:[], 'This Week':[], 'Later This Month':[], 'Upcoming':[] };

  dates.forEach(d => {
    const day = new Date(d); day.setHours(0,0,0,0);
    if (day.getTime() === today.getTime()) groups['Today'].push(d);
    else if (day.getTime() === tomorrow.getTime()) groups['Tomorrow'].push(d);
    else if (day <= endOfWeek) groups['This Week'].push(d);
    else if (day <= endOfMonth) groups['Later This Month'].push(d);
    else groups['Upcoming'].push(d);
  });

  return groups;
}

function renderClassSchedule() {
  const container = document.getElementById('cls-schedule-list');
  if (!container) return;

  populateClassFilter();
  const filterVal = document.getElementById('cls-subject-filter')?.value || '';
  const today = new Date(); today.setHours(0,0,0,0);

  // Filter classes: current = has future occurrences, past = end date passed
  let classes = state.classes.filter(c => {
    if (filterVal && c.subject !== filterVal) return false;
    if (clsTab === 'past') {
      return c.endDate && new Date(c.endDate + 'T00:00:00') < today;
    }
    return !c.endDate || new Date(c.endDate + 'T00:00:00') >= today;
  });

  if (classes.length === 0) {
    const tabLabel = clsTab === 'current' ? 'current' : 'past';
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">${icon('empty_cls', 48)}</div><p>No ${tabLabel} classes</p></div>`;
    return;
  }

  // Build all occurrences across all classes
  const allOccurrences = [];
  classes.forEach(cls => {
    if (cls.days && cls.days.length > 0) {
      getClassOccurrences(cls).forEach(date => {
        allOccurrences.push({ cls, date });
      });
    } else {
      // No days set — show once as a generic card
      allOccurrences.push({ cls, date: new Date() });
    }
  });

  allOccurrences.sort((a,b) => a.date - b.date);

  // Group by time
  const grouped = { Today:[], Tomorrow:[], 'This Week':[], 'Later This Month':[], 'Upcoming':[] };
  const todayMs = today.getTime();
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate()+1);
  const endOfWeek = new Date(today); endOfWeek.setDate(today.getDate()+6);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth()+1, 0);

  allOccurrences.forEach(({ cls, date }) => {
    const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const key = d.getTime() === todayMs ? 'Today'
      : d.getTime() === tomorrow.getTime() ? 'Tomorrow'
      : d <= endOfWeek ? 'This Week'
      : d <= endOfMonth ? 'Later This Month'
      : 'Upcoming';
    grouped[key].push({ cls, date });
  });

  let html = '';
  Object.entries(grouped).forEach(([label, items]) => {
    if (items.length === 0) return;
    html += `<div class="cls-group-label">${label}</div>`;
    items.forEach(({ cls, date }) => {
      const dateStr = date.toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' });
      const timeStr = cls.startTime && cls.endTime
        ? `${formatTimeLabel(cls.startTime)} – ${formatTimeLabel(cls.endTime)}`
        : cls.schedule || '';
      html += `
        <div class="cls-card" onclick="showClassDetails(${cls.id}, '${dateStr}')">
          <div class="cls-card-radio">✓</div>
          <div class="cls-card-info">
            <div class="cls-card-title">${cls.subject.toUpperCase()}</div>
            <div class="cls-card-sub">
              <span>${cls.teacher || cls.section || 'No teacher set'}</span>
              <span>${dateStr}</span>
              ${timeStr ? `<span>${timeStr}</span>` : ''}
            </div>
          </div>
          <div class="cls-card-img-placeholder">${icon('classes', 22)}</div>
        </div>
      `;
    });
  });

  container.innerHTML = html || `<div class="empty-state"><div class="empty-icon">${icon('empty_cls', 48)}</div><p>No scheduled classes found</p></div>`;

  if (currentSelectedClassId) {
    const card = container.querySelector(`.cls-card[onclick^="showClassDetails(${currentSelectedClassId},"]`);
    if (card) card.classList.add('selected');
  }
}

function showClassDetails(classId, dateStr) {
  const cls = state.classes.find(c => c.id === classId);
  if (!cls) return;

  currentSelectedClassId = classId;

  document.querySelectorAll('.cls-card').forEach(el => el.classList.remove('selected'));
  const clickedCard = document.querySelector(`.cls-card[onclick="showClassDetails(${classId}, '${dateStr}')"]`);
  if (clickedCard) clickedCard.classList.add('selected');

  const panel = document.getElementById('cls-detail-panel');
  const emptyPanel = document.getElementById('cls-detail-empty');
  if (!panel) return;

  // Show detail panel, hide empty panel
  panel.style.display = 'flex';
  if (emptyPanel) emptyPanel.style.display = 'none';

  // Update header
  document.getElementById('cls-detail-subject').textContent = cls.subject;
  document.getElementById('cls-detail-section').textContent = cls.section || 'Class';

  // Update info
  const dateText = cls.startDate && cls.endDate
    ? `${cls.startDate} to ${cls.endDate}`
    : dateStr || 'No date set';
  document.getElementById('cls-detail-date').textContent = dateText;

  const timeText = cls.startTime && cls.endTime
    ? `${formatTimeLabel(cls.startTime)} – ${formatTimeLabel(cls.endTime)}`
    : cls.schedule || 'No time set';
  document.getElementById('cls-detail-time').textContent = timeText;

  // Update teacher
  document.getElementById('cls-detail-teacher').textContent = cls.teacher || 'Not set';

  // Update location
  const location = cls.room || cls.building
    ? `${cls.room || ''}${cls.room && cls.building ? ', ' : ''}${cls.building || ''}`
    : 'Not set';
  document.getElementById('cls-detail-location').textContent = location;

  // Update days
  const daysEl = document.getElementById('cls-detail-days');
  if (cls.days && cls.days.length > 0) {
    daysEl.innerHTML = `<strong>Days:</strong> ${cls.days.join(', ')}`;
    daysEl.style.display = 'block';
  } else {
    daysEl.style.display = 'none';
  }

  // Update mode
  const modeEl = document.getElementById('cls-detail-mode');
  const modeText = cls.mode || 'In Person';
  const occursText = cls.occurs || 'Once';
  modeEl.innerHTML = `<span class="cls-detail-badge">${modeText}</span><span class="cls-detail-badge">${occursText}</span>`;

  // Scroll to panel on mobile
  if (window.innerWidth <= 768) {
    panel.scrollIntoView({ behavior: 'smooth' });
  }
}

async function editCurrentClass() {
  if (!currentSelectedClassId) return;
  const cls = state.classes.find(c => c.id === currentSelectedClassId);
  if (!cls) return;

  await openAddSubject();
  setTimeout(() => {
    window._editingClassId = currentSelectedClassId;
    document.querySelector('#modal-content h3').textContent = 'Edit Class Schedule';
    document.querySelector('#modal-content .btn-primary').textContent = 'Save Changes';
    // Replace subject dropdown with a free-text input so the user can rename it
    const subjectGroup = document.getElementById('new-class-subject')?.closest('.form-group');
    if (subjectGroup) {
      subjectGroup.innerHTML = `<label>Subject (required)</label>
        <input type="text" id="new-class-subject-edit" value="${cls.subject.replace(/"/g,'&quot;')}" placeholder="Subject name" />`;
    }
    document.getElementById('class-new-subject-row').style.display = 'none';
    document.getElementById('new-class-section').value = cls.section || '';
    document.getElementById('new-class-teacher').value = cls.teacher || '';
    document.getElementById('new-class-room').value = cls.room || '';
    document.getElementById('new-class-building').value = cls.building || '';
    document.getElementById('new-class-mode').value = cls.mode || 'In Person';
    document.getElementById('new-class-occurs').value = cls.occurs || 'Once';
    const setEditTime = (id, t) => {
      const el = document.getElementById(id);
      if (!el || !t) return;
      // Normalize to 24h
      let val24 = t;
      const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
      if (m12) {
        let h = parseInt(m12[1], 10); const mn = m12[2]; const ap = m12[3].toUpperCase();
        if (ap === 'PM' && h !== 12) h += 12;
        if (ap === 'AM' && h === 12) h = 0;
        val24 = `${String(h).padStart(2,'0')}:${mn}`;
      }
      el.dataset.val24 = val24;
      const [hh, mm] = val24.split(':').map(Number);
      const ampm = hh >= 12 ? 'PM' : 'AM';
      el.value = `${hh % 12 || 12}:${String(mm).padStart(2,'0')} ${ampm}`;
    };
    setEditTime('new-class-start-time', cls.startTime);
    setEditTime('new-class-end-time', cls.endTime);
    document.getElementById('new-class-start-date').value = cls.startDate || '';
    document.getElementById('new-class-end-date').value = cls.endDate || '';
    cls.days?.forEach(day => {
      const cb = document.querySelector(`input[name="new-class-days"][value="${day}"]`);
      if (cb) cb.checked = true;
    });
  }, 30);
}

function deleteCurrentClass() {
  if (!currentSelectedClassId) return;
  openModal(`
    <h3 style="color:var(--danger);">Delete Class?</h3>
    <p style="color:#555;margin:12px 0 20px;line-height:1.6;">This will permanently remove this class and cannot be undone.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="closeModal()" style="background:none;border:none;color:#888;font-weight:600;cursor:pointer;padding:8px 16px;border-radius:8px;">Cancel</button>
      <button onclick="_doDeleteCurrentClass()" style="background:var(--danger);color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:700;cursor:pointer;">Delete</button>
    </div>
  `);
}

async function _doDeleteCurrentClass() {
  closeModal();
  const { error } = await supabase.from('classes').delete().eq('id', currentSelectedClassId);
  if (error) { showToast('Failed to delete class'); console.error(error); return; }
  currentSelectedClassId = null;
  const detailPanel = document.getElementById('cls-detail-panel');
  const emptyPanel = document.getElementById('cls-detail-empty');
  if (detailPanel) detailPanel.style.display = 'none';
  if (emptyPanel) emptyPanel.style.display = 'flex';
  await loadClassesFromSupabase();
  showToast('Class deleted');
}

function _buildAddSubjectHTML() {
  const minDate = getTodayInputDate();
  const maxDate = getOneYearFromTodayInputDate();
  const subjectOptions = getSubjectSelectOptions();
  return `
    <h3>Add Class Schedule</h3>
    <div class="form-group">
      <label>Subject (required)</label>
      <select id="new-class-subject" required onchange="onClassSubjectChange()">${subjectOptions}</select>
    </div>
    <div class="form-row" id="class-new-subject-row" style="display:none;">
      <div class="form-group">
        <label>Add New Subject</label>
        <input type="text" id="new-class-subject-custom" placeholder="e.g. Software Engineering" />
      </div>
    </div>
    <div class="form-group">
      <label>Mode</label>
      <select id="new-class-mode">
        <option value="In Person">In Person</option>
        <option value="Online">Online</option>
      </select>
    </div>
    <div class="form-group">
      <label>Start/End Dates</label>
      <select id="new-class-date-option" onchange="onClassDateOptionChange()">
        <option value="None">None</option>
        <option value="Academic year term">Academic year term</option>
        <option value="Manual">Manual</option>
      </select>
    </div>
    <div class="form-row" id="class-term-row" style="display:none;">
      <div class="form-group">
        <label>Academic Term</label>
        <select id="new-class-term" onchange="onClassTermChange()">
          <option value="1st Semester">1st Semester</option>
          <option value="2nd Semester">2nd Semester</option>
          <option value="Summer">Summer</option>
        </select>
      </div>
    </div>
    <div class="form-row" id="class-term-info-row" style="display:none;"></div>
    <div class="form-row" id="class-manual-date-row" style="display:none;">
      <div class="form-group">
        <label>Start Date</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="new-class-start-date" placeholder="Select start date" readonly
            style="flex:1;cursor:pointer;" onclick="openDatePicker('new-class-start-date','Start Date','class')" />
          <button type="button" onclick="openDatePicker('new-class-start-date','Start Date','class')"
            style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📅</button>
        </div>
      </div>
      <div class="form-group">
        <label>End Date</label>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="new-class-end-date" placeholder="Select end date" readonly
            style="flex:1;cursor:pointer;" onclick="openDatePicker('new-class-end-date','End Date','class')" />
          <button type="button" onclick="openDatePicker('new-class-end-date','End Date','class')"
            style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📅</button>
        </div>
      </div>
    </div>
    <div class="form-group">
      <label>Occurs</label>
      <select id="new-class-occurs">
        <option value="Once">Once</option>
        <option value="Repeating">Repeating</option>
      </select>
    </div>    
<div class="form-row">
  <div class="form-group">
    <label>Start Time (required)</label>
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" id="new-class-start-time" placeholder="e.g. 09:00" readonly
        style="flex:1;cursor:pointer;" onclick="openTimePicker('new-class-start-time','Start Time')" />
      <button type="button" onclick="openTimePicker('new-class-start-time','Start Time')"
        style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🕐</button>
    </div>
  </div>
  <div class="form-group">
    <label>End Time (required)</label>
    <div style="display:flex;gap:8px;align-items:center;">
      <input type="text" id="new-class-end-time" placeholder="e.g. 10:00" readonly
        style="flex:1;cursor:pointer;" onclick="openTimePicker('new-class-end-time','End Time')" />
      <button type="button" onclick="openTimePicker('new-class-end-time','End Time')"
        style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🕐</button>
    </div>
  </div>
</div>
    <div class="form-group">
      <label>Class Code</label>
      <input type="text" id="new-class-section" placeholder="e.g. CS101, SE-301" />
    </div>
    <div class="form-group"><label>Teacher</label><input type="text" id="new-class-teacher" placeholder="Enter teacher name" /></div>
    <div class="form-row">
      <div class="form-group"><label>Room</label><input type="text" id="new-class-room" placeholder="e.g. 301" /></div>
      <div class="form-group"><label>Building</label><input type="text" id="new-class-building" placeholder="e.g. Main Bldg" /></div>
    </div>
    <div class="form-group">
      <label>Days (required)</label>
      <div style="display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 10px;">
        ${['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(day => `
          <label style="display:flex;align-items:center;gap:6px;font-weight:500;">
            <input type="checkbox" name="new-class-days" value="${day}" /> ${day}
          </label>
        `).join('')}
      </div>
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="btn-primary" style="flex:1;" onclick="saveSubject()">Save</button>
      <button class="btn-primary" style="flex:1;background:#64748b;" onclick="closeModal()">Cancel</button>
    </div>
  `;
}

async function openAddSubject() {
  // Load academic setup so term dates can be shown in the form
  window._acadData = window._acadData || { sem1_start:'', sem1_end:'', sem2_start:'', sem2_end:'', midyear_start:'', midyear_end:'', semester:'' };
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase.from('profiles')
        .select('semester,sem1_start,sem1_end,sem2_start,sem2_end,midyear_start,midyear_end')
        .eq('id', user.id).single();
      if (data) window._acadData = data;
    }
  } catch(e) {}
  openModal(_buildAddSubjectHTML());
}

async function saveSubject() {
  // In edit mode a plain text input is used instead of the select
  const editInput = document.getElementById('new-class-subject-edit');
  let subject = editInput ? editInput.value.trim() : document.getElementById('new-class-subject').value.trim();
  const customSubject = document.getElementById('new-class-subject-custom')?.value.trim() || '';
  const mode = document.getElementById('new-class-mode').value;
  const dateOption = document.getElementById('new-class-date-option').value;
  const term = document.getElementById('new-class-term')?.value || 'N/A';
  let startDate = document.getElementById('new-class-start-date')?.value || '';
  let endDate   = document.getElementById('new-class-end-date')?.value || '';
  if (dateOption === 'Academic year term') {
    const d = window._acadData || {};
    if (term === '1st Semester')  { startDate = d.sem1_start || ''; endDate = d.sem1_end || ''; }
    else if (term === '2nd Semester') { startDate = d.sem2_start || ''; endDate = d.sem2_end || ''; }
    else if (term === 'Summer')   { startDate = d.midyear_start || ''; endDate = d.midyear_end || ''; }
  }
  const occurs = document.getElementById('new-class-occurs').value;
  const parseTime24 = (t) => {
    if (!t) return '';
    const m12 = t.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
    if (m12) {
      let h = parseInt(m12[1], 10); const mn = m12[2]; const ap = m12[3].toUpperCase();
      if (ap === 'PM' && h !== 12) h += 12;
      if (ap === 'AM' && h === 12) h = 0;
      return `${String(h).padStart(2,'0')}:${mn}`;
    }
    return t.trim();
  };
  const startTime = parseTime24(document.getElementById('new-class-start-time')?.value || '');
  const endTime   = parseTime24(document.getElementById('new-class-end-time')?.value || '');
  const section = document.getElementById('new-class-section').value;
  const teacher = document.getElementById('new-class-teacher').value.trim();
  const room = document.getElementById('new-class-room').value.trim();
  const building = document.getElementById('new-class-building').value.trim();
  const days = Array.from(document.querySelectorAll('input[name="new-class-days"]:checked')).map(el => el.value);

  if (subject === '__add_new__') subject = customSubject;
  if (!subject) { showToast('Subject is required'); return; }
  if (!startTime) { showToast('Start time is required'); return; }
  if (!endTime) { showToast('End time is required'); return; }
  if (days.length === 0) { showToast('Please select at least one day'); return; }
  if (startTime >= endTime) { showToast('End time must be later than start time'); return; }
  if (dateOption === 'Manual' && (!startDate || !endDate)) {
    showToast('Please select manual start and end dates');
    return;
  }
  if (dateOption === 'Manual' && startDate > endDate) {
    showToast('End date must be after start date');
    return;
  }

  const timeLabel = `${formatTimeLabel(startTime)}-${formatTimeLabel(endTime)}`;
  const schedule = `${days.join('/')} ${timeLabel} (${mode})`;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('You must be logged in'); return; }

  const editingId = window._editingClassId || null;
  const payload = {
    subject,
    day: days.join('/'),
    time: `${startTime} - ${endTime}`,
    section: section || null,
    room: room || null,
    instructor: teacher || null,
  };

  let error;
  if (editingId) {
    ({ error } = await supabase.from('classes').update(payload).eq('id', editingId));
  } else {
    ({ error } = await supabase.from('classes').insert({ ...payload, user_id: user.id }));
  }
  window._editingClassId = null;
  if (error) { showToast('Failed to save class'); console.error(error); return; }
  const wasEditing = !!editingId;
  const reSelectId = editingId || null;
  closeModal();
  await loadClassesFromSupabase();
  if (state.currentPage === 'page-classes') {
    renderClassSchedule();
    populateClassFilter();
    if (wasEditing && reSelectId) {
      currentSelectedClassId = reSelectId;
      const card = document.querySelector(`#cls-schedule-list .cls-card[onclick^="showClassDetails(${reSelectId},"]`);
      if (card) {
        card.classList.add('selected');
        const cls = state.classes.find(c => c.id === reSelectId);
        if (cls) showClassDetails(reSelectId, '');
      }
    }
  }
  showToast(wasEditing ? 'Class updated!' : 'Class schedule saved!');
}

function onClassDateOptionChange() {
  const selected = document.getElementById('new-class-date-option')?.value || 'None';
  const termRow = document.getElementById('class-term-row');
  const manualRow = document.getElementById('class-manual-date-row');
  const termInfoRow = document.getElementById('class-term-info-row');
  if (termRow) termRow.style.display = selected === 'Academic year term' ? 'flex' : 'none';
  if (manualRow) manualRow.style.display = selected === 'Manual' ? 'flex' : 'none';
  if (selected === 'Academic year term') {
    // Pre-select term to match saved semester
    const termSel = document.getElementById('new-class-term');
    if (termSel && window._acadData?.semester && !termSel.value) {
      const semMap = { '1st Semester':'1st Semester', '2nd Semester':'2nd Semester', 'Summer':'Summer', 'Midyear':'Summer' };
      termSel.value = semMap[window._acadData.semester] || termSel.value;
    }
    onClassTermChange();
  } else if (termInfoRow) {
    termInfoRow.style.display = 'none';
  }
}

function onClassTermChange() {
  const term = document.getElementById('new-class-term')?.value || '';
  const d = window._acadData || {};
  let start = '', end = '';
  if (term === '1st Semester') { start = d.sem1_start || ''; end = d.sem1_end || ''; }
  else if (term === '2nd Semester') { start = d.sem2_start || ''; end = d.sem2_end || ''; }
  else if (term === 'Summer') { start = d.midyear_start || ''; end = d.midyear_end || ''; }
  const infoRow = document.getElementById('class-term-info-row');
  if (!infoRow) return;
  if (start || end) {
    infoRow.style.display = 'flex';
    infoRow.innerHTML = `<div style="font-size:0.8rem;color:var(--text-muted);background:var(--bg-input);padding:8px 12px;border-radius:8px;width:100%;">
      📅 <strong>${term}</strong>: ${start || '—'} → ${end || '—'}
      <span style="color:#aaa;font-size:0.75rem;"> (from Academic Setup in Settings)</span>
    </div>`;
  } else {
    infoRow.style.display = 'flex';
    infoRow.innerHTML = `<div style="font-size:0.8rem;color:#e53e3e;background:#fff5f5;padding:8px 12px;border-radius:8px;width:100%;">
      ⚠️ No dates set for <strong>${term}</strong>. <a href="#" onclick="closeModal();showSettings();return false;" style="color:var(--blue);">Set them in Settings</a>.
    </div>`;
  }
}

function onClassSubjectChange() {
  const selected = document.getElementById('new-class-subject')?.value || '';
  const customRow = document.getElementById('class-new-subject-row');
  if (customRow) customRow.style.display = selected === '__add_new__' ? 'flex' : 'none';
}

// ===== TIME PICKER =====
function openTimePicker(targetInputId, labelText) {
  // Save all current form values before opening picker
  window._tpFormState = {
    subject: document.getElementById('new-class-subject')?.value || '',
    subjectEdit: document.getElementById('new-class-subject-edit')?.value || '',
    subjectCustom: document.getElementById('new-class-subject-custom')?.value || '',
    mode: document.getElementById('new-class-mode')?.value || 'In Person',
    dateOption: document.getElementById('new-class-date-option')?.value || 'None',
    term: document.getElementById('new-class-term')?.value || '1st Semester',
    startDate: document.getElementById('new-class-start-date')?.value || '',
    endDate: document.getElementById('new-class-end-date')?.value || '',
    occurs: document.getElementById('new-class-occurs')?.value || 'Once',
    startTime: document.getElementById('new-class-start-time')?.value || '',
    endTime: document.getElementById('new-class-end-time')?.value || '',
    section: document.getElementById('new-class-section')?.value || '',
    teacher: document.getElementById('new-class-teacher')?.value || '',
    room: document.getElementById('new-class-room')?.value || '',
    building: document.getElementById('new-class-building')?.value || '',
    days: Array.from(document.querySelectorAll('input[name="new-class-days"]:checked')).map(el => el.value),
    targetInputId,
    editingClassId: window._editingClassId || null,
  };

  let hour = 8, minute = 0, isAM = true, mode = 'hour';
  window._tp = { hour, minute, isAM, mode };

  const content = `
    <h3>Select ${labelText}</h3>
    <div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap;">
      <div style="display:flex;flex-direction:column;gap:12px;">
        <div style="display:flex;align-items:center;gap:4px;">
          <div id="tp-hour" onclick="tpSetMode('hour')"
            style="background:#e8f1fb;color:#185FA5;font-size:40px;font-weight:500;
            padding:8px 16px;border-radius:10px;cursor:pointer;min-width:64px;text-align:center;
            border:2px solid #378ADD;">8</div>
          <span style="font-size:40px;color:#aaa;">:</span>
          <div id="tp-min" onclick="tpSetMode('minute')"
            style="background:#f1f5f9;font-size:40px;font-weight:500;
            padding:8px 16px;border-radius:10px;cursor:pointer;min-width:64px;text-align:center;
            border:2px solid transparent;">00</div>
        </div>
        <div style="display:flex;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;width:fit-content;">
          <button id="tp-am" onclick="tpSetAM(true)"
            style="padding:8px 20px;border:none;background:#e8f1fb;color:#185FA5;
            font-weight:600;cursor:pointer;">AM</button>
          <button id="tp-pm" onclick="tpSetAM(false)"
            style="padding:8px 20px;border:none;background:transparent;color:#888;cursor:pointer;">PM</button>
        </div>
      </div>
      <canvas id="tp-canvas" width="200" height="200" style="cursor:pointer;border-radius:50%;"></canvas>
    </div>
    <div style="display:flex;justify-content:flex-end;gap:12px;margin-top:16px;">
      <button onclick="tpCancel()" style="background:none;border:none;color:#888;cursor:pointer;font-size:0.95rem;">Cancel</button>
      <button onclick="tpConfirm()"
        style="background:var(--blue);color:white;border:none;padding:8px 20px;
        border-radius:8px;font-weight:600;cursor:pointer;">OK</button>
    </div>
  `;
  openModal(content);

  setTimeout(() => {
    tpDraw(hour, minute, mode);
    document.getElementById('tp-canvas').addEventListener('click', (e) => {
      const canvas = e.currentTarget;
      const rect = canvas.getBoundingClientRect();
      const cx = 100, cy = 100;
      const mx = e.clientX - rect.left - cx;
      const my = e.clientY - rect.top - cy;
      const dist = Math.sqrt(mx*mx + my*my);
      if (dist < 25 || dist > 95) return;
      let angle = Math.atan2(my, mx) + Math.PI / 2;
      if (angle < 0) angle += Math.PI * 2;
      const seg = Math.round(angle / (Math.PI * 2) * 12) % 12;
      if (window._tp.mode === 'hour') {
        window._tp.hour = seg === 0 ? 12 : seg;
        window._tp.mode = 'minute';
      } else {
        window._tp.minute = seg * 5;
      }
      tpDraw(window._tp.hour, window._tp.minute, window._tp.mode);
      tpUpdateDisplay();
    });
  }, 50);
}

function tpSetMode(m) {
  window._tp.mode = m;
  tpDraw(window._tp.hour, window._tp.minute, m);
  tpUpdateDisplay();
}

function tpSetAM(val) {
  window._tp.isAM = val;
  document.getElementById('tp-am').style.background = val ? '#e8f1fb' : 'transparent';
  document.getElementById('tp-am').style.color = val ? '#185FA5' : '#888';
  document.getElementById('tp-am').style.fontWeight = val ? '600' : '400';
  document.getElementById('tp-pm').style.background = val ? 'transparent' : '#e8f1fb';
  document.getElementById('tp-pm').style.color = val ? '#888' : '#185FA5';
  document.getElementById('tp-pm').style.fontWeight = val ? '400' : '600';
}

function tpUpdateDisplay() {
  const hEl = document.getElementById('tp-hour');
  const mEl = document.getElementById('tp-min');
  if (!hEl || !mEl) return;
  hEl.textContent = window._tp.hour;
  mEl.textContent = String(window._tp.minute).padStart(2, '0');
  hEl.style.border = window._tp.mode === 'hour' ? '2px solid #378ADD' : '2px solid transparent';
  hEl.style.background = window._tp.mode === 'hour' ? '#e8f1fb' : '#f1f5f9';
  mEl.style.border = window._tp.mode === 'minute' ? '2px solid #378ADD' : '2px solid transparent';
  mEl.style.background = window._tp.mode === 'minute' ? '#e8f1fb' : '#f1f5f9';
}

function tpDraw(hour, minute, mode) {
  const canvas = document.getElementById('tp-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const cx = 100, cy = 100, r = 90, numR = 72;
  ctx.clearRect(0, 0, 200, 200);

  // Clock background
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fillStyle = '#EBF4FF';
  ctx.fill();

  const nums = mode === 'hour'
    ? [12,1,2,3,4,5,6,7,8,9,10,11]
    : [0,5,10,15,20,25,30,35,40,45,50,55];

  nums.forEach((n, i) => {
    const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
    const x = cx + numR * Math.cos(angle);
    const y = cy + numR * Math.sin(angle);
    const sel = mode === 'hour' ? hour === (n === 0 ? 12 : n) : minute === n;
    if (sel) {
      ctx.beginPath();
      ctx.arc(x, y, 17, 0, Math.PI * 2);
      ctx.fillStyle = '#378ADD';
      ctx.fill();
      // draw hand
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = '#378ADD';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(cx, cy, 4, 0, Math.PI * 2);
      ctx.fillStyle = '#378ADD';
      ctx.fill();
    }
    ctx.fillStyle = sel ? '#fff' : '#185FA5';
    ctx.font = '13px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n, x, y);
  });
}

function tpConfirm() {
  const { hour, minute, isAM } = window._tp;
  let h24 = hour;
  if (!isAM && hour !== 12) h24 = hour + 12;
  if (isAM && hour === 12) h24 = 0;
  const val = `${String(h24).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
  const display = `${hour}:${String(minute).padStart(2,'0')} ${isAM ? 'AM' : 'PM'}`;

  const s = window._tpFormState || {};
  const targetInputId = s.targetInputId || '';
  const isClassPicker = targetInputId === 'new-class-start-time' || targetInputId === 'new-class-end-time';

  if (isClassPicker) {
    // Update form state with confirmed time
    if (targetInputId === 'new-class-start-time') s.startTime = val;
    if (targetInputId === 'new-class-end-time')   s.endTime   = val;
    // Replace modal content directly — never touch overlay active state
    const tmp = document.createElement('div');
    tmp.innerHTML = _buildAddSubjectHTML();
    document.getElementById('modal-content').replaceChildren(...tmp.childNodes);
    setTimeout(() => {
      tpRestoreForm();
      const el = document.getElementById(targetInputId);
      if (el) { el.value = display; el.dataset.val24 = val; }
    }, 30);
  } else {
    // Task / exam picker: just write value to target input and close
    const el = document.getElementById(targetInputId);
    if (el) el.value = display;
    closeModal();
  }
}

function tpCancel() {
  const s = window._tpFormState || {};
  const targetInputId = s.targetInputId || '';
  const isClassPicker = targetInputId === 'new-class-start-time' || targetInputId === 'new-class-end-time';

  if (isClassPicker) {
    const tmp = document.createElement('div');
    tmp.innerHTML = _buildAddSubjectHTML();
    document.getElementById('modal-content').replaceChildren(...tmp.childNodes);
    setTimeout(() => tpRestoreForm(), 30);
  } else {
    closeModal();
  }
}


function tpRestoreForm() {
  const s = window._tpFormState;
  if (!s) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };

  // If we were in edit mode, re-apply the edit-mode UI
  if (s.editingClassId) {
    window._editingClassId = s.editingClassId;
    document.querySelector('#modal-content h3').textContent = 'Edit Class Schedule';
    document.querySelector('#modal-content .btn-primary').textContent = 'Save Changes';
    const subjectGroup = document.getElementById('new-class-subject')?.closest('.form-group');
    if (subjectGroup) {
      subjectGroup.innerHTML = `<label>Subject (required)</label><input type="text" id="new-class-subject-edit" value="${s.subjectEdit.replace(/"/g,'&quot;')}" placeholder="Subject name" />`;
    }
    document.getElementById('class-new-subject-row').style.display = 'none';
  } else {
    set('new-class-subject', s.subject);
  }
  set('new-class-mode', s.mode);
  set('new-class-date-option', s.dateOption);
  set('new-class-occurs', s.occurs);
  const setTime = (id, val24) => {
    const el = document.getElementById(id);
    if (!el || !val24) return;
    el.dataset.val24 = val24;
    const [hh, mm] = val24.split(':').map(Number);
    const ampm = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 || 12;
    el.value = `${h12}:${String(mm).padStart(2,'0')} ${ampm}`;
  };
  setTime('new-class-start-time', s.startTime);
  setTime('new-class-end-time', s.endTime);
  set('new-class-section', s.section);
  set('new-class-teacher', s.teacher);
  set('new-class-room', s.room);
  set('new-class-building', s.building);

  // Show/hide conditional rows based on restored values
  onClassSubjectChange();
  onClassDateOptionChange();

  if (s.subject === '__add_new__') set('new-class-subject-custom', s.subjectCustom);
  if (s.dateOption === 'Academic year term') set('new-class-term', s.term);
  if (s.dateOption === 'Manual') {
    set('new-class-start-date', s.startDate);
    set('new-class-end-date', s.endDate);
  }

  // Restore checkboxes
  s.days.forEach(day => {
    const cb = document.querySelector(`input[name="new-class-days"][value="${day}"]`);
    if (cb) cb.checked = true;
  });
}

// ===== DATE PICKER =====
function openDatePicker(targetInputId, labelText, callerForm) {
  // Save entire form state based on which form called it
  if (callerForm === 'task') {
    const subSel = document.getElementById('new-task-subject-sel');
    const subCustom = document.getElementById('new-task-subject');
    window._dpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('new-task-name')?.value || '',
      subjectSel: subSel?.value || '',
      subjectCustom: subCustom?.value || '',
      cls: document.getElementById('new-task-class')?.value || '',
      due: document.getElementById('new-task-due')?.value || '',
      time: document.getElementById('new-task-time')?.value || '',
    };
  } else if (callerForm === 'edit-task') {
    window._dpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('edit-task-name')?.value || '',
      subject: document.getElementById('edit-task-subject-sel')?.value || '',
      type: document.getElementById('edit-task-type')?.value || '',
      due: document.getElementById('edit-task-due')?.value || '',
      time: document.getElementById('edit-task-time')?.value || '',
      taskId: selectedTaskId,
    };
  } else if (callerForm === 'edit-exam') {
    window._dpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('edit-exam-name')?.value || '',
      subject: document.getElementById('edit-exam-subject-sel')?.value || '',
      cls: document.getElementById('edit-exam-class')?.value || '',
      date: document.getElementById('edit-exam-date')?.value || '',
      examId: selectedExamId,
    };
  } else if (callerForm === 'exam') {
    window._dpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('new-exam-name')?.value || '',
      subject: document.getElementById('new-exam-subject')?.value || '',
      cls: document.getElementById('new-exam-class')?.value || '',
      date: document.getElementById('new-exam-date')?.value || '',
    };
  } else if (callerForm === 'class') {
    window._dpFormState = {
      targetInputId, callerForm,
      subject: document.getElementById('new-class-subject')?.value || '',
      subjectCustom: document.getElementById('new-class-subject-custom')?.value || '',
      mode: document.getElementById('new-class-mode')?.value || 'In Person',
      dateOption: document.getElementById('new-class-date-option')?.value || 'None',
      term: document.getElementById('new-class-term')?.value || '1st Semester',
      startDate: document.getElementById('new-class-start-date')?.value || '',
      endDate: document.getElementById('new-class-end-date')?.value || '',
      occurs: document.getElementById('new-class-occurs')?.value || 'Once',
      startTime: document.getElementById('new-class-start-time')?.value || '',
      endTime: document.getElementById('new-class-end-time')?.value || '',
      section: document.getElementById('new-class-section')?.value || '',
      teacher: document.getElementById('new-class-teacher')?.value || '',
      room: document.getElementById('new-class-room')?.value || '',
      building: document.getElementById('new-class-building')?.value || '',
      days: Array.from(document.querySelectorAll('input[name="new-class-days"]:checked')).map(el => el.value),
    };
  } else if (callerForm === 'settings') {
    window._dpFormState = {
      targetInputId, callerForm,
      sem1_start: document.getElementById('sem1-start-dp')?.value || '',
      sem1_end:   document.getElementById('sem1-end-dp')?.value   || '',
      sem2_start: document.getElementById('sem2-start-dp')?.value || '',
      sem2_end:   document.getElementById('sem2-end-dp')?.value   || '',
      midyear_start: document.getElementById('midyear-start-dp')?.value || '',
      midyear_end:   document.getElementById('midyear-end-dp')?.value   || '',
    };
  } else {
    window._dpFormState = { targetInputId, callerForm };
  }

  const today = new Date();
  const todayMidnight = new Date(today);
  todayMidnight.setHours(0,0,0,0);
  // For settings (semester dates), allow any date including past
  const allowPast = callerForm === 'settings';
  const maxSelectableDate = new Date(todayMidnight);
  maxSelectableDate.setFullYear(maxSelectableDate.getFullYear() + (allowPast ? 10 : 1));
  const minSelectableDate = allowPast ? new Date(2000, 0, 1) : todayMidnight;
  let dpDate = new Date(today);
  let dpPending = new Date(today);

  const existing = document.getElementById(targetInputId)?.value;
  if (existing) {
    const d = new Date(existing + 'T00:00:00');
    if (!isNaN(d)) { dpDate = new Date(d.getFullYear(), d.getMonth(), 1); dpPending = d; }
  }
  if (!allowPast && dpPending < todayMidnight) dpPending = new Date(todayMidnight);
  if (dpPending > maxSelectableDate) dpPending = new Date(maxSelectableDate);

  const MONTHS_DP = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_H = ['S','M','T','W','T','F','S'];

  function fmt(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function sameDayDP(a, b) {
    return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  }
  function buildGrid() {
    const y = dpDate.getFullYear(), m = dpDate.getMonth();
    document.getElementById('dp-month-label').textContent = `${MONTHS_DP[m]} ${y} ▾`;
    const inner = document.getElementById('dp-grid-inner');
    if (inner) inner.style.display = 'grid';
    const first = new Date(y,m,1).getDay();
    let html = DAYS_H.map(d=>`<div class="dp-day-header">${d}</div>`).join('');

    for (let i = 0; i < 42; i++) {
      const day = i - first + 1;
      const cellDate = new Date(y, m, day);
      const isCur = day >= 1 && day <= new Date(y,m+1,0).getDate();
      const isSel = sameDayDP(cellDate, dpPending);
      const isTod = sameDayDP(cellDate, today);
      const isPast = !allowPast && cellDate < todayMidnight && !isTod;
      const isBeyond = cellDate > maxSelectableDate;
      const isTooOld = allowPast && cellDate < minSelectableDate;
      const isDisabled = isPast || isBeyond || isTooOld || !isCur;

      const cls = ['dp-day'];
      if (isSel) cls.push('dp-selected');
      else if (isTod) cls.push('dp-today');
      if (isDisabled) cls.push('dp-disabled');
      else cls.push('dp-selectable');

      const onclick = isDisabled ? '' : `onclick="dpPickDate('${fmt(cellDate)}')"`;

      html += `<div style="text-align:center;">
        <div ${onclick} class="${cls.join(' ')}">${cellDate.getDate()}</div>
      </div>`;
    }
    document.getElementById('dp-grid-inner').innerHTML = html;
  }

  window.dpPickDate = function(dateStr) {
    dpPending = new Date(dateStr + 'T00:00:00');
    dpDate = new Date(dpPending.getFullYear(), dpPending.getMonth(), 1);
    buildGrid();
  };
  window.dpMoveMonth = function(dir) {
    const nextDate = new Date(dpDate.getFullYear(), dpDate.getMonth() + dir, 1);
    const minMonth = allowPast ? new Date(2000, 0, 1) : new Date(today.getFullYear(), today.getMonth(), 1);
    const maxMonth = new Date(maxSelectableDate.getFullYear(), maxSelectableDate.getMonth(), 1);
    if (nextDate < minMonth || nextDate > maxMonth) return;
    dpDate = nextDate;
    buildGrid();
  };
  window.dpOpenYearPicker = function() {
    const y = dpDate.getFullYear();
    const todayYr = today.getFullYear();
    const maxYr = maxSelectableDate.getFullYear();
    const startYear = allowPast ? 2000 : todayYr - 5;
    const endYear = todayYr + 10;
    document.getElementById('dp-month-label').textContent = `${MONTHS_DP[dpDate.getMonth()]} ${y} ▲`;
    const inner = document.getElementById('dp-grid-inner');
    inner.style.display = 'block';
    let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;max-height:220px;overflow-y:auto;">`;
    for (let yr = startYear; yr <= endYear; yr++) {
      const isSel = yr === y;
      const isSelectable = (allowPast ? yr >= 2000 : yr >= todayYr) && yr <= maxYr;
      let btnStyle = `padding:10px 4px;border:none;border-radius:20px;font-size:14px;text-align:center;width:100%;box-sizing:border-box;`;
      if (isSel) {
        btnStyle += `background:#e8e8e8;color:#222;font-weight:700;cursor:pointer;`;
      } else if (isSelectable) {
        btnStyle += `background:transparent;color:#222;font-weight:${yr === todayYr ? '700' : '400'};cursor:pointer;`;
      } else {
        btnStyle += `background:transparent;color:#ccc;font-weight:400;cursor:default;`;
      }
      const onclick = isSelectable ? `onclick="dpSelectYear(${yr})"` : '';
      html += `<button ${onclick} style="${btnStyle}">${yr}</button>`;
    }
    html += `</div>`;
    inner.innerHTML = html;
    setTimeout(() => {
      const scrollable = inner.firstElementChild;
      if (scrollable) {
        const idx = y - startYear;
        const btn = scrollable.querySelectorAll('button')[idx];
        if (btn) btn.scrollIntoView({ block: 'center', behavior: 'auto' });
      }
    }, 20);
  };
  window.dpSelectYear = function(yr) {
    dpDate = new Date(yr, dpDate.getMonth(), 1);
    dpPending = new Date(yr, dpPending.getMonth(), dpPending.getDate());
    if (!allowPast && dpPending < todayMidnight) dpPending = new Date(todayMidnight);
    if (dpPending > maxSelectableDate) dpPending = new Date(maxSelectableDate);
    buildGrid();
  };
  window.dpConfirm = function() {
    if (!allowPast && dpPending < todayMidnight) dpPending = new Date(todayMidnight);
    if (dpPending > maxSelectableDate) dpPending = new Date(maxSelectableDate);
    const val = fmt(dpPending);
    window._dpFormState[targetInputId.replace('new-task-','').replace('new-exam-','').replace('new-class-','')] = val;
    // Store confirmed value by input id key
    window._dpFormState._confirmedVal = val;
    window._dpFormState._confirmedKey = targetInputId;
    document.getElementById('modal-overlay').classList.remove('active');
    dpRestoreForm();
  };

  const content = `
    <div style="min-width:280px;padding-right:36px;">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:14px;">
        <span style="font-size:13px;color:#888;margin-right:auto;">${labelText}</span>
        <button onclick="dpOpenYearPicker()" id="dp-month-label" style="background:none;border:none;font-size:14px;font-weight:600;cursor:pointer;padding:4px 6px;border-radius:6px;">Loading...</button>
        <button onclick="dpMoveMonth(-1)" style="background:#f1f5f9;border:none;cursor:pointer;font-size:18px;font-weight:700;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#333;">&#8249;</button>
        <button onclick="dpMoveMonth(1)"  style="background:#f1f5f9;border:none;cursor:pointer;font-size:18px;font-weight:700;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#333;">&#8250;</button>
      </div>
      <div id="dp-grid-inner" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:14px;padding-top:10px;border-top:1px solid #f0f4f8;">
        <button onclick="closeModal()" style="background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:6px;">Cancel</button>
        <button onclick="dpConfirm()" style="background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;padding:6px 12px;border-radius:6px;">OK</button>
      </div>
    </div>
  `;
  openModal(content);
  setTimeout(() => buildGrid(), 30);
}

function dpRestoreForm() {
  const s = window._dpFormState;
  if (!s) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== undefined) el.value = val; };

  if (s.callerForm === 'task') {
    openAddTask();
    setTimeout(() => {
      set('new-task-name', s.name);
      const subSel = document.getElementById('new-task-subject-sel');
      if (subSel && s.subjectSel) {
        subSel.value = s.subjectSel;
        if (s.subjectSel === '__other__') {
          const ci = document.getElementById('new-task-subject');
          if (ci) { ci.style.display = 'block'; ci.value = s.subjectCustom; }
        }
      }
      set('new-task-class', s.cls);
      set('new-task-due', s._confirmedKey === 'new-task-due' ? s._confirmedVal : s.due);
      set('new-task-time', s.time);
    }, 30);

  } else if (s.callerForm === 'edit-task') {
    editSelectedTask();
    setTimeout(() => {
      set('edit-task-name', s.name);
      set('edit-task-subject-sel', s.subject);
      set('edit-task-type', s.type);
      set('edit-task-due', s._confirmedKey === 'edit-task-due' ? s._confirmedVal : s.due);
      set('edit-task-time', s.time);
    }, 30);

  } else if (s.callerForm === 'edit-exam') {
    editSelectedExam();
    setTimeout(() => {
      set('edit-exam-name', s.name);
      set('edit-exam-subject-sel', s.subject);
      set('edit-exam-class', s.cls);
      set('edit-exam-date', s._confirmedKey === 'edit-exam-date' ? s._confirmedVal : s.date);
    }, 30);

  } else if (s.callerForm === 'exam') {
    openAddExam();
    setTimeout(() => {
      set('new-exam-name', s.name);
      set('new-exam-subject', s.subject);
      set('new-exam-class', s.cls);
      set('new-exam-date', s._confirmedKey === 'new-exam-date' ? s._confirmedVal : s.date);
    }, 30);

  } else if (s.callerForm === 'settings') {
    // Build prefill with the confirmed value merged in so showSettings renders it immediately
    const prefill = {
      school:        document.getElementById('acad-school')?.value || '',
      course:        document.getElementById('acad-course')?.value || '',
      year_level:    document.getElementById('acad-year')?.value || '',
      semester:      document.getElementById('acad-semester')?.value || '',
      academic_year: document.getElementById('acad-year-input')?.value || '',
      sem1_start:    s._confirmedKey === 'sem1-start-dp'    ? s._confirmedVal : s.sem1_start,
      sem1_end:      s._confirmedKey === 'sem1-end-dp'      ? s._confirmedVal : s.sem1_end,
      sem2_start:    s._confirmedKey === 'sem2-start-dp'    ? s._confirmedVal : s.sem2_start,
      sem2_end:      s._confirmedKey === 'sem2-end-dp'      ? s._confirmedVal : s.sem2_end,
      midyear_start: s._confirmedKey === 'midyear-start-dp' ? s._confirmedVal : s.midyear_start,
      midyear_end:   s._confirmedKey === 'midyear-end-dp'   ? s._confirmedVal : s.midyear_end,
    };
    showSettings(prefill);
    setTimeout(() => onSemesterFilterChange(), 50);

  } else if (s.callerForm === 'class') {
    openAddSubject();
    setTimeout(() => {
      set('new-class-subject', s.subject);
      set('new-class-mode', s.mode);
      set('new-class-date-option', s.dateOption);
      set('new-class-occurs', s.occurs);
      set('new-class-start-time', s.startTime);
      set('new-class-end-time', s.endTime);
      set('new-class-section', s.section);
      set('new-class-teacher', s.teacher);
      set('new-class-room', s.room);
      set('new-class-building', s.building);
      set('new-class-start-date', s._confirmedKey === 'new-class-start-date' ? s._confirmedVal : s.startDate);
      set('new-class-end-date',   s._confirmedKey === 'new-class-end-date'   ? s._confirmedVal : s.endDate);
      onClassSubjectChange();
      onClassDateOptionChange();
      if (s.subject === '__add_new__') set('new-class-subject-custom', s.subjectCustom);
      if (s.dateOption === 'Academic year term') set('new-class-term', s.term);
      s.days.forEach(day => {
        const cb = document.querySelector(`input[name="new-class-days"][value="${day}"]`);
        if (cb) cb.checked = true;
      });
    }, 30);
  }

  window._dpFormState = null;
}

// ===== TIME PICKER (Clock Face) =====
function openTimePicker(targetInputId, callerForm) {
  if (callerForm === 'task') {
    const subSel = document.getElementById('new-task-subject-sel');
    const subCustom = document.getElementById('new-task-subject');
    window._tpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('new-task-name')?.value || '',
      subjectSel: subSel?.value || '',
      subjectCustom: subCustom?.value || '',
      cls: document.getElementById('new-task-class')?.value || '',
      due: document.getElementById('new-task-due')?.value || '',
      time: document.getElementById('new-task-time')?.value || '',
    };
  } else if (callerForm === 'edit-task') {
    window._tpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('edit-task-name')?.value || '',
      subject: document.getElementById('edit-task-subject-sel')?.value || '',
      type: document.getElementById('edit-task-type')?.value || '',
      due: document.getElementById('edit-task-due')?.value || '',
      time: document.getElementById('edit-task-time')?.value || '',
      taskId: selectedTaskId,
    };
  } else if (callerForm === 'exam') {
    window._tpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('new-exam-name')?.value || '',
      subject: document.getElementById('new-exam-subject-sel')?.value || '',
      cls: document.getElementById('new-exam-class')?.value || '',
      date: document.getElementById('new-exam-date')?.value || '',
      time: document.getElementById('new-exam-time')?.value || '',
    };
  } else if (callerForm === 'edit-exam') {
    window._tpFormState = {
      targetInputId, callerForm,
      name: document.getElementById('edit-exam-name')?.value || '',
      subject: document.getElementById('edit-exam-subject-sel')?.value || '',
      cls: document.getElementById('edit-exam-class')?.value || '',
      date: document.getElementById('edit-exam-date')?.value || '',
      time: document.getElementById('edit-exam-time')?.value || '',
      examId: selectedExamId,
    };
  } else {
    window._tpFormState = { targetInputId, callerForm };
  }

  const existing = document.getElementById(targetInputId)?.value;
  let tpHour = 9, tpMin = 0, tpPeriod = 'AM', tpMode = 'hour';
  if (existing) {
    const match = existing.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      tpHour = parseInt(match[1], 10) || 9;
      tpMin = Math.round(parseInt(match[2], 10) / 5) * 5;
      tpPeriod = match[3].toUpperCase();
    }
  }

  const R = 90, CX = 110, CY = 110;

  function numPos(val, total, radius) {
    const angle = (val / total) * 2 * Math.PI - Math.PI / 2;
    return { x: CX + radius * Math.cos(angle), y: CY + radius * Math.sin(angle) };
  }

  function buildClock() {
    const svg = document.getElementById('tp-clock-svg');
    if (!svg) return;
    const hDisp = document.getElementById('tp-disp-h');
    const mDisp = document.getElementById('tp-disp-m');
    const amBtn  = document.getElementById('tp-am');
    const pmBtn  = document.getElementById('tp-pm');
    if (hDisp) { hDisp.textContent = tpHour; hDisp.style.color = tpMode==='hour' ? 'var(--blue)' : '#555'; hDisp.style.background = tpMode==='hour' ? '#e8f0fe' : 'transparent'; }
    if (mDisp) { mDisp.textContent = String(tpMin).padStart(2,'0'); mDisp.style.color = tpMode==='min' ? 'var(--blue)' : '#555'; mDisp.style.background = tpMode==='min' ? '#e8f0fe' : 'transparent'; }
    if (amBtn) { amBtn.style.background = tpPeriod==='AM'?'var(--blue)':'#f1f5f9'; amBtn.style.color = tpPeriod==='AM'?'white':'#333'; }
    if (pmBtn) { pmBtn.style.background = tpPeriod==='PM'?'var(--blue)':'#f1f5f9'; pmBtn.style.color = tpPeriod==='PM'?'white':'#333'; }

    let items, selVal, total;
    if (tpMode === 'hour') {
      items = Array.from({length:12},(_,i)=>i+1);
      selVal = tpHour; total = 12;
    } else {
      items = Array.from({length:12},(_,i)=>i*5);
      selVal = tpMin; total = 60;
    }

    const selPos = tpMode==='hour' ? numPos(selVal, total, R-10) : numPos(selVal===0?60:selVal, total, R-10);
    let html = `<circle cx="${CX}" cy="${CY}" r="${R}" fill="#f5f7fa"/>`;
    html += `<line x1="${CX}" y1="${CY}" x2="${selPos.x}" y2="${selPos.y}" stroke="var(--blue)" stroke-width="2"/>`;
    html += `<circle cx="${CX}" cy="${CY}" r="4" fill="var(--blue)"/>`;
    html += `<circle cx="${selPos.x}" cy="${selPos.y}" r="18" fill="var(--blue)"/>`;

    items.forEach(v => {
      const displayVal = tpMode==='hour' ? v : (v===0?60:v);
      const p = numPos(displayVal, total, R-10);
      const isSel = v === selVal;
      const onclick = tpMode==='hour' ? `tpClockHour(${v})` : `tpClockMin(${v})`;
      html += `<circle cx="${p.x}" cy="${p.y}" r="18" fill="${isSel?'var(--blue)':'transparent'}" style="cursor:pointer;" onclick="${onclick}"/>`;
      html += `<text x="${p.x}" y="${p.y}" text-anchor="middle" dominant-baseline="central" font-size="13" font-weight="${isSel?'700':'500'}" fill="${isSel?'white':'#333'}" style="cursor:pointer;pointer-events:none;">${tpMode==='hour'?v:String(v).padStart(2,'0')}</text>`;
    });

    svg.innerHTML = html;
  }

  window.tpClockHour = h => { tpHour = h; tpMode = 'min'; buildClock(); };
  window.tpClockMin  = m => { tpMin  = m; buildClock(); };
  window.tpSetPeriod = p => { tpPeriod = p; buildClock(); };
  window.tpSwitchMode = mode => { tpMode = mode; buildClock(); };
  window.tpConfirm = () => {
    const val = `${tpHour}:${String(tpMin).padStart(2,'0')} ${tpPeriod}`;
    document.getElementById('modal-overlay').classList.remove('active');
    tpRestoreForm(val);
  };
  window.tpClear = () => {
    document.getElementById('modal-overlay').classList.remove('active');
    tpRestoreForm('');
  };

  const content = `
    <div style="min-width:300px;">
      <p style="font-size:0.8rem;color:#888;margin:0 0 12px;font-weight:600;letter-spacing:0.04em;">SELECT TIME</p>
      <div style="display:flex;align-items:center;gap:0;margin-bottom:16px;">
        <div style="display:flex;align-items:center;gap:4px;flex:1;">
          <div id="tp-disp-h" onclick="tpSwitchMode('hour')" style="font-size:2.8rem;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;min-width:64px;text-align:center;transition:0.15s;">${tpHour}</div>
          <span style="font-size:2.2rem;font-weight:300;color:#999;">:</span>
          <div id="tp-disp-m" onclick="tpSwitchMode('min')" style="font-size:2.8rem;font-weight:700;padding:8px 14px;border-radius:10px;cursor:pointer;min-width:64px;text-align:center;transition:0.15s;">${String(tpMin).padStart(2,'0')}</div>
        </div>
        <div style="display:flex;flex-direction:column;gap:4px;margin-left:12px;">
          <button id="tp-am" onclick="tpSetPeriod('AM')" style="padding:6px 14px;border:1px solid #e0e0e0;border-radius:6px 6px 0 0;font-weight:700;font-size:0.85rem;cursor:pointer;">AM</button>
          <button id="tp-pm" onclick="tpSetPeriod('PM')" style="padding:6px 14px;border:1px solid #e0e0e0;border-top:none;border-radius:0 0 6px 6px;font-weight:700;font-size:0.85rem;cursor:pointer;">PM</button>
        </div>
      </div>
      <div style="display:flex;justify-content:center;margin-bottom:16px;">
        <svg id="tp-clock-svg" width="220" height="220" style="display:block;"></svg>
      </div>
      <div style="display:flex;justify-content:flex-end;gap:8px;padding-top:10px;border-top:1px solid #f0f4f8;">
        <button onclick="closeModal();tpRestoreForm(null)" style="background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;padding:6px 16px;border-radius:6px;font-size:0.9rem;">Cancel</button>
        <button onclick="tpConfirm()" style="background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;padding:6px 16px;border-radius:6px;font-size:0.9rem;">OK</button>
      </div>
    </div>
  `;
  openModal(content);
  setTimeout(() => buildClock(), 30);
}

function tpRestoreForm(confirmedVal) {
  const s = window._tpFormState;
  if (!s) return;
  const set = (id, val) => { const el = document.getElementById(id); if (el && val !== null && val !== undefined) el.value = val; };

  if (s.callerForm === 'task') {
    openAddTask();
    setTimeout(() => {
      set('new-task-name', s.name);
      const subSel = document.getElementById('new-task-subject-sel');
      if (subSel && s.subjectSel) {
        subSel.value = s.subjectSel;
        if (s.subjectSel === '__other__') {
          const ci = document.getElementById('new-task-subject');
          if (ci) { ci.style.display = 'block'; ci.value = s.subjectCustom; }
        }
      }
      set('new-task-class', s.cls);
      set('new-task-due', s.due);
      if (confirmedVal !== null) set('new-task-time', confirmedVal);
      else set('new-task-time', s.time);
    }, 30);
  } else if (s.callerForm === 'edit-task') {
    editSelectedTask();
    setTimeout(() => {
      set('edit-task-name', s.name);
      set('edit-task-subject-sel', s.subject);
      set('edit-task-type', s.type);
      set('edit-task-due', s.due);
      if (confirmedVal !== null) set('edit-task-time', confirmedVal);
      else set('edit-task-time', s.time);
    }, 30);
  } else if (s.callerForm === 'exam') {
    openAddExam();
    setTimeout(() => {
      set('new-exam-name', s.name);
      set('new-exam-subject-sel', s.subject);
      set('new-exam-class', s.cls);
      set('new-exam-date', s.date);
      if (confirmedVal !== null) set('new-exam-time', confirmedVal);
      else set('new-exam-time', s.time);
    }, 30);
  } else if (s.callerForm === 'edit-exam') {
    editSelectedExam();
    setTimeout(() => {
      set('edit-exam-name', s.name);
      set('edit-exam-subject-sel', s.subject);
      set('edit-exam-class', s.cls);
      set('edit-exam-date', s.date);
      if (confirmedVal !== null) set('edit-exam-time', confirmedVal);
      else set('edit-exam-time', s.time);
    }, 30);
  }

  window._tpFormState = null;
}
