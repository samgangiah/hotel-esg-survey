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

export interface CoverPage {
  headline: string;
  intro: string;
  /** Each item supports inline `**bold**` markdown. */
  tips?: string[];
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

// Holds a file's metadata only — actual File object kept in browser memory keyed by question path.
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
  | RepeaterItem[]
  | TableValue
  | null
  | undefined;

export type RepeaterItem = Record<string, AnswerValue>;

export type Answers = Record<string, AnswerValue>;
