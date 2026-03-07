import type {
  LessonBlock,
  LessonBlockKind,
  LessonPlan,
  LessonPlanType,
  LessonSource,
} from "../db/db";

export interface PlannerTemplateDefinition {
  type: LessonPlanType;
  label: string;
  description: string;
  title: string;
}

export const PLANNER_TEMPLATES: PlannerTemplateDefinition[] = [
  {
    type: "elders-quorum",
    label: "Elders Quorum",
    description: "Discussion-first outline for quorum teaching.",
    title: "Elders Quorum Lesson",
  },
  {
    type: "gospel-doctrine",
    label: "Gospel Doctrine",
    description: "Scripture-heavy lesson flow for class teaching.",
    title: "Gospel Doctrine Lesson",
  },
  {
    type: "talk-prep",
    label: "Talk Prep",
    description: "Gather quotes, scriptures, and transitions for a talk.",
    title: "Talk Outline",
  },
  {
    type: "custom",
    label: "Blank Plan",
    description: "Start from a clean page with gentle structure.",
    title: "Untitled Lesson",
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
    last_opened_at: now,
    created_at: now,
    updated_at: now,
  };
}

function createBlock(
  lessonPlanId: string,
  order: number,
  kind: LessonBlockKind,
  content: string,
  referenceLabel?: string
): LessonBlock {
  return {
    id: crypto.randomUUID(),
    lesson_plan_id: lessonPlanId,
    kind,
    content,
    order,
    reference_label: referenceLabel,
  };
}

export function createStarterBlocks(
  lessonPlanId: string,
  type: LessonPlanType
): LessonBlock[] {
  const sectionsByType: Record<LessonPlanType, Array<[LessonBlockKind, string]>> = {
    "elders-quorum": [
      ["heading", "Objective"],
      ["text", "What change or invitation should this discussion produce?"],
      ["heading", "Opening Question"],
      ["question", "What is one question that will invite the quorum into the text?"],
      ["heading", "Key Scriptures"],
      ["scripture", ""],
      ["heading", "Discussion Prompts"],
      ["question", "What do you hope people will wrestle with together?"],
      ["heading", "Takeaways"],
      ["checklist", "Invitation for the week\nFollow-up question"],
    ],
    "gospel-doctrine": [
      ["heading", "Big Idea"],
      ["text", "Write the doctrinal center of the lesson in one paragraph."],
      ["heading", "Scripture Flow"],
      ["scripture", ""],
      ["heading", "Questions"],
      ["question", "Which passages invite participation rather than lecturing?"],
      ["heading", "Quotes"],
      ["quote", ""],
      ["heading", "Closing Invitation"],
      ["checklist", "Bear testimony\nInvite reflection"],
    ],
    "talk-prep": [
      ["heading", "Theme"],
      ["text", "What is the one sentence you want people to remember?"],
      ["heading", "Core Scriptures"],
      ["scripture", ""],
      ["heading", "Supporting Quotes"],
      ["quote", ""],
      ["heading", "Transitions"],
      ["text", "How will you move from one section to the next?"],
      ["heading", "Closing"],
      ["text", "Write the ending you want to land on."],
    ],
    custom: [
      ["heading", "Objective"],
      ["text", ""],
      ["heading", "Scriptures"],
      ["scripture", ""],
      ["heading", "Questions"],
      ["question", ""],
    ],
  };

  return sectionsByType[type].map(([kind, content], index) =>
    createBlock(lessonPlanId, index, kind, content)
  );
}

export function buildLessonBlockFromSource(
  lessonPlanId: string,
  order: number,
  source: LessonSource
): LessonBlock {
  const kind: LessonBlockKind =
    source.source_type === "scripture"
      ? "scripture"
      : source.source_type === "note"
        ? "text"
        : "quote";

  return {
    id: crypto.randomUUID(),
    lesson_plan_id: lessonPlanId,
    kind,
    order,
    source_id: source.id,
    reference_label: source.reference_label ?? source.label,
    anchor: source.anchor,
    content: source.content,
  };
}

export function exportLessonPlanToMarkdown(
  lessonPlan: LessonPlan,
  lessonBlocks: LessonBlock[]
): string {
  const header = [`# ${lessonPlan.title}`, "", `_Template: ${getLessonPlanTypeLabel(lessonPlan.type)}_`, ""];
  const lines = lessonBlocks
    .sort((a, b) => a.order - b.order)
    .flatMap((block) => {
      const trimmed = block.content.trim();

      if (block.kind === "heading") {
        return [`## ${trimmed || "Section"}`, ""];
      }

      if (block.kind === "question") {
        return [`- Question: ${trimmed || "Add discussion question"}`, ""];
      }

      if (block.kind === "checklist") {
        const items = (trimmed || "Add action item")
          .split("\n")
          .map((item) => item.trim())
          .filter(Boolean)
          .map((item) => `- [ ] ${item}`);
        return [...items, ""];
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

  return [...header, ...lines].join("\n").trim() + "\n";
}
