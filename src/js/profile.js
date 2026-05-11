// ===== PROFILE =====
function editField(field) {
  if (field === 'basic') {
    openDobPicker();
    return;
  }

  if (field === 'sex') {
    const current = state.profile.sex || '';
    const content = `
      <h3>Edit Sex</h3>
      <div class="form-group">
        <label>Sex</label>
        <select id="edit-field-val" style="width:100%;padding:10px;border:2px solid #e8edf2;border-radius:8px;font-size:0.9rem;">
          <option value="Male" ${current==='Male'?'selected':''}>Male</option>
          <option value="Female" ${current==='Female'?'selected':''}>Female</option>
          <option value="Prefer not to say" ${current==='Prefer not to say'?'selected':''}>Prefer not to say</option>
        </select>
      </div>
      <button class="btn-primary" onclick="saveEdit('sex')">Save Changes</button>
    `;
    openModal(content);
    return;
  }

  const fieldMap = {
    name: { label: 'Full Name', placeholder: 'John M. Doe' },
    username: { label: 'Username', placeholder: '@j4221' },
    email: { label: 'Email', placeholder: 'johnmd@gmail.com' },
    password: { label: 'New Password', placeholder: 'Enter new password', type: 'password' },
  };

  const f = fieldMap[field] || { label: field, placeholder: '' };
  const currentVal = state.profile[field] || '';
  const content = `
    <h3>Edit ${f.label}</h3>
    <div class="form-group">
      <label>${f.label}</label>
      <input type="${f.type || 'text'}" id="edit-field-val" placeholder="${f.placeholder}" value="${escapeHtml(currentVal)}" />
    </div>
    <button class="btn-primary" onclick="saveEdit('${field}')">Save Changes</button>
  `;
  openModal(content);
}

function saveEdit(field) {
  const input = document.getElementById('edit-field-val');
  const newValue = input ? input.value.trim() : '';

  if (field === 'password') {
    const newValue = input ? input.value.trim() : '';
    if (!newValue) { showToast('Please enter a new password'); return; }
    supabase.auth.updateUser({ password: newValue }).then(({ error }) => {
      if (error) { showToast('Failed to update password: ' + error.message); return; }
      const now = new Date().toISOString();
      state.profile.updatedAt = now;
      supabase.auth.getUser().then(({ data: { user } }) => {
        if (user) supabase.from('profiles').update({ updated_at: now }).eq('id', user.id);
      });
      updateProfileDisplay();
      showToast('Password updated!');
    });
    closeModal();
    return;
  }

  if (newValue) {
    const updatePayload = {};
    if (field === 'basic') {
      state.profile.dob = newValue;
      updatePayload.dob = newValue;
    } else if (field === 'name') {
      state.profile.name = newValue;
      const parts = newValue.trim().split(' ');
      updatePayload.first_name = parts[0] || '';
      updatePayload.last_name = parts.slice(1).join(' ') || '';
    } else if (field === 'username') {
      state.profile.username = newValue;
      updatePayload.username = newValue;
    } else if (field === 'email') {
      state.profile.email = newValue;
      updatePayload.email = newValue;
    } else if (field === 'sex') {
      state.profile.sex = newValue;
      updatePayload.sex = newValue;
    } else {
      state.profile[field] = newValue;
      updatePayload[field] = newValue;
    }

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) supabase.from('profiles').update({ ...updatePayload, updated_at: new Date().toISOString() }).eq('id', user.id);
    });

    updateProfileDisplay();
  }

  closeModal();
  showToast(`${field.charAt(0).toUpperCase() + field.slice(1)} updated!`);
}

function fmtProfileDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' });
}

function updateProfileDisplay() {
  const p = state.profile;
  const nameEl = document.querySelector('.profile-name-section h1');
  const usernameEl = document.querySelector('.profile-username');

  if (nameEl) {
    nameEl.innerHTML = `${escapeHtml(p.name || '')} <button class="edit-btn" onclick="editField('name')">✏</button>`;
  }
  if (usernameEl) {
    usernameEl.innerHTML = `${escapeHtml(p.username || '')} <button class="edit-btn" onclick="editField('username')">✏</button>`;
  }

  const dobEl = document.getElementById('profile-dob');
  if (dobEl) dobEl.innerHTML = `${escapeHtml(p.dob || '—')} <button class="edit-btn" onclick="editField('basic')">✏</button>`;
  const sexEl = document.getElementById('profile-sex');
  if (sexEl) sexEl.innerHTML = `${escapeHtml(p.sex || '—')} <button class="edit-btn" onclick="editField('sex')">✏</button>`;

  const emailEl = document.getElementById('profile-email');
  if (emailEl) {
    emailEl.innerHTML = `${escapeHtml(p.email || '')} <button class="edit-btn" onclick="editField('email')">✏</button>`;
  }

  const lastChangedEl = document.getElementById('profile-last-changed');
  if (lastChangedEl) lastChangedEl.textContent = fmtProfileDate(p.updatedAt);
  const createdAtEl = document.getElementById('profile-created-at');
  if (createdAtEl) createdAtEl.textContent = fmtProfileDate(p.createdAt);

  const avatarEl = document.getElementById('profile-avatar');
  if (avatarEl) {
    if (p.avatarUrl) {
      avatarEl.innerHTML = `<img src="${p.avatarUrl}" alt="avatar" class="profile-avatar" />`;
    } else {
      const initials = (p.name || '?').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
      avatarEl.innerHTML = `<div class="profile-avatar">${initials}</div>`;
    }
  }

  const heroName = document.querySelector('.dashboard-hero h1');
  if (heroName) heroName.textContent = p.name || 'Welcome!';
}

function confirmDelete() {
  const content = `
    <h3 style="color:var(--danger);">⚠️ Delete Account</h3>
    <p style="margin-bottom:20px;color:#555;line-height:1.6;">This action is permanent and cannot be undone. All your data will be lost.</p>
    <p style="margin-bottom:20px;font-size:0.88rem;color:#888;">Type <strong>DELETE</strong> to confirm:</p>
    <div class="form-group"><input type="text" id="delete-confirm" placeholder="Type DELETE here" /></div>
    <button class="btn-primary" style="background:var(--danger);" onclick="doDeleteAccount()">Delete My Account</button>
  `;
  openModal(content);
}

async function doDeleteAccount() {
  const val = document.getElementById('delete-confirm').value;
  if (val !== 'DELETE') { showToast('Please type DELETE to confirm'); return; }
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    await supabase.from('profiles').delete().eq('id', user.id);
    await supabase.auth.signOut();
  }
  closeModal();
  showToast('Account deleted.');
}

function openDobPicker() {
  const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  const DAYS_H = ['S','M','T','W','T','F','S'];
  const today = new Date(); today.setHours(0,0,0,0);

  const existing = state.profile.dob;
  let dpDate, dpPending;
  if (existing) {
    const parts = existing.split('/');
    if (parts.length === 3) {
      dpPending = new Date(parseInt(parts[2]), parseInt(parts[0]) - 1, parseInt(parts[1]));
    } else {
      dpPending = new Date(existing + 'T00:00:00');
    }
    if (isNaN(dpPending)) dpPending = new Date(2000, 0, 1);
  } else {
    dpPending = new Date(2000, 0, 1);
  }
  dpDate = new Date(dpPending.getFullYear(), dpPending.getMonth(), 1);

  function fmt(d) {
    return `${String(d.getMonth()+1).padStart(2,'0')}/${String(d.getDate()).padStart(2,'0')}/${d.getFullYear()}`;
  }
  function fmtISO(d) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
  }
  function sameDP(a, b) {
    return a.getFullYear()===b.getFullYear()&&a.getMonth()===b.getMonth()&&a.getDate()===b.getDate();
  }

  function buildDobGrid() {
    const y = dpDate.getFullYear(), m = dpDate.getMonth();
    document.getElementById('dob-month-label').textContent = `${MONTHS[m]} ${y} ▾`;
    const inner = document.getElementById('dob-grid-inner');
    if (inner) inner.style.display = 'grid';
    const first = new Date(y, m, 1).getDay();
    const daysInMonth = new Date(y, m+1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();

    let html = DAYS_H.map(d => `<div class="dob-day-header">${d}</div>`).join('');

    for (let i = 0; i < 42; i++) {
      const day = i - first + 1;
      let cellDate, isCurrentMonth;
      if (day < 1) {
        cellDate = new Date(y, m-1, prevDays + day);
        isCurrentMonth = false;
      } else if (day > daysInMonth) {
        cellDate = new Date(y, m+1, day - daysInMonth);
        isCurrentMonth = false;
      } else {
        cellDate = new Date(y, m, day);
        isCurrentMonth = true;
      }

      const isSel = sameDP(cellDate, dpPending);
      const isToday = sameDP(cellDate, today);

      const classes = ['dob-day'];
      if (!isCurrentMonth) classes.push('other-month');
      if (isSel) classes.push('is-selected');
      else if (isToday) classes.push('is-today');

      const dateStr = fmtISO(cellDate);
      html += `<div style="text-align:center;">
        <div onclick="dobPickDate('${dateStr}')" class="${classes.join(' ')}">${cellDate.getDate()}</div>
      </div>`;
    }
    document.getElementById('dob-grid-inner').innerHTML = html;
  }

  window.dobPickDate = function(dateStr) {
    dpPending = new Date(dateStr + 'T00:00:00');
    dpDate = new Date(dpPending.getFullYear(), dpPending.getMonth(), 1);
    buildDobGrid();
  };
  window.dobMoveMonth = function(dir) {
    dpDate = new Date(dpDate.getFullYear(), dpDate.getMonth() + dir, 1);
    buildDobGrid();
  };
  window.dobOpenYearPicker = function() {
    const y = dpDate.getFullYear();
    const todayYr = new Date().getFullYear();
    const startYear = 1920;
    const endYear = todayYr + 5;
    document.getElementById('dob-month-label').textContent = `${MONTHS[dpDate.getMonth()]} ${y} ▲`;

    const inner = document.getElementById('dob-grid-inner');
    inner.style.display = 'block';

    let html = `<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:2px;max-height:220px;overflow-y:auto;">`;
    for (let yr = startYear; yr <= endYear; yr++) {
      const isSel = yr === y;
      const isThisYear = yr === todayYr;
      let btnStyle = `padding:10px 4px;border:none;border-radius:20px;cursor:pointer;font-size:14px;text-align:center;width:100%;box-sizing:border-box;`;
      if (isSel) {
        btnStyle += `background:#e8e8e8;color:#222;font-weight:700;`;
      } else if (isThisYear) {
        btnStyle += `background:transparent;color:#222;font-weight:700;`;
      } else {
        btnStyle += `background:transparent;color:#555;font-weight:400;`;
      }
      html += `<button onclick="dobSelectYear(${yr})" style="${btnStyle}">${yr}</button>`;
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
  window.dobSelectYear = function(yr) {
    dpDate = new Date(yr, dpDate.getMonth(), 1);
    dpPending = new Date(yr, dpPending.getMonth(), dpPending.getDate());
    buildDobGrid();
  };
  window.dobConfirm = async function() {
    const val = fmt(dpPending);
    state.profile.dob = val;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: prof } = await supabase.from('profiles')
        .update({ dob: val, updated_at: new Date().toISOString() })
        .eq('id', user.id)
        .select()
        .single();
      if (prof) {
        state.profile.sex = prof.sex || state.profile.sex || '';
        state.profile.name = [prof.first_name, prof.last_name].filter(Boolean).join(' ') || state.profile.name;
        state.profile.username = prof.username || state.profile.username;
        state.profile.email = prof.email || state.profile.email;
      }
    }
    updateProfileDisplay();
    closeModal();
    showToast('Date of birth updated!');
  };

  const content = `
    <div style="min-width:300px;padding-right:36px;">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:14px;">
        <span style="font-size:13px;color:#888;margin-right:auto;">Date of Birth</span>
        <button onclick="dobOpenYearPicker()" id="dob-month-label" style="background:none;border:none;font-size:14px;font-weight:600;cursor:pointer;padding:4px 6px;border-radius:6px;">Loading...</button>
        <button onclick="dobMoveMonth(-1)" style="background:#f1f5f9;border:none;cursor:pointer;font-size:18px;font-weight:700;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#333;">&#8249;</button>
        <button onclick="dobMoveMonth(1)"  style="background:#f1f5f9;border:none;cursor:pointer;font-size:18px;font-weight:700;width:30px;height:30px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;color:#333;">&#8250;</button>
      </div>
      <div id="dob-grid-inner" style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px;"></div>
      <div style="display:flex;justify-content:flex-end;gap:8px;margin-top:16px;padding-top:10px;border-top:1px solid #f0f4f8;">
        <button onclick="closeModal()" style="background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;padding:6px 14px;border-radius:6px;font-size:0.9rem;">Cancel</button>
        <button onclick="dobConfirm()" style="background:none;border:none;color:#1a73e8;font-weight:600;cursor:pointer;padding:6px 14px;border-radius:6px;font-size:0.9rem;">OK</button>
      </div>
    </div>
  `;
  openModal(content);
  setTimeout(() => buildDobGrid(), 30);
}
