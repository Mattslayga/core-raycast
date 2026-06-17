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
  CoreSearchResult,
} from "./core-edge.js";
import {
  CopyRecordActions,
  LinkedRecords,
  errorMessage,
  preferenceLimit,
  readTarget,
  recordTypeIcon,
  recordTypeLabel,
  useCoreClient,
} from "./record-ui.js";

const SEARCH_DEBOUNCE_MS = 250;

export default function ExploreCore() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = preferenceLimit(preferences);
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebouncedValue(
    searchText.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const [state, setState] = useState<ExploreState>({
    status: "idle",
    results: [],
  });

  useEffect(() => {
    if (!debouncedSearchText) {
      setState((current) =>
        current.status === "idle" && current.results.length === 0
          ? current
          : { status: "idle", results: [] },
      );
      return;
    }

    let cancelled = false;
    setState((current) => ({
      ...current,
      status: "loading",
      error: undefined,
    }));

    client
      .search(debouncedSearchText, limit)
      .then((response) => {
        if (cancelled) return;
        setState({
          status: "ready",
          results: response.results,
          warning: response.warning,
          mode: response.mode,
        });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled)
          setState({ status: "error", results: [], error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Explore Failed",
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
      isShowingDetail={state.results.length > 0}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Explore Core"
      throttle
    >
      <ExploreEmptyState
        state={state}
        hasQuery={Boolean(debouncedSearchText)}
      />
      {state.warning ? (
        <List.Section title="Warning">
          <List.Item
            icon={{ source: Icon.Warning, tintColor: Color.Orange }}
            title={state.warning}
            subtitle="Hybrid search fell back to the available index."
          />
        </List.Section>
      ) : null}
      {state.results.length > 0 ? (
        <List.Section title="Seeds" subtitle={state.mode ?? "hybrid"}>
          {state.results.map((result) => (
            <ExploreSeedItem key={result.id} client={client} result={result} />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function ExploreSeedItem({
  client,
  result,
}: {
  client: CoreEdgeClient;
  result: CoreSearchResult;
}) {
  return (
    <List.Item
      icon={recordTypeIcon(result.recordType)}
      title={result.title}
      detail={<ExploreSeedDetail result={result} />}
      actions={<ExploreSeedActions client={client} result={result} />}
    />
  );
}

function ExploreSeedActions({
  client,
  result,
}: {
  client: CoreEdgeClient;
  result: CoreSearchResult;
}) {
  return (
    <ActionPanel>
      <Action.Push
        icon={Icon.Binoculars}
        title="Explore Links"
        target={<LinkedRecords client={client} source={result} />}
      />
      <Action.Push
        icon={Icon.Book}
        shortcut={{ modifiers: ["cmd"], key: "return" }}
        title="Read"
        target={readTarget(client, result)}
      />
      <CopyRecordActions client={client} record={result} />
    </ActionPanel>
  );
}

function ExploreSeedDetail({ result }: { result: CoreSearchResult }) {
  return (
    <List.Item.Detail
      markdown={seedPreviewMarkdown(result)}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Title" text={result.title} />
          <List.Item.Detail.Metadata.Label
            title="Type"
            text={recordTypeLabel(result.recordType)}
            icon={recordTypeIcon(result.recordType)}
          />
          {result.score !== undefined ? (
            <List.Item.Detail.Metadata.Label
              title="Score"
              text={formatScore(result.score)}
            />
          ) : null}
          {result.wordCount !== undefined ? (
            <List.Item.Detail.Metadata.Label
              title="Words"
              text={String(result.wordCount)}
            />
          ) : null}
          <List.Item.Detail.Metadata.Label title="ID" text={result.id} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function ExploreEmptyState({
  hasQuery,
  state,
}: {
  hasQuery: boolean;
  state: ExploreState;
}) {
  if (state.status === "error") {
    return <ExploreErrorEmptyState error={state.error} />;
  }

  return (
    <ExploreNonErrorEmptyState
      hasQuery={hasQuery}
      resultCount={state.results.length}
      status={state.status}
    />
  );
}

function ExploreNonErrorEmptyState({
  hasQuery,
  resultCount,
  status,
}: {
  hasQuery: boolean;
  resultCount: number;
  status: "idle" | "loading" | "ready";
}) {
  const hasNoSeeds = status === "ready" && resultCount === 0;

  if (!hasQuery) {
    return <ExploreIdleEmptyState />;
  }

  if (hasNoSeeds) {
    return <ExploreNoSeedsEmptyState />;
  }

  return null;
}

function ExploreErrorEmptyState({ error }: { error: string }) {
  return (
    <List.EmptyView
      icon={Icon.Warning}
      title="Unable to Explore Core"
      description={error}
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

function ExploreIdleEmptyState() {
  return (
    <List.EmptyView
      icon={Icon.Binoculars}
      title="Explore Core"
      description="Type a seed query, then choose a record to traverse its graph."
    />
  );
}

function ExploreNoSeedsEmptyState() {
  return (
    <List.EmptyView
      icon={Icon.Binoculars}
      title="No Seeds"
      description="Core Edge returned no records to explore."
    />
  );
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

function seedPreviewMarkdown(result: CoreSearchResult): string {
  const sections = seedPreviewSections(result);
  return sections.join("\n\n") || "Choose this record to explore its links.";
}

function seedPreviewSections(result: CoreSearchResult): string[] {
  const summary = compactText(result.summary);
  const snippet = compactText(result.snippet);
  return [
    optionalPreviewSection("Summary", summary),
    matchPreviewSection(summary, snippet),
  ].filter(isString);
}

function optionalPreviewSection(
  title: string,
  body: string,
): string | undefined {
  if (!body) return undefined;
  return `**${title}**\n\n${body}`;
}

function matchPreviewSection(
  summary: string,
  snippet: string,
): string | undefined {
  if (!snippet) return undefined;
  if (snippet === summary) return undefined;
  return `**Match**\n\n${snippet}`;
}

function isString(value: string | undefined): value is string {
  return typeof value === "string";
}

function compactText(value?: string): string {
  if (!value) return "";
  const cleaned = value
    .split("\n")
    .map(cleanInlineMarkdown)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 4)
    .join("\n\n");
  return shorten(cleaned, 850);
}

function cleanInlineMarkdown(value: string): string {
  return value
    .replace(/^\s*[-*•]\s+/gm, "")
    .replace(/#{1,6}\s+/g, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/\[(.*?)\]\((.*?)\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
}

function shorten(value: string, length: number): string {
  if (value.length <= length) return value;
  return `${value.slice(0, length - 1).trimEnd()}...`;
}

function formatScore(score: number): string {
  return score >= 1 ? score.toFixed(2) : score.toFixed(3);
}

type ExploreState =
  | {
      status: "idle" | "loading";
      results: CoreSearchResult[];
      error?: undefined;
      warning?: string;
      mode?: string;
    }
  | {
      status: "ready";
      results: CoreSearchResult[];
      error?: undefined;
      warning?: string;
      mode?: string;
    }
  | {
      status: "error";
      results: CoreSearchResult[];
      error: string;
      warning?: undefined;
      mode?: undefined;
    };
