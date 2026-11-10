// Maintained dashboard variants of gabriellebenak-arch/staffbase-dashboard-demo.
(function () {
  var params = new URLSearchParams(location.search);
  var requestedLocale = params.get("locale");
  function supportedLocale(value) {
    try {
      var canonical = Intl.getCanonicalLocales(value.replace(/_/g, "-"))[0];
      return canonical && /^(en|de|fr|es|nl|ja)(-|$)/.test(canonical) ? canonical : undefined;
    } catch (error) {
      if (!(error instanceof RangeError)) throw error;
      return undefined;
    }
  }
  var locale = requestedLocale ? supportedLocale(requestedLocale) : undefined;
  if (requestedLocale && !locale) {
    console.warn("[Dashboard] Invalid or unsupported page locale; using the browser language.");
  }
  document.documentElement.lang = locale || supportedLocale(navigator.language || "") || "en-US";
  var requested = params.get("brand");
  var brand = "#2f5d4a";
  if (requested && /^#(?:[a-f\d]{3}|[a-f\d]{6})$/i.test(requested)) {
    brand = requested.length === 4
      ? "#" + requested.slice(1).split("").map(function (c) { return c + c; }).join("")
      : requested;
  } else if (requested) {
    console.warn("[Dashboard] Invalid brand colour; using the default accent.");
  }
  var dark = params.get("theme") === "dark";
  if (dark) document.documentElement.dataset.theme = "dark";

  function luminance(rgb) {
    return rgb.map(function (c) {
      c /= 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    }).reduce(function (sum, c, i) { return sum + c * [0.2126, 0.7152, 0.0722][i]; }, 0);
  }
  function contrast(a, b) {
    var x = luminance(a), y = luminance(b);
    return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
  }
  var rgb = brand.slice(1).match(/../g).map(function (c) { return parseInt(c, 16); });
  var surface = dark ? [32, 38, 41] : [238, 240, 241];
  var target = dark ? 255 : 0;
  var ink = rgb;
  for (var step = 1; contrast(ink, surface) < 4.5 && step <= 25; step++) {
    ink = rgb.map(function (c) { return Math.round(c + (target - c) * step / 25); });
  }
  var style = document.documentElement.style;
  style.setProperty("--sb-brand", brand, "important");
  style.setProperty("--sb-brand-ink", "rgb(" + ink.join(",") + ")", "important");
  style.setProperty("--sb-on-brand",
    contrast(rgb, [0, 0, 0]) >= contrast(rgb, [255, 255, 255]) ? "#000000" : "#ffffff", "important");
})();
