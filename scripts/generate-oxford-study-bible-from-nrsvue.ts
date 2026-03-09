/**
 * Generate full Oxford Annotated Study Bible from NRSVue.
 * The Oxford Annotated Bible 5th ed uses the same NRSVue translation.
 * This copies all chapters and sets type: "study-bible" for margin-column layout.
 *
 * To add study notes from the Oxford Annotated EPUB, run:
 *   npx tsx scripts/inspect-epub.ts "new-stuff/oxford-annotated-bible.epub"
 *   (then create an oxford-study-bible profile to extract footnotes)
 *
 * Usage: npx tsx scripts/generate-oxford-study-bible-from-nrsvue.ts
 */
import fs from "fs";
import path from "path";

const NRSVUE_DIR = path.join(import.meta.dirname, "..", "data", "nrsvue");
const OUTPUT_DIR = path.join(import.meta.dirname, "..", "data", "oxford-study-bible");

function main() {
  if (!fs.existsSync(NRSVUE_DIR)) {
    console.error("NRSVue data not found at", NRSVUE_DIR);
    process.exit(1);
  }

  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(NRSVUE_DIR).filter((f) => f.endsWith(".json"));
  let count = 0;

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(NRSVUE_DIR, file), "utf-8"));
    const doc = {
      ...raw,
      type: "study-bible",
      translation: "Oxford",
      edition_family: "oxford-study-bible",
    };
    fs.writeFileSync(path.join(OUTPUT_DIR, file), JSON.stringify(doc, null, 2));
    count++;
  }

  console.log(`Generated ${count} documents in ${OUTPUT_DIR}/`);
}

main();
