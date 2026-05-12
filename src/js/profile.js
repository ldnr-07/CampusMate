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

  if (field === 'email') {
    if (state.profile.isOAuthAccount) {
      showToast('Email is managed by Google and cannot be changed here.');
      return;
    }
    const content = `
      <h3>Change Email</h3>
      <p style="margin-bottom:16px;color:#666;font-size:0.88rem;line-height:1.5;">
        A 6-digit code will be sent to your new email address to confirm the change.
      </p>
      <div class="form-group">
        <label>New Email Address</label>
        <input type="email" id="edit-field-val" placeholder="newemail@example.com" autocomplete="email" />
      </div>
      <button class="btn-primary" onclick="sendEmailChangeOTP()">Send Code</button>
    `;
    openModal(content);
    return;
  }

  if (field === 'password') {
    if (state.profile.isOAuthAccount) {
      showToast('Password cannot be changed for Google accounts.');
      return;
    }
    const content = `
      <h3>Change Password</h3>
      <div class="form-group">
        <label>Current Password</label>
        <input type="password" id="edit-current-password" placeholder="Enter current password" autocomplete="current-password" />
      </div>
      <div class="form-group">
        <label>New Password</label>
        <input type="password" id="edit-new-password" placeholder="Enter new password" autocomplete="new-password" />
      </div>
      <div class="form-group">
        <label>Confirm New Password</label>
        <input type="password" id="edit-confirm-password" placeholder="Confirm new password" autocomplete="new-password" />
      </div>
      <button class="btn-primary" onclick="saveEdit('password')">Update Password</button>
    `;
    openModal(content);
    return;
  }

  const fieldMap = {
    name: { label: 'Full Name', placeholder: 'John M. Doe' },
    username: { label: 'Username', placeholder: '@j4221' },
  };

  const f = fieldMap[field] || { label: field, placeholder: '' };
  const currentVal = state.profile[field] || '';
  const content = `
    <h3>Edit ${f.label}</h3>
    <div class="form-group">
      <label>${f.label}</label>
      <input type="text" id="edit-field-val" placeholder="${f.placeholder}" value="${escapeHtml(currentVal)}" />
    </div>
    <button class="btn-primary" onclick="saveEdit('${field}')">Save Changes</button>
  `;
  openModal(content);
}

async function saveEdit(field) {

  // ── PASSWORD ──────────────────────────────────────────────────────────────
  if (field === 'password') {
    const currentPw  = (document.getElementById('edit-current-password')  || {}).value || '';
    const newPw      = (document.getElementById('edit-new-password')       || {}).value || '';
    const confirmPw  = (document.getElementById('edit-confirm-password')   || {}).value || '';

    if (!currentPw)  { showToast('Please enter your current password'); return; }
    if (!newPw)      { showToast('Please enter a new password'); return; }
    if (newPw.length < 6) { showToast('New password must be at least 6 characters'); return; }
    if (newPw !== confirmPw) { showToast('New passwords do not match'); return; }

    // Re-authenticate with current password to verify it before changing
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Not logged in'); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPw,
    });
    if (signInErr) { showToast('Current password is incorrect'); return; }

    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) { showToast('Failed to update password: ' + error.message); return; }

    const now = new Date().toISOString();
    state.profile.updatedAt = now;
    await supabase.from('profiles').update({ updated_at: now }).eq('id', user.id);
    updateProfileDisplay();
    closeModal();
    showToast('Password updated!');
    return;
  }

  // ── EMAIL ─────────────────────────────────────────────────────────────────
  // ── EMAIL — handled by sendEmailChangeOTP / verifyEmailChangeOTP ──────────
  if (field === 'email') return;

  // ── OTHER FIELDS ──────────────────────────────────────────────────────────
  const input = document.getElementById('edit-field-val');
  const newValue = input ? input.value.trim() : '';

  if (!newValue) { showToast('Please enter a value'); return; }

  const updatePayload = {};
  if (field === 'name') {
    state.profile.name = newValue;
    const parts = newValue.trim().split(' ');
    updatePayload.first_name = parts[0] || '';
    updatePayload.last_name  = parts.slice(1).join(' ') || '';
  } else if (field === 'username') {
    state.profile.username = newValue;
    updatePayload.username = newValue;
  } else if (field === 'sex') {
    state.profile.sex = newValue;
    updatePayload.sex = newValue;
  } else {
    state.profile[field] = newValue;
    updatePayload[field] = newValue;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('Not logged in'); return; }

  const { error } = await supabase
    .from('profiles')
    .update({ ...updatePayload, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (error) {
    showToast('Failed to save: ' + error.message);
    return;
  }

  updateProfileDisplay();
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

  // Update only the text node, leaving the hardcoded edit buttons intact
  function setText(el, value) {
    if (!el) return;
    // Replace first text node only, keep child elements (buttons)
    const nodes = Array.from(el.childNodes);
    const textNode = nodes.find(n => n.nodeType === Node.TEXT_NODE);
    if (textNode) {
      textNode.textContent = value;
    } else {
      el.insertBefore(document.createTextNode(value), el.firstChild);
    }
  }

  setText(document.getElementById('profile-name-display'),     p.name     || '—');
  setText(document.getElementById('profile-username-display'), p.username || '—');

  const dobEl = document.getElementById('profile-dob');
  setText(dobEl, (p.dob || '—') + ' ');
  const sexEl = document.getElementById('profile-sex');
  setText(sexEl, (p.sex || '—') + ' ');
  const emailEl = document.getElementById('profile-email');
  setText(emailEl, (p.email || '—') + ' ');

  const lastChangedEl = document.getElementById('profile-last-changed');
  if (lastChangedEl) lastChangedEl.textContent = fmtProfileDate(p.updatedAt);
  const createdAtEl = document.getElementById('profile-created-at');
  if (createdAtEl) createdAtEl.textContent = fmtProfileDate(p.createdAt);

  // Hide email and password edit buttons for Google/OAuth accounts
  const emailEl2 = document.getElementById('profile-email');
  const emailEditBtn = emailEl2 ? emailEl2.querySelector('.edit-btn') : null;
  const passwordRow = document.querySelector('.info-row .edit-btn[aria-label="Change password"]');
  if (p.isOAuthAccount) {
    if (emailEditBtn) emailEditBtn.style.display = 'none';
    if (passwordRow) passwordRow.style.display = 'none';
  } else {
    if (emailEditBtn) emailEditBtn.style.display = '';
    if (passwordRow) passwordRow.style.display = '';
  }

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
    <p style="margin-bottom:16px;color:#555;line-height:1.6;">This action is <strong>permanent and cannot be undone</strong>. Your account will be archived and you will not be able to sign in or create a new account with this email.</p>
    <p style="margin-bottom:20px;font-size:0.88rem;color:#888;">Type <strong>DELETE</strong> to confirm:</p>
    <div class="form-group"><input type="text" id="delete-confirm" placeholder="Type DELETE here" /></div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="btn-secondary" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn-primary" style="background:var(--danger);flex:1;" onclick="doDeleteAccount()">Delete My Account</button>
    </div>
  `;
  openModal(content);
}

async function doDeleteAccount() {
  const val = document.getElementById('delete-confirm').value;
  if (val !== 'DELETE') { showToast('Please type DELETE to confirm'); return; }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) { showToast('Not logged in'); return; }

  // Archive the profile instead of deleting — preserves the email so it
  // cannot be reused, and blocks future logins from this account.
  const { error: archiveError } = await supabase
    .from('profiles')
    .update({ is_archived: true, updated_at: new Date().toISOString() })
    .eq('id', user.id);

  if (archiveError) {
    showToast('Failed to delete account: ' + archiveError.message);
    return;
  }

  await supabase.auth.signOut();
  closeModal();
  showToast('Account deleted.');
  setTimeout(() => { window.location.href = 'login.html'; }, 1500);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { showToast('Not logged in'); return; }

    const { error } = await supabase
      .from('profiles')
      .update({ dob: val, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (error) { showToast('Failed to save: ' + error.message); return; }

    state.profile.dob = val;
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

let _pendingNewEmail = null;
let _pendingUserId = null;

async function sendEmailChangeOTP() {
  const input = document.getElementById('edit-field-val');
  const newEmail = input ? input.value.trim() : '';

  if (!newEmail) { showToast('Please enter a new email address'); return; }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) { showToast('Please enter a valid email address'); return; }
  if (newEmail === state.profile.email) { showToast('That is already your current email'); return; }

  // Check if the new email is already used or archived
  const { data: existing } = await supabase
    .from('profiles')
    .select('id, is_archived')
    .eq('email', newEmail)
    .maybeSingle();

  if (existing?.is_archived) {
    showToast('This email belongs to a deleted account and cannot be used.');
    return;
  }
  if (existing?.id) {
    showToast('This email is already in use by another account.');
    return;
  }

  const { data: { user: currentUser } } = await supabase.auth.getUser();
  if (!currentUser) { showToast('Not logged in'); return; }
  _pendingUserId = currentUser.id;

  const { error } = await supabase.auth.updateUser({ email: newEmail });
  if (error) { showToast('Failed to send code: ' + error.message); return; }

  _pendingNewEmail = newEmail;

  // Show OTP entry step inside the modal
  const content = `
    <h3>Enter Verification Code</h3>
    <p style="margin-bottom:16px;color:#666;font-size:0.88rem;line-height:1.5;">
      A 6-digit code was sent to <strong>${newEmail}</strong>. Enter it below.
    </p>
    <div class="form-group">
      <label>Verification Code</label>
      <input type="text" id="email-change-otp" placeholder="Enter 6-digit code" maxlength="6" inputmode="numeric" />
    </div>
    <div style="display:flex;gap:10px;margin-top:8px;">
      <button class="btn-secondary" onclick="closeModal()" style="flex:1;">Cancel</button>
      <button class="btn-primary" onclick="verifyEmailChangeOTP()" style="flex:1;">Confirm</button>
    </div>
  `;
  openModal(content);
  showToast('Code sent! Check your new email.');
}

async function verifyEmailChangeOTP() {
  const otpInput = document.getElementById('email-change-otp');
  const token = otpInput ? otpInput.value.trim() : '';

  if (token.length < 6) { showToast('Please enter the full 6-digit code'); return; }
  if (!_pendingNewEmail) { showToast('Session expired. Please try again.'); closeModal(); return; }
  if (!_pendingUserId)   { showToast('Session error. Please try again.');   closeModal(); return; }

  // verifyOtp returns the new session directly when email_change OTP is confirmed.
  // Using the session from the response is the only reliable way to get the
  // updated user — getUser() and refreshSession() can still return stale data.
  const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
    email: _pendingNewEmail,
    token,
    type: 'email_change'
  });

  if (verifyError) {
    showToast('Invalid or expired code. Please try again.');
    console.error('Verify error:', verifyError.message);
    return;
  }

  // verifyOtp returns { data: { user, session } } on success
  const freshUserId = verifyData?.user?.id || verifyData?.session?.user?.id || _pendingUserId;
  const newEmail = _pendingNewEmail;

  // Sync profiles table
  const { error: updateError } = await supabase
    .from('profiles')
    .update({ email: newEmail, updated_at: new Date().toISOString() })
    .eq('id', freshUserId);

  if (updateError) {
    showToast('Failed to update profile: ' + updateError.message);
    console.error('Profile update error:', updateError.message);
    return;
  }

  state.profile.email = newEmail;
  _pendingNewEmail = null;
  _pendingUserId = null;

  updateProfileDisplay();
  closeModal();
  showToast('Email updated successfully!');
}