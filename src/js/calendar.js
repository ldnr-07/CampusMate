// ===== CALENDAR =====
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAYS = ['SUN','MON','TUE','WED','THU','FRI','SAT'];

function renderCalendar() {
  const title = document.getElementById('cal-title');
  const body = document.getElementById('calendar-body');
  if (!title || !body) return;

  // Inject holidays for the current viewed year (and neighbor years for week/day view edge cases)
  const year = state.calDate.getFullYear();
  const years = [year - 1, year, year + 1];
  // Remove old auto-generated holidays, keep user tasks/exams
  state.events = state.events.filter(e => e.type !== 'holiday');
  years.forEach(y => getPhHolidays(y).forEach(h => state.events.push(h)));

  if (state.calView === 'month') {
    title.textContent = `${MONTHS[state.calDate.getMonth()]} ${state.calDate.getFullYear()}`;
    body.innerHTML = renderMonthView();
  } else if (state.calView === 'week') {
    const week = getWeekDates(state.calDate);
    title.textContent = `${MONTHS[week[0].getMonth()]} ${week[0].getFullYear()}`;
    body.innerHTML = renderWeekView(week);
  } else if (state.calView === 'year') {
    title.textContent = state.calDate.getFullYear().toString();
    body.innerHTML = renderYearView();
  } else {
    title.textContent = formatDateLong(state.calDate);
    body.innerHTML = renderDayView(state.calDate);
  }

  // Start/stop live time update depending on view
  if (state.calView === 'week' || state.calView === 'day') {
    setTimeout(startLiveTimeUpdate, 0);
  } else {
    if (window.liveTimeInterval) { clearInterval(window.liveTimeInterval); window.liveTimeInterval = null; }
  }
}

function renderMonthView() {
  const year = state.calDate.getFullYear();
  const month = state.calDate.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date();

  let html = '<div class="month-grid">';
  html += '<div class="month-header-row">' + DAYS.map(d => `<div class="month-header-cell">${d}</div>`).join('') + '</div>';
  html += '<div class="month-weeks">';

  let dayCount = 1 - firstDay;
  for (let w = 0; w < 6; w++) {
    if (dayCount > daysInMonth) break;
    html += '<div class="month-week">';
    for (let d = 0; d < 7; d++, dayCount++) {
      const isCurrentMonth = dayCount >= 1 && dayCount <= daysInMonth;
      const cellDate = new Date(year, month, dayCount);
      const isToday = sameDay(cellDate, today);
      const dateStr = formatDateStr(cellDate);
      const events = state.events.filter(e => e.date === dateStr);

      html += `<div class="month-cell${!isCurrentMonth ? ' other-month' : ''}${isToday ? ' today' : ''}" onclick="calCellClick('${dateStr}')">`;
      html += `<div class="day-num${isToday ? ' today-circle' : ''}">${dayCount < 1 ? new Date(year, month, dayCount).getDate() : dayCount > daysInMonth ? dayCount - daysInMonth : dayCount}</div>`;
      events.forEach(e => { html += `<div class="cal-event ${e.type}">${e.title}${e.timeLabel ? ' ' + e.timeLabel : ''}</div>`; });
      html += '</div>';
    }
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function renderWeekView(week) {
  const today = new Date();
  let html = '<div class="week-grid">';

  // Header
  html += '<div class="week-header-row"><div class="week-header-cell" style="font-size:0.7rem;color:#aaa;padding-top:16px;">GMT+08</div>';
  week.forEach(d => {
    const isToday = sameDay(d, today);
    const dateStr = formatDateStr(d);
    const holidays = state.events.filter(e => e.date === dateStr && e.type === 'holiday');
    html += `<div class="week-header-cell">
      <span class="day-name">${DAYS[d.getDay()]}</span>
      <div class="day-num-w${isToday ? ' today-w' : ''}">${d.getDate()}</div>
      ${holidays.map(h => `<div class="week-holiday">${h.title}</div>`).join('')}
    </div>`;
  });
  html += '</div>';

  // Body
  const hasToday = week.some(d => sameDay(d, today));
  html += '<div class="week-body" id="week-body">';
  // Add current time indicator if today is in this week
  if (hasToday) {
    html += getCurrentTimeIndicatorHTML();
  }
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? 'GMT+08' : (h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h-12}PM`);
    html += `<div class="week-row"><div class="week-time">${label}</div>`;
    week.forEach(d => {
      const isToday = sameDay(d, today);
      const dateStr = formatDateStr(d);
      const evs = state.events.filter(e => e.date === dateStr && e.type !== 'holiday');
      html += `<div class="week-cell${isToday ? ' today-col' : ''}" onclick="calCellClick('${dateStr}')">`;
      evs.filter(e => (e.startHour !== null && e.startHour !== undefined ? e.startHour : 8) === h)
         .forEach(e => { html += `<div class="cal-event ${e.type}" style="font-size:0.65rem;">${e.title}${e.timeLabel ? ' ' + e.timeLabel : ''}</div>`; });
      html += '</div>';
    });
    html += '</div>';
  }
  html += '</div></div>';
  return html;
}

function renderDayView(date) {
  const today = new Date();
  const isToday = sameDay(date, today);
  const dateStr = formatDateStr(date);
  const events = state.events.filter(e => e.date === dateStr);

  let html = '<div class="day-grid">';
  html += `<div class="day-header">
    <div class="day-num${isToday ? ' today-circle' : ''}" style="width:36px;height:36px;font-size:1rem;display:flex;align-items:center;justify-content:center;border-radius:50%;background:${isToday?'var(--blue)':'transparent'};color:${isToday?'white':'#333'};">
      ${date.getDate()}
    </div>
    <span style="font-weight:700;font-family:var(--brand-font);">${DAYS[date.getDay()]}</span>
    ${events.filter(e=>e.type==='holiday').map(e=>`<div class="cal-event holiday" style="margin-left:8px;">${e.title}</div>`).join('')}
  </div>`;

  html += '<div class="day-body" id="day-body">';
  // Add current time indicator if viewing today
  if (isToday) {
    html += getCurrentTimeIndicatorHTML();
  }
  for (let h = 0; h < 24; h++) {
    const label = h === 0 ? 'GMT+08' : (h < 12 ? `${h}AM` : h === 12 ? '12PM' : `${h-12}PM`);
    const evs = events.filter(e => e.type !== 'holiday');
    html += `<div class="day-row">
      <div class="day-time">${label}</div>
      <div class="day-cell">
        ${evs.filter(e => (e.startHour !== null && e.startHour !== undefined ? e.startHour : 8) === h).map(e => `<div class="cal-event ${e.type}">${e.title}${e.timeLabel ? ' ' + e.timeLabel : ''}</div>`).join('')}
      </div>
    </div>`;
  }
  html += '</div></div>';
  return html;
}

function renderYearView() {
  const year = state.calDate.getFullYear();
  const today = new Date();

  let html = '<div class="year-grid">';

  for (let m = 0; m < 12; m++) {
    const monthDate = new Date(year, m, 1);
    const firstDay = monthDate.getDay();
    const daysInMonth = new Date(year, m + 1, 0).getDate();
    const isCurrentMonth = today.getFullYear() === year && today.getMonth() === m;

    html += `<div class="year-month">`;
    html += `<div class="year-month-title" style="font-weight:700;font-size:0.95rem;color:var(--blue);margin-bottom:8px;${isCurrentMonth?'background:var(--blue);color:white;padding:4px 8px;border-radius:6px;display:inline-block;':''}">${MONTHS[m].substring(0,3)}</div>`;

    // Mini calendar for this month
    html += '<div class="year-month-grid" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;font-size:0.75rem;">';

    // Day headers
    ['S','M','T','W','T','F','S'].forEach(d => {
      html += `<div style="text-align:center;color:#aaa;font-size:0.65rem;">${d}</div>`;
    });

    // Empty cells before first day
    for (let i = 0; i < firstDay; i++) {
      html += '<div></div>';
    }

    // Days
    for (let d = 1; d <= daysInMonth; d++) {
      const cellDate = new Date(year, m, d);
      const isToday = sameDay(cellDate, today);
      const dateStr = formatDateStr(cellDate);
      const hasEvents = state.events.some(e => e.date === dateStr);

      html += `<div onclick="goToDate('${dateStr}')" style="text-align:center;padding:4px 2px;border-radius:4px;cursor:pointer;${isToday?'background:var(--blue);color:white;font-weight:700;':hasEvents?'background:var(--blue-tint);color:var(--blue);font-weight:600;':''}">${d}</div>`;
    }

    html += '</div>'; // close month-grid
    html += '</div>'; // close year-month
  }

  html += '</div>'; // close year-grid
  return html;
}

// Helper function to generate current time indicator HTML
function getCurrentTimeIndicatorHTML() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  // Calculate pixel position based on 24 rows (48px each for week, 56px for day)
  // Use 48px as baseline for calculation, will be adjusted by JS after render
  const rowHeight = 48;
  const topPosition = (hours + minutes / 60) * rowHeight;

  return `<div class="current-time-line" id="current-time-line" data-hours="${hours}" data-minutes="${minutes}" style="top:${topPosition}px;">
    <div class="current-time-label">${timeLabel}</div>
  </div>`;
}

// Update the current time indicator position
function updateCurrentTimeIndicator() {
  const timeLine = document.getElementById('current-time-line');
  if (!timeLine) return;

  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();
  const timeLabel = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;

  const weekBody = document.getElementById('week-body');
  const dayBody = document.getElementById('day-body');
  const body = weekBody || dayBody;

  if (body) {
    const firstRow = body.querySelector('.week-row, .day-row');
    if (firstRow) {
      const rowHeight = firstRow.offsetHeight;
      const topPosition = (hours + minutes / 60) * rowHeight;
      timeLine.style.top = topPosition + 'px';
    }

    // In week view: constrain line to today's column only
    if (weekBody) {
      const todayCell = weekBody.querySelector('.week-cell.today-col');
      if (todayCell) {
        const bodyRect = weekBody.getBoundingClientRect();
        const cellRect = todayCell.getBoundingClientRect();
        timeLine.style.left = (cellRect.left - bodyRect.left) + 'px';
        timeLine.style.width = cellRect.width + 'px';
        timeLine.style.right = 'auto';
      }
    }
  }

  const label = timeLine.querySelector('.current-time-label');
  if (label) label.textContent = timeLabel;
}

// Start the live time update timer
function startLiveTimeUpdate() {
  // Update immediately
  updateCurrentTimeIndicator();

  // Update every minute
  if (window.liveTimeInterval) clearInterval(window.liveTimeInterval);
  window.liveTimeInterval = setInterval(() => {
    updateCurrentTimeIndicator();
  }, 60000); // Update every minute
}

function setCalView(v, keepDate = false) {
  state.calView = v;
  document.querySelectorAll('.view-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`vb-${v}`).classList.add('active');

  // Reset to today when switching via toolbar buttons, but not when navigating from a cell click
  if (!keepDate && (v === 'week' || v === 'day')) {
    state.calDate = new Date();
  }

  renderCalendar();
}

function calPrev() {
  if (state.calView === 'month') state.calDate = new Date(state.calDate.getFullYear(), state.calDate.getMonth() - 1, 1);
  else if (state.calView === 'week') state.calDate = new Date(state.calDate.getTime() - 7 * 86400000);
  else if (state.calView === 'year') state.calDate = new Date(state.calDate.getFullYear() - 1, 0, 1);
  else state.calDate = new Date(state.calDate.getTime() - 86400000);
  renderCalendar();
}

function calNext() {
  if (state.calView === 'month') state.calDate = new Date(state.calDate.getFullYear(), state.calDate.getMonth() + 1, 1);
  else if (state.calView === 'week') state.calDate = new Date(state.calDate.getTime() + 7 * 86400000);
  else if (state.calView === 'year') state.calDate = new Date(state.calDate.getFullYear() + 1, 0, 1);
  else state.calDate = new Date(state.calDate.getTime() + 86400000);
  renderCalendar();
}

function goToday() {
  state.calDate = new Date();
  renderCalendar();
}

function goToDate(dateStr) {
  state.calDate = new Date(dateStr + 'T00:00:00');
  setCalView('day', true);
}

function calCellClick(dateStr) {
  state.calDate = new Date(dateStr + 'T00:00:00');
  if (state.calView === 'month') setCalView('day', true);
  else renderCalendar();
}

// ===== PHILIPPINE HOLIDAYS GENERATOR =====
function getPhHolidays(year) {
  // Easter calculation (Anonymous Gregorian algorithm)
  function easterDate(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100;
    const d = Math.floor(b / 4), e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31); // 1-based
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(y, month - 1, day);
  }

  function pad(n) { return String(n).padStart(2, '0'); }
  function fmt(d) { return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`; }
  function fixed(month, day, title) {
    return { date: `${year}-${pad(month)}-${pad(day)}`, title, type: 'holiday' };
  }
  function offset(base, days, title) {
    const d = new Date(base.getTime() + days * 86400000);
    return { date: fmt(d), title, type: 'holiday' };
  }

  // Chinese New Year (2nd new moon after winter solstice — approximated per year)
  const chineseNewYear = {
    2020: '01-25', 2021: '02-12', 2022: '02-01', 2023: '01-22',
    2024: '02-10', 2025: '01-29', 2026: '02-17', 2027: '02-06',
    2028: '01-26', 2029: '02-13', 2030: '02-03', 2031: '01-23',
    2032: '02-11', 2033: '01-31', 2034: '02-19', 2035: '02-08',
  };

  // Eid al-Fitr approximations (lunar — tentative)
  const eidFitr = {
    2020: '05-24', 2021: '05-13', 2022: '05-02', 2023: '04-21',
    2024: '04-10', 2025: '03-30', 2026: '03-20', 2027: '03-09',
    2028: '02-26', 2029: '02-14', 2030: '02-04', 2031: '01-24',
    2032: '01-13', 2033: '01-02', 2034: '12-23', 2035: '12-12',
  };

  // Eid al-Adha approximations (lunar — tentative)
  const eidAdha = {
    2020: '07-31', 2021: '07-20', 2022: '07-09', 2023: '06-28',
    2024: '06-17', 2025: '06-06', 2026: '05-26', 2027: '05-16',
    2028: '05-04', 2029: '04-23', 2030: '04-13', 2031: '04-02',
    2032: '03-21', 2033: '03-11', 2034: '02-28', 2035: '02-17',
  };

  const easter = easterDate(year);
  const holidays = [];

  // January
  holidays.push(fixed(1, 1,  "New Year's Day"));

  // Chinese New Year
  if (chineseNewYear[year]) {
    holidays.push({ date: `${year}-${chineseNewYear[year]}`, title: 'Chinese New Year', type: 'holiday' });
  }

  // February
  holidays.push(fixed(2, 25, 'EDSA People Power Revolution'));

  // Holy Week (relative to Easter)
  holidays.push(offset(easter, -3, 'Maundy Thursday'));
  holidays.push(offset(easter, -2, 'Good Friday'));
  holidays.push(offset(easter, -1, 'Black Saturday'));

  // April
  holidays.push(fixed(4, 9, 'Araw ng Kagitingan'));

  // Eid al-Fitr
  if (eidFitr[year]) {
    holidays.push({ date: `${year}-${eidFitr[year]}`, title: 'Eid al-Fitr (Tentative)', type: 'holiday' });
  }

  // May
  holidays.push(fixed(5, 1, 'Labor Day'));

  // Eid al-Adha
  if (eidAdha[year]) {
    holidays.push({ date: `${year}-${eidAdha[year]}`, title: 'Eid al-Adha (Tentative)', type: 'holiday' });
  }

  // June
  holidays.push(fixed(6, 12, 'Independence Day'));

  // August
  holidays.push(fixed(8, 21, 'Ninoy Aquino Day'));
  holidays.push(fixed(8, 31, 'National Heroes Day'));

  // October / November
  holidays.push(fixed(10, 31, 'Halloween'));
  holidays.push(fixed(11, 1,  "All Saints' Day"));
  holidays.push(fixed(11, 2,  "All Souls' Day"));
  holidays.push(fixed(11, 30, 'Bonifacio Day'));

  // December
  holidays.push(fixed(12, 8,  'Feast of the Immaculate Conception'));
  holidays.push(fixed(12, 24, 'Christmas Eve'));
  holidays.push(fixed(12, 25, 'Christmas Day'));
  holidays.push(fixed(12, 30, 'Rizal Day'));
  holidays.push(fixed(12, 31, "New Year's Eve"));

  return holidays;
}
