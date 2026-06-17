import {
  Action,
  ActionPanel,
  Color,
  Icon,
  List,
  Toast,
  getPreferenceValues,
  openExtensionPreferences,
  showToast,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  CoreEdgeClient,
  CorePreferences,
  CoreProjectContext,
  CoreProjectContextNote,
  CoreProjectTask,
  CoreRecord,
  CoreRecordRef,
  CoreSearchResult,
} from "./core-edge.js";
import {
  CopyRecordActions,
  LinkedRecords,
  RecordActions,
  errorMessage,
  formatTimestamp,
  formatValue,
  preferenceLimit,
  recordTypeIcon,
  readTarget,
  useCoreClient,
} from "./record-ui.js";

const SEARCH_DEBOUNCE_MS = 250;

export default function ProjectContextCommand() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = preferenceLimit(preferences);
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebouncedValue(
    searchText.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const [state, setState] = useState<ProjectSearchState>({
    projects: [],
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      ...current,
      status: "loading",
      error: undefined,
    }));

    const request = debouncedSearchText
      ? client
          .search(debouncedSearchText, limit)
          .then((response) =>
            response.results.filter(
              (result) => result.recordType === "project",
            ),
          )
      : client.listRecords("project", Math.max(limit, 20));

    request
      .then((response) => {
        if (cancelled) return;
        setState({
          projects: response,
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled)
          setState({ status: "error", projects: [], error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Project Search Failed",
          message,
        });
      });

    return () => {
      cancelled = true;
    };
  }, [client, debouncedSearchText, limit]);

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={state.projects.length > 0}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search projects"
      throttle
    >
      <ProjectSearchEmptyState
        state={state}
        hasQuery={Boolean(debouncedSearchText)}
      />
      {state.projects.length > 0 ? (
        <List.Section
          title={debouncedSearchText ? "Matching Projects" : "Projects"}
        >
          {state.projects.map((project) => (
            <ProjectSearchItem
              key={project.id}
              client={client}
              project={project}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function ProjectSearchItem({
  client,
  project,
}: {
  client: CoreEdgeClient;
  project: ProjectListItem;
}) {
  const score = "score" in project ? project.score : undefined;
  const summary = "summary" in project ? project.summary : undefined;
  const snippet = "snippet" in project ? project.snippet : undefined;
  const content = "content" in project ? project.content : undefined;
  const status = "status" in project ? project.status : undefined;
  const updatedAt = "updated_at" in project ? project.updated_at : undefined;
  return (
    <List.Item
      icon={recordTypeIcon("project")}
      title={project.title}
      detail={
        <List.Item.Detail
          markdown={summary || snippet || content || "Project record."}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={project.title}
              />
              <List.Item.Detail.Metadata.Label
                title="Type"
                text="Project"
                icon={recordTypeIcon("project")}
              />
              {status ? (
                <List.Item.Detail.Metadata.Label
                  title="Status"
                  text={formatValue(status)}
                />
              ) : null}
              {updatedAt ? (
                <List.Item.Detail.Metadata.Label
                  title="Updated"
                  text={formatTimestamp(updatedAt)}
                />
              ) : null}
              {score !== undefined ? (
                <List.Item.Detail.Metadata.Label
                  title="Score"
                  text={score.toFixed(3)}
                />
              ) : null}
              <List.Item.Detail.Metadata.Label title="ID" text={project.id} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          <Action.Push
            icon={Icon.Sidebar}
            title="Open Project Context"
            target={<ProjectContextView client={client} project={project} />}
          />
          <Action.Push
            icon={Icon.Book}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            title="Read Record"
            target={readTarget(client, project)}
          />
          <Action.Push
            icon={Icon.Binoculars}
            title="Explore Links"
            target={<LinkedRecords client={client} source={project} />}
          />
          <CopyRecordActions client={client} record={project} />
        </ActionPanel>
      }
    />
  );
}

function ProjectContextView({
  client,
  project,
}: {
  client: CoreEdgeClient;
  project: CoreRecordRef;
}) {
  const [state, setState] = useState<ProjectContextState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    client
      .projectContext(project.id)
      .then((context) => {
        if (!cancelled) setState({ status: "ready", context });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: "error", error: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [client, project.id]);

  if (state.status === "error") {
    return (
      <List>
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to Load Project Context"
          description={state.error}
        />
      </List>
    );
  }

  if (state.status !== "ready") {
    return <List isLoading searchBarPlaceholder="Loading project context" />;
  }

  const { context } = state;
  const suggestedTask = context.suggestedTask;
  const blockedIds = new Set(context.blockedTasks.map((task) => task.id));
  const activeTasks = context.tasks.filter(
    (task) => task.status !== "completed" && task.status !== "archived",
  );

  return (
    <List
      isShowingDetail
      navigationTitle={context.project.title}
      searchBarPlaceholder="Filter project context"
    >
      <List.Section title="Project">
        <ProjectSummaryItem client={client} context={context} />
      </List.Section>
      {suggestedTask ? (
        <List.Section
          title="Suggested"
          subtitle={formatValue(context.suggestedAction)}
        >
          <ProjectTaskItem
            client={client}
            context={context}
            isBlocked={blockedIds.has(suggestedTask.id)}
            task={suggestedTask}
          />
        </List.Section>
      ) : null}
      {context.blockedTasks.length > 0 ? (
        <List.Section title="Blocked Tasks">
          {context.blockedTasks.map((task) => (
            <ProjectTaskItem
              key={`blocked:${task.id}`}
              client={client}
              context={context}
              isBlocked
              task={task}
            />
          ))}
        </List.Section>
      ) : null}
      {activeTasks.length > 0 ? (
        <List.Section
          title="Active Tasks"
          subtitle={String(activeTasks.length)}
        >
          {activeTasks.map((task) => (
            <ProjectTaskItem
              key={task.id}
              client={client}
              context={context}
              isBlocked={blockedIds.has(task.id)}
              task={task}
            />
          ))}
        </List.Section>
      ) : null}
      {context.contextNotes.length > 0 ? (
        <List.Section
          title="Context Notes"
          subtitle={String(context.contextNotes.length)}
        >
          {context.contextNotes.map((note) => (
            <ProjectContextNoteItem key={note.id} client={client} note={note} />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function ProjectSummaryItem({
  client,
  context,
}: {
  client: CoreEdgeClient;
  context: CoreProjectContext;
}) {
  return (
    <List.Item
      icon={recordTypeIcon("project")}
      title={context.project.title}
      detail={
        <List.Item.Detail
          markdown={projectMarkdown(context)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={context.project.title}
              />
              {context.project.status ? (
                <List.Item.Detail.Metadata.Label
                  title="Status"
                  text={formatValue(context.project.status)}
                />
              ) : null}
              <List.Item.Detail.Metadata.Label
                title="Tasks"
                text={String(context.taskCount)}
              />
              <List.Item.Detail.Metadata.Label
                title="Blocked"
                text={String(context.blockedCount)}
              />
              {Object.entries(context.countsByStatus).map(([status, count]) => (
                <List.Item.Detail.Metadata.Label
                  key={status}
                  title={formatValue(status)}
                  text={String(count)}
                />
              ))}
              {context.project.updated_at ? (
                <List.Item.Detail.Metadata.Label
                  title="Updated"
                  text={formatTimestamp(context.project.updated_at)}
                />
              ) : null}
              <List.Item.Detail.Metadata.Label
                title="ID"
                text={context.project.id}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={<RecordActions client={client} record={context.project} />}
    />
  );
}

function ProjectTaskItem({
  client,
  context,
  isBlocked,
  task,
}: {
  client: CoreEdgeClient;
  context: CoreProjectContext;
  isBlocked: boolean;
  task: CoreProjectTask;
}) {
  const [currentTask, setCurrentTask] = useState(task);

  useEffect(() => {
    setCurrentTask(task);
  }, [task]);

  const updateTask = (updated: CoreRecord) => {
    setCurrentTask((current) => ({
      ...current,
      ...updated,
    }));
  };
  const currentIsBlocked = currentTask.status
    ? currentTask.status === "blocked"
    : isBlocked;

  return (
    <List.Item
      icon={recordTypeIcon("task")}
      title={currentTask.title}
      detail={
        <List.Item.Detail
          markdown={taskMarkdown(currentTask, currentIsBlocked)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={currentTask.title}
              />
              <List.Item.Detail.Metadata.Label
                title="State"
                text={currentIsBlocked ? "Blocked" : "Actionable"}
                icon={{
                  source: currentIsBlocked ? Icon.Pause : Icon.Play,
                  tintColor: currentIsBlocked ? Color.Orange : Color.Green,
                }}
              />
              {currentTask.status ? (
                <List.Item.Detail.Metadata.Label
                  title="Status"
                  text={formatValue(currentTask.status)}
                />
              ) : null}
              {currentTask.priority ? (
                <List.Item.Detail.Metadata.Label
                  title="Priority"
                  text={formatValue(currentTask.priority)}
                />
              ) : null}
              {currentTask.due_at ? (
                <List.Item.Detail.Metadata.Label
                  title="Due"
                  text={formatTimestamp(currentTask.due_at)}
                />
              ) : null}
              {currentTask.assignees.length > 0 ? (
                <List.Item.Detail.Metadata.TagList title="Assignees">
                  {currentTask.assignees.map((assignee) => (
                    <List.Item.Detail.Metadata.TagList.Item
                      key={assignee.id}
                      text={assignee.title}
                    />
                  ))}
                </List.Item.Detail.Metadata.TagList>
              ) : null}
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Project"
                text={context.project.title}
                icon={recordTypeIcon("project")}
              />
              <List.Item.Detail.Metadata.Label
                title="ID"
                text={currentTask.id}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <RecordActions
          client={client}
          onRecordUpdated={updateTask}
          readTitle="Read Task"
          record={currentTask}
        />
      }
    />
  );
}

function ProjectContextNoteItem({
  client,
  note,
}: {
  client: CoreEdgeClient;
  note: CoreProjectContextNote;
}) {
  return (
    <List.Item
      icon={recordTypeIcon("note")}
      title={note.title}
      detail={
        <List.Item.Detail
          markdown={note.relType ? formatValue(note.relType) : "Context note"}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={note.title}
              />
              {note.relType ? (
                <List.Item.Detail.Metadata.Label
                  title="Relationship"
                  text={formatValue(note.relType)}
                />
              ) : null}
              {note.direction ? (
                <List.Item.Detail.Metadata.Label
                  title="Direction"
                  text={formatValue(note.direction)}
                />
              ) : null}
              <List.Item.Detail.Metadata.Label title="ID" text={note.id} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={<RecordActions client={client} record={note} />}
    />
  );
}

function ProjectSearchEmptyState({
  hasQuery,
  state,
}: {
  hasQuery: boolean;
  state: ProjectSearchState;
}) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Search Projects"
        description={state.error}
        actions={
          <ActionPanel>
            <Action
              title="Open Extension Preferences"
              icon={Icon.Gear}
              onAction={openExtensionPreferences}
            />
          </ActionPanel>
        }
      />
    );
  }

  if (!hasQuery) {
    if (state.status === "ready" && state.projects.length === 0) {
      return (
        <List.EmptyView
          icon={Icon.Folder}
          title="No Projects"
          description="Core Edge returned no project records."
        />
      );
    }
    return null;
  }

  if (state.status === "ready" && state.projects.length === 0) {
    return (
      <List.EmptyView
        icon={Icon.Folder}
        title="No Projects"
        description="Core Edge returned no matching project records."
      />
    );
  }

  return null;
}

function projectMarkdown(context: CoreProjectContext): string {
  const sections = [`**${context.project.title}**`];
  const status = context.project.status
    ? formatValue(context.project.status)
    : undefined;
  if (status) sections.push(status);
  sections.push(
    `Tasks: ${context.taskCount}\n\nBlocked: ${context.blockedCount}\n\nContext notes: ${context.contextNotes.length}`,
  );
  return sections.join("\n\n");
}

function taskMarkdown(task: CoreProjectTask, isBlocked: boolean): string {
  const sections = [`**${task.title}**`];
  sections.push(isBlocked ? "**Blocked**" : "**Actionable**");
  if (task.content) sections.push(task.content);
  if (task.blocked_reason)
    sections.push(`**Blocked reason**\n\n${task.blocked_reason}`);
  return sections.join("\n\n");
}

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [debounced, delayMs, value]);

  return debounced;
}

type ProjectSearchState =
  | {
      status: "loading";
      projects: ProjectListItem[];
      error?: undefined;
    }
  | { status: "ready"; projects: ProjectListItem[]; error?: undefined }
  | { status: "error"; projects: ProjectListItem[]; error: string };

type ProjectListItem = CoreRecord | CoreSearchResult;

type ProjectContextState =
  | { status: "loading" }
  | { status: "ready"; context: CoreProjectContext }
  | { status: "error"; error: string };
