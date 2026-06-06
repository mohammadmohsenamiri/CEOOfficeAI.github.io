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

export type PendingUser = {
  id: string;
  fullName: string;
  jobTitle: string;
  username?: string;
  baleChatId?: string;
  baleUsername?: string;
  baleProfileUrl?: string;
  status: string;
  rawText?: string;
  createdAt?: string;
  rejectReason?: string;
};

export type Group = {
  id: string;
  name: string;
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
  priority?: string;
  assignments: TaskAssignment[];
};

export type RecurringTask = {
  id: string;
  title: string;
  description?: string;
  creatorId?: string;
  assigneeIds: string[];
  cycle: "daily" | "weekly" | "monthly" | string;
  interval?: number;
  daysOfWeek?: number[];
  dayOfMonth?: number | null;
  time?: string;
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

export type AnalyticsOverview = {
  totals: {
    tasks: number;
    doneTasks: number;
    openTasks: number;
    meetings: number;
    ceoRequests: number;
    notifications: number;
  };
  byUser: Array<{
    userId: string;
    fullName: string;
    role: string;
    assigned: number;
    done: number;
    rejected: number;
    pending: number;
    completionRate: number;
  }>;
};

export type SmartSuggestion = {
  id: string;
  type: string;
  severity: string;
  title: string;
  body: string;
  relatedEntity?: { type: string; id: string };
};

export type AppData = {
  users: User[];
  pendingUsers: PendingUser[];
  groups: Group[];
  tasks: Task[];
  recurringTasks: RecurringTask[];
  meetings: Meeting[];
  requests: CeoRequest[];
};
