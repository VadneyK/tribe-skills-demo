/* UI for the skills dashboard prototype. All numbers come from TribeAgg over TribeFakeData. */
(function () {
  const D = window.TribeFakeData;
  const A = window.TribeAgg;
  const TODAY = "2026-10-21";
  const TOP_N = 15;

  const indexed = A.indexMembers(D.members, D.catalog);
  const skillById = new Map(D.catalog.map((s) => [s.id, s]));

  const state = {
    filters: { query: "", community: "", category: "", minLevel: 0, willingOnly: false },
    viewer: "member",
    tab: "overview",
    view: "chart",
    showAll: false,
    selected: [],
    mode: "any",
    project: { name: "Church picnic (example)", needs: ["photography", "calligraphy", "woodworking", "baking", "florals", "guitar"] },
  };

  // ---------- tiny DOM helpers (text always via textContent) ----------
  const $ = (id) => document.getElementById(id);
  function el(tag, props, children) {
    const n = document.createElement(tag);
    if (props) for (const [k, v] of Object.entries(props)) {
      if (k === "text") n.textContent = v;
      else if (k === "class") n.className = v;
      else if (k === "style") n.style.cssText = v;
      else if (k.startsWith("on")) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? "" : v);
    }
    for (const c of [].concat(children || [])) if (c != null) n.append(c instanceof Node ? c : document.createTextNode(String(c)));
    return n;
  }
  const fmtPct = (x) => (x * 100).toFixed(0) + "%";
  const plural = (n, one, many) => n + " " + (n === 1 ? one : many || one + "s");
  const cssVar = (name) => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

  // ---------- tooltip ----------
  const tip = $("tip");
  function showTip(evt, lines) {
    tip.replaceChildren(...lines.map((l) => {
      const row = el("div", { class: l.value ? "tv" : "row tl" });
      if (l.key) row.append(el("i", { class: "key", style: "background:" + l.key }));
      row.append(document.createTextNode(l.value || l.label));
      return row;
    }));
    tip.hidden = false;
    const r = evt.target.getBoundingClientRect();
    const x = evt.clientX ?? r.left + r.width / 2;
    const y = evt.clientY ?? r.top;
    const w = tip.offsetWidth, h = tip.offsetHeight;
    tip.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, x + 12)) + "px";
    tip.style.top = (y - h - 12 < 8 ? y + 16 : y - h - 12) + "px";
  }
  function bindTip(node, lines) {
    node.addEventListener("pointermove", (e) => showTip(e, lines()));
    node.addEventListener("pointerleave", () => (tip.hidden = true));
    node.addEventListener("focus", (e) => showTip(e, lines()));
    node.addEventListener("blur", () => (tip.hidden = true));
  }

  let toastTimer;
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => (t.hidden = true), 5200);
  }

  // ---------- filters ----------
  function initFilters() {
    D.communities.forEach((c) => $("f-community").append(el("option", { value: c, text: c })));
    D.categories.forEach((c) => $("f-category").append(el("option", { value: c, text: c })));
    $("f-query").addEventListener("input", (e) => { state.filters.query = e.target.value; render(); });
    $("f-community").addEventListener("change", (e) => { state.filters.community = e.target.value; render(); });
    $("f-category").addEventListener("change", (e) => { state.filters.category = e.target.value; render(); });
    $("f-level").addEventListener("change", (e) => { state.filters.minLevel = Number(e.target.value); render(); });
    $("f-willing").addEventListener("change", (e) => { state.filters.willingOnly = e.target.checked; render(); });
    $("f-reset").addEventListener("click", () => {
      state.filters = { query: "", community: "", category: "", minLevel: 0, willingOnly: false };
      $("filters").reset();
      render();
    });
  }

  function bindSeg(attr, key) {
    document.querySelectorAll("[data-" + attr + "]").forEach((b) => b.addEventListener("click", () => {
      state[key] = b.dataset[attr];
      render();
    }));
  }
  function syncSeg(attr, value) {
    document.querySelectorAll("[data-" + attr + "]").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll("[role=tab]").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    document.querySelectorAll("[role=tabpanel]").forEach((p) => (p.hidden = p.id !== "tab-" + tab));
    try { history.replaceState(null, "", "#" + tab); } catch (e) { /* file:// in some browsers */ }
    render();
  }

  function toggleSkill(id) {
    const i = state.selected.indexOf(id);
    if (i >= 0) state.selected.splice(i, 1); else state.selected.push(id);
    render();
  }

  // ---------- overview ----------
  function renderKpis(k) {
    const tiles = [
      ["Profiles with skills", String(k.withSkills), "of " + k.members + " members (" + fmtPct(k.members ? k.withSkills / k.members : 0) + ")"],
      ["Different skills", String(k.distinctSkills), "from a list of " + D.catalog.length],
      ["Typical profile", k.medianSkills ? k.medianSkills + " skills" : "-", "median, among profiles with skills"],
      ["Happy to help", String(k.willingPeople), "people offering at least one skill"],
    ];
    $("kpis").replaceChildren(...tiles.map(([l, v, s]) => el("div", { class: "tile" }, [el("div", { class: "label", text: l }), el("div", { class: "value", text: v }), el("div", { class: "sub", text: s })])));
  }

  function levelLegend() {
    $("level-legend").replaceChildren(...A.LEVELS.map((name, i) => el("span", null, [el("i", { style: "background:var(--lv-" + (i + 1) + ")" }), name])));
  }

  function renderSkills(rows) {
    const body = $("skills-body");
    if (!rows.length) { body.replaceChildren(el("div", { class: "empty", text: "No skills match these filters." })); return; }
    if (state.view === "table") {
      const head = el("tr", null, ["Skill", "Category", "Members", ...A.LEVELS, "Happy to help"].map((h, i) => el("th", { class: i >= 2 ? "num" : "", text: h })));
      const trs = rows.map((r) => el("tr", null, [
        el("td", null, el("button", { class: "link-btn", style: "padding:0", onclick: () => toggleSkill(r.id), text: (state.selected.includes(r.id) ? "✓ " : "") + r.name })),
        el("td", { text: r.category }),
        el("td", { class: "num", text: r.total }),
        ...r.byLevel.map((n) => el("td", { class: "num", text: n })),
        el("td", { class: "num", text: r.willing }),
      ]));
      body.replaceChildren(el("div", { class: "table-scroll" }, el("table", null, [el("thead", null, head), el("tbody", null, trs)])));
      return;
    }
    const shown = state.showAll ? rows : rows.slice(0, TOP_N);
    const max = rows[0].total;
    const list = el("div", { class: "bars" }, shown.map((r) => {
      const sel = state.selected.includes(r.id);
      const bar = el("span", { class: "bar", style: "width:" + (r.total / max) * 100 + "%" },
        r.byLevel.map((n, i) => (n ? el("i", { style: "flex:" + n + " 1 0;background:var(--lv-" + (i + 1) + ")" }) : null)));
      const row = el("button", { type: "button", class: "bar-row", "aria-pressed": String(sel), onclick: () => toggleSkill(r.id),
        "aria-label": r.name + ": " + r.total + " members, " + r.byLevel.map((n, i) => n + " " + A.LEVELS[i].toLowerCase()).join(", ") + ". " + r.willing + " happy to help." }, [
        el("span", { class: "name" }, [sel ? el("span", { class: "tick", text: "✓" }) : null, r.name]),
        el("span", { class: "bar-track" }, [bar, el("span", { class: "bar-val", text: r.total })]),
      ]);
      bindTip(row, () => [
        { value: plural(r.total, "member") },
        { label: r.name + " · " + r.category },
        ...r.byLevel.map((n, i) => ({ label: n + " " + A.LEVELS[i].toLowerCase(), key: "var(--lv-" + (i + 1) + ")" })),
        { label: r.willing + " happy to help" },
      ]);
      return row;
    }));
    const foot = el("div", { class: "axis-note" }, [
      el("span", { text: "Showing " + shown.length + " of " + rows.length + " skills" }),
      rows.length > TOP_N ? el("button", { type: "button", class: "link-btn", onclick: () => { state.showAll = !state.showAll; render(); }, text: state.showAll ? "Show top " + TOP_N : "Show all " + rows.length }) : null,
    ]);
    body.replaceChildren(list, foot);
  }

  function luminance(hex) {
    const m = hex.replace("#", "").match(/.{2}/g);
    if (!m) return 1;
    const [r, g, b] = m.map((h) => { const c = parseInt(h, 16) / 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  }

  function renderHeat(h) {
    const steps = [1, 2, 3, 4, 5, 6, 7].map((i) => cssVar("--seq-" + i));
    const ink = cssVar("--ink");
    const grid = el("div", { class: "heat", style: "grid-template-columns:minmax(72px,auto) repeat(" + h.communities.length + ",minmax(0,1fr))" });
    grid.append(el("div"));
    h.communities.forEach((c, j) => grid.append(el("div", { class: "h", title: c }, [c.replace("San Francisco", "SF"), el("small", { text: plural(h.totals[j], "member") })])));
    // Scale colour to the largest share in view, so small differences still show.
    const shares = h.cells.map((row) => row.map((n, j) => (h.totals[j] ? n / h.totals[j] : 0)));
    const maxShare = Math.max(0.01, ...shares.flat());
    h.categories.forEach((cat, i) => {
      grid.append(el("div", { class: "r", text: cat }));
      h.communities.forEach((c, j) => {
        const n = h.cells[i][j];
        const share = shares[i][j];
        const bg = steps[Math.min(6, Math.floor((share / maxShare) * 6.999))];
        const textColor = luminance(bg) > 0.35 ? "#0b0b0b" : "#ffffff";
        const cell = el("div", { class: "c", tabindex: "0", style: "background:" + bg + ";color:" + (n ? textColor : ink),
          "aria-label": cat + " in " + c + ": " + n + " of " + h.totals[j] + " members", text: n ? fmtPct(share) : "-" });
        bindTip(cell, () => [{ value: n + " of " + h.totals[j] + " members" }, { label: cat + " · " + c }]);
        grid.append(cell);
      });
    });
    const ramp = el("div", { class: "ramp" }, ["0%", el("span", { class: "steps" }, steps.map((s) => el("i", { style: "background:" + s }))), fmtPct(maxShare) + " of community"]);
    $("heat-body").replaceChildren(grid, ramp);
  }

  // ---------- find people ----------
  function skillAdder(id, placeholder, onPick, exclude) {
    const listId = id + "-list";
    const input = el("input", { id, list: listId, placeholder, "aria-label": placeholder, autocomplete: "off" });
    const dl = el("datalist", { id: listId }, D.catalog.filter((s) => !exclude.includes(s.id)).map((s) => el("option", { value: s.name })));
    const commit = () => {
      const v = input.value.trim().toLowerCase();
      if (!v) return;
      const lookup = A.buildLookup(D.catalog);
      const hit = lookup.get(v) || (D.catalog.find((s) => s.name.toLowerCase().startsWith(v)) || {}).id;
      if (hit) { onPick(hit); } else { toast("No skill called \"" + input.value.trim() + "\" yet. In Tribe, a leader could add it to the list."); }
    };
    input.addEventListener("change", commit);
    input.addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); commit(); } });
    return [input, dl];
  }

  function chip(name, onRemove) {
    return el("span", { class: "chip" }, [name, el("button", { type: "button", "aria-label": "Remove " + name, onclick: onRemove, text: "×" })]);
  }

  function levelDots(level) {
    return el("span", { class: "dots", "aria-hidden": "true" }, [1, 2, 3].map((i) => el("i", { class: i <= level ? "on" : "" })));
  }

  function personCard(p) {
    const m = p.member;
    return el("article", { class: "person" }, [
      el("div", { class: "who" }, [el("b", { text: m.name }), el("span", { text: m.community + (m.visibility === "leaders" ? " · leaders only" : "") })]),
      el("div", { class: "pills" }, p.matches.map((s) => el("span", { class: "pill", title: A.LEVELS[s.level - 1] }, [
        levelDots(s.level), skillById.get(s.skillId).name, el("span", { class: "sr-only", text: " (" + A.LEVELS[s.level - 1] + ")" }),
        s.willing ? el("span", { class: "help", title: "Happy to help", text: "✓ helps" }) : null,
      ]))),
      el("div", null, el("button", { type: "button", class: "btn", onclick: () => toast("Demo: this would send " + m.name.split(" ")[0] + " a message through Tribe. Your contact details are shared only if they reply."), text: "Ask to connect" })),
    ]);
  }

  let lastListed = [];
  function renderFind(scoped) {
    const picker = $("picker");
    const chips = state.selected.map((id) => chip(skillById.get(id).name, () => toggleSkill(id)));
    picker.replaceChildren(...chips, ...skillAdder("add-skill", state.selected.length ? "Add another skill" : "Type a skill, e.g. baking", (id) => { if (!state.selected.includes(id)) state.selected.push(id); render(); setTimeout(() => $("add-skill").focus(), 0); }, state.selected));

    const res = A.findPeople(scoped, state.selected, state.mode, state.viewer);
    lastListed = res.listed;
    $("find-count").textContent = state.selected.length ? " " + (res.listed.length + res.hiddenCount) : "";
    const sum = $("find-summary");
    if (!state.selected.length) {
      sum.replaceChildren("Pick skills above, or click bars on the Overview tab.");
      $("people").replaceChildren();
      $("export").disabled = true;
      return;
    }
    const parts = [el("strong", { text: plural(res.listed.length + res.hiddenCount, "person", "people") }), " match"];
    if (res.hiddenCount) parts.push(". " + res.hiddenCount + (res.hiddenCount === 1 ? " has a profile" : " have profiles") + " you can't see, so they're counted but not named");
    if (res.leadersOnlyCount) parts.push(" (leaders can see " + res.leadersOnlyCount + ")");
    parts.push(".");
    sum.replaceChildren(...parts);
    $("people").replaceChildren(...(res.listed.length ? res.listed.map(personCard) : [el("div", { class: "empty", text: state.mode === "all" ? "Nobody you can see has all of these. Try \"Any\"." : "Nobody you can see matches." })]));
    $("export").disabled = !res.listed.length;
  }

  // ---------- project ----------
  const ICONS = {
    ok: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--good)"/><path d="M4.5 8.2l2.2 2.2 4.6-4.8" stroke="#fff" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    thin: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.5l7 12.5H1z" fill="var(--warning)"/><path d="M8 6v4" stroke="#0b0b0b" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="12" r="1" fill="#0b0b0b"/></svg>',
    gap: '<svg width="14" height="14" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="var(--critical)"/><path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>',
  };
  const STATUS_LABEL = { ok: "Covered", thin: "Only one person", gap: "Nobody yet" };

  function statusBadge(s) {
    const span = el("span", { class: "status " + s });
    span.innerHTML = ICONS[s]; // static SVG from this file, no data
    span.append(document.createTextNode(STATUS_LABEL[s]));
    return span;
  }

  function renderProject(scoped) {
    const nameInput = $("project-name");
    if (document.activeElement !== nameInput) nameInput.value = state.project.name;
    const needs = state.project.needs;
    $("needs-picker").replaceChildren(
      ...needs.map((id) => chip(skillById.get(id).name, () => { state.project.needs = needs.filter((n) => n !== id); render(); })),
      ...skillAdder("add-need", "Add a need", (id) => { if (!needs.includes(id)) needs.push(id); render(); setTimeout(() => $("add-need").focus(), 0); }, needs),
    );
    const cov = A.coverage(scoped, needs, state.viewer);
    const okN = cov.filter((c) => c.status === "ok").length;
    const gaps = cov.filter((c) => c.status === "gap").map((c) => skillById.get(c.skillId).name);
    $("project-summary").replaceChildren(
      el("strong", { text: okN + " of " + needs.length }), " needs have two or more people happy to help.",
      gaps.length ? " Nobody yet for " + gaps.join(", ") + ": try a wider filter, or ask outside Tribe." : "",
    );
    const head = el("tr", null, ["Need", "Happy to help", "Status", "People you can see", ""].map((h, i) => el("th", { class: i === 1 ? "num" : "", text: h })));
    const rows = cov.map((c) => {
      const names = c.visible.slice(0, 3).map((m) => m.name);
      const more = c.willing - names.length;
      return el("tr", null, [
        el("td", { text: skillById.get(c.skillId).name }),
        el("td", { class: "num", text: c.willing + " of " + c.total }),
        el("td", null, statusBadge(c.status)),
        el("td", { text: (names.join(", ") || "-") + (more > 0 ? " +" + more + " more" : "") }),
        el("td", null, el("button", { type: "button", class: "link-btn", onclick: () => { state.selected = [c.skillId]; state.mode = "any"; setTab("find"); }, text: "See all" })),
      ]);
    });
    $("coverage").replaceChildren(el("thead", null, head), el("tbody", null, rows));
  }

  // ---------- data quality ----------
  function renderQuality() {
    const q = A.dataQuality(indexed, D.catalog, TODAY);
    const unmappedTotal = q.unmapped.reduce((s, e) => s + e.count, 0);
    const tiles = [
      ["No skills listed", q.empty, fmtPct(q.empty / q.members) + " of profiles. A nudge could help"],
      ["Not updated in 2+ years", q.stale, "skills may be out of date"],
      ["Unmatched entries", unmappedTotal, "free text that isn't counted"],
      ["Auto-merged spellings", q.aliasHits.reduce((s, e) => s + e.count, 0), "e.g. \"photo\" counts as Photography"],
    ];
    $("dq-kpis").replaceChildren(...tiles.map(([l, v, s]) => el("div", { class: "tile" }, [el("div", { class: "label", text: l }), el("div", { class: "value", text: v }), el("div", { class: "sub", text: s })])));

    const uHead = el("tr", null, ["Text as typed", "Profiles", "Suggestion", ""].map((h, i) => el("th", { class: i === 1 ? "num" : "", text: h })));
    const uRows = q.unmapped.map((e) => el("tr", null, [
      el("td", { text: "“" + e.raw + "”" }),
      el("td", { class: "num", text: e.count }),
      el("td", { text: e.suggestion ? "Merge into " + e.suggestion.name : "New skill?" }),
      el("td", null, el("button", { type: "button", class: "link-btn", disabled: state.viewer !== "leader", title: state.viewer !== "leader" ? "Leaders only" : "",
        onclick: () => toast("Demo: a leader would " + (e.suggestion ? "merge “" + e.raw + "” into " + e.suggestion.name : "add “" + e.raw + "” as a new skill") + ". Nothing is saved here."),
        text: e.suggestion ? "Merge" : "Add" })),
    ]));
    $("dq-unmapped").replaceChildren(el("thead", null, uHead), el("tbody", null, uRows));

    const aHead = el("tr", null, ["Typed as", "Counts as", "Profiles"].map((h, i) => el("th", { class: i === 2 ? "num" : "", text: h })));
    const aRows = q.aliasHits.slice(0, 14).map((e) => el("tr", null, [el("td", { text: "“" + e.raw + "”" }), el("td", { text: e.name }), el("td", { class: "num", text: e.count })]));
    $("dq-alias").replaceChildren(el("thead", null, aHead), el("tbody", null, aRows));
  }

  // ---------- tray ----------
  function renderTray() {
    const tray = $("tray");
    tray.hidden = state.tab === "find" || !state.selected.length;
    $("tray-txt").textContent = plural(state.selected.length, "skill") + ": " + state.selected.map((id) => skillById.get(id).name).join(", ");
  }

  // ---------- main ----------
  function render() {
    syncSeg("viewer", state.viewer);
    syncSeg("view", state.view);
    syncSeg("mode", state.mode);
    const scoped = A.applyFilters(indexed, D.catalog, state.filters);
    renderKpis(A.kpis(scoped));
    renderSkills(A.skillCounts(scoped, D.catalog));
    renderHeat(A.categoryByCommunity(scoped, D.catalog, D.categories, D.communities));
    renderFind(scoped);
    renderProject(scoped);
    renderQuality();
    renderTray();
  }

  initFilters();
  levelLegend();
  bindSeg("viewer", "viewer");
  bindSeg("view", "view");
  bindSeg("mode", "mode");
  document.querySelectorAll("[role=tab]").forEach((b) => b.addEventListener("click", () => setTab(b.dataset.tab)));
  $("tray-go").addEventListener("click", () => setTab("find"));
  $("tray-clear").addEventListener("click", () => { state.selected = []; render(); });
  $("project-name").addEventListener("input", (e) => { state.project.name = e.target.value; });
  $("export").addEventListener("click", () => {
    const blob = new Blob([A.toCsv(lastListed, D.catalog)], { type: "text/csv" });
    const a = el("a", { href: URL.createObjectURL(blob), download: "skills-fake-data.csv" });
    document.body.append(a); a.click(); a.remove();
  });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", render);
  const tabFromHash = () => {
    const t = (location.hash || "").slice(1);
    return ["overview", "find", "project", "quality"].includes(t) ? t : "overview";
  };
  window.addEventListener("hashchange", () => { if (tabFromHash() !== state.tab) setTab(tabFromHash()); });
  setTab(tabFromHash());
})();
