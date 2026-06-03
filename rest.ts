import express from "express";
import cors from "cors";

const PORT = process.env.PORT || 3000;
const HUBSPOT_ACCESS_TOKEN = process.env.HUBSPOT_ACCESS_TOKEN;
const DIAGNOSTIC_KEY = process.env.DIAGNOSTIC_KEY;
const HUBSPOT_BASE_URL = "https://api.hubapi.com";
const PUBLIC_BASE_URL = process.env.PUBLIC_BASE_URL || "https://openai-production-8d47.up.railway.app";

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
    return { ok: false, status: response.status, error: parsed };
  }

  return { ok: true, status: response.status, data: parsed };
}

function isAuthorized(req: express.Request) {
  return Boolean(DIAGNOSTIC_KEY) && req.query.key === DIAGNOSTIC_KEY;
}

function requireKey(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!DIAGNOSTIC_KEY) {
    return res.status(503).json({ ok: false, error: "DIAGNOSTIC_KEY is not configured." });
  }

  if (!isAuthorized(req)) {
    return res.status(401).json({ ok: false, error: "Unauthorized request." });
  }

  return next();
}

function sendResult(res: express.Response, result: HubSpotResult) {
  return res.status(result.ok ? 200 : result.status).json(result);
}

function safeTokenDiagnostics() {
  const token = HUBSPOT_ACCESS_TOKEN || "";
  return {
    tokenPresent: Boolean(token),
    tokenLength: token.length,
    tokenPrefix: token.slice(0, 7),
    startsWithPatNa: token.startsWith("pat-na"),
    hasWhitespace: /\s/.test(token),
    hasBearerPrefix: token.toLowerCase().startsWith("bearer ")
  };
}

async function searchContacts(query: string, limit: number) {
  return hubspotRequest("/crm/v3/objects/contacts/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit,
      properties: ["firstname", "lastname", "email", "phone", "company", "createdate", "lastmodifieddate"]
    })
  });
}

async function contactsMissingPhone(limit: number) {
  return hubspotRequest("/crm/v3/objects/contacts/search", {
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
}

async function searchDeals(query: string, limit: number) {
  return hubspotRequest("/crm/v3/objects/deals/search", {
    method: "POST",
    body: JSON.stringify({
      query,
      limit,
      properties: ["dealname", "amount", "dealstage", "pipeline", "hubspot_owner_id", "closedate", "createdate"]
    })
  });
}

async function listDealPipelines() {
  return hubspotRequest("/crm/v3/pipelines/deals");
}

async function listOwners(email: string | undefined, limit: number) {
  const query = email ? `?email=${encodeURIComponent(email)}&limit=${limit}` : `?limit=${limit}`;
  return hubspotRequest(`/crm/v3/owners${query}`);
}

function openApiSpec() {
  const keyParam = {
    name: "key",
    in: "query",
    required: true,
    schema: { type: "string" },
    description: "API key configured as DIAGNOSTIC_KEY in Railway."
  };

  return {
    openapi: "3.1.0",
    info: {
      title: "Freelan HubSpot AI Analyst API",
      version: "1.0.0",
      description: "Read-only API for analyzing HubSpot contacts, deals, owners and pipelines."
    },
    servers: [{ url: PUBLIC_BASE_URL }],
    paths: {
      "/api/health": {
        get: {
          operationId: "apiHealth",
          summary: "Check API health",
          responses: { "200": { description: "API health response" } }
        }
      },
      "/api/hubspot/env-check": {
        get: {
          operationId: "hubspotEnvCheck",
          summary: "Check safe HubSpot token diagnostics",
          parameters: [keyParam],
          responses: { "200": { description: "Safe token diagnostics" } }
        }
      },
      "/api/hubspot/contact-sample": {
        get: {
          operationId: "hubspotContactSample",
          summary: "Get one sample HubSpot contact",
          parameters: [keyParam],
          responses: { "200": { description: "Sample contact" } }
        }
      },
      "/api/contacts/search": {
        get: {
          operationId: "searchHubSpotContacts",
          summary: "Search HubSpot contacts by text",
          parameters: [
            keyParam,
            { name: "query", in: "query", required: true, schema: { type: "string" }, description: "Search text such as name, email or company." },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } }
          ],
          responses: { "200": { description: "Contact search results" } }
        }
      },
      "/api/contacts/missing-phone": {
        get: {
          operationId: "countContactsMissingPhone",
          summary: "Count and sample HubSpot contacts without phone number",
          parameters: [
            keyParam,
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 100 } }
          ],
          responses: { "200": { description: "Contacts missing phone result" } }
        }
      },
      "/api/deals/search": {
        get: {
          operationId: "searchHubSpotDeals",
          summary: "Search HubSpot deals by text",
          parameters: [
            keyParam,
            { name: "query", in: "query", required: true, schema: { type: "string" }, description: "Search text for deals." },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 50, default: 10 } }
          ],
          responses: { "200": { description: "Deal search results" } }
        }
      },
      "/api/pipelines/deals": {
        get: {
          operationId: "listHubSpotDealPipelines",
          summary: "List HubSpot deal pipelines and stages",
          parameters: [keyParam],
          responses: { "200": { description: "Deal pipelines" } }
        }
      },
      "/api/owners": {
        get: {
          operationId: "listHubSpotOwners",
          summary: "List or search HubSpot owners by email",
          parameters: [
            keyParam,
            { name: "email", in: "query", required: false, schema: { type: "string" } },
            { name: "limit", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 100, default: 50 } }
          ],
          responses: { "200": { description: "HubSpot owners" } }
        }
      }
    }
  };
}

const app = express();

app.use(cors());
app.use(express.json({ limit: "2mb" }));

app.get("/", (_req, res) => {
  res.json({
    ok: true,
    service: "freelan-hubspot-ai-analyst-api",
    repository: "https://github.com/arubioba/OpenAI",
    openapi: "/openapi.json",
    endpoints: [
      "/api/health",
      "/api/contacts/search",
      "/api/contacts/missing-phone",
      "/api/deals/search",
      "/api/pipelines/deals",
      "/api/owners"
    ]
  });
});

app.get("/health", (_req, res) => {
  res.json({ ok: true, status: "ok", service: "freelan-hubspot-ai-analyst-api" });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, status: "ok", service: "freelan-hubspot-ai-analyst-api" });
});

app.get("/openapi.json", (_req, res) => {
  res.json(openApiSpec());
});

app.get("/api/hubspot/env-check", requireKey, (req, res) => {
  res.json({ ok: true, diagnostics: safeTokenDiagnostics() });
});

app.get("/api/hubspot/contact-sample", requireKey, async (_req, res) => {
  return sendResult(res, await hubspotRequest("/crm/v3/objects/contacts?limit=1&properties=firstname,lastname,email,phone,company"));
});

app.get("/api/contacts/search", requireKey, async (req, res) => {
  const query = String(req.query.query || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);

  if (!query) return res.status(400).json({ ok: false, error: "Missing query parameter." });
  return sendResult(res, await searchContacts(query, limit));
});

app.get("/api/contacts/missing-phone", requireKey, async (req, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 100);
  return sendResult(res, await contactsMissingPhone(limit));
});

app.get("/api/deals/search", requireKey, async (req, res) => {
  const query = String(req.query.query || "").trim();
  const limit = Math.min(Math.max(Number(req.query.limit || 10), 1), 50);

  if (!query) return res.status(400).json({ ok: false, error: "Missing query parameter." });
  return sendResult(res, await searchDeals(query, limit));
});

app.get("/api/pipelines/deals", requireKey, async (_req, res) => {
  return sendResult(res, await listDealPipelines());
});

app.get("/api/owners", requireKey, async (req, res) => {
  const email = typeof req.query.email === "string" ? req.query.email : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit || 50), 1), 100);
  return sendResult(res, await listOwners(email, limit));
});

app.listen(PORT, () => {
  console.log(`Freelan HubSpot AI Analyst API running on port ${PORT}`);
});
