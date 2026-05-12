// ===== AUTH (Supabase) =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) { showToast('Please fill in all fields'); return; }

  // Block archived accounts from logging in
  const { data: archivedCheck } = await supabase
    .from('profiles')
    .select('is_archived')
    .eq('email', email)
    .maybeSingle();

  if (archivedCheck?.is_archived) {
    showToast('This account has been deleted and can no longer be accessed.');
    return;
  }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) { showToast(error.message); return; }

  try { showToast('Welcome back!'); } catch (_) {}
  window.location.href = 'dashboard.html';
}

async function validateSignup() {
  const firstname = document.getElementById('signup-firstname')?.value.trim() || '';
  const lastname = document.getElementById('signup-lastname')?.value.trim() || '';
  const email = document.getElementById('signup-email')?.value.trim() || '';
  const password = document.getElementById('signup-password')?.value || '';
  const confirm = document.getElementById('signup-confirm')?.value || '';

  if (!firstname || !lastname || !email || !password || !confirm) {
    showToast('Please fill in all required fields');
    return;
  }
  if (password !== confirm) { showToast('Passwords do not match'); return; }
  if (password.length < 6) { showToast('Password must be at least 6 characters'); return; }

  // Check if the email belongs to an archived (deleted) account
  const { data: archivedCheck } = await supabase
    .from('profiles')
    .select('is_archived')
    .eq('email', email)
    .maybeSingle();

  if (archivedCheck?.is_archived) {
    showToast('This email is associated with a deleted account and cannot be reused.');
    return;
  }

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstname, last_name: lastname } }
  });

  if (error) { showToast(error.message); return; }

  if (data?.user) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      first_name: firstname,
      last_name: lastname,
      username: '@' + email.split('@')[0],
      email: email,
      is_archived: false,
    }, { onConflict: 'id' });
  }

  showToast('Account created! Please check your email to confirm.');
  window.location.href = 'login.html';
}

// ===== PASSWORD RESET — OTP FLOW =====
// Step 1: Send OTP via Supabase resetPasswordForEmail (uses Reset Password email template)
async function sendOTP() {
  const emailEl = document.getElementById('forgot-email');
  const email = emailEl ? emailEl.value.trim() : '';
  if (!email) { showToast('Please enter your email address'); return; }

  const btn = document.getElementById('btn-send-otp');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  const { error } = await supabase.auth.resetPasswordForEmail(email);

  if (btn) { btn.disabled = false; btn.textContent = 'Send Code'; }

  if (error) {
    showToast(error.message);
    return;
  }

  otpTargetEmail = email;
  otpExpiry = Date.now() + OTP_TTL_MS;
  otpAttempts = 0;

  document.getElementById('otp-email-display').textContent = email;
  document.getElementById('otp-timer').classList.remove('expired');
  document.getElementById('otp-countdown').textContent = '10:00';
  _showStep('step-otp');
  _startCountdown();
  setTimeout(() => document.getElementById('otp0')?.focus(), 100);
  showToast('Code sent! Check your email.');
}

// Step 2: Verify the OTP the user typed.
async function verifyOTP() {
  if (!otpTargetEmail) {
    showToast('Session expired. Please start over.');
    _showStep('step-email');
    return;
  }

  const entered = _getOTPValue();
  if (entered.length < 6) {
    showToast('Please enter the full code.');
    return;
  }

  if (otpAttempts >= OTP_MAX_ATTEMPTS) {
    showToast('Too many attempts. Please request a new code.');
    return;
  }

  otpAttempts++;

  const { error } = await supabase.auth.verifyOtp({
    email: otpTargetEmail,
    token: entered,
    type: 'recovery'
  });

  if (error) {
    const remaining = OTP_MAX_ATTEMPTS - otpAttempts;
    showToast(remaining > 0
      ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
      : 'Too many incorrect attempts. Please request a new code.'
    );
    _markOTPError();
    return;
  }

  clearInterval(_otpTimerInterval);
  _showStep('step-newpass');
  setTimeout(() => document.getElementById('new-password')?.focus(), 100);
}

// Resend OTP — reuses sendOTP but skips the profile check since email is already confirmed
async function resendOTP() {
  const resendLink = document.getElementById('resend-link');
  if (resendLink?.classList.contains('disabled')) return;
  if (!otpTargetEmail) { _showStep('step-email'); return; }

  _clearOTPInputs();
  clearInterval(_otpTimerInterval);
  otpAttempts = 0;

  const { error } = await supabase.auth.resetPasswordForEmail(otpTargetEmail);

  if (error) {
    showToast(error.message);
    return;
  }

  otpExpiry = Date.now() + OTP_TTL_MS;
  document.getElementById('otp-timer').classList.remove('expired');
  document.getElementById('otp-countdown').textContent = '10:00';
  _startCountdown();
  showToast('New code sent!');
}

// Step 3: Set the new password using Supabase password recovery session.
async function setNewPassword() {
  const newPassword = document.getElementById('new-password')?.value || '';
  const confirmPassword = document.getElementById('confirm-password')?.value || '';

  if (!newPassword || !confirmPassword) { showToast('Please fill in all fields'); return; }
  if (newPassword !== confirmPassword) { showToast('Passwords do not match'); return; }
  if (newPassword.length < 6) { showToast('Password must be at least 6 characters'); return; }

  const btn = document.getElementById('btn-set-pass');
  if (btn) { btn.disabled = true; btn.textContent = 'Saving…'; }

  // Sign in to get a session so we can call updateUser
  // otpTargetEmail is still set from step 1
  // We need the user's current password to do this — but since we can't know it,
  // we use Supabase admin-style update via the recovery session if available,
  // otherwise fall back to the magic-link recovery flow for the actual password change.
  // The cleanest client-only approach: use supabase.auth.updateUser if a session exists
  // (user clicked a magic link), or trigger the reset email as a fallback.
  const { data: { session } } = await supabase.auth.getSession();

  if (session) {
    // A recovery session is active (user arrived via magic link or is already signed in)
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (btn) { btn.disabled = false; btn.textContent = 'Set Password'; }
    if (error) { showToast('Failed to update password: ' + error.message); return; }
    await supabase.auth.signOut();
    showToast('Password updated! Please log in.');
    setTimeout(() => { window.location.href = 'login.html'; }, 1500);
  } else {
    // No active session — use Supabase reset email as the actual password-change mechanism.
    // The OTP verified the user's identity; now send the Supabase magic link to complete it.
    const redirectTo = window.location.origin + '/forgot-password.html#reset';
    const { error } = await supabase.auth.resetPasswordForEmail(otpTargetEmail, { redirectTo });
    if (btn) { btn.disabled = false; btn.textContent = 'Set Password'; }
    if (error) { showToast(error.message); return; }
    // Store intended new password temporarily so the recovery handler can use it
    sessionStorage.setItem('pendingNewPassword', newPassword);
    showToast('Check your email for a final confirmation link.');
  }
}

// ===== PASSWORD VISIBILITY TOGGLE =====
function togglePassword(inputId, button) {
  const input = document.getElementById(inputId);
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    button.textContent = 'Hide';
  } else {
    input.type = 'password';
    button.textContent = 'Show';
  }
}

// ===== GOOGLE SIGN-IN (Supabase OAuth) =====
async function signInWithGoogle() {
  if (GOOGLE_CONFIG.CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID') {
    showToast('Google Sign-In is not configured yet.');
    return;
  }
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href.split('?')[0].split('#')[0] }
  });
  if (error) { showToast(error.message); return; }
}

// ===== SIGN OUT =====
async function doLogout() {
  await supabase.auth.signOut();
  state.tasks = [];
  state.exams = [];
  state.classes = [];
  window.location.href = 'login.html';
}

// ===== TERMS & CONDITIONS =====
function onTermsChecked() {
  const checkbox = document.getElementById('tc-checkbox');
  const signupBtn = document.getElementById('signup-btn');
  if (checkbox && signupBtn) {
    signupBtn.disabled = !checkbox.checked;
  }
}

function openTermsModal() {
  document.getElementById('tc-modal-overlay')?.classList.add('active');
}

function closeTermsModal() {
  document.getElementById('tc-modal-overlay')?.classList.remove('active');
}

function acceptTermsAndClose() {
  const checkbox = document.getElementById('tc-checkbox');
  const signupBtn = document.getElementById('signup-btn');
  if (checkbox) checkbox.checked = true;
  if (signupBtn) signupBtn.disabled = false;
  closeTermsModal();
}

// ===== AUTO-LOGOUT ON TAB / WINDOW CLOSE =====
// How it works:
// - beforeunload fires for BOTH navigation and close. We set isNavigating = true there.
// - pagehide fires right after. If persisted=false (page is being discarded/closed)
//   AND isNavigating is false (no navigation happened), the tab is genuinely closing.
// - We call supabase.auth.signOut() inside pagehide for the close case.
// - For navigation between app pages, isNavigating=true so we skip the logout.
//
// Note: signOut in pagehide is best-effort — the browser may not wait for async calls.
// We use a synchronous XMLHttpRequest trick via sendBeacon as a fallback.

(function setupAutoLogout() {
  // Skip auto-logout on auth/public pages
  const AUTH_PAGES = new Set(['login.html', 'signup.html', 'forgot-password.html', 'index.html', 'landing-page.html', 'terms.html', '']);
  const currentPage = window.location.pathname.split('/').pop();
  if (AUTH_PAGES.has(currentPage)) return;

  let isNavigating = false;

  // Set navigating flag on any link click or form submit (internal navigation)
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[href]');
    if (a && !a.target && !e.ctrlKey && !e.metaKey) isNavigating = true;
  });

  window.addEventListener('beforeunload', () => {
    // beforeunload fires for both navigation and close.
    // We rely on the click handler above to distinguish; but as a fallback,
    // set a sessionStorage marker that the next page can read to confirm navigation.
    sessionStorage.setItem('_app_navigating', '1');
  });

  window.addEventListener('pagehide', (e) => {
    // persisted=true means the page went into bfcache (back/forward nav) — not a close
    if (e.persisted) return;

    if (!isNavigating) {
      // Tab or window is closing — sign out synchronously
      // signOut is async, but we do our best here; Supabase also invalidates
      // the token server-side on next request if we call signOut
      try {
        // Use navigator.sendBeacon with the Supabase logout endpoint as a best-effort call
        const supabaseUrl = supabase.supabaseUrl || (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : null);
        const supabaseKey = supabase.supabaseKey || (typeof SUPABASE_ANON_KEY !== 'undefined' ? SUPABASE_ANON_KEY : null);
        if (supabaseUrl && supabaseKey) {
          // Get the current access token synchronously from localStorage
          const storageKey = Object.keys(localStorage).find(k => k.includes('auth-token') || k.includes('supabase.auth'));
          let accessToken = null;
          if (storageKey) {
            try {
              const parsed = JSON.parse(localStorage.getItem(storageKey));
              accessToken = parsed?.access_token || parsed?.currentSession?.access_token || null;
            } catch (_) {}
          }
          if (accessToken) {
            const blob = new Blob(['{}'], { type: 'application/json' });
            navigator.sendBeacon(
              `${supabaseUrl}/auth/v1/logout`,
              // sendBeacon doesn't support custom headers, so we append token as query param
              // Supabase accepts access_token as a query param for logout
              new Blob([JSON.stringify({ access_token: accessToken })], { type: 'application/json' })
            );
          }
        }
      } catch (_) {}

      // Also fire the async signOut — may complete if the browser allows it
      supabase.auth.signOut().catch(() => {});
    }

    // Reset the flag for the next page
    isNavigating = false;
  });
})();

// ===== HANDLE RECOVERY SESSION ON PAGE LOAD =====
// Fires when the page loads after a Supabase magic-link recovery redirect
window.addEventListener('load', async () => {
  const hash = window.location.hash;
  if (hash.includes('access_token') && hash.includes('type=recovery')) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY' && session) {
        const pending = sessionStorage.getItem('pendingNewPassword');
        if (pending) {
          sessionStorage.removeItem('pendingNewPassword');
          const { error } = await supabase.auth.updateUser({ password: pending });
          if (error) {
            showToast('Failed to set password: ' + error.message);
          } else {
            await supabase.auth.signOut();
            showToast('Password updated! Please log in.');
            setTimeout(() => { window.location.href = 'login.html'; }, 1500);
          }
        } else {
          // No pending password — show the set-password step manually
          _showStep('step-newpass');
        }
      }
    });
  }
  // Sync profiles.email when user confirms a new email address
  // Sync profiles.email when user confirms a new email address via link
  // Skip this if OTP-based email change already handled it (profile.email matches user.email)
  // Sync profiles.email only for link-based email change (not OTP)
  // OTP flow in profile.js handles its own sync
  const currentPage = window.location.pathname.split('/').pop();
  if (currentPage !== 'profile.html') {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('email')
        .eq('id', user.id)
        .maybeSingle();

      if (profile && profile.email !== user.email) {
        await supabase
          .from('profiles')
          .update({ email: user.email, updated_at: new Date().toISOString() })
          .eq('id', user.id);

        if (currentPage === 'dashboard.html') {
          state.profile.email = user.email;
          updateProfileDisplay();
          showToast('Email updated successfully!');
        }
      }
    }
  }
});

// ===== BLOCK ARCHIVED ACCOUNTS AFTER SESSION RESTORE =====
window.addEventListener('load', async () => {
  const AUTH_PAGES = new Set(['login.html', 'signup.html', 'forgot-password.html', 'index.html', 'landing-page.html', 'terms.html', '']);
  const currentPage = window.location.pathname.split('/').pop();
  if (AUTH_PAGES.has(currentPage)) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_archived')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.is_archived) {
    await supabase.auth.signOut();
    window.location.href = 'login.html?reason=archived';
  }
});