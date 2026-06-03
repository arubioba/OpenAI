# Freelan HubSpot MCP Server

Servidor MCP para conectar un asistente compatible con MCP con HubSpot usando una HubSpot Private App.

Repositorio: https://github.com/arubioba/OpenAI

## Arquitectura

```txt
ChatGPT / MCP Client -> Railway -> MCP Server -> HubSpot Private App Token -> HubSpot CRM
```

## Endpoints

- `GET /` - información básica del servicio.
- `GET /health` - health check para Railway.
- `POST /mcp` - endpoint MCP Streamable HTTP.

## Herramientas MCP incluidas

- `hubspot_get_token_info` - valida el token y devuelve metadata, incluyendo Hub ID y scopes.
- `hubspot_search_contacts` - busca contactos por nombre, email o empresa.
- `hubspot_count_contacts_missing_phone` - cuenta contactos sin teléfono.
- `hubspot_search_deals` - busca deals por texto.
- `hubspot_list_deal_pipelines` - lista pipelines y etapas de deals.
- `hubspot_search_owners` - lista o busca owners.

## Variables de entorno

En Railway configura:

```env
HUBSPOT_ACCESS_TOKEN=pat-na1-xxxxxxxxxxxxxxxx
PORT=3000
```

Nunca subas tu token real a GitHub.

## Desarrollo local

```bash
npm install
$env:HUBSPOT_ACCESS_TOKEN="TU_TOKEN_REAL"  # PowerShell
npm run dev
```

En Mac/Linux:

```bash
export HUBSPOT_ACCESS_TOKEN="TU_TOKEN_REAL"
npm run dev
```

Prueba:

```txt
http://localhost:3000/health
```

## Deploy en Railway

1. Crear nuevo proyecto en Railway.
2. Elegir **Deploy from GitHub repo**.
3. Seleccionar `arubioba/OpenAI`.
4. Agregar variable `HUBSPOT_ACCESS_TOKEN`.
5. Railway debe ejecutar:

```bash
npm install
npm run build
npm start
```

6. Probar:

```txt
https://TU-APP.up.railway.app/health
```

7. Endpoint MCP:

```txt
https://TU-APP.up.railway.app/mcp
```

## Seguridad

Este MVP es de solo lectura. No incluye creación ni actualización de contactos, deals o compañías.

Recomendaciones futuras:

- Agregar autenticación propia al MCP Server.
- Migrar de Private App Token a OAuth si se convierte en producto multi-cliente.
- Agregar logging controlado sin exponer datos sensibles.
- Agregar rate limits y allowlist de clientes.
