# Claude Multi-Session

An Electron app that keeps several Claude.ai accounts logged in at once,
switchable by tab — plus a shared notes panel so every tab knows what the
others were working on when one hits its usage limit.

## How it works

Each tab is its own Electron `session` partition — a fully separate cookie
jar / local storage, the same mechanism Chrome profiles and Firefox
containers use. Switching tabs just shows/hides the relevant view; it never
touches another tab's session, so all accounts stay signed in
simultaneously, even after closing and reopening the app.

The **Notes panel** (☰ Notes button, top right) is shared app state, not
tied to any one tab. Whatever you write in "Shared task context" is visible
no matter which account tab is currently active — that's how the tabs
"know about each other": through this shared panel inside the app, not by
reading each other's Claude conversation directly (that part isn't
something this app does, since it would mean scripting/scraping Claude's
actual page content, which is outside what this is built to do).

This is a real desktop app window — you log into each tab by hand, type
into Claude's real page by hand. Nothing here automates sending messages or
reading responses out of claude.ai.

## Setup

Needs [Node.js](https://nodejs.org) v18+.

```bash
cd claude-multi
npm install
npm start
```

First launch creates 5 tabs: Claude 1–5. Click each, log into a different
account. After that, switching tabs is instant — no re-login.

## Using the workflow

1. Work normally in whichever tab is active.
2. As you go, jot your progress in the Notes panel's "Shared task context"
   box — what you're doing, what's done, what's next. It autosaves.
3. When an account hits its limit: click "Mark this one: limit hit" (flags
   it with a red ⚠ in the tab strip so you remember), click "Build
   handoff," then "Copy."
4. Switch to the next tab, paste the handoff message as your first message
   there. Claude on that account now has the context to continue.
5. The rotation log at the bottom of the panel keeps a timestamped record
   of every switch, so you can see which accounts you've already cycled
   through.

## Other controls

- **Add a tab** — "+ Add account."
- **Rename a tab** — double-click it.
- **Remove a tab** — × on it (clears that account's saved session).
- **Reload current tab** — "⟳ Reload."
- **Mark ready again** — clears the ⚠ flag once an account's limit resets.

## Notes

- All session data and notes are stored locally only (Electron's
  `userData` folder) — nothing is sent anywhere by this app.
- This app does not detect Claude's usage limits automatically and does not
  read/relay chat content between tabs — you flag limits and carry context
  yourself via the shared panel. That's a deliberate boundary, not a
  missing feature.
