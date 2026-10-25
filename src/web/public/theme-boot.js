// Sets the theme before the page draws, with the rule in src/web/state/theme-choice.ts.
(function () {
  var preference;
  try {
    preference = JSON.parse(localStorage.getItem("heyterm.layout") || "{}").theme;
  } catch (error) {}
  var dark = preference === "dark" || (preference === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
})();
