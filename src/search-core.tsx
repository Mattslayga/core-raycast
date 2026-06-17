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
  CoreNoteMetadata,
  CorePreferences,
  CoreSearchResult,
} from "./core-edge.js";
import {
  RecordActions,
  errorMessage,
  formatTimestamp,
  preferenceLimit,
  recordTypeIcon,
  recordTypeLabel,
  useCoreClient,
} from "./record-ui.js";

const SEARCH_DEBOUNCE_MS = 250;
const metadataCache = new Map<string, CoreNoteMetadata>();

export default function SearchCore() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = preferenceLimit(preferences);
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebouncedValue(
    searchText.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const [state, setState] = useState<SearchState>({
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
        if (cancelled) return;
        setState({ status: "error", results: [], error: errorMessage(error) });
        showToast({
          style: Toast.Style.Failure,
          title: "Search Failed",
          message: errorMessage(error),
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
      searchBarPlaceholder="Search Core"
      throttle
    >
      <EmptyState state={state} hasQuery={Boolean(debouncedSearchText)} />
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
        <List.Section title="Results" subtitle={state.mode ?? "hybrid"}>
          {state.results.map((result) => (
            <CoreResultItem key={result.id} result={result} client={client} />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function CoreResultItem({
  result,
  client,
}: {
  result: CoreSearchResult;
  client: CoreEdgeClient;
}) {
  return (
    <List.Item
      icon={recordTypeIcon(result.recordType)}
      title={result.title}
      detail={<ResultDetail result={result} client={client} />}
      actions={<ResultActions result={result} client={client} />}
    />
  );
}

function ResultActions({
  result,
  client,
}: {
  result: CoreSearchResult;
  client: CoreEdgeClient;
}) {
  return (
    <RecordActions
      client={client}
      exploreTitle="Explore"
      readTitle="Read"
      record={result}
    />
  );
}

function ResultDetail({
  result,
  client,
}: {
  result: CoreSearchResult;
  client: CoreEdgeClient;
}) {
  const metadata = useResultMetadata(client, result.id);
  const markdown = resultPreviewMarkdown(result);
  const tags = metadata.status === "ready" ? (metadata.note.tags ?? []) : [];
  return (
    <List.Item.Detail
      markdown={markdown}
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Title" text={result.title} />
          <List.Item.Detail.Metadata.Label
            title="Type"
            text={recordTypeLabel(result.recordType)}
            icon={recordTypeIcon(result.recordType)}
          />
          {tags.length > 0 ? (
            <List.Item.Detail.Metadata.TagList title="Tags">
              {tags.map((tag) => (
                <List.Item.Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          ) : null}
          {metadata.status === "ready" && metadata.note.status ? (
            <List.Item.Detail.Metadata.Label
              title="Status"
              text={metadata.note.status}
            />
          ) : null}
          {metadata.status === "ready" && metadata.note.updated_at ? (
            <List.Item.Detail.Metadata.Label
              title="Updated"
              text={formatTimestamp(metadata.note.updated_at)}
            />
          ) : null}
          <List.Item.Detail.Metadata.Label
            title="Words"
            text={String(
              metadata.status === "ready"
                ? (metadata.note.word_count ?? result.wordCount ?? "Unknown")
                : (result.wordCount ?? "Unknown"),
            )}
          />
          {result.score !== undefined ? (
            <List.Item.Detail.Metadata.Label
              title="Score"
              text={formatScore(result.score)}
            />
          ) : null}
          {metadata.status === "ready" && metadata.note.source ? (
            <List.Item.Detail.Metadata.Label
              title="Source"
              text={metadata.note.source}
            />
          ) : null}
          {metadata.status === "ready" && metadata.note.file_path ? (
            <List.Item.Detail.Metadata.Label
              title="File"
              text={metadata.note.file_path}
            />
          ) : null}
          <List.Item.Detail.Metadata.Label title="ID" text={result.id} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function EmptyState({
  state,
  hasQuery,
}: {
  state: SearchState;
  hasQuery: boolean;
}) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Search Core"
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
    return (
      <List.EmptyView
        icon={Icon.MagnifyingGlass}
        title="Search Core"
        description="Type a query to search Core Edge."
      />
    );
  }

  if (state.status === "ready" && state.results.length === 0) {
    return (
      <List.EmptyView
        icon={Icon.MagnifyingGlass}
        title="No Results"
        description="Core Edge returned no matches."
      />
    );
  }

  return null;
}

function useResultMetadata(client: CoreEdgeClient, id: string): MetadataState {
  const cached = metadataCache.get(id);
  const [state, setState] = useState<MetadataState>(
    cached ? { status: "ready", note: cached } : { status: "loading" },
  );

  useEffect(() => {
    const cachedNote = metadataCache.get(id);
    if (cachedNote) {
      setState({ status: "ready", note: cachedNote });
      return;
    }

    let cancelled = false;
    setState({ status: "loading" });
    client
      .getNoteMetadata(id)
      .then((note) => {
        metadataCache.set(id, note);
        if (!cancelled) setState({ status: "ready", note });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: "error", error: errorMessage(error) });
      });

    return () => {
      cancelled = true;
    };
  }, [client, id]);

  return state;
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

function formatScore(score: number): string {
  return score >= 1 ? score.toFixed(2) : score.toFixed(3);
}

function resultPreviewMarkdown(result: CoreSearchResult): string {
  const summary = compactText(result.summary);
  const snippet = compactText(result.snippet);
  const sections: string[] = [];

  if (summary) sections.push(`**Summary**\n\n${summary}`);
  if (snippet && snippet !== summary) sections.push(`**Match**\n\n${snippet}`);
  if (sections.length === 0)
    sections.push("No summary or match snippet returned.");

  return sections.join("\n\n");
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

type SearchState =
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

type MetadataState =
  | { status: "loading" }
  | { status: "ready"; note: CoreNoteMetadata }
  | { status: "error"; error: string };
