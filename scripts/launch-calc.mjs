#!/usr/bin/env node
// Launch calculator: risk scores, due dates, slips, an option's effects, same-week draft
// revisions, the gates a practice jump crosses, and owner response times, from the
// launch's rules file, the tracker, and history. Generated from the
// Studio's lead-magnets/launch-readiness/calc/; do not edit here. Run with no
// arguments for usage.
// Launch calculator: the date math and risk scoring the launch readiness
// agent used to do in prose. Pure functions over plain data: no file system,
// no clock, no network. The CLI (cli.mjs) reads the files and passes them in;
// the Studio tests call these functions directly.
//
// Shipped into the bundle as scripts/launch-calc.mjs (this file plus the CLI,
// joined at build time), run with plain `node`, so it has no dependencies.
//
// The model proposes; this evaluates. Anything the rules model cannot express,
// or an input it cannot read without guessing, is refused with a plain
// message, never approximated.

export const RULES_SCHEMA = "launch-rules/1";
export const ANCHORS = ["EA", "GA", "plan_approval"];
export const UNITS = ["calendar", "working"];
export const STATUSES = ["Not started", "In progress", "Done", "Waived"];
export const OPEN_STATUSES = ["Not started", "In progress"];
export const LANDING = ["previous-working-day", "next-working-day", "keep"];
export const HOLIDAY_OBSERVED = ["as-listed", "weekend-shift"];
export const PROPAGATION = ["push-past-blocker", "none"];
export const EXCEPTION_EFFECTS = ["date-override", "evidence-waiver"];
export const EXCEPTION_STATUSES = ["active", "needs-re-approval", "dropped", "superseded"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Each predicate the scoring rules may list, what it means, and its default risk. */
export const PREDICATES = {
  overdue: { risk: "red", means: "open and today is after Due (on the due date it is not overdue); lateness is always counted against Due, whatever the Forecast" },
  "forecast-after-due": { risk: "red", means: "the owner's Forecast is after Due: an expected miss is red now, before Due arrives" },
  "breaks-rule": { risk: "red", means: "Due is later than the approved rules allow (its lead time, or an approved date override), even when no date is past" },
  "blocked-slip-exceeds-slack": { risk: "red", means: "blocked by a red task whose slip is larger than the slack between the two" },
  "no-due-date": { risk: "amber", means: "an open task with no Due; the nudge proposes a date" },
  "due-soon-not-started": { risk: "amber", means: "Not started and Due within `days` days (the due date included)", days: 7 },
  stale: { risk: "amber", means: "no update for `days` days or more, from Last update", days: 14 },
  "blocked-within-slack": { risk: "amber", means: "blocked by a red task whose slip the slack still covers" },
};

export const DEFAULT_SCORING = {
  precedence: [
    { id: "overdue", risk: "red" },
    { id: "forecast-after-due", risk: "red" },
    { id: "breaks-rule", risk: "red" },
    { id: "blocked-slip-exceeds-slack", risk: "red" },
    { id: "no-due-date", risk: "amber" },
    { id: "due-soon-not-started", risk: "amber", days: 7 },
    { id: "stale", risk: "amber", days: 14 },
    { id: "blocked-within-slack", risk: "amber" },
  ],
};

export const SLACK_DEFINITION =
  "Slack between a blocking task and the task it blocks is the number of days (in `unit`) from the blocker's Due to the blocked task's Due, less min_gap_days. A blocker's slip is how far its Forecast, or today when it is open past Due, is after its Due. A slip larger than the slack turns the blocked task red and carries the difference on down the chain; a slip the slack covers makes it amber. A cascade stops at a task that is Done or Waived.";

export class Refusal extends Error {}
const refuse = (msg) => {
  throw new Refusal(msg);
};

// ---------- dates ----------

const DAY_MS = 86400000;
/** YYYY-MM-DD to a day number, or null when it is not a real date in that form. */
export function parseDate(s) {
  if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const n = Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10)) / DAY_MS;
  return fmt(n) === s ? n : null;
}
export function fmt(n) {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}
export function weekday(n) {
  return new Date(n * DAY_MS).getUTCDay();
}
function mustDate(s, what) {
  const n = parseDate(s);
  if (n === null) refuse(`${what} "${s}" is not a date in the form YYYY-MM-DD`);
  return n;
}

/** The calendar a rules file defines: weekends, holidays (as observed), and where a due date that lands on a day off moves. */
export function makeCalendar(cal = {}) {
  const weekend = new Set((cal.weekend ?? ["Sat", "Sun"]).map((d) => DAY_NAMES.indexOf(d)));
  const holidays = new Map();
  for (const h of cal.holidays ?? []) {
    let n = parseDate(h.date);
    if (n === null) continue;
    if ((cal.holiday_observed ?? "as-listed") === "weekend-shift") {
      if (weekday(n) === 6) n -= 1;
      else if (weekday(n) === 0) n += 1;
    }
    holidays.set(n, h.name ?? "holiday");
  }
  const working = (n) => !weekend.has(weekday(n)) && !holidays.has(n);
  const landing = cal.due_on_non_working_day ?? "previous-working-day";
  return {
    working,
    holidayName: (n) => holidays.get(n) ?? (weekend.has(weekday(n)) ? "weekend" : null),
    land(n) {
      if (landing === "keep") return n;
      const step = landing === "next-working-day" ? 1 : -1;
      let d = n;
      for (let i = 0; i < 400 && !working(d); i++) d += step;
      return d;
    },
    nextWorking(n) {
      let d = n;
      for (let i = 0; i < 400 && !working(d); i++) d += 1;
      return d;
    },
    addWorking(n, k) {
      let d = n;
      const step = k < 0 ? -1 : 1;
      for (let left = Math.abs(k); left > 0; ) {
        d += step;
        if (working(d)) left--;
      }
      return d;
    },
    /** Working days from a to b: positive when b is later. */
    workingBetween(a, b) {
      if (a === b) return 0;
      const step = b > a ? 1 : -1;
      let count = 0;
      for (let d = a; d !== b; ) {
        d += step;
        if (working(d)) count += step;
      }
      return count;
    },
  };
}

/** A date counted from an anchor: calendar days then moved off a day off, or working days. */
export function offsetDate(cal, anchor, offset, unit) {
  if (unit === "working") return cal.addWorking(anchor, offset);
  return cal.land(anchor + offset);
}

// ---------- holidays ----------

function nthWeekday(year, month, wd, nth) {
  const first = Date.UTC(year, month - 1, 1) / DAY_MS;
  const shift = (wd - weekday(first) + 7) % 7;
  return first + shift + (nth - 1) * 7;
}
function lastWeekday(year, month, wd) {
  const last = Date.UTC(year, month, 0) / DAY_MS;
  return last - ((weekday(last) - wd + 7) % 7);
}
/** US federal holidays observed in a year, each on its observed day (Saturday to Friday, Sunday to
 *  Monday). The next year's New Year's Day falls on December 31 when January 1 is a Saturday (2027-12-31
 *  for 2028), so it is listed in the year it is observed in, and not in its own year. */
export function usFederalHolidays(year) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) refuse(`year ${year} is outside 2000 to 2100`);
  return [...federalYear(year), ...federalYear(year + 1)].filter((h) => h.date.startsWith(`${year}-`));
}
function federalYear(year) {
  const fixed = (m, d) => Date.UTC(year, m - 1, d) / DAY_MS;
  const list = [
    ["New Year's Day", fixed(1, 1)],
    ["Birthday of Martin Luther King, Jr.", nthWeekday(year, 1, 1, 3)],
    ["Washington's Birthday", nthWeekday(year, 2, 1, 3)],
    ["Memorial Day", lastWeekday(year, 5, 1)],
    ["Juneteenth National Independence Day", fixed(6, 19)],
    ["Independence Day", fixed(7, 4)],
    ["Labor Day", nthWeekday(year, 9, 1, 1)],
    ["Columbus Day", nthWeekday(year, 10, 1, 2)],
    ["Veterans Day", fixed(11, 11)],
    ["Thanksgiving Day", nthWeekday(year, 11, 4, 4)],
    ["Christmas Day", fixed(12, 25)],
  ];
  return list.map(([name, n]) => {
    const wd = weekday(n);
    const observed = wd === 6 ? n - 1 : wd === 0 ? n + 1 : n;
    return observed === n ? { date: fmt(n), name } : { date: fmt(observed), name: `${name} (observed)`, actual: fmt(n) };
  });
}

// ---------- lead times and the playbook ----------

const NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
function anchorName(word) {
  const w = word.trim().toLowerCase();
  if (["ea", "beta", "early access"].includes(w)) return "EA";
  if (["ga", "general availability"].includes(w)) return "GA";
  if (w === "plan approval") return "plan_approval";
  return null;
}
/** "EA - 12w", "GA - 10d", "Plan approval + 5 working days" to { anchor, offset, unit }, or null. */
export function parseLeadTime(text) {
  const m = /^\s*(EA|GA|Beta|Early access|General availability|Plan approval)\s*([+\-−–])\s*(\d+)\s*(w|wk|wks|weeks?|d|days?|calendar days?|working days?|wd)\s*$/i.exec(String(text ?? ""));
  if (!m) return null;
  const anchor = anchorName(m[1]);
  const sign = m[2] === "+" ? 1 : -1;
  const n = Number(m[3]);
  const u = m[4].toLowerCase();
  if (/^w/.test(u) && !/^working|^wd/.test(u)) return { anchor, offset: sign * n * 7, unit: "calendar" };
  if (/^working|^wd/.test(u)) return { anchor, offset: sign * n, unit: "working" };
  return { anchor, offset: sign * n, unit: "calendar" };
}
function parseDistance(text) {
  const m = /\b(\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+(weeks?|days?|working days?)\s+before\s+(EA|GA|beta|early access|general availability)\b/i.exec(text);
  if (!m) return null;
  const n = /^\d+$/.test(m[1]) ? Number(m[1]) : NUMBER_WORDS[m[1].toLowerCase()];
  const unit = /^working/i.test(m[2]) ? "working" : "calendar";
  return { anchor: anchorName(m[3]), offset: -(/^week/i.test(m[2]) ? n * 7 : n), unit };
}

function section(md, name) {
  const re = new RegExp(`^## ${name}\\s*$`, "m");
  const m = re.exec(md);
  if (!m) return null;
  const rest = md.slice(m.index + m[0].length);
  const next = /^## /m.exec(rest);
  return next ? rest.slice(0, next.index) : rest;
}
function tableRows(text) {
  const lines = text.split("\n").filter((l) => /^\s*\|/.test(l));
  if (lines.length < 2) return null;
  const cells = (l) => l.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map((c) => c.trim());
  const header = cells(lines[0]);
  return lines.slice(2).map((l) => Object.fromEntries(cells(l).map((c, i) => [header[i] ?? `col${i}`, c])));
}
const ids = (s) => String(s ?? "").split(/[;,\s]+/).map((x) => x.trim()).filter(Boolean);

/** Reads the playbook's Tasks table, Gates, Scope, and Risk scoring numbers.
 *  What it cannot read goes to `unsupported`, for the agent to put to the launch lead. */
export function parsePlaybook(md) {
  const unsupported = [];
  const tasksText = section(md, "Tasks");
  if (!tasksText) refuse("the playbook has no ## Tasks section, so there are no tasks or lead times to calculate from");
  const rows = tableRows(tasksText);
  if (!rows) refuse("the playbook's Tasks section has no table");
  const tasks = [];
  for (const r of rows) {
    const id = r["Task ID"];
    if (!id) continue;
    const lt = parseLeadTime(r["Lead time"]);
    const tiers = ids(r["Tiers"]).map(Number).filter(Number.isInteger);
    if (!lt) {
      unsupported.push({ rule: `${id} lead time "${r["Lead time"]}"`, why: "not an offset from EA, GA, or plan approval in days, weeks, or working days" });
      continue;
    }
    tasks.push({
      id,
      name: r["Task"] ?? "",
      seat: r["Seat"] ?? "",
      tiers,
      lead_time: r["Lead time"],
      anchor: lt.anchor,
      offset: lt.offset,
      unit: lt.unit,
      blocks: ids(r["Blocks"]),
      gate: null,
      deliverable: r["Deliverable"] ?? "",
    });
  }
  // Tiers whose gate decider says "no gate" have no gate review.
  const noGateTiers = [];
  const scope = section(md, "Scope");
  for (const r of (scope && tableRows(scope)) ?? []) {
    const tier = Number(r["Tier"]);
    if (Number.isInteger(tier) && /no gate/i.test(Object.values(r).join(" "))) noGateTiers.push(tier);
  }
  const allTiers = [...new Set(tasks.flatMap((t) => t.tiers))].sort();
  const gates = [];
  const gatesText = section(md, "Gates");
  if (gatesText) {
    const blocks = gatesText.split(/\n(?=[^\n-][^\n]*review[^\n]*\n)/i);
    for (const block of blocks) {
      const lines = block.split("\n");
      const head = lines.find((l) => /review/i.test(l) && !/^\s*-/.test(l));
      if (!head || /^rules:/i.test(head.trim())) continue;
      const dist = parseDistance(head);
      const nameMatch = /^\s*(.+?review)\b/i.exec(head);
      const checklist = [...new Set(lines.filter((l) => /^\s*-/.test(l)).flatMap((l) => [...l.matchAll(/\b(T\d+)\b/g)].map((m) => m[1])))];
      if (!checklist.length) continue;
      if (!dist) {
        unsupported.push({ rule: head.trim(), why: "the review date is not given as a number of days or weeks before EA or GA" });
        continue;
      }
      const name = nameMatch ? nameMatch[1].trim() : head.trim();
      const id = /beta|early access/i.test(name) ? "beta" : /\bGA\b|general availability/i.test(name) ? "ga" : name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      gates.push({ id, name, anchor: dist.anchor, offset: dist.offset, unit: dist.unit, tiers: allTiers.filter((t) => !noGateTiers.includes(t)), checklist });
    }
  } else unsupported.push({ rule: "Gates", why: "the playbook has no ## Gates section" });
  for (const g of gates) for (const id of g.checklist) {
    const t = tasks.find((x) => x.id === id);
    if (t && !t.gate) t.gate = g.id;
  }
  const scoring = structuredClone(DEFAULT_SCORING);
  const risk = section(md, "Risk scoring rules");
  if (risk) {
    const soon = /due within (\d+) days/i.exec(risk);
    const stale = /no update for (\d+) days/i.exec(risk);
    if (soon) scoring.precedence.find((p) => p.id === "due-soon-not-started").days = Number(soon[1]);
    if (stale) scoring.precedence.find((p) => p.id === "stale").days = Number(stale[1]);
  } else unsupported.push({ rule: "Risk scoring rules", why: "the playbook has no Risk scoring rules section; the starter's rules are proposed" });
  const setup = section(md, "Setup rules") ?? "";
  const landing = /moves? later to the (next|first) working day/i.test(setup) ? "next-working-day" : /moves? earlier/i.test(setup) ? "previous-working-day" : null;
  if (!landing) unsupported.push({ rule: "Holidays", why: "the playbook does not say where a due date on a weekend or holiday moves; previous working day is proposed" });
  return { tasks, gates, scoring, landing: landing ?? "previous-working-day", usFederal: /US federal holiday/i.test(setup), unsupported };
}

/** A first rules file from the playbook and the intake, for the launch lead to confirm with plan v1. */
export function draftRules({ playbook, launch, tier, ea, ga, planApproval = null, holidays = null, asOf = null }) {
  if (!/^[a-z0-9][a-z0-9-]*$/.test(launch ?? "")) refuse(`launch "${launch}" is not a short lowercase name`);
  const eaN = mustDate(ea, "EA");
  const gaN = mustDate(ga, "GA");
  if (eaN >= gaN) refuse(`EA ${ea} is not before GA ${ga}`);
  // A plan is drafted for dates still ahead: the later of plan approval and the as-of date is "now".
  const refs = [planApproval !== null ? { n: mustDate(planApproval, "--plan-approval"), what: `plan approval ${planApproval}` } : null, asOf !== null ? { n: mustDate(asOf, "--as-of"), what: `the as-of date ${asOf}` } : null].filter(Boolean);
  const ref = refs.length ? refs.reduce((a, b) => (b.n > a.n ? b : a)) : null;
  if (ref && eaN < ref.n) refuse(`EA ${ea} is before ${ref.what}: a launch date already past cannot be planned for. Ask the launch lead for the current dates`);
  const p = parsePlaybook(playbook);
  if (!p.tasks.some((t) => t.tiers.includes(tier))) refuse(`the playbook has no task for tier ${tier}; ask the launch lead which tier's list to use`);
  let holidayList = [];
  const review = [];
  if (holidays === "us-federal" || (holidays === null && p.usFederal)) {
    const first = eaN - 200;
    const years = [];
    for (let y = Number(fmt(first).slice(0, 4)); y <= Number(ga.slice(0, 4)); y++) years.push(y);
    holidayList = years.flatMap(usFederalHolidays);
    review.push(`US federal holidays for ${years.join(", ")}, on their observed days. Add any other national or company holidays the intake names.`);
  } else review.push("No holidays listed: ask the launch lead for the holiday calendar and add each date.");
  const rules = {
    schema: RULES_SCHEMA,
    launch,
    plan_version: "v1",
    option: null,
    based_on: null,
    tier,
    anchors: { EA: ea, GA: ga, plan_approval: planApproval },
    calendar: { weekend: ["Sat", "Sun"], holidays: holidayList, holiday_observed: "as-listed", due_on_non_working_day: p.landing },
    tasks: p.tasks.filter((t) => t.tiers.includes(tier)),
    dependencies: { slack: { unit: "calendar", min_gap_days: 0, definition: SLACK_DEFINITION }, propagation: "push-past-blocker" },
    scoring: p.scoring,
    gates: p.gates.filter((g) => g.tiers.includes(tier)),
    conditions: [],
    exceptions: [],
    unsupported: p.unsupported,
  };
  const known = new Set(rules.tasks.map((t) => t.id));
  for (const t of rules.tasks) t.blocks = t.blocks.filter((b) => known.has(b));
  for (const g of rules.gates) g.checklist = g.checklist.filter((c) => known.has(c));
  // A tier with no such gate (tier 3 has none) reviews no gate: the task keeps no gate membership.
  const gateIds = new Set(rules.gates.map((g) => g.id));
  for (const t of rules.tasks) if (t.gate && !gateIds.has(t.gate)) t.gate = null;
  review.push("Confirm the slack definition and how slips propagate (dependencies) with the plan: the starter playbook describes slack without defining it.");
  review.push("The scoring predicates are the starter's Risk scoring rules. If the playbook's rules say something they do not express, list it under unsupported.");
  // A due date before now means the plan is born overdue: say so before the launch lead approves it.
  const warnings = [];
  if (ref && validateRules(rules).ok) {
    const late = computeDues(rules).tasks.filter((t) => t.due !== null && parseDate(t.due) < ref.n);
    if (late.length) warnings.push(`the plan is born overdue: ${late.map((t) => `${t.task} due ${t.due}`).join(", ")}, before ${ref.what}. Put these to the launch lead with the plan: a later date is an exception to its lead time, or the launch dates move`);
  }
  return { rules, review, warnings };
}

// ---------- validation ----------

export function validateRules(rules) {
  const errors = [];
  const warnings = [];
  const e = (m) => errors.push(m);
  if (!rules || typeof rules !== "object") return { ok: false, errors: ["rules is not a JSON object"], warnings, unsupported: [] };
  if (rules.schema !== RULES_SCHEMA) e(`schema is "${rules.schema}", expected "${RULES_SCHEMA}"`);
  if (!/^[a-z0-9][a-z0-9-]*$/.test(rules.launch ?? "")) e(`launch "${rules.launch}" is not a short lowercase name`);
  if (!/^v\d+$/.test(rules.plan_version ?? "")) e(`plan_version "${rules.plan_version}" is not v<n>`);
  if (rules.option != null && !/^[A-Z]$/.test(rules.option)) e(`option "${rules.option}" is not one capital letter`);
  if (!Number.isInteger(rules.tier)) e("tier is not a whole number");
  const a = rules.anchors ?? {};
  for (const k of Object.keys(a)) if (!ANCHORS.includes(k)) e(`anchor "${k}" is not one of ${ANCHORS.join(", ")}`);
  for (const k of ["EA", "GA"]) if (parseDate(a[k]) === null) e(`anchors.${k} "${a[k]}" is not a date in the form YYYY-MM-DD`);
  if (a.plan_approval != null && parseDate(a.plan_approval) === null) e(`anchors.plan_approval "${a.plan_approval}" is not a date or null`);
  if (parseDate(a.EA) !== null && parseDate(a.GA) !== null && parseDate(a.EA) >= parseDate(a.GA)) e(`EA ${a.EA} is not before GA ${a.GA}`);
  const cal = rules.calendar ?? {};
  for (const d of cal.weekend ?? []) if (!DAY_NAMES.includes(d)) e(`calendar.weekend "${d}" is not one of ${DAY_NAMES.join(", ")}`);
  if (!Array.isArray(cal.holidays)) e("calendar.holidays is not a list of { date, name }");
  for (const h of cal.holidays ?? []) if (parseDate(h?.date) === null) e(`holiday "${h?.date}" is not a date in the form YYYY-MM-DD`);
  if (!HOLIDAY_OBSERVED.includes(cal.holiday_observed ?? "as-listed")) e(`calendar.holiday_observed "${cal.holiday_observed}" is not one of ${HOLIDAY_OBSERVED.join(", ")}`);
  if (!LANDING.includes(cal.due_on_non_working_day ?? "previous-working-day")) e(`calendar.due_on_non_working_day "${cal.due_on_non_working_day}" is not one of ${LANDING.join(", ")}`);
  const tasks = Array.isArray(rules.tasks) ? rules.tasks : (e("tasks is not a list"), []);
  const taskIds = new Set();
  for (const t of tasks) {
    const where = `task ${t?.id ?? "(no id)"}`;
    if (!/^[A-Z]+\d+$/.test(t?.id ?? "")) e(`${where}: id is not like T01`);
    if (taskIds.has(t.id)) e(`${where}: listed twice`);
    taskIds.add(t.id);
    if (!Array.isArray(t.tiers) || !t.tiers.every(Number.isInteger)) e(`${where}: tiers is not a list of whole numbers`);
    if (t.anchor === "fixed") {
      if (parseDate(t.date) === null) e(`${where}: anchor "fixed" needs a date in the form YYYY-MM-DD`);
    } else {
      if (!ANCHORS.includes(t.anchor)) e(`${where}: anchor "${t.anchor}" is not one of ${ANCHORS.join(", ")}, or "fixed"`);
      if (!Number.isInteger(t.offset)) e(`${where}: offset is not a whole number of days`);
      if (!UNITS.includes(t.unit)) e(`${where}: unit "${t.unit}" is not calendar or working`);
    }
  }
  for (const t of tasks) for (const b of t.blocks ?? []) if (!taskIds.has(b)) e(`task ${t.id} blocks ${b}, which is not a task in the rules`);
  const cycle = findCycle(tasks.map((t) => ({ id: t.id, blocks: t.blocks ?? [] })));
  if (cycle) e(`the dependencies loop: ${cycle.join(" -> ")}`);
  const dep = rules.dependencies ?? {};
  if (!dep.slack) e("dependencies.slack is missing: the launch lead confirms a definition of slack with the plan");
  else {
    if (!UNITS.includes(dep.slack.unit)) e(`dependencies.slack.unit "${dep.slack.unit}" is not calendar or working`);
    if (!Number.isInteger(dep.slack.min_gap_days) || dep.slack.min_gap_days < 0) e("dependencies.slack.min_gap_days is not a whole number of zero or more");
  }
  if (!PROPAGATION.includes(dep.propagation)) e(`dependencies.propagation "${dep.propagation}" is not one of ${PROPAGATION.join(", ")}`);
  const prec = rules.scoring?.precedence;
  if (!Array.isArray(prec) || !prec.length) e("scoring.precedence is missing: list the scoring predicates in order");
  else {
    const seen = new Set();
    for (const p of prec) {
      if (!PREDICATES[p?.id]) e(`scoring predicate "${p?.id}" is not one this calculator knows (${Object.keys(PREDICATES).join(", ")}); list the rule under unsupported instead`);
      else {
        if (seen.has(p.id)) e(`scoring predicate "${p.id}" is listed twice`);
        seen.add(p.id);
        if (!["red", "amber"].includes(p.risk)) e(`scoring predicate "${p.id}": risk "${p.risk}" is not red or amber`);
        if ("days" in PREDICATES[p.id] && (!Number.isInteger(p.days) || p.days < 0)) e(`scoring predicate "${p.id}" needs days, a whole number`);
      }
    }
    for (const id of ["overdue", "forecast-after-due"]) if (!seen.has(id)) warnings.push(`scoring has no "${id}" predicate; the starter playbook makes it red`);
  }
  const gateIds = new Set();
  for (const g of rules.gates ?? []) {
    if (!g?.id) e("a gate has no id");
    gateIds.add(g.id);
    if (!["EA", "GA"].includes(g.anchor)) e(`gate ${g.id}: anchor "${g.anchor}" is not EA or GA`);
    if (!Number.isInteger(g.offset)) e(`gate ${g.id}: offset is not a whole number of days`);
    if (!UNITS.includes(g.unit)) e(`gate ${g.id}: unit "${g.unit}" is not calendar or working`);
    for (const c of g.checklist ?? []) if (!taskIds.has(c)) e(`gate ${g.id}: checklist item ${c} is not a task in the rules`);
  }
  for (const t of tasks) if (t.gate != null && !gateIds.has(t.gate)) e(`task ${t.id}: gate "${t.gate}" is not a gate in the rules`);
  for (const c of rules.conditions ?? []) {
    if (!/^C\d+$/.test(c?.id ?? "")) e(`condition "${c?.id}" is not like C01`);
    if (!["active", "dropped"].includes(c?.status ?? "active")) e(`condition ${c?.id}: status "${c?.status}" is not active or dropped`);
    // A condition dropped with its parent keeps its record; the parent is gone from the tasks.
    if ((c?.status ?? "active") === "active" && !taskIds.has(c?.parent)) e(`condition ${c?.id}: parent ${c?.parent} is not a task in the rules`);
  }
  const exIds = new Set();
  for (const x of rules.exceptions ?? []) {
    const where = `exception ${x?.id ?? "(no id)"}`;
    if (!/^X\d+$/.test(x?.id ?? "")) e(`${where}: id is not like X01`);
    if (exIds.has(x.id)) e(`${where}: listed twice`);
    exIds.add(x.id);
    // Only an active exception needs its task: a dropped, superseded, or pending one is a record.
    if ((x.status ?? "active") === "active" && !taskIds.has(x.task)) e(`${where}: task ${x.task} is not a task in the rules`);
    else if (typeof x.task !== "string" || !x.task) e(`${where}: task is missing`);
    if (!x.rule) e(`${where}: rule (the rule it excepts) is missing`);
    if (!EXCEPTION_EFFECTS.includes(x.effect)) e(`${where}: effect "${x.effect}" is not one of ${EXCEPTION_EFFECTS.join(", ")}`);
    if (x.effect === "date-override" && parseDate(x.due) === null) e(`${where}: a date override needs due, a date in the form YYYY-MM-DD`);
    if (x.effect === "evidence-waiver" && x.due != null) e(`${where}: an evidence waiver never sets a date`);
    if (!/^v\d+$/.test(x.plan_version ?? "")) e(`${where}: plan_version is not v<n>`);
    if (!ANCHORS.includes(x.anchor?.name) || parseDate(x.anchor?.date) === null) e(`${where}: anchor must be { name: EA | GA | plan_approval, date: YYYY-MM-DD }, the anchor it was granted against`);
    if (!EXCEPTION_STATUSES.includes(x.status ?? "active")) e(`${where}: status "${x.status}" is not one of ${EXCEPTION_STATUSES.join(", ")}`);
    if (!("approved_by" in x)) e(`${where}: approved_by is missing (null until someone approves it)`);
  }
  const active = (rules.exceptions ?? []).filter((x) => (x.status ?? "active") === "active" && x.effect === "date-override");
  for (const t of taskIds) if (active.filter((x) => x.task === t).length > 1) e(`task ${t} has more than one active date override`);
  if (!(cal.holidays ?? []).length) warnings.push("no holidays are listed: confirm with the launch lead that the team has none in the plan's span");
  else if (parseDate(a.EA) !== null && parseDate(a.GA) !== null) {
    const years = new Set((cal.holidays ?? []).map((h) => String(h.date).slice(0, 4)));
    for (const y of [a.EA.slice(0, 4), a.GA.slice(0, 4)]) if (!years.has(y)) warnings.push(`no holiday is listed in ${y}, a year the plan spans`);
  }
  const unsupported = Array.isArray(rules.unsupported) ? rules.unsupported : [];
  for (const u of unsupported) if (!u?.rule) e("an unsupported entry has no rule text");
  return { ok: errors.length === 0, errors, warnings, unsupported };
}

function findCycle(nodes) {
  const map = new Map(nodes.map((n) => [n.id, n.blocks]));
  const state = new Map();
  const stack = [];
  const visit = (id) => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const b of map.get(id) ?? []) {
      const c = visit(b);
      if (c) return c;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const n of nodes) {
    const c = visit(n.id);
    if (c) return c;
  }
  return null;
}

function assertRules(rules) {
  const v = validateRules(rules);
  if (!v.ok) refuse(`the rules file is not usable: ${v.errors.join("; ")}`);
  return v;
}

// ---------- dues ----------

/** Due dates the approved rules give: every task for the tier from its anchor and lead time, with active date overrides applied, and gate review dates. */
export function computeDues(rules, { anchors: overrides = {} } = {}) {
  assertRules(rules);
  const cal = makeCalendar(rules.calendar);
  const anchors = { ...rules.anchors, ...overrides };
  const tasks = [];
  for (const t of rules.tasks) {
    if (!t.tiers.includes(rules.tier)) continue;
    let ruleDue = null;
    let pending = null;
    if (t.anchor === "fixed") ruleDue = parseDate(t.date);
    else {
      const anchor = parseDate(anchors[t.anchor] ?? null);
      if (anchor === null) pending = `${t.anchor} has no date yet`;
      else ruleDue = offsetDate(cal, anchor, t.offset, t.unit);
    }
    const ex = (rules.exceptions ?? []).find((x) => x.task === t.id && x.effect === "date-override" && (x.status ?? "active") === "active");
    const raw = ruleDue !== null && t.anchor !== "fixed" && t.unit === "calendar" ? parseDate(anchors[t.anchor]) + t.offset : null;
    tasks.push({
      task: t.id,
      name: t.name,
      seat: t.seat,
      gate: t.gate ?? null,
      lead_time: t.lead_time ?? null,
      anchor: t.anchor,
      rule_due: ruleDue === null ? null : fmt(ruleDue),
      ...(raw !== null && raw !== ruleDue ? { moved_off: { from: fmt(raw), because: cal.holidayName(raw) } } : {}),
      due: ex ? ex.due : ruleDue === null ? null : fmt(ruleDue),
      source: ex ? "exception" : pending ? "pending" : "rule",
      ...(ex ? { exception: ex.id } : {}),
      ...(pending ? { pending } : {}),
      blocks: t.blocks ?? [],
      blocked_by: rules.tasks.filter((o) => (o.blocks ?? []).includes(t.id) && o.tiers.includes(rules.tier)).map((o) => o.id),
      deliverable: t.deliverable ?? "",
    });
  }
  const gates = (rules.gates ?? [])
    .filter((g) => !g.tiers || g.tiers.includes(rules.tier))
    .map((g) => {
      const anchor = parseDate(anchors[g.anchor]);
      return { gate: g.id, name: g.name ?? g.id, review: reviewName(g.name ?? g.id), anchor: g.anchor, review_date: fmt(offsetDate(cal, anchor, g.offset, g.unit)), checklist: g.checklist ?? [] };
    });
  return { launch: rules.launch, plan_version: rules.plan_version, option: rules.option ?? null, tier: rules.tier, anchors, tasks, gates };
}

/** Records the day the launch lead approved the plan in a rules file that has none yet, so tasks
 *  counted from plan approval (T01) get a date. It fills a blank and never changes a recorded date:
 *  a different date for an approved plan is a question for the launch lead, not a rewrite. */
export function setPlanApproval(rules, date) {
  assertRules(rules);
  const n = mustDate(date, "--plan-approval");
  const current = rules.anchors.plan_approval ?? null;
  if (current !== null && current !== date) refuse(`${rules.plan_version}${rules.option ? ` option ${rules.option}` : ""} already records plan approval on ${current}; a recorded date is never changed. If the launch lead says it is wrong, the correction is a new plan version`);
  if (n >= parseDate(rules.anchors.EA)) refuse(`plan approval ${date} is not before EA ${rules.anchors.EA}`);
  const next = structuredClone(rules);
  next.anchors.plan_approval = date;
  const warnings = [];
  const late = computeDues(next).tasks.filter((t) => t.due !== null && parseDate(t.due) < n);
  if (late.length) warnings.push(`the plan is born overdue: ${late.map((t) => `${t.task} due ${t.due}`).join(", ")}, before plan approval ${date}`);
  return { rules: next, changed: current === null, warnings };
}

// ---------- rows ----------

const COLUMNS = {
  launch: "Launch",
  task: "Task ID",
  name: "Task",
  seat: "Seat",
  owner: "Owner",
  gate: "Gate",
  lead_time: "Lead time",
  original_due: "Original due",
  due: "Due",
  forecast: "Forecast",
  done_date: "Done date",
  status: "Status",
  risk: "Risk",
  blocked_by: "Blocked by",
  blocks: "Blocks",
  deliverable: "Deliverable",
  file_check: "File check",
  parent: "Parent task",
  waiver: "Waiver",
  flag: "Flag",
  last_update: "Last update",
  notes: "Notes",
};
const DATE_FIELDS = ["original_due", "due", "forecast", "done_date", "last_update"];

/** RFC 4180 CSV to an array of arrays. */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const s = String(text).replace(/^﻿/, "");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true;
    else if (c === ",") {
      row.push(cell);
      cell = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) refuse("the CSV has a quoted value that never closes");
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

/** Rows as CSV text, an array of objects keyed by header, an array of arrays with the header first, or a Sheets read ({ values: [[...]] }). */
export function tableFrom(input) {
  if (typeof input === "string") return parseCsv(input);
  if (Array.isArray(input) && input.every((r) => Array.isArray(r))) return input.map((r) => r.map((c) => (c == null ? "" : String(c))));
  if (input && Array.isArray(input.values)) return tableFrom(input.values);
  if (input && Array.isArray(input.rows)) return tableFrom(input.rows);
  if (Array.isArray(input) && input.every((r) => r && typeof r === "object")) {
    const header = [...new Set(input.flatMap((r) => Object.keys(r)))];
    return [header, ...input.map((r) => header.map((h) => (r[h] == null ? "" : String(r[h]))))];
  }
  refuse("the rows are not CSV, a list of rows keyed by column, or a list of lists with the header first");
}

/** The launch's rows, normalized. Problems in a row stay with the row, so the caller can refuse that row by name.
 *  No row for the launch is refused, naming the Launch values the tracker has: scoring nothing would
 *  read as all clear. Rows whose Launch differs only in case or spacing are used, with a warning. */
export function normalizeRows(input, launch, { require = ["task", "status", "due"], warnings = [] } = {}) {
  const table = tableFrom(input);
  if (!table.length) refuse("the tracker has no header row");
  const header = table[0].map((h) => String(h).trim());
  const index = {};
  for (const [key, col] of Object.entries(COLUMNS)) {
    const i = header.findIndex((h) => h.toLowerCase() === col.toLowerCase());
    if (i >= 0) index[key] = i;
  }
  const missing = require.filter((k) => !(k in index)).map((k) => COLUMNS[k]);
  if (missing.length) refuse(`the tracker header has no ${missing.join(", ")} column; the header is: ${header.join(", ")}`);
  if (!("launch" in index)) refuse("the tracker header has no Launch column, so rows cannot be matched to a launch");
  const rows = [];
  const seen = new Map();
  const launchOf = (r) => String(table[r][index.launch] ?? "").trim();
  const exact = table.slice(1).some((_, i) => launchOf(i + 1) === launch);
  const loose = (v) => v.toLowerCase().replace(/\s+/g, "");
  const matches = (v) => (exact ? v === launch : loose(v) === loose(launch));
  if (!table.slice(1).some((_, i) => matches(launchOf(i + 1)))) {
    const values = [...new Set(table.slice(1).map((_, i) => launchOf(i + 1)))];
    refuse(`the tracker has no row whose Launch is "${launch}"${values.length ? `; the Launch values it has are: ${values.map((v) => (v ? `"${v}"` : "(empty)")).join(", ")}` : ": it has a header and no rows"}. Nothing was scored; check the launch name or the tracker read`);
  }
  if (!exact) {
    const values = [...new Set(table.slice(1).map((_, i) => launchOf(i + 1)).filter(matches))];
    warnings.push(`no row's Launch is exactly "${launch}"; rows with Launch ${values.map((v) => `"${v}"`).join(", ")} are used. Correct the Launch column so it matches the rules`);
  }
  for (let r = 1; r < table.length; r++) {
    const cells = table[r];
    const get = (k) => (k in index ? String(cells[index[k]] ?? "").trim() : "");
    if (!matches(get("launch"))) continue;
    const row = { line: r + 1, problems: [] };
    for (const k of Object.keys(COLUMNS)) row[k] = get(k);
    row.launch = launch;
    if (!row.task) {
      row.problems.push(`line ${r + 1} has no Task ID`);
    } else if (seen.has(row.task)) refuse(`task ${row.task} appears twice for launch ${launch} (lines ${seen.get(row.task)} and ${r + 1})`);
    else seen.set(row.task, r + 1);
    for (const k of DATE_FIELDS) {
      if (!row[k]) {
        row[k] = null;
        continue;
      }
      if (parseDate(row[k]) === null) row.problems.push(`${COLUMNS[k]} "${row[k]}" is not a date in the form YYYY-MM-DD`);
    }
    const st = STATUSES.find((s) => s.toLowerCase() === row.status.toLowerCase());
    if (!st) row.problems.push(row.status ? `Status "${row.status}" is not one of ${STATUSES.join(", ")}` : "Status is empty, so it is not known whether the task is open");
    else row.status = st;
    row.blocked_by = ids(row.blocked_by);
    row.blocks = ids(row.blocks);
    row.condition = /^condition$/i.test(row.flag) || (!!row.parent && /^C\d+$/.test(row.task));
    row.parent = row.parent || null;
    rows.push(row);
  }
  return rows;
}
const isOpen = (r) => OPEN_STATUSES.includes(r.status);

// ---------- score ----------

const RANK = { green: 0, amber: 1, red: 2 };
const worse = (a, b) => (RANK[a] >= RANK[b] ? a : b);
const cap = (s) => s[0].toUpperCase() + s.slice(1);

/** Risk for every open row, from the approved rules, with reasons and lateness. */
export function score(rules, input, asOf, { lastScore = null } = {}) {
  const v = assertRules(rules);
  const today = mustDate(asOf, "--as-of");
  const last = lastScore === null ? null : mustDate(lastScore, "--last-score");
  const cal = makeCalendar(rules.calendar);
  const dues = computeDues(rules);
  const ruleOf = new Map(dues.tasks.map((t) => [t.task, t]));
  const warnings = [...v.warnings];
  const rows = normalizeRows(input, rules.launch, { warnings });
  const byId = new Map(rows.map((r) => [r.task, r]));
  const prec = rules.scoring.precedence;
  const pred = new Map(prec.map((p, i) => [p.id, { ...p, order: i }]));
  const slackUnit = rules.dependencies.slack.unit;
  const minGap = rules.dependencies.slack.min_gap_days;
  const noRow = dues.tasks.filter((t) => !byId.has(t.task)).map((t) => t.task);
  for (const id of noRow) warnings.push(`${id} is in the rules (${rules.plan_version}) but the tracker has no row for it, so it is not scored`);
  // An unreadable value is never used: the row is not scored, and that is said, with what it would have touched.
  for (const r of rows.filter((x) => x.problems.length)) {
    const dependents = rows.filter((o) => o.blocked_by.includes(r.task)).map((o) => o.task)
      .concat(rules.tasks.filter((t) => t.id === r.task).flatMap((t) => t.blocks ?? []))
      .filter((x, i, a) => a.indexOf(x) === i && byId.has(x));
    warnings.push(`${r.task || `line ${r.line}`} is not scored: ${r.problems.join("; ")}. Its risk${dependents.length ? `, and what it does to ${dependents.join(", ")} (blocked by it),` : ""} is unknown until the row is corrected`);
  }
  const unscored = [];
  const scored = new Map();
  const closed = [];

  // Edges from the tracker's Blocked by and the rules' blocks, so either source counts.
  const blockersOf = new Map();
  for (const r of rows) blockersOf.set(r.task, new Set(r.blocked_by));
  for (const t of rules.tasks) for (const b of t.blocks ?? []) if (blockersOf.has(b)) blockersOf.get(b).add(t.id);
  for (const r of rows) {
    const fromRules = new Set(rules.tasks.filter((t) => (t.blocks ?? []).includes(r.task)).map((t) => t.id));
    const fromRow = new Set(r.blocked_by);
    const diff = [...fromRules].filter((x) => !fromRow.has(x) && byId.has(x)).concat([...fromRow].filter((x) => !fromRules.has(x) && ruleOf.has(r.task)));
    if (diff.length) warnings.push(`${r.task}: Blocked by in the tracker (${r.blocked_by.join("; ") || "empty"}) differs from the rules (${[...fromRules].join("; ") || "none"}); both are used`);
  }
  const cycle = findCycle([...blockersOf].map(([id, bs]) => ({ id, blocks: [] })).map((n) => ({ id: n.id, blocks: [...blockersOf].filter(([, s]) => s.has(n.id)).map(([d]) => d) })));
  if (cycle) refuse(`the tracker's dependencies loop: ${cycle.join(" -> ")}`);

  const slackDays = (from, to) => (slackUnit === "working" ? cal.workingBetween(from, to) : to - from);

  // First pass: everything but blocking.
  for (const r of rows) {
    if (r.problems.length) {
      unscored.push({ task: r.task || `line ${r.line}`, reason: r.problems.join("; ") });
      continue;
    }
    if (!isOpen(r)) {
      closed.push({ task: r.task, status: r.status });
      continue;
    }
    const due = r.due && parseDate(r.due);
    const forecast = r.forecast && parseDate(r.forecast);
    const reasons = [];
    const add = (id, detail) => {
      const p = pred.get(id);
      if (p) reasons.push({ predicate: id, risk: p.risk, detail, order: p.order });
    };
    const out = { task: r.task, name: r.name, owner: r.owner, status: r.status, due: r.due, forecast: r.forecast, last_update: r.last_update, blocked_by: [...(blockersOf.get(r.task) ?? [])], late_days: 0, forecast_after_due_days: 0, days_to_due: null, days_since_update: null, slip_days: 0, notes: [] };
    if (!due) add("no-due-date", "no Due in the tracker; the nudge proposes a date, marked proposed");
    else {
      out.days_to_due = due - today;
      if (today > due) {
        out.late_days = today - due;
        add("overdue", `${out.late_days} day${out.late_days === 1 ? "" : "s"} past Due ${r.due}`);
      }
      if (forecast && forecast > due) {
        out.forecast_after_due_days = forecast - due;
        add("forecast-after-due", `Forecast ${r.forecast} is ${out.forecast_after_due_days} day${out.forecast_after_due_days === 1 ? "" : "s"} after Due ${r.due}`);
      }
      const p = pred.get("due-soon-not-started");
      if (p && r.status === "Not started" && due >= today && due - today <= p.days) add("due-soon-not-started", due === today ? `due today (${r.due}) and not started` : `due in ${due - today} day${due - today === 1 ? "" : "s"} (${r.due}) and not started`);
      const rule = ruleOf.get(r.task);
      if (rule && rule.due) {
        const allowed = parseDate(rule.due);
        if (due > allowed) add("breaks-rule", `Due ${r.due} is later than ${rule.due}, the date the approved rules give (${rule.source === "exception" ? `exception ${rule.exception}` : rule.lead_time ?? "its lead time"})`);
        else if (due < allowed) warnings.push(`${r.task}: Due ${r.due} is earlier than ${rule.due}, the date the approved rules give; the tracker and the plan differ`);
      } else if (rule && rule.pending) out.notes.push(`rule check skipped: ${rule.pending}`);
      else if (!rule && !r.condition) out.notes.push("not in the rules for this tier, so no rule check");
      out.slip_days = Math.max(out.late_days, out.forecast_after_due_days);
    }
    if (r.last_update) {
      out.days_since_update = today - parseDate(r.last_update);
      const p = pred.get("stale");
      if (p && out.days_since_update >= p.days) add("stale", `no update for ${out.days_since_update} days (Last update ${r.last_update})`);
    } else out.notes.push("Last update is empty, so staleness cannot be judged");
    if (last !== null && (!r.last_update || parseDate(r.last_update) < last)) out.not_updated_since_last_score = true;
    out.reasons = reasons;
    scored.set(r.task, out);
  }

  // Second pass: blocking, in dependency order, carrying the slip the slack did not absorb.
  const order = topo([...scored.keys()], (id) => [...(blockersOf.get(id) ?? [])].filter((b) => scored.has(b)));
  const carried = new Map();
  for (const id of order) {
    const out = scored.get(id);
    for (const b of blockersOf.get(id) ?? []) {
      const br = byId.get(b);
      if (!br) {
        out.notes.push(`blocked by ${b}, which is not a row of this launch`);
        continue;
      }
      if (br.problems.length) {
        out.notes.push(`blocked by ${b}, which is not scored (${br.problems.join("; ")}), so its effect on this task is unknown`);
        continue;
      }
      if (!isOpen(br)) continue; // a cascade stops at a Done or Waived task
      const bo = scored.get(b);
      if (!bo) continue;
      const bRisk = riskOf(bo);
      if (bRisk !== "red") continue;
      const slip = Math.max(bo.slip_days, carried.get(b) ?? 0);
      if (!out.due || !bo.due) {
        out.notes.push(`blocked by red ${b}; slack cannot be measured without both Due dates`);
        if (pred.get("blocked-within-slack")) out.reasons.push({ predicate: "blocked-within-slack", risk: pred.get("blocked-within-slack").risk, detail: `blocked by red ${b}; slack not measurable`, order: pred.get("blocked-within-slack").order });
        continue;
      }
      const slack = slackDays(parseDate(bo.due), parseDate(out.due)) - minGap;
      if (slip > slack) {
        const p = pred.get("blocked-slip-exceeds-slack");
        if (p) out.reasons.push({ predicate: "blocked-slip-exceeds-slack", risk: p.risk, detail: `blocked by red ${b}, whose slip of ${slip} days is larger than the ${slack} days of slack`, order: p.order });
        carried.set(id, Math.max(carried.get(id) ?? 0, slip - slack));
      } else {
        const p = pred.get("blocked-within-slack");
        if (p) out.reasons.push({ predicate: "blocked-within-slack", risk: p.risk, detail: `blocked by red ${b}; its slip of ${slip} days fits in the ${slack} days of slack`, order: p.order });
      }
    }
  }

  const results = [];
  for (const out of scored.values()) {
    out.reasons.sort((a, b) => RANK[b.risk] - RANK[a.risk] || a.order - b.order);
    out.reasons = out.reasons.map(({ order, ...r }) => r);
    out.risk = riskOf(out);
    out.reason = out.reasons.length ? out.reasons[0].detail : "nothing in the scoring rules applies";
    if (carried.get(out.task)) out.slip_days = Math.max(out.slip_days, carried.get(out.task));
    results.push(out);
  }

  // A condition repeats its parent's work: while both are open, the pair counts once, at the worse score.
  const pairs = [];
  for (const r of rows) {
    if (!r.condition) continue;
    const c = scored.get(r.task);
    if (!r.parent) {
      if (c) warnings.push(`${r.task} is flagged as a condition but has no Parent task`);
      continue;
    }
    const known = (rules.conditions ?? []).find((x) => x.id === r.task);
    if (known && known.parent !== r.parent) warnings.push(`${r.task}: Parent task ${r.parent} in the tracker, ${known.parent} in the rules`);
    const p = scored.get(r.parent);
    if (c && p) {
      const risk = worse(c.risk, p.risk);
      pairs.push({ parent: r.parent, condition: r.task, risk });
      p.pair_risk = worse(p.pair_risk ?? p.risk, risk);
      p.conditions = [...(p.conditions ?? []), r.task];
      c.condition_of = r.parent;
      c.pair_risk = risk;
    }
  }
  const counts = { red: 0, amber: 0, green: 0 };
  for (const o of results) if (!o.condition_of) counts[o.pair_risk ?? o.risk]++;

  // Launch dates: not realistic as planned when work anchored to a date ends after it, or a gate item cannot be met by its review.
  const expectedEnd = (o) => {
    const due = o.due ? parseDate(o.due) : null;
    const f = o.forecast ? parseDate(o.forecast) : null;
    let end = due === null ? null : f !== null && f > due ? f : due;
    let atLeast = false;
    if (end !== null && today > end) {
      end = today;
      atLeast = true;
    }
    return { end, atLeast };
  };
  // A date is called realistic only on evidence: every task counted from it, and every gate item
  // reviewed before it, has a tracker row that was read. Otherwise `realistic` is null and
  // `not_judged` says which rows are missing or unreadable.
  const closedIds = new Set(closed.map((c) => c.task));
  const evidenceGap = (id) => (scored.has(id) || closedIds.has(id) ? null : byId.has(id) ? `${id} (its row could not be read)` : `${id} (no tracker row)`);
  const launchDates = [];
  for (const anchor of ["EA", "GA"]) {
    const date = parseDate(rules.anchors[anchor]);
    const because = [];
    const considered = [...dues.tasks.filter((x) => x.anchor === anchor).map((x) => x.task), ...dues.gates.filter((x) => x.anchor === anchor).flatMap((g) => g.checklist)];
    const notJudged = [...new Set(considered.map(evidenceGap).filter(Boolean))];
    for (const t of dues.tasks.filter((x) => x.anchor === anchor)) {
      const o = scored.get(t.task);
      if (!o) continue;
      const { end, atLeast } = expectedEnd(o);
      if (end !== null && end > date) because.push(`${t.task} ends ${atLeast ? "no earlier than" : "on"} ${fmt(end)}, after ${anchor} ${rules.anchors[anchor]}`);
    }
    for (const g of dues.gates.filter((x) => x.anchor === anchor)) {
      const review = parseDate(g.review_date);
      for (const id of g.checklist) {
        const o = scored.get(id);
        if (!o) continue;
        const { end, atLeast } = expectedEnd(o);
        if (end === null) because.push(`${id} on the ${g.name} checklist has no Due`);
        else if (end > review) because.push(`${id} on the ${g.name} checklist ends ${atLeast ? "no earlier than" : "on"} ${fmt(end)}, after the review on ${g.review_date}`);
      }
    }
    if (!considered.length) notJudged.push(`no task in the rules counts from ${anchor}`);
    launchDates.push({ anchor, date: rules.anchors[anchor], realistic: because.length ? false : notJudged.length ? null : true, because, not_judged: notJudged });
  }

  return {
    ok: true,
    command: "score",
    launch: rules.launch,
    plan_version: rules.plan_version,
    option: rules.option ?? null,
    as_of: asOf,
    precedence: prec.map((p) => p.id),
    counts,
    rows: results.sort((a, b) => RANK[b.pair_risk ?? b.risk] - RANK[a.pair_risk ?? a.risk] || a.task.localeCompare(b.task)),
    pairs,
    closed,
    unscored,
    not_updated_since_last_score: last === null ? null : results.filter((o) => o.not_updated_since_last_score).map((o) => o.task),
    launch_dates: launchDates,
    gates: dues.gates,
    warnings,
    unsupported: v.unsupported,
  };
}
function riskOf(o) {
  return o.reasons.reduce((acc, r) => worse(acc, r.risk), "green");
}
function topo(nodes, depsOf) {
  const out = [];
  const seen = new Set();
  const visit = (n) => {
    if (seen.has(n)) return;
    seen.add(n);
    for (const d of depsOf(n)) visit(d);
    out.push(n);
  };
  for (const n of nodes) visit(n);
  return out;
}

// ---------- slips ----------

/** Positive slips from Original due: Done date when done, Forecast while open, or today for an open task past Original due with no Forecast. Conditions sit under their parent and are not counted. */
export function slips(input, launch, asOf) {
  const today = mustDate(asOf, "--as-of");
  const warnings = [];
  const rows = normalizeRows(input, launch, { require: ["task", "status", "original_due"], warnings });
  const out = [];
  const unmeasured = [];
  const conditions = [];
  for (const r of rows) {
    if (r.problems.length) {
      unmeasured.push({ task: r.task || `line ${r.line}`, reason: r.problems.join("; ") });
      continue;
    }
    if (r.status === "Waived") continue;
    if (!r.original_due) {
      unmeasured.push({ task: r.task, reason: "Original due is empty" });
      continue;
    }
    let finish = null;
    let from = null;
    if (r.status === "Done") {
      if (!r.done_date) {
        unmeasured.push({ task: r.task, reason: "Done with no Done date" });
        continue;
      }
      finish = r.done_date;
      from = "Done date";
    } else if (r.forecast) {
      // A Forecast that has passed on an open task is not a finish: it is still open today.
      const passed = today > parseDate(r.forecast) && today > parseDate(r.original_due);
      finish = passed ? fmt(today) : r.forecast;
      from = passed ? `still open on the as-of date (Forecast ${r.forecast} has passed)` : "Forecast";
    } else if (today > parseDate(r.original_due)) {
      finish = fmt(today);
      from = "still open on the as-of date";
    } else continue;
    const days = parseDate(finish) - parseDate(r.original_due);
    const item = { task: r.task, name: r.name, original_due: r.original_due, due: r.due, finish, measured_from: from, days, replanned: !!r.due && r.due !== r.original_due };
    if (r.condition && r.parent) {
      if (days > 0) conditions.push({ ...item, parent: r.parent, counted: false });
      continue;
    }
    if (days > 0) out.push(item);
  }
  for (const s of out) s.conditions = conditions.filter((c) => c.parent === s.task).map((c) => ({ task: c.task, days: c.days }));
  return {
    ok: true,
    command: "slips",
    launch,
    as_of: asOf,
    slips: out.sort((a, b) => b.days - a.days || a.task.localeCompare(b.task)),
    total_tasks_slipped: out.length,
    conditions_not_counted: conditions,
    unmeasured,
    warnings,
  };
}

// ---------- effects ----------

function nextExceptionId(exceptions) {
  const max = exceptions.reduce((m, x) => Math.max(m, Number(String(x.id).slice(1)) || 0), 0);
  return `X${String(max + 1).padStart(2, "0")}`;
}

/** Everything an option implies, computed in a proposed plan: dates, exceptions, at-risk rows, and the option's text. The current rules are never changed. */
export function effects(rules, input, option, asOf) {
  assertRules(rules);
  mustDate(asOf, "--as-of");
  if (!option || typeof option !== "object") refuse("the option is not a JSON object");
  const known = ["option", "label", "plan_version", "anchors", "dues", "waivers", "exceptions", "add_tasks", "drop_tasks", "approved_by", "reason"];
  const extra = Object.keys(option).filter((k) => !known.includes(k));
  if (extra.length) refuse(`the option has fields this calculator does not understand: ${extra.join(", ")} (it knows ${known.join(", ")})`);
  if (!/^v\d+$/.test(option.plan_version ?? "")) refuse(`option.plan_version "${option.plan_version}" is not the new plan's version, v<n>`);
  if (Number(option.plan_version.slice(1)) <= Number(rules.plan_version.slice(1))) refuse(`option.plan_version ${option.plan_version} is not after the current rules' ${rules.plan_version}`);
  if (option.option != null && !/^[A-Z]$/.test(option.option)) refuse(`option.option "${option.option}" is not one capital letter`);
  const label = option.option ? `plan-${option.plan_version} option ${option.option}` : `plan-${option.plan_version}`;
  const rowWarnings = [];
  const rows = normalizeRows(input, rules.launch, { warnings: rowWarnings });
  const bad = rows.filter((r) => r.problems.length);
  if (bad.length) refuse(`these rows cannot be read, so the option's effects cannot be complete: ${bad.map((r) => `${r.task || `line ${r.line}`} (${r.problems.join("; ")})`).join(", ")}`);
  const byId = new Map(rows.map((r) => [r.task, r]));
  const current = computeDues(rules);
  const proposed = structuredClone(rules);
  proposed.plan_version = option.plan_version;
  proposed.option = option.option ?? null;
  proposed.based_on = rules.option ? `${rules.plan_version} option ${rules.option}` : rules.plan_version;
  const why = new Map(); // task -> reason its Due changed
  const exceptionLog = { added: [], needs_re_approval: [], kept: [], moved: [], dropped: [], superseded: [], unchanged: [] };

  // Anchors.
  const anchorChanges = [];
  for (const [name, date] of Object.entries(option.anchors ?? {})) {
    if (!ANCHORS.includes(name)) refuse(`option anchor "${name}" is not one of ${ANCHORS.join(", ")}`);
    mustDate(date, `option anchor ${name}`);
    if (proposed.anchors[name] !== date) {
      anchorChanges.push({ anchor: name, old: proposed.anchors[name], new: date });
      proposed.anchors[name] = date;
    }
  }
  const moved = new Set(anchorChanges.map((a) => a.anchor));
  if (parseDate(proposed.anchors.EA) >= parseDate(proposed.anchors.GA)) refuse(`the option puts EA ${proposed.anchors.EA} on or after GA ${proposed.anchors.GA}`);

  // Existing exceptions: an override granted against an anchor that moves does not carry forward silently.
  const decide = option.exceptions ?? {};
  for (const k of Object.keys(decide)) if (!["keep", "move", "drop"].includes(k)) refuse(`option.exceptions.${k} is not keep, move, or drop`);
  const keep = new Set(decide.keep ?? []);
  const drop = new Set(decide.drop ?? []);
  const moveTo = new Map((decide.move ?? []).map((m) => [m.id, m.due]));
  for (const id of [...keep, ...drop, ...moveTo.keys()]) if (!proposed.exceptions.some((x) => x.id === id)) refuse(`option.exceptions names ${id}, which is not an exception in the current rules`);
  for (const x of proposed.exceptions) {
    if ((x.status ?? "active") !== "active") continue;
    const stale = moved.has(x.anchor.name);
    if (drop.has(x.id)) {
      x.status = "dropped";
      x.dropped_in = label;
      exceptionLog.dropped.push(x.id);
      if (x.effect === "date-override") why.set(x.task, `exception ${x.id} dropped; recomputed from its rule`);
    } else if (moveTo.has(x.id)) {
      if (x.effect !== "date-override") refuse(`exception ${x.id} is an evidence waiver and has no date to move`);
      x.due = fmt(mustDate(moveTo.get(x.id), `option.exceptions.move ${x.id}`));
      x.anchor = { name: x.anchor.name, date: proposed.anchors[x.anchor.name] };
      x.plan_version = option.plan_version;
      x.approved_by = option.approved_by ?? null;
      exceptionLog.moved.push(x.id);
      why.set(x.task, `exception ${x.id} moved to ${x.due}`);
    } else if (keep.has(x.id)) {
      x.anchor = { name: x.anchor.name, date: proposed.anchors[x.anchor.name] };
      x.plan_version = option.plan_version;
      x.approved_by = option.approved_by ?? null;
      exceptionLog.kept.push(x.id);
    } else if (stale && x.effect === "date-override") {
      x.status = "needs-re-approval";
      x.needs_re_approval_because = `${x.anchor.name} moves from ${x.anchor.date} to ${proposed.anchors[x.anchor.name]}`;
      exceptionLog.needs_re_approval.push({ id: x.id, task: x.task, rule: x.rule, due: x.due, because: x.needs_re_approval_because });
      why.set(x.task, `exception ${x.id} was granted against ${x.anchor.name} ${x.anchor.date}, which moves; recomputed from its rule until the launch lead keeps, moves, or drops it`);
    } else exceptionLog.unchanged.push(x.id);
  }

  // Scope: tasks the option adds or drops.
  for (const t of option.add_tasks ?? []) {
    if (!/^[A-Z]+\d+$/.test(t.id ?? "")) refuse(`an added task's id "${t.id}" is not like T23`);
    if (proposed.tasks.some((x) => x.id === t.id) || byId.has(t.id)) refuse(`added task ${t.id} already exists`);
    let spec;
    if (t.due) spec = { anchor: "fixed", date: fmt(mustDate(t.due, `added task ${t.id} due`)) };
    else {
      const lt = parseLeadTime(t.lead_time);
      if (!lt) refuse(`added task ${t.id}: lead time "${t.lead_time}" is not an offset from EA, GA, or plan approval`);
      spec = lt;
    }
    proposed.tasks.push({ id: t.id, name: t.name ?? "", seat: t.seat ?? "", tiers: [proposed.tier], lead_time: t.lead_time ?? null, ...spec, blocks: t.blocks ?? [], gate: t.gate ?? null, deliverable: t.deliverable ?? "", added_in: label });
    for (const b of t.blocked_by ?? []) {
      const bt = proposed.tasks.find((x) => x.id === b);
      if (!bt) refuse(`added task ${t.id} is blocked by ${b}, which is not a task`);
      bt.blocks = [...new Set([...(bt.blocks ?? []), t.id])];
    }
  }
  const dropped = [];
  const droppedConditions = [];
  for (const d of option.drop_tasks ?? []) {
    const idx = proposed.tasks.findIndex((x) => x.id === d.task);
    if (idx < 0) refuse(`${label}: drop_tasks names ${d.task}, which is not a task in the current rules (${rules.plan_version})`);
    proposed.tasks.splice(idx, 1);
    for (const t of proposed.tasks) t.blocks = (t.blocks ?? []).filter((b) => b !== d.task);
    for (const g of proposed.gates ?? []) g.checklist = (g.checklist ?? []).filter((c) => c !== d.task);
    // Its exceptions and conditions leave scope with it, recorded as dropped in this version.
    for (const x of proposed.exceptions ?? []) {
      if (x.task !== d.task || !["active", "needs-re-approval"].includes(x.status ?? "active")) continue;
      exceptionLog.needs_re_approval = exceptionLog.needs_re_approval.filter((n) => n.id !== x.id);
      for (const k of ["kept", "moved", "unchanged"]) exceptionLog[k] = exceptionLog[k].filter((id) => id !== x.id);
      x.status = "dropped";
      x.dropped_in = label;
      x.dropped_because = `${d.task} leaves the scope`;
      exceptionLog.dropped.push(x.id);
    }
    for (const c of proposed.conditions ?? []) {
      if (c.parent !== d.task || (c.status ?? "active") !== "active") continue;
      c.status = "dropped";
      c.dropped_in = label;
      droppedConditions.push(c.id);
    }
    dropped.push(d);
  }
  const droppedIds = new Set(dropped.map((d) => d.task));
  for (const d of option.dues ?? []) if (droppedIds.has(d.task)) refuse(`${label} both drops ${d.task} (drop_tasks) and sets its date (dues); keep one`);
  for (const w of option.waivers ?? []) if (droppedIds.has(w.task)) refuse(`${label} both drops ${w.task} (drop_tasks) and waives its evidence (waivers); keep one`);

  // Explicit new dates: any date that departs from the task's rule is an exception, granted in this plan version.
  const ruleDueIn = (r, id) => computeDues({ ...r, exceptions: [] }).tasks.find((t) => t.task === id);
  for (const d of option.dues ?? []) {
    const t = proposed.tasks.find((x) => x.id === d.task);
    if (!t) refuse(`${label}: dues sets a date for ${d.task}, which is not a task in the current rules (${rules.plan_version}) or the option's add_tasks`);
    const due = fmt(mustDate(d.due, `option due for ${d.task}`));
    for (const x of proposed.exceptions) {
      if (x.task === d.task && x.effect === "date-override" && (x.status ?? "active") === "active") {
        x.status = "superseded";
        x.superseded_in = label;
        exceptionLog.superseded.push(x.id);
      }
    }
    const rd = ruleDueIn(proposed, d.task);
    if (rd && rd.due === due) {
      why.set(d.task, `back to the date its rule gives (${t.lead_time ?? "lead time"})`);
      continue;
    }
    const anchorName_ = t.anchor === "fixed" ? "EA" : t.anchor;
    const x = { id: nextExceptionId(proposed.exceptions), task: d.task, rule: d.rule ?? `${t.name} by ${t.lead_time ?? "its lead time"}`, effect: "date-override", due, approved_by: d.approved_by ?? option.approved_by ?? null, plan_version: option.plan_version, option: option.option ?? null, anchor: { name: anchorName_, date: proposed.anchors[anchorName_] }, reason: d.reason ?? option.reason ?? null, status: "active" };
    proposed.exceptions.push(x);
    exceptionLog.added.push({ id: x.id, task: x.task, effect: x.effect, rule: x.rule, due });
    why.set(d.task, `exception ${x.id} to "${x.rule}"`);
  }
  for (const w of option.waivers ?? []) {
    if (!proposed.tasks.some((t) => t.id === w.task)) refuse(`${label}: waivers names ${w.task}, which is not a task in the current rules (${rules.plan_version}) or the option's add_tasks`);
    const t = proposed.tasks.find((x) => x.id === w.task);
    const anchorName_ = t.anchor === "fixed" ? "EA" : t.anchor;
    const x = { id: nextExceptionId(proposed.exceptions), task: w.task, rule: w.rule ?? `evidence for ${w.task}`, effect: "evidence-waiver", item: w.item ?? null, approved_by: w.approved_by ?? option.approved_by ?? null, plan_version: option.plan_version, option: option.option ?? null, anchor: { name: anchorName_, date: proposed.anchors[anchorName_] }, reason: w.reason ?? option.reason ?? null, status: "active" };
    proposed.exceptions.push(x);
    exceptionLog.added.push({ id: x.id, task: x.task, effect: x.effect, rule: x.rule, item: x.item });
  }

  // Dependents whose Due would land before their blocker's.
  let after = computeDues(proposed);
  const conflicts = [];
  const cal = makeCalendar(proposed.calendar);
  const gap = proposed.dependencies.slack.min_gap_days;
  const order = topo(after.tasks.map((t) => t.task), (id) => after.tasks.find((t) => t.task === id).blocked_by);
  for (const id of order) {
    const t = after.tasks.find((x) => x.task === id);
    const row = byId.get(id);
    if (row && !isOpen(row)) continue;
    if (t.due === null) continue;
    for (const b of t.blocked_by) {
      const bt = after.tasks.find((x) => x.task === b);
      const brow = byId.get(b);
      if (!bt || bt.due === null || (brow && !isOpen(brow))) continue;
      const earliest = parseDate(bt.due) + gap;
      if (parseDate(t.due) >= earliest) continue;
      if (proposed.dependencies.propagation === "push-past-blocker" && !(option.dues ?? []).some((d) => d.task === id)) {
        const due = fmt(cal.nextWorking(earliest));
        for (const x of proposed.exceptions) if (x.task === id && x.effect === "date-override" && (x.status ?? "active") === "active") x.status = "superseded";
        const task = proposed.tasks.find((x) => x.id === id);
        const anchorName_ = task.anchor === "fixed" ? "EA" : task.anchor;
        const x = { id: nextExceptionId(proposed.exceptions), task: id, rule: `${task.name} by ${task.lead_time ?? "its lead time"}`, effect: "date-override", due, approved_by: option.approved_by ?? null, plan_version: option.plan_version, option: option.option ?? null, anchor: { name: anchorName_, date: proposed.anchors[anchorName_] }, reason: `pushed past its blocker ${b} (due ${bt.due})`, status: "active" };
        proposed.exceptions.push(x);
        exceptionLog.added.push({ id: x.id, task: id, effect: x.effect, rule: x.rule, due, pushed_by: b });
        why.set(id, `pushed past its blocker ${b}, due ${bt.due} (exception ${x.id})`);
        after = computeDues(proposed);
        t.due = due;
      } else conflicts.push({ task: id, blocked_by: b, due: t.due, blocker_due: bt.due, short_by_days: earliest - parseDate(t.due) });
    }
  }
  after = computeDues(proposed);

  // Row changes against the tracker as it stands.
  const rowChanges = [];
  const warnings = [];
  const afterBy = new Map(after.tasks.map((t) => [t.task, t]));
  const currentBy = new Map(current.tasks.map((t) => [t.task, t]));
  for (const r of rows) {
    if (r.condition) {
      if (r.parent && droppedIds.has(r.parent) && isOpen(r)) {
        rowChanges.push({ launch: rules.launch, task: r.task, column: "Status", old: r.status, new: "Waived", because: `its parent ${r.parent} is dropped from scope in ${label}` });
        rowChanges.push({ launch: rules.launch, task: r.task, column: "Waiver", old: r.waiver, new: `Dropped with ${r.parent} in ${label}`, because: `its parent ${r.parent} is dropped from scope in ${label}` });
        if (!droppedConditions.includes(r.task)) droppedConditions.push(r.task);
      }
      continue;
    }
    const a = afterBy.get(r.task);
    const d = dropped.find((x) => x.task === r.task);
    if (d) {
      if (r.status !== "Waived") rowChanges.push({ launch: rules.launch, task: r.task, column: "Status", old: r.status, new: "Waived", because: `dropped from scope in ${label}` });
      rowChanges.push({ launch: rules.launch, task: r.task, column: "Waiver", old: r.waiver, new: `Dropped from scope in ${label}${d.reason ? `: ${d.reason}` : ""}`, because: `dropped from scope in ${label}` });
      continue;
    }
    if (!a) continue;
    if (!isOpen(r)) continue; // a Done or Waived row keeps its dates
    if (a.due === null || a.due === r.due) continue;
    const c = currentBy.get(r.task);
    let because = why.get(r.task);
    if (!because) {
      const anchorMove = anchorChanges.find((x) => x.anchor === a.anchor);
      if (anchorMove) because = `${anchorMove.anchor} moves from ${anchorMove.old} to ${anchorMove.new}, and its lead time counts from ${anchorMove.anchor} (${a.lead_time ?? "lead time"})`;
      else if (c && c.due !== r.due) because = `the tracker's Due differs from the approved plan's ${c.due}`;
      else because = "recomputed from its rule";
    }
    rowChanges.push({ launch: rules.launch, task: r.task, column: "Due", old: r.due, new: a.due, because });
  }
  for (const x of proposed.exceptions) {
    if (x.plan_version !== option.plan_version || (x.status ?? "active") !== "active") continue;
    if (!exceptionLog.added.some((e) => e.id === x.id) && !exceptionLog.kept.includes(x.id) && !exceptionLog.moved.includes(x.id)) continue;
    const r = byId.get(x.task);
    if (!r) continue;
    const text = x.effect === "date-override"
      ? `${x.rule} excepted: Due ${x.due} (${x.id}, ${label}); decided by ${x.approved_by ?? "not yet decided"}; reason: ${x.reason ?? "not given"}`
      : `${x.rule} waived: ships without ${x.item ?? "its evidence"} (${x.id}, ${label}); decided by ${x.approved_by ?? "not yet decided"}; reason: ${x.reason ?? "not given"}`;
    rowChanges.push({ launch: rules.launch, task: x.task, column: "Waiver", old: r.waiver, new: r.waiver ? `${r.waiver} | ${text}` : text, because: `${x.id}` });
  }
  const newRows = [];
  for (const t of option.add_tasks ?? []) {
    const a = afterBy.get(t.id);
    newRows.push({ Launch: rules.launch, "Task ID": t.id, Task: t.name ?? "", Seat: t.seat ?? "", Gate: t.gate ?? "", "Lead time": t.lead_time ?? "", "Original due": a?.due ?? "", Due: a?.due ?? "", Status: "Not started", "Blocked by": (a?.blocked_by ?? []).join("; "), Blocks: (t.blocks ?? []).join("; "), Deliverable: t.deliverable ?? "" });
  }
  const gateChanges = [];
  for (const g of after.gates) {
    const c = current.gates.find((x) => x.gate === g.gate);
    if (c && c.review_date !== g.review_date) gateChanges.push({ gate: g.gate, name: g.name, review: reviewName(g.name), old: c.review_date, new: g.review_date });
  }

  // What is newly at risk, scored at the as-of date with the proposed dates.
  const asTable = (list) => {
    const header = Object.values(COLUMNS);
    return [header, ...list.map((r) => header.map((h) => {
      const k = Object.keys(COLUMNS).find((key) => COLUMNS[key] === h);
      const v = r[k];
      return Array.isArray(v) ? v.join("; ") : v ?? "";
    }))];
  };
  const changedRows = rows
    .filter((r) => !droppedIds.has(r.task) && !(r.condition && droppedIds.has(r.parent)))
    .map((r) => {
      const ch = rowChanges.find((c) => c.task === r.task && c.column === "Due");
      return { ...r, due: ch ? ch.new : r.due };
    })
    .concat(newRows.map((n) => ({ launch: rules.launch, task: n["Task ID"], name: n.Task, due: n.Due, original_due: n.Due, status: "Not started", blocked_by: n["Blocked by"] ? n["Blocked by"].split("; ") : [], last_update: asOf })));
  const before = score(rules, asTable(rows), asOf);
  const afterScore = score(proposed, asTable(changedRows), asOf);
  const newlyAtRisk = [];
  for (const o of afterScore.rows) {
    const b = before.rows.find((x) => x.task === o.task);
    const was = b ? b.pair_risk ?? b.risk : "green";
    const now = o.pair_risk ?? o.risk;
    if (RANK[now] > RANK[was]) newlyAtRisk.push({ task: o.task, was, now, reason: o.reason });
  }
  const clearedRisk = [];
  for (const b of before.rows) {
    const o = afterScore.rows.find((x) => x.task === b.task);
    const was = b.pair_risk ?? b.risk;
    const now = o ? o.pair_risk ?? o.risk : "dropped";
    if (now === "dropped" || RANK[now] < RANK[was]) clearedRisk.push({ task: b.task, was, now, ...(o ? { reason: o.reason } : {}) });
  }

  const dueChanges = rowChanges.filter((c) => c.column === "Due");
  const noDatesMove = dueChanges.length === 0 && anchorChanges.length === 0 && gateChanges.length === 0;
  const text = optionText({ label, option, anchorChanges, dueChanges, gateChanges, exceptionLog, newlyAtRisk, conflicts, dropped, droppedConditions, newRows, noDatesMove, rows });
  const pv = validateRules(proposed);
  // The current rules validated above, so a failure here comes from what the option asks for.
  if (!pv.ok) refuse(`${label} cannot be applied as written: the rules it would make have these problems: ${pv.errors.join("; ")}. Change the option file, not the rules file`);
  return {
    ok: true,
    command: "effects",
    launch: rules.launch,
    as_of: asOf,
    based_on: proposed.based_on,
    proposes: label,
    no_dates_move: noDatesMove,
    anchor_changes: anchorChanges,
    row_changes: rowChanges,
    new_rows: newRows,
    gate_changes: gateChanges,
    exceptions: exceptionLog,
    conflicts,
    newly_at_risk: newlyAtRisk,
    no_longer_at_risk: clearedRisk,
    launch_dates_after: afterScore.launch_dates,
    text,
    conditions_dropped: droppedConditions,
    warnings: [...rowWarnings, ...warnings, ...pv.warnings],
    proposed_rules: proposed,
  };
}

/** A gate's name as a review: "GA readiness review" stays as it is, "Beta" becomes "Beta review". */
export function reviewName(name) {
  const n = String(name ?? "").trim();
  return /\breview$/i.test(n) ? n : `${n} review`;
}

function optionText({ label, option, anchorChanges, dueChanges, gateChanges, exceptionLog, newlyAtRisk, conflicts, dropped, droppedConditions, newRows, noDatesMove, rows }) {
  const name = (id) => rows.find((r) => r.task === id)?.name;
  const lines = [];
  lines.push(`${option.option ? `Option ${option.option}` : "The re-plan"}${option.label ? `: ${option.label}` : ""} (${label}).`);
  if (noDatesMove) lines.push("No dates move.");
  else {
    for (const a of anchorChanges) lines.push(`${a.anchor} moves from ${a.old ?? "no date"} to ${a.new}.`);
    if (dueChanges.length) {
      lines.push(`${dueChanges.length} task date${dueChanges.length === 1 ? "" : "s"} move${dueChanges.length === 1 ? "s" : ""}:`);
      for (const c of dueChanges) lines.push(`- ${c.task}${name(c.task) ? ` ${name(c.task)}` : ""}: Due ${c.old ?? "none"} to ${c.new}, because ${c.because}.`);
    }
    for (const g of gateChanges) lines.push(`- ${reviewName(g.name)}: ${g.old} to ${g.new}.`);
  }
  if (!anchorChanges.length) lines.push("Launch dates stay as they are.");
  for (const x of exceptionLog.added) lines.push(x.effect === "date-override" ? `New exception ${x.id}: ${x.task} due ${x.due}, an exception to "${x.rule}"${x.pushed_by ? ` (pushed past ${x.pushed_by})` : ""}.` : `New exception ${x.id}: ${x.task} ships without ${x.item ?? "its evidence"}; no date changes.`);
  for (const x of exceptionLog.needs_re_approval) lines.push(`Exception ${x.id} (${x.task}, ${x.rule}, due ${x.due}) needs re-approval: ${x.because}. Until the launch lead keeps, moves, or drops it, ${x.task} counts from its rule.`);
  for (const id of exceptionLog.kept) lines.push(`Exception ${id} is kept against the new date.`);
  for (const id of exceptionLog.dropped) lines.push(`Exception ${id} is dropped.`);
  for (const d of dropped) lines.push(`${d.task} leaves the scope.`);
  for (const c of droppedConditions) lines.push(`Condition ${c} leaves the scope with its parent.`);
  for (const n of newRows) lines.push(`${n["Task ID"]} ${n.Task} is added, due ${n.Due}.`);
  for (const c of conflicts) lines.push(`${c.task} is due ${c.due}, ${c.short_by_days} day${c.short_by_days === 1 ? "" : "s"} before its blocker ${c.blocked_by} (due ${c.blocker_due}) allows.`);
  lines.push(newlyAtRisk.length ? `Newly at risk: ${newlyAtRisk.map((n) => `${n.task} ${n.was} to ${n.now} (${n.reason})`).join("; ")}.` : "Nothing is newly at risk.");
  return lines.join("\n");
}

// ---------- same-week revisions ----------

export const ACTION_FIELDS = ["risk", "status", "owner", "due", "forecast", "blockers", "wait"];
const INDEX_RE = /<!-- launch-calc drafts-index\n([\s\S]*?)\n-->/;

export function draftsFileName(week, revision) {
  return revision === 1 ? `${week}-drafts.md` : `${week}-r${revision}-drafts.md`;
}
function norm(v) {
  if (Array.isArray(v)) return [...v].map((x) => String(x).trim()).filter(Boolean).sort().join(";");
  return String(v ?? "").trim().replace(/\s+/g, " ").toLowerCase();
}
/** Reads the index block a drafts file carries; null when it has none. */
export function readIndex(text) {
  const m = INDEX_RE.exec(String(text ?? ""));
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}
export function indexBlock(index) {
  return `<!-- launch-calc drafts-index\n${JSON.stringify(index)}\n-->`;
}

/** Which items revision N drafts, which it leaves out because the launch lead sent them unchanged, and which earlier drafts are still outstanding.
 *  files: { "<file name>": text } for the week's folder. sent and skipped: { <revision>: [draft numbers] } as the launch lead reported. */
export function revisions({ files, launch, week, revision, items, asOf, sent = {}, skipped = {}, dueWithinDays = 14 }) {
  const w = mustDate(week, "--week");
  if (weekday(w) !== 1) refuse(`--week ${week} is not a Monday`);
  const today = mustDate(asOf, "--as-of");
  if (!Number.isInteger(revision) || revision < 1) refuse("--revision is not a whole number of 1 or more");
  if (files[draftsFileName(week, revision)] !== undefined) refuse(`${draftsFileName(week, revision)} already exists; a revision is never written over`);
  if (!Array.isArray(items)) refuse("the items are not a list");
  const seen = new Set();
  for (const it of items) {
    if (!it || !it.task) refuse("an item has no task");
    if (seen.has(it.task)) refuse(`item ${it.task} is listed twice`);
    seen.add(it.task);
    if (it.risk != null && it.risk !== "" && !["red", "amber", "green"].includes(String(it.risk).toLowerCase())) refuse(`item ${it.task}: risk "${it.risk}" is not red, amber, or green`);
    if (it.status && !STATUSES.some((s) => s.toLowerCase() === String(it.status).toLowerCase())) refuse(`item ${it.task}: status "${it.status}" is not one of ${STATUSES.join(", ")}`);
    for (const k of ["due", "forecast"]) if (it[k] && parseDate(it[k]) === null) refuse(`item ${it.task}: ${k} "${it[k]}" is not a date in the form YYYY-MM-DD`);
    if (typeof it.validated !== "boolean") refuse(`item ${it.task}: validated is not true or false`);
  }
  for (const [k, v] of [...Object.entries(sent), ...Object.entries(skipped)]) if (!(Number(k) >= 1 && Number(k) < revision) || !Array.isArray(v)) refuse(`a sent or skipped report names r${k}, which is not an earlier revision`);

  // Eligible: red, amber, stale, unvalidated, or open and due within the window.
  const eligible = [];
  const notEligible = [];
  for (const it of items) {
    const risk = String(it.risk ?? "").toLowerCase();
    const open = !it.status || OPEN_STATUSES.some((s) => s.toLowerCase() === String(it.status).toLowerCase());
    const due = it.due ? parseDate(it.due) : null;
    const why = [];
    if (open && (risk === "red" || risk === "amber")) why.push(risk);
    if (open && it.stale) why.push("no update since last week");
    if (!it.validated) why.push("nobody validated it");
    if (open && due !== null && due - today <= dueWithinDays) why.push(`due ${it.due}, within ${dueWithinDays} days`);
    if (open && due === null) why.push("no due date: propose one");
    (why.length ? eligible : notEligible).push({ ...it, eligible_because: why });
  }

  // The chain of earlier revisions.
  const chain = [];
  const missing = [];
  for (let k = 1; k < revision; k++) {
    const name = draftsFileName(week, k);
    const text = files[name];
    if (text === undefined) {
      missing.push(`r${k} (${name} is not in the folder)`);
      continue;
    }
    const idx = readIndex(text);
    if (!idx || !Array.isArray(idx.drafts)) missing.push(`r${k} (${name} has no drafts index)`);
    else if (idx.launch !== launch || idx.week !== week || idx.revision !== k) missing.push(`r${k} (${name}'s index is for ${idx.launch} ${idx.week} r${idx.revision})`);
    else chain.push({ revision: k, drafts: idx.drafts });
  }
  const allDrafted = missing.length > 0;
  const drafts = [];
  const outstanding = [];
  const leftOut = [];
  for (const it of eligible) {
    const fields = Object.fromEntries(ACTION_FIELDS.map((f) => [f, f === "blockers" ? it.blockers ?? [] : it[f] ?? null]));
    const entry = { task: it.task, ...fields, eligible_because: it.eligible_because };
    if (allDrafted) {
      drafts.push({ ...entry, reason: `an earlier drafts file is missing: ${missing.join(", ")}; every eligible item is drafted` });
      continue;
    }
    let last = null;
    for (const c of chain) {
      const d = c.drafts.find((x) => x.task === it.task);
      if (d) last = { revision: c.revision, draft: d };
    }
    if (!last) {
      drafts.push({ ...entry, reason: revision === 1 ? "first drafts of the week" : "no earlier revision this week drafted it" });
      continue;
    }
    const changed = ACTION_FIELDS.filter((f) => norm(fields[f]) !== norm(last.draft[f]));
    if (changed.length) {
      drafts.push({ ...entry, reason: `${changed.join(", ")} changed since r${last.revision} draft ${last.draft.draft}`, changed, since: { revision: last.revision, draft: last.draft.draft } });
      continue;
    }
    const wasSent = (sent[last.revision] ?? []).includes(last.draft.draft);
    const wasSkipped = (skipped[last.revision] ?? []).includes(last.draft.draft);
    if (wasSent) leftOut.push({ task: it.task, revision: last.revision, draft: last.draft.draft, why: `unchanged, and r${last.revision} draft ${last.draft.draft} was reported sent` });
    else outstanding.push({ task: it.task, revision: last.revision, draft: last.draft.draft, send_status: wasSkipped ? "skipped" : "not reported sent", text: `still outstanding from r${last.revision}, draft ${last.draft.draft}${wasSkipped ? " (skipped)" : ""}` });
  }
  drafts.forEach((d, i) => (d.draft = i + 1));
  const index = { launch, week, revision, drafts: drafts.map((d) => ({ draft: d.draft, task: d.task, ...Object.fromEntries(ACTION_FIELDS.map((f) => [f, d[f]])) })) };
  return {
    ok: true,
    command: "revisions",
    launch,
    week,
    revision,
    file: draftsFileName(week, revision),
    earlier_missing: missing,
    drafts,
    outstanding,
    left_out: leftOut,
    not_eligible: notEligible.map((n) => n.task),
    index_block: indexBlock(index),
  };
}

// ---------- practice jumps ----------

/** The gates a practice jump crosses: every gate whose review date falls after `from` (the current
 *  practice date) and on or before `to` (the target), in date order, from the approved rules. A tier
 *  with no gates crosses none. After a no-go, call it again on the newly approved rules from the
 *  decision's date: a review moved past the target is no longer crossed, and the re-run of the gate
 *  that said no-go is. */
export function gatesBetween(rules, from, to, { anchors = {} } = {}) {
  const f = mustDate(from, "--from");
  const t = mustDate(to, "--to");
  if (t <= f) refuse(`--to ${to} is not after --from ${from}; a jump goes forward`);
  const d = computeDues(rules, { anchors });
  const dated = d.gates.map((g) => ({ g, n: parseDate(g.review_date) })).sort((a, b) => a.n - b.n || (a.g.gate < b.g.gate ? -1 : 1));
  const crossed = dated.filter((x) => x.n > f && x.n <= t).map((x) => x.g);
  const after = dated.filter((x) => x.n > t).map((x) => x.g);
  const before = dated.filter((x) => x.n <= f).map((x) => x.g);
  const note = !d.gates.length
    ? `tier ${d.tier} has no gates in ${d.plan_version}, so the jump crosses none`
    : crossed.length
      ? `the jump stops at ${crossed.map((g) => `${g.gate} on ${g.review_date}`).join(", then ")}: score that week, draft the packet from the tracker as it stands, and wait for the decider`
      : `no gate review falls after ${from} and on or before ${to}`;
  return { ok: true, command: "gates-between", launch: d.launch, plan_version: d.plan_version, option: d.option, tier: d.tier, from, to, anchors: d.anchors, gates: crossed, after_target: after, already_past: before, note };
}

// ---------- owner response times ----------

const mondayOf = (n) => n - ((weekday(n) + 6) % 7);
const sameName = (a, b) => String(a ?? "").trim().toLowerCase() === String(b ?? "").trim().toLowerCase();
function median(xs) {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** History as JSON lines: the entries, and a note for each line that is not one JSON object (skipped, never guessed). */
export function parseHistory(text) {
  const entries = [];
  const notes = [];
  String(text ?? "").split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    try {
      const v = JSON.parse(line);
      if (v && typeof v === "object" && !Array.isArray(v)) entries.push(v);
      else notes.push(`line ${i + 1} is not one JSON object; skipped`);
    } catch {
      notes.push(`line ${i + 1} is not JSON; skipped`);
    }
  });
  return { entries, notes };
}

/** Owner response times from a launch's week entries: each nudge the launch lead reported sent
 *  (sent: [{ draft, revision, tasks, sent_on, to }]) paired with the owner answer that answers it
 *  (responses: [{ task, owner, on, answers: { week, draft, revision } | null, source }]).
 *
 *  - Nothing is inferred. A week with no entry has no observations. An older entry whose `sent` is
 *    draft numbers only gives no task or date evidence, and is listed under `unavailable`.
 *  - An answer pairs with the latest open nudge for its task, to the same owner, sent before it:
 *    after a repeated reminder the time runs from the last reminder, and the earlier ones are
 *    `superseded`.
 *  - When a task's owner changes (a later nudge to someone else, or an answer from someone else),
 *    the old owner's open nudges for it count as unanswered.
 *  - With both a send date and an answer date the interval is in days. Otherwise it is in weeks,
 *    from the week the nudge went out to the week of the answer, and the output says so.
 *  - A figure that rests on a made-up nudge or answer is `simulated` and kept apart from measured ones. */
export function responseTimes(entries, launch, asOf, { notes: readNotes = [] } = {}) {
  const today = mustDate(asOf, "--as-of");
  if (!Array.isArray(entries)) refuse("the history is not a list of entries");
  const notes = [...readNotes];
  const unavailable = [];
  const nudges = [];
  const answers = [];
  let weeks = 0;
  for (const e of entries) {
    if (e.launch !== launch || e.type !== "week") continue;
    weeks++;
    const week = parseDate(e.week_of);
    if (week === null) {
      notes.push(`a week entry written ${e.at ?? "at an unknown time"} has no week_of date; skipped`);
      continue;
    }
    const src = e.source ?? null;
    const sent = Array.isArray(e.sent) ? e.sent : [];
    const legacy = sent.filter((s) => typeof s === "number");
    if (legacy.length) unavailable.push(`week of ${e.week_of}: sent holds draft numbers only (${legacy.join(", ")}), written before nudges named their tasks and send dates, so it gives no response-time evidence`);
    for (const s of sent) {
      if (!s || typeof s !== "object") continue;
      const tasks = Array.isArray(s.tasks) ? s.tasks.filter((t) => typeof t === "string" && t.trim()) : [];
      if (!tasks.length) {
        unavailable.push(`week of ${e.week_of}: draft ${s.draft ?? "?"} names no task, so it cannot be paired with an answer`);
        continue;
      }
      const sentOn = parseDate(s.sent_on ?? null);
      for (const task of tasks) {
        nudges.push({ task, week: e.week_of, draft: s.draft ?? null, revision: s.revision ?? 1, sent_on: sentOn === null ? null : s.sent_on, to: s.to ?? null, source: s.source ?? src, at: sentOn ?? week, weekN: week, state: "open" });
      }
    }
    for (const r of Array.isArray(e.responses) ? e.responses : []) {
      if (!r || typeof r !== "object" || typeof r.task !== "string") continue;
      const on = parseDate(r.on ?? null);
      answers.push({ task: r.task, owner: r.owner ?? null, on: on === null ? null : r.on, answers: r.answers ?? null, source: r.source ?? src, week: e.week_of, at: on ?? week, weekN: on === null ? week : mondayOf(on) });
    }
  }
  nudges.sort((a, b) => a.at - b.at || a.weekN - b.weekN || (a.revision ?? 0) - (b.revision ?? 0) || (a.draft ?? 0) - (b.draft ?? 0));
  // Nudges before answers on the same day: an answer can answer a nudge sent that morning.
  const timeline = [...nudges.map((ev) => ({ kind: "nudge", ev })), ...answers.map((ev) => ({ kind: "answer", ev }))].sort(
    (x, y) => x.ev.at - y.ev.at || (x.kind === y.kind ? 0 : x.kind === "nudge" ? -1 : 1),
  );

  const pairs = [];
  const unprompted = [];
  const unmatched = [];
  // Only nudges already sent by then: a later nudge to the old owner is a new question.
  const ownerChanged = (task, owner, at, why) => {
    for (const n of nudges) if (n.task === task && n.state === "open" && n.at <= at && n.to && owner && !sameName(n.to, owner)) Object.assign(n, { state: "unanswered", why });
  };
  for (const { kind, ev } of timeline) {
    if (ev.at > today) continue;
    if (kind === "nudge") {
      if (ev.to) ownerChanged(ev.task, ev.to, ev.at, `the task moved to ${ev.to} before the earlier owner answered`);
      continue;
    }
    const a = ev;
    if (a.owner) ownerChanged(a.task, a.owner, a.at, `${a.owner} answered for the task instead: the owner changed`);
    if (a.answers === null || typeof a.answers !== "object") {
      unprompted.push({ task: a.task, owner: a.owner, on: a.on, week: a.week, simulated: a.source === "made-up" });
      continue;
    }
    const ref = a.answers;
    const named = nudges.find((n) => n.task === a.task && n.week === ref.week && n.draft === ref.draft && (n.revision ?? 1) === (ref.revision ?? 1));
    if (!named) {
      unmatched.push({ task: a.task, owner: a.owner, on: a.on, answers: ref, why: `no recorded nudge for ${a.task} is week ${ref.week} r${ref.revision ?? 1} draft ${ref.draft}` });
      continue;
    }
    const open = nudges.filter((n) => n.task === a.task && n.state === "open" && n.at <= a.at && (!n.to || !a.owner || sameName(n.to, a.owner)));
    const latest = open.length ? open[open.length - 1] : null;
    if (!latest) {
      unmatched.push({ task: a.task, owner: a.owner, on: a.on, answers: ref, why: `the nudge it names (week ${ref.week} draft ${ref.draft}) was already answered, closed, or sent after this answer` });
      continue;
    }
    for (const n of open) if (n !== latest) Object.assign(n, { state: "superseded", why: `a later reminder (week ${latest.week} draft ${latest.draft}) was the one answered` });
    latest.state = "answered";
    const days = latest.sent_on && a.on ? a.at - latest.at : null;
    pairs.push({
      task: a.task,
      owner: a.owner ?? latest.to,
      nudge: { week: latest.week, revision: latest.revision, draft: latest.draft, sent_on: latest.sent_on },
      answered_on: a.on,
      answered_week: fmt(a.weekN),
      basis: days === null ? "weeks" : "days",
      days,
      weeks: days === null ? Math.round((a.weekN - latest.weekN) / 7) : null,
      ...(latest !== named ? { repeated_reminder: `the answer names week ${ref.week} draft ${ref.draft}; it is timed from the latest reminder before it` } : {}),
      simulated: latest.source === "made-up" || a.source === "made-up",
    });
  }
  for (const n of nudges) if (n.state === "open" && n.at <= today) Object.assign(n, { state: "unanswered", why: `no answer recorded by ${asOf}` });
  const unanswered = nudges.filter((n) => n.state === "unanswered").map((n) => ({ task: n.task, to: n.to, week: n.week, revision: n.revision, draft: n.draft, sent_on: n.sent_on, why: n.why, simulated: n.source === "made-up" }));
  const superseded = nudges.filter((n) => n.state === "superseded").map((n) => ({ task: n.task, to: n.to, week: n.week, draft: n.draft, why: n.why }));

  // One line per owner, measured apart from simulated.
  const groups = new Map();
  const group = (owner, simulated) => {
    const k = `${String(owner ?? "").trim().toLowerCase()}|${simulated}`;
    if (!groups.has(k)) groups.set(k, { owner: owner ?? "owner not recorded", simulated, answered: 0, days: [], weeks: [], unanswered: 0 });
    return groups.get(k);
  };
  for (const p of pairs) {
    const g = group(p.owner, p.simulated);
    g.answered++;
    (p.basis === "days" ? g.days : g.weeks).push(p.basis === "days" ? p.days : p.weeks);
  }
  for (const u of unanswered) if (u.to) group(u.to, u.simulated).unanswered++;
  const byOwner = [...groups.values()]
    .map((g) => {
      const parts = [];
      if (g.days.length) parts.push(`typically ${plural(median(g.days), "day")} from send to answer (${plural(g.days.length, "answer")} with both dates)`);
      if (g.weeks.length) parts.push(`typically ${plural(median(g.weeks), "week")} (${plural(g.weeks.length, "answer")} timed by week only: a send or answer date was not recorded)`);
      if (!parts.length) parts.push("not measurable: no answer recorded");
      if (g.unanswered) parts.push(`${plural(g.unanswered, "nudge")} unanswered`);
      return {
        owner: g.owner,
        simulated: g.simulated,
        answered: g.answered,
        median_days: median(g.days),
        median_weeks: median(g.weeks),
        unanswered: g.unanswered,
        text: `${g.owner}: ${parts.join("; ")}${g.simulated ? " (SIMULATED: from made-up practice replies, not a measurement)" : ""}`,
      };
    })
    .sort((a, b) => Number(a.simulated) - Number(b.simulated) || (a.owner < b.owner ? -1 : 1));

  const real = pairs.filter((p) => !p.simulated).length;
  if (pairs.some((p) => p.basis === "weeks")) notes.push("some send or answer dates were not recorded, so those intervals are week-level: from the week the nudge went out to the week of the answer");
  const summary = !weeks
    ? `Owner response times: not measurable. History has no week entries for ${launch}.`
    : !pairs.length
      ? `Owner response times: not measurable. No recorded nudge is paired with a recorded answer${unavailable.length ? "; older week entries record draft numbers only" : ""}.`
      : !real
        ? "Owner response times: SIMULATED only. Every figure comes from made-up practice replies; none is a measurement."
        : `Owner response times: measured from ${plural(real, "recorded nudge-and-answer pair")}${pairs.length > real ? ", with simulated figures listed apart" : ""}.`;
  return {
    ok: true,
    command: "responses",
    launch,
    as_of: asOf,
    week_entries: weeks,
    measurable: real > 0,
    simulated_only: pairs.length > 0 && real === 0,
    summary,
    by_owner: byOwner,
    pairs,
    unanswered,
    superseded,
    unprompted,
    unmatched,
    unavailable,
    notes,
  };
}

// ---------- command line ----------
// The command line over lib.mjs. It reads files inside this folder, checks
// every argument against a fixed list, prints JSON, and writes nothing except
// a new rules-v<n>.json when --save names one that does not exist yet, and the
// plan approval date into a rules file that has none (set-anchor). It is
// pre-approved as `node scripts/launch-calc.mjs *`, so it validates its own
// arguments: the permission rule matches the whole command, not its parts.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";

const USAGE = `Usage: node scripts/launch-calc.mjs <command> [--flag value ...]

  help            this text, and the option and items file formats
  holidays        --set us-federal --years 2026,2027
  draft-rules     --playbook <file.md> --launch <name> --tier <n> --ea <date> --ga <date> [--plan-approval <date>] [--as-of <date>] [--holidays us-federal|none] [--save launches/<launch>/rules-v1.json]
                  Refuses an EA before --plan-approval or --as-of (the later of the two); warns "the plan is born overdue" for a Due before it.
  validate-rules  --rules <rules.json>
  dues            --rules <rules.json> [--anchor plan_approval=<date>]   (--anchor is a what-if; it saves nothing)
  set-anchor      --rules launches/<launch>/rules-v<n>[-<A>].json --plan-approval <date>
                  Records the day the launch lead approved this plan version, in its rules file, so tasks counted
                  from plan approval (T01) get a Due that score and effects use. Run it once, when the launch lead
                  approves the version. It fills only an empty plan_approval: it refuses a file that records a
                  different date, and a file a later rules-v<m> has replaced. Every other value stays as approved.
  score           --rules <rules.json> --rows <tracker.csv|rows.json> --as-of <date> [--last-score <date>]
  slips           --rows <tracker.csv|rows.json> --launch <name> --as-of <date>   (refuses a launch with no tracker row)
  effects         --rules <rules.json> --rows <tracker.csv|rows.json> --option <option.json> --as-of <date> [--save launches/<launch>/rules-v<n>[-<A>].json]
  revisions       --dir launches/<launch>/weeks --launch <name> --week <monday> --revision <n> --items <items.json> --as-of <date> [--sent r1:1,2] [--skipped r1:3]
  gates-between   --rules <rules.json> --from <current date> --to <target date> [--anchor EA=<date>]
  responses       --history history/<launch|practice>-history.jsonl --launch <name> --as-of <date>   (no file yet: ok, with "note")

Dates are YYYY-MM-DD. Files are paths inside this folder under launches/, practice/, tracker/, or playbook/;
--history is history/launch-history.jsonl or history/practice-history.jsonl, read only.
Rows are the tracker CSV, or a JSON file of the Tracker tab as read (header row first, or rows keyed by column).
score, slips, and effects refuse (exit 1) a tracker with no row for the launch, naming the Launch values it has;
rows whose Launch differs only in case or spacing are used, with a warning. A row with a value that cannot be read
(a date not YYYY-MM-DD, an unknown Status) is never scored: it is listed under unscored and in warnings.
In score, launch_dates[].realistic is true, false, or null: null when a task counted from that date, or a gate
item, has no readable tracker row (not_judged says which), so the date is neither confirmed nor denied.

Exit codes: 0 done; 1 refused (JSON with "refused" on stdout) or rules that do not validate; 2 bad arguments.`;

const FORMATS = {
  option: {
    option: "A (one capital letter), or omit when there is one way",
    label: "a few words: Hold EA and waive the four-week pricing rule",
    plan_version: "the new plan's version, v<n>, after the current rules' version",
    anchors: { EA: "YYYY-MM-DD, only when the option moves it", GA: "YYYY-MM-DD" },
    dues: [{ task: "T04", due: "YYYY-MM-DD", rule: "the rule it excepts (Pricing final by EA - 4w)", reason: "as given, or null", approved_by: "who decided, or null" }],
    waivers: [{ task: "T08", item: "what ships without its evidence", rule: "the rule it excepts", reason: "as given, or null" }],
    exceptions: { keep: ["X01"], move: [{ id: "X02", due: "YYYY-MM-DD" }], drop: ["X03"] },
    add_tasks: [{ id: "T23", name: "", seat: "", lead_time: "GA - 2w (or due: YYYY-MM-DD)", blocks: [], blocked_by: [], gate: null, deliverable: "" }],
    drop_tasks: [{ task: "T19", reason: "" }],
    approved_by: "who decided the option, when they already have, else null",
    reason: "the decider's reason, as given, or null",
  },
  items: [{ task: "T04", owner: "", risk: "red | amber | green", status: "Not started | In progress | Done | Waived", due: "YYYY-MM-DD or null", forecast: "YYYY-MM-DD or null", blockers: ["tasks it waits on"], wait: "the specific wait, in a few words", validated: true, stale: false }],
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NAME = /^[a-z0-9][a-z0-9-]{0,40}$/;
const FILE = /^(launches|practice|tracker|playbook)\/([A-Za-z0-9_-][A-Za-z0-9._-]*\/)*[A-Za-z0-9_-][A-Za-z0-9._-]*\.(json|csv|md)$/;
const DIR = /^(launches|practice)\/[a-z0-9][a-z0-9-]*\/(weeks|[a-z0-9][a-z0-9-]*\/weeks)$/;
const SAVE = /^(launches|practice)\/[a-z0-9][a-z0-9-]*\/rules-v\d{1,3}(-[A-Z])?\.json$/;
const HISTORY = /^history\/(launch|practice)-history\.jsonl$/;
const REPORT = /^r\d{1,2}:\d{1,3}(,\d{1,3}){0,99}$/;
const VALUE = {
  "--set": /^us-federal$/,
  "--years": /^\d{4}(,\d{4}){0,4}$/,
  "--playbook": FILE,
  "--launch": NAME,
  "--tier": /^[1-9]$/,
  "--ea": DATE,
  "--ga": DATE,
  "--plan-approval": DATE,
  "--holidays": /^(us-federal|none)$/,
  "--save": SAVE,
  "--rules": FILE,
  "--rows": FILE,
  "--option": FILE,
  "--items": FILE,
  "--anchor": /^(EA|GA|plan_approval)=\d{4}-\d{2}-\d{2}$/,
  "--as-of": DATE,
  "--last-score": DATE,
  "--dir": DIR,
  "--week": DATE,
  "--revision": /^[1-9]\d?$/,
  "--sent": REPORT,
  "--skipped": REPORT,
  "--from": DATE,
  "--to": DATE,
  "--history": HISTORY,
};
const RULES_FILE = /^(launches|practice)\/([a-z0-9][a-z0-9-]*)\/rules-v(\d{1,3})(-[A-Z])?\.json$/;
const REPEATABLE = new Set(["--anchor", "--sent", "--skipped"]);
const COMMANDS = {
  help: { required: [], optional: [] },
  holidays: { required: ["--set", "--years"], optional: [] },
  "draft-rules": { required: ["--playbook", "--launch", "--tier", "--ea", "--ga"], optional: ["--plan-approval", "--as-of", "--holidays", "--save"] },
  "validate-rules": { required: ["--rules"], optional: [] },
  dues: { required: ["--rules"], optional: ["--anchor"] },
  "set-anchor": { required: ["--rules", "--plan-approval"], optional: [] },
  score: { required: ["--rules", "--rows", "--as-of"], optional: ["--last-score"] },
  slips: { required: ["--rows", "--launch", "--as-of"], optional: [] },
  effects: { required: ["--rules", "--rows", "--option", "--as-of"], optional: ["--save"] },
  revisions: { required: ["--dir", "--launch", "--week", "--revision", "--items", "--as-of"], optional: ["--sent", "--skipped"] },
  "gates-between": { required: ["--rules", "--from", "--to"], optional: ["--anchor"] },
  responses: { required: ["--history", "--launch", "--as-of"], optional: [] },
};

class Usage extends Error {}

export function parseArgs(argv) {
  if (argv.length > 40) throw new Usage("too many arguments");
  const [command, ...rest] = argv;
  const spec = COMMANDS[command];
  if (!spec) throw new Usage(command ? `unknown command "${command}"` : "no command");
  const flags = {};
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i];
    const value = rest[i + 1];
    if (![...spec.required, ...spec.optional].includes(flag)) throw new Usage(`${command} does not take ${flag}`);
    if (value === undefined) throw new Usage(`${flag} needs a value`);
    if (value.length > 200 || !VALUE[flag].test(value) || value.includes("..")) throw new Usage(`${flag} "${value}" is not allowed here`);
    if (REPEATABLE.has(flag)) (flags[flag] ??= []).push(value);
    else if (flag in flags) throw new Usage(`${flag} is given twice`);
    else flags[flag] = value;
  }
  for (const f of spec.required) if (!(f in flags)) throw new Usage(`${command} needs ${f}`);
  return { command, flags };
}

function readText(path) {
  if (!existsSync(path)) throw new Refusal(`${path} does not exist`);
  return readFileSync(path, "utf8");
}
function readJson(path) {
  try {
    return JSON.parse(readText(path));
  } catch (e) {
    if (e instanceof Refusal) throw e;
    throw new Refusal(`${path} is not valid JSON: ${e.message}`);
  }
}
const readRows = (path) => (path.endsWith(".csv") ? readText(path) : readJson(path));
function save(path, rules) {
  if (existsSync(path)) throw new Refusal(`${path} already exists; a plan version's rules are never written over`);
  const base = path.replace(/^.*\/rules-/, "rules-");
  const want = `rules-${rules.plan_version}${rules.option ? `-${rules.option}` : ""}.json`;
  if (base !== want) throw new Refusal(`these rules are ${rules.plan_version}${rules.option ? ` option ${rules.option}` : ""}, so the file is ${want}, not ${base}`);
  if (!path.split("/")[1] || path.split("/")[1] !== rules.launch) throw new Refusal(`these rules are for launch ${rules.launch}, not the folder in ${path}`);
  // The launch's folder may not exist yet on a first plan.
  mkdirSync(path.slice(0, path.lastIndexOf("/")), { recursive: true });
  writeFileSync(path, `${JSON.stringify(rules, null, 2)}\n`);
  return path;
}
function reports(list = []) {
  const out = {};
  for (const r of list) {
    const [rev, nums] = r.slice(1).split(":");
    out[Number(rev)] = [...(out[Number(rev)] ?? []), ...nums.split(",").map(Number)];
  }
  return out;
}

export function run({ command, flags }) {
  switch (command) {
    case "help":
      return { ok: true, command, usage: USAGE, formats: FORMATS };
    case "holidays":
      return { ok: true, command, set: "us-federal", holidays: flags["--years"].split(",").map(Number).flatMap(usFederalHolidays) };
    case "draft-rules": {
      const { rules, review, warnings } = draftRules({
        playbook: readText(flags["--playbook"]),
        launch: flags["--launch"],
        tier: Number(flags["--tier"]),
        ea: flags["--ea"],
        ga: flags["--ga"],
        planApproval: flags["--plan-approval"] ?? null,
        asOf: flags["--as-of"] ?? null,
        holidays: flags["--holidays"] === "none" ? "none" : flags["--holidays"] ?? null,
      });
      const v = validateRules(rules);
      const saved = flags["--save"] ? save(flags["--save"], rules) : null;
      return { ok: v.ok, command, saved, review, errors: v.errors, warnings: [...warnings, ...v.warnings], unsupported: v.unsupported, dues: v.ok ? computeDues(rules) : null, rules };
    }
    case "validate-rules":
      return { command, ...validateRules(readJson(flags["--rules"])) };
    case "dues": {
      const anchors = Object.fromEntries((flags["--anchor"] ?? []).map((a) => a.split("=")));
      return { ok: true, command, ...computeDues(readJson(flags["--rules"]), { anchors }) };
    }
    case "set-anchor": {
      const path = flags["--rules"];
      const m = RULES_FILE.exec(path);
      if (!m) throw new Refusal(`set-anchor writes only a rules file, launches/<launch>/rules-v<n>[-<A>].json or the same under practice/, not ${path}`);
      const rules = readJson(path);
      if (rules.launch !== m[2]) throw new Refusal(`${path} holds rules for launch ${rules.launch}, not ${m[2]}`);
      const want = `rules-${rules.plan_version}${rules.option ? `-${rules.option}` : ""}.json`;
      if (!path.endsWith(`/${want}`)) throw new Refusal(`${path} holds ${rules.plan_version}${rules.option ? ` option ${rules.option}` : ""}, whose file is ${want}`);
      // Never write over an earlier file: once a later version exists, this one is history.
      const dir = path.slice(0, path.lastIndexOf("/"));
      const later = readdirSync(dir).filter((n) => { const x = /^rules-v(\d{1,3})(-[A-Z])?\.json$/.exec(n); return x && Number(x[1]) > Number(m[3]); });
      if (later.length) throw new Refusal(`${path} is an earlier plan version: ${later.sort().join(", ")} came after it. Record plan approval in the version the launch lead approved`);
      const out = setPlanApproval(rules, flags["--plan-approval"]);
      if (out.changed) {
        writeFileSync(`${path}.tmp`, `${JSON.stringify(out.rules, null, 2)}\n`);
        renameSync(`${path}.tmp`, path);
      }
      return { ok: true, command, rules: path, plan_approval: flags["--plan-approval"], changed: out.changed, note: out.changed ? "plan_approval recorded" : "plan_approval was already this date; nothing written", warnings: out.warnings, dues: computeDues(out.rules) };
    }
    case "score":
      return score(readJson(flags["--rules"]), readRows(flags["--rows"]), flags["--as-of"], { lastScore: flags["--last-score"] ?? null });
    case "slips":
      return slips(readRows(flags["--rows"]), flags["--launch"], flags["--as-of"]);
    case "effects": {
      const out = effects(readJson(flags["--rules"]), readRows(flags["--rows"]), readJson(flags["--option"]), flags["--as-of"]);
      out.saved = flags["--save"] ? save(flags["--save"], out.proposed_rules) : null;
      return out;
    }
    case "gates-between": {
      const anchors = Object.fromEntries((flags["--anchor"] ?? []).map((a) => a.split("=")));
      return gatesBetween(readJson(flags["--rules"]), flags["--from"], flags["--to"], { anchors });
    }
    case "responses": {
      // A launch with no history file yet has no observations, which is not an error.
      const present = existsSync(flags["--history"]);
      const { entries, notes } = parseHistory(present ? readFileSync(flags["--history"], "utf8") : "");
      const out = responseTimes(entries, flags["--launch"], flags["--as-of"], { notes });
      return present ? out : { ...out, note: "no history file yet" };
    }
    case "revisions": {
      const dir = flags["--dir"];
      const files = {};
      if (existsSync(dir)) for (const name of readdirSync(dir)) if (/-drafts\.md$/.test(name)) files[name] = readFileSync(`${dir}/${name}`, "utf8");
      return revisions({
        files,
        launch: flags["--launch"],
        week: flags["--week"],
        revision: Number(flags["--revision"]),
        items: readJson(flags["--items"]),
        asOf: flags["--as-of"],
        sent: reports(flags["--sent"]),
        skipped: reports(flags["--skipped"]),
      });
    }
  }
}

export function main(argv) {
  let parsed;
  try {
    parsed = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`${e.message}\n\n${USAGE}\n`);
    return 2;
  }
  try {
    const out = run(parsed);
    process.stdout.write(`${JSON.stringify(out, null, 2)}\n`);
    return out.ok === false ? 1 : 0;
  } catch (e) {
    if (!(e instanceof Refusal)) throw e;
    process.stdout.write(`${JSON.stringify({ ok: false, command: parsed.command, refused: e.message }, null, 2)}\n`);
    process.stderr.write(`Refused: ${e.message}\n`);
    return 1;
  }
}

process.exitCode = main(process.argv.slice(2));
