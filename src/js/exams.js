// ===== EXAMS =====
let selectedExamId = null;

async function loadExamsFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase.from('exams').select('*').eq('user_id', user.id).order('date', { ascending: true });
  if (error) { console.error('Error loading exams:', error); return; }
  state.exams = data.map(e => ({
    id: e.id,
    name: e.name,
    subject: e.subject,
    class: e.class || '',
    date: e.date ? new Date(e.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD',
    dateRaw: e.date || '',
    time: e.time || '',
    location: e.location || '',
    status: e.status,
    score: e.score,
    total: e.total,
    remarks: e.remarks,
  }));
  renderExams();
}

function renderExams() {
  const container = document.getElementById('exams-container');
  if (!container) return;
  const tab = state.examTab === 'past-exams' ? 'past' : (state.examTab || 'incoming');
  const filtered = state.exams.filter(e => tab === 'past' ? e.status === 'completed' : e.status === 'incoming');

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📝</div><p>No ${tab} exams</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(e => {
    const scoreText = (e.score != null && e.total != null)
      ? `${e.score}/${e.total} (${Math.round(e.score / e.total * 100)}%)`
      : (e.score != null ? `${e.score}` : '—');
    const isSelected = selectedExamId === e.id ? 'selected' : '';
    return `
    <div class="exam-card ${isSelected}" data-id="${e.id}" onclick="selectExam(${e.id})">
      <div class="exam-indicator">✓</div>
      <div class="exam-main">
        <div class="exam-title">${escapeHtml(e.name)}</div>
        <div class="exam-meta">
          <span class="exam-subject-tag">${escapeHtml(e.subject)}</span>
          <span>${escapeHtml(e.date)}</span>
        </div>
      </div>
      <div class="exam-score">${scoreText}</div>
    </div>
  `}).join('');
}

function switchExamTab(tab) {
  state.examTab = tab === 'past-exams' ? 'past' : tab;
  document.querySelectorAll('#page-exam .task-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add('active');
  renderExams();
}

function enterResults(id) {
  const exam = state.exams.find(e => e.id === id);
  const content = `
    <h3>Enter Results: ${exam.name}</h3>
    <div class="form-group"><label>Score</label><input type="number" id="exam-score" placeholder="e.g. 85" min="0" max="100" /></div>
    <div class="form-group"><label>Total Items</label><input type="number" id="exam-total" placeholder="e.g. 100" min="0" /></div>
    <div class="form-group"><label>Remarks</label><input type="text" id="exam-remarks" placeholder="e.g. Passed, Failed..." /></div>
    <button class="btn-primary" onclick="saveExamResult(${id})">Save Results</button>
  `;
  openModal(content);
}

async function saveExamResult(id) {
  const score = parseInt(document.getElementById('exam-score').value) || null;
  const total = parseInt(document.getElementById('exam-total').value) || null;
  const remarks = document.getElementById('exam-remarks').value.trim();
  const { error } = await supabase.from('exams').update({ status: 'completed', score, total, remarks }).eq('id', id);
  if (error) { showToast('Failed to save results'); console.error(error); return; }
  closeModal();
  await loadExamsFromSupabase();
  switchExamTab('past-exams');
  selectedExamId = id;
  renderExams();
  showExamDetails(id);
  showToast('Results saved!');
}

function seeResults(id) {
  const exam = state.exams.find(e => e.id === id);
  const content = `
    <h3>${escapeHtml(exam.name)}</h3>
    <div class="info-row"><span class="info-label">Subject:</span><span>${escapeHtml(exam.subject)}</span></div>
    <div class="info-row"><span class="info-label">Class:</span><span>${escapeHtml(exam.class)}</span></div>
    <div class="info-row"><span class="info-label">Date:</span><span>${escapeHtml(exam.date)}</span></div>
    <div class="info-row"><span class="info-label">Score:</span><span>${exam.score || 'N/A'}${exam.total ? '/' + exam.total : ''}</span></div>
    <div class="info-row"><span class="info-label">Remarks:</span><span>${escapeHtml(exam.remarks || 'N/A')}</span></div>
  `;
  openModal(content);
}

function selectExam(id) {
  selectedExamId = id;
  renderExams();
  showExamDetails(id);
}

function showExamDetails(id) {
  const exam = state.exams.find(e => e.id === id);
  if (!exam) return;

  const detailPanel = document.getElementById('exam-detail-panel');
  const emptyPanel = document.getElementById('exam-detail-empty');

  if (detailPanel) detailPanel.style.display = 'flex';
  if (emptyPanel) emptyPanel.style.display = 'none';

  // Populate details
  document.getElementById('exam-detail-subject').textContent = exam.name;
  document.getElementById('exam-detail-type').textContent = exam.subject;
  document.getElementById('exam-detail-date').textContent = `Date: ${exam.date}`;
  document.getElementById('exam-detail-time').textContent = exam.time ? formatTimeLabel(exam.time) : (exam.class ? `Class: ${exam.class}` : '');
  document.getElementById('exam-detail-status').textContent = exam.status === 'incoming' ? 'Upcoming' : 'Completed';

  const notesEl = document.getElementById('exam-detail-notes');
  if (exam.score != null) {
    notesEl.textContent = `Score: ${exam.score}${exam.total ? '/' + exam.total : ''} ${exam.remarks ? '- ' + exam.remarks : ''}`;
    notesEl.style.display = 'block';
  } else {
    notesEl.style.display = 'none';
  }

  document.querySelectorAll('.exam-action-btn').forEach(el => el.remove());
  const actionBtn = document.createElement('button');
  actionBtn.className = 'btn-mark-complete exam-action-btn';
  actionBtn.style.cssText = 'margin-top:20px;width:100%;';
  if (exam.status === 'incoming') {
    actionBtn.textContent = 'Enter Results';
    actionBtn.onclick = () => enterResults(id);
  } else {
    actionBtn.textContent = 'See Results';
    actionBtn.onclick = () => seeResults(id);
  }
  document.querySelector('#exam-detail-panel .detail-content')?.appendChild(actionBtn);
}

function removeSelectedExam() {
  if (!selectedExamId) { showToast('Please select an exam to remove'); return; }
  const exam = state.exams.find(e => e.id === selectedExamId);
  openModal(`
    <h3 style="color:var(--danger);">Delete Exam?</h3>
    <p style="color:#555;margin:12px 0 20px;line-height:1.6;">Delete <strong>${escapeHtml(exam?.name || 'this exam')}</strong>? This cannot be undone.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="closeModal()" style="background:none;border:none;color:#888;font-weight:600;cursor:pointer;padding:8px 16px;border-radius:8px;">Cancel</button>
      <button onclick="_doRemoveSelectedExam()" style="background:var(--danger);color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:700;cursor:pointer;">Delete</button>
    </div>
  `);
}

async function _doRemoveSelectedExam() {
  closeModal();
  const { error } = await supabase.from('exams').delete().eq('id', selectedExamId);
  if (error) { showToast('Failed to remove exam'); console.error(error); return; }
  selectedExamId = null;
  const detailPanel = document.getElementById('exam-detail-panel');
  const emptyPanel = document.getElementById('exam-detail-empty');
  if (detailPanel) detailPanel.style.display = 'none';
  if (emptyPanel) emptyPanel.style.display = 'flex';
  await loadExamsFromSupabase();
  showToast('Exam removed');
}

function _examSubjectSelectHtml(currentVal) {
  const subjects = [...new Set(state.classes.map(c => c.subject).filter(Boolean))];
  return `<select id="${currentVal !== undefined ? 'edit-exam-subject-sel' : 'new-exam-subject-sel'}" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;">
    <option value="">Select subject</option>
    ${subjects.map(s => `<option value="${s}" ${s === currentVal ? 'selected' : ''}>${s}</option>`).join('')}
    ${currentVal && !subjects.includes(currentVal) ? `<option value="${currentVal}" selected>${currentVal}</option>` : ''}
  </select>`;
}

function openAddExam() {
  const content = `
    <h3>Add New Exam</h3>
    <div class="form-group"><label>Exam Name</label><input type="text" id="new-exam-name" placeholder="e.g. Finals, Midterms" /></div>
    <div class="form-group"><label>Subject</label>${_examSubjectSelectHtml(undefined).replace('edit-exam-subject-sel','new-exam-subject-sel')}</div>
    <div class="form-group"><label>Class</label><input type="text" id="new-exam-class" placeholder="e.g. BSCS 2B" /></div>
    <div class="form-group">
      <label>Exam Date</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="new-exam-date" placeholder="Select exam date" readonly
          style="flex:1;cursor:pointer;" onclick="openDatePicker('new-exam-date','Exam Date','exam')" />
        <button type="button" onclick="openDatePicker('new-exam-date','Exam Date','exam')"
          style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📅</button>
      </div>
    </div>
    <div class="form-group">
      <label>Exam Time <span style="color:#aaa;font-size:0.8rem;">(optional)</span></label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="new-exam-time" placeholder="Select time" readonly
          style="flex:1;cursor:pointer;" onclick="openTimePicker('new-exam-time','exam')" />
        <button type="button" onclick="openTimePicker('new-exam-time','exam')"
          style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🕐</button>
      </div>
    </div>
    <button class="btn-primary" onclick="saveExam()">Add Exam</button>
  `;
  openModal(content);
}

function editSelectedExam() {
  if (!selectedExamId) return;
  const exam = state.exams.find(e => e.id === selectedExamId);
  if (!exam) return;
  const timeDisplay = exam.time ? formatTimeLabel(exam.time) : '';
  const content = `
    <h3>Edit Exam</h3>
    <div class="form-group"><label>Exam Name</label><input type="text" id="edit-exam-name" value="${escapeHtml(exam.name)}" /></div>
    <div class="form-group"><label>Subject</label>${_examSubjectSelectHtml(exam.subject)}</div>
    <div class="form-group"><label>Class</label><input type="text" id="edit-exam-class" value="${escapeHtml(exam.class || '')}" placeholder="e.g. BSCS 2B" /></div>
    <div class="form-group">
      <label>Exam Date</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="edit-exam-date" value="${exam.dateRaw || ''}" placeholder="Select exam date" readonly
          style="flex:1;cursor:pointer;" onclick="openDatePicker('edit-exam-date','Exam Date','edit-exam')" />
        <button type="button" onclick="openDatePicker('edit-exam-date','Exam Date','edit-exam')"
          style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📅</button>
      </div>
    </div>
    <div class="form-group">
      <label>Exam Time <span style="color:#aaa;font-size:0.8rem;">(optional)</span></label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="edit-exam-time" value="${timeDisplay}" placeholder="Select time" readonly
          style="flex:1;cursor:pointer;" onclick="openTimePicker('edit-exam-time','Time',event)" />
        <button type="button" onclick="openTimePicker('edit-exam-time','Time',event)"
          style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🕐</button>
      </div>
    </div>
    <button class="btn-primary" onclick="saveEditExam(${exam.id})">Save Changes</button>
  `;
  openModal(content);
}

async function saveEditExam(id) {
  const name = document.getElementById('edit-exam-name').value.trim();
  const subject = document.getElementById('edit-exam-subject-sel')?.value || '';
  const cls = document.getElementById('edit-exam-class').value.trim();
  const date = document.getElementById('edit-exam-date').value;
  const rawTime = document.getElementById('edit-exam-time')?.value || '';
  const examTime = _parseTimePickerTo24h(rawTime);
  if (!name) { showToast('Please enter an exam name'); return; }
  const { error } = await supabase.from('exams').update({
    name,
    subject: subject || 'General',
    class: cls || null,
    date: date || null,
    time: examTime || null,
  }).eq('id', id);
  if (error) { showToast('Failed to update exam'); console.error(error); return; }
  closeModal();
  await loadExamsFromSupabase();
  syncCalendarEvents();
  renderUpcomingSection();
  updateNotifBadge();
  selectedExamId = id;
  showExamDetails(id);
  showToast('Exam updated!');
}

function _parseTimePickerTo24h(rawTime) {
  if (!rawTime) return null;
  const match = rawTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!match) return null;
  let h = parseInt(match[1], 10);
  const m = match[2];
  const period = match[3].toUpperCase();
  if (period === 'AM' && h === 12) h = 0;
  if (period === 'PM' && h !== 12) h += 12;
  return `${String(h).padStart(2,'0')}:${m}`;
}

async function saveExam() {
  const name = document.getElementById('new-exam-name').value.trim();
  const subject = document.getElementById('new-exam-subject-sel')?.value || '';
  const cls = document.getElementById('new-exam-class').value.trim();
  const date = document.getElementById('new-exam-date').value;
  const rawTime = document.getElementById('new-exam-time')?.value || '';
  const examTime = _parseTimePickerTo24h(rawTime);
  if (!name) { showToast('Please enter an exam name'); return; }
  if (date && date < getTodayInputDate()) { showToast('Exam date cannot be in the past'); return; }
  if (date && date > getOneYearFromTodayInputDate()) { showToast('Exam date must be within one year from today'); return; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('You must be logged in'); return; }
  const { error } = await supabase.from('exams').insert({
    name,
    subject: subject || 'General',
    class: cls || null,
    date: date || null,
    time: examTime || null,
    status: 'incoming',
    user_id: user.id,
  });
  if (error) { showToast('Failed to save exam'); console.error(error); return; }
  closeModal();
  await loadExamsFromSupabase();
  if (state.currentPage === 'page-calendar') renderCalendar();
  showToast('Exam added!');
}

async function confirmRemoveExam() {
  const id = parseInt(document.getElementById('remove-exam-select').value);
  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) { showToast('Failed to remove exam'); console.error(error); return; }
  closeModal();
  await loadExamsFromSupabase();
  if (state.currentPage === 'page-calendar') renderCalendar();
  showToast('Exam removed.');
}
