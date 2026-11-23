/**
 * @deprecated M03 cards are creative materials, not M algorithms.
 * Use creative-material-catalog.ts. This compatibility surface maps the old
 * naming onto the corrected Module-2 material semantics.
 */
import type { TextSegment } from "@narralume/persistence";

import {
  creativeMaterialSegmentFromCuratedCard,
  parseCuratedCreativeMaterialIndex,
  type CuratedCreativeMaterialIndexEntry,
} from "./creative-material-catalog.js";

export type CuratedCreativeMethodIndexEntry =
  CuratedCreativeMaterialIndexEntry;

export const parseCuratedCreativeMethodIndex =
  parseCuratedCreativeMaterialIndex;

export function creativeMethodSegmentFromCuratedCard(input: {
  projectId: string;
  methodFamily: string;
  sourceRootLabel: string;
  entry: CuratedCreativeMethodIndexEntry;
  markdown: string;
  now: string;
}): TextSegment {
  return creativeMaterialSegmentFromCuratedCard({
    projectId: input.projectId,
    libraryId: input.methodFamily,
    sourceRootLabel: input.sourceRootLabel,
    entry: input.entry,
    markdown: input.markdown,
    now: input.now,
  });
}
