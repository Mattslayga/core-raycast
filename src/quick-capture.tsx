import {
  Action,
  ActionPanel,
  Form,
  Icon,
  List,
  Toast,
  getPreferenceValues,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useState } from "react";
import {
  CoreCreateRecordInput,
  CorePreferences,
  CoreRecord,
  CoreRecordRef,
  CoreSearchResult,
  CoreSkippedLink,
  CoreTypedRecordType,
} from "./core-edge.js";
import { isLinkSupported, unsupportedLinkReason } from "./link-support.js";
import {
  errorMessage,
  readTarget,
  recordTypeIcon,
  recordTypeLabel,
  useCoreClient,
} from "./record-ui.js";

const CAPTURE_RECORD_TYPES: CoreTypedRecordType[] = [
  "note",
  "task",
  "project",
  "person",
  "organisation",
  "opportunity",
];

const LINK_SUGGESTION_LIMIT = 50;
const LINK_SEARCH_DEBOUNCE_MS = 250;
const LINK_SEARCH_LIMIT = 20;

let latestSelectedLinkRecords: CoreRecordRef[] = [];

function setLatestSelectedLinkRecords(records: CoreRecordRef[]) {
  latestSelectedLinkRecords = uniqueRecords(records);
  return latestSelectedLinkRecords;
}

export default function QuickCapture() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const { push } = useNavigation();
  const [recordType, setRecordType] = useState<CoreTypedRecordType>("note");
  const [suggestions, setSuggestions] = useState<CaptureSuggestions>({
    records: [],
    tags: [],
  });
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedLinkRecords, setSelectedLinkRecords] = useState<
    CoreRecordRef[]
  >(() => latestSelectedLinkRecords);

  function updateSelectedLinkRecords(records: CoreRecordRef[]) {
    const unique = setLatestSelectedLinkRecords(records);
    setSelectedLinkRecords(unique);
  }

  useEffect(() => {
    let cancelled = false;
    Promise.all(
      CAPTURE_RECORD_TYPES.map((type) =>
        client
          .listRecords(type, LINK_SUGGESTION_LIMIT)
          .catch(() => [] as CoreRecord[]),
      ),
    ).then((groups) => {
      if (cancelled) return;
      const records = groups.flat();
      setSuggestions({
        records,
        tags: uniqueSorted(records.flatMap((record) => record.tags)),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [client]);

  return (
    <Form
      enableDrafts
      actions={
        <ActionPanel>
          <Action.SubmitForm<CaptureValues>
            icon={Icon.Plus}
            title="Capture and Open"
            onSubmit={async (values) => {
              const title = values.title.trim();
              if (!title) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Title Required",
                });
                return false;
              }

              try {
                const linkTargets = latestSelectedLinkRecords.filter((record) =>
                  isLinkSupported(recordType, record),
                );
                if (linkTargets.length !== latestSelectedLinkRecords.length) {
                  updateSelectedLinkRecords(linkTargets);
                  await showToast({
                    style: Toast.Style.Failure,
                    title: "Some Links Skipped",
                    message:
                      "One or more selected links are not supported by the current Core Edge API.",
                  });
                }
                const result = await client.captureRecord(
                  recordType,
                  captureInput(recordType, values, title),
                  linkTargets,
                );
                await showToast({
                  style: Toast.Style.Success,
                  title: `${recordTypeLabel(recordType)} Captured`,
                  message: captureToastMessage(
                    result.links.length,
                    result.skippedLinks,
                    linkTargets.length,
                  ),
                });
                updateSelectedLinkRecords([]);
                push(readTarget(client, result.record));
              } catch (error: unknown) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Capture Failed",
                  message: errorMessage(error),
                });
                return false;
              }
            }}
          />
          <Action.Push
            icon={Icon.Link}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            title="Add Links"
            target={
              <LinkPicker
                client={client}
                initialRecords={suggestions.records}
                onChange={updateSelectedLinkRecords}
                selectedRecords={selectedLinkRecords}
                sourceRecordType={recordType}
              />
            }
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown
        id="recordType"
        title="Type"
        value={recordType}
        onChange={(value) => setRecordType(value as CoreTypedRecordType)}
      >
        {CAPTURE_RECORD_TYPES.map((type) => (
          <Form.Dropdown.Item
            key={type}
            icon={recordTypeIcon(type)}
            title={recordTypeLabel(type)}
            value={type}
          />
        ))}
      </Form.Dropdown>
      <Form.TextField
        id="title"
        title="Title"
        placeholder="What should Core call this?"
      />
      <Form.TextArea
        id="content"
        title="Content"
        placeholder="Capture the context, note, task shape, or decision."
      />
      <Form.TagPicker
        id="tags"
        title="Search Existing Tags"
        placeholder="Search tags"
        value={selectedTags}
        onChange={(tags) => setSelectedTags(uniqueSorted(tags))}
      >
        {uniqueSorted([...selectedTags, ...suggestions.tags]).map((tag) => (
          <Form.TagPicker.Item key={tag} title={tag} value={tag} />
        ))}
      </Form.TagPicker>
      <Form.TextField
        id="newTags"
        title="Create New Tags"
        placeholder="Comma-separated tags"
      />
      <TypeSpecificFields recordType={recordType} />
      <Form.Description
        key={selectedLinkRecords.map(linkValue).join("|")}
        title="Links"
        text={selectedLinksText(selectedLinkRecords)}
      />
    </Form>
  );
}

function LinkPicker({
  client,
  initialRecords,
  onChange,
  selectedRecords,
  sourceRecordType,
}: {
  client: ReturnType<typeof useCoreClient>;
  initialRecords: CoreRecordRef[];
  onChange: (records: CoreRecordRef[]) => void;
  selectedRecords: CoreRecordRef[];
  sourceRecordType: CoreTypedRecordType;
}) {
  const [searchText, setSearchText] = useState("");
  const [localSelectedRecords, setLocalSelectedRecords] = useState(() =>
    uniqueRecords([...latestSelectedLinkRecords, ...selectedRecords]),
  );
  const debouncedSearchText = useDebouncedValue(
    searchText.trim(),
    LINK_SEARCH_DEBOUNCE_MS,
  );
  const [state, setState] = useState<LinkPickerState>({
    records: uniqueRecords(initialRecords),
    status: "ready",
  });

  useEffect(() => {
    if (!debouncedSearchText) {
      setState({ records: uniqueRecords(initialRecords), status: "ready" });
      return;
    }

    let cancelled = false;
    setState((current) => ({ records: current.records, status: "loading" }));
    client
      .search(debouncedSearchText, LINK_SEARCH_LIMIT)
      .then((response) => {
        if (cancelled) return;
        setState({
          records: response.results
            .map(searchResultToRef)
            .filter((record): record is CoreRecordRef => record !== null),
          status: "ready",
        });
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setState({ error: errorMessage(error), records: [], status: "error" });
        showToast({
          style: Toast.Style.Failure,
          title: "Link Search Failed",
          message: errorMessage(error),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [client, debouncedSearchText, initialRecords]);

  const selectedValues = new Set(localSelectedRecords.map(linkValue));
  const resultRecords = state.records.filter(
    (record) => !selectedValues.has(linkValue(record)),
  );
  const supportedRecords = resultRecords.filter((record) =>
    isLinkSupported(sourceRecordType, record),
  );
  const unavailableRecords = resultRecords.filter(
    (record) => !isLinkSupported(sourceRecordType, record),
  );

  function addRecord(record: CoreRecordRef) {
    if (!isLinkSupported(sourceRecordType, record)) return;
    updateSelectedRecords(uniqueRecords([...localSelectedRecords, record]));
  }

  function removeRecord(record: CoreRecordRef) {
    updateSelectedRecords(
      localSelectedRecords.filter(
        (selected) => linkValue(selected) !== linkValue(record),
      ),
    );
  }

  function updateSelectedRecords(records: CoreRecordRef[]) {
    const unique = setLatestSelectedLinkRecords(records);
    setLocalSelectedRecords(unique);
    onChange(unique);
  }

  return (
    <List
      isLoading={state.status === "loading"}
      onSearchTextChange={setSearchText}
      searchBarPlaceholder="Search Core records to link"
      throttle
    >
      {state.status === "error" ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to Search Links"
          description={state.error}
        />
      ) : null}
      {localSelectedRecords.length > 0 ? (
        <List.Section
          title="Selected"
          subtitle={String(localSelectedRecords.length)}
        >
          {localSelectedRecords.map((record) => (
            <LinkPickerItem
              key={linkValue(record)}
              isSelected
              onAction={() => removeRecord(record)}
              record={record}
            />
          ))}
        </List.Section>
      ) : null}
      {supportedRecords.length > 0 ? (
        <List.Section
          title={debouncedSearchText ? "Results" : "Recent"}
          subtitle={String(supportedRecords.length)}
        >
          {supportedRecords.map((record) => (
            <LinkPickerItem
              key={linkValue(record)}
              onAction={() => addRecord(record)}
              record={record}
            />
          ))}
        </List.Section>
      ) : null}
      {unavailableRecords.length > 0 ? (
        <List.Section
          title="Unavailable"
          subtitle={String(unavailableRecords.length)}
        >
          {unavailableRecords.map((record) => (
            <LinkPickerItem
              key={linkValue(record)}
              record={record}
              unavailableReason={unsupportedLinkReason(
                sourceRecordType,
                record,
              )}
            />
          ))}
        </List.Section>
      ) : null}
      {state.status === "ready" && resultRecords.length === 0 ? (
        <List.EmptyView
          icon={Icon.Link}
          title={debouncedSearchText ? "No Matching Records" : "No Records"}
          description={
            debouncedSearchText
              ? "Try a different Core search query."
              : "No recent records were available to suggest."
          }
        />
      ) : null}
    </List>
  );
}

function LinkPickerItem({
  isSelected = false,
  onAction,
  record,
  unavailableReason,
}: {
  isSelected?: boolean;
  onAction?: () => void;
  record: CoreRecordRef;
  unavailableReason?: string;
}) {
  const unavailable = unavailableReason !== undefined;
  return (
    <List.Item
      accessories={[
        {
          text: unavailable
            ? "not linkable"
            : recordTypeLabel(record.recordType),
        },
      ]}
      icon={recordTypeIcon(record.recordType)}
      title={record.title}
      actions={
        <ActionPanel>
          <Action
            icon={
              unavailable
                ? Icon.ExclamationMark
                : isSelected
                  ? Icon.XMarkCircle
                  : Icon.PlusCircle
            }
            title={
              unavailable
                ? "Link Not Available"
                : isSelected
                  ? "Remove Link"
                  : "Add Link"
            }
            onAction={async () => {
              if (unavailable) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Link Not Available",
                  message: unavailableReason,
                });
                return;
              }
              onAction?.();
            }}
          />
        </ActionPanel>
      }
    />
  );
}

function TypeSpecificFields({
  recordType,
}: {
  recordType: CoreTypedRecordType;
}) {
  if (recordType === "task") {
    return (
      <>
        <Form.Dropdown id="status" title="Status" defaultValue="open">
          <Form.Dropdown.Item title="Open" value="open" />
          <Form.Dropdown.Item title="In Progress" value="in_progress" />
          <Form.Dropdown.Item title="Blocked" value="blocked" />
        </Form.Dropdown>
        <PriorityDropdown />
        <Form.DatePicker
          id="resurfaceAt"
          title="Do Date"
          type={Form.DatePicker.Type.DateTime}
        />
        <Form.DatePicker
          id="dueAt"
          title="Due Date"
          type={Form.DatePicker.Type.DateTime}
        />
      </>
    );
  }
  if (recordType === "project") {
    return (
      <>
        <Form.Dropdown id="status" title="Status" defaultValue="active">
          <Form.Dropdown.Item title="Planned" value="planned" />
          <Form.Dropdown.Item title="Active" value="active" />
          <Form.Dropdown.Item title="Blocked" value="blocked" />
        </Form.Dropdown>
        <PriorityDropdown />
        <Form.DatePicker
          id="dueAt"
          title="Due Date"
          type={Form.DatePicker.Type.DateTime}
        />
      </>
    );
  }
  if (recordType === "opportunity") {
    return (
      <>
        <Form.Dropdown id="stage" title="Stage" defaultValue="new">
          <Form.Dropdown.Item title="New" value="new" />
          <Form.Dropdown.Item title="Exploring" value="exploring" />
          <Form.Dropdown.Item title="Qualified" value="qualified" />
          <Form.Dropdown.Item title="Proposal" value="proposal" />
          <Form.Dropdown.Item title="Negotiating" value="negotiating" />
          <Form.Dropdown.Item title="Won" value="won" />
          <Form.Dropdown.Item title="Lost" value="lost" />
          <Form.Dropdown.Item title="Deferred" value="deferred" />
        </Form.Dropdown>
        <PriorityDropdown />
        <Form.DatePicker
          id="expectedCloseAt"
          title="Expected Close"
          type={Form.DatePicker.Type.Date}
        />
      </>
    );
  }
  if (recordType === "person") {
    return (
      <Form.TextField
        id="roleTitle"
        title="Role"
        placeholder="Role, title, or relationship context"
      />
    );
  }
  if (recordType === "organisation") {
    return (
      <Form.TextField id="domain" title="Domain" placeholder="example.com" />
    );
  }
  return null;
}

function PriorityDropdown() {
  return (
    <Form.Dropdown id="priority" title="Priority" defaultValue="normal">
      <Form.Dropdown.Item title="High" value="high" />
      <Form.Dropdown.Item title="Normal" value="normal" />
      <Form.Dropdown.Item title="Low" value="low" />
    </Form.Dropdown>
  );
}

function captureInput(
  recordType: CoreTypedRecordType,
  values: CaptureValues,
  title: string,
): CoreCreateRecordInput {
  const input: CoreCreateRecordInput = {
    title,
    tags: uniqueSorted([
      ...(values.tags ?? []),
      ...splitNewTags(values.newTags),
    ]),
  };
  const content = stringValue(values.content).trim();
  if (content) input.content = content;
  if (recordType === "task") {
    input.status = stringValue(values.status) || "open";
    input.priority = stringValue(values.priority) || "normal";
    input.resurface_at = dateValue(values.resurfaceAt);
    input.due_at = dateValue(values.dueAt);
  }
  if (recordType === "project") {
    input.status = stringValue(values.status) || "active";
    input.priority = stringValue(values.priority) || "normal";
    input.due_at = dateValue(values.dueAt);
  }
  if (recordType === "opportunity") {
    input.stage = stringValue(values.stage) || "new";
    input.priority = stringValue(values.priority) || "normal";
    input.expected_close_at = dateValue(values.expectedCloseAt);
  }
  if (recordType === "person" && stringValue(values.roleTitle).trim()) {
    input.role_title = stringValue(values.roleTitle).trim();
  }
  if (recordType === "organisation" && stringValue(values.domain).trim()) {
    input.domain = stringValue(values.domain).trim();
  }
  if (input.tags?.length === 0) delete input.tags;
  return input;
}

function linkValue(record: CoreRecordRef): string {
  return `${record.recordType}:${record.id}`;
}

function selectedLinksText(records: CoreRecordRef[]): string {
  if (records.length === 0) return "No links selected.";
  return records
    .map((record) => `${record.title} (${recordTypeLabel(record.recordType)})`)
    .join("\n");
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) =>
    a.localeCompare(b),
  );
}

function splitNewTags(value: string | undefined): string[] {
  return stringValue(value)
    .split(/[,\n]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
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
    const value = linkValue(record);
    if (seen.has(value)) continue;
    seen.add(value);
    unique.push(record);
  }
  return unique;
}

function dateValue(value: Date | null): number | undefined {
  return value ? value.getTime() : undefined;
}

function stringValue(value: string | undefined): string {
  return value ?? "";
}

function captureToastMessage(
  linkCount: number,
  skippedLinks: CoreSkippedLink[],
  requestedCount: number,
): string {
  const skippedCount = skippedLinks.length;
  const parts =
    requestedCount > 0
      ? [
          `${linkCount}/${requestedCount} link${
            requestedCount === 1 ? "" : "s"
          } created`,
        ]
      : [`${linkCount} link${linkCount === 1 ? "" : "s"}`];
  if (skippedCount > 0) {
    parts.push(`${skippedCount} skipped`);
    const firstSkipped = skippedLinks[0];
    if (firstSkipped) {
      parts.push(
        `${firstSkipped.target.title} (${firstSkipped.target.recordType}:${firstSkipped.target.id}): ${firstSkipped.reason}`,
      );
    }
  }
  return parts.join(", ");
}

type CaptureSuggestions = {
  records: CoreRecord[];
  tags: string[];
};

type CaptureValues = {
  content?: string;
  domain?: string;
  dueAt: Date | null;
  expectedCloseAt: Date | null;
  newTags?: string;
  priority?: string;
  recordType?: CoreTypedRecordType;
  resurfaceAt: Date | null;
  roleTitle?: string;
  stage?: string;
  status?: string;
  tags: string[];
  title: string;
};

type LinkPickerState =
  | { records: CoreRecordRef[]; status: "loading"; error?: undefined }
  | { records: CoreRecordRef[]; status: "ready"; error?: undefined }
  | { records: CoreRecordRef[]; status: "error"; error: string };

function useDebouncedValue(value: string, delayMs: number): string {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    if (value === debounced) return;
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [debounced, delayMs, value]);

  return debounced;
}
