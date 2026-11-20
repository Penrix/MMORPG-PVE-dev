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
