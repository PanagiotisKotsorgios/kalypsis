export type Prompt = {
  id: string;
  name: string;
  purpose: string;
  template: string;
  contextScope: string;
  isActive: boolean;
};

export type Run = {
  id: string;
  task: string;
  model: string;
  success: boolean;
  promptTokens: number;
  completionTokens: number;
  createdAt: string;
  error?: string;
  promptSummary?: string;
  result?: string;
};

export type Conversation = {
  id: string;
  title: string;
  kind: string;
  promptTemplateId?: string;
  customerId?: string;
  policyId?: string;
  lastMessageAt?: string;
  status: string;
  messageCount: number;
  resultPreview?: string;
};

export type Automation = {
  id: string;
  name: string;
  trigger: string;
  isActive: boolean;
  actions: number;
};

export type Workbench = {
  prompts: Prompt[];
  conversations: Conversation[];
  runs: Run[];
  automations: Automation[];
  storeResults: boolean;
};

export const DEFAULT_PROMPT =
  "Ανάλυσε το {{context}} και δώσε πρακτικές επόμενες ενέργειες, χωρίς δεσμευτική ασφαλιστική ή νομική συμβουλή.";

export const totalRunTokens = (runs: Run[]) =>
  runs.reduce((total, run) => total + run.promptTokens + run.completionTokens, 0);
