/**
 * Open research with no fixed answer: which posts went viral changes every week, so there is no
 * check and each run is judged by reading its session (are the links real X posts from the past
 * week, are the authors under 5k followers, is the "why" backed by what the run saw).
 */
import { all, signedInAs, type Task } from "../task.ts";

export default {
	id: "viral-founders",
	name: "Viral underdog founders on X",
	prompt: [
		"Find recent X (Twitter) posts from B2B SaaS founders that went viral in the past week.",
		"Use Google Search to find them (site:x.com), as Google indexes X better than X's own search.",
		"I want underdogs only: authors with fewer than 5k followers.",
		"For each one, tell me what they did (a post, an article, a thread…) and where their profile was at: were they already trending, or was this a one-off blow-up?",
		"Give the link to each post."
	].join("\n"),
	requires: () => all([signedInAs("X", "reduck/x.com/whoami", (r) => r.handle, process.env.VOYAGER_X_HANDLE!)])
} satisfies Task;
