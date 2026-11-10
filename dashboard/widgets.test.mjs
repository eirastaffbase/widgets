import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script, runInNewContext } from "node:vm";
import test from "node:test";

const source = name => readFile(new URL(name, import.meta.url), "utf8");

async function widget(name, attributes = {}) {
  let definition;
  const warnings = [];
  runInNewContext(await source(name), {
    window: { defineBlock: value => { definition = value.blockDefinition; } },
    navigator: { language: "en-US" }, location: { href: "https://widgets.test/dashboard/" },
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

test("Calendar localizes date controls and supports a selected empty day", async () => {
  const { definition, instance, container } = await widget("calendar-widget.js", { locale: "de_DE", events: "+1 | Termin | 09:00" });
  assert.equal(definition.name, "replify-dashboard-calendar");
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
    URLSearchParams, location: { search: "?brand=red%3Bbackground%3Ared" },
    document: { documentElement: { dataset: {}, style: { setProperty: (key, value) => { values[key] = value; } } } },
    console: { warn: value => warnings.push(value) },
  });
  assert.equal(warnings.length, 1);
  assert.equal(values["--sb-brand"], "#2f5d4a");
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
