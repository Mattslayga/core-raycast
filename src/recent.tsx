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
  CorePreferences,
  CoreRecentItem,
  CoreRecentResponse,
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

export default function Recent() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = preferenceLimit(preferences);
  const [days, setDays] = useState("1");
  const [state, setState] = useState<RecentState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    setState({ status: "loading" });
    client
      .recent(parseInt(days, 10) || 1, limit)
      .then((response) => {
        if (!cancelled) setState({ status: "ready", response });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled) setState({ status: "error", error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Unable to Load Recent",
          message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, days, limit]);

  const response = state.status === "ready" ? state.response : undefined;

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={Boolean(response && response.items.length > 0)}
      searchBarAccessory={
        <RecentDaysDropdown value={days} onChange={setDays} />
      }
      searchBarPlaceholder="Filter recent changes"
    >
      <RecentEmptyState state={state} />
      {response && response.items.length > 0 ? (
        <List.Section
          title="Recent"
          subtitle={`${response.days}d · ${response.total}`}
        >
          {response.items.map((item, index) => (
            <RecentListItem
              key={`${item.id}:${item.operation}:${item.timestamp ?? "unknown"}:${index}`}
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

function RecentDaysDropdown({
  onChange,
  value,
}: {
  onChange: (value: string) => void;
  value: string;
}) {
  return (
    <List.Dropdown tooltip="Recent Window" value={value} onChange={onChange}>
      <List.Dropdown.Item title="1 Day" value="1" />
      <List.Dropdown.Item title="7 Days" value="7" />
      <List.Dropdown.Item title="30 Days" value="30" />
    </List.Dropdown>
  );
}

function RecentListItem({
  client,
  item,
  response,
}: {
  client: CoreEdgeClient;
  item: CoreRecentItem;
  response: CoreRecentResponse;
}) {
  return (
    <List.Item
      icon={recordTypeIcon(item.recordType)}
      title={item.title}
      detail={<RecentDetail item={item} response={response} />}
      actions={<RecordActions client={client} record={item} />}
    />
  );
}

function RecentDetail({
  item,
  response,
}: {
  item: CoreRecentItem;
  response: CoreRecentResponse;
}) {
  return (
    <List.Item.Detail
      markdown={recentMarkdown(item)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Title" text={item.title} />
          <List.Item.Detail.Metadata.Label
            title="Operation"
            text={formatValue(item.operation)}
          />
          <List.Item.Detail.Metadata.Label
            title="Type"
            text={recordTypeLabel(item.recordType)}
            icon={recordTypeIcon(item.recordType)}
          />
          {item.timestamp ? (
            <List.Item.Detail.Metadata.Label
              title="Changed"
              text={formatTimestamp(item.timestamp)}
            />
          ) : null}
          {item.agent ? (
            <List.Item.Detail.Metadata.Label title="Agent" text={item.agent} />
          ) : null}
          {item.source ? (
            <List.Item.Detail.Metadata.Label
              title="Source"
              text={item.source}
            />
          ) : null}
          <List.Item.Detail.Metadata.Separator />
          <List.Item.Detail.Metadata.Label
            title="Window"
            text={`${response.days} day${response.days === 1 ? "" : "s"}`}
          />
          <List.Item.Detail.Metadata.Label
            title="Total"
            text={String(response.total)}
          />
          <List.Item.Detail.Metadata.Label title="ID" text={item.id} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function RecentEmptyState({ state }: { state: RecentState }) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Load Recent"
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
        icon={Icon.Clock}
        title="No Recent Changes"
        description="Core Edge returned no recent changes for this window."
      />
    );
  }

  return null;
}

function recentMarkdown(item: CoreRecentItem): string {
  const sections = [`**${item.title}**`, formatValue(item.operation)];
  if (item.timestamp) sections.push(formatTimestamp(item.timestamp));
  return sections.join("\n\n");
}

type RecentState =
  | { status: "loading" }
  | { status: "ready"; response: CoreRecentResponse }
  | { status: "error"; error: string };
