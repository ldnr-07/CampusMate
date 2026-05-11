// ===== UTILITIES =====
function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function formatDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLong(d) {
  return d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
}

function getWeekDates(date) {
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay());
  return Array.from({ length: 7 }, (_, i) => new Date(start.getTime() + i * 86400000));
}

function getTodayInputDate() {
  const today = new Date();
  return formatInputDate(today);
}

function getOneYearFromTodayInputDate() {
  const maxDate = new Date();
  maxDate.setFullYear(maxDate.getFullYear() + 1);
  return formatInputDate(maxDate);
}

function formatInputDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTimeLabel(timeValue) {
  const [hRaw, m] = timeValue.split(':');
  const h = parseInt(hRaw, 10);
  const suffix = h >= 12 ? 'pm' : 'am';
  const hour12 = h % 12 || 12;
  return `${hour12}:${m} ${suffix}`;
}

function escapeHtml(text) {
  return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function getSubjectOptionsDatalist() {
  const options = state.classes.map(c => `<option value="${c.subject}"></option>`).join('');
  return `<datalist id="subject-options">${options}</datalist>`;
}

function getSubjectSelectOptions() {
  const subjects = Array.from(new Set(state.classes.map(c => c.subject))).filter(Boolean);
  return [
    '<option value="">Select subject</option>',
    ...subjects.map(s => `<option value="${s}">${s}</option>`),
    '<option value="__add_new__">+ Add New Subject</option>'
  ].join('');
}

function getClassSectionOptions() {
  const sections = Array.from(new Set(state.classes.map(c => c.section))).filter(Boolean);
  if (sections.length === 0) return '<option value="N/A">N/A</option>';
  return sections.map(s => `<option value="${s}">${s}</option>`).join('');
}
