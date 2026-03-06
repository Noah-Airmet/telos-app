import AdmZip from "adm-zip";
import * as cheerio from "cheerio";
import type { EpubSpineEntry, TocEntry } from "./types.js";

export function readEpub(epubPath: string) {
  const zip = new AdmZip(epubPath);

  // Find the content.opf (the root file)
  const containerXml = zip.getEntry("META-INF/container.xml");
  let opfPath = "OEBPS/content.opf"; // default fallback

  if (containerXml) {
    const $ = cheerio.load(containerXml.getData().toString("utf8"), { xml: true });
    const rootfile = $("rootfile").attr("full-path");
    if (rootfile) opfPath = rootfile;
  }

  const opfEntry = zip.getEntry(opfPath);
  if (!opfEntry) {
    // Try common alternatives
    for (const alt of ["content.opf", "OEBPS/content.opf"]) {
      const e = zip.getEntry(alt);
      if (e) {
        return parseOpf(zip, e, alt);
      }
    }
    throw new Error(`Cannot find content.opf in EPUB`);
  }

  return parseOpf(zip, opfEntry, opfPath);
}

function parseOpf(zip: AdmZip, opfEntry: AdmZip.IZipEntry, opfPath: string) {
  const opfContent = opfEntry.getData().toString("utf8");
  const $ = cheerio.load(opfContent, { xml: true });
  const opfDir = opfPath.includes("/") ? opfPath.substring(0, opfPath.lastIndexOf("/") + 1) : "";

  // Parse manifest: id → href
  const manifest = new Map<string, string>();
  $("manifest item").each((_, el) => {
    const id = $(el).attr("id") ?? "";
    const href = $(el).attr("href") ?? "";
    manifest.set(id, href);
  });

  // Parse spine (reading order)
  const spine: EpubSpineEntry[] = [];
  $("spine itemref").each((_, el) => {
    const idref = $(el).attr("idref") ?? "";
    const href = manifest.get(idref);
    if (href) {
      spine.push({ id: idref, href: opfDir + href });
    }
  });

  // Parse title
  const title = $("dc\\:title, title").first().text().trim() || "Unknown";

  // Parse TOC (toc.ncx)
  const toc = parseToc(zip, opfDir, manifest);

  return { zip, spine, toc, title, manifest, opfDir };
}

function parseToc(
  zip: AdmZip,
  opfDir: string,
  manifest: Map<string, string>
): TocEntry[] {
  // Find the ncx file
  let ncxPath = "";
  for (const [, href] of manifest) {
    if (href.endsWith(".ncx")) {
      ncxPath = opfDir + href;
      break;
    }
  }

  if (!ncxPath) return [];

  const ncxEntry = zip.getEntry(ncxPath);
  if (!ncxEntry) return [];

  const $ = cheerio.load(ncxEntry.getData().toString("utf8"), { xml: true });
  const ncxDir = ncxPath.includes("/") ? ncxPath.substring(0, ncxPath.lastIndexOf("/") + 1) : "";
  const entries: TocEntry[] = [];

  $("navPoint").each((_, el) => {
    const label = $(el).find("> navLabel > text").first().text().trim();
    const rawSrc = $(el).find("> content").attr("src") ?? "";
    // Resolve relative to ncx location
    const src = ncxDir + rawSrc;
    if (label && rawSrc) {
      entries.push({ label, src });
    }
  });

  return entries;
}

export function readFile(zip: AdmZip, path: string): string {
  const entry = zip.getEntry(path);
  if (!entry) return "";
  return entry.getData().toString("utf8");
}

export function loadHtml(zip: AdmZip, path: string) {
  return cheerio.load(readFile(zip, path));
}
