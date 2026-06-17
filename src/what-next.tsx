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
  CoreRecord,
  CoreWhatNextItem,
  CoreWhatNextResponse,
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

export default function WhatNext() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = preferenceLimit(preferences);
  const [state, setState] = useState<WhatNextState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    client
      .whatNext(limit)
      .then((response) => {
        if (!cancelled) setState({ status: "ready", response });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled) setState({ status: "error", error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Unable to Load What Next",
          message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, limit]);

  const response = state.status === "ready" ? state.response : undefined;
  const suggestedItem = response?.suggestedItem;
  const suggestedTaskId = suggestedItem?.task.id;
  const taskItems = response
    ? response.items.filter((item) => item.task.id !== suggestedTaskId)
    : [];
  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={Boolean(suggestedItem) || taskItems.length > 0}
      searchBarPlaceholder="Filter next actions"
    >
      <WhatNextEmptyState state={state} />
      {suggestedItem ? (
        <List.Section
          title="Suggested"
          subtitle={formatSuggestedAction(response.suggestedAction)}
        >
          <WhatNextItem
            client={client}
            item={suggestedItem}
            response={response}
          />
        </List.Section>
      ) : null}
      {response && taskItems.length > 0 ? (
        <List.Section title="Tasks" subtitle={response.namespace}>
          {taskItems.map((item) => (
            <WhatNextItem
              key={item.task.id}
              client={client}
              item={item}
              response={response}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function WhatNextItem({
  client,
  item,
  response,
}: {
  client: CoreEdgeClient;
  item: CoreWhatNextItem;
  response: CoreWhatNextResponse;
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
      accessories={itemAccessories(currentItem)}
      detail={<WhatNextDetail item={currentItem} response={response} />}
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

function WhatNextDetail({
  item,
  response,
}: {
  item: CoreWhatNextItem;
  response: CoreWhatNextResponse;
}) {
  return (
    <List.Item.Detail
      markdown={whatNextMarkdown(item, response)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label
            title="Title"
            text={item.task.title}
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
          {item.blockers.length > 0 ? (
            <List.Item.Detail.Metadata.TagList title="Blockers">
              {item.blockers.map((blocker) => (
                <List.Item.Detail.Metadata.TagList.Item
                  key={blocker.id}
                  text={blocker.title}
                />
              ))}
            </List.Item.Detail.Metadata.TagList>
          ) : null}
          {item.task.due_at ? (
            <List.Item.Detail.Metadata.Label
              title="Due"
              text={formatTimestamp(item.task.due_at)}
            />
          ) : null}
          {item.task.resurface_at ? (
            <List.Item.Detail.Metadata.Label
              title="Resurfaces"
              text={formatTimestamp(item.task.resurface_at)}
            />
          ) : null}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Active"
            text={String(response.counts.active ?? "Unknown")}
          />
          <List.Item.Detail.Metadata.Label
            title="Actionable"
            text={String(response.counts.actionable ?? "Unknown")}
          />
          <List.Item.Detail.Metadata.Label
            title="Blocked"
            text={String(response.counts.blocked ?? "Unknown")}
          />
          <List.Item.Detail.Metadata.Label title="ID" text={item.task.id} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function WhatNextEmptyState({ state }: { state: WhatNextState }) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Load What Next"
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

  if (state.status === "ready" && state.response.items.length === 0) {
    return (
      <List.EmptyView
        icon={Icon.CheckCircle}
        title="No Active Tasks"
        description="Core Edge returned no what-next items."
      />
    );
  }

  return null;
}

function whatNextMarkdown(
  item: CoreWhatNextItem,
  response: CoreWhatNextResponse,
): string {
  const sections = [`**${item.task.title}**`];
  const context = [
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
  if (Object.keys(response.filters).length > 0)
    sections.push(`**Filters**\n\n${formatKeyValues(response.filters)}`);
  return sections.join("\n\n");
}

function itemAccessories(item: CoreWhatNextItem): List.Item.Accessory[] {
  const accessories: List.Item.Accessory[] = [];
  if (item.blocked) {
    accessories.push({
      text: "blocked",
      icon: {
        source: Icon.Pause,
        tintColor: Color.Orange,
      },
    });
  }
  if (item.task.priority)
    accessories.push({ text: formatValue(item.task.priority) });
  return accessories;
}

function formatSuggestedAction(action: string): string {
  if (action === "work_task") return "work task";
  if (action === "unblock_task") return "unblock task";
  return action.replaceAll("_", " ");
}

function formatKeyValues(values: Record<string, string | boolean>): string {
  return Object.entries(values)
    .map(([key, value]) => `- ${formatValue(key)}: ${String(value)}`)
    .join("\n");
}

type WhatNextState =
  | { status: "loading" }
  | { status: "ready"; response: CoreWhatNextResponse }
  | { status: "error"; error: string };
