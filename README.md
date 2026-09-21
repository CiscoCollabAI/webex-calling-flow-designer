# CX Flow Designer

See your Webex Calling flows, not just their settings.

## What it does today

CX Flow Designer connects to a live Webex org and renders a Call Queue's real
configuration — routing, overflow, business hours, announcements, agents — as
a visual flow diagram instead of a stack of settings tabs.

**It's read-only.** It shows you exactly how a queue behaves today; it does
not yet let you change or publish anything back to Webex.

## Roadmap

- **Next:** Auto Attendant support
- **Then:** CX Essentials
- **After that:** troubleshooting live flows, and creating new call queues
  directly from the canvas instead of just viewing them

## Getting Started

Prerequisites: Node.js and npm.

```bash
git clone https://github.com/CiscoCollabAI/webex-calling-flow-designer.git
cd webex-calling-flow-designer
npm install
npm run dev
```

To connect to a real org, you'll need a Webex admin token with the telephony
config read scope. You paste it in at runtime — it's never hardcoded and
never sent anywhere except Webex's own API.

## How it works

A React + TypeScript app (Vite, Zustand, React Flow) that reads a Call
Queue's live configuration from the Webex Calling REST API and lays it out
as a diagram. Nothing you connect is sent anywhere but Webex's own API.

## Contributing

`main` is branch-protected — changes land via pull request with at least one
approval, no direct pushes. Active work happens on `develop`. A more detailed
CONTRIBUTING.md is coming; for now, open an issue for bugs or feature ideas,
or branch off `develop` and open a PR.

## License

Pending confirmation — not yet finalized.

## Disclaimer

This tool was built via AI-assisted vibecoding (Claude Code). It's intended
for lab and non-production environments only. Use it at your own risk — the
author accepts no responsibility for any incidents in your systems.
