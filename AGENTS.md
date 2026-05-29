<!-- codex-homunculus:start -->
## Codex Homunculus Bootstrap

For repo tasks in any Codex chat or workspace:

1. Before planning or editing, run `%USERPROFILE%\.codex\bin\codex-homunculus.cmd start`.
2. Apply relevant learned instincts with `%USERPROFILE%\.codex\bin\codex-homunculus.cmd apply --context "<short task summary>"`.
3. Run these local Homunculus commands directly when tool permissions allow; do not ask the user first.
4. Use only relevant instincts; treat them as guidance, not proof.
5. Before the final response, if the task produced a durable workflow lesson or the user corrected Codex behavior, ask before storing it, then run `%USERPROFILE%\.codex\bin\codex-homunculus.cmd learn --domain "<domain>" --trigger "<specific trigger>" --action "<specific action>" --evidence "<brief evidence>"`.
6. Do not store secrets, credentials, private customer data, or tokens. Prefer redaction.
7. Do not claim every-turn hooks, background observation, or scheduled behavior unless a separate wrapper or automation has been explicitly installed and verified.

<!-- codex-homunculus:end -->
