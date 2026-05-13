(function () {
  const PUBLIC_PAGES = new Set([
    'login.html', 'signup.html', 'forgot-password.html',
    'landing-page.html', 'terms.html', 'index.html', '',
  ]);

  const currentPage = window.location.pathname.split('/').pop();
  if (PUBLIC_PAGES.has(currentPage)) return;

  document.documentElement.style.visibility = 'hidden';

  (async function checkAuth() {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();

      if (error || !user) {
        const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.replace('login.html?returnTo=' + returnTo);
        return;
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('is_archived')
        .eq('id', user.id)
        .maybeSingle();

      if (profile?.is_archived) {
        await supabase.auth.signOut();
        window.location.replace('login.html?reason=archived');
        return;
      }

      document.documentElement.style.visibility = '';
    } catch (err) {
      window.location.replace('login.html');
    }
  })();
})();