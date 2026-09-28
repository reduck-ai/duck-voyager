# duck-voyager

A benchmark for AI agents doing real tasks in a browser, by [Reduck AI](https://reduck.ai). Replays: https://voyager.reduck.ai. The same agent (Claude Code, through the Agent SDK) gets the same prompt twice, once per arm, with exactly one browser tool:

- **reduck**: the [Reduck](https://reduck.ai) MCP server, which runs saved browser scripts.
- **chrome**: Claude in Chrome (`--chrome`).

Each run records its verdict, time, turns, cost and tokens, and keeps the Claude Code transcript, so you can check any result against what the agent actually did.

## Tasks

A task is a file in `tasks/` that default-exports a `Task` (or a list of them):

```ts
{
  id: "hn-dropbox",
  name: "The Dropbox launch post on Hacker News",
  prompt: "Find the Hacker News post where Dropbox's founder first showed it…",
  requires?: () => Verdict,   // precondition, checked before every run; the run is skipped if it fails
  check?: (run) => Verdict,   // { pass, detail, by }: from the answer, the parsed session and the downloaded files
}
```

See `tasks/example.ts`. Tasks that use your own accounts go in `tasks/private/`, which is git-ignored. `task.ts` has the helpers: `signedInAs` (assert the exact account a site is signed in as), `all`, `reduck` (run a Reduck script from a check), `pdfText`.

## Run

Requirements: Node 22.18+, pnpm, [Claude Code](https://claude.com/claude-code), Chrome with the Reduck extension paired and with Claude in Chrome installed. Both arms drive the same Chrome profile, so its sign-ins are the test fixture.

```sh
pnpm install
npx @reduck-ai/cli@latest login          # or set REDUCK_API_KEY
pnpm bench                               # every task, both arms
pnpm bench --task hn-dropbox --arm reduck --timeout 10
pnpm bench --task hn-dropbox --arm chrome --trial <folder>   # join that trial, next to its reduck run
```

Each call writes `runs/<time>/results.jsonl`, one row per run, and moves every file the run downloaded into `runs/<time>/<task>.<arm>/files/`. Runs are sequential because both arms download into the same `~/Downloads`.

`REDUCK_MCP_URL` points the reduck arm, and the `requires` checks, at another Reduck MCP (default `https://mcp.reduck.ai`).

## Read and replay runs

- `pnpm replay` serves a page with one card per task: what kind of eval it is and who did better, by how much, in its latest trial. A trial is one `pnpm bench` call's runs of a task, one per tool. Opening a card shows the whole prompt, a picker of its trials, each run's verdict and numbers, and Replay: the two runs side by side on one timeline, the chat, the browser screenshots, and a result card when each run ends. It shows every run on your machine.
- `pnpm grade <run id> pass|fail "<why>"` records a person's verdict, for a task no code can grade.
- `pnpm export <run id> …` publishes the runs you name, once you have read each one whole in `pnpm replay`: a trace can hold private data no rule foresees. It writes them into `replay/public/data/` without screenshots, and refuses a run of a task under `tasks/private/` or one that contains any line of `tasks/private/deny.txt`. Commit that folder: on a push to `main`, GitHub Pages builds the site from it.
- `mcp.ts` is an MCP server over the transcripts, so an agent can check a run step by step, screenshots included:

  ```sh
  claude mcp add -s user sessions -- node <path>/duck-voyager/mcp.ts
  ```

## License

MIT
