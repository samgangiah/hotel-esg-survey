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
  | "repeater";

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
  // repeater-only
  countQuestionId?: string;
  itemNoun?: string;
  subQuestions?: Question[];
}

export interface Group {
  id: string;
  title: string | null;
  questions: Question[];
}

export interface Section {
  id: string;
  title: string;
  intro?: string;
  groups: Group[];
}

export interface FormMeta {
  title: string;
  subtitle: string;
  version: string;
  scope: string;
  estimatedMinutes: number;
  submitButtonLabel: string;
  completionMessage: string;
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
  | null
  | undefined;

export type RepeaterItem = Record<string, AnswerValue>;

export type Answers = Record<string, AnswerValue>;
