import express from "express";
import cors from "cors";
import { z } from "zod";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

const PORT = process.env.PORT || 3000;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const HUBSPOT_BASE_URL = "https://api.hubapi.com";

if (!HUBSPOT_ACCESS_TOKEN) {
  console.error("Missing HUBSPOT_ACCESS_TOKEN environment variable.");
  process.exit(1);
}

type HubSpotResult = {
  ok: boolean;
  status: number;
  data?: unknown;
  error?: unknown;
};

async function hubspotRequest(path: string, options: RequestInit = {}): Promise<HubSpotResult> {
  const response = await fetch(`${HUBSPOT_BASE_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${HUBSPOT_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const text = await response.text();

  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    parsed = { raw: text };
  }

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      error: parsed
    };
  }

  return {
    ok: true,
    status: response.status,
    data: parsed
  };
}

function asText(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(data, null, 2)
      }
    ]
  };
}

function createMcpServer() {
  const server = new McpServer({
    name: "freelan-hubspot-mcp",
    version: "1.0.0"
  });

  server.tool(
    "hubspot_get_token_info",
    "Validate the HubSpot Private App token and return token metadata such as Hub ID, app ID, user ID and scopes.",
    {},
    async () => {
      const result = await hubspotRequest("/oauth/v2/private-apps/get/access-token-info", {
        method: "POST",
        body: JSON.stringify({
          tokenKey: HUBSPOT_ACCESS_TOKEN
        })
      });

      return asText(result);
    }
  );

  server.tool(
    "hubspot_search_contacts",
    "Search HubSpot contacts by text query. Returns contact id, name, email, phone, company and timestamps.",
    {
      query: z.string().describe("Search text, for example name, email or company."),
      limit: z.number().min(1).max(50).default(10)
    },
    async ({ query, limit }) => {
      const result = await hubspotRequest("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit,
          properties: ["firstname", "lastname", "email", "phone", "company", "createdate", "lastmodifieddate"]
        })
      });

      return asText(result);
    }
  );

  server.tool(
    "hubspot_count_contacts_missing_phone",
    "Count HubSpot contacts that do not have a phone number. Returns HubSpot total and a sample of records.",
    {
      limit: z.number().min(1).max(100).default(100)
    },
    async ({ limit }) => {
      const result = await hubspotRequest("/crm/v3/objects/contacts/search", {
        method: "POST",
        body: JSON.stringify({
          limit,
          properties: ["firstname", "lastname", "email", "phone"],
          filterGroups: [
            {
              filters: [
                {
                  propertyName: "phone",
                  operator: "NOT_HAS_PROPERTY"
                }
              ]
            }
          ]
        })
      });

      return asText(result);
    }
  );

  server.tool(
    "hubspot_search_deals",
    "Search HubSpot deals by text query. Returns deal id, name, amount, stage, pipeline, owner and close date.",
    {
      query: z.string().describe("Search text for deals."),
      limit: z.number().min(1).max(50).default(10)
    },
    async ({ query, limit }) => {
      const result = await hubspotRequest("/crm/v3/objects/deals/search", {
        method: "POST",
        body: JSON.stringify({
          query,
          limit,
          properties: [
            "dealname",
            "amount",
            "dealstage",
            "pipeline",
            "hubspot_owner_id",
            "closedate",
            "createdate"
          ]
        })
      });

      return asText(result);
    }
  );

  server.tool(
    "hubspot_list_deal_pipelines",
    "List HubSpot deal pipelines and their stages.",
    {},
    async () => {
      const result = await hubspotRequest("/crm/v3/pipelines/deals");
      return asText(result);
    }
  );

  server.tool(
    "hubspot_search_owners",
    "List or search HubSpot owners by email.",
    {
      email: z.string().optional().describe("Optional owner email to filter by."),
      limit: z.number().min(1).max(100).default(50)
    },
    async ({ email, limit }) => {
      const query = email ? `?email=${encodeURIComponent(email)}&limit=${limit}` : `?limit=${limit}`;
      const result = await hubspotRequest(`/crm/v3/owners${query}`);
      return asText(result);
    }
  );

  return server;
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "freelan-hubspot-mcp",
    repository: "https://github.com/arubioba/OpenAI",
    endpoints: ["/health", "/mcp"]
  });
});

app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "freelan-hubspot-mcp"
  });
});

app.all("/mcp", async (req, res) => {
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined
  });

  res.on("close", () => {
    transport.close();
    server.close();
  });

  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
});

app.listen(PORT, () => {
  console.log(`Freelan HubSpot MCP Server running on port ${PORT}`);
});
