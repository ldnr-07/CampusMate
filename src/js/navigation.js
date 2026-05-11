// ===== PROFILE LOADER =====
async function loadOrCreateProfile(user) {
  const { data: existing } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (existing) {
    state.profile.name = [existing.first_name, existing.last_name].filter(Boolean).join(' ') || user.email;
    state.profile.username = existing.username || ('@' + (user.email || '').split('@')[0]);
    state.profile.email = existing.email || user.email;
    state.profile.dob = existing.dob || '';
    state.profile.sex = existing.sex || '';
    state.profile.avatarUrl = existing.avatar_url || '';
    state.profile.createdAt = existing.created_at || '';
    state.profile.updatedAt = existing.updated_at || '';
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
  }
}

// ===== SESSION RESTORE (runs after DOM is ready) =====
document.addEventListener('DOMContentLoaded', () => {
  supabase.auth.onAuthStateChange(async (event, session) => {
    const appShell = document.getElementById('app-shell');
    if (session && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
      if (appShell && appShell.style.display !== 'flex') {
        document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
        appShell.style.display = 'flex';
        await loadOrCreateProfile(session.user);
        showAppPage('page-dashboard');
        initApp();
      }
    } else if (event === 'SIGNED_OUT') {
      if (appShell) appShell.style.display = 'none';
      document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
      const login = document.getElementById('page-login');
      if (login) login.classList.add('active');
      state.tasks = [];
      state.exams = [];
      state.classes = [];
      state.events = [];
      state.profile = { name:'', username:'', email:'', dob:'', sex:'', avatarUrl:'', createdAt:'', updatedAt:'' };
      state.selectedTaskId = null;
      state.selectedExamId = null;
    }
  });
});

// ===== PAGE NAVIGATION =====
function showPage(pageId) {
  closeModal();
  document.querySelectorAll('.auth-page').forEach(p => p.classList.remove('active'));
  const appShell = document.getElementById('app-shell');

  if (['page-dashboard','page-calendar','page-tasks','page-classes','page-exam','page-quiz','page-profile'].includes(pageId)) {
    appShell.style.display = 'flex';
    showAppPage(pageId);
    updateCounts();
  } else {
    appShell.style.display = 'none';
    const target = document.getElementById(pageId);
    if (target) target.classList.add('active');
  }
  state.currentPage = pageId;
}

function showAppPage(pageId) {
  document.querySelectorAll('.app-page').forEach(p => p.classList.remove('active'));
  const target = document.getElementById(pageId);
  if (target) target.classList.add('active');
  state.currentPage = pageId;

  const sub = document.getElementById('activities-sub');
  const arrow = document.getElementById('activities-arrow');
  const nav = document.getElementById('activities-nav');
  if (sub) sub.classList.toggle('open', state.activitiesOpen);
  if (arrow) arrow.classList.toggle('open', state.activitiesOpen);
  if (nav) nav.classList.toggle('active', state.activitiesOpen);

  // Update nav active state
  document.querySelectorAll('.nav-item, .nav-sub-item').forEach(n => n.classList.remove('active'));
  const navMap = {
    'page-dashboard': '[data-page="page-dashboard"]',
    'page-calendar': '[data-page="page-calendar"]',
    'page-tasks': '[data-page="page-tasks"]',
    'page-classes': '[data-page="page-classes"]',
    'page-exam': '[data-page="page-exam"]',
    'page-quiz': '[data-page="page-quiz"]',
    'page-profile': '.avatar-btn',
  };
  if (navMap[pageId]) {
    const navEl = document.querySelector(navMap[pageId]);
    if (navEl) navEl.classList.add('active');
  }

  // Render page content
  if (pageId === 'page-dashboard') renderClasses();
  if (pageId === 'page-classes') {
    // Ensure tab buttons match the current clsTab state
    const currentBtn = document.getElementById('cls-tab-current');
    const pastBtn = document.getElementById('cls-tab-past');
    if (currentBtn && pastBtn) {
      currentBtn.style.background = clsTab === 'current' ? 'var(--blue)' : 'transparent';
      currentBtn.style.color = clsTab === 'current' ? '#fff' : 'var(--blue)';
      pastBtn.style.background = clsTab === 'past' ? 'var(--blue)' : 'transparent';
      pastBtn.style.color = clsTab === 'past' ? '#fff' : 'var(--blue)';
    }
    renderClassSchedule();
  }
  if (pageId === 'page-calendar') renderCalendar();
  if (pageId === 'page-tasks') renderTasks();
  if (pageId === 'page-exam') renderExams();
  if (pageId === 'page-profile') updateProfileDisplay();
  if (pageId === 'page-quiz') initQuizPage();

  // Show/hide datetime on calendar page
  const datetimeEl = document.getElementById('topbar-datetime');
  if (datetimeEl) {
    datetimeEl.classList.toggle('hidden', pageId === 'page-calendar');
  }

  closeSidebarMobile();
}

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
