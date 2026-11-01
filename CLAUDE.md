# Project Instructions for AI Agents

This file provides instructions and context for AI coding agents working on this project.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:1105d646 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/core-concepts/sync-concepts.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


## Build & Test

No build step, no dependencies: plain static HTML/CSS/JS with classic
`<script>` tags (works from `file://`). See README.md "Running it" and
"Testing".

```bash
python3 -m http.server 8160          # serve the repo root, open http://localhost:8160
node tools/shot.mjs http://localhost:8160/games/<id>/ <outdir> --sizes=ipad,ipadl,phone,phonel
                                     # headless WebKit screenshots; console errors exit 2
python3 tools/update-sw.py           # after changing ANY file: precache list + cache version
python3 tools/nono-check.py          # nonograms need no guessing
node games/klondike/tools/verify.js  # every Solitaire deal still solves
```

Playwright + a hand-extracted WebKit live outside the repo in
`~/.cache/arcade-tools` (`webkit/pw_run.sh`). In `--js`, prefix calls that
return a promise (`Kit.result`, `Kit.confirm`) with `void`.

## Architecture Overview

Kids' arcade web app (iPads in the car, phones at home, offline first via
`sw.js`). `index.html` is the menu (`GAMES` / `ACTION` / `CARDS` lists, tile
art in `menu-art.js`). Each game is a folder in `games/<id>/` with
`index.html`, `js/game.js` (rules, no DOM) and `js/ui.js` (screen). Shared
layers: `kit/` (design system, overlays, sound, storage: the `Kit` global;
`games/2048` is the reference), `cabinet/` (pixel-canvas action games, on the
kit) and `cards/` (card games, on the kit). The only game/menu contract is
localStorage `arcade.stat.<id>`. Full API, layout and storage keys:
README.md.

## Conventions & Patterns

_Add your project-specific conventions here_
