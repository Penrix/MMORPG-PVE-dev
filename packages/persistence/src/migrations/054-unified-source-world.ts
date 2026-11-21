/**
 * A mother-world (Naruto, One Piece, Ming China, 1980s Tokyo) is a *world*,
 * not a particular scraper's dataset. Multiple independently sourced corpora
 * may describe the same world. A single curated source-corpus namespace owns
 * the stable wiki entity IDs; 053 facets attach to those IDs.
 *
 * All links to raw imported evidence are explicit and reviewable. Never merge
 * two same-name raw records automatically or create a novel's Project Canon.
 */
export const migration054 = {
  version: 54,
  name: "unified-source-world-and-evidence-mapping",
  sql: `
    CREATE TABLE source_worlds (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL CHECK(length(trim(name))>0),
      kind TEXT NOT NULL CHECK(kind IN (
        'fictional','historical','era','original_reference'
      )),
      canonical_corpus_id TEXT NOT NULL UNIQUE
        REFERENCES source_corpora(id) ON DELETE RESTRICT,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL
    ) STRICT;

    CREATE TABLE source_world_evidence_corpora (
      world_id TEXT NOT NULL REFERENCES source_worlds(id) ON DELETE CASCADE,
      corpus_id TEXT NOT NULL REFERENCES source_corpora(id) ON DELETE CASCADE,
      evidence_role TEXT NOT NULL DEFAULT 'supporting'
        CHECK(evidence_role IN ('primary','supporting','alternate_version','historical','other')),
      source_note TEXT NOT NULL DEFAULT '',
      PRIMARY KEY(world_id,corpus_id)
    ) WITHOUT ROWID;

    CREATE TABLE source_world_evidence_links (
      world_id TEXT NOT NULL REFERENCES source_worlds(id) ON DELETE CASCADE,
      canonical_key TEXT NOT NULL,
      evidence_corpus_id TEXT NOT NULL,
      evidence_key TEXT NOT NULL,
      match_kind TEXT NOT NULL CHECK(match_kind IN (
        'same_identity','possible_match','source_adaptation','related_not_same'
      )),
      review_status TEXT NOT NULL DEFAULT 'candidate'
        CHECK(review_status IN ('candidate','verified','rejected')),
      source_note TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      PRIMARY KEY(world_id,canonical_key,evidence_corpus_id,evidence_key),
      FOREIGN KEY(world_id,evidence_corpus_id)
        REFERENCES source_world_evidence_corpora(world_id,corpus_id) ON DELETE CASCADE,
      FOREIGN KEY(evidence_corpus_id,evidence_key)
        REFERENCES source_records(corpus_id,source_key) ON DELETE CASCADE
    ) WITHOUT ROWID;
    CREATE INDEX source_world_evidence_reverse_idx
      ON source_world_evidence_links(evidence_corpus_id,evidence_key,world_id);

    CREATE TRIGGER source_world_evidence_link_insert
      BEFORE INSERT ON source_world_evidence_links BEGIN
        SELECT RAISE(ABORT,'source.world.canonical_record_missing')
        WHERE NOT EXISTS (
          SELECT 1 FROM source_worlds world
          JOIN source_records record
            ON record.corpus_id=world.canonical_corpus_id
           AND record.source_key=NEW.canonical_key
          WHERE world.id=NEW.world_id
        );
    END;
    CREATE TRIGGER source_world_evidence_link_update
      BEFORE UPDATE ON source_world_evidence_links BEGIN
        SELECT RAISE(ABORT,'source.world.canonical_record_missing')
        WHERE NOT EXISTS (
          SELECT 1 FROM source_worlds world
          JOIN source_records record
            ON record.corpus_id=world.canonical_corpus_id
           AND record.source_key=NEW.canonical_key
          WHERE world.id=NEW.world_id
        );
    END;
    CREATE TRIGGER source_world_no_change_corpus
      BEFORE UPDATE OF canonical_corpus_id ON source_worlds BEGIN
        SELECT RAISE(ABORT,'source.world.canonical_corpus_immutable');
    END;
  `,
} as const;
