# Security

HeyTerm can type into terminals and run commands on your computer, so its local server is built to answer only you.

## What protects you

- **Local only.** The server listens on 127.0.0.1, never on the network.
- **A token for everything that acts.** Every agent hook, every page connection and the stop command need the secret in `~/.heyterm/token`, which only your user can read. Another user on the same computer can reach 127.0.0.1 but not the token.
- **The token never sits in an address.** The `heyterm` command opens the page with a one-time ticket that expires in two minutes; the page trades it for the token and clears the address.
- **Other websites cannot act for you.** Requests with a foreign `Origin`, a cross-site fetch, or a `Host` that is not this computer (DNS rebinding) are refused. The page cannot be framed by another site, loads no outside scripts, and sends no referrer.
- **What agents write is data.** Agent messages are rendered without raw HTML, and the assistant treats session text as information, never as instructions.
- **No gates of its own, by design.** HeyTerm follows each agent's own permission mode. What the agent allows, it runs; what the agent asks about comes to you.
- **Private files.** `~/.heyterm` is readable by your user alone. It holds the token, the audit log of every decision, a log of how text reached the page (event kinds and lengths, never words), and backups of your Claude settings.
- **Nothing left behind.** Its hooks sit in your Claude settings only while it runs, and `heyterm uninstall` removes its folder to the Trash.

## Reporting a problem

Please report security issues privately through GitHub's "Report a vulnerability" on this repository, not in a public issue. Include what you did, what happened, and the HeyTerm, Node and operating system versions.
