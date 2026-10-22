# Tribe skills overview: concept demo

**Live demo:** https://vadneyk.github.io/tribe-skills-demo/

A clickable mock-up of a "who can help with what" page for a church membership directory (Tribe).
Today, finding someone with a skill means opening profiles one at a time. This page shows skills
across everyone at once, with counts, filters and a way to find people for a project.

**Every member in the demo is made up**, generated from a fixed seed in `fake-data.js`. There is no
real member data here, and nothing you click is saved.

## What to try (about 3 minutes)

1. **Overview:** headline numbers, skills ranked by how many people have them (split by level), and
   which communities have which kinds of skills. Hover for exact counts.
2. Tick **Happy to help only** and set the level to **Expert only**. Every view updates.
3. Reset the filters, click two bars (e.g. Baking, Guitar), then press **Find people →**.
4. **Find people:** switch between **Any** and **All**. Switch **Viewing as** to Leader to see
   leaders-only profiles. Private profiles are counted but never named.
5. **Plan a project:** an example group gift lists what it needs and who could help with each.
6. **Data quality:** profiles with no skills, misspellings like "phtography" with a suggested fix,
   and spellings already merged ("carpentry" counts as Woodworking).

## Run locally

No build step. Open `index.html`, or:

```bash
python3 -m http.server 8765
```

Tests for the counting logic: `node --test aggregate.test.js`

## Files

- `aggregate.js`: pure counting and filtering functions, kept apart from the page so they can move into a real app
- `fake-data.js`: the seeded fake members and skill list
- `app.js`, `index.html`: the page itself (vanilla JS, no dependencies)
