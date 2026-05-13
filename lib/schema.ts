export type QuestionType =
  | "text"
  | "longtext"
  | "number"
  | "single"
  | "multi"
  | "yesno"
  | "date"
  | "time"
  | "file"
  | "repeater"
  | "table";

export type TableCellType = "number" | "text";

export interface TableRow {
  id: string;
  label: string;
}

export interface TableColumn {
  id: string;
  label: string;
  type?: TableCellType; // defaults to "number"
  unit?: string;
}

/** Stored value for a `table` question: { [rowId]: { [colId]: cellValue } }. */
export type TableValue = Record<string, Record<string, string | number | "n/a" | undefined>>;

export type ConditionOperator =
  | "equals"
  | "notEquals"
  | "includes"
  | "notIncludes"
  | "greaterThan"
  | "lessThan";

export interface Condition {
  questionId: string;
  operator: ConditionOperator;
  value: string | number | boolean;
}

export interface Option {
  value: string;
  label: string;
}

export type QuestionLevel = "org" | "site" | "building" | "department";
export type Role =
  | "gm"
  | "engineering"
  | "housekeeping"
  | "laundry"
  | "finance"
  | "energy_manager";

export interface Question {
  id: string;
  type: QuestionType;
  label: string;
  help?: string;
  options?: Option[];
  unit?: string;
  required?: boolean;
  multiple?: boolean;
  added?: boolean;
  showWhen?: Condition[];
  // tagging — added in template v0.3
  level?: QuestionLevel;
  // repeater-only
  countQuestionId?: string;
  itemNoun?: string;
  subQuestions?: Question[];
  // table-only
  rows?: TableRow[];
  columns?: TableColumn[];
}

export interface Group {
  id: string;
  title: string | null;
  questions: Question[];
  // tagging — added in template v0.3. Which respondent roles see this group.
  roles?: Role[];
}

export interface Section {
  id: string;
  title: string;
  intro?: string;
  groups: Group[];
}

export interface CoverTip {
  /** Bullet body. Supports inline `**bold**` markdown. */
  body: string;
  /** Optional nested sub-bullets (rendered indented). */
  items?: string[];
  /**
   * If false, this tip is hidden when the respondent's scoped spec contains
   * only one section. Used to drop multi-section guidance (eg "different
   * people can answer different sections") for solo respondents — there's
   * no other section for them, and the tip reads as confusing.
   */
  showForSoloRespondent?: boolean;
}

export interface CoverPage {
  headline: string;
  /** Either a single paragraph or an array of paragraphs. */
  intro: string | string[];
  /** Heading for the tips block (default: "A few pointers"). */
  pointersHeading?: string;
  /**
   * Tips. Each entry is either a string (treated as { body }) or a CoverTip
   * with optional nested `items[]`.
   */
  tips?: Array<string | CoverTip>;
  /** Footer paragraphs rendered below the CTA, separated by a divider. */
  footer?: string | string[];
  ctaLabel?: string;
}

export interface FormMeta {
  title: string;
  subtitle: string;
  version: string;
  scope: string;
  estimatedMinutes?: number; // optional in v0.4 — Penny removed the time estimate
  submitButtonLabel: string;
  completionMessage: string;
  coverPage?: CoverPage;
}

export interface FormSpec {
  meta: FormMeta;
  sections: Section[];
}

/**
 * Metadata for an uploaded file, stored on the server.
 * `id` is the row id in UploadedFile; the bytes live under
 * `$UPLOADS_DIR/<operatorId>/<instanceId>/<questionId>/<id>.<ext>`.
 *
 * The demo (Zustand) still uses the legacy `StoredFile` shape — it never
 * actually persists bytes — and the real survey runner uses this shape.
 * Both are valid answer values for `type: "file"` questions.
 */
export interface UploadedFileRef {
  id: string;
  filename: string;
  byteSize: number;
  mimeType: string;
}

/** Legacy in-memory file marker used only by the unauthenticated demo. */
export interface StoredFile {
  name: string;
  size: number;
  type: string;
}

export type AnswerValue =
  | string
  | number
  | boolean
  | string[]
  | StoredFile[]
  | UploadedFileRef[]
  | Array<StoredFile | UploadedFileRef>
  | RepeaterItem[]
  | TableValue
  | null
  | undefined;

export type RepeaterItem = Record<string, AnswerValue>;

export type Answers = Record<string, AnswerValue>;

/** Discriminate UploadedFileRef from legacy StoredFile by the `id` field. */
export function isUploadedFileRef(
  v: UploadedFileRef | StoredFile
): v is UploadedFileRef {
  return typeof (v as UploadedFileRef).id === "string";
}
