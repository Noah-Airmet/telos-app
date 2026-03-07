import type {
  LessonBlock,
  LessonPlan,
  LessonPlanType,
  LessonSource,
} from "../db/db";

export interface PlannerTemplateDefinition {
  type: LessonPlanType;
  label: string;
  description: string;
  title: string;
  body_markdown: string;
}

export const PLANNER_TEMPLATES: PlannerTemplateDefinition[] = [
  {
    type: "elders-quorum",
    label: "EQ/RS",
    description: "Discussion-first study and teaching document for elders quorum or relief society.",
    title: "EQ/RS Lesson",
    body_markdown: `## Objective

What do you hope changes for people after this discussion?

## Opening Question

What question will invite people into the text instead of just listening?

## Scriptures

- Add key passages here

## Discussion Flow

- What should the class wrestle with together?
- Where might you pause and ask for responses?

## Invitations

- What is one concrete invitation for the week?
`,
  },
  {
    type: "gospel-doctrine",
    label: "Gospel Doctrine",
    description: "Scripture-heavy lesson flow for class teaching.",
    title: "Gospel Doctrine Lesson",
    body_markdown: `## Big Idea

Write the doctrinal center of the lesson in one strong paragraph.

## Scripture Flow

- Passage 1
- Passage 2
- Passage 3

## Questions

- What questions open the room up?
- Which verses should people sit with for a minute?

## Closing Invitation

- Summarize the main invitation here
`,
  },
  {
    type: "talk-prep",
    label: "Talk Prep",
    description: "Gather quotes, scriptures, and transitions for a talk.",
    title: "Talk Outline",
    body_markdown: `## Theme

What is the one sentence you want people to remember?

## Core Scriptures

- Add your anchor passages

## Supporting Quotes

> Add key quotations here

## Transitions

How will you move from one section to the next?

## Closing

Draft the final paragraph you want to land on.
`,
  },
  {
    type: "custom",
    label: "Blank Slate",
    description: "Open a quiet page for essays, class writing, or anything else.",
    title: "Untitled Document",
    body_markdown: `## Working Title

Start writing here.
`,
  },
];

export function getLessonPlanTypeLabel(type: LessonPlanType) {
  return (
    PLANNER_TEMPLATES.find((template) => template.type === type)?.label ?? "Lesson Plan"
  );
}

export function createLessonPlanFromTemplate(type: LessonPlanType): LessonPlan {
  const now = Date.now();
  const template = PLANNER_TEMPLATES.find((item) => item.type === type);

  return {
    id: crypto.randomUUID(),
    title: template?.title ?? "Untitled Lesson",
    type,
    status: "draft",
    body_markdown: template?.body_markdown ?? "",
    last_opened_at: now,
    created_at: now,
    updated_at: now,
  };
}

export function createBodyMarkdownFromLegacyBlocks(lessonBlocks: LessonBlock[]): string {
  const lines = [...lessonBlocks]
    .sort((a, b) => a.order - b.order)
    .flatMap((block) => {
      const trimmed = block.content.trim();

      if (block.kind === "heading") {
        return [`## ${trimmed || "Section"}`, ""];
      }

      if (block.kind === "question") {
        return [`- ${trimmed || "Add discussion question"}`, ""];
      }

      if (block.kind === "checklist") {
        return (trimmed || "Add action item")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => `- [ ] ${item}`)
          .concat("");
      }

      if (block.kind === "scripture") {
        const label = block.reference_label ? `**${block.reference_label}**` : "**Scripture**";
        return [label, "", trimmed || "_Add scripture excerpt_", ""];
      }

      if (block.kind === "quote") {
        return ["> " + (trimmed || "Add quote"), ""];
      }

      return [trimmed || "_Add notes_", ""];
    });

  return lines.join("\n").trim() + "\n";
}

export function buildMarkdownFromSource(
  source: LessonSource
): string {
  const label = source.reference_label ?? source.label;

  if (source.source_type === "scripture") {
    return `**${label}**\n\n${source.content.trim()}`;
  }

  if (source.source_type === "note") {
    return `### Note\n\n${source.content.trim()}`;
  }

  return `> ${source.content.trim().split("\n").join("\n> ")}`;
}

export function exportLessonPlanToMarkdown(lessonPlan: LessonPlan): string {
  const title = lessonPlan.title.trim() || "Untitled Document";
  const body = (lessonPlan.body_markdown ?? "").trim();
  const templateLabel = getLessonPlanTypeLabel(lessonPlan.type);

  return [`# ${title}`, "", `_Template: ${templateLabel}_`, body ? `\n${body}` : ""]
    .join("\n")
    .trim() + "\n";
}
