# @bonapasogit-dev/responder

Utility package for standardized API responses across Node.js services.

## Features

- ✅ Unified response payload shape
- ✅ Express-style response handlers
- ✅ Auto-adapting middleware helpers (`status/json` and `code/send`)
- ✅ Semantic `responseCode` values (`200`, `201`, `404`, ...)
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
    data: [{ id: 'u-1' }],
});

console.log(payload);
```

## Middleware (Express/Fastify/Nest/Adonis)

### Express-style middleware

```typescript
import responderMiddleware from '@bonapasogit-dev/responder/middleware';

app.use(responderMiddleware());

app.get('/health', (_req, res) => {
    return res.success({
        message: 'Service ready',
        data: [{ uptime: process.uptime() }],
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
    return reply.success({ data: [{ ok: true }] });
});
```

`@bonapasogit-dev/responder/middleware` auto-detects:

- `response.status(...).json(...)` (Express / Nest Express)
- `reply.code(...).send(...)` (Fastify / Nest Fastify)
- `response.status(...).send(...)` (Adonis-style)

`responseCode` inside payload is semantic (e.g. `201` for created) even if your current transport policy returns `200` for non-error responses.

## API

- `builder.success(options)`
- `builder.error(options)`
- `builder.validation(options)`
- `builder.forward(response)`
- `handler.success(res, options)`
- `handler.created(res, options)`
- `handler.validationError(res, options)`
- `handler.notFound(res, options)`
- `handler.unauthorized(res, options)`
- `handler.forbidden(res, options)`
- `handler.error(res, options)`
- `handler.forward(res, options)`
- `middleware(options)`
- `middleware.attach(response, options)`
- `middleware.createMethods(response)`
- `normalizer.fromJoi(error)`
- `normalizer.fromExpressValidator(errors)`
- `normalizer.fromCustom(field, error)`

## Development

```bash
npm run build
npm test
```

## License

MIT
