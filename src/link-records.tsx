import {
  Action,
  ActionPanel,
  Icon,
  List,
  Toast,
  getPreferenceValues,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import {
  CoreEdgeClient,
  CorePreferences,
  CoreRecord,
  CoreRecordRef,
  CoreSearchResult,
  CoreTypedRecordType,
} from "./core-edge.js";
import {
  formatRelType,
  isLinkSupported,
  supportedDefaultLink,
  unsupportedLinkReason,
} from "./link-support.js";
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
const SUGGESTION_LIMIT = 50;

export default function LinkRecords() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = Math.max(preferenceLimit(preferences), 20);
  return <SourcePicker client={client} limit={limit} />;
}

function SourcePicker({
  client,
  limit,
}: {
  client: CoreEdgeClient;
  limit: number;
}) {
  return (
    <RecordSearchList
      client={client}
      emptyDescription="Search for the record links should start from."
      initialTitle="Recent Records"
      limit={limit}
      placeholder="Search source record"
    />
  );
}

function SourceItem({
  client,
  limit,
  record,
}: {
  client: CoreEdgeClient;
  limit: number;
  record: CoreRecordRef;
}) {
  return (
    <List.Item
      icon={recordTypeIcon(record.recordType)}
      title={record.title}
      accessories={[{ text: recordTypeLabel(record.recordType) }]}
      actions={
        <ActionPanel>
          <Action.Push
            icon={Icon.ArrowRight}
            title="Select Source"
            target={
              <TargetPicker client={client} limit={limit} source={record} />
            }
          />
          <Action.Push
            icon={Icon.Book}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            title="Read Source"
            target={readTarget(client, record)}
          />
          <CopyRecordActions client={client} record={record} />
        </ActionPanel>
      }
    />
  );
}

function TargetPicker({
  client,
  limit,
  source,
}: {
  client: CoreEdgeClient;
  limit: number;
  source: CoreRecordRef;
}) {
  return (
    <RecordSearchList
      client={client}
      emptyDescription="Search for the record this should link to."
      initialTitle="Recent Records"
      limit={limit}
      placeholder={`Link from ${source.title}`}
      source={source}
    />
  );
}

function TargetItem({
  client,
  record,
  source,
}: {
  client: CoreEdgeClient;
  record: CoreRecordRef;
  source: CoreRecordRef;
}) {
  const { push } = useNavigation();
  const draft = supportedDefaultLink(source, record);
  const unsupportedReason =
    source.recordType === "record"
      ? "Legacy record shapes cannot be used as link sources."
      : isLinkSupported(source.recordType, record)
        ? undefined
        : unsupportedLinkReason(source.recordType, record);
  const relationship = draft ? formatRelType(draft.rel_type) : "not linkable";

  return (
    <List.Item
      icon={recordTypeIcon(record.recordType)}
      title={record.title}
      accessories={[{ text: relationship }]}
      detail={
        <List.Item.Detail
          markdown={linkPreviewMarkdown(source, record, relationship)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="From"
                text={source.title}
              />
              <List.Item.Detail.Metadata.Label
                title="From Type"
                text={recordTypeLabel(source.recordType)}
                icon={recordTypeIcon(source.recordType)}
              />
              <List.Item.Detail.Metadata.Label title="To" text={record.title} />
              <List.Item.Detail.Metadata.Label
                title="To Type"
                text={recordTypeLabel(record.recordType)}
                icon={recordTypeIcon(record.recordType)}
              />
              <List.Item.Detail.Metadata.Label
                title="Relationship"
                text={relationship}
              />
              {unsupportedReason ? (
                <List.Item.Detail.Metadata.Label
                  title="Unavailable"
                  text={unsupportedReason}
                />
              ) : null}
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <ActionPanel>
          {draft ? (
            <Action
              icon={Icon.Link}
              title={`Create ${formatRelType(draft.rel_type)} Link`}
              onAction={async () => {
                try {
                  await client.createLink(draft);
                  await showToast({
                    style: Toast.Style.Success,
                    title: "Link Created",
                    message: `${source.title} -> ${record.title}`,
                  });
                  push(<LinkedRecords client={client} source={source} />);
                } catch (error: unknown) {
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Link Failed",
                    message: errorMessage(error),
                  });
                }
              }}
            />
          ) : (
            <Action
              icon={Icon.ExclamationMark}
              title="Link Not Available"
              onAction={async () => {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Link Not Available",
                  message: unsupportedReason,
                });
              }}
            />
          )}
          <Action.Push
            icon={Icon.Book}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            title="Read Target"
            target={readTarget(client, record)}
          />
          <CopyRecordActions client={client} record={record} />
        </ActionPanel>
      }
    />
  );
}

function RecordSearchList({
  client,
  emptyDescription,
  initialTitle,
  limit,
  placeholder,
  source,
}: {
  client: CoreEdgeClient;
  emptyDescription: string;
  initialTitle: string;
  limit: number;
  placeholder: string;
  source?: CoreRecordRef;
}) {
  const [searchText, setSearchText] = useState("");
  const debouncedSearchText = useDebouncedValue(
    searchText.trim(),
    SEARCH_DEBOUNCE_MS,
  );
  const [state, setState] = useState<RecordSearchState>({
    records: [],
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      records: current.records,
      status: "loading",
    }));
    const request = debouncedSearchText
      ? client
          .search(debouncedSearchText, limit)
          .then((response) =>
            response.results
              .map(searchResultToRef)
              .filter((record): record is CoreRecordRef => record !== null),
          )
      : loadInitialRecords(client, limit);

    request
      .then((records) => {
        if (!cancelled)
          setState({
            records: uniqueRecords(records).filter(
              (record) => !source || !sameRecord(record, source),
            ),
            status: "ready",
          });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            error: errorMessage(error),
            records: [],
            status: "error",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [client, debouncedSearchText, limit, source]);

  const sections = useMemo(
    () => splitLinkableRecords(state.records, source),
    [source, state.records],
  );

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={Boolean(source && state.records.length > 0)}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder={placeholder}
      throttle
    >
      {state.status === "error" ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to Search Records"
          description={state.error}
        />
      ) : null}
      {source ? (
        <>
          {sections.supported.length > 0 ? (
            <List.Section
              title={debouncedSearchText ? "Linkable Results" : initialTitle}
              subtitle={String(sections.supported.length)}
            >
              {sections.supported.map((record) =>
                renderRecordItem(client, limit, record, source),
              )}
            </List.Section>
          ) : null}
          {sections.unavailable.length > 0 ? (
            <List.Section
              title="Unavailable"
              subtitle={String(sections.unavailable.length)}
            >
              {sections.unavailable.map((record) =>
                renderRecordItem(client, limit, record, source),
              )}
            </List.Section>
          ) : null}
        </>
      ) : state.records.length > 0 ? (
        <List.Section
          title={debouncedSearchText ? "Results" : initialTitle}
          subtitle={String(state.records.length)}
        >
          {state.records.map((record) =>
            renderRecordItem(client, limit, record, source),
          )}
        </List.Section>
      ) : null}
      {state.status === "ready" && state.records.length === 0 ? (
        <List.EmptyView
          icon={Icon.Link}
          title={debouncedSearchText ? "No Records" : "Link Records"}
          description={emptyDescription}
        />
      ) : null}
    </List>
  );
}

function renderRecordItem(
  client: CoreEdgeClient,
  limit: number,
  record: CoreRecordRef,
  source?: CoreRecordRef,
) {
  if (source) {
    return (
      <TargetItem
        key={recordKey(record)}
        client={client}
        record={record}
        source={source}
      />
    );
  }
  return (
    <SourceItem
      key={recordKey(record)}
      client={client}
      limit={limit}
      record={record}
    />
  );
}

async function loadInitialRecords(
  client: CoreEdgeClient,
  limit: number,
): Promise<CoreRecord[]> {
  const types = [
    "task",
    "project",
    "note",
    "person",
    "organisation",
    "opportunity",
  ] as const;
  const groups = await Promise.all(
    types.map((type) =>
      client
        .listRecords(type, Math.min(limit, SUGGESTION_LIMIT))
        .catch(() => []),
    ),
  );
  return groups.flat();
}

function splitLinkableRecords(
  records: CoreRecordRef[],
  source?: CoreRecordRef,
) {
  if (!source || !isTypedRecordRef(source)) {
    return { supported: records, unavailable: [] };
  }
  return {
    supported: records.filter((record) =>
      isLinkSupported(source.recordType, record),
    ),
    unavailable: records.filter(
      (record) => !isLinkSupported(source.recordType, record),
    ),
  };
}

function isTypedRecordRef(
  record: CoreRecordRef,
): record is CoreRecordRef & { recordType: CoreTypedRecordType } {
  return record.recordType !== "record";
}

function linkPreviewMarkdown(
  source: CoreRecordRef,
  target: CoreRecordRef,
  relationship: string,
): string {
  return `**${source.title}**\n\n--[${relationship}]-->\n\n**${target.title}**`;
}

function searchResultToRef(result: CoreSearchResult): CoreRecordRef | null {
  if (result.recordType === "record") return null;
  return {
    id: result.id,
    recordType: result.recordType,
    title: result.title,
  };
}

function uniqueRecords(records: CoreRecordRef[]): CoreRecordRef[] {
  const seen = new Set<string>();
  const unique: CoreRecordRef[] = [];
  for (const record of records) {
    const key = recordKey(record);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(record);
  }
  return unique;
}

function sameRecord(a: CoreRecordRef, b: CoreRecordRef): boolean {
  return a.id === b.id && a.recordType === b.recordType;
}

function recordKey(record: CoreRecordRef): string {
  return `${record.recordType}:${record.id}`;
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

type RecordSearchState =
  | { records: CoreRecordRef[]; status: "loading"; error?: undefined }
  | { records: CoreRecordRef[]; status: "ready"; error?: undefined }
  | { records: CoreRecordRef[]; status: "error"; error: string };
