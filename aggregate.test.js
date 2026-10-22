// Run: node --test aggregate.test.js
const test = require("node:test");
const assert = require("node:assert/strict");
const A = require("./aggregate.js");
const D = require("./fake-data.js");

const catalog = [
  { id: "photography", name: "Photography", category: "Creative", aliases: ["photo"] },
  { id: "baking", name: "Baking", category: "Food", aliases: ["cakes"] },
  { id: "woodworking", name: "Woodworking", category: "Hands-on", aliases: [] },
];
const members = [
  { id: "a", name: "Ann", community: "Berkeley", visibility: "directory", updatedAt: "2026-01-01",
    skills: [{ raw: "photo", level: 3, willing: true }, { raw: " Photography ", level: 2, willing: false }, { raw: "Baking", level: 1, willing: true }] },
  { id: "b", name: "Ben", community: "Oakland", visibility: "leaders", updatedAt: "2023-01-01",
    skills: [{ raw: "woodworking", level: 2, willing: true }, { raw: "phtography", level: 1, willing: true }] },
  { id: "c", name: "Cy", community: "Berkeley", visibility: "private", updatedAt: "2026-05-01",
    skills: [{ raw: "Photography", level: 2, willing: true }, { raw: "Woodworking", level: 3, willing: true }] },
  { id: "d", name: "Di", community: "Oakland", visibility: "directory", updatedAt: "2026-05-01", skills: [] },
];
const idx = A.indexMembers(members, catalog);
const all = A.applyFilters(idx, catalog, {});

test("normalises aliases, casing and whitespace, and counts a skill once per member", () => {
  assert.deepEqual(idx[0].norm.map((s) => s.skillId), ["photography", "baking"]);
  assert.equal(idx[1].unmapped[0].raw, "phtography");
});

test("skill counts with level breakdown", () => {
  const photo = A.skillCounts(all, catalog).find((r) => r.id === "photography");
  assert.equal(photo.total, 2);
  assert.deepEqual(photo.byLevel, [0, 1, 1]);
  assert.equal(photo.willing, 2);
});

test("filters by community, level and willingness", () => {
  const f = A.applyFilters(idx, catalog, { community: "Berkeley", minLevel: 3 });
  assert.deepEqual(A.skillCounts(f, catalog).map((r) => r.id), ["photography", "woodworking"]);
  const w = A.applyFilters(idx, catalog, { willingOnly: true, query: "bak" });
  assert.deepEqual(A.skillCounts(w, catalog).map((r) => [r.id, r.total]), [["baking", 1]]);
});

test("kpis", () => {
  const k = A.kpis(all);
  assert.deepEqual(k, { members: 4, withSkills: 3, distinctSkills: 3, medianSkills: 2, willingPeople: 3 });
});

test("findPeople respects visibility and any/all", () => {
  const any = A.findPeople(all, ["photography", "woodworking"], "any", "member");
  assert.deepEqual(any.listed.map((p) => p.member.id), ["a"]);
  assert.equal(any.hiddenCount, 2); // Ben is leaders-only, Cy is private
  assert.equal(any.leadersOnlyCount, 1);
  const leader = A.findPeople(all, ["photography", "woodworking"], "all", "leader");
  assert.deepEqual(leader.listed.map((p) => p.member.id), []);
  assert.equal(leader.hiddenCount, 1); // Cy has both but is private
});

test("coverage marks gaps and thin needs", () => {
  const c = A.coverage(all, ["photography", "baking", "woodworking"], "member");
  assert.deepEqual(c.map((x) => x.status), ["ok", "thin", "ok"]);
  assert.deepEqual(c[2].visible.map((m) => m.id), []);
});

test("data quality finds empty, stale, aliases and near-miss spellings", () => {
  const q = A.dataQuality(idx, catalog, "2026-10-21");
  assert.equal(q.empty, 1);
  assert.equal(q.stale, 1);
  assert.equal(q.aliasHits[0].raw, "photo");
  assert.deepEqual(q.unmapped[0].suggestion, { skillId: "photography", name: "Photography" });
});

test("csv escapes quotes", () => {
  const csv = A.toCsv([{ member: { name: 'A "B"', community: "X" }, matches: [{ skillId: "baking", level: 2, willing: true }] }], catalog);
  assert.match(csv, /"A ""B"""/);
});

test("fake data is deterministic and well formed", () => {
  const again = D.generate(180, 20261021);
  assert.deepEqual(again, D.members);
  const fi = A.indexMembers(D.members, D.catalog);
  assert.ok(fi.every((m) => m.norm.every((s) => s.level >= 1 && s.level <= 3)));
});
