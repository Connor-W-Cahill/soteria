// Apply the stored theme before first paint to avoid a flash. Kept as an
// external same-origin script (not inline) so the client CSP can use
// `script-src 'self'` with no inline allowance or hash (issue #81).
try {
  var t = localStorage.getItem("soteria-theme");
  if (t === "light" || t === "dark") {
    document.documentElement.dataset.theme = t;
  }
} catch {
  /* localStorage unavailable (private mode, disabled cookies) — ignore. */
}
