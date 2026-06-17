import {
  Action,
  ActionPanel,
  Color,
  Detail,
  Form,
  Icon,
  List,
  Toast,
  confirmAlert,
  showToast,
  useNavigation,
} from "@raycast/api";
import { useEffect, useMemo, useState } from "react";
import {
  CoreEdgeClient,
  CoreEdgeError,
  CoreLegacyContext,
  CoreLegacyContextLink,
  CoreLegacyRelatedNote,
  CoreLegacyRelationship,
  CoreLink,
  CorePreferences,
  CoreRecord,
  CoreRecordRef,
  CoreRecordType,
  CoreSearchResult,
} from "./core-edge.js";
import { formatRelType } from "./link-support.js";

export function useCoreClient(preferences: CorePreferences): CoreEdgeClient {
  const baseUrl = preferences.baseUrl.trim();
  const apiToken = preferences.apiToken;
  const namespace = preferences.namespace?.trim();
  const resultLimit = preferences.resultLimit;
  return useMemo(
    () =>
      new CoreEdgeClient({
        baseUrl,
        apiToken,
        namespace,
        resultLimit,
      }),
    [apiToken, baseUrl, namespace, resultLimit],
  );
}

export function preferenceLimit(preferences: CorePreferences, fallback = 10) {
  return parseInt(preferences.resultLimit, 10) || fallback;
}

export function RecordActions({
  client,
  exploreTitle = "Explore Links",
  onRecordUpdated,
  readTitle = "Read Record",
  record,
}: {
  client: CoreEdgeClient;
  exploreTitle?: string;
  onRecordUpdated?: (record: CoreRecord) => void;
  readTitle?: string;
  record: CoreRecordRef;
}) {
  return (
    <ActionPanel>
      <Action.Push
        icon={Icon.Book}
        title={readTitle}
        target={readTarget(client, record)}
      />
      <Action.Push
        icon={Icon.Binoculars}
        shortcut={{ modifiers: ["cmd"], key: "return" }}
        title={exploreTitle}
        target={<LinkedRecords client={client} source={record} />}
      />
      <TaskActionSection
        client={client}
        onRecordUpdated={onRecordUpdated}
        record={record}
      />
      <CopyRecordActions client={client} record={record} />
    </ActionPanel>
  );
}

function TaskActionSection({
  client,
  onRecordUpdated,
  record,
}: {
  client: CoreEdgeClient;
  onRecordUpdated?: (record: CoreRecord) => void;
  record: CoreRecordRef;
}) {
  if (record.recordType !== "task") return null;
  return (
    <ActionPanel.Section title="Task">
      <Action
        icon={Icon.Play}
        shortcut={{ modifiers: ["cmd", "shift"], key: "s" }}
        title="Start Task"
        onAction={() =>
          mutateTask(
            record,
            () => client.startTask(record.id),
            "Task Started",
            onRecordUpdated,
          )
        }
      />
      <Action.Push
        icon={Icon.Calendar}
        shortcut={{ modifiers: ["cmd", "shift"], key: "d" }}
        title="Schedule Task"
        target={
          <ScheduleTaskForm
            client={client}
            onRecordUpdated={onRecordUpdated}
            record={record}
          />
        }
      />
      <Action.Push
        icon={Icon.Text}
        shortcut={{ modifiers: ["cmd", "shift"], key: "n" }}
        title="Append Task Note"
        target={
          <AppendTaskNoteForm
            client={client}
            onRecordUpdated={onRecordUpdated}
            record={record}
          />
        }
      />
      <Action.Push
        icon={Icon.Pause}
        shortcut={{ modifiers: ["cmd", "shift"], key: "b" }}
        title="Block Task"
        target={
          <BlockTaskForm
            client={client}
            onRecordUpdated={onRecordUpdated}
            record={record}
          />
        }
      />
      <Action
        icon={Icon.Circle}
        shortcut={{ modifiers: ["cmd", "shift"], key: "u" }}
        title="Unblock Task"
        onAction={() =>
          mutateTask(
            record,
            () => client.unblockTask(record.id),
            "Task Unblocked",
            onRecordUpdated,
          )
        }
      />
      <Action
        icon={Icon.CheckCircle}
        style={Action.Style.Destructive}
        title="Close Task"
        onAction={() => closeTask(client, record, onRecordUpdated)}
      />
    </ActionPanel.Section>
  );
}

function AppendTaskNoteForm({
  client,
  onRecordUpdated,
  record,
}: {
  client: CoreEdgeClient;
  onRecordUpdated?: (record: CoreRecord) => void;
  record: CoreRecordRef;
}) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm<AppendTaskNoteValues>
            icon={Icon.Text}
            title="Append Note"
            onSubmit={async (values) => {
              const note = values.note.trim();
              if (!note) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Note Required",
                });
                return false;
              }
              const updated = await mutateTask(
                record,
                () => client.appendTaskNote(record.id, note),
                "Task Note Appended",
                onRecordUpdated,
              );
              if (updated) pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="note"
        title="Note"
        placeholder="Add context, decision, blocker detail, or next-step note."
      />
    </Form>
  );
}

function BlockTaskForm({
  client,
  onRecordUpdated,
  record,
}: {
  client: CoreEdgeClient;
  onRecordUpdated?: (record: CoreRecord) => void;
  record: CoreRecordRef;
}) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm<BlockTaskValues>
            icon={Icon.Pause}
            title="Block Task"
            onSubmit={async (values) => {
              const reason = values.reason.trim();
              if (!reason) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Reason Required",
                });
                return false;
              }
              const updated = await mutateTask(
                record,
                () => client.blockTask(record.id, reason),
                "Task Blocked",
                onRecordUpdated,
              );
              if (updated) pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.TextArea
        id="reason"
        title="Reason"
        placeholder="What is this task waiting on?"
      />
    </Form>
  );
}

function ScheduleTaskForm({
  client,
  onRecordUpdated,
  record,
}: {
  client: CoreEdgeClient;
  onRecordUpdated?: (record: CoreRecord) => void;
  record: CoreRecordRef;
}) {
  const { pop } = useNavigation();
  return (
    <Form
      actions={
        <ActionPanel>
          <Action.SubmitForm<ScheduleTaskValues>
            icon={Icon.Calendar}
            title="Schedule Task"
            onSubmit={async (values) => {
              const date = values.date;
              if (!date) {
                await showToast({
                  style: Toast.Style.Failure,
                  title: "Date Required",
                });
                return false;
              }
              const updated = await mutateTask(
                record,
                () =>
                  client.scheduleTask(record.id, values.field, date.getTime()),
                values.field === "due_at" ? "Due Date Set" : "Do Date Set",
                onRecordUpdated,
              );
              if (updated) pop();
            }}
          />
        </ActionPanel>
      }
    >
      <Form.Dropdown id="field" title="Date Type" defaultValue="resurface_at">
        <Form.Dropdown.Item title="Do Date" value="resurface_at" />
        <Form.Dropdown.Item title="Due Date" value="due_at" />
      </Form.Dropdown>
      <Form.DatePicker
        id="date"
        title="Date"
        type={Form.DatePicker.Type.DateTime}
      />
    </Form>
  );
}

async function closeTask(
  client: CoreEdgeClient,
  record: CoreRecordRef,
  onRecordUpdated?: (record: CoreRecord) => void,
) {
  const confirmed = await confirmAlert({
    title: "Close Task?",
    message: record.title,
  });
  if (!confirmed) return;
  await mutateTask(
    record,
    () => client.closeTask(record.id),
    "Task Closed",
    onRecordUpdated,
  );
}

async function mutateTask(
  record: CoreRecordRef,
  mutation: () => Promise<CoreRecord>,
  successTitle: string,
  onRecordUpdated?: (record: CoreRecord) => void,
): Promise<CoreRecord | undefined> {
  try {
    const updated = await mutation();
    onRecordUpdated?.(updated);
    await showToast({
      style: Toast.Style.Success,
      title: successTitle,
      message: updated.title || record.title,
    });
    return updated;
  } catch (error: unknown) {
    await showToast({
      style: Toast.Style.Failure,
      title: "Task Update Failed",
      message: errorMessage(error),
    });
    return undefined;
  }
}

export function CopyRecordActions({
  client,
  record,
}: {
  client: CoreEdgeClient;
  record: CoreRecordRef;
}) {
  return (
    <ActionPanel.Section title="Copy">
      <Action.CopyToClipboard
        icon={Icon.Paragraph}
        shortcut={{ modifiers: ["cmd", "shift"], key: "c" }}
        title="Copy Reference"
        content={`[[${record.title}]]`}
      />
      <Action.CopyToClipboard
        icon={Icon.Text}
        shortcut={{ modifiers: ["cmd"], key: "c" }}
        title="Copy Title"
        content={record.title}
      />
      <Action.CopyToClipboard
        icon={Icon.Link}
        shortcut={{ modifiers: ["cmd", "shift"], key: "l" }}
        title="Copy API Link"
        content={client.recordApiUrl(record.recordType, record.id)}
      />
      <Action.CopyToClipboard
        icon={Icon.Hashtag}
        shortcut={{ modifiers: ["cmd", "shift"], key: "i" }}
        title="Copy ID"
        content={record.id}
      />
    </ActionPanel.Section>
  );
}

export function readTarget(client: CoreEdgeClient, record: CoreRecordRef) {
  if (record.recordType === "note" || record.recordType === "record") {
    return <ReadNote client={client} id={record.id} />;
  }
  return <ReadRecord client={client} record={record} />;
}

function ReadNote({ client, id }: { client: CoreEdgeClient; id: string }) {
  const [state, setState] = useState<NoteState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    client
      .getNote(id)
      .then((note) => {
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

  if (state.status === "error")
    return <Detail markdown={`# Unable to Read Note\n\n${state.error}`} />;
  if (state.status !== "ready")
    return <Detail isLoading markdown="# Loading" />;

  const { note } = state;
  return (
    <Detail
      markdown={noteMarkdown(note)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Title" text={note.title} />
          <Detail.Metadata.Label
            title="Type"
            text="Note"
            icon={recordTypeIcon("note")}
          />
          {note.status ? (
            <Detail.Metadata.Label title="Status" text={note.status} />
          ) : null}
          {note.source ? (
            <Detail.Metadata.Label title="Source" text={note.source} />
          ) : null}
          {note.file_path ? (
            <Detail.Metadata.Label title="File" text={note.file_path} />
          ) : null}
          {note.updated_at ? (
            <Detail.Metadata.Label
              title="Updated"
              text={formatTimestamp(note.updated_at)}
            />
          ) : null}
          {note.tags && note.tags.length > 0 ? (
            <Detail.Metadata.TagList title="Tags">
              {note.tags.map((tag) => (
                <Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </Detail.Metadata.TagList>
          ) : null}
          <Detail.Metadata.Label title="ID" text={note.id} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.Push
            icon={Icon.Binoculars}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            title="Explore Links"
            target={
              <LinkedRecords
                client={client}
                source={{ id: note.id, recordType: "note", title: note.title }}
              />
            }
          />
          <CopyRecordActions
            client={client}
            record={{ id: note.id, recordType: "note", title: note.title }}
          />
        </ActionPanel>
      }
    />
  );
}

function ReadRecord({
  client,
  record,
}: {
  client: CoreEdgeClient;
  record: CoreRecordRef;
}) {
  const [state, setState] = useState<RecordState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    client
      .getRecord(record.recordType, record.id)
      .then((data) => {
        if (!cancelled) setState({ status: "ready", record: data });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({ status: "error", error: errorMessage(error) });
      });
    return () => {
      cancelled = true;
    };
  }, [client, record.id, record.recordType]);

  if (state.status === "error")
    return <Detail markdown={`# Unable to Open Record\n\n${state.error}`} />;
  if (state.status !== "ready")
    return <Detail isLoading markdown="# Loading" />;

  return (
    <RecordDetail
      client={client}
      onRecordUpdated={(record) => setState({ status: "ready", record })}
      record={state.record}
    />
  );
}

function RecordDetail({
  client,
  onRecordUpdated,
  record,
}: {
  client: CoreEdgeClient;
  onRecordUpdated?: (record: CoreRecord) => void;
  record: CoreRecord;
}) {
  return (
    <Detail
      markdown={recordMarkdown(record)}
      metadata={
        <Detail.Metadata>
          <Detail.Metadata.Label title="Title" text={record.title} />
          <Detail.Metadata.Label
            title="Type"
            text={recordTypeLabel(record.recordType)}
            icon={recordTypeIcon(record.recordType)}
          />
          {record.status ? (
            <Detail.Metadata.Label
              title="Status"
              text={formatValue(record.status)}
            />
          ) : null}
          {record.stage ? (
            <Detail.Metadata.Label
              title="Stage"
              text={formatValue(record.stage)}
            />
          ) : null}
          {record.priority ? (
            <Detail.Metadata.Label title="Priority" text={record.priority} />
          ) : null}
          {record.updated_at ? (
            <Detail.Metadata.Label
              title="Updated"
              text={formatTimestamp(record.updated_at)}
            />
          ) : null}
          {record.tags.length > 0 ? (
            <Detail.Metadata.TagList title="Tags">
              {record.tags.map((tag) => (
                <Detail.Metadata.TagList.Item key={tag} text={tag} />
              ))}
            </Detail.Metadata.TagList>
          ) : null}
          <Detail.Metadata.Label title="ID" text={record.id} />
        </Detail.Metadata>
      }
      actions={
        <ActionPanel>
          <Action.Push
            icon={Icon.Binoculars}
            shortcut={{ modifiers: ["cmd"], key: "return" }}
            title="Explore Links"
            target={<LinkedRecords client={client} source={record} />}
          />
          <TaskActionSection
            client={client}
            onRecordUpdated={onRecordUpdated}
            record={record}
          />
          <CopyRecordActions client={client} record={record} />
        </ActionPanel>
      }
    />
  );
}

export function LinkedRecords({
  client,
  source,
}: {
  client: CoreEdgeClient;
  source: CoreRecordRef;
}) {
  if (source.recordType === "note" && source.id.startsWith("j")) {
    return <LegacyLinkedRecords client={client} source={source} />;
  }

  const [state, setState] = useState<LinkState>({
    status: "loading",
    links: [],
  });

  useEffect(() => {
    let cancelled = false;
    client
      .links(source.recordType, source.id)
      .then((links) => {
        if (!cancelled) setState({ status: "ready", links });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            links: [],
            error: errorMessage(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [client, source.id, source.recordType]);

  const outgoing =
    state.status === "ready"
      ? state.links.filter((link) => sameRecord(link.from, source))
      : [];
  const incoming =
    state.status === "ready"
      ? state.links.filter((link) => sameRecord(link.to, source))
      : [];

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={state.status === "ready" && state.links.length > 0}
      searchBarPlaceholder={`Filter links for ${source.title}`}
    >
      {state.status === "error" ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to Load Links"
          description={state.error}
        />
      ) : null}
      {state.status === "ready" && state.links.length === 0 ? (
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No Typed Links"
          description={`No typed links returned for ${source.title}.`}
        />
      ) : null}
      {outgoing.length > 0 ? (
        <List.Section
          title="Links From This Record"
          subtitle={String(outgoing.length)}
        >
          {outgoing.map((link) => (
            <LinkedRecordItem
              key={link.id}
              client={client}
              direction="outgoing"
              link={link}
              linkedRecord={link.to}
            />
          ))}
        </List.Section>
      ) : null}
      {incoming.length > 0 ? (
        <List.Section
          title="Links To This Record"
          subtitle={String(incoming.length)}
        >
          {incoming.map((link) => (
            <LinkedRecordItem
              key={link.id}
              client={client}
              direction="incoming"
              link={link}
              linkedRecord={link.from}
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function LegacyLinkedRecords({
  client,
  source,
}: {
  client: CoreEdgeClient;
  source: CoreRecordRef;
}) {
  const [state, setState] = useState<LegacyContextState>({
    status: "loading",
  });

  useEffect(() => {
    let cancelled = false;
    client
      .legacyContext(source.id)
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
  }, [client, source.id]);

  const linkCount =
    state.status === "ready" ? legacyContextLinkCount(state.context) : 0;

  return (
    <List
      isLoading={state.status === "loading"}
      isShowingDetail={state.status === "ready" && linkCount > 0}
      searchBarPlaceholder={`Filter legacy links for ${source.title}`}
    >
      {state.status === "error" ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to Load Legacy Links"
          description={state.error}
        />
      ) : null}
      {state.status === "ready" && linkCount === 0 ? (
        <List.EmptyView
          icon={Icon.Binoculars}
          title="No Legacy Links"
          description={`No legacy links returned for ${source.title}.`}
        />
      ) : null}
      {state.status === "ready" ? (
        <>
          <LegacyTitleLinkSection
            client={client}
            direction="outgoing"
            links={state.context.forwardLinks}
            source={source}
            title="Wiki Links From This Note"
          />
          <LegacyTitleLinkSection
            client={client}
            direction="incoming"
            links={state.context.backlinks}
            source={source}
            title="Wiki Links To This Note"
          />
          {state.context.typedRelationships.length > 0 ? (
            <List.Section
              title="Legacy Relationships"
              subtitle={String(state.context.typedRelationships.length)}
            >
              {state.context.typedRelationships.map((relationship) => (
                <LegacyRelationshipItem
                  key={`${relationship.id}-${relationship.relType ?? "relationship"}`}
                  client={client}
                  relationship={relationship}
                />
              ))}
            </List.Section>
          ) : null}
          {state.context.relatedByTags.length > 0 ? (
            <List.Section
              title="Related By Tags"
              subtitle={String(state.context.relatedByTags.length)}
            >
              {state.context.relatedByTags.map((note) => (
                <LegacyRelatedNoteItem
                  key={note.id}
                  client={client}
                  note={note}
                />
              ))}
            </List.Section>
          ) : null}
        </>
      ) : null}
    </List>
  );
}

function LegacyTitleLinkSection({
  client,
  direction,
  links,
  source,
  title,
}: {
  client: CoreEdgeClient;
  direction: "incoming" | "outgoing";
  links: CoreLegacyContextLink[];
  source: CoreRecordRef;
  title: string;
}) {
  if (links.length === 0) return null;
  return (
    <List.Section title={title} subtitle={String(links.length)}>
      {links.map((link) => (
        <LegacyTitleLinkItem
          key={`${direction}-${link.id ?? link.title}`}
          client={client}
          direction={direction}
          link={link}
          source={source}
        />
      ))}
    </List.Section>
  );
}

function LegacyTitleLinkItem({
  client,
  direction,
  link,
  source,
}: {
  client: CoreEdgeClient;
  direction: "incoming" | "outgoing";
  link: CoreLegacyContextLink;
  source: CoreRecordRef;
}) {
  const linkedRecord = link.id
    ? { id: link.id, recordType: "note" as const, title: link.title }
    : undefined;

  return (
    <List.Item
      icon={recordTypeIcon("note")}
      title={link.title}
      detail={
        <List.Item.Detail
          markdown={legacyTitleLinkMarkdown(source, link, direction)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Title"
                text={link.title}
              />
              <List.Item.Detail.Metadata.Label
                title="Direction"
                text={direction}
              />
              <List.Item.Detail.Metadata.Label
                title="Source"
                text="legacy wiki link"
              />
              {link.id ? (
                <List.Item.Detail.Metadata.Label title="ID" text={link.id} />
              ) : null}
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        linkedRecord ? (
          <RecordActions client={client} record={linkedRecord} />
        ) : (
          <LegacyTitleActions client={client} title={link.title} />
        )
      }
    />
  );
}

function LegacyTitleActions({
  client,
  title,
}: {
  client: CoreEdgeClient;
  title: string;
}) {
  return (
    <ActionPanel>
      <Action.Push
        icon={Icon.Book}
        title="Open Linked Note"
        target={<ResolvedLegacyTitle client={client} title={title} />}
      />
      <Action.Push
        icon={Icon.MagnifyingGlass}
        shortcut={{ modifiers: ["cmd"], key: "return" }}
        title="Find Candidates"
        target={<LegacyTitleSearch client={client} title={title} />}
      />
      <ActionPanel.Section title="Copy">
        <Action.CopyToClipboard
          icon={Icon.Paragraph}
          title="Copy Reference"
          content={`[[${title}]]`}
        />
        <Action.CopyToClipboard
          icon={Icon.Text}
          title="Copy Title"
          content={title}
        />
      </ActionPanel.Section>
    </ActionPanel>
  );
}

function ResolvedLegacyTitle({
  client,
  title,
}: {
  client: CoreEdgeClient;
  title: string;
}) {
  const [state, setState] = useState<LegacySearchState>({
    status: "loading",
    results: [],
  });

  useEffect(() => {
    let cancelled = false;
    client
      .search(title, 8)
      .then((response) => {
        if (!cancelled)
          setState({ status: "ready", results: response.results });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            results: [],
            error: errorMessage(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [client, title]);

  if (state.status === "error") {
    return (
      <Detail markdown={`# Unable to Open Linked Note\n\n${state.error}`} />
    );
  }

  if (state.status !== "ready") {
    return <Detail isLoading markdown="# Opening Linked Note" />;
  }

  const resolved = resolveLegacyTitle(title, state.results);
  if (resolved) return readTarget(client, resolved);

  return <LegacyTitleSearch client={client} title={title} />;
}

function LegacyTitleSearch({
  client,
  title,
}: {
  client: CoreEdgeClient;
  title: string;
}) {
  const [state, setState] = useState<LegacySearchState>({
    status: "loading",
    results: [],
  });

  useEffect(() => {
    let cancelled = false;
    client
      .search(title, 8)
      .then((response) => {
        if (!cancelled)
          setState({ status: "ready", results: response.results });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setState({
            status: "error",
            results: [],
            error: errorMessage(error),
          });
      });
    return () => {
      cancelled = true;
    };
  }, [client, title]);

  return (
    <List
      isLoading={state.status === "loading"}
      searchBarPlaceholder={`Find ${title}`}
    >
      {state.status === "error" ? (
        <List.EmptyView
          icon={Icon.Warning}
          title="Unable to Search Linked Note"
          description={state.error}
        />
      ) : null}
      {state.status === "ready" && state.results.length === 0 ? (
        <List.EmptyView
          icon={Icon.Document}
          title="No Matching Notes"
          description={`No search results returned for ${title}.`}
        />
      ) : null}
      {state.results.length > 0 ? (
        <List.Section title="Matches" subtitle={String(state.results.length)}>
          {state.results.map((result) => (
            <List.Item
              key={result.id}
              icon={recordTypeIcon(result.recordType)}
              title={result.title}
              subtitle={recordTypeLabel(result.recordType)}
              actions={
                <RecordActions
                  client={client}
                  readTitle="Read"
                  record={result}
                />
              }
            />
          ))}
        </List.Section>
      ) : null}
    </List>
  );
}

function resolveLegacyTitle(
  title: string,
  results: CoreSearchResult[],
): CoreRecordRef | undefined {
  const notes = results.filter((result) => result.recordType === "note");
  const exact = notes.find(
    (result) => normalizeTitle(result.title) === normalizeTitle(title),
  );
  if (exact) return exact;
  if (notes.length === 1) return notes[0];
  return undefined;
}

function normalizeTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function LegacyRelatedNoteItem({
  client,
  note,
}: {
  client: CoreEdgeClient;
  note: CoreLegacyRelatedNote;
}) {
  return (
    <List.Item
      icon={recordTypeIcon("note")}
      title={note.title}
      actions={<RecordActions client={client} record={note} />}
    />
  );
}

function LegacyRelationshipItem({
  client,
  relationship,
}: {
  client: CoreEdgeClient;
  relationship: CoreLegacyRelationship;
}) {
  return (
    <List.Item
      icon={recordTypeIcon("note")}
      title={relationship.title}
      actions={<RecordActions client={client} record={relationship} />}
    />
  );
}

function LinkedRecordItem({
  client,
  direction,
  link,
  linkedRecord,
}: {
  client: CoreEdgeClient;
  direction: "incoming" | "outgoing";
  link: CoreLink;
  linkedRecord: CoreRecordRef;
}) {
  const directionLabel = direction === "outgoing" ? "outgoing" : "incoming";
  return (
    <List.Item
      icon={recordTypeIcon(linkedRecord.recordType)}
      title={linkedRecord.title}
      detail={
        <List.Item.Detail
          markdown={linkDetailMarkdown(link)}
          metadata={
            <List.Item.Detail.Metadata>
              <List.Item.Detail.Metadata.Label
                title="Relationship"
                text={formatRelType(link.relType)}
              />
              <List.Item.Detail.Metadata.Label
                title="Direction"
                text={directionLabel}
              />
              <List.Item.Detail.Metadata.Label
                title="From"
                text={link.from.title}
                icon={recordTypeIcon(link.from.recordType)}
              />
              <List.Item.Detail.Metadata.Label
                title="To"
                text={link.to.title}
                icon={recordTypeIcon(link.to.recordType)}
              />
              <List.Item.Detail.Metadata.Label
                title="Linked Type"
                text={recordTypeLabel(linkedRecord.recordType)}
                icon={recordTypeIcon(linkedRecord.recordType)}
              />
              <List.Item.Detail.Metadata.Label
                title="Linked ID"
                text={linkedRecord.id}
              />
              <List.Item.Detail.Metadata.Label title="Link ID" text={link.id} />
            </List.Item.Detail.Metadata>
          }
        />
      }
      actions={
        <RecordActions
          client={client}
          exploreTitle="Explore Linked Record"
          readTitle="Open Linked Record"
          record={linkedRecord}
        />
      }
    />
  );
}

function legacyContextLinkCount(context: CoreLegacyContext): number {
  return (
    context.forwardLinks.length +
    context.backlinks.length +
    context.relatedByTags.length +
    context.typedRelationships.length
  );
}

function legacyTitleLinkMarkdown(
  source: CoreRecordRef,
  link: CoreLegacyContextLink,
  direction: "incoming" | "outgoing",
): string {
  if (direction === "outgoing") {
    return `**${source.title}**\n\n--[wiki link]-->\n\n**${link.title}**`;
  }
  return `**${link.title}**\n\n--[wiki link]-->\n\n**${source.title}**`;
}

function sameRecord(a: CoreRecordRef, b: CoreRecordRef): boolean {
  return a.id === b.id && a.recordType === b.recordType;
}

function linkDetailMarkdown(link: CoreLink): string {
  return `**${link.from.title}**\n\n--[${formatRelType(link.relType)}]-->\n\n**${link.to.title}**`;
}

export function formatTimestamp(timestamp: number): string {
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(timestamp));
}

export function recordTypeIcon(recordType: CoreRecordType): {
  source: Icon;
  tintColor: Color;
} {
  switch (recordType) {
    case "note":
      return { source: Icon.Document, tintColor: Color.Blue };
    case "task":
      return { source: Icon.NumberList, tintColor: Color.Green };
    case "project":
      return { source: Icon.Folder, tintColor: Color.Purple };
    case "person":
      return { source: Icon.Person, tintColor: Color.Magenta };
    case "organisation":
      return { source: Icon.Building, tintColor: Color.Orange };
    case "opportunity":
      return { source: Icon.StarCircle, tintColor: Color.Yellow };
    case "record":
      return { source: Icon.Circle, tintColor: Color.SecondaryText };
  }
}

export function recordTypeLabel(recordType: CoreRecordType): string {
  if (recordType === "organisation") return "Organisation";
  return `${recordType.charAt(0).toUpperCase()}${recordType.slice(1)}`;
}

export function formatValue(value: string): string {
  return value.replaceAll("_", " ");
}

export function errorMessage(error: unknown): string {
  if (error instanceof CoreEdgeError) return error.message;
  if (error instanceof Error) return error.message;
  return "Unknown error";
}

function noteMarkdown(
  note: Awaited<ReturnType<CoreEdgeClient["getNote"]>>,
): string {
  const body = stripDuplicateLeadingTitle(
    note.content || note.summary || "",
    note.title,
  );
  return `# ${note.title}\n\n${body || "No content returned."}`;
}

function recordMarkdown(record: CoreRecord): string {
  const body = stripDuplicateLeadingTitle(record.content ?? "", record.title);
  return `# ${record.title}\n\n${body || `${recordTypeLabel(record.recordType)} record.`}`;
}

function stripDuplicateLeadingTitle(content: string, title: string): string {
  const trimmed = content.trimStart();
  const firstLineEnd = trimmed.indexOf("\n");
  const firstLine =
    firstLineEnd === -1 ? trimmed : trimmed.slice(0, firstLineEnd);
  const normalizedFirst = firstLine.replace(/^#{1,6}\s+/, "").trim();
  if (normalizedFirst !== title.trim()) return trimmed;
  return (
    firstLineEnd === -1 ? "" : trimmed.slice(firstLineEnd + 1)
  ).trimStart();
}

type NoteState =
  | { status: "loading" }
  | { status: "ready"; note: Awaited<ReturnType<CoreEdgeClient["getNote"]>> }
  | { status: "error"; error: string };

type RecordState =
  | { status: "loading" }
  | { status: "ready"; record: CoreRecord }
  | { status: "error"; error: string };

type LinkState =
  | { status: "loading"; links: CoreLink[]; error?: undefined }
  | { status: "ready"; links: CoreLink[]; error?: undefined }
  | { status: "error"; links: CoreLink[]; error: string };

type LegacyContextState =
  | { status: "loading" }
  | { status: "ready"; context: CoreLegacyContext }
  | { status: "error"; error: string };

type LegacySearchState =
  | {
      status: "loading";
      results: Awaited<ReturnType<CoreEdgeClient["search"]>>["results"];
      error?: undefined;
    }
  | {
      status: "ready";
      results: Awaited<ReturnType<CoreEdgeClient["search"]>>["results"];
      error?: undefined;
    }
  | {
      status: "error";
      results: Awaited<ReturnType<CoreEdgeClient["search"]>>["results"];
      error: string;
    };

type BlockTaskValues = {
  reason: string;
};

type AppendTaskNoteValues = {
  note: string;
};

type ScheduleTaskValues = {
  field: "due_at" | "resurface_at";
  date: Date | null;
};
