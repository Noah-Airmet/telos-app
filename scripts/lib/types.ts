export interface Block {
  block_id: string;
  type: "verse" | "heading" | "summary" | "paragraph" | "commentary";
  number?: number;
  text: string;
  verse_start?: number | null;
  verse_end?: number | null;
  compare_unit_ids?: string[];
  sync_unit_id?: string | null;
}

export interface CompareUnit {
  unit_id: string;
  text: string;
  source_block_id?: string;
}

export interface TelosDocument {
  document_id: string;
  title: string;
  type: "scripture" | "study-bible" | "commentary";
  translation: string;
  blocks: Block[];
  compare_units?: CompareUnit[];
}

export interface ChapterResult {
  book: string;
  chapter: number;
  blocks: Block[];
}

export interface EpubSpineEntry {
  id: string;
  href: string;
}

export interface TocEntry {
  label: string;
  src: string;
}

export interface Profile {
  name: string;
  translation: string;
  type: TelosDocument["type"];
  parse(
    zip: import("adm-zip"),
    toc: TocEntry[],
    spine: EpubSpineEntry[]
  ): TelosDocument[];
}
