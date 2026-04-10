(() => {
  const NAV_SUPABASE_URL = "https://wljgcwxoevnbnaauzrrk.supabase.co";
  const NAV_SUPABASE_KEY = "sb_publishable_1u_6ELWHXiN7J1LvG2qLvQ_AI-kojbJ";

  const navSupabaseClient = supabase.createClient(NAV_SUPABASE_URL, NAV_SUPABASE_KEY);

  const navMenuToggle = document.getElementById("navMenuToggle");
  const navMenu = document.getElementById("navMenu");
  const navUserName = document.getElementById("navUserName");
  const navLogoutBtn = document.getElementById("navLogoutBtn");

  function setMenuOpen(isOpen) {
    if (!navMenuToggle || !navMenu) return;
    navMenu.hidden = !isOpen;
    navMenuToggle.setAttribute("aria-expanded", String(isOpen));
  }

  navMenuToggle?.addEventListener("click", (event) => {
    event.stopPropagation();
    setMenuOpen(navMenu.hidden);
  });

  document.addEventListener("click", (event) => {
    if (!navMenu || !navMenuToggle || navMenu.hidden) return;

    const clickedInsideMenu = navMenu.contains(event.target);
    const clickedToggle = navMenuToggle.contains(event.target);

    if (!clickedInsideMenu && !clickedToggle) {
      setMenuOpen(false);
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setMenuOpen(false);
    }
  });

  navLogoutBtn?.addEventListener("click", async () => {
    try {
      await navSupabaseClient.auth.signOut();
      window.location.href = "index.html";
    } catch (error) {
      console.error("NAV LOGOUT ERROR:", error);
      alert("Feil ved utlogging.");
    }
  });

  (async function initNav() {
    try {
      const { data, error } = await navSupabaseClient.auth.getSession();

      if (error) throw error;

      const currentPath = window.location.pathname.split("/").pop() || "index.html";
      const isIndexPage = currentPath === "index.html" || currentPath === "";

      if (!data?.session) {
        if (!isIndexPage) {
          window.location.href = "index.html";
        }
        return;
      }

      const { data: profile, error: profileError } = await navSupabaseClient
        .from("profiles")
        .select("full_name")
        .eq("id", data.session.user.id)
        .maybeSingle();

      if (profileError) throw profileError;

      if (navUserName) {
        navUserName.textContent = profile?.full_name || data.session.user.email || "Ukjent bruker";
      }
    } catch (error) {
      console.error("NAV INIT ERROR:", error);
    }
  })();
})();