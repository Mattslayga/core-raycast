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
  CoreRecord,
  CoreRecordType,
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

type BrowsableRecordType = Exclude<CoreRecordType, "record">;

const RECORD_TYPES: BrowsableRecordType[] = [
  "project",
  "task",
  "note",
  "person",
  "organisation",
  "opportunity",
];

export default function BrowseRecords() {
  const preferences = getPreferenceValues<CorePreferences>();
  const client = useCoreClient(preferences);
  const limit = Math.max(preferenceLimit(preferences), 20);
  const [recordType, setRecordType] = useState<BrowsableRecordType>("project");
  const [state, setState] = useState<BrowseRecordsState>({
    records: [],
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    setState((current) => ({
      ...current,
      status: "loading",
      error: undefined,
    }));
    client
      .listRecords(recordType, limit)
      .then((records) => {
        if (!cancelled) setState({ records, status: "ready" });
      })
      .catch((error: unknown) => {
        const message = errorMessage(error);
        if (!cancelled)
          setState({ records: [], status: "error", error: message });
        showToast({
          style: Toast.Style.Failure,
          title: "Unable to Browse Records",
          message,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [client, limit, recordType]);

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={state.records.length > 0}
      searchBarAccessory={
        <RecordTypeDropdown value={recordType} onChange={setRecordType} />
      }
      searchBarPlaceholder={`Filter ${recordTypeLabel(recordType).toLowerCase()} records`}
    >
      <BrowseRecordsEmptyState recordType={recordType} state={state} />
      {state.records.length > 0 ? (
        <List.Section
          title={recordTypeLabel(recordType)}
          subtitle={String(state.records.length)}
        >
          {state.records.map((record) => (
            <BrowseRecordItem key={record.id} client={client} record={record} />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function RecordTypeDropdown({
  onChange,
  value,
}: {
  onChange: (value: BrowsableRecordType) => void;
  value: BrowsableRecordType;
}) {
  return (
    <List.Dropdown
      tooltip="Record Type"
      value={value}
      onChange={(newValue) => onChange(newValue as BrowsableRecordType)}
    >
      {RECORD_TYPES.map((type) => (
        <List.Dropdown.Item
          key={type}
          title={recordTypeLabel(type)}
          value={type}
        />
      ))}
    </List.Dropdown>
  );
}

function BrowseRecordItem({
  client,
  record,
}: {
  client: CoreEdgeClient;
  record: CoreRecord;
}) {
  const [currentRecord, setCurrentRecord] = useState(record);

  useEffect(() => {
    setCurrentRecord(record);
  }, [record]);

  return (
    <List.Item
      icon={recordTypeIcon(currentRecord.recordType)}
      title={currentRecord.title}
      detail={<BrowseRecordDetail record={currentRecord} />}
      actions={
        <RecordActions
          client={client}
          onRecordUpdated={setCurrentRecord}
          record={currentRecord}
        />
      }
    />
  );
}

function BrowseRecordDetail({ record }: { record: CoreRecord }) {
  return (
    <List.Item.Detail
      markdown={
        record.content || `${recordTypeLabel(record.recordType)} record.`
      }
      metadata={
        <List.Item.Detail.Metadata>
          <List.Item.Detail.Metadata.Label title="Title" text={record.title} />
          <List.Item.Detail.Metadata.Label
            title="Type"
            text={recordTypeLabel(record.recordType)}
            icon={recordTypeIcon(record.recordType)}
          />
          {record.status ? (
            <List.Item.Detail.Metadata.Label
              title="Status"
              text={formatValue(record.status)}
            />
          ) : null}
          {record.stage ? (
            <List.Item.Detail.Metadata.Label
              title="Stage"
              text={formatValue(record.stage)}
            />
          ) : null}
          {record.priority ? (
            <List.Item.Detail.Metadata.Label
              title="Priority"
              text={formatValue(record.priority)}
            />
          ) : null}
          {record.updated_at ? (
            <List.Item.Detail.Metadata.Label
              title="Updated"
              text={formatTimestamp(record.updated_at)}
            />
          ) : null}
          {record.tags.length > 0 ? (
            <List.Item.Detail.Metadata.TagList title="Tags">
              {record.tags.map((tag) => (
                <List.Item.Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </List.Item.Detail.Metadata.TagList>
          ) : null}
          <List.Item.Detail.Metadata.Label title="ID" text={record.id} />
        </List.Item.Detail.Metadata>
      }
    />
  );
}

function BrowseRecordsEmptyState({
  recordType,
  state,
}: {
  recordType: BrowsableRecordType;
  state: BrowseRecordsState;
}) {
  if (state.status === "error") {
    return (
      <List.EmptyView
        icon={Icon.Warning}
        title="Unable to Browse Records"
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

  if (state.status === "ready" && state.records.length === 0) {
    return (
      <List.EmptyView
        icon={recordTypeIcon(recordType)}
        title={`No ${recordTypeLabel(recordType)} Records`}
        description="Core Edge returned no records for this type."
      />
    );
  }

  return null;
}

type BrowseRecordsState =
  | { records: CoreRecord[]; status: "loading"; error?: undefined }
  | { records: CoreRecord[]; status: "ready"; error?: undefined }
  | { records: CoreRecord[]; status: "error"; error: string };
