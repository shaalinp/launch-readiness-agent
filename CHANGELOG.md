# Changelog

Each release has a zip, checksums and a build-provenance attestation on its GitHub release page. SECURITY.md says how to check them.

## v0.1.0

The first public release.

- **What it does:** turns a launch playbook into a plan with owners and dates, scores every task red, amber or green each week, drafts the nudges and the weekly report, prepares gate packets, re-plans when a date moves, and runs a retro that proposes playbook edits. It drafts; you send.
- **Practice launches:** you play out made-up weeks in a separate tracker and history. Nothing a practice run writes touches a live launch.
- **Live launches:** the tracker changes only through a staged, checked write that is read back. Made-up answers are refused.
- **Storage:** the tracker, the playbook and the launch folder are files in this folder by default. Google Sheets and Google Drive are optional, through Claude's connectors.
- **Tests:** the tests in `tests/` run on every change, with no network and nothing to install.
