# MMORPG-PVE · World Builder (first working vertical slice)

This development fork keeps NarraLume's original manuscript editor, Story Compass, rolling outline, Canon repositories, revision history, and candidate/approval machinery intact.

## Currently implemented

1. Open a project, then select **世界生成 / World Builder** from the main navigation.
2. Choose **W0** (strategic world map) or **W1** (deepen an existing zone or social circle). W1 asks for the local scope and story genre/Reader experience; a high-price target may remain open.
3. Run any independent production round:
   - **01 World Map**: real regions, entry points, social systems and rules.
   - **02 Factions**: concrete organizations, rights holders, internal business and access.
   - **03 People**: independently acting NPCs, high-price people, daily life and relationships.
   - **04 Resources**: ownership, rights, opportunities and valuable assets.
   - **05 Living World**: actual ongoing affairs, never unwritten chapter plots.
   - **Supplement: Claims**: ownership, permissions, prices and access rules (existing entity IDs).
   - **Supplement: Relations**: concrete active relationships (existing entity IDs).
4. The workbench submits an AI request through NarraLume's existing `canon-spread-candidate` run system. Its model-provider settings, task history, conflicts, candidate display and author-approval mechanism are reused unchanged.
5. Review the returned world-content candidates in the same workbench. **Nothing enters Canon until explicitly applied.** Applied entities, facts, relations and timeline events become available to the original Story Bible and later long-form writing context.
6. Re-open W1 on any map later. The original Canon and committed manuscript context are consulted again; already written facts and characters must not be reset.

The UI draft survives refresh in the **current browser's local storage** only. The accepted world entities, candidate sets and AI tasks are stored in NarraLume's existing project database. This stage creates no second canonical fact store.

## How W0 and W1 differ

- **W0** must create an actual macro world with different live domains, high-price people, organizational power, resources, real entry paths and actions that happen without the protagonist. It is not an outline.
- **W1** increases local content resolution where `genre × current time/place × scarcity` makes it valuable. It follows current Canon and adopted manuscript results, not a fixed global generation pipeline.
- World knowledge generation and story writing are peer activities that reuse one authoritative Canon. A chapter's new factual changes are still reconciled through NarraLume's existing settlement path.

## Known limitations (not falsely claimed as completed)

- This version uses NarraLume's existing **one Canon spread per AI run** contract, so W0/W1 are built in reviewable rounds instead of one huge all-at-once prompt. Relations and ownership must be revisited **after** entities are accepted.
- This is not yet a full hierarchical W0/W1 world-map database, GIS canvas, source-verification system, autonomous NPC GOAP/simulation engine, or per-region complete world pack.
- It does not auto-detect world-content gaps during chapter generation, auto-launch a new world production run, or manage campaign-wide multiple world branches. These can be added after the first end-to-end generation+approval flow works.
- The v0.1 and v0.7 original MMORPG design research lives in the separately maintained `Penrix/MMORPG-PVE` repository. **Do not copy those complete private research files into this public fork without an explicit publication decision.** The prompt instructions here are a narrow functional interface, not a replacement for the research.

## Reproduce

Start the NarraLume development environment per its original README, assign a generation model, create a project, then visit `/projects/<projectId>/world`. Generate a W0 world-map candidate, approve one entity, run a faction or NPC round, approve further items, then confirm those records in the original Story Bible. Optionally write and settle a chapter, then re-enter W1 to expand from that updated Reality.

For routine checks, run `npm run typecheck`, `npm test`, and `npm run build` with the repository's Node.js 24+ requirement. The fork's PR CI runs stronger checks. These checks are not substitutes for a real model-output quality trial.
