// Runs before every test file: points each place HeyTerm writes outside its own folder (Claude
// Code's settings and records, Grok's and Cursor's hook files) at a private folder, so a test that
// forgets to pass its own paths cannot change the user's real files. On 26 October 2026 four
// uninstaller tests did, and every test run took HeyTerm's hooks out of ~/.grok and ~/.cursor.

import { mkdtempSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const privateHome = mkdtempSync(path.join(os.tmpdir(), "heyterm-test-home-"));
process.env.CLAUDE_CONFIG_DIR = path.join(privateHome, ".claude");
process.env.GROK_HOME = path.join(privateHome, ".grok");
process.env.HEYTERM_CLAUDE_SETTINGS_PATH = path.join(privateHome, ".claude", "settings.json");
process.env.HEYTERM_CLAUDE_SESSIONS_DIRECTORY = path.join(privateHome, ".claude", "sessions");
process.env.HEYTERM_GROK_HOOKS_PATH = path.join(privateHome, ".grok", "hooks", "heyterm.json");
process.env.HEYTERM_CURSOR_HOOKS_PATH = path.join(privateHome, ".cursor", "hooks.json");
