#!/usr/bin/env node
// Render docs/plan/issues.json to docs/plan/ISSUE_BACKLOG.md.
// Usage: node docs/plan/render-backlog.mjs > docs/plan/ISSUE_BACKLOG.md
import { readFileSync } from "node:fs";
const d = JSON.parse(readFileSync(new URL("./issues.json", import.meta.url), "utf8"));
const byKey = Object.fromEntries(d.issues.map((i) => [i.key, i]));
const agentOf = (i) => (i.labels.find((l) => l.startsWith("agent:")) ?? "agent:?").slice(6);

let out = `# Soteria Issue Backlog\n\nGenerated from \`issues.json\` (canonical). ${d.issues.length} issues in ${d.epics.length} epics. Sol creates these on GitHub in INF-01.\n\n`;
out += `## Summary by phase\n\n| Phase | Key | Title | Agent | Milestone | Depends on |\n|---|---|---|---|---|---|\n`;
for (const i of [...d.issues].sort((a, b) => a.phase - b.phase || a.key.localeCompare(b.key))) {
  out += `| ${i.phase} | ${i.key} | ${i.title} | ${agentOf(i)} | ${i.milestone} | ${i.depends_on.join(", ") || "—"} |\n`;
}
out += `\n## Epics\n\n`;
for (const e of d.epics) {
  out += `### ${e.key} — ${e.title}\n\nMilestone: ${e.milestone}. Labels: ${e.labels.map((l) => `\`${l}\``).join(" ")}.\n\n`;
  for (const c of e.children) out += `- ${c} ${byKey[c].title.replace(/^(US|INF)-\d+ /, "")} (${agentOf(byKey[c])})\n`;
  out += `\n`;
}
out += `## Issues\n\n`;
for (const i of d.issues) {
  out += `### ${i.key} — ${i.title}\n\n**Labels:** ${i.labels.map((l) => `\`${l}\``).join(" ")}  \n**Milestone:** ${i.milestone} · **Phase:** ${i.phase} · **Depends on:** ${i.depends_on.join(", ") || "none"}\n\n${i.body}\n\n---\n\n`;
}
process.stdout.write(out);
