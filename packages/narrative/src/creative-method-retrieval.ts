/**
 * @deprecated M03 cards are creative materials, not M algorithms.
 * Use CreativeMaterialRetrievalService. The old class name remains only as a
 * source-compatibility shim and returns CreativeMaterialSelection objects.
 */
import type { CreativeMaterialSelection } from "@narralume/contracts";
import type { SqliteRetrievalRepository } from "@narralume/persistence";

import {
  CreativeMaterialRetrievalService,
  type CreativeMaterialRecallRequest,
} from "./creative-material-retrieval.js";

export interface CreativeMethodRecallRequest extends Omit<
  CreativeMaterialRecallRequest,
  "libraries"
> {
  methodFamilies?: readonly string[];
}

export class CreativeMethodRetrievalService {
  private readonly materials: CreativeMaterialRetrievalService;

  constructor(retrieval: SqliteRetrievalRepository) {
    this.materials = new CreativeMaterialRetrievalService(retrieval);
  }

  recall(request: CreativeMethodRecallRequest): CreativeMaterialSelection[] {
    const { methodFamilies, ...rest } = request;
    return this.materials.recall({
      ...rest,
      ...(methodFamilies ? { libraries: methodFamilies } : {}),
    });
  }
}
