<!-- codex-homunculus:start -->
## Codex Homunculus Bootstrap

For repo tasks in this workspace:

1. Before planning or editing, run `node plugins/codex-homunculus/scripts/homunculus.mjs start`.
2. Apply relevant learned instincts with `node plugins/codex-homunculus/scripts/homunculus.mjs apply --context "<short task summary>"`.
3. Use only relevant instincts; treat them as guidance, not proof.
4. If this block was copied between machines or plugin locations, refresh it with `install-codex-instructions` or pass `--script-command` so the command path points at the installed CLI.
5. Before the final response, if the task produced a durable workflow lesson or the user corrected Codex behavior, ask before storing it, then run `node plugins/codex-homunculus/scripts/homunculus.mjs learn --domain "<domain>" --trigger "<specific trigger>" --action "<specific action>" --evidence "<brief evidence>"`.
6. Do not store secrets, credentials, private customer data, or tokens. Prefer redaction.
7. Do not claim every-turn hooks, background observation, or scheduled behavior unless a separate wrapper or automation has been explicitly installed and verified.

<!-- codex-homunculus:end -->
