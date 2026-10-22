/*
 * FAKE member data for the Tribe skills dashboard prototype.
 * Every name and profile here is generated from a fixed seed. None of it comes
 * from Tribe, and it must never be mixed with real member records.
 *
 * Shape (a guess until we see the real Tribe schema):
 *   catalog:   [{ id, name, category, aliases[] }]   canonical skill list
 *   members:   [{ id, name, community, role, visibility, updatedAt,
 *                 skills: [{ raw, level, willing }] }]
 *     raw        free text as the member typed it (normalised later)
 *     level      1 learning, 2 capable, 3 expert
 *     willing    member ticked "happy to help others with this"
 *     visibility "directory" (any member), "leaders" (leaders only), "private" (counts only)
 */
(function (root) {
  const CATEGORIES = ["Creative", "Music", "Hands-on", "Food", "Tech", "Care", "Admin", "Language", "Logistics"];

  // [id, name, category, popularity weight, aliases]
  const SKILLS = [
    ["photography", "Photography", "Creative", 9, ["photo", "photographer", "photos", "wedding photography"]],
    ["videography", "Videography", "Creative", 4, ["video", "filming", "video editing"]],
    ["calligraphy", "Calligraphy", "Creative", 0.6, ["hand lettering", "lettering"]],
    ["graphic-design", "Graphic design", "Creative", 7, ["design", "graphic designer", "figma"]],
    ["painting", "Painting", "Creative", 4, ["art", "watercolor"]],
    ["florals", "Flower arranging", "Creative", 3, ["florals", "floristry", "flowers"]],
    ["guitar", "Guitar", "Music", 8, ["acoustic guitar"]],
    ["piano", "Piano / keys", "Music", 6, ["keys", "keyboard"]],
    ["vocals", "Vocals", "Music", 7, ["singing", "worship leading"]],
    ["sound", "Sound / AV", "Music", 4, ["av", "sound tech", "audio"]],
    ["woodworking", "Woodworking", "Hands-on", 3, ["carpentry", "furniture making"]],
    ["sewing", "Sewing", "Hands-on", 3, ["tailoring", "quilting"]],
    ["knitting", "Knitting / crochet", "Hands-on", 3, ["crochet", "knitting"]],
    ["gardening", "Gardening", "Hands-on", 5, ["plants", "landscaping"]],
    ["handyman", "Home repair", "Hands-on", 4, ["handyman", "repairs", "plumbing"]],
    ["auto", "Car repair", "Hands-on", 2, ["mechanic", "cars"]],
    ["baking", "Baking", "Food", 7, ["cakes", "baker", "bread"]],
    ["cooking-crowds", "Cooking for groups", "Food", 6, ["cooking", "catering", "chef"]],
    ["coffee", "Coffee / barista", "Food", 3, ["barista"]],
    ["web-dev", "Web development", "Tech", 6, ["coding", "programming", "software engineer", "web dev"]],
    ["data", "Data / spreadsheets", "Tech", 4, ["excel", "data analysis"]],
    ["it-help", "IT help", "Tech", 3, ["tech support", "computers"]],
    ["childcare", "Childcare", "Care", 7, ["babysitting", "kids ministry"]],
    ["tutoring", "Tutoring", "Care", 6, ["teaching", "math tutoring"]],
    ["counseling", "Counseling / listening", "Care", 3, ["therapy", "listening"]],
    ["medical", "Medical / nursing", "Care", 3, ["nurse", "doctor", "first aid"]],
    ["event-planning", "Event planning", "Admin", 5, ["events", "party planning", "wedding planning"]],
    ["writing", "Writing / editing", "Admin", 5, ["editing", "copywriting"]],
    ["accounting", "Accounting / taxes", "Admin", 3, ["taxes", "bookkeeping", "finance"]],
    ["legal", "Legal advice", "Admin", 2, ["lawyer", "law"]],
    ["spanish", "Spanish", "Language", 5, ["espanol", "español"]],
    ["mandarin", "Mandarin", "Language", 4, ["chinese"]],
    ["korean", "Korean", "Language", 3, []],
    ["asl", "ASL", "Language", 1, ["sign language"]],
    ["driving", "Driving / van", "Logistics", 5, ["van driver", "rides"]],
    ["moving", "Moving help", "Logistics", 5, ["moving", "heavy lifting"]],
    ["hosting", "Hosting / spare room", "Logistics", 4, ["host", "guest room"]],
  ];

  // Free text that does not map to the catalog, to exercise the data-quality view.
  const UNMAPPED = ["balloon animals", "ham radio", "beekeeping", "juggling", "3d printing", "pottery", "calligrphy", "phtography", "dj"];

  const COMMUNITIES = ["Berkeley", "Oakland", "Richmond", "San Francisco"];
  const FIRST = ["Avery", "Jordan", "Riley", "Morgan", "Casey", "Taylor", "Jamie", "Quinn", "Rowan", "Skyler", "Emerson", "Hayden",
    "Priya", "Mei", "Joon", "Ana", "Mateo", "Lucia", "Grace", "Hannah", "Daniel", "Samuel", "Esther", "Ruth", "Isaac", "Naomi",
    "Elijah", "Lydia", "Micah", "Phoebe", "Silas", "Talia", "Ezra", "Leah", "Jonah", "Abigail", "Noah", "Selah", "Asher", "June"];
  const LAST = ["Alder", "Birch", "Cedarwood", "Dunmore", "Ellery", "Fairbanks", "Garnet", "Hollis", "Ivers", "Jessup", "Kestrel",
    "Linwood", "Marlow", "Northcott", "Oakes", "Pemberly", "Quarry", "Redfield", "Sparrow", "Thistle", "Underhill", "Vance",
    "Westbrook", "Yardley", "Zeller", "Ashby", "Brightwater", "Calloway", "Dovetail", "Everly"];

  // Small seeded PRNG (mulberry32) so the demo shows the same people every load.
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function generate(count, seed) {
    const r = rng(seed);
    const pick = (arr) => arr[Math.floor(r() * arr.length)];
    const totalWeight = SKILLS.reduce((s, k) => s + k[3], 0);
    const weightedSkill = () => {
      let x = r() * totalWeight;
      for (const k of SKILLS) { x -= k[3]; if (x <= 0) return k; }
      return SKILLS[SKILLS.length - 1];
    };
    const usedNames = new Set();
    const members = [];
    for (let i = 0; i < count; i++) {
      let name;
      do { name = pick(FIRST) + " " + pick(LAST); } while (usedNames.has(name));
      usedNames.add(name);

      const skills = [];
      const empty = r() < 0.16; // profiles with no skills filled in
      const n = empty ? 0 : 1 + Math.floor(r() * r() * 7);
      const seen = new Set();
      for (let j = 0; j < n; j++) {
        if (r() < 0.06) { skills.push({ raw: pick(UNMAPPED), level: 1 + Math.floor(r() * 3), willing: r() < 0.5 }); continue; }
        const k = weightedSkill();
        if (seen.has(k[0])) continue;
        seen.add(k[0]);
        // Most people type the canonical name; some use an alias or odd casing.
        let raw = k[1];
        const roll = r();
        if (roll < 0.25 && k[4].length) raw = pick(k[4]);
        else if (roll < 0.35) raw = k[1].toLowerCase();
        else if (roll < 0.4) raw = " " + k[1].toUpperCase() + " ";
        const lv = r();
        skills.push({ raw, level: lv < 0.3 ? 1 : lv < 0.8 ? 2 : 3, willing: r() < 0.62 });
      }

      const v = r();
      // Skew toward recent edits; roughly a quarter of profiles are 2+ years old.
      const year = 2026 - Math.floor(r() * r() * 6);
      const month = 1 + Math.floor(r() * (year === 2026 ? 10 : 12));
      members.push({
        id: "m" + String(i + 1).padStart(3, "0"),
        name,
        community: pick(COMMUNITIES),
        role: r() < 0.1 ? "leader" : "member",
        visibility: v < 0.7 ? "directory" : v < 0.85 ? "leaders" : "private",
        updatedAt: year + "-" + String(month).padStart(2, "0") + "-" + String(1 + Math.floor(r() * 28)).padStart(2, "0"),
        skills,
      });
    }
    return members;
  }

  const data = {
    categories: CATEGORIES,
    communities: COMMUNITIES,
    catalog: SKILLS.map(([id, name, category, , aliases]) => ({ id, name, category, aliases })),
    members: generate(180, 20261021),
    generate,
  };

  if (typeof module !== "undefined" && module.exports) module.exports = data;
  else root.TribeFakeData = data;
})(typeof globalThis !== "undefined" ? globalThis : this);
