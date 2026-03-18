import ResponseBuilder from './builder';
import ResponseCodes from './codes';
import ResponseMessages from './messages';
import {
    HandlerBaseOptions,
    HandlerErrorOptions,
    HandlerForwardOptions,
    HandlerValidationOptions,
    MiddlewareAttachOptions,
    MiddlewareNext,
    MiddlewareRequestLike,
    MiddlewareResponseLike,
    ResponderMethods,
} from './types';

function withStatus(response: MiddlewareResponseLike, statusCode: number): MiddlewareResponseLike {
    if (typeof response.status === 'function') {
        const nextResponse = response.status(statusCode);
        if (nextResponse && typeof nextResponse === 'object') {
            return nextResponse as MiddlewareResponseLike;
        }
        return response;
    }

    if (typeof response.code === 'function') {
        const nextResponse = response.code(statusCode);
        if (nextResponse && typeof nextResponse === 'object') {
            return nextResponse as MiddlewareResponseLike;
        }
        return response;
    }

    throw new Error('Responder middleware requires response.status() or response.code()');
}

function sendPayload(response: MiddlewareResponseLike, payload: unknown): unknown {
    if (typeof response.json === 'function') {
        return response.json(payload);
    }

    if (typeof response.send === 'function') {
        return response.send(payload);
    }

    throw new Error('Responder middleware requires response.json() or response.send()');
}

function respond(response: MiddlewareResponseLike, statusCode: number, payload: unknown): unknown {
    const withUpdatedStatus = withStatus(response, statusCode);
    return sendPayload(withUpdatedStatus, payload);
}

function respondNoContent(response: MiddlewareResponseLike): unknown {
    const withUpdatedStatus = withStatus(response, ResponseCodes.NO_CONTENT);

    if (typeof withUpdatedStatus.end === 'function') {
        return withUpdatedStatus.end();
    }

    if (typeof withUpdatedStatus.send === 'function') {
        return withUpdatedStatus.send();
    }

    return sendPayload(
        withUpdatedStatus,
        ResponseBuilder.success({
            message: ResponseMessages.NO_CONTENT,
            data: null,
        }),
    );
}

function createResponderMethods(response: MiddlewareResponseLike): ResponderMethods {
    return {
        success(options: HandlerBaseOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.SUCCESS,
                meta = {},
            } = options;

            return respond(
                response,
                ResponseCodes.SUCCESS,
                ResponseBuilder.success({ message, data, meta }),
            );
        },

        created(options: HandlerBaseOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.CREATED,
                meta = {},
            } = options;

            return respond(
                response,
                ResponseCodes.CREATED,
                ResponseBuilder.success({ message, data, meta }),
            );
        },

        noContent(): unknown {
            return respondNoContent(response);
        },

        badRequest(options: HandlerValidationOptions = {}): unknown {
            const {
                message = ResponseMessages.BAD_REQUEST,
                code = 'BAD_REQUEST',
                data = null,
                details = [],
                traceId,
                meta = {},
                error = {},
            } = options;

            return respond(
                response,
                ResponseCodes.BAD_REQUEST,
                ResponseBuilder.error({
                    message,
                    code,
                    data,
                    details,
                    traceId,
                    meta,
                    error,
                }),
            );
        },

        notFound(options: HandlerBaseOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.NOT_FOUND,
                meta = {},
            } = options;

            return respond(
                response,
                ResponseCodes.NOT_FOUND,
                ResponseBuilder.error({
                    message,
                    code: 'NOT_FOUND',
                    data,
                    meta,
                }),
            );
        },

        conflict(options: HandlerBaseOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.CONFLICT,
                meta = {},
            } = options;

            return respond(
                response,
                ResponseCodes.CONFLICT,
                ResponseBuilder.error({
                    message,
                    code: 'CONFLICT',
                    data,
                    meta,
                }),
            );
        },

        validationError(options: HandlerValidationOptions = {}): unknown {
            const {
                details = [],
                message = ResponseMessages.VALIDATION_ERROR,
                code = 'VALIDATION_FAILED',
                data = null,
                traceId,
                meta = {},
                error = {},
            } = options;

            return respond(
                response,
                ResponseCodes.BAD_REQUEST,
                ResponseBuilder.validation({
                    message,
                    code,
                    data,
                    details,
                    traceId,
                    meta,
                    error,
                }),
            );
        },

        unauthorized(options: HandlerBaseOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.UNAUTHORIZED,
                meta = {},
            } = options;

            return respond(
                response,
                ResponseCodes.UNAUTHORIZED,
                ResponseBuilder.error({
                    message,
                    code: 'UNAUTHORIZED',
                    data,
                    meta,
                }),
            );
        },

        forbidden(options: HandlerBaseOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.FORBIDDEN,
                meta = {},
            } = options;

            return respond(
                response,
                ResponseCodes.FORBIDDEN,
                ResponseBuilder.error({
                    message,
                    code: 'FORBIDDEN',
                    data,
                    meta,
                }),
            );
        },

        internalError(options: HandlerErrorOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.INTERNAL_ERROR,
                code = 'INTERNAL_ERROR',
                error = null,
                details = [],
                traceId,
                meta = {},
                errorPayload = {},
            } = options;

            if (error) {
                console.error(error);
            }

            return respond(
                response,
                ResponseCodes.INTERNAL_ERROR,
                ResponseBuilder.error({
                    message,
                    code,
                    data,
                    details,
                    traceId,
                    meta,
                    error: errorPayload,
                }),
            );
        },

        error(options: HandlerErrorOptions = {}): unknown {
            const {
                data = null,
                message = ResponseMessages.INTERNAL_ERROR,
                code = 'INTERNAL_ERROR',
                error = null,
                details = [],
                traceId,
                meta = {},
                errorPayload = {},
            } = options;

            if (error) {
                console.error(error);
            }

            return respond(
                response,
                ResponseCodes.INTERNAL_ERROR,
                ResponseBuilder.error({
                    message,
                    code,
                    data,
                    details,
                    traceId,
                    meta,
                    error: errorPayload,
                }),
            );
        },

        forward(options: HandlerForwardOptions): unknown {
            const { response: payload, statusCode = ResponseCodes.SUCCESS } = options;
            return respond(response, statusCode, ResponseBuilder.forward(payload));
        },
    };
}

function attachResponder(
    response: MiddlewareResponseLike,
    options: MiddlewareAttachOptions = {},
): MiddlewareResponseLike {
    const { overwrite = false } = options;
    const methods = createResponderMethods(response);
    const methodNames = Object.keys(methods) as Array<keyof ResponderMethods>;

    for (const methodName of methodNames) {
        if (!overwrite && typeof response[methodName as string] !== 'undefined') {
            continue;
        }

        response[methodName as string] = methods[methodName];
    }

    return response;
}

function responderMiddleware(options: MiddlewareAttachOptions = {}) {
    return (
        _request: MiddlewareRequestLike,
        response: MiddlewareResponseLike,
        next?: MiddlewareNext,
    ): unknown => {
        attachResponder(response, options);

        if (typeof next === 'function') {
            return next();
        }

        return undefined;
    };
}

const middleware = Object.assign(responderMiddleware, {
    attach: attachResponder,
    createMethods: createResponderMethods,
});

export = middleware;
