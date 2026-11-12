import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, runInNewContext } from "node:vm";
import test from "node:test";

const source = name => readFile(new URL(name, import.meta.url), "utf8");

async function widget(name, attributes = {}, now) {
  let definition;
  const warnings = [];
  runInNewContext(await source(name), {
    window: { defineBlock: value => { definition = value.blockDefinition; } },
    navigator: { language: "en-US" }, location: { href: "https://widgets.test/dashboard/" },
    Date: now === undefined ? Date : class extends Date {
      constructor(...args) { super(...(args.length ? args : [now])); }
      static now() { return now; }
    },
    URL, Intl, TypeError, console: { warn: value => warnings.push(value) },
  });
  class Base {
    getAttribute(name) { return attributes[name]; }
  }
  const Instance = definition.factory(Base);
  const instance = new Instance();
  const container = { innerHTML: "", querySelectorAll: () => [], querySelector: () => null };
  instance.renderBlock(container);
  return { definition, instance, container, warnings };
}

test("Files stays component-scoped and does not invent clickable files", async () => {
  const { definition, container } = await widget("files-widget.js");
  assert.equal(definition.name, "replify-dashboard-files");
  assert.doesNotMatch(container.innerHTML, /menubar|a\.item|ul\.mx-2|<button/);
  assert.match(container.innerHTML, /minmax\(min\(100%,230px\)/);
});

test("Files disables invalid links without blocking good entries and localizes the action", async () => {
  const { container, warnings } = await widget("files-widget.js", {
    files: "Bad | PDF | Today | javascript:alert(1)\nBroken | PDF | Today | https://[\nGood | PDF | Today | https://files.test/guide.pdf",
    alllink: "https://files.test", seelabel: "Tout voir",
  });
  assert.equal(warnings.length, 2);
  assert.doesNotMatch(container.innerHTML, /javascript:|https:\/\/\[/);
  assert.match(container.innerHTML, /href="https:\/\/files.test\/guide.pdf"/);
  assert.match(container.innerHTML, />Tout voir<\/a>/);
});

test("Files demo dates roll across paydays, year boundaries and leap years", async () => {
  for (const [year, month, day, period, benefitsYear] of [
    [2030, 11, 31, "December 2030", 2031],
    [2031, 0, 1, "December 2030", 2032],
    [2031, 0, 15, "January 2031", 2032],
    [2032, 1, 29, "February 2032", 2033],
  ]) {
    const { container } = await widget("files-widget.js", {}, new Date(year, month, day, 12).getTime());
    assert.ok(container.innerHTML.includes(`Payslip - ${period}`));
    assert.ok(container.innerHTML.includes(`Benefits guide ${benefitsYear}`));
    assert.doesNotMatch(container.innerHTML, /October 2026|Added 25 Oct|Updated 1 Nov/);
  }
});

test("Files refreshes the translated pilot demo but preserves custom and linked file dates", async () => {
  const files = [
    "Bulletin de paie - octobre 2026 | PDF | Ajouté le 25 oct.",
    "Contrat de travail | PDF | Ajouté le 12 mars",
    "Guide des avantages sociaux 2027 | PDF | Mis à jour le 1 nov.",
    "Politique de frais | DOCX | Mis à jour le 18 sept.",
    "Organigramme | PDF | Mis à jour le 2 nov.",
    "Politique de télétravail | PDF | Mis à jour le 14 août",
  ].join("\n");
  const now = new Date(2031, 0, 1, 12).getTime();
  const demo = await widget("files-widget.js", { files }, now);
  assert.match(demo.container.innerHTML, /Bulletin de paie - décembre 2030/);
  assert.match(demo.container.innerHTML, /Guide des avantages sociaux 2032/);
  assert.match(demo.container.innerHTML, /Ajouté le 15 déc\./);

  for (const custom of [
    files.replace("Contrat de travail", "Contrat de travail signé"),
    files.replace("Ajouté le 25 oct.", "Ajouté le 25 oct. | https://files.test/payslip.pdf"),
  ]) {
    const { container } = await widget("files-widget.js", { files: custom }, now);
    assert.match(container.innerHTML, /Bulletin de paie - octobre 2026/);
    assert.match(container.innerHTML, /Ajouté le 25 oct\./);
    assert.match(container.innerHTML, /Guide des avantages sociaux 2027/);
  }
});

test("Calendar localizes date controls and supports a selected empty day", async () => {
  const { definition, instance, container } = await widget("calendar-widget.js", { locale: "de_DE", events: "+1 | Termin | 09:00" });
  assert.equal(definition.name, "replify-dashboard-calendar");
  assert.match(container.innerHTML, /container-type:inline-size/);
  assert.match(container.innerHTML, /@container\(max-width:720px\)/);
  assert.match(container.innerHTML, /aria-label="Vorheriger Monat"/);
  assert.match(container.innerHTML, /aria-current="date"/);
  instance._sel = "2000-01-01";
  instance._draw();
  assert.match(container.innerHTML, /Keine Termine\./);
  assert.match(container.innerHTML, /Als Nächstes/);
});

test("Calendar rejects CSS injection and preserves independent instances", async () => {
  const first = await widget("calendar-widget.js", { accent: "red;background:url(https://unexpected.test)", locale: "invalid" });
  const second = await widget("calendar-widget.js", { accent: "#fff" });
  assert.equal(first.warnings.length, 2);
  assert.doesNotMatch(first.container.innerHTML, /unexpected.test/);
  assert.match(second.container.innerHTML, /--sbcal-on-accent:#000/);
  first.instance._sel = "2000-01-01";
  assert.equal(second.instance._sel, undefined);
});

test("iframe brand handling validates inputs and provides readable accent/foreground values", async () => {
  for (const brand of ["#fff", "#ffff00", "#7c246b", "#003366"]) {
    for (const theme of ["light", "dark"]) {
      const values = {};
      const dataset = {};
      runInNewContext(await source("widget-theme.js"), {
        Intl, navigator: { language: "en-US" },
        URLSearchParams, location: { search: `?brand=${encodeURIComponent(brand)}&theme=${theme}` },
        document: { documentElement: { dataset, style: { setProperty: (key, value, priority) => {
          assert.equal(priority, "important");
          values[key] = value;
        } } } }, console,
      });
      assert.match(values["--sb-brand"], /^#[a-f\d]{6}$/i);
      assert.equal(values["--sb-brand"], brand === "#fff" ? "#ffffff" : brand);
      assert.match(values["--sb-brand-ink"], /^rgb\(\d+,\d+,\d+\)$/);
      assert.ok(["#000000", "#ffffff"].includes(values["--sb-on-brand"]));
      assert.equal(dataset.theme, theme === "dark" ? "dark" : undefined);
      if (brand === "#ffff00" || brand === "#fff") assert.equal(values["--sb-on-brand"], "#000000");
    }
  }
  const warnings = [];
  const values = {};
  runInNewContext(await source("widget-theme.js"), {
    Intl, navigator: { language: "en-US" },
    URLSearchParams, location: { search: "?brand=red%3Bbackground%3Ared" },
    document: { documentElement: { dataset: {}, style: { setProperty: (key, value) => { values[key] = value; } } } },
    console: { warn: value => warnings.push(value) },
  });
  assert.equal(warnings.length, 1);
  assert.equal(values["--sb-brand"], "#2f5d4a");
});

test("page locale overrides the browser language and preserves regional formatting", async () => {
  for (const locale of ["en_US", "de_DE", "es_ES", "es_MX", "fr_FR", "fr_CA", "nl_NL"]) {
    const root = { dataset: {}, style: { setProperty() {} } };
    runInNewContext(await source("widget-theme.js"), {
      URLSearchParams, Intl, navigator: { language: "en-US" },
      location: { search: `?locale=${locale}` }, document: { documentElement: root }, console,
    });
    assert.equal(root.lang, locale.replace("_", "-"));
  }
  for (const locale of ["invalid[", "xx-YY", ""]) {
    const warnings = [], root = { dataset: {}, style: { setProperty() {} } };
    runInNewContext(await source("widget-theme.js"), {
      URLSearchParams, Intl, RangeError, navigator: { language: "fr-CA" },
      location: { search: `?locale=${locale}` }, document: { documentElement: root },
      console: { warn: value => warnings.push(value) },
    });
    assert.equal(root.lang, "fr-CA");
    assert.equal(warnings.length, locale ? 1 : 0);
  }
});

test("glass embeds use the shared validated brand contract without inherited telemetry", async () => {
  for (const file of ["servicenow-glass.html", "absence-balance-glass.html", "payslips-glass.html"]) {
    const html = await source(file);
    assert.match(html, /src="widget-theme.js"/);
    assert.match(html, /href="widget-theme.css"/);
    assert.doesNotMatch(html, /widget-counter|sendBeacon|window\.parent|--sb-brand\s*:/);
    assert.doesNotMatch(html, /(?:color|background|border):\s*#(?:2f5d4a|5eba8c)\b/i);
    for (const match of html.matchAll(/<script>([\s\S]*?)<\/script>/g)) {
      new Script(match[1], { filename: file });
    }
  }
});

test("all three embeds have complete Dutch UI dictionaries and use the explicit regional page locale", async () => {
  for (const file of ["servicenow-glass.html", "absence-balance-glass.html", "payslips-glass.html"]) {
    const html = await source(file);
    const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
    const prefix = script.slice(0, script.indexOf("const t = T[LANG]"));
    const result = runInNewContext(`${prefix}\n({current: T[LANG], reference: T['en-US'], locale: LOCALE});`, {
      document: { documentElement: { lang: "nl-NL" } }, Intl,
    });
    assert.equal(result.locale, "nl-NL");
    assert.deepEqual(Object.keys(result.current).sort(), Object.keys(result.reference).sort());
    assert.ok(Object.values(result.current).every(value => typeof value === "string" && value.trim()));
    assert.doesNotMatch(html, /navigator\.language/);
  }
});

test("Payslips privacy disables hidden controls and restores safe focus when revealing and re-hiding", async () => {
  const html = await source("payslips-glass.html");
  const script = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)][0][1];
  const classes = new Set(), modalClasses = new Set();
  const focused = [];
  const elements = {
    widget: { classList: { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name) } },
    privacyContent: { inert: false },
    privacyIcon: {}, privacyLabel: {}, privacyEye: {},
    modalOverlay: { classList: { remove: name => modalClasses.delete(name) } },
    privacyOverlay: { focus: options => focused.push(["reveal", options.preventScroll]) },
    privacyToggle: { focus: options => focused.push(["hide", options.preventScroll]) },
  };
  const { updatePrivacyState, setPrivacy } = runInNewContext(`${script}\n({updatePrivacyState, setPrivacy});`, {
    document: {
      documentElement: { lang: "en-US" },
      getElementById: id => elements[id],
      addEventListener() {},
    },
    Intl,
  });
  updatePrivacyState();
  assert.ok(classes.has("private"));
  assert.equal(elements.privacyContent.inert, true);

  setPrivacy(false);
  assert.equal(classes.has("private"), false);
  assert.equal(elements.privacyContent.inert, false);
  assert.deepEqual(focused.at(-1), ["hide", true]);

  modalClasses.add("open");
  setPrivacy(true);
  assert.ok(classes.has("private"));
  assert.equal(elements.privacyContent.inert, true);
  assert.equal(modalClasses.has("open"), false);
  assert.deepEqual(focused.at(-1), ["reveal", true]);
});
