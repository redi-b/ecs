export async function changeOperationsTheme(setTheme: (theme: string) => void, nextTheme: string) {
  if (
    typeof document === "undefined" ||
    typeof document.documentElement.animate !== "function" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  ) {
    setTheme(nextTheme);
    return;
  }

  let themeChanged = false;
  try {
    const root = document.documentElement;
    await root.animate([{ opacity: 1 }, { opacity: 0.82 }], {
      duration: 110,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    }).finished;
    setTheme(nextTheme);
    themeChanged = true;
    await root.animate([{ opacity: 0.82 }, { opacity: 1 }], {
      duration: 190,
      easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      fill: "forwards",
    }).finished;
  } catch {
    if (!themeChanged) setTheme(nextTheme);
  }
}
