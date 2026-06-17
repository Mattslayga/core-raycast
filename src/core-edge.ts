type Query = Record<string, string | number | boolean | undefined>;

export type CoreRecordType =
  | "note"
  | "task"
  | "project"
  | "person"
  | "organisation"
  | "opportunity"
  | "record";

export type CoreTypedRecordType = Exclude<CoreRecordType, "record">;

export interface CorePreferences {
  baseUrl: string;
  apiToken: string;
  namespace?: string;
  resultLimit: string;
}

export interface CoreSearchResult {
  id: string;
  docId: string;
  recordType: CoreRecordType;
  title: string;
  snippet?: string;
  summary?: string;
  score?: number;
  wordCount?: number;
}

export interface CoreSearchResponse {
  mode: string;
  warning?: string;
  results: CoreSearchResult[];
}

export interface CoreRelatedResult {
  id: string;
  recordType: CoreRecordType;
  title: string;
  tags: string[];
  score?: number;
  signals: string[];
}

export interface CoreRecord {
  id: string;
  recordType: CoreRecordType;
  title: string;
  content?: string;
  tags: string[];
  status?: string;
  stage?: string;
  priority?: string;
  due_at?: number;
  resurface_at?: number;
  blocked_reason?: string;
  updated_at?: number;
  created_at?: number;
  completed_at?: number;
}

export type CoreTaskStatus =
  | "open"
  | "in_progress"
  | "blocked"
  | "completed"
  | "cancelled"
  | "archived";

export interface CoreTaskUpdate {
  content?: string;
  status?: CoreTaskStatus;
  due_at?: number | null;
  resurface_at?: number | null;
  completed_at?: number | null;
  blocked_reason?: string | null;
}

export interface CoreRecordRef {
  id: string;
  recordType: CoreRecordType;
  title: string;
}

export interface CoreCreateRecordInput {
  title: string;
  content?: string;
  tags?: string[];
  status?: string;
  priority?: string;
  due_at?: number;
  resurface_at?: number;
  start_at?: number;
  role_title?: string;
  domain?: string;
  stage?: string;
  estimated_value?: number;
  currency?: string;
  expected_close_at?: number;
  source?: string;
}

export interface CoreCreateLinkInput {
  from_type: CoreTypedRecordType;
  from_id: string;
  to_type: CoreTypedRecordType;
  to_id: string;
  rel_type: string;
  reason?: string;
}

export interface CoreSkippedLink {
  reason: string;
  target: CoreRecordRef;
}

export interface CoreCaptureResult {
  record: CoreRecord;
  links: CoreLink[];
  skippedLinks: CoreSkippedLink[];
}

export interface CoreLink {
  id: string;
  relType: string;
  from: CoreRecordRef;
  to: CoreRecordRef;
}

export interface CoreLegacyContextLink {
  id?: string;
  title: string;
}

export interface CoreLegacyRelatedNote extends CoreRecordRef {
  sharedTags: string[];
}

export interface CoreLegacyRelationship extends CoreRecordRef {
  direction?: string;
  relType?: string;
  reason?: string;
  createdBy?: string;
}

export interface CoreLegacyContext {
  document: CoreRecordRef;
  forwardLinks: CoreLegacyContextLink[];
  backlinks: CoreLegacyContextLink[];
  relatedByTags: CoreLegacyRelatedNote[];
  typedRelationships: CoreLegacyRelationship[];
}

export interface CoreWhatNextItem {
  task: CoreRecord;
  blocked: boolean;
  blockers: CoreRecordRef[];
  project?: CoreRecordRef;
  assignee?: CoreRecordRef;
  assignees: CoreRecordRef[];
}

export interface CoreWhatNextResponse {
  namespace?: string;
  suggestedAction: "work_task" | "unblock_task" | "none" | string;
  suggestedItem?: CoreWhatNextItem;
  counts: Record<string, number>;
  filters: Record<string, string | boolean>;
  items: CoreWhatNextItem[];
}

export type CoreOpenLoopCategory =
  | "hygiene"
  | "blocked"
  | "stale"
  | "projects"
  | "opportunities";

export interface CoreOpenLoopItem extends CoreRecordRef {
  issueType: string;
  detail?: string;
  status?: string;
  stage?: string;
  suggestedCommands: string[];
  reasons: string[];
  updated_at?: number;
}

export interface CoreOpenLoopsResponse {
  namespace?: string;
  category?: CoreOpenLoopCategory;
  counts: Record<string, number>;
  metadata: Record<string, number>;
  categories: Record<CoreOpenLoopCategory, CoreOpenLoopItem[]>;
}

export type CoreAgendaView = "today" | "week" | "overdue" | "all";
export type CoreAgendaBucket =
  | "overdue"
  | "today"
  | "week"
  | "future"
  | "unscheduled";

export interface CoreAgendaItem extends CoreWhatNextItem {
  bucket: CoreAgendaBucket;
}

export interface CoreAgendaResponse {
  namespace?: string;
  view: CoreAgendaView;
  counts: Record<string, number>;
  metadata: Record<string, string | number>;
  buckets: Record<CoreAgendaBucket, CoreAgendaItem[]>;
}

export interface CoreRecentItem extends CoreRecordRef {
  operation: string;
  timestamp?: number;
  agent?: string;
  source?: string;
}

export interface CoreRecentResponse {
  days: number;
  total: number;
  items: CoreRecentItem[];
}

export interface CoreProjectTask extends CoreRecord {
  assignee?: CoreRecordRef;
  assignees: CoreRecordRef[];
}

export interface CoreProjectContextNote extends CoreRecordRef {
  relType?: string;
  direction?: string;
}

export interface CoreProjectContext {
  project: CoreRecord;
  tasks: CoreProjectTask[];
  contextNotes: CoreProjectContextNote[];
  blockedTasks: CoreProjectTask[];
  blockers: CoreRecordRef[];
  countsByStatus: Record<string, number>;
  taskCount: number;
  blockedCount: number;
  suggestedAction: "work_task" | "unblock_task" | "none" | string;
  suggestedTask?: CoreProjectTask;
}

export interface CoreNote {
  id: string;
  title: string;
  content?: string;
  tags?: string[];
  summary?: string;
  status?: string;
  source?: string;
  file_path?: string;
  created_at?: number;
  updated_at?: number;
  word_count?: number;
}

export type CoreNoteMetadata = Omit<CoreNote, "content" | "summary">;

export class CoreEdgeError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "CoreEdgeError";
  }
}

export class CoreEdgeClient {
  private readonly baseUrl: URL;

  constructor(private readonly preferences: CorePreferences) {
    this.baseUrl = new URL(ensureTrailingSlash(preferences.baseUrl.trim()));
  }

  async search(query: string, limit: number): Promise<CoreSearchResponse> {
    const value = await this.get("/search", {
      q: query,
      limit,
      mode: "hybrid",
    });
    return normalizeSearchResponse(value);
  }

  async getNote(id: string): Promise<CoreNote> {
    const value = await this.get(`/note/${encodeURIComponent(id)}`);
    return normalizeNote(value);
  }

  async getNoteMetadata(id: string): Promise<CoreNoteMetadata> {
    const value = await this.get(`/note/${encodeURIComponent(id)}`, {
      fields: "title,tags,status,source,file_path,updated_at,word_count",
    });
    return normalizeNote(value);
  }

  async related(id: string, limit = 8): Promise<CoreRelatedResult[]> {
    const value = await this.get(`/related/${encodeURIComponent(id)}`, {
      limit,
    });
    return normalizeRelatedResponse(value);
  }

  async whatNext(limit = 10): Promise<CoreWhatNextResponse> {
    const value = await this.get("/what-next", { limit });
    return normalizeWhatNextResponse(value);
  }

  async openLoops(limit = 50): Promise<CoreOpenLoopsResponse> {
    const value = await this.get("/open-loops", { limit });
    return normalizeOpenLoopsResponse(value);
  }

  async agenda(
    view: CoreAgendaView = "today",
    limit = 10,
  ): Promise<CoreAgendaResponse> {
    const value = await this.get("/agenda", { view, limit });
    return normalizeAgendaResponse(value);
  }

  async recent(days = 1, limit = 20): Promise<CoreRecentResponse> {
    const value = await this.get("/recent", { days, limit });
    return normalizeRecentResponse(value);
  }

  async links(recordType: CoreRecordType, id: string): Promise<CoreLink[]> {
    if (recordType === "record") return [];
    const value = await this.get(
      `/links/involving/${encodeURIComponent(recordType)}/${encodeURIComponent(id)}`,
    );
    return normalizeLinksResponse(value);
  }

  async legacyContext(id: string, limit = 10): Promise<CoreLegacyContext> {
    const value = await this.get(`/context/${encodeURIComponent(id)}`, {
      limit,
    });
    return normalizeLegacyContext(value);
  }

  async getRecord(recordType: CoreRecordType, id: string): Promise<CoreRecord> {
    if (recordType === "record" || recordType === "note") {
      const note = await this.getNote(id);
      return {
        id: note.id,
        recordType: "note",
        title: note.title,
        content: note.content,
        tags: note.tags ?? [],
        status: note.status,
        updated_at: note.updated_at,
        created_at: note.created_at,
      };
    }
    const value = await this.get(
      `/records/${encodeURIComponent(recordType)}/${encodeURIComponent(id)}`,
    );
    return normalizeRecord(value, recordType);
  }

  async listRecords(
    recordType: CoreRecordType,
    limit = 20,
  ): Promise<CoreRecord[]> {
    const value = await this.get("/records", { type: recordType, limit });
    return normalizeRecordList(value, recordType);
  }

  async projectContext(id: string): Promise<CoreProjectContext> {
    const value = await this.get(`/projects/${encodeURIComponent(id)}/context`);
    return normalizeProjectContext(value);
  }

  async createRecord(
    recordType: CoreTypedRecordType,
    input: CoreCreateRecordInput,
  ): Promise<CoreRecord> {
    const value = await this.post(
      `/records/${encodeURIComponent(recordType)}`,
      input,
    );
    return normalizeRecord(
      createdRecordWithInputFallback(value, input),
      recordType,
    );
  }

  async createLink(input: CoreCreateLinkInput): Promise<CoreLink> {
    const value = await this.post("/links", input);
    return normalizeLinkOrThrow(value);
  }

  async captureRecord(
    recordType: CoreTypedRecordType,
    input: CoreCreateRecordInput,
    linkTargets: CoreRecordRef[],
  ): Promise<CoreCaptureResult> {
    const record = await this.createRecord(recordType, {
      ...input,
      source: input.source ?? "api",
    });
    const links: CoreLink[] = [];
    const skippedLinks: CoreSkippedLink[] = [];
    for (const target of linkTargets) {
      const draft = defaultOperationalLink(record, target);
      if (!draft) {
        skippedLinks.push({
          target,
          reason: "unsupported operational link shape",
        });
        continue;
      }
      try {
        links.push(await this.createLink(draft));
      } catch (error) {
        skippedLinks.push({
          target,
          reason: `${linkDraftLabel(draft)}: ${
            error instanceof Error ? error.message : "link creation failed"
          }`,
        });
      }
    }
    return { record, links, skippedLinks };
  }

  async updateTask(id: string, update: CoreTaskUpdate): Promise<CoreRecord> {
    const value = await this.patch(
      `/records/task/${encodeURIComponent(id)}`,
      update,
    );
    return normalizeRecord(value, "task");
  }

  startTask(id: string): Promise<CoreRecord> {
    return this.updateTask(id, { status: "in_progress" });
  }

  blockTask(id: string, reason: string): Promise<CoreRecord> {
    return this.updateTask(id, {
      status: "blocked",
      blocked_reason: reason,
    });
  }

  unblockTask(id: string): Promise<CoreRecord> {
    return this.updateTask(id, {
      status: "open",
      blocked_reason: null,
    });
  }

  closeTask(id: string): Promise<CoreRecord> {
    return this.updateTask(id, {
      status: "completed",
      completed_at: Date.now(),
    });
  }

  scheduleTask(
    id: string,
    field: "due_at" | "resurface_at",
    timestamp: number,
  ): Promise<CoreRecord> {
    return this.updateTask(id, { [field]: timestamp });
  }

  async appendTaskNote(id: string, note: string): Promise<CoreRecord> {
    const task = await this.getRecord("task", id);
    return this.updateTask(id, {
      content: appendMarkdownNote(task.content ?? "", note),
    });
  }

  recordApiUrl(recordType: CoreRecordType, id: string): string {
    const path =
      recordType === "record" || recordType === "note"
        ? `note/${encodeURIComponent(id)}`
        : `records/${encodeURIComponent(recordType)}/${encodeURIComponent(id)}`;
    const url = new URL(path, this.baseUrl);
    return url.toString();
  }

  private async get(path: string, query?: Query): Promise<unknown> {
    const response = await fetch(this.urlFor(path, query), {
      method: "GET",
      headers: this.headers(),
    });
    const body = await parseResponseBody(response);
    if (!response.ok) throw httpError(response, body);
    return body;
  }

  private async patch(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(this.urlFor(path), {
      method: "PATCH",
      headers: this.jsonHeaders(),
      body: JSON.stringify(body),
    });
    const responseBody = await parseResponseBody(response);
    if (!response.ok) throw httpError(response, responseBody);
    return responseBody;
  }

  private async post(path: string, body: unknown): Promise<unknown> {
    const response = await fetch(this.urlFor(path), {
      method: "POST",
      headers: this.jsonHeaders(),
      body: JSON.stringify(body),
    });
    const responseBody = await parseResponseBody(response);
    if (!response.ok) throw httpError(response, responseBody);
    return responseBody;
  }

  private urlFor(path: string, query?: Query): URL {
    const url = new URL(path.replace(/^\//, ""), this.baseUrl);
    for (const [key, value] of Object.entries(query ?? {})) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
    return url;
  }

  private headers(): Headers {
    const headers = new Headers({
      accept: "application/json",
      authorization: `Bearer ${this.preferences.apiToken}`,
      "x-agent-name": "raycast",
      "x-core-client": "raycast-core",
    });
    const namespace = this.preferences.namespace?.trim();
    if (namespace) headers.set("x-namespace", namespace);
    return headers;
  }

  private jsonHeaders(): Headers {
    const headers = this.headers();
    headers.set("content-type", "application/json");
    return headers;
  }
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

function appendMarkdownNote(content: string, note: string): string {
  const trimmedContent = content.trimEnd();
  const trimmedNote = note.trim();
  const timestamp = new Date(Date.now()).toISOString();
  const entry = `---\n\n*${timestamp}*\n\n${trimmedNote}`;
  return trimmedContent ? `${trimmedContent}\n\n${entry}` : entry;
}

function createdRecordWithInputFallback(
  value: unknown,
  input: CoreCreateRecordInput,
): unknown {
  if (!isRecord(value)) return value;
  const response = { ...value };
  if (!objectString(response, "title")) response.title = input.title;
  if (!objectString(response, "content") && input.content) {
    response.content = input.content;
  }
  if (!Array.isArray(response.tags) && input.tags) response.tags = input.tags;
  return response;
}

export function defaultOperationalLink(
  source: CoreRecordRef,
  target: CoreRecordRef,
): CoreCreateLinkInput | null {
  if (source.recordType === "record" || target.recordType === "record") {
    return null;
  }
  const direct = defaultCoreLinkRelType(source.recordType, target.recordType);
  if (direct) {
    return {
      from_type: source.recordType,
      from_id: source.id,
      to_type: target.recordType,
      to_id: target.id,
      rel_type: direct,
    };
  }
  const inverse = defaultCoreLinkRelType(target.recordType, source.recordType);
  if (!inverse) return null;
  return {
    from_type: target.recordType,
    from_id: target.id,
    to_type: source.recordType,
    to_id: source.id,
    rel_type: inverse,
  };
}

export function defaultCoreLinkRelType(
  fromType: CoreTypedRecordType,
  toType: CoreTypedRecordType,
): string | null {
  const key = `${fromType}:${toType}`;
  const relByPair: Record<string, string> = {
    "task:project": "belongs_to",
    "task:opportunity": "belongs_to",
    "task:task": "depends_on",
    "task:note": "has_context",
    "task:person": "associated_with",
    "task:organisation": "followup_for",
    "project:note": "has_context",
    "project:person": "involves",
    "project:organisation": "involves",
    "project:opportunity": "associated_with",
    "note:project": "has_context",
    "note:opportunity": "has_context",
    "note:person": "has_context",
    "note:organisation": "has_context",
    "note:task": "has_context",
    "opportunity:project": "associated_with",
    "opportunity:person": "involves",
    "opportunity:organisation": "involves",
    "person:organisation": "works_at",
  };
  return relByPair[key] ?? null;
}

function linkDraftLabel(input: CoreCreateLinkInput): string {
  return `${input.from_type}:${input.from_id} --[${input.rel_type}]--> ${input.to_type}:${input.to_id}`;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function httpError(response: Response, body: unknown): CoreEdgeError {
  const bodyMessage =
    (isRecord(body) ? objectString(body, "error") : undefined) ??
    (typeof body === "string" ? body : undefined);
  const message = bodyMessage || `Core Edge returned HTTP ${response.status}`;
  return new CoreEdgeError(message, response.status);
}

function normalizeSearchResponse(value: unknown): CoreSearchResponse {
  if (!isRecord(value)) return { mode: "hybrid", results: [] };
  const rawResults = Array.isArray(value.results) ? value.results : [];
  return {
    mode: objectString(value, "mode") ?? "hybrid",
    warning: objectString(value, "warning"),
    results: rawResults
      .map(normalizeSearchResult)
      .filter((result): result is CoreSearchResult => result !== null),
  };
}

function normalizeSearchResult(value: unknown): CoreSearchResult | null {
  if (!isRecord(value)) return null;
  const id = objectString(value, "doc_id") ?? objectString(value, "id");
  const title = objectString(value, "title");
  if (!id || !title) return null;
  return {
    id,
    docId: id,
    recordType:
      normalizeRecordType(objectString(value, "record_type")) ??
      inferRecordType(id),
    title,
    snippet: objectString(value, "snippet"),
    summary: objectString(value, "summary"),
    score: objectNumber(value, "score"),
    wordCount: objectNumber(value, "word_count"),
  };
}

function normalizeRecordType(
  value: string | undefined,
): CoreRecordType | undefined {
  switch (value) {
    case "note":
    case "task":
    case "project":
    case "person":
    case "organisation":
    case "opportunity":
      return value;
    default:
      return undefined;
  }
}

function inferRecordType(id: string): CoreRecordType {
  if (id.startsWith("nd") || id.startsWith("j")) return "note";
  if (id.startsWith("nx")) return "project";
  if (id.startsWith("ns")) return "person";
  if (id.startsWith("nn")) return "organisation";
  if (id.startsWith("nh")) return "opportunity";
  if (id.startsWith("p")) return "task";
  return "record";
}

function normalizeRelatedResponse(value: unknown): CoreRelatedResult[] {
  if (!isRecord(value) || !Array.isArray(value.related)) return [];
  return value.related
    .map((entry) => {
      if (!isRecord(entry)) return null;
      const id = objectString(entry, "id");
      const title = objectString(entry, "title");
      if (!id || !title) return null;
      const result: CoreRelatedResult = {
        id,
        recordType:
          normalizeRecordType(objectString(entry, "record_type")) ??
          inferRecordType(id),
        title,
        tags: objectStringArray(entry, "tags"),
        signals: objectStringArray(entry, "signals"),
      };
      const score = objectNumber(entry, "score");
      if (score !== undefined) result.score = score;
      return result;
    })
    .filter((entry): entry is CoreRelatedResult => entry !== null);
}

function normalizeLinksResponse(value: unknown): CoreLink[] {
  if (!isRecord(value) || !Array.isArray(value.links)) return [];
  return value.links
    .map(normalizeLink)
    .filter((link): link is CoreLink => link !== null);
}

function normalizeLink(value: unknown): CoreLink | null {
  if (!isRecord(value)) return null;
  const id = objectString(value, "id") ?? objectString(value, "_id");
  const relType = objectString(value, "rel_type");
  const fromId = objectString(value, "from_id");
  const toId = objectString(value, "to_id");
  const fromType = normalizeRecordType(objectString(value, "from_type"));
  const toType = normalizeRecordType(objectString(value, "to_type"));
  if (!id || !relType || !fromId || !toId || !fromType || !toType) return null;
  return {
    id,
    relType,
    from: {
      id: fromId,
      recordType: fromType,
      title: objectString(value, "from_title") ?? fromId,
    },
    to: {
      id: toId,
      recordType: toType,
      title: objectString(value, "to_title") ?? toId,
    },
  };
}

function normalizeLinkOrThrow(value: unknown): CoreLink {
  const link = normalizeLink(value);
  if (!link)
    throw new CoreEdgeError("Core Edge returned an invalid link response");
  return link;
}

function normalizeRecord(
  value: unknown,
  fallbackType: CoreRecordType,
): CoreRecord {
  if (!isRecord(value))
    throw new CoreEdgeError("Core Edge returned an invalid record response");
  const id =
    objectString(value, "record_id") ??
    objectString(value, "id") ??
    objectString(value, "_id");
  const title = objectString(value, "title");
  if (!id || !title)
    throw new CoreEdgeError(
      "Core Edge returned a record without an id or title",
    );
  return {
    id,
    recordType:
      normalizeRecordType(objectString(value, "record_type")) ?? fallbackType,
    title,
    content: objectString(value, "content"),
    tags: objectStringArray(value, "tags"),
    status: objectString(value, "status"),
    stage: objectString(value, "stage"),
    priority: objectString(value, "priority"),
    due_at: objectNumber(value, "due_at"),
    resurface_at: objectNumber(value, "resurface_at"),
    blocked_reason: objectString(value, "blocked_reason"),
    updated_at: objectNumber(value, "updated_at"),
    created_at: objectNumber(value, "created_at"),
    completed_at: objectNumber(value, "completed_at"),
  };
}

function normalizeWhatNextResponse(value: unknown): CoreWhatNextResponse {
  if (!isRecord(value))
    return {
      suggestedAction: "none",
      counts: {},
      filters: {},
      items: [],
    };
  const items = objectArray(value, "items")
    .map(normalizeWhatNextItem)
    .filter((item): item is CoreWhatNextItem => item !== null);
  const suggestedActionValue = isRecord(value.suggested_next_action)
    ? value.suggested_next_action
    : undefined;
  const suggestedAction =
    (suggestedActionValue
      ? objectString(suggestedActionValue, "action")
      : undefined) ?? "none";
  const suggestedItem = suggestedActionValue
    ? (normalizeWhatNextItem(suggestedActionValue.item) ?? undefined)
    : undefined;

  return {
    namespace: objectString(value, "namespace"),
    suggestedAction,
    suggestedItem,
    counts: objectNumberRecord(value, "counts"),
    filters: objectStringBooleanRecord(value, "filters"),
    items,
  };
}

function normalizeWhatNextItem(value: unknown): CoreWhatNextItem | null {
  if (!isRecord(value) || !isRecord(value.task)) return null;
  const task = normalizeRecord(value.task, "task");
  return {
    task,
    blocked: objectBoolean(value, "blocked") ?? task.status === "blocked",
    blockers: objectArray(value, "blockers")
      .map((entry) => normalizeRecordRef(entry, "task"))
      .filter((entry): entry is CoreRecordRef => entry !== null),
    project: normalizeRecordRef(value.project, "project") ?? undefined,
    assignee: normalizeRecordRef(value.assignee, "person") ?? undefined,
    assignees: objectArray(value, "assignees")
      .map((entry) => normalizeRecordRef(entry, "person"))
      .filter((entry): entry is CoreRecordRef => entry !== null),
  };
}

function normalizeOpenLoopsResponse(value: unknown): CoreOpenLoopsResponse {
  const emptyCategories = emptyOpenLoopCategories();
  if (!isRecord(value))
    return {
      counts: {},
      metadata: {},
      categories: emptyCategories,
    };
  const categoryRecord = isRecord(value.categories) ? value.categories : {};
  return {
    namespace: objectString(value, "namespace"),
    category: normalizeOpenLoopCategory(objectString(value, "category")),
    counts: objectNumberRecord(value, "counts"),
    metadata: objectNumberRecord(value, "metadata"),
    categories: {
      hygiene: normalizeOpenLoopItems(categoryRecord, "hygiene"),
      blocked: normalizeOpenLoopItems(categoryRecord, "blocked"),
      stale: normalizeOpenLoopItems(categoryRecord, "stale"),
      projects: normalizeOpenLoopItems(categoryRecord, "projects"),
      opportunities: normalizeOpenLoopItems(categoryRecord, "opportunities"),
    },
  };
}

function emptyOpenLoopCategories(): Record<
  CoreOpenLoopCategory,
  CoreOpenLoopItem[]
> {
  return {
    hygiene: [],
    blocked: [],
    stale: [],
    projects: [],
    opportunities: [],
  };
}

function normalizeOpenLoopItems(
  categories: Record<string, unknown>,
  category: CoreOpenLoopCategory,
): CoreOpenLoopItem[] {
  return objectArray(categories, category)
    .map(normalizeOpenLoopItem)
    .filter((item): item is CoreOpenLoopItem => item !== null);
}

function normalizeOpenLoopItem(value: unknown): CoreOpenLoopItem | null {
  const ref = normalizeRecordRef(value, "record");
  if (!ref || !isRecord(value)) return null;
  return {
    ...ref,
    issueType: objectString(value, "issue_type") ?? "open_loop",
    detail: objectString(value, "detail"),
    status: objectString(value, "status"),
    stage: objectString(value, "stage"),
    suggestedCommands: objectStringArray(value, "suggested_commands"),
    reasons: objectStringArray(value, "reasons"),
    updated_at: objectNumber(value, "updated_at"),
  };
}

function normalizeOpenLoopCategory(
  value: string | undefined,
): CoreOpenLoopCategory | undefined {
  switch (value) {
    case "hygiene":
    case "blocked":
    case "stale":
    case "projects":
    case "opportunities":
      return value;
    default:
      return undefined;
  }
}

const agendaBuckets: CoreAgendaBucket[] = [
  "overdue",
  "today",
  "week",
  "future",
  "unscheduled",
];

function normalizeAgendaResponse(value: unknown): CoreAgendaResponse {
  const emptyBuckets = emptyAgendaBuckets();
  if (!isRecord(value)) {
    return {
      view: "today",
      counts: {},
      metadata: {},
      buckets: emptyBuckets,
    };
  }
  const bucketRecord = isRecord(value.buckets) ? value.buckets : {};
  const buckets = Object.fromEntries(
    agendaBuckets.map((bucket) => [
      bucket,
      objectArray(bucketRecord, bucket)
        .map((item) => normalizeAgendaItem(item, bucket))
        .filter((item): item is CoreAgendaItem => item !== null),
    ]),
  ) as Record<CoreAgendaBucket, CoreAgendaItem[]>;
  return {
    namespace: objectString(value, "namespace"),
    view: normalizeAgendaView(objectString(value, "view")) ?? "today",
    counts: objectNumberRecord(value, "counts"),
    metadata: objectStringNumberRecord(value, "metadata"),
    buckets,
  };
}

function emptyAgendaBuckets(): Record<CoreAgendaBucket, CoreAgendaItem[]> {
  return {
    overdue: [],
    today: [],
    week: [],
    future: [],
    unscheduled: [],
  };
}

function normalizeAgendaItem(
  value: unknown,
  bucket: CoreAgendaBucket,
): CoreAgendaItem | null {
  const item = normalizeWhatNextItem(value);
  return item ? { ...item, bucket } : null;
}

function normalizeAgendaView(
  value: string | undefined,
): CoreAgendaView | undefined {
  switch (value) {
    case "today":
    case "week":
    case "overdue":
    case "all":
      return value;
    default:
      return undefined;
  }
}

function normalizeRecentResponse(value: unknown): CoreRecentResponse {
  if (!isRecord(value)) return { days: 1, total: 0, items: [] };
  return {
    days: objectNumber(value, "days") ?? 1,
    total: objectNumber(value, "total") ?? 0,
    items: objectArray(value, "changes")
      .map(normalizeRecentItem)
      .filter((item): item is CoreRecentItem => item !== null),
  };
}

function normalizeRecentItem(value: unknown): CoreRecentItem | null {
  if (!isRecord(value)) return null;
  const id =
    objectString(value, "record_id") ??
    objectString(value, "doc_id") ??
    objectString(value, "id");
  const title =
    objectString(value, "title") ??
    objectString(value, "docTitle") ??
    objectString(value, "doc_title");
  const operation = objectString(value, "operation");
  if (!id || !title || !operation) return null;
  return {
    id,
    title,
    recordType:
      normalizeRecordType(objectString(value, "record_type")) ??
      inferRecordType(id),
    operation,
    timestamp: objectNumber(value, "timestamp"),
    agent: objectString(value, "agent"),
    source: objectString(value, "source"),
  };
}

function normalizeRecordList(
  value: unknown,
  fallbackType: CoreRecordType,
): CoreRecord[] {
  if (!isRecord(value)) return [];
  return objectArray(value, "records")
    .map((record) => normalizeRecordListItem(record, fallbackType))
    .filter((record): record is CoreRecord => record !== null);
}

function normalizeRecordListItem(
  value: unknown,
  fallbackType: CoreRecordType,
): CoreRecord | null {
  try {
    return normalizeRecord(value, fallbackType);
  } catch {
    return null;
  }
}

function normalizeLegacyContext(value: unknown): CoreLegacyContext {
  if (!isRecord(value))
    throw new CoreEdgeError("Core Edge returned an invalid legacy context");
  const document = normalizeRecordRef(value.document, "note");
  if (!document)
    throw new CoreEdgeError("Core Edge returned legacy context without a note");
  return {
    document,
    forwardLinks: normalizeLegacyTitleLinks(value, "forward_links"),
    backlinks: normalizeLegacyTitleLinks(value, "backlinks"),
    relatedByTags: objectArray(value, "related_by_tags")
      .map(normalizeLegacyRelatedNote)
      .filter((note): note is CoreLegacyRelatedNote => note !== null),
    typedRelationships: objectArray(value, "typed_relationships")
      .map(normalizeLegacyRelationship)
      .filter(
        (relationship): relationship is CoreLegacyRelationship =>
          relationship !== null,
      ),
  };
}

function normalizeLegacyTitleLinks(
  value: Record<string, unknown>,
  key: string,
): CoreLegacyContextLink[] {
  return objectArray(value, key)
    .map((entry) => {
      if (typeof entry === "string") return { title: entry };
      if (!isRecord(entry)) return null;
      const title = objectString(entry, "title");
      if (!title) return null;
      return {
        id: objectString(entry, "id") ?? objectString(entry, "doc_id"),
        title,
      };
    })
    .filter((entry): entry is CoreLegacyContextLink => entry !== null);
}

function normalizeLegacyRelatedNote(
  value: unknown,
): CoreLegacyRelatedNote | null {
  const ref = normalizeRecordRef(value, "note");
  if (!ref || !isRecord(value)) return null;
  return {
    ...ref,
    sharedTags: objectStringArray(value, "shared_tags"),
  };
}

function normalizeLegacyRelationship(
  value: unknown,
): CoreLegacyRelationship | null {
  if (!isRecord(value)) return null;
  const id = objectString(value, "other_doc_id");
  const title = objectString(value, "other_title");
  if (!id || !title) return null;
  return {
    id,
    title,
    recordType: "note",
    direction: objectString(value, "direction"),
    relType: objectString(value, "rel_type"),
    reason: objectString(value, "reason"),
    createdBy: objectString(value, "created_by"),
  };
}

function normalizeProjectContext(value: unknown): CoreProjectContext {
  if (!isRecord(value))
    throw new CoreEdgeError("Core Edge returned an invalid project context");
  const project = normalizeRecord(value.project, "project");
  const tasks = objectArray(value, "tasks")
    .map(normalizeProjectTask)
    .filter((task): task is CoreProjectTask => task !== null);
  const blockedTasks = objectArray(value, "blocked_tasks")
    .map(normalizeProjectTask)
    .filter((task): task is CoreProjectTask => task !== null);
  const suggestedActionValue = isRecord(value.suggested_next_action)
    ? value.suggested_next_action
    : undefined;
  const suggestedAction =
    (suggestedActionValue
      ? objectString(suggestedActionValue, "action")
      : undefined) ?? "none";
  const suggestedTask = suggestedActionValue
    ? (normalizeProjectTask(suggestedActionValue.task) ?? undefined)
    : undefined;

  return {
    project,
    tasks,
    contextNotes: objectArray(value, "context_notes")
      .map(normalizeProjectContextNote)
      .filter((note): note is CoreProjectContextNote => note !== null),
    blockedTasks,
    blockers: objectArray(value, "blockers")
      .map((entry) => normalizeRecordRef(entry, "task"))
      .filter((entry): entry is CoreRecordRef => entry !== null),
    countsByStatus: objectNumberRecord(value, "counts_by_status"),
    taskCount: objectNumber(value, "task_count") ?? tasks.length,
    blockedCount: objectNumber(value, "blocked_count") ?? blockedTasks.length,
    suggestedAction,
    suggestedTask,
  };
}

function normalizeProjectTask(value: unknown): CoreProjectTask | null {
  if (!isRecord(value)) return null;
  try {
    const task = normalizeRecord(value, "task");
    return {
      ...task,
      assignee: normalizeRecordRef(value.assignee, "person") ?? undefined,
      assignees: objectArray(value, "assignees")
        .map((entry) => normalizeRecordRef(entry, "person"))
        .filter((entry): entry is CoreRecordRef => entry !== null),
    };
  } catch {
    return null;
  }
}

function normalizeProjectContextNote(
  value: unknown,
): CoreProjectContextNote | null {
  const ref = normalizeRecordRef(value, "note");
  if (!ref || !isRecord(value)) return null;
  return {
    ...ref,
    relType: objectString(value, "rel_type"),
    direction: objectString(value, "direction"),
  };
}

function normalizeRecordRef(
  value: unknown,
  fallbackType: CoreRecordType,
): CoreRecordRef | null {
  if (!isRecord(value)) return null;
  const id =
    objectString(value, "record_id") ??
    objectString(value, "id") ??
    objectString(value, "_id");
  const title = objectString(value, "title");
  if (!id || !title) return null;
  return {
    id,
    title,
    recordType:
      normalizeRecordType(objectString(value, "record_type")) ??
      normalizeRecordType(objectString(value, "type")) ??
      fallbackType,
  };
}

function normalizeNote(value: unknown): CoreNote {
  if (!isRecord(value))
    throw new CoreEdgeError("Core Edge returned an invalid note response");
  const id = objectString(value, "id");
  const title = objectString(value, "title");
  if (!id || !title)
    throw new CoreEdgeError("Core Edge returned a note without an id or title");
  return {
    id,
    title,
    content: objectString(value, "content"),
    tags: objectStringArray(value, "tags"),
    summary: objectString(value, "summary"),
    status: objectString(value, "status"),
    source: objectString(value, "source"),
    file_path: objectString(value, "file_path"),
    created_at: objectNumber(value, "created_at"),
    updated_at: objectNumber(value, "updated_at"),
    word_count: objectNumber(value, "word_count"),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function objectString(
  value: Record<string, unknown>,
  key: string,
): string | undefined {
  const field = value[key];
  return typeof field === "string" && field.length > 0 ? field : undefined;
}

function objectNumber(
  value: Record<string, unknown>,
  key: string,
): number | undefined {
  const field = value[key];
  return typeof field === "number" && Number.isFinite(field)
    ? field
    : undefined;
}

function objectBoolean(
  value: Record<string, unknown>,
  key: string,
): boolean | undefined {
  const field = value[key];
  return typeof field === "boolean" ? field : undefined;
}

function objectArray(value: Record<string, unknown>, key: string): unknown[] {
  const field = value[key];
  return Array.isArray(field) ? field : [];
}

function objectStringArray(
  value: Record<string, unknown>,
  key: string,
): string[] {
  return objectArray(value, key).filter(
    (item): item is string => typeof item === "string",
  );
}

function objectNumberRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, number> {
  const field = value[key];
  if (!isRecord(field)) return {};
  return Object.fromEntries(
    Object.entries(field).filter(
      (entry): entry is [string, number] =>
        typeof entry[1] === "number" && Number.isFinite(entry[1]),
    ),
  );
}

function objectStringBooleanRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, string | boolean> {
  const field = value[key];
  if (!isRecord(field)) return {};
  return Object.fromEntries(
    Object.entries(field).filter(
      (entry): entry is [string, string | boolean] =>
        typeof entry[1] === "string" || typeof entry[1] === "boolean",
    ),
  );
}

function objectStringNumberRecord(
  value: Record<string, unknown>,
  key: string,
): Record<string, string | number> {
  const field = value[key];
  if (!isRecord(field)) return {};
  return Object.fromEntries(
    Object.entries(field).filter(
      (entry): entry is [string, string | number] =>
        typeof entry[1] === "string" ||
        (typeof entry[1] === "number" && Number.isFinite(entry[1])),
    ),
  );
}
