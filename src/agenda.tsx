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
  CoreAgendaBucket,
  CoreAgendaItem,
  CoreAgendaResponse,
  CoreAgendaView,
  CoreEdgeClient,
  CorePreferences,
  CoreRecord,
} from "./core-edge.js";
import {
  RecordActions,
  errorMessage,
  formatTimestamp,
  formatValue,
  preferenceLimit,
  recordTypeIcon,
  useCoreClient,
} from "./record-ui.js";

const BUCKET_ORDER: CoreAgendaBucket[] = [
  "overdue",
  "today",
  "week",
  "future",
  "unscheduled",
];

export default function Agenda() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = preferenceLimit(preferences);
  const [view, setView] = useState<CoreAgendaView>("today");
  const [state, setState] = useState<AgendaState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    client
      .agenda(view, limit)
      .then((response) => {
        if (!cancelled) setState({ status: "ready", response });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled) setState({ status: "error", error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Unable to Load Agenda",
          message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, limit, view]);

  const response = state.status === "ready" ? state.response : undefined;
  const returned = response?.counts.returned ?? 0;

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={Boolean(response && returned > 0)}
      searchBarAccessory={
        <AgendaViewDropdown value={view} onChange={setView} />
      }
      searchBarPlaceholder="Filter agenda"
    >
      <AgendaEmptyState state={state} />
      {response
        ? BUCKET_ORDER.map((bucket) => {
            const items = response.buckets[bucket];
            if (items.length === 0) return null;
            return (
              <List.Section
                key={bucket}
                title={bucketTitle(bucket)}
                subtitle={String(response.counts[bucket] ?? items.length)}
              >
                {items.map((item) => (
                  <AgendaListItem
                    key={`${bucket}:${item.task.id}`}
                    client={client}
                    item={item}
                    response={response}
                  />
                ))}
              </List.Section>
            );
          })
        : null}
    </List>
  );
}

function AgendaViewDropdown({
  onChange,
  value,
}: {
  onChange: (value: CoreAgendaView) => void;
  value: CoreAgendaView;
}) {
  return (
    <List.Dropdown
      tooltip="Agenda View"
      value={value}
      onChange={(newValue) => onChange(newValue as CoreAgendaView)}
    >
      <List.Dropdown.Item title="Today" value="today" />
      <List.Dropdown.Item title="This Week" value="week" />
      <List.Dropdown.Item title="Overdue" value="overdue" />
      <List.Dropdown.Item title="All" value="all" />
    </List.Dropdown>
  );
}

function AgendaListItem({
  client,
  item,
  response,
}: {
  client: CoreEdgeClient;
  item: CoreAgendaItem;
  response: CoreAgendaResponse;
}) {
  const [currentItem, setCurrentItem] = useState(item);

  useEffect(() => {
    setCurrentItem(item);
  }, [item]);

  const updateTask = (task: CoreRecord) => {
    setCurrentItem((current) => ({
      ...current,
      blocked: task.status === "blocked",
      task,
    }));
  };

  return (
    <List.Item
      icon={recordTypeIcon("task")}
      title={currentItem.task.title}
      detail={<AgendaDetail item={currentItem} response={response} />}
      actions={
        <RecordActions
          client={client}
          onRecordUpdated={updateTask}
          readTitle="Read Task"
          record={currentItem.task}
        />
      }
    />
  );
}

function AgendaDetail({
  item,
  response,
}: {
  item: CoreAgendaItem;
  response: CoreAgendaResponse;
}) {
  return (
    <List.Item.Detail
      markdown={agendaMarkdown(item)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label
            title="Title"
            text={item.task.title}
          />
          <List.Item.Detail.Metadata.Label
            title="Bucket"
            text={bucketTitle(item.bucket)}
            icon={bucketIcon(item.bucket)}
          />
          <List.Item.Detail.Metadata.Label
            title="State"
            text={item.blocked ? "Blocked" : "Actionable"}
            icon={{
              source: item.blocked ? Icon.Pause : Icon.Play,
              tintColor: item.blocked ? Color.Orange : Color.Green,
            }}
          />
          {item.task.status ? (
            <List.Item.Detail.Metadata.Label
              title="Status"
              text={formatValue(item.task.status)}
            />
          ) : null}
          {item.task.priority ? (
            <List.Item.Detail.Metadata.Label
              title="Priority"
              text={formatValue(item.task.priority)}
            />
          ) : null}
          {item.project ? (
            <List.Item.Detail.Metadata.Label
              title="Project"
              text={item.project.title}
              icon={recordTypeIcon("project")}
            />
          ) : null}
          {item.task.due_at ? (
            <List.Item.Detail.Metadata.Label
              title="Due"
              text={formatTimestamp(item.task.due_at)}
            />
          ) : null}
          {item.assignees.length > 0 ? (
            <List.Item.Detail.Metadata.TagList title="Assignees">
              {item.assignees.map((assignee) => (
                <List.Item.Detail.Metadata.TagList.Item
                  key={assignee.id}
                  text={assignee.title}
                />
              ))}
            </List.Item.Detail.Metadata.TagList>
          ) : null}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Active"
            text={String(response.counts.active ?? "Unknown")}
          />
          <List.Item.Detail.Metadata.Label
            title="Matching"
            text={String(response.counts.matching ?? "Unknown")}
          />
          <List.Item.Detail.Metadata.Label
            title="Timezone"
            text={String(response.metadata.boundary_timezone ?? "Unknown")}
          />
          <List.Item.Detail.Metadata.Label title="ID" text={item.task.id} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function AgendaEmptyState({ state }: { state: AgendaState }) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Load Agenda"
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

  if (state.status === "ready" && (state.response.counts.returned ?? 0) === 0) {
    return (
      <List.EmptyView
        icon={Icon.Calendar}
        title="No Agenda Items"
        description="Core Edge returned no agenda tasks for this view."
      />
    );
  }

  return null;
}

function agendaMarkdown(item: CoreAgendaItem): string {
  const sections = [`**${item.task.title}**`];
  const context = [
    bucketTitle(item.bucket),
    item.blocked ? "**Blocked**" : "**Actionable**",
    item.task.status ? formatValue(item.task.status) : undefined,
    item.task.priority
      ? `${formatValue(item.task.priority)} priority`
      : undefined,
    item.project?.title,
  ].filter(Boolean);
  if (context.length > 0) sections.push(context.join(" · "));
  if (item.task.blocked_reason)
    sections.push(`**Blocked reason**\n\n${item.task.blocked_reason}`);
  if (item.task.content) sections.push(item.task.content);
  return sections.join("\n\n");
}

function bucketTitle(bucket: CoreAgendaBucket): string {
  if (bucket === "today") return "Today";
  if (bucket === "week") return "This Week";
  return `${bucket.charAt(0).toUpperCase()}${bucket.slice(1)}`;
}

function bucketIcon(bucket: CoreAgendaBucket): {
  source: Icon;
  tintColor: Color;
} {
  if (bucket === "overdue")
    return { source: Icon.AlarmRinging, tintColor: Color.Red };
  if (bucket === "today")
    return { source: Icon.Calendar, tintColor: Color.Green };
  if (bucket === "week")
    return { source: Icon.Calendar, tintColor: Color.Blue };
  return { source: Icon.Clock, tintColor: Color.SecondaryText };
}

type AgendaState =
  | { status: "loading" }
  | { status: "ready"; response: CoreAgendaResponse }
  | { status: "error"; error: string };
