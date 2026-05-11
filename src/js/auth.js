// ===== AUTH (Supabase) =====
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-password').value;
  if (!email || !pass) { showToast('Please fill in all fields'); return; }

  const { data, error } = await supabase.auth.signInWithPassword({ email, password: pass });
  if (error) { showToast(error.message); return; }

  showToast('Welcome back!');
  showPage('page-dashboard');
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
    }, { onConflict: 'id' });
  }

  showToast('Account created! Please check your email to confirm.');
  showPage('page-login');
}

// ===== PASSWORD RESET (Supabase) =====
async function sendOTP() {
  const email = document.getElementById('forgot-email')?.value.trim() || '';
  if (!email) { showToast('Please enter your email address'); return; }

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin
  });

  if (error) { showToast(error.message); return; }

  showToast('Password reset email sent! Check your inbox.');
  showPage('page-login');
}

function verifyOTP() {
  showToast('Check your email for the reset link.');
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
  showPage('page-login');
  showToast('Logged out');
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
