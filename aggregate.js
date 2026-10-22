/*
 * Pure aggregation logic for the Tribe skills dashboard. No DOM and no I/O, so it
 * can move into whatever stack Tribe uses (a server query layer, an API route or
 * a front-end selector) and keep its tests.
 */
(function (root) {
  const LEVELS = ["Learning", "Capable", "Expert"];
  const STALE_DAYS = 730;

  const clean = (s) => String(s).trim().toLowerCase().replace(/\s+/g, " ");

  // Map every canonical name, id and alias to a skill id.
  function buildLookup(catalog) {
    const map = new Map();
    for (const s of catalog) {
      map.set(clean(s.id), s.id);
      map.set(clean(s.name), s.id);
      for (const a of s.aliases || []) map.set(clean(a), s.id);
    }
    return map;
  }

  function levenshtein(a, b) {
    const dp = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
      let prev = dp[0]; dp[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const tmp = dp[j];
        dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = tmp;
      }
    }
    return dp[b.length];
  }

  // Attach normalised skills to each member; free text that matches nothing goes to `unmapped`.
  function indexMembers(members, catalog) {
    const lookup = buildLookup(catalog);
    return members.map((m) => {
      const norm = [];
      const unmapped = [];
      const seen = new Set();
      for (const s of m.skills) {
        const id = lookup.get(clean(s.raw));
        if (!id) { unmapped.push(s); continue; }
        if (seen.has(id)) continue; // "photo" and "Photography" on one profile count once
        seen.add(id);
        norm.push({ skillId: id, level: s.level, willing: s.willing, raw: s.raw });
      }
      return Object.assign({}, m, { norm, unmapped });
    });
  }

  // Leaders see "directory" and "leaders" profiles by name; members see "directory" only.
  // "private" profiles are never listed by name, but still count in aggregates.
  function canSee(member, viewerRole) {
    if (member.visibility === "directory") return true;
    if (member.visibility === "leaders") return viewerRole === "leader";
    return false;
  }

  /*
   * filters: { community, category, minLevel, willingOnly, query }
   * Returns members in scope, each with `matched`: the skills that pass the skill-level filters.
   */
  function applyFilters(indexed, catalog, f) {
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const q = f.query ? clean(f.query) : "";
    return indexed
      .filter((m) => !f.community || m.community === f.community)
      .map((m) => {
        const matched = m.norm.filter((s) => {
          const def = byId.get(s.skillId);
          if (f.category && def.category !== f.category) return false;
          if (f.minLevel && s.level < f.minLevel) return false;
          if (f.willingOnly && !s.willing) return false;
          if (q && !clean(def.name).includes(q) && !(def.aliases || []).some((a) => clean(a).includes(q))) return false;
          return true;
        });
        return Object.assign({}, m, { matched });
      });
  }

  function skillCounts(scoped, catalog) {
    const rows = new Map(catalog.map((s) => [s.id, { id: s.id, name: s.name, category: s.category, total: 0, byLevel: [0, 0, 0], willing: 0 }]));
    for (const m of scoped) {
      for (const s of m.matched) {
        const r = rows.get(s.skillId);
        r.total++;
        r.byLevel[s.level - 1]++;
        if (s.willing) r.willing++;
      }
    }
    return [...rows.values()].filter((r) => r.total > 0).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }

  function median(xs) {
    if (!xs.length) return 0;
    const s = [...xs].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }

  function kpis(scoped) {
    const withAny = scoped.filter((m) => m.matched.length > 0);
    const distinct = new Set();
    let willingPeople = 0;
    for (const m of withAny) {
      m.matched.forEach((s) => distinct.add(s.skillId));
      if (m.matched.some((s) => s.willing)) willingPeople++;
    }
    return {
      members: scoped.length,
      withSkills: withAny.length,
      distinctSkills: distinct.size,
      medianSkills: median(withAny.map((m) => m.matched.length)),
      willingPeople,
    };
  }

  // Distinct members with at least one matched skill in each category, per community.
  function categoryByCommunity(scoped, catalog, categories, communities) {
    const catOf = new Map(catalog.map((s) => [s.id, s.category]));
    const cells = categories.map(() => communities.map(() => 0));
    const totals = communities.map((c) => scoped.filter((m) => m.community === c).length);
    for (const m of scoped) {
      const col = communities.indexOf(m.community);
      if (col < 0) continue;
      const cats = new Set(m.matched.map((s) => catOf.get(s.skillId)));
      cats.forEach((c) => { const row = categories.indexOf(c); if (row >= 0) cells[row][col]++; });
    }
    return { categories, communities, cells, totals };
  }

  /*
   * People who have the selected skills (within the current filters).
   * mode "any": at least one; "all": every selected skill.
   * Only profiles the viewer may see are listed; the rest are counted in hiddenCount.
   */
  function findPeople(scoped, skillIds, mode, viewerRole) {
    if (!skillIds.length) return { listed: [], hiddenCount: 0, leadersOnlyCount: 0 };
    const listed = [];
    let hiddenCount = 0;
    let leadersOnlyCount = 0; // hidden from this viewer, but a leader could see them
    for (const m of scoped) {
      const matches = m.matched.filter((s) => skillIds.includes(s.skillId));
      const ok = mode === "all" ? matches.length === skillIds.length : matches.length > 0;
      if (!ok) continue;
      if (!canSee(m, viewerRole)) { hiddenCount++; if (m.visibility === "leaders") leadersOnlyCount++; continue; }
      listed.push({
        member: m,
        matches,
        score: matches.length * 10 + Math.max(...matches.map((s) => s.level)) + (matches.some((s) => s.willing) ? 0.5 : 0),
      });
    }
    listed.sort((a, b) => b.score - a.score || a.member.name.localeCompare(b.member.name));
    return { listed, hiddenCount, leadersOnlyCount };
  }

  // Needs vs coverage for a project such as a group gift: how many people can cover each need.
  function coverage(scoped, needs, viewerRole) {
    return needs.map((skillId) => {
      const people = scoped.filter((m) => m.matched.some((s) => s.skillId === skillId));
      const willing = people.filter((m) => m.matched.some((s) => s.skillId === skillId && s.willing));
      const visible = willing.filter((m) => canSee(m, viewerRole));
      const status = willing.length === 0 ? "gap" : willing.length === 1 ? "thin" : "ok";
      return { skillId, total: people.length, willing: willing.length, visible, status };
    });
  }

  function dataQuality(indexed, catalog, today) {
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const now = new Date(today).getTime();
    const empty = indexed.filter((m) => m.skills.length === 0).length;
    const stale = indexed.filter((m) => (now - new Date(m.updatedAt).getTime()) / 86400000 > STALE_DAYS).length;

    const aliasHits = new Map();
    const unmapped = new Map();
    for (const m of indexed) {
      for (const s of m.norm) {
        const canonical = clean(byId.get(s.skillId).name);
        if (clean(s.raw) !== canonical) {
          const key = clean(s.raw) + "→" + s.skillId;
          const e = aliasHits.get(key) || { raw: clean(s.raw), skillId: s.skillId, name: byId.get(s.skillId).name, count: 0 };
          e.count++; aliasHits.set(key, e);
        }
      }
      for (const s of m.unmapped) {
        const raw = clean(s.raw);
        const e = unmapped.get(raw) || { raw, count: 0, suggestion: null };
        e.count++; unmapped.set(raw, e);
      }
    }
    // Suggest a catalog skill for near-miss spellings ("phtography" → Photography). Never auto-applied.
    const names = catalog.map((s) => ({ id: s.id, name: s.name, key: clean(s.name) }));
    for (const e of unmapped.values()) {
      let best = null;
      for (const n of names) {
        const d = levenshtein(e.raw, n.key);
        if (d <= 2 && (!best || d < best.d)) best = { d, id: n.id, name: n.name };
      }
      if (best) e.suggestion = { skillId: best.id, name: best.name };
    }
    return {
      members: indexed.length,
      empty,
      stale,
      aliasHits: [...aliasHits.values()].sort((a, b) => b.count - a.count),
      unmapped: [...unmapped.values()].sort((a, b) => b.count - a.count),
    };
  }

  // CSV of the listed people only (never private or hidden profiles).
  function toCsv(listed, catalog) {
    const byId = new Map(catalog.map((s) => [s.id, s.name]));
    const esc = (v) => '"' + String(v).replace(/"/g, '""') + '"';
    const lines = [["Name", "Community", "Matching skills", "Happy to help"].map(esc).join(",")];
    for (const p of listed) {
      lines.push([
        p.member.name,
        p.member.community,
        p.matches.map((s) => byId.get(s.skillId) + " (" + LEVELS[s.level - 1] + ")").join("; "),
        p.matches.some((s) => s.willing) ? "yes" : "no",
      ].map(esc).join(","));
    }
    return lines.join("\n");
  }

  const api = { LEVELS, STALE_DAYS, buildLookup, levenshtein, indexMembers, canSee, applyFilters, skillCounts, kpis, categoryByCommunity, findPeople, coverage, dataQuality, toCsv };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.TribeAgg = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
