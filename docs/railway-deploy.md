# Deploy en Railway

## 1. Crear proyecto

En Railway:

1. New Project
2. Deploy from GitHub repo
3. Selecciona `arubioba/OpenAI`

## 2. Configurar variables

En la sección **Variables**, agrega:

```env
HUBSPOT_ACCESS_TOKEN=tu_token_real_de_hubspot_private_app
PORT=3000
```

No pegues el token en GitHub.

## 3. Deploy

Railway leerá `railway.json` y ejecutará:

```bash
npm install && npm run build
npm start
```

## 4. Validar salud del servicio

Abre:

```txt
https://TU-APP.up.railway.app/health
```

Debe responder:

```json
{
  "status": "ok",
  "service": "freelan-hubspot-mcp"
}
```

## 5. Endpoint MCP

La URL MCP será:

```txt
https://TU-APP.up.railway.app/mcp
```

## 6. Primeras pruebas esperadas

Cuando conectes un cliente MCP, prueba la herramienta:

```txt
hubspot_get_token_info
```

Si responde con metadata del token, ya tenemos conexión válida con HubSpot.
