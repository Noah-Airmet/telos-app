import fs from "fs";
import path from "path";
import { readEpub } from "./lib/epub-reader.js";
import { profiles, listProfiles } from "./lib/profiles/index.js";

const USAGE = `
Telos Content Ingest Pipeline
==============================

Usage:
  npx tsx scripts/ingest.ts <epub-file> --profile <profile-name> [--output <dir>]

Profiles:
  lds-bom     LDS Church official Book of Mormon EPUB
  kjv         King James Bible (Calibre/biblos.com EPUB)
  nrsvue      NRSVue Bible (Calibre EPUB)
  hardy-bom   Hardy "Annotated Book of Mormon" (Oxford UP EPUB)

Examples:
  npx tsx scripts/ingest.ts scripts/book-of-mormon-2013.epub --profile lds-bom
  npx tsx scripts/ingest.ts scripts/kjv.epub --profile kjv --output data/kjv/
  npx tsx scripts/ingest.ts scripts/nrsvue.epub --profile nrsvue
  npx tsx scripts/ingest.ts scripts/hardy-annotated-bom.epub --profile hardy-bom
`.trim();

function main() {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    console.log(USAGE);
    process.exit(0);
  }

  // Parse arguments
  const epubPath = args[0];
  let profileName = "";
  let outputDir = "";

  for (let i = 1; i < args.length; i++) {
    if (args[i] === "--profile" && args[i + 1]) {
      profileName = args[++i];
    } else if (args[i] === "--output" && args[i + 1]) {
      outputDir = args[++i];
    }
  }

  // Validate
  if (!epubPath || !profileName) {
    console.error("Error: both <epub-file> and --profile are required.\n");
    console.log(USAGE);
    process.exit(1);
  }

  if (!fs.existsSync(epubPath)) {
    console.error(`Error: file not found: ${epubPath}`);
    process.exit(1);
  }

  const profile = profiles[profileName];
  if (!profile) {
    console.error(`Error: unknown profile "${profileName}". Available: ${listProfiles().join(", ")}`);
    process.exit(1);
  }

  // Default output directory
  if (!outputDir) {
    outputDir = path.join("data", profileName);
  }
  fs.mkdirSync(outputDir, { recursive: true });

  console.log(`Ingesting: ${epubPath}`);
  console.log(`Profile:   ${profile.name} (${profile.translation})`);
  console.log(`Output:    ${outputDir}/\n`);

  // Read and parse
  const epub = readEpub(epubPath);
  console.log(`EPUB title: "${epub.title}"`);
  console.log(`Spine entries: ${epub.spine.length}`);
  console.log(`TOC entries: ${epub.toc.length}\n`);

  const documents = profile.parse(epub.zip, epub.toc, epub.spine);

  // Write output
  let totalBlocks = 0;
  for (const doc of documents) {
    totalBlocks += doc.blocks.length;
    const filePath = path.join(outputDir, `${doc.document_id}.json`);
    fs.writeFileSync(filePath, JSON.stringify(doc, null, 2));
  }

  console.log(`Done! Generated ${documents.length} documents with ${totalBlocks} total blocks.`);
  console.log(`Output: ${outputDir}/`);

  // Print a sample
  if (documents.length > 0) {
    const sample = documents[0];
    const sampleVerses = sample.blocks.filter(b => b.type === "verse").slice(0, 3);
    console.log(`\nSample (${sample.title}):`);
    for (const v of sampleVerses) {
      const preview = v.text.length > 80 ? v.text.substring(0, 80) + "..." : v.text;
      console.log(`  ${v.block_id}: "${preview}"`);
    }
  }
}

main();
