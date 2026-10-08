# Hermes Mobile — App Design v1

Design for the Hermes companion app: one phone app that connects to your Hermes gateways and covers the features a phone needs. This is a visual design for review. No app code yet.

- **Canvas (review here):** `design/canvas/project/` holds the source. The index is `canvas.json`. Each `*.dc.html` is one 390 × 844 screen, except `Main.dc.html`, the overview.
- **Status:** draft for approval. Dark theme only. Sample data is placeholder.

## Information architecture

Five bottom tabs. Anything that is not a tab sits behind Chat or Control.

| Tab | What it holds |
| --- | --- |
| **Chat** | Conversation with the active bot, sessions, model and reasoning, approvals, voice, review, artifacts |
| **Bots** | Roster of Hermes profiles, New bot, bot profile, group chats |
| **Inbox** | Everything waiting for you: approvals, agent questions, pairing requests, group "needs you", failed runs, cron output |
| **Tasks** | Cron jobs, Kanban board and task drawer, goals, loops, heartbeats, batch |
| **Control** | Gateways, status, memory, skills and toolsets, tools and MCP, channels, pairing, webhooks, analytics, logs, config, security and keys, settings and system |

## Screen index

| # | File | Screen | Tab |
| --- | --- | --- | --- |
| — | `Main.dc.html` | Overview and open decisions | — |
| 01 | `connect.dc.html` | Connect to a gateway | onboarding |
| 02 | `gateways.dc.html` | Gateways (local, remote, Cloud, SSH) | Control |
| 03 | `chat.dc.html` | Chat with streaming, tool activity, subagents | Chat |
| 04 | `approval.dc.html` | Command approval sheet | Chat |
| 05 | `clarify.dc.html` | Agent question sheet | Chat |
| 06 | `turn-failed.dc.html` | Turn failed, recovery actions | Chat |
| 07 | `model.dc.html` | Model, reasoning, fallback sheet | Chat |
| 08 | `sessions.dc.html` | Sessions list, filters, projects | Chat |
| 09 | `session-detail.dc.html` | Session history, checkpoints, rollback | Chat |
| 10 | `voice.dc.html` | Voice mode | Chat |
| 11 | `review.dc.html` | Review changes (git diffs, worktrees) | Chat |
| 12 | `artifacts.dc.html` | Artifacts gallery and preview rail | Chat |
| 13 | `bots.dc.html` | Bots roster | Bots |
| 14 | `new-bot.dc.html` | New bot, with advanced options | Bots |
| 15 | `bot-profile.dc.html` | Bot profile | Bots |
| 16 | `group-chat.dc.html` | Group chat with @mentions | Bots |
| 17 | `inbox.dc.html` | Inbox | Inbox |
| 18 | `cron.dc.html` | Cron jobs | Tasks |
| 19 | `cron-editor.dc.html` | Cron job editor | Tasks |
| 20 | `kanban.dc.html` | Kanban board | Tasks |
| 21 | `kanban-task.dc.html` | Kanban task drawer | Tasks |
| 22 | `goals.dc.html` | Goals, loops, heartbeats, batch | Tasks |
| 23 | `memory.dc.html` | Memory, persona, context files | Control |
| 24 | `skills.dc.html` | Skills, toolsets, curator, hub | Control |
| 25 | `tools-mcp.dc.html` | Tools and MCP servers, plugins | Control |
| 26 | `channels.dc.html` | Messaging channels | Control |
| 27 | `pairing.dc.html` | Pairing requests and access rules | Control |
| 28 | `webhooks.dc.html` | Webhooks | Control |
| 29 | `control.dc.html` | Control home and gateway status | Control |
| 30 | `analytics.dc.html` | Analytics | Control |
| 31 | `logs.dc.html` | Logs | Control |
| 32 | `config.dc.html` | Config editor | Control |
| 33 | `security.dc.html` | Approval policy, YOLO, API keys, secret managers | Control |
| 34 | `settings.dc.html` | App settings, updates, doctor, backup | Control |

## Feature coverage

Feature names follow the Hermes docs (hermes-agent.nousresearch.com/docs).

| Hermes feature | Screen(s) |
| --- | --- |
| Gateway connection (URL, Nous Portal, Hermes Cloud) | 01 |
| Multiple gateways, Update all instances | 02, 34 |
| Streaming replies, tool activity, plan progress | 03 |
| Subagents (live workers, Steer, Stop) | 03 |
| Command approvals: once, session, always, deny; 300 s timeout | 04, 17 |
| Approval modes (smart, manual, off), YOLO, allowlist, deny rules | 33 |
| Agent questions (clarify) | 05, 17 |
| Provider errors, retry, switch provider, logs, diagnostics | 06 |
| Model, reasoning effort, provider routing, fallback | 07 |
| Sessions: search, filters, projects, rename, export, delete | 08, 09 |
| Checkpoints and rollback | 09 |
| Git diffs, commits, worktrees (read-only) | 11 |
| Voice mode, dictation, read-aloud, wake word | 03, 10, 34 |
| Artifacts, web and file preview, tool output | 12 |
| Bots (profiles): roster, folders, hidden, active filter | 13 |
| New bot: clone, model pin, SOUL.md, skills, toolsets, MCP, create-on machine | 14 |
| Bot profile: avatars including pixel pets, default profile, duplicate, delete | 15 |
| Bot voice, routines per bot | 15, 18 |
| Group chats: 2 to 6 bots, @mentions, needs-you, stop and pause words | 16 |
| Bot-to-bot messages (message_agent) | 16 |
| Cron jobs: pause, resume, run now, delivery target, script-only | 18, 19 |
| Kanban: columns, per-profile lanes, nudge dispatcher, filters | 20 |
| Kanban task: dependencies, comments, attachments, events, status actions | 21 |
| Decompose and Specify on triage cards | 20 (noted) |
| Goals, recurring loops, session heartbeats, batch processing | 22 |
| Memory: search, delete, scope, Honcho user model | 23 |
| Persona (SOUL.md), context files | 23, 15 |
| Skills: toggle, agent-written badge, curator, hub, update all | 24 |
| Toolsets (web, browser, code, image, TTS) | 24 |
| MCP servers: add, test, enable, per-tool allowlist, catalog | 25 |
| Plugins | 25 |
| Messaging channels (16+ platforms), configure, test, restart gateway | 26 |
| DM pairing codes, approve, revoke, lockout | 27, 17 |
| Webhooks | 28 |
| Gateway status, active sessions, resource-pressure banners | 29 |
| Analytics: tokens, cache hit rate, cost over 7, 30, 90 days | 30 |
| Logs: agent, errors, gateway; level and component filters | 31 |
| Config sections, export, import, reset | 32 |
| Theme (8 Hermes themes), fonts | 34, 32 |
| API keys, secret managers (Bitwarden, 1Password), saved logins | 33 |
| Updates, doctor, backup, restore, shell hooks, Nous Portal status | 34 |
| Notifications: approvals, questions, cron, failures, pairing | 34 |

## Out of scope for v1

These exist in Hermes but are desktop-only, admin-only, or protocol endpoints. They have no phone screen here.

- **Desktop-only views:** memory graph, Bot Screen, Quick Entry, HUD composer, command palette, keyboard shortcuts.
- **Admin and install:** egress proxy and network isolation, Docker and container settings (beyond the backend picker in 32), language packs, session storage and state-DB recovery, profile distributions.
- **Onboarding flows:** importing from other agents and migrating from OpenClaw.
- **Protocol endpoints with no UI:** A2A, ACP, API server, Mixture of agents.
- **Agent behaviours with no UI:** computer use, deliverable mode, document extraction, X search, Spotify. These appear only through toolsets and MCP.

## Decisions for you

1. **Connection.** Hermes has no phone-pairing flow today. The design connects by gateway URL plus sign-in (Nous Portal, username and password on a trusted network or VPN, or Hermes Cloud). A QR pairing like OpenClaw's needs a new pairing endpoint on the Hermes side. The Connect screen shows it as a disabled, proposed option. Keep it out of v1, or add it?
2. **Theme.** v1 is dark only. Hermes ships 8 desktop themes. Add a light theme now, or map Hermes themes later?
3. **Device capabilities.** OpenClaw's phone nodes (camera, location, photos, screen) are not in Hermes. Not designed. Add as a later phase?
4. **Canvas.** Hermes has Artifacts, not a canvas. The design uses an Artifacts gallery and preview rail.
5. **Inbox as a tab.** Approvals expire after 300 seconds, so they get their own tab rather than a menu item.

## Sources

- Hermes Agent docs: https://hermes-agent.nousresearch.com/docs (features overview, web dashboard, Bot Mode, Relay, Kanban, security, desktop)
- OpenClaw docs: https://docs.openclaw.ai (companion-app patterns: pairing, chat, approvals, device nodes)
