import { describe, expect, it, vi } from 'vitest';

import ResponseBuilder from '../src/builder';
import ResponseHandler from '../src/handler';
import ErrorNormalizer from '../src/normalizer';
import ResponseCodes from '../src/codes';
import ResponseMiddleware from '../src/middleware';
import { MiddlewareResponseLike, ResponderMethods } from '../src/types';

describe('ResponseBuilder', () => {
    it('builds success response', () => {
        const payload = ResponseBuilder.success({
            message: 'ok',
            data: [{ id: 1 }],
            traceId: 't-1',
        });

        expect(payload.status).toBe(true);
        expect(payload.message).toBe('ok');
        expect(payload.responseCode).toBe(ResponseCodes.PAYLOAD.SUCCESS.toString());
        expect(payload).toMatchObject({ traceId: 't-1' });
    });

    it('builds validation response', () => {
        const payload = ResponseBuilder.validation({
            errors: [{ field: 'name', error: 'required' }],
        });

        expect(payload.status).toBe(false);
        expect(payload.data).toEqual([{ field: 'name', error: 'required' }]);
    });
});

describe('ResponseHandler', () => {
    function createMockRes() {
        return {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnValue('done'),
        };
    }

    it('uses success status and payload', () => {
        const res = createMockRes();
        const result = ResponseHandler.success(res, { data: [{ ok: true }] });

        expect(res.status).toHaveBeenCalledWith(ResponseCodes.SUCCESS);
        expect(res.json).toHaveBeenCalledTimes(1);
        expect(result).toBe('done');
    });

    it('logs error and returns internal error payload', () => {
        const res = createMockRes();
        const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

        ResponseHandler.error(res, { error: new Error('boom') });

        expect(consoleSpy).toHaveBeenCalledTimes(1);
        expect(res.status).toHaveBeenCalledWith(ResponseCodes.INTERNAL_ERROR);
        consoleSpy.mockRestore();
    });
});

describe('ErrorNormalizer', () => {
    it('normalizes joi error details', () => {
        const result = ErrorNormalizer.fromJoi({
            details: [{ path: ['user', 'name'], message: '"name" is required' }],
        });

        expect(result).toEqual([{ field: 'user.name', error: 'name is required' }]);
    });

    it('normalizes express-validator errors', () => {
        const result = ErrorNormalizer.fromExpressValidator([
            { param: 'email', msg: 'invalid email' },
        ]);

        expect(result).toEqual([{ field: 'email', error: 'invalid email' }]);
    });
});

describe('ResponseMiddleware', () => {
    it('attaches helpers to express-like response object', () => {
        const res: MiddlewareResponseLike & Partial<ResponderMethods> = {
            status: vi.fn().mockReturnThis(),
            json: vi.fn().mockReturnValue('ok'),
        };
        const next = vi.fn();
        const middleware = ResponseMiddleware();

        middleware({}, res, next);

        expect(next).toHaveBeenCalledTimes(1);
        expect(typeof res.success).toBe('function');

        const result = res.success?.({
            data: [{ id: 'a' }],
        });

        expect(result).toBe('ok');
        expect(res.status).toHaveBeenCalledWith(ResponseCodes.SUCCESS);
        expect(res.json).toHaveBeenCalledTimes(1);
    });

    it('supports fastify-like response object with code/send', () => {
        const reply: MiddlewareResponseLike & Partial<ResponderMethods> = {
            code: vi.fn().mockReturnThis(),
            send: vi.fn().mockReturnValue('sent'),
        };

        ResponseMiddleware.attach(reply);

        expect(typeof reply.notFound).toBe('function');

        const result = reply.notFound?.({
            message: 'missing',
        });

        expect(result).toBe('sent');
        expect(reply.code).toHaveBeenCalledWith(ResponseCodes.NOT_FOUND);
        expect(reply.send).toHaveBeenCalledTimes(1);
    });
});
