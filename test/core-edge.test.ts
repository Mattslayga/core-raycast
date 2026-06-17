import { afterEach, describe, expect, test } from "vitest";
import { CoreEdgeClient } from "../src/core-edge";

const originalFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = originalFetch;
});

describe("CoreEdgeClient", () => {
  test("sends hybrid search through the Core Edge HTTP contract", async () => {
    let requestedUrl: string | undefined;
    let requestedHeaders: Headers | undefined;
    globalThis.fetch = mockFetch((input, init) => {
      requestedUrl = String(input);
      requestedHeaders = new Headers(init?.headers);
      return jsonResponse({
        mode: "hybrid",
        warning: "vector search unavailable — results are BM25-only",
        results: [
          {
            id: "doc123",
            doc_id: "doc123",
            title: "Core Edge — Public Alpha Execution Spine",
            summary: "Current execution context.",
            score: 0.25,
            word_count: 1234,
          },
        ],
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      namespace: "test-namespace",
      resultLimit: "10",
    });

    const response = await client.search("public alpha", 10);

    expect(requestedUrl).toBe(
      "https://core-edge.example/search?q=public+alpha&limit=10&mode=hybrid",
    );
    expect(requestedHeaders?.get("authorization")).toBe("Bearer test-token");
    expect(requestedHeaders?.get("x-namespace")).toBe("test-namespace");
    expect(requestedHeaders?.get("x-core-client")).toBe("raycast-core");
    expect(response.warning).toBe(
      "vector search unavailable — results are BM25-only",
    );
    expect(response.results).toEqual([
      {
        id: "doc123",
        docId: "doc123",
        recordType: "record",
        title: "Core Edge — Public Alpha Execution Spine",
        summary: "Current execution context.",
        score: 0.25,
        wordCount: 1234,
      },
    ]);
  });

  test("normalizes explicit and inferred search record types", async () => {
    globalThis.fetch = mockFetch(() =>
      jsonResponse({
        mode: "hybrid",
        results: [
          {
            id: "p57task",
            title: "Follow up",
            record_type: "task",
          },
          {
            id: "nx7project",
            title: "Core Edge",
          },
          {
            id: "j57legacy",
            title: "Legacy migrated note",
          },
        ],
      }),
    );

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.search("core", 10)).resolves.toMatchObject({
      results: [
        { id: "p57task", recordType: "task" },
        { id: "nx7project", recordType: "project" },
        { id: "j57legacy", recordType: "note" },
      ],
    });
  });

  test("normalizes related notes", async () => {
    globalThis.fetch = mockFetch(() =>
      jsonResponse({
        related: [
          {
            id: "doc456",
            title: "Agent-First Product Principles",
            tags: ["core-edge"],
            score: 0.8,
            signals: ["semantic", "shared-tag:core-edge"],
          },
        ],
      }),
    );

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.related("doc123")).resolves.toEqual([
      {
        id: "doc456",
        recordType: "record",
        title: "Agent-First Product Principles",
        tags: ["core-edge"],
        score: 0.8,
        signals: ["semantic", "shared-tag:core-edge"],
      },
    ]);
  });

  test("lists typed graph links for a record", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        links: [
          {
            _id: "lnk123",
            from_type: "task",
            from_id: "p57task",
            from_title: "Fix Raycast graph view",
            to_type: "project",
            to_id: "nx7project",
            to_title: "Core Edge",
            rel_type: "belongs_to",
          },
        ],
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.links("task", "p57task")).resolves.toEqual([
      {
        id: "lnk123",
        relType: "belongs_to",
        from: {
          id: "p57task",
          recordType: "task",
          title: "Fix Raycast graph view",
        },
        to: {
          id: "nx7project",
          recordType: "project",
          title: "Core Edge",
        },
      },
    ]);
    expect(requestedUrl).toBe(
      "https://core-edge.example/links/involving/task/p57task",
    );
  });

  test("fetches legacy note context for migrated document graph fallback", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        document: {
          id: "j57legacy",
          title: "Legacy Migrated Note",
          tags: ["core-edge"],
        },
        forward_links: ["Forward Note"],
        backlinks: [{ id: "j57back", title: "Backlink Note" }],
        related_by_tags: [
          {
            id: "j57related",
            title: "Related Note",
            shared_tags: ["core-edge"],
          },
        ],
        typed_relationships: [
          {
            other_doc_id: "j57relationship",
            other_title: "Relationship Note",
            rel_type: "supports",
            direction: "outgoing",
            reason: "Relevant context",
            created_by: "agent",
          },
        ],
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.legacyContext("j57legacy", 5)).resolves.toEqual({
      document: {
        id: "j57legacy",
        recordType: "note",
        title: "Legacy Migrated Note",
      },
      forwardLinks: [{ title: "Forward Note" }],
      backlinks: [{ id: "j57back", title: "Backlink Note" }],
      relatedByTags: [
        {
          id: "j57related",
          recordType: "note",
          title: "Related Note",
          sharedTags: ["core-edge"],
        },
      ],
      typedRelationships: [
        {
          id: "j57relationship",
          recordType: "note",
          title: "Relationship Note",
          relType: "supports",
          direction: "outgoing",
          reason: "Relevant context",
          createdBy: "agent",
        },
      ],
    });
    expect(requestedUrl).toBe(
      "https://core-edge.example/context/j57legacy?limit=5",
    );
  });

  test("fetches a typed record", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        record_id: "p57task",
        record_type: "task",
        title: "Fix Raycast graph view",
        content: "Make Explore traverse typed links.",
        tags: ["raycast"],
        status: "open",
        priority: "high",
        updated_at: 1760000000000,
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.getRecord("task", "p57task")).resolves.toEqual({
      id: "p57task",
      recordType: "task",
      title: "Fix Raycast graph view",
      content: "Make Explore traverse typed links.",
      tags: ["raycast"],
      status: "open",
      priority: "high",
      updated_at: 1760000000000,
    });
    expect(requestedUrl).toBe("https://core-edge.example/records/task/p57task");
  });

  test("updates typed tasks through the record update endpoint", async () => {
    const originalDateNow = Date.now;
    Date.now = () => 1760000000123;
    const requests: Array<{
      method?: string;
      url: string;
      body: unknown;
    }> = [];
    globalThis.fetch = mockFetch((input, init) => {
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({
        method: init?.method,
        url: String(input),
        body,
      });
      return jsonResponse({
        record_id: "p57task",
        record_type: "task",
        title: "Fix Raycast task actions",
        tags: ["raycast"],
        ...body,
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    try {
      await expect(client.startTask("p57task")).resolves.toMatchObject({
        id: "p57task",
        recordType: "task",
        status: "in_progress",
      });
      await expect(
        client.blockTask("p57task", "Waiting for feedback"),
      ).resolves.toMatchObject({
        status: "blocked",
        blocked_reason: "Waiting for feedback",
      });
      await expect(client.unblockTask("p57task")).resolves.toMatchObject({
        status: "open",
      });
      await expect(client.closeTask("p57task")).resolves.toMatchObject({
        status: "completed",
        completed_at: 1760000000123,
      });
      await expect(
        client.scheduleTask("p57task", "resurface_at", 1760000000456),
      ).resolves.toMatchObject({
        resurface_at: 1760000000456,
      });
    } finally {
      Date.now = originalDateNow;
    }

    expect(requests).toEqual([
      {
        method: "PATCH",
        url: "https://core-edge.example/records/task/p57task",
        body: { status: "in_progress" },
      },
      {
        method: "PATCH",
        url: "https://core-edge.example/records/task/p57task",
        body: { status: "blocked", blocked_reason: "Waiting for feedback" },
      },
      {
        method: "PATCH",
        url: "https://core-edge.example/records/task/p57task",
        body: { status: "open", blocked_reason: null },
      },
      {
        method: "PATCH",
        url: "https://core-edge.example/records/task/p57task",
        body: { status: "completed", completed_at: 1760000000123 },
      },
      {
        method: "PATCH",
        url: "https://core-edge.example/records/task/p57task",
        body: { resurface_at: 1760000000456 },
      },
    ]);
  });

  test("appends task notes through typed task content update", async () => {
    const originalDateNow = Date.now;
    Date.now = () => 1760000000123;
    const requests: Array<{
      method?: string;
      url: string;
      body: unknown;
    }> = [];

    globalThis.fetch = mockFetch((input, init) => {
      const method = init?.method ?? "GET";
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({
        method,
        url: String(input),
        body,
      });

      if (method === "GET") {
        return jsonResponse({
          record_id: "p57task",
          record_type: "task",
          title: "Fix Raycast task notes",
          content: "Existing context.",
          tags: ["raycast"],
          status: "open",
        });
      }

      return jsonResponse({
        record_id: "p57task",
        record_type: "task",
        title: "Fix Raycast task notes",
        tags: ["raycast"],
        status: "open",
        ...body,
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    try {
      await expect(
        client.appendTaskNote("p57task", "  New task context.  "),
      ).resolves.toMatchObject({
        content:
          "Existing context.\n\n---\n\n*2025-10-09T08:53:20.123Z*\n\nNew task context.",
      });
    } finally {
      Date.now = originalDateNow;
    }

    expect(requests).toEqual([
      {
        method: "GET",
        url: "https://core-edge.example/records/task/p57task",
        body: undefined,
      },
      {
        method: "PATCH",
        url: "https://core-edge.example/records/task/p57task",
        body: {
          content:
            "Existing context.\n\n---\n\n*2025-10-09T08:53:20.123Z*\n\nNew task context.",
        },
      },
    ]);
  });

  test("creates typed records through the record create endpoint", async () => {
    let requestedUrl: string | undefined;
    let requestedMethod: string | undefined;
    let requestedBody: unknown;
    globalThis.fetch = mockFetch((input, init) => {
      requestedUrl = String(input);
      requestedMethod = init?.method;
      requestedBody =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      return jsonResponse(
        {
          record_id: "p57task",
          record_type: "task",
          title: "Capture Raycast quick note",
          content: "Make the capture flow fast.",
          tags: ["raycast", "capture"],
          status: "open",
          priority: "high",
        },
        { status: 201 },
      );
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(
      client.createRecord("task", {
        title: "Capture Raycast quick note",
        content: "Make the capture flow fast.",
        tags: ["raycast", "capture"],
        status: "open",
        priority: "high",
      }),
    ).resolves.toMatchObject({
      id: "p57task",
      recordType: "task",
      title: "Capture Raycast quick note",
      status: "open",
      priority: "high",
    });

    expect(requestedUrl).toBe("https://core-edge.example/records/task");
    expect(requestedMethod).toBe("POST");
    expect(requestedBody).toEqual({
      title: "Capture Raycast quick note",
      content: "Make the capture flow fast.",
      tags: ["raycast", "capture"],
      status: "open",
      priority: "high",
    });
  });

  test("normalizes minimal person create responses with submitted fields", async () => {
    let requestedBody: unknown;
    globalThis.fetch = mockFetch((input, init) => {
      expect(String(input)).toBe("https://core-edge.example/records/person");
      requestedBody =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      return jsonResponse(
        {
          record_id: "ns57person",
          record_type: "person",
          namespace_slug: "default",
        },
        { status: 201 },
      );
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(
      client.createRecord("person", {
        title: "Jane Example",
        content: "Useful context.",
        tags: ["leader"],
        role_title: "Founder",
      }),
    ).resolves.toMatchObject({
      id: "ns57person",
      recordType: "person",
      title: "Jane Example",
      content: "Useful context.",
      tags: ["leader"],
    });

    expect(requestedBody).toEqual({
      title: "Jane Example",
      content: "Useful context.",
      tags: ["leader"],
      role_title: "Founder",
    });
  });

  test("creates typed links through the operational link endpoint", async () => {
    let requestedBody: unknown;
    globalThis.fetch = mockFetch((input, init) => {
      expect(String(input)).toBe("https://core-edge.example/links");
      expect(init?.method).toBe("POST");
      requestedBody =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      return jsonResponse(
        {
          id: "lnk57",
          from_type: "task",
          from_id: "p57task",
          from_title: "Follow up with client",
          to_type: "project",
          to_id: "nx7project",
          to_title: "Client Project",
          rel_type: "belongs_to",
        },
        { status: 201 },
      );
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(
      client.createLink({
        from_type: "task",
        from_id: "p57task",
        to_type: "project",
        to_id: "nx7project",
        rel_type: "belongs_to",
      }),
    ).resolves.toEqual({
      id: "lnk57",
      from: {
        id: "p57task",
        recordType: "task",
        title: "Follow up with client",
      },
      to: {
        id: "nx7project",
        recordType: "project",
        title: "Client Project",
      },
      relType: "belongs_to",
    });

    expect(requestedBody).toEqual({
      from_type: "task",
      from_id: "p57task",
      to_type: "project",
      to_id: "nx7project",
      rel_type: "belongs_to",
    });
  });

  test("captures a typed record and creates supported default links", async () => {
    const requests: Array<{ method?: string; url: string; body: unknown }> = [];
    globalThis.fetch = mockFetch((input, init) => {
      const body =
        typeof init?.body === "string" ? JSON.parse(init.body) : undefined;
      requests.push({ method: init?.method, url: String(input), body });

      if (String(input).endsWith("/records/note")) {
        return jsonResponse(
          {
            record_id: "nd57note",
            record_type: "note",
            title: "Captured context",
            tags: ["raycast"],
          },
          { status: 201 },
        );
      }

      if (body?.to_id === "nd7note") {
        return jsonResponse(
          {
            id: "lnk58",
            from_type: "note",
            from_id: "nd57note",
            from_title: "Captured context",
            to_type: "note",
            to_id: "nd7note",
            to_title: "Another note",
            rel_type: "references",
          },
          { status: 201 },
        );
      }

      return jsonResponse(
        {
          id: "lnk57",
          from_type: "note",
          from_id: "nd57note",
          from_title: "Captured context",
          to_type: "project",
          to_id: "nx7project",
          to_title: "Core Edge",
          rel_type: "has_context",
        },
        { status: 201 },
      );
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(
      client.captureRecord(
        "note",
        {
          title: "Captured context",
          tags: ["raycast"],
        },
        [
          { id: "nx7project", title: "Core Edge", recordType: "project" },
          { id: "nd7note", title: "Another note", recordType: "note" },
        ],
      ),
    ).resolves.toMatchObject({
      record: { id: "nd57note", recordType: "note" },
      links: [{ relType: "has_context" }],
      skippedLinks: [
        {
          reason: "unsupported operational link shape",
          target: { id: "nd7note", recordType: "note" },
        },
      ],
    });

    expect(requests).toEqual([
      {
        method: "POST",
        url: "https://core-edge.example/records/note",
        body: {
          title: "Captured context",
          tags: ["raycast"],
          source: "api",
        },
      },
      {
        method: "POST",
        url: "https://core-edge.example/links",
        body: {
          from_type: "note",
          from_id: "nd57note",
          to_type: "project",
          to_id: "nx7project",
          rel_type: "has_context",
        },
      },
    ]);
  });

  test("fetches what-next task items", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        namespace: "default",
        suggested_next_action: {
          action: "work_task",
          item: {
            task: {
              record_id: "p57task",
              record_type: "task",
              title: "Build What Next command",
              status: "open",
              priority: "high",
              due_at: 1760000000000,
            },
            blocked: false,
            project: {
              record_id: "nx7project",
              record_type: "project",
              title: "Core Edge",
            },
            assignees: [
              {
                record_id: "ns7person",
                record_type: "person",
                title: "Matt",
              },
            ],
            blockers: [],
          },
        },
        counts: {
          active: 12,
          matching: 1,
          actionable: 1,
          blocked: 0,
          returned: 1,
        },
        filters: {
          actionable: true,
        },
        items: [
          {
            task: {
              record_id: "p57task",
              record_type: "task",
              title: "Build What Next command",
              status: "open",
              priority: "high",
              due_at: 1760000000000,
            },
            blocked: false,
            project: {
              record_id: "nx7project",
              record_type: "project",
              title: "Core Edge",
            },
            assignee: {
              record_id: "ns7person",
              record_type: "person",
              title: "Matt",
            },
            assignees: [
              {
                record_id: "ns7person",
                record_type: "person",
                title: "Matt",
              },
            ],
            blockers: [],
          },
        ],
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.whatNext(10)).resolves.toEqual({
      namespace: "default",
      suggestedAction: "work_task",
      suggestedItem: {
        task: {
          id: "p57task",
          recordType: "task",
          title: "Build What Next command",
          tags: [],
          status: "open",
          priority: "high",
          due_at: 1760000000000,
        },
        blocked: false,
        blockers: [],
        project: {
          id: "nx7project",
          recordType: "project",
          title: "Core Edge",
        },
        assignees: [
          {
            id: "ns7person",
            recordType: "person",
            title: "Matt",
          },
        ],
      },
      counts: {
        active: 12,
        matching: 1,
        actionable: 1,
        blocked: 0,
        returned: 1,
      },
      filters: {
        actionable: true,
      },
      items: [
        {
          task: {
            id: "p57task",
            recordType: "task",
            title: "Build What Next command",
            tags: [],
            status: "open",
            priority: "high",
            due_at: 1760000000000,
          },
          blocked: false,
          blockers: [],
          project: {
            id: "nx7project",
            recordType: "project",
            title: "Core Edge",
          },
          assignee: {
            id: "ns7person",
            recordType: "person",
            title: "Matt",
          },
          assignees: [
            {
              id: "ns7person",
              recordType: "person",
              title: "Matt",
            },
          ],
        },
      ],
    });
    expect(requestedUrl).toBe("https://core-edge.example/what-next?limit=10");
  });

  test("fetches open-loop diagnostics by category", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        namespace: "default",
        limit: 50,
        counts: {
          hygiene: 1,
          blocked: 1,
          stale: 0,
          projects: 0,
          opportunities: 0,
          total: 2,
          returned: 2,
        },
        metadata: {
          stale_after_days: 14,
          generated_at: 1760000000000,
        },
        categories: {
          hygiene: [
            {
              record_id: "p57task",
              record_type: "task",
              title: "Connect task to project",
              status: "open",
              issue_type: "orphan_active_task",
              detail: "Active task has no task --[belongs_to]--> project link.",
              suggested_commands: ["core-edge link create p57task nx7project"],
              reasons: ["orphan_active_task"],
            },
          ],
          blocked: [
            {
              record_id: "nx7project",
              record_type: "project",
              title: "Core Edge",
              status: "active",
              issue_type: "no_active_child_tasks",
              detail: "Active project has no linked child tasks.",
            },
          ],
        },
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.openLoops(50)).resolves.toMatchObject({
      namespace: "default",
      counts: {
        hygiene: 1,
        blocked: 1,
        total: 2,
        returned: 2,
      },
      metadata: {
        stale_after_days: 14,
        generated_at: 1760000000000,
      },
      categories: {
        hygiene: [
          {
            id: "p57task",
            recordType: "task",
            title: "Connect task to project",
            status: "open",
            issueType: "orphan_active_task",
            detail: "Active task has no task --[belongs_to]--> project link.",
            suggestedCommands: ["core-edge link create p57task nx7project"],
            reasons: ["orphan_active_task"],
          },
        ],
        blocked: [
          {
            id: "nx7project",
            recordType: "project",
            title: "Core Edge",
            status: "active",
            issueType: "no_active_child_tasks",
            detail: "Active project has no linked child tasks.",
            suggestedCommands: [],
            reasons: [],
          },
        ],
      },
    });
    expect(requestedUrl).toBe("https://core-edge.example/open-loops?limit=50");
  });

  test("fetches agenda buckets", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        namespace: "default",
        view: "week",
        counts: {
          active: 4,
          matching: 1,
          week: 1,
          returned: 1,
        },
        metadata: {
          boundary_timezone: "Australia/Sydney",
          limit_per_bucket: 10,
        },
        buckets: {
          week: [
            {
              task: {
                record_id: "p57task",
                record_type: "task",
                title: "Prepare client review",
                status: "open",
                priority: "normal",
                due_at: 1760000000000,
              },
              bucket: "week",
              blocked: false,
              project: {
                record_id: "nx7project",
                record_type: "project",
                title: "Client Work",
              },
              assignees: [],
              blockers: [],
            },
          ],
        },
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.agenda("week", 10)).resolves.toMatchObject({
      namespace: "default",
      view: "week",
      counts: {
        active: 4,
        matching: 1,
        week: 1,
        returned: 1,
      },
      metadata: {
        boundary_timezone: "Australia/Sydney",
        limit_per_bucket: 10,
      },
      buckets: {
        week: [
          {
            bucket: "week",
            blocked: false,
            task: {
              id: "p57task",
              recordType: "task",
              title: "Prepare client review",
              status: "open",
              priority: "normal",
              due_at: 1760000000000,
            },
            project: {
              id: "nx7project",
              recordType: "project",
              title: "Client Work",
            },
          },
        ],
      },
    });
    expect(requestedUrl).toBe(
      "https://core-edge.example/agenda?view=week&limit=10",
    );
  });

  test("fetches recent changes", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        days: 7,
        total: 2,
        changes: [
          {
            record_id: "nx7project",
            record_type: "project",
            title: "Core Edge",
            operation: "record_updated",
            timestamp: 1760000000000,
            source: "typed_record",
          },
          {
            doc_id: "j57note",
            title: "Legacy note",
            operation: "edit",
            timestamp: 1759990000000,
            agent: "matt",
          },
        ],
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.recent(7, 10)).resolves.toEqual({
      days: 7,
      total: 2,
      items: [
        {
          id: "nx7project",
          recordType: "project",
          title: "Core Edge",
          operation: "record_updated",
          timestamp: 1760000000000,
          source: "typed_record",
        },
        {
          id: "j57note",
          recordType: "note",
          title: "Legacy note",
          operation: "edit",
          timestamp: 1759990000000,
          agent: "matt",
        },
      ],
    });
    expect(requestedUrl).toBe(
      "https://core-edge.example/recent?days=7&limit=10",
    );
  });

  test("fetches project context", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        project: {
          _id: "nx7project",
          title: "Core Edge",
          status: "active",
          tags: ["core-edge"],
          updated_at: 1760000000000,
        },
        tasks: [
          {
            record_id: "p57task",
            record_type: "task",
            title: "Build Project Context command",
            status: "open",
            priority: "high",
            assignees: [
              {
                record_id: "ns7person",
                record_type: "person",
                title: "Matt",
              },
            ],
          },
        ],
        context_notes: [
          {
            record_id: "nd57note",
            record_type: "note",
            title: "Core Edge plan",
            rel_type: "has_context",
            direction: "to_note",
          },
        ],
        blocked_tasks: [],
        blockers: [],
        counts_by_status: {
          open: 1,
        },
        task_count: 1,
        blocked_count: 0,
        suggested_next_action: {
          action: "work_task",
          task: {
            record_id: "p57task",
            record_type: "task",
            title: "Build Project Context command",
            status: "open",
            priority: "high",
          },
        },
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.projectContext("nx7project")).resolves.toMatchObject({
      project: {
        id: "nx7project",
        recordType: "project",
        title: "Core Edge",
        status: "active",
        tags: ["core-edge"],
        updated_at: 1760000000000,
      },
      tasks: [
        {
          id: "p57task",
          recordType: "task",
          title: "Build Project Context command",
          status: "open",
          priority: "high",
          assignees: [
            {
              id: "ns7person",
              recordType: "person",
              title: "Matt",
            },
          ],
        },
      ],
      contextNotes: [
        {
          id: "nd57note",
          recordType: "note",
          title: "Core Edge plan",
          relType: "has_context",
          direction: "to_note",
        },
      ],
      countsByStatus: {
        open: 1,
      },
      taskCount: 1,
      blockedCount: 0,
      suggestedAction: "work_task",
      suggestedTask: {
        id: "p57task",
        recordType: "task",
        title: "Build Project Context command",
      },
    });
    expect(requestedUrl).toBe(
      "https://core-edge.example/projects/nx7project/context",
    );
  });

  test("lists typed records by type", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        record_type: "project",
        records: [
          {
            record_id: "nx7project",
            record_type: "project",
            title: "Core Edge",
            status: "active",
            tags: ["core-edge"],
            updated_at: 1760000000000,
          },
          {
            record_id: "nh7opp",
            record_type: "opportunity",
            title: "Core Edge pilot",
            stage: "qualified",
            tags: ["core-edge"],
          },
        ],
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.listRecords("project", 20)).resolves.toEqual([
      {
        id: "nx7project",
        recordType: "project",
        title: "Core Edge",
        tags: ["core-edge"],
        status: "active",
        updated_at: 1760000000000,
      },
      {
        id: "nh7opp",
        recordType: "opportunity",
        title: "Core Edge pilot",
        tags: ["core-edge"],
        stage: "qualified",
      },
    ]);
    expect(requestedUrl).toBe(
      "https://core-edge.example/records?type=project&limit=20",
    );
  });

  test("fetches note metadata through a field-filtered read", async () => {
    let requestedUrl: string | undefined;
    globalThis.fetch = mockFetch((input) => {
      requestedUrl = String(input);
      return jsonResponse({
        id: "doc123",
        title: "Core Edge — Public Alpha Execution Spine",
        tags: ["core-edge", "execution"],
        status: "active",
        source: "manual",
        file_path: "projects/core-edge.md",
        updated_at: 1760000000000,
        word_count: 331,
      });
    });

    const client = new CoreEdgeClient({
      baseUrl: "https://core-edge.example",
      apiToken: "test-token",
      resultLimit: "10",
    });

    await expect(client.getNoteMetadata("doc123")).resolves.toEqual({
      id: "doc123",
      title: "Core Edge — Public Alpha Execution Spine",
      tags: ["core-edge", "execution"],
      status: "active",
      source: "manual",
      file_path: "projects/core-edge.md",
      updated_at: 1760000000000,
      word_count: 331,
    });
    expect(requestedUrl).toBe(
      "https://core-edge.example/note/doc123?fields=title%2Ctags%2Cstatus%2Csource%2Cfile_path%2Cupdated_at%2Cword_count",
    );
  });
});

function mockFetch(
  handler: (input: RequestInfo | URL, init?: RequestInit) => Response,
): typeof fetch {
  return ((input, init) =>
    Promise.resolve(handler(input, init))) as typeof fetch;
}

function jsonResponse(value: unknown, init?: ResponseInit): Response {
  return new Response(JSON.stringify(value), {
    status: init?.status ?? 200,
    headers: { "content-type": "application/json" },
  });
}
