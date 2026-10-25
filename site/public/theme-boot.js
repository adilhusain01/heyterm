// Sets the page's theme before it draws: the visitor's choice, else HeyTerm's own beige (light).
(function () {
  var saved;
  try {
    saved = localStorage.getItem("heyterm.site.theme");
  } catch (error) {}
  document.documentElement.dataset.theme = saved === "dark" ? "dark" : "light";
})();
