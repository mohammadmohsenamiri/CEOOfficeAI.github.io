export type Role = "Admin" | "CEO" | "User" | string;

export type User = {
  id: string;
  fullName: string;
  jobTitle: string;
  role: Role;
  groups?: string[];
  group?: string;
  username?: string;
  bale?: string;
  baleChatId?: string;
  baleUsername?: string;
  baleProfileUrl?: string;
  active: boolean;
  isCeo: boolean;
};

export type TaskAssignment = {
  userId: string;
  status: string;
  rejectReason?: string;
  doneAt?: string;
};

export type Task = {
  id: string;
  title: string;
  description?: string;
  creatorId: string;
  groupId?: string;
  group?: string;
  dueAt?: string;
  longTerm: boolean;
  status?: string;
  assignments: TaskAssignment[];
};

export type RecurringTask = {
  id: string;
  title: string;
  description?: string;
  creatorId?: string;
  assigneeIds: string[];
  cycle: string;
  interval?: number;
  nextRunAt?: string;
  active: boolean;
};

export type Meeting = {
  id: string;
  title: string;
  description?: string;
  startAt: string;
  endAt: string;
  location?: string;
  creatorId: string;
  status: string;
  members: string[];
};

export type CeoRequest = {
  id: string;
  title: string;
  description?: string;
  requesterId: string;
  ceoId: string;
  status: string;
  decisionReason?: string;
  delegatedTaskId?: string;
};

export type AiSettings = {
  mode: "online" | "offline";
  onlineProvider: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
  offlineModelPath?: string;
  fallbackParserEnabled: boolean;
};

export type BaleSettings = {
  enabled: boolean;
  botToken?: string;
  webhookUrl?: string;
  secret?: string;
  defaultReplyMode: string;
};

export type AppData = {
  users: User[];
  tasks: Task[];
  recurringTasks: RecurringTask[];
  meetings: Meeting[];
  requests: CeoRequest[];
};
