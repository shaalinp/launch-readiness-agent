#!/usr/bin/env node
// Records the connector a board system is reached through, once a person
// names it: node scripts/bind-system.mjs <systemId> <connector> [location]
//
// Rewrites connections.json: the system becomes "bound", and the connector's
// actions for the classes the workflow needs (read, write, append, create)
// are added with their tool-name suffixes, which is what the outbound hook
// allows. <location> is which sheet, folder, or file: a URL or id for a
// connector, a path in this folder for "local-file". A system that is
// a file or folder in this bundle is bound with
//   node scripts/bind-system.mjs <systemId> local-file <path>
// and needs no connector and no hook rule: the agent's own file tools reach it.
// Run with no arguments to list systems and connectors.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const path = join(root, "connections.json");
const file = JSON.parse(readFileSync(path, "utf8"));
const systems = file.systems ?? [];
const CONNECTORS = [
  {
    "id": "google-sheets",
    "name": "Google Sheets",
    "aliases": [
      "Sheets",
      "Google Sheet",
      "GSheets"
    ],
    "connector": "claude-ai",
    "actions": {
      "read-values": {
        "actionClass": "read",
        "tools": [
          "get_spreadsheet",
          "get_values"
        ],
        "route": "mcp",
        "runtimes": [
          "claude-code"
        ],
        "constraints": []
      },
      "update-values": {
        "actionClass": "write",
        "tools": [
          "update_values",
          "update_formulas",
          "batch_clear_values"
        ],
        "route": "mcp",
        "runtimes": [
          "claude-code"
        ],
        "constraints": [
          "Read the header row first and write only the columns it has; a write that adds or renames columns changes the shape everyone else reads",
          "Google Sheets drops trailing empty cells on read, so a read-back check that counts columns per row must treat missing trailing cells as empty, not as a short row",
          "update_spreadsheet (spreadsheets.batchUpdate), insert_dimension and copy_sheet_to_another_spreadsheet are not declared here: they add and delete sheets, rows and columns, or copy a sheet into another spreadsheet, so each is judged like any undeclared write and asks a person"
        ]
      },
      "append-rows": {
        "actionClass": "append",
        "tools": [
          "append_values"
        ],
        "route": "mcp",
        "runtimes": [
          "claude-code"
        ],
        "constraints": [
          "Appends land after the last non-empty row of the range's sheet; pass the sheet name, not a single cell, as the range"
        ]
      }
    }
  },
  {
    "id": "google-drive",
    "name": "Google Drive",
    "aliases": [
      "Drive",
      "GDrive"
    ],
    "connector": "claude-ai",
    "actions": {
      "read-files": {
        "actionClass": "read",
        "tools": [
          "search_files",
          "list_recent_files",
          "get_file_metadata",
          "get_file_permissions",
          "read_file_content",
          "download_file_content"
        ],
        "route": "mcp",
        "runtimes": [
          "claude-code"
        ],
        "constraints": []
      },
      "create-file": {
        "actionClass": "create",
        "tools": [
          "create_file",
          "copy_file"
        ],
        "route": "mcp",
        "runtimes": [
          "claude-code"
        ],
        "constraints": []
      }
    }
  }
];
const LOCAL_FILE = "local-file";
const LOCAL_FILE_NAME = "Files in this folder";

const [systemId, wanted, locationArg] = process.argv.slice(2);
if (!systemId || !wanted) {
  console.log("Systems:");
  for (const s of systems) console.log(`  ${s.systemId}  ${s.name}  ${s.status}${s.connectorName ? ` (${s.connectorName}${s.location ? `: ${s.location}` : ""})` : ""}  [${s.actions.join(", ")}]`);
  console.log("Connectors:");
  console.log(`  ${LOCAL_FILE}  ${LOCAL_FILE_NAME}  read, write, append, create (a path in this folder as the third argument)`);
  for (const c of CONNECTORS) console.log(`  ${c.id}  ${c.name}  ${Object.values(c.actions).map((a) => a.actionClass).join(", ")}`);
  console.log(`Usage: node scripts/bind-system.mjs <systemId> <connector> [location]`);
  process.exit(systemId || wanted ? 1 : 0);
}
const system = systems.find((s) => s.systemId === systemId);
if (!system) {
  console.error(`No system "${systemId}" in connections.json. Run with no arguments to list them.`);
  process.exit(1);
}
const location = locationArg?.trim() || undefined;
// The live write gate (CLAUDE.md, "Live writes").
const gate = await import("./write-gate.mjs");
const openWrites = gate.openTxns();
if (openWrites.length) {
  console.error(`Not bound: live write transaction ${openWrites[0].id} is open. Finish or discard it first (node scripts/reconcile.mjs --status). connections.json is unchanged.`);
  process.exit(1);
}
function saveConnections() {
  if (systemId === "sys-tracker") {
    const dest = !system.location
      ? null
      : system.connector === LOCAL_FILE
        ? gate.destinationFrom(system.location)
        : system.connector === "google-sheets" && gate.normalizeSheetId(system.location)
          ? { kind: "sheets", spreadsheetId: gate.normalizeSheetId(system.location), tab: gate.TRACKER_TAB }
          : null;
    let policy = gate.emptyPolicy();
    if (existsSync(join(root, gate.POLICY_PATH))) {
      const loaded = gate.loadPolicy();
      if (!loaded.ok) {
        console.error(`Not bound: ${loaded.problem} connections.json is unchanged.`);
        process.exit(1);
      }
      policy = loaded.policy;
    }
    if (dest && gate.classify(policy, dest) === "practice") {
      console.error(`Not bound: ${gate.describeDestination(dest)} is a practice launch's tracker, so it cannot be the live one. connections.json is unchanged.`);
      process.exit(1);
    }
    // A live tracker a launch already writes stays where it is: moving it would
    // leave the launch's rows and its transactions pointing at the old one.
    const inUse = policy.live_tracker && !gate.sameDestination(policy.live_tracker, dest) ? gate.liveTrackerInUse(policy) : null;
    if (inUse) {
      console.error(`Not bound: the live tracker is ${gate.describeDestination(policy.live_tracker)}, and ${inUse}, so it is not re-pointed. A new tracker means a new launch; a person decides that. connections.json is unchanged.`);
      process.exit(1);
    }
    policy.live_tracker = dest;
    writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
    gate.writeJsonAtomic(gate.POLICY_PATH, policy);
    return;
  }
  writeFileSync(path, JSON.stringify(file, null, 2) + "\n");
}
// Unbind first: drop this system from every connection, and with it any
// action only this system needed. An action a step named has no forSystems
// and stays. A connection left with no actions goes.
function unbind() {
  for (const conn of file.connections) {
    conn.systems = (conn.systems ?? []).filter((id) => id !== systemId);
    if (!conn.systems.length) delete conn.systems;
    conn.actions = conn.actions.filter((a) => {
      if (!a.forSystems) return true;
      a.forSystems = a.forSystems.filter((id) => id !== systemId);
      if (a.forSystems.length) return true;
      return false;
    });
  }
  file.connections = file.connections.filter((conn) => conn.actions.length);
}
const lower = wanted.toLowerCase();
if (lower === LOCAL_FILE || lower === LOCAL_FILE_NAME.toLowerCase()) {
  if (!location) {
    console.error(`A file in this folder needs its path: node scripts/bind-system.mjs ${systemId} ${LOCAL_FILE} <path>. connections.json is unchanged.`);
    process.exit(1);
  }
  if (location.startsWith("/") || location.startsWith("..") || location.includes("/../")) {
    console.error(`The path has to be inside this folder, relative to it (${location} is not). connections.json is unchanged.`);
    process.exit(1);
  }
  unbind();
  system.status = "bound";
  system.connector = LOCAL_FILE;
  system.connectorName = LOCAL_FILE_NAME;
  system.location = location;
  saveConnections();
  const exists = existsSync(join(root, location));
  console.log(`${system.name} is ${location} in this folder${exists ? "" : " (it does not exist yet; the step that writes it creates it)"}. No connector is involved; ${systemId === "sys-tracker" ? "read it with Read; changes go through a staged write (CLAUDE.md, \"Live writes\")" : "read and edit it with your file tools"}.`);
  process.exit(0);
}
const connector = CONNECTORS.find((c) => c.id === lower || c.name.toLowerCase() === lower || c.aliases.some((a) => a.toLowerCase() === lower));
if (!connector) {
  console.error(`No connector "${wanted}" is known here. Run with no arguments to list them. A tool not in the list has to be added in the studio and the bundle exported again.`);
  process.exit(1);
}
// This bundle was exported for Claude Code on this computer.
const CONNECTOR_RULE = "allow";
if (connector.connector === "claude-ai" && CONNECTOR_RULE === "refuse") {
  console.error(`Not bound: ${connector.name} is a claude.ai connector, the person's own connection in the desktop app, and Claude Code on this computer cannot reach it. connections.json is unchanged. Export this workflow for Claude Code on this computer, or bind ${system.name} to a connector with a hosted server.`);
  process.exit(1);
}
if (connector.connector === "claude-ai" && CONNECTOR_RULE === "warn") {
  console.warn(`Note: ${connector.name} is a claude.ai connector, the person's own connection in the desktop app. Whether a cloud routine's session sees it is not verified; test one run before relying on it.`);
}
const classes = system.actions.length ? system.actions : ["read"];
const supported = new Set(Object.values(connector.actions).map((a) => a.actionClass));
const missing = classes.filter((c) => !supported.has(c));
if (missing.length) {
  console.error(`Not bound: ${connector.name} has no action for ${missing.join(", ")}, and the workflow needs ${classes.join(", ")} on ${system.name}. connections.json is unchanged. Bind it to a connector that can, or change what the workflow does to it.`);
  process.exit(1);
}
const actionIds = Object.entries(connector.actions).filter(([, a]) => classes.includes(a.actionClass)).map(([id]) => id);
unbind();
let conn = file.connections.find((c) => c.entryId === connector.id);
if (!conn) {
  conn = { entryId: connector.id, name: connector.name, setupCost: "one-click", ...(connector.connector ? { connector: connector.connector } : {}), actions: [] };
  file.connections.push(conn);
}
conn.systems = [...new Set([...(conn.systems ?? []), systemId])];
for (const actionId of actionIds) {
  const existing = conn.actions.find((a) => a.actionId === actionId);
  if (existing) {
    if (existing.forSystems && !existing.forSystems.includes(systemId)) existing.forSystems.push(systemId);
    continue;
  }
  const a = connector.actions[actionId];
  conn.actions.push({ actionId, route: a.route, actionClass: a.actionClass, tools: a.tools, forSystems: [systemId], runtimes: a.runtimes, ...(a.constraints.length ? { constraints: a.constraints } : {}) });
}
system.status = "bound";
system.connector = connector.id;
system.connectorName = connector.name;
if (location) system.location = location;
else delete system.location;
saveConnections();
console.log(`${system.name} is bound to ${connector.name} for ${classes.join(", ")}: ${actionIds.join(", ")}.${location ? ` Location: ${location}.` : ` Which sheet or folder is not recorded: once the person says, run this again with it as the third argument.`} The outbound hook now allows ${actionIds.flatMap((id) => connector.actions[id].tools).join(", ")} on any server.`);
