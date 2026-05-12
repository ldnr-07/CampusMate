// ===== TASKS =====
let selectedTaskId = null;

async function loadTasksFromSupabase() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data, error } = await supabase.from('tasks').select('*').eq('user_id', user.id).order('created_at', { ascending: false });
  if (error) { console.error('Error loading tasks:', error); return; }
  state.tasks = data.map(t => ({
    id: t.id,
    name: t.title,
    subject: t.subject,
    due: t.deadline ? new Date(t.deadline + 'T00:00:00').toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }) : 'TBD',
    dueRaw: t.deadline || '',
    dueTime: t.due_time || '',
    type: t.type || 'Assignment',
    status: t.status === 'completed' ? 'past' : t.status,
    checked: t.status === 'completed',
    progress: t.progress || 0,
  }));
  renderTasks();
  updateCounts();
}

function renderTasks() {
  const container = document.getElementById('tasks-container');
  if (!container) return;

  const subjectFilter = document.getElementById('task-subject-filter');
  if (subjectFilter) {
    const currentVal = subjectFilter.value;
    const subjects = [...new Set(state.tasks.map(t => t.subject).filter(Boolean))];
    subjectFilter.innerHTML = '<option value="">All Subjects</option>' +
      subjects.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
    subjectFilter.value = currentVal;
  }

  const subjectFilterVal = subjectFilter ? subjectFilter.value : '';

  const filtered = state.tasks.filter(t => {
    let matchesTab = false;
    if (state.taskTab === 'current') matchesTab = t.status === 'current' || t.status === 'pending';
    if (state.taskTab === 'past') matchesTab = t.status === 'past' || t.checked;
    if (state.taskTab === 'overdue') matchesTab = t.status === 'overdue';
    const matchesSubject = !subjectFilterVal || t.subject === subjectFilterVal;
    return matchesTab && matchesSubject;
  });

  if (filtered.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><p>No ${state.taskTab} tasks</p></div>`;
    return;
  }

  container.innerHTML = filtered.map(t => {
    const progress = t.checked ? 100 : (t.progress || 0);
    const statusClass = t.checked ? 'completed' : (t.status === 'overdue' ? 'overdue' : '');
    const isSelected = selectedTaskId === t.id ? 'selected' : '';
    // FIX: escape all user-supplied strings before injecting into innerHTML
    return `
    <div class="task-card ${statusClass} ${isSelected}" data-id="${t.id}" onclick="selectTask(${t.id})">
      <div class="task-indicator">✓</div>
      <div class="task-main">
        <div class="task-title">${escapeHtml(t.name)}</div>
        <div class="task-meta">
          <span class="task-subject-tag">${escapeHtml(t.subject || '')}</span>
          <span>${escapeHtml(t.due)}${t.dueTime ? ' · ' + escapeHtml(formatTimeLabel(t.dueTime)) : ''}</span>
        </div>
      </div>
      <div class="task-progress">${progress}%</div>
    </div>
  `;}).join('');

  if (selectedTaskId) showTaskDetail(selectedTaskId);
}

function selectTask(id) {
  selectedTaskId = id;
  renderTasks();
  showTaskDetail(id);
}

function showTaskDetail(id) {
  const task = state.tasks.find(t => t.id === id);
  if (!task) return;

  const detailPanel = document.getElementById('task-detail-panel');
  const emptyPanel = document.getElementById('task-detail-empty');

  if (detailPanel) detailPanel.style.display = 'flex';
  if (emptyPanel) emptyPanel.style.display = 'none';

  const titleEl = document.getElementById('task-detail-title');
  const subjectEl = document.getElementById('task-detail-subject');
  const dateEl = document.getElementById('task-detail-date');
  const timeEl = document.getElementById('task-detail-time');
  const progressBar = document.getElementById('task-progress-bar');
  const progressText = document.getElementById('task-progress-text');
  const progressHandle = document.getElementById('progress-handle');
  const markBtn = document.getElementById('btn-mark-complete');

  if (titleEl) titleEl.textContent = task.name;
  if (subjectEl) subjectEl.textContent = task.subject;
  if (dateEl) dateEl.textContent = `Due: ${task.due}`;
  if (timeEl) timeEl.textContent = task.dueTime ? formatTimeLabel(task.dueTime) : 'No time set';

  const progress = task.checked ? 100 : (task.progress || 0);
  if (progressBar) progressBar.style.width = progress + '%';
  if (progressText) progressText.textContent = progress + '%';
  if (progressHandle) progressHandle.style.left = progress + '%';

  if (markBtn) {
    markBtn.textContent = task.checked ? '✓ Completed' : 'Mark as Complete';
    markBtn.classList.toggle('completed', task.checked);
  }
}

// Progress bar drag functionality
let isDraggingProgress = false;

function startProgressDrag(e) {
  if (!selectedTaskId) return;
  isDraggingProgress = true;
  updateProgressFromEvent(e);
  e.preventDefault();
  document.addEventListener('mousemove', onProgressDrag);
  document.addEventListener('mouseup', stopProgressDrag);
  document.addEventListener('touchmove', onProgressDrag, { passive: false });
  document.addEventListener('touchend', stopProgressDrag);
}

function onProgressDrag(e) {
  if (!isDraggingProgress) return;
  e.preventDefault();
  updateProgressFromEvent(e);
}

function stopProgressDrag() {
  isDraggingProgress = false;
  document.removeEventListener('mousemove', onProgressDrag);
  document.removeEventListener('mouseup', stopProgressDrag);
  document.removeEventListener('touchmove', onProgressDrag);
  document.removeEventListener('touchend', stopProgressDrag);
}

function updateProgressFromEvent(e) {
  const container = document.getElementById('progress-container');
  if (!container) return;
  const rect = container.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  let percent = ((clientX - rect.left) / rect.width) * 100;
  percent = Math.max(0, Math.min(100, Math.round(percent)));
  updateTaskProgress(percent);
}

function updateTaskProgress(value) {
  if (!selectedTaskId) return;
  const task = state.tasks.find(t => t.id === selectedTaskId);
  if (task) {
    task.progress = parseInt(value);
    if (task.progress === 100 && !task.checked) {
      task.checked = true;
      task.status = 'past';
    } else if (task.progress < 100 && task.checked) {
      task.checked = false;
      task.status = 'current';
    }

    const progressBar = document.getElementById('task-progress-bar');
    const progressText = document.getElementById('task-progress-text');
    const progressHandle = document.getElementById('progress-handle');
    const markBtn = document.getElementById('btn-mark-complete');

    if (progressBar) progressBar.style.width = value + '%';
    if (progressText) progressText.textContent = value + '%';
    if (progressHandle) progressHandle.style.left = value + '%';
    if (markBtn) {
      markBtn.textContent = task.checked ? '✓ Completed' : 'Mark as Complete';
      markBtn.classList.toggle('completed', task.checked);
    }

    if (window.progressUpdateTimeout) clearTimeout(window.progressUpdateTimeout);
    window.progressUpdateTimeout = setTimeout(async () => {
      const newStatus = task.checked ? 'completed' : (task.status === 'overdue' ? 'overdue' : 'pending');
      await supabase.from('tasks').update({ progress: task.progress, status: newStatus }).eq('id', task.id);
      renderTasks();
      updateCounts();
    }, 400);
  }
}

async function toggleSelectedTask() {
  if (!selectedTaskId) return;
  const task = state.tasks.find(t => t.id === selectedTaskId);
  if (task) {
    task.checked = !task.checked;
    task.progress = task.checked ? 100 : 0;
    task.status = task.checked ? 'past' : 'current';
    const newStatus = task.checked ? 'completed' : 'pending';
    await supabase.from('tasks').update({ status: newStatus, progress: task.progress }).eq('id', task.id);
    showTaskDetail(selectedTaskId);
    renderTasks();
    updateCounts();
    showToast(task.checked ? 'Task marked as complete' : 'Task marked as incomplete');
  }
}

function switchTaskTab(tab) {
  state.taskTab = tab;
  document.querySelectorAll('#page-tasks .task-tab').forEach(t => t.classList.remove('active'));
  const tabEl = document.getElementById(`tab-${tab}`);
  if (tabEl) tabEl.classList.add('active');
  renderTasks();
}

function toggleTask(id) {
  const task = state.tasks.find(t => t.id === id);
  if (task) {
    task.checked = !task.checked;
    if (task.checked && task.status === 'current') task.status = 'past';
    renderTasks();
    updateCounts();
  }
}

function onTaskSubjectChange(sel) {
  const customInput = document.getElementById('new-task-subject');
  if (!customInput) return;
  if (sel.value === '__other__') {
    customInput.style.display = 'block';
    customInput.focus();
  } else {
    customInput.style.display = 'none';
    customInput.value = '';
  }
}

function openAddTask() {
  const content = `
    <h3>Add New Task</h3>
    <div class="form-group"><label>Task Name</label><input type="text" id="new-task-name" placeholder="Enter task name" /></div>
    <div class="form-group">
      <label>Subject</label>
      <select id="new-task-subject-sel" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;" onchange="onTaskSubjectChange(this)">
        <option value="">Select subject</option>
        ${[...new Set(state.classes.map(c=>c.subject).filter(Boolean))].map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('')}
      </select>
      <input type="text" id="new-task-subject" placeholder="Enter subject name" style="display:none;margin-top:8px;" />
    </div>
    <div class="form-group"><label>Class</label><input type="text" id="new-task-class" placeholder="e.g. BSCS 2B" /></div>
    <div class="form-group"><label>Type</label><select id="new-task-type" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;"><option value="Assignment">Assignment</option><option value="Lab">Lab</option><option value="Project">Project</option><option value="Quiz">Quiz</option></select></div>
    <div class="form-group">
      <label>Due Date</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="new-task-due" placeholder="Select due date" readonly style="flex:1;cursor:pointer;" onclick="openDatePicker('new-task-due','Due Date','task')" />
        <button type="button" onclick="openDatePicker('new-task-due','Due Date','task')" style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📅</button>
      </div>
    </div>
    <div class="form-group">
      <label>Due Time <span style="color:#aaa;font-size:0.8rem;">(optional)</span></label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="new-task-time" placeholder="Select time" readonly style="flex:1;cursor:pointer;" onclick="openTimePicker('new-task-time','task')" />
        <button type="button" onclick="openTimePicker('new-task-time','task')" style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🕐</button>
      </div>
    </div>
    <button class="btn-primary" onclick="saveTask()">Add Task</button>
  `;
  openModal(content);
}

async function saveTask() {
  const name = document.getElementById('new-task-name').value.trim();
  const sel = document.getElementById('new-task-subject-sel');
  const customInput = document.getElementById('new-task-subject');
  const subject = (sel && sel.value && sel.value !== '__other__') ? sel.value : (customInput?.value.trim() || '');
  const due = document.getElementById('new-task-due').value;
  const rawTime = document.getElementById('new-task-time')?.value || '';
  let dueTime = null;
  if (rawTime) {
    const match = rawTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const period = match[3].toUpperCase();
      if (period === 'AM' && h === 12) h = 0;
      if (period === 'PM' && h !== 12) h += 12;
      dueTime = `${String(h).padStart(2,'0')}:${m}`;
    }
  }
  if (!name) { showToast('Please enter a task name'); return; }
  if (due && due < getTodayInputDate()) { showToast('Due date cannot be in the past'); return; }
  if (due && due > getOneYearFromTodayInputDate()) { showToast('Due date must be within one year from today'); return; }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('You must be logged in'); return; }
  const type = document.getElementById('new-task-type')?.value || 'Assignment';
  const { data, error } = await supabase.from('tasks').insert({
    title: name,
    subject: subject || 'General',
    deadline: due || null,
    due_time: dueTime || null,
    type,
    status: 'pending',
    progress: 0,
    user_id: user.id,
  }).select().single();
  if (error) { showToast('Failed to save task'); console.error(error); return; }
  closeModal();
  await loadTasksFromSupabase();
  if (state.currentPage === 'page-calendar') renderCalendar();
  showToast('Task added successfully!');
}

function editSelectedTask() {
  if (!selectedTaskId) return;
  const task = state.tasks.find(t => t.id === selectedTaskId);
  if (!task) return;
  const subjectOptions = [...new Set(state.classes.map(c => c.subject).filter(Boolean))];
  const timeDisplay = task.dueTime ? formatTimeLabel(task.dueTime) : '';
  const content = `
    <h3>Edit Task</h3>
    <div class="form-group"><label>Task Name</label><input type="text" id="edit-task-name" value="${escapeHtml(task.name)}" /></div>
    <div class="form-group">
      <label>Subject</label>
      <select id="edit-task-subject-sel" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;">
        <option value="">Select subject</option>
        ${subjectOptions.map(s => `<option value="${escapeHtml(s)}" ${s === task.subject ? 'selected' : ''}>${escapeHtml(s)}</option>`).join('')}
        ${!subjectOptions.includes(task.subject) && task.subject ? `<option value="${escapeHtml(task.subject)}" selected>${escapeHtml(task.subject)}</option>` : ''}
      </select>
    </div>
    <div class="form-group">
      <label>Due Date</label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="edit-task-due" value="${escapeHtml(task.dueRaw || '')}" placeholder="Select due date" readonly style="flex:1;cursor:pointer;" onclick="openDatePicker('edit-task-due','Due Date','edit-task')" />
        <button type="button" onclick="openDatePicker('edit-task-due','Due Date','edit-task')" style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">📅</button>
      </div>
    </div>
    <div class="form-group">
      <label>Due Time <span style="color:#aaa;font-size:0.8rem;">(optional)</span></label>
      <div style="display:flex;gap:8px;align-items:center;">
        <input type="text" id="edit-task-time" value="${escapeHtml(timeDisplay)}" placeholder="Select time" readonly style="flex:1;cursor:pointer;" onclick="openTimePicker('edit-task-time','edit-task')" />
        <button type="button" onclick="openTimePicker('edit-task-time','edit-task')" style="background:var(--blue);color:white;border:none;padding:8px 12px;border-radius:8px;cursor:pointer;">🕐</button>
      </div>
    </div>
    <div class="form-group"><label>Type</label><select id="edit-task-type" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;"><option value="Assignment" ${task.type==='Assignment'?'selected':''}>Assignment</option><option value="Lab" ${task.type==='Lab'?'selected':''}>Lab</option><option value="Project" ${task.type==='Project'?'selected':''}>Project</option><option value="Quiz" ${task.type==='Quiz'?'selected':''}>Quiz</option></select></div>
    <button class="btn-primary" onclick="saveEditTask(${task.id})">Save Changes</button>
  `;
  openModal(content);
}

async function saveEditTask(id) {
  const name = document.getElementById('edit-task-name').value.trim();
  const subSel = document.getElementById('edit-task-subject-sel');
  const subject = subSel?.value || '';
  const due = document.getElementById('edit-task-due').value;
  const type = document.getElementById('edit-task-type')?.value || 'Assignment';
  const rawTime = document.getElementById('edit-task-time')?.value || '';
  let dueTime = null;
  if (rawTime) {
    const match = rawTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
    if (match) {
      let h = parseInt(match[1], 10);
      const m = match[2];
      const period = match[3].toUpperCase();
      if (period === 'AM' && h === 12) h = 0;
      if (period === 'PM' && h !== 12) h += 12;
      dueTime = `${String(h).padStart(2,'0')}:${m}`;
    }
  }
  if (!name) { showToast('Please enter a task name'); return; }
  const { error } = await supabase.from('tasks').update({
    title: name,
    subject: subject || 'General',
    deadline: due || null,
    due_time: dueTime || null,
    type,
  }).eq('id', id);
  if (error) { showToast('Failed to update task'); console.error(error); return; }
  closeModal();
  await loadTasksFromSupabase();
  syncCalendarEvents();
  renderUpcomingSection();
  updateNotifBadge();
  selectedTaskId = id;
  showTaskDetail(id);
  showToast('Task updated!');
}

function deleteSelectedTask() {
  if (!selectedTaskId) return;
  const task = state.tasks.find(t => t.id === selectedTaskId);
  openModal(`
    <h3 style="color:var(--danger);">Delete Task?</h3>
    <p style="color:#555;margin:12px 0 20px;line-height:1.6;">Delete <strong>${escapeHtml(task?.name || 'this task')}</strong>? This cannot be undone.</p>
    <div style="display:flex;gap:10px;justify-content:flex-end;">
      <button onclick="closeModal()" style="background:none;border:none;color:#888;font-weight:600;cursor:pointer;padding:8px 16px;border-radius:8px;">Cancel</button>
      <button onclick="_doDeleteSelectedTask()" style="background:var(--danger);color:white;border:none;padding:8px 20px;border-radius:8px;font-weight:700;cursor:pointer;">Delete</button>
    </div>
  `);
}

async function _doDeleteSelectedTask() {
  closeModal();
  const { error } = await supabase.from('tasks').delete().eq('id', selectedTaskId);
  if (error) { showToast('Failed to delete task'); console.error(error); return; }
  selectedTaskId = null;
  const detailPanel = document.getElementById('task-detail-panel');
  const emptyPanel = document.getElementById('task-detail-empty');
  if (detailPanel) detailPanel.style.display = 'none';
  if (emptyPanel) emptyPanel.style.display = 'flex';
  await loadTasksFromSupabase();
  showToast('Task deleted');
}

function removeSelectedTask() {
  const content = `
    <h3>Remove Task</h3>
    <div class="form-group">
      <label>Select Task to Remove</label>
      <select id="remove-task-select" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;">
        ${state.tasks.map(t => `<option value="${t.id}">${escapeHtml(t.name)} (${escapeHtml(t.status)})</option>`).join('')}
      </select>
    </div>
    <button class="btn-primary" style="background:var(--danger);" onclick="confirmRemoveTask()">Remove Task</button>
  `;
  openModal(content);
}

async function confirmRemoveTask() {
  const id = parseInt(document.getElementById('remove-task-select').value);
  const { error } = await supabase.from('tasks').delete().eq('id', id);
  if (error) { showToast('Failed to remove task'); console.error(error); return; }
  closeModal();
  await loadTasksFromSupabase();
  if (state.currentPage === 'page-calendar') renderCalendar();
  showToast('Task removed.');
}
