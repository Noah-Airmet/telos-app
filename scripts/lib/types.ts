export interface Block {
  block_id: string;
  type: "verse" | "heading" | "summary" | "paragraph" | "commentary";
  number?: number;
  text: string;
}

export interface TelosDocument {
  document_id: string;
  title: string;
  type: "scripture" | "study-bible" | "commentary";
  translation: string;
  blocks: Block[];
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
