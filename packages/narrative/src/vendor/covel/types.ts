/** Minimal NarraLume adaptation of Covel world-data types.
 * Original definitions: ackness/covel apps/server/src/world-data/types.ts (MIT).
 * Used by the unmodified source-order algorithm in this directory.
 */
export interface MergedWorldDataSource {
  readonly id: string;
  readonly order: number;
  readonly descriptor: { readonly after?: string | readonly string[] };
  readonly [key: string]: unknown;
}
export interface OrderedWorldDataSource extends MergedWorldDataSource {
  readonly resolvedOrder: number;
}
export interface WorldDataDiagnostic {
  readonly level: "error" | "warning";
  readonly sourceId?: string;
  readonly message: string;
}
