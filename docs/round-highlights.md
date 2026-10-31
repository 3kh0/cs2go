# Round highlights

The round-win/loss subtitle uses native fun-fact wording from `resource/csgo_english.txt`, installed CS2 build **26144732**. `apps/game/src/data/round-strings.json` records the source hash and the supported strings, including singular/plural variants. Regenerate from the read-only export with:

```sh
python3 scripts/import-round-strings.py artifacts/agent-roster/windows/native/resource/csgo_english.txt
```

Duration counts live 128 Hz simulation time, excluding freeze time, pause and post-round play. Facts use this round's kill deltas and recorded enemy headshot, knife and grenade eliminations. Supported highlights include aces, short rounds, team wins without casualties/kills, elimination time and first elimination. The selection priorities are authored; the wording is imported. Unsupported facts about accuracy or damage are not invented.

MVPs retain the existing winning-team objective/round-kill selection. The banner now states the earned reason using the native planting, defusing, most-eliminations or ace wording. Objective credit uses the actual planter/defuser, and an ace requires all opposing participants. Post-round kills cannot change an already awarded MVP or fact.

Buy previews cancel the posed grenade weapon-root transform at the hand attachment, including the non-identity roots used by flashbangs, smoke and decoys. This preserves the native wrist/finger pose without rotating those canisters twice. Equipped finishes show their full weapon/finish name and catalog rarity color in the preview detail panel.
