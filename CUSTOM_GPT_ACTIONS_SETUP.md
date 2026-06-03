# Custom GPT Actions Setup

## 1. Add this file to GitHub

Create this file in your repository:

```txt
src/rest.ts
```

Paste the contents from `rest.ts`.

## 2. Update package.json

Change the scripts section to use `src/rest.ts`:

```json
"scripts": {
  "dev": "tsx src/rest.ts",
  "build": "tsc",
  "start": "node dist/rest.js"
}
```

## 3. Railway variables

Keep these variables in Railway:

```env
HUBSPOT_ACCESS_TOKEN=your_hubspot_private_app_token
DIAGNOSTIC_KEY=FreelanTest2026
PUBLIC_BASE_URL=https://openai-production-8d47.up.railway.app
```

## 4. Test endpoints after redeploy

```txt
https://openai-production-8d47.up.railway.app/api/health
https://openai-production-8d47.up.railway.app/api/hubspot/contact-sample?key=FreelanTest2026
https://openai-production-8d47.up.railway.app/api/contacts/missing-phone?key=FreelanTest2026
https://openai-production-8d47.up.railway.app/openapi.json
```

## 5. Custom GPT Actions

In your Custom GPT:

1. Configure
2. Actions
3. Create new action
4. Import from URL:
   `https://openai-production-8d47.up.railway.app/openapi.json`

Because this MVP uses `key` as a query parameter, each action call must include:

```txt
key=FreelanTest2026
```

Later, migrate to a header-based API key for stronger security.
