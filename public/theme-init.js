(() => {
  try {
    const key = "converge_theme_mode";
    const saved = localStorage.getItem(key);
    const mode = saved === "light" || saved === "dark" || saved === "system" ? saved : "system";
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = mode === "dark" || (mode === "system" && prefersDark) ? "dark" : "light";
    const root = document.documentElement;
    root.classList.remove("theme-light", "theme-dark");
    root.classList.add(resolved === "dark" ? "theme-dark" : "theme-light");
    root.style.colorScheme = resolved;
  } catch {}
})();
