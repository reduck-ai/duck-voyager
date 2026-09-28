/**
 * A task to copy. It needs no account, and its answer never changes, so the check is one line.
 *
 * Tasks that touch your own accounts belong in `tasks/private/` (git-ignored). Give them a
 * `requires` that pins the exact account each site must be signed in as, so a run on the wrong
 * session is skipped instead of scored:
 *
 *   requires: () => all([signedInAs("X", "reduck/x.com/whoami", (r) => r.handle, process.env.VOYAGER_X_HANDLE!)])
 */
import type { Task } from "../task.ts";

// "My YC app: Dropbox - Throw away your USB drive", Drew Houston, April 2007.
const POST = "item?id=8863";

export default {
	id: "hn-dropbox",
	name: "The Dropbox launch post on Hacker News",
	prompt: "Find the Hacker News post where Dropbox's founder first showed it, back in 2007. Give me its link.",
	check: ({ answer }) => ({
		pass: answer.includes(POST),
		detail: answer.includes(POST) ? "links the post" : "no link to the post"
	})
} satisfies Task;
