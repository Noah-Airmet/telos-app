import test from "node:test";
import assert from "node:assert/strict";

import type { TelosDocument } from "../src/db/db.ts";
import {
  buildCompareUnitIndex,
  hasFullComparisonCoverage,
  normalizeDocument,
  normalizeManifest,
  type TranslationManifest,
} from "../src/lib/scripture.ts";

test("legacy Hardy paragraphs normalize into verse-ranged compare blocks", () => {
  const hardyDocument: TelosDocument = {
    document_id: "bom-1-ne-3",
    title: "1 Nephi 3",
    type: "study-bible",
    translation: "Hardy Annotated",
    blocks: [
      {
        block_id: "bom-1-ne-3-1",
        type: "verse",
        number: 1,
        text:
          "And it came to pass that I, Nephi, returned. 5 And now, behold thy brothers murmur. 6 Therefore go, my son.",
      },
      {
        block_id: "bom-1-ne-3-7",
        type: "verse",
        number: 7,
        text: "And it came to pass that I, Nephi, said unto my father.",
      },
    ],
  };

  const normalizedHardy = normalizeDocument("hardy-bom", hardyDocument);
  const firstBlock = normalizedHardy.blocks[0];

  assert.equal(firstBlock.type, "paragraph");
  assert.equal(firstBlock.verse_start, 1);
  assert.equal(firstBlock.verse_end, 6);
  assert.deepEqual(firstBlock.compare_unit_ids, [
    "bom-1-ne-3-1",
    "bom-1-ne-3-2",
    "bom-1-ne-3-3",
    "bom-1-ne-3-4",
    "bom-1-ne-3-5",
    "bom-1-ne-3-6",
  ]);
});

test("verse-ranged Hardy blocks can use LDS verse coverage for chapter diffs", () => {
  const hardyDocument: TelosDocument = {
    document_id: "bom-1-ne-3",
    title: "1 Nephi 3",
    type: "study-bible",
    translation: "Hardy Annotated",
    blocks: [
      {
        block_id: "bom-1-ne-3-1",
        type: "verse",
        number: 1,
        text:
          "And it came to pass that I, Nephi, returned. 5 And now, behold thy brothers murmur. 6 Therefore go, my son.",
      },
      {
        block_id: "bom-1-ne-3-7",
        type: "verse",
        number: 7,
        text: "And it came to pass that I, Nephi, said unto my father.",
      },
    ],
  };

  const ldsDocument: TelosDocument = {
    document_id: "bom-1-ne-3",
    title: "1 Nephi 3",
    type: "scripture",
    translation: "LDS",
    blocks: [1, 2, 3, 4, 5, 6, 7].map((verse) => ({
      block_id: `bom-1-ne-3-${verse}`,
      type: "verse" as const,
      number: verse,
      text: `Verse ${verse}`,
    })),
  };

  const normalizedHardy = normalizeDocument("hardy-bom", hardyDocument);
  const normalizedLds = normalizeDocument("lds-bom", ldsDocument);
  const ldsComparisonIndex = buildCompareUnitIndex(normalizedLds);

  assert.equal(hasFullComparisonCoverage(normalizedHardy.blocks[0], ldsComparisonIndex), true);
  assert.equal(normalizedHardy.compare_units?.some((unit) => unit.unit_id === "bom-1-ne-3-5"), true);
  assert.equal(normalizedHardy.compare_units?.some((unit) => unit.unit_id === "bom-1-ne-3-6"), true);
});

test("chapter compare readiness only stays true when another edition shares coverage", () => {
  const manifests = normalizeManifest([
    {
      translation: "LDS",
      profile: "lds-bom",
      edition_family: "bom",
      compare_ready: false,
      books: [
        {
          book_id: "bom-1-ne",
          name: "1 Nephi",
          canonical_book_id: "bom-1-ne",
          work_id: "bom",
          compare_ready: false,
          chapters: [
            { document_id: "bom-1-ne-1", title: "1 Nephi 1", chapter: 1, compare_ready: false },
            { document_id: "bom-1-ne-2", title: "1 Nephi 2", chapter: 2, compare_ready: false },
          ],
        },
      ],
    } as TranslationManifest,
    {
      translation: "Hardy",
      profile: "hardy-bom",
      edition_family: "annotated-bom",
      compare_ready: false,
      books: [
        {
          book_id: "bom-1-ne",
          name: "1 Nephi",
          canonical_book_id: "bom-1-ne",
          work_id: "bom",
          compare_ready: false,
          chapters: [
            { document_id: "bom-1-ne-1", title: "1 Nephi 1", chapter: 1, compare_ready: false },
          ],
        },
      ],
    } as TranslationManifest,
  ]);

  const ldsManifest = manifests.find((manifest) => manifest.profile === "lds-bom");
  const hardyManifest = manifests.find((manifest) => manifest.profile === "hardy-bom");

  assert.equal(ldsManifest?.books[0].chapters[0].compare_ready, true);
  assert.equal(ldsManifest?.books[0].chapters[1].compare_ready, false);
  assert.equal(hardyManifest?.books[0].chapters[0].compare_ready, true);
});
