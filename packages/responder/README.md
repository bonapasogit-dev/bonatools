# @bonapasogit-dev/responder

Utility package for standardized API responses across Node.js services.

## Features

- ✅ Strict REST-friendly HTTP status behavior
- ✅ Unified response payload shape with `data`, `meta`, and `error`
- ✅ Express-style response handlers
- ✅ Auto-adapting middleware helpers (`status/json` and `code/send`)
- ✅ Consistent custom error payload object
- ✅ Validation error normalization
- ✅ TypeScript-first API

## Installation

```bash
npm install @bonapasogit-dev/responder
```

## Quick Start

```typescript
import responder = require('@bonapasogit-dev/responder');

const payload = responder.builder.success({
    message: 'User loaded',
    data: { id: 'u-1' },
    meta: { traceId: 'abc123-def456' },
});

console.log(payload);

// {
//   message: 'User loaded',
//   data: { id: 'u-1' },
//   meta: { traceId: 'abc123-def456' },
//   error: null
// }
```

## Response Schema

All responses follow the same root shape:

```json
{
    "message": "Success",
    "data": {},
    "meta": {},
    "error": null
}
```

Error responses:

```json
{
    "message": "Validation Error",
    "data": null,
    "meta": {},
    "error": {
        "code": "VALIDATION_FAILED",
        "message": "email is required",
        "details": [
            { "field": "email", "issue": "missing" }
        ],
        "traceId": "abc123-def456"
    }
}
```

You can place any client-facing error context inside `error` (for example `traceId`, `details`, `code`, provider-specific fields). Clients can simply check whether `error` is `null`.

## Middleware (Express/Fastify/Nest/Adonis)

### Express-style middleware

```typescript
import responderMiddleware from '@bonapasogit-dev/responder/middleware';

app.use(responderMiddleware());

app.get('/health', (_req, res) => {
    return res.success({
        message: 'Service ready',
        data: { uptime: process.uptime() },
    });
});
```

### Fastify-style reply decoration

```typescript
import responderMiddleware from '@bonapasogit-dev/responder/middleware';

fastify.addHook('preHandler', async (_request, reply) => {
    responderMiddleware.attach(reply);
});

fastify.get('/', async (_request, reply) => {
    return reply.success({ data: { ok: true } });
});
```

`@bonapasogit-dev/responder/middleware` auto-detects:

- `response.status(...).json(...)` (Express / Nest Express)
- `reply.code(...).send(...)` (Fastify / Nest Fastify)
- `response.status(...).send(...)` (Adonis-style)

HTTP statuses are strict and semantic: `201` for created, `400` for bad request/validation, `401`, `403`, `404`, `409`, and `500`.

## API

- `builder.success(options)`
- `builder.error(options)`
- `builder.validation(options)`
- `builder.forward(response)`
- `handler.success(res, options)`
- `handler.created(res, options)`
- `handler.noContent(res)`
- `handler.badRequest(res, options)`
- `handler.validationError(res, options)`
- `handler.notFound(res, options)`
- `handler.conflict(res, options)`
- `handler.unauthorized(res, options)`
- `handler.forbidden(res, options)`
- `handler.internalError(res, options)`
- `handler.error(res, options)`
- `handler.forward(res, options)`
- `middleware(options)`
- `middleware.attach(response, options)`
- `middleware.createMethods(response)`
- `normalizer.fromJoi(error)`
- `normalizer.fromExpressValidator(errors)`
- `normalizer.fromCustom(field, issue)`

## Development

```bash
npm run build
npm test
```

## License

MIT
