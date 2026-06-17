import {
  Action,
  ActionPanel,
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
  CoreOpenLoopCategory,
  CoreOpenLoopItem,
  CoreOpenLoopsResponse,
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
  recordTypeLabel,
  useCoreClient,
} from "./record-ui.js";

const CATEGORY_ORDER: CoreOpenLoopCategory[] = [
  "hygiene",
  "blocked",
  "stale",
  "projects",
  "opportunities",
];

export default function OpenLoops() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = Math.max(preferenceLimit(preferences, 20), 20);
  const [state, setState] = useState<OpenLoopsState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    client
      .openLoops(limit)
      .then((response) => {
        if (!cancelled) setState({ status: "ready", response });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled) setState({ status: "error", error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Unable to Load Open Loops",
          message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, limit]);

  const response = state.status === "ready" ? state.response : undefined;
  const totalReturned = response?.counts.returned ?? 0;

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={Boolean(response && totalReturned > 0)}
      searchBarPlaceholder="Filter open loops"
    >
      <OpenLoopsEmptyState state={state} />
      {response
        ? CATEGORY_ORDER.map((category) => {
            const items = response.categories[category];
            if (items.length === 0) return null;
            return (
              <List.Section
                key={category}
                title={categoryTitle(category)}
                subtitle={String(response.counts[category] ?? items.length)}
              >
                {items.map((item) => (
                  <OpenLoopListItem
                    key={`${category}:${item.id}:${item.issueType}`}
                    category={category}
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

function OpenLoopListItem({
  category,
  client,
  item,
  response,
}: {
  category: CoreOpenLoopCategory;
  client: CoreEdgeClient;
  item: CoreOpenLoopItem;
  response: CoreOpenLoopsResponse;
}) {
  const [currentItem, setCurrentItem] = useState(item);

  useEffect(() => {
    setCurrentItem(item);
  }, [item]);

  const updateRecord = (record: CoreRecord) => {
    setCurrentItem((current) => ({
      ...current,
      ...record,
    }));
  };

  return (
    <List.Item
      icon={recordTypeIcon(currentItem.recordType)}
      title={currentItem.title}
      detail={
        <List.Item.Detail
          markdown={openLoopMarkdown(currentItem)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={currentItem.title}
              />
              <List.Item.Detail.Metadata.Label
                title="Category"
                text={categoryTitle(category)}
              />
              <List.Item.Detail.Metadata.Label
                title="Issue"
                text={formatIssueType(item.issueType)}
              />
              <List.Item.Detail.Metadata.Label
                title="Type"
                text={recordTypeLabel(currentItem.recordType)}
                icon={recordTypeIcon(currentItem.recordType)}
              />
              {recordState(currentItem) ? (
                <List.Item.Detail.Metadata.Label
                  title="State"
                  text={recordState(currentItem)}
                />
              ) : null}
              {currentItem.updated_at ? (
                <List.Item.Detail.Metadata.Label
                  title="Updated"
                  text={formatTimestamp(currentItem.updated_at)}
                />
              ) : null}
              <List.Item.Detail.Metadata.Separator />
              <List.Item.Detail.Metadata.Label
                title="Total"
                text={String(response.counts.total ?? "Unknown")}
              />
              <List.Item.Detail.Metadata.Label
                title="Returned"
                text={String(response.counts.returned ?? "Unknown")}
              />
              {response.metadata.stale_after_days ? (
                <List.Item.Detail.Metadata.Label
                  title="Stale Days"
                  text={String(response.metadata.stale_after_days)}
                />
              ) : null}
              <List.Item.Detail.Metadata.Label
                title="ID"
                text={currentItem.id}
              />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <RecordActions
          client={client}
          onRecordUpdated={updateRecord}
          record={currentItem}
        />
      }
    />
  );
}

function OpenLoopsEmptyState({ state }: { state: OpenLoopsState }) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Load Open Loops"
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
        icon={Icon.CheckCircle}
        title="No Open Loops"
        description="Core Edge returned no open-loop diagnostics."
      />
    );
  }

  return null;
}

function openLoopMarkdown(item: CoreOpenLoopItem): string {
  const sections = [`**${item.title}**`, formatIssueType(item.issueType)];
  if (item.detail) sections.push(item.detail);
  if (item.reasons.length > 0)
    sections.push(
      `**Reasons**\n\n${item.reasons.map((reason) => `- ${formatIssueType(reason)}`).join("\n")}`,
    );
  if (item.suggestedCommands.length > 0)
    sections.push(
      `**Suggested CLI Commands**\n\n${item.suggestedCommands.map((command) => `- \`${command}\``).join("\n")}`,
    );
  return sections.join("\n\n");
}

function categoryTitle(category: CoreOpenLoopCategory): string {
  switch (category) {
    case "hygiene":
      return "Hygiene";
    case "blocked":
      return "Blocked";
    case "stale":
      return "Stale";
    case "projects":
      return "Projects";
    case "opportunities":
      return "Opportunities";
  }
}

function formatIssueType(value: string): string {
  return formatValue(value);
}

function recordState(item: CoreOpenLoopItem): string | undefined {
  return item.status ?? item.stage;
}

type OpenLoopsState =
  | { status: "loading" }
  | { status: "ready"; response: CoreOpenLoopsResponse }
  | { status: "error"; error: string };
