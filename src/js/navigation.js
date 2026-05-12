// ===== PROFILE LOADER =====
async function loadOrCreateProfile(user) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  // Detect if this account was created via Google OAuth
  const identities = user.identities || [];
  state.profile.isOAuthAccount = identities.some(i => i.provider === 'google');

  if (existing) {
    state.profile.name = [existing.first_name, existing.last_name].filter(Boolean).join(' ') || user.email;
    state.profile.username = existing.username || ('@' + (user.email || '').split('@')[0]);
    state.profile.email = existing.email || user.email;
    state.profile.dob = existing.dob || '';
    state.profile.sex = existing.sex || '';
    state.profile.avatarUrl = existing.avatar_url || '';
    state.profile.createdAt = existing.created_at || '';
    state.profile.updatedAt = existing.updated_at || '';
    // Extended academic profile fields
    state.profile.school = existing.school || '';
    state.profile.course = existing.course || '';
    state.profile.yearLevel = existing.year_level || '';
    state.profile.semester = existing.semester || '';
    state.profile.academicYear = existing.academic_year || '';
    // Semester date ranges
    state.profile.sem1Start = existing.sem1_start || '';
    state.profile.sem1End = existing.sem1_end || '';
    state.profile.sem2Start = existing.sem2_start || '';
    state.profile.sem2End = existing.sem2_end || '';
    state.profile.midyearStart = existing.midyear_start || '';
    state.profile.midyearEnd = existing.midyear_end || '';
  } else {
    const meta = user.user_metadata || {};
    const firstName = meta.given_name || meta.first_name || meta.full_name?.split(' ')[0] || '';
    const lastName = meta.family_name || meta.last_name || meta.full_name?.split(' ').slice(1).join(' ') || '';
    const username = '@' + (user.email || '').split('@')[0];
    const avatarUrl = meta.avatar_url || meta.picture || '';

    await supabase.from('profiles').insert({
      id: user.id,
      first_name: firstName,
      last_name: lastName,
      username,
      email: user.email,
      avatar_url: avatarUrl,
    });

    state.profile.name = [firstName, lastName].filter(Boolean).join(' ') || user.email;
    state.profile.username = username;
    state.profile.email = user.email;
    state.profile.dob = '';
    state.profile.sex = '';
    state.profile.avatarUrl = avatarUrl;
    state.profile.sem1Start = '';
    state.profile.sem1End = '';
    state.profile.sem2Start = '';
    state.profile.sem2End = '';
    state.profile.midyearStart = '';
    state.profile.midyearEnd = '';
  }
}

// ===== SESSION RESTORE (runs after DOM is ready) =====
document.addEventListener('DOMContentLoaded', async () => {
  const appShell = document.getElementById('app-shell');

  // On standalone auth pages (login, signup) there is no app-shell.
  // After Google OAuth, Supabase redirects back here and fires SIGNED_IN.
  // Redirect to dashboard so the user lands in the app.
  if (!appShell) {
    supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.location.href = 'forgot-password.html';
        return;
      }
      if (event === 'SIGNED_IN' && session) {
        // Ensure profile row exists before navigating
        await loadOrCreateProfile(session.user);
        window.location.href = 'dashboard.html';
      }
    });
    return;
  }

  // Check if user is already logged in on page load (handles refresh)
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
      document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
      appShell.style.display = 'flex';
      await loadOrCreateProfile(session.user);
      updateProfileDisplay();
      initApp();
      syncActivitiesDropdown();
    }

  // Single listener handles all auth state transitions
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'PASSWORD_RECOVERY') {
      window.location.href = 'forgot-password.html';
      return;
    }

    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED')) {
      if (appShell.style.display !== 'flex') {
        document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
        appShell.style.display = 'flex';
        await loadOrCreateProfile(session.user);
        updateProfileDisplay();
        initApp();
        syncActivitiesDropdown();
      }
    } else if (event === 'SIGNED_OUT') {
      appShell.style.display = 'none';
      document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
      const login = document.getElementById('page-login');
      if (login) login.classList.add('active');
      state.tasks = [];
      state.exams = [];
      state.classes = [];
      state.events = [];
      state.profile = {
        name: '', username: '', email: '', dob: '', sex: '',
        avatarUrl: '', createdAt: '', updatedAt: '',
        school: '', course: '', yearLevel: '', semester: '', academicYear: '',
        sem1Start: '', sem1End: '', sem2Start: '', sem2End: '',
        midyearStart: '', midyearEnd: '',
      };
      state.selectedTaskId = null;
      state.selectedExamId = null;
    }
  });
});

// ===== PAGE NAVIGATION =====
// Note: showPage() and showAppPage() removed since app uses separate HTML files
// Each page is now standalone with its own HTML file

// ===== SIDEBAR =====
function toggleActivities() {
  state.activitiesOpen = !state.activitiesOpen;
  const sub = document.getElementById('activities-sub');
  const arrow = document.getElementById('activities-arrow');
  const nav = document.getElementById('activities-nav');
  sub.classList.toggle('open', state.activitiesOpen);
  if (arrow) arrow.classList.toggle('open', state.activitiesOpen);
  nav.classList.toggle('active', state.activitiesOpen);
}

function syncActivitiesDropdown() {
  const ACTIVITY_PAGES = new Set(['tasks.html', 'classes.html', 'exams.html', 'quiz.html']);
  const currentPage = window.location.pathname.split('/').pop();
  // Always keep dropdown open when on an activity page
  if (ACTIVITY_PAGES.has(currentPage)) {
    state.activitiesOpen = true;
  }
  const sub = document.getElementById('activities-sub');
  const arrow = document.getElementById('activities-arrow');
  const nav = document.getElementById('activities-nav');
  if (sub) sub.classList.toggle('open', state.activitiesOpen);
  if (arrow) arrow.classList.toggle('open', state.activitiesOpen);
  if (nav) nav.classList.toggle('active', state.activitiesOpen);
}

function toggleSidebar() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('topbar-menu-icon');
  sidebar.classList.toggle('open');
  const isOpen = sidebar.classList.contains('open');
  if (hamburger) hamburger.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
  let overlay = document.getElementById('sidebar-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    overlay.className = 'sidebar-overlay';
    overlay.onclick = closeSidebarMobile;
    document.body.appendChild(overlay);
  }
  overlay.classList.toggle('active', isOpen);
}

function closeSidebarMobile() {
  const sidebar = document.querySelector('.sidebar');
  const hamburger = document.getElementById('topbar-menu-icon');
  if (window.innerWidth <= 768) {
    sidebar.classList.remove('open');
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
    const overlay = document.getElementById('sidebar-overlay');
    if (overlay) overlay.classList.remove('active');
  }
}