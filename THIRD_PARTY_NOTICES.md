# Third-party notices

NarraLume is licensed under Apache-2.0. Its npm runtime and development dependencies remain governed by their publishers' licenses. The exact name, version, usage scope, and SPDX expression derived from `package-lock.json` are recorded in [`docs/third-party-licenses.csv`](docs/third-party-licenses.csv) and checked by `npm run licenses:check`.

Reviewed license families include MIT/MIT-0, ISC, BSD-2-Clause, BSD-3-Clause, Apache-2.0, 0BSD, BlueOak-1.0.0, CC0-1.0, MPL-2.0 and Unicode-style permissive terms. Notable alternatives or additional terms are:

- DOMPurify is offered under MPL-2.0 or Apache-2.0; this distribution relies on the Apache-2.0 option.
- JSZip is offered under MIT or GPL-3.0-or-later; this distribution relies on the MIT option.
- pako includes MIT and Zlib terms.
- Optional libvips binaries in the development toolchain include LGPL-3.0-or-later components; they are not part of NarraLume's Windows launcher runtime.
- `caniuse-lite` browser compatibility data is CC-BY-4.0 and is used only by the build toolchain.

The demo cover in `assets/narralume-demo-cover.jpg` is derived from [Night Sky - Boney Mountain](<https://commons.wikimedia.org/wiki/File:Night_Sky_-_Boney_Mountain_(12957596483).jpg>), photographed by Santa Monica Mountains National Recreation Area. Wikimedia Commons identifies the source as a work of the U.S. National Park Service and marks it as public domain. The source image is retained as `assets/narralume-cover-source.jpg` for provenance.

The installed packages include their own license and notice files. Release archives must preserve those files inside `node_modules`; removing them is not supported. Some projects referenced in design/research documents are study-only. **Covel and WorldForge now have actual source modules copied into this fork**, fully attributed below.

## Actual copied upstream modules added by MMORPG-PVE

The following sources were _ported_ (not merely inspired), from their original MIT-licensed TypeScript files. The original algorithm bodies are preserved; the only modifications are provenance headers, NodeNext `.js` import spellings, and separate type adapters.

| Upstream project/source                                                                  | In this fork                                            | Upstream source blob                       |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------- | ------------------------------------------ |
| [Covel](https://github.com/ackness/covel) `packages/create/src/lore-processor.ts`        | `packages/narrative/src/vendor/covel/lore-processor.ts` | `dbfc129c7f3a197a20c604e8cd4c53547dc5f551` |
| Covel `apps/server/src/world-data/source-order.ts`                                       | `packages/narrative/src/vendor/covel/source-order.ts`   | `2a67c97d5e8f06eaf8d2511a27892bbfc4547ce6` |
| Covel `apps/server/src/world-data/revision-cache.ts`                                     | `packages/narrative/src/vendor/covel/revision-cache.ts` | `64bab876da828774ac99454c93f4cb518404c37f` |
| [WorldForge](https://github.com/Fange12306/worldforge) `src/lib/simulation/causality.ts` | `packages/narrative/src/vendor/worldforge/causality.ts` | `afbe5ecf4a85c855cc00272e57fbc0cefe9585e7` |
| WorldForge `src/lib/simulation/registry.ts`                                              | `packages/narrative/src/vendor/worldforge/registry.ts`  | `c15e31ddc0afbd2a7489fef5aa440367e57ccca3` |

**Covel MIT notice**: Copyright (c) 2026 Covel Contributors.

**WorldForge MIT notice**: Copyright (c) 2025 WorldForge.

Both upstream licenses grant permission to use, copy, modify, merge, publish, distribute, sublicense and sell copies, provided the following copyright and permission notice stays with copies or substantial portions of the Software:

> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions: The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

The adapter code is identified separately and is not represented as verbatim upstream source.

## CampaignRepo (actual copied source)

- Upstream repository: https://github.com/avorial/CampaignRepo
- Source: `lib/relationships.ts` at blob `acbeeaa995e789e593723d5893ac833e846e7eca`
- Destination: `packages/services/src/vendor/campaignrepo/relationships.ts`
- License: MIT. Copyright © the CampaignRepo contributors, as declared by its upstream license.
- The relationship taxonomy and inverse lookup implementations are preserved; the NarraLume Canon graph route uses the exported functions to label ownership and social links. The same MIT permission notice and warranty disclaimer above apply to this copied source.

## SNEQ Narrative System (actual copied source)

- Upstream: https://github.com/JeanDes-Code/sneq-narrative-system
- License: MIT. **Copyright (c) 2026 Jean Desauw.**
- Copied original source in `packages/narrative/src/vendor/sneq/domain/`:
  `ids.ts`, `attribute.ts`, `event.ts`, `record.ts`, `carriage.ts`,
  `holder.ts`, `belief.ts`, `observation.ts`.
- Copied original executable source in `packages/narrative/src/vendor/sneq/core/`:
  `salience.ts` (blob `2c11e6c16827a445f951b46ddfae59cd718f0c04`),
  `derive-beliefs.ts` (blob `e104fdc8e2b8287ce6c4d49d197e7b4a98f095c1`).
- All other source files carry their individual exact blob SHA in file headers.
- Original belief projection is called from `packages/narrative/src/world-pack-knowledge.ts`; NarraLume Canon remains the sole authoritative accepted-world source. Unrecorded transmission is **not** invented by this adapter.
- The original MIT license permission and warranty disclaimer above also apply to these copied files:

  Permission is hereby granted, free of charge, to any person obtaining a copy of
  this software and associated documentation files (the "Software"), to deal
  in the Software without restriction, including without limitation the rights
  to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
  copies of the Software, and to permit persons to whom the Software is
  furnished to do so, subject to the following conditions: The above copyright
  notice and this permission notice shall be included in all copies or
  substantial portions of the Software.

  THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
  EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
  MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.
  IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY
  CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT,
  TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE
  SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

## WorldForge complete simulation-core source port (additional)

The complete **non-Tauri WorldForge simulation dependency chain** has now been copied as real upstream TypeScript code into:
`packages/narrative/src/vendor/worldforge/full/`.

Original upstream directory: https://github.com/Fange12306/worldforge/tree/main/src/lib/simulation  
Original license: MIT, Copyright (c) 2025 WorldForge; full grant/warranty text appears in the WorldForge notice above.

Copied original algorithm files:
`types.ts`, `random.ts`, `measure.ts`, `scale.ts`, `space.ts`,
`geography.ts`, `lore.ts`, `culture.ts`, `regime.ts`,
`physics.ts`, `decree.ts`, `context.ts`, `black-swan.ts`,
`entity-pool.ts`, `subdivision.ts`, `arbiter.ts`, `agent.ts`,
`causality.ts`, `registry.ts`, `branch.ts`, `import-entries.ts`,
`init-customizer.ts`, `engine.ts`, `llm.ts`, `index.ts`.

Each file contains its own upstream GitHub source path and exact Git blob SHA. Core algorithms are not paraphrased or replaced; local `.ts` imports were rewritten as `.js` for NarraLume ESM.

**Deliberate platform adaptation**: WorldForge `llm.ts` originally dynamically calls a Tauri store/API; only the default caller was replaced with an injected `LLMCaller` boundary, preserving its JSON parsing/safe-call methods. The upstream `persistence.ts` and `bridge.ts` were intentionally not copied because they target a separate Tauri file store and world timeline. NarraLume Canon/SQLite remain the sole accepted history. The upstream `index.ts` barrel omits those two Tauri integrations. Vendored TypeScript retains upstream compiler assumptions and uses `@ts-nocheck` pending a non-destructive strict-options migration; fully typed NarraLume adapters and integration tests check the externally consumed boundary.

The first live bridge is `packages/narrative/src/worldforge-faction-bridge.ts`: it uses actual `runAllAgents` and `arbitrate`, treating the result as **unconfirmed proposals**, not as confirmed novel facts. `runTicks` and the physics/region/registry engine are included and exercised by tests, but **not allowed to rewrite protagonist powers, invention costs, regional geography or Canon without the author's explicit acceptance**.


## novel-studio character-agent protocol adaptation

- Upstream repository: https://github.com/Xiaoyangy/novel-studio
- Upstream license: Apache License 2.0.
- Adapted source: `internal/domain/character_agents.go`, blob `99ed52aadea2ac85145e23a2288aaff02960d7e3`.
- Local adapted implementation: `packages/narrative/src/vendor/novel-studio/character-agent-protocol.ts`.
- The local TypeScript implementation preserves selected runtime invariants from the upstream Go implementation: proposal-to-observation binding, evidence visibility checks, arbitration-to-proposal binding, prohibition on Arbiter intent rewriting, conflict-finalization checks, and speculative-only simulation deltas.
- NarraLume-specific changes are substantial and explicit: Canon Entity IDs replace the upstream character-name registry; NarraLume StoryState supplies character-visible evidence; NarraLume Settlement remains the only accepted Canon write path; upstream Go storage/resource/chapter protocols are not copied.
- The adapted file carries a prominent modification/provenance notice as required by Apache-2.0. No upstream `NOTICE` file was present at the repository root when this source was reviewed.

### Study-only AGPL reference

`ExplosiveCoderflome/AI-Novel-Writing-Assistant` was reviewed for its World/NovelWorld and StoryWorldSlice/WorldContextGateway architecture. Its current repository license is AGPL-3.0-only with additional commercial-authorization language. **No source code from that project is copied into this fork.** Similar context-projection ideas, where used, are independently implemented.
