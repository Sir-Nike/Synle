// Apply the saved/device theme before styles paint. External for the production CSP.
(() => {
  let theme = "system";
  try {
    theme = localStorage.getItem("synle:theme") || "system";
  } catch {}
  const dark =
    theme === "dark" ||
    (theme !== "light" && matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", dark ? "#111925" : "#eef3fa");
})();
