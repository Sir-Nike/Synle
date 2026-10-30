export type Theme = "light" | "dark" | "system";
export function readTheme(): Theme {
  try {
    const saved = localStorage.getItem("synle:theme");
    if (saved === "light" || saved === "dark") return saved;
  } catch {
    /* Use device preference. */
  }
  return "system";
}
export function applyTheme(theme: Theme) {
  const dark =
    theme === "dark" ||
    (theme === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#111925" : "#eef3fa");
}
