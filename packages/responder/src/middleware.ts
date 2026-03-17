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

function createResponderMethods(response: MiddlewareResponseLike): ResponderMethods {
    return {
        success(options: HandlerBaseOptions = {}): unknown {
            const {
                data = [],
                message = ResponseMessages.SUCCESS,
                responseCode = ResponseCodes.PAYLOAD.SUCCESS.toString(),
                ...extras
            } = options;

            return respond(
                response,
                ResponseCodes.SUCCESS,
                ResponseBuilder.success({ message, data, responseCode, ...extras }),
            );
        },

        created(options: HandlerBaseOptions = {}): unknown {
            const {
                data = [],
                message = ResponseMessages.CREATED,
                responseCode = ResponseCodes.PAYLOAD.CREATED.toString(),
                ...extras
            } = options;

            return respond(
                response,
                ResponseCodes.CREATED,
                ResponseBuilder.success({ message, data, responseCode, ...extras }),
            );
        },

        notFound(options: HandlerBaseOptions = {}): unknown {
            const {
                data = [],
                message = ResponseMessages.NOT_FOUND,
                responseCode = ResponseCodes.PAYLOAD.NOT_FOUND.toString(),
                ...extras
            } = options;

            return respond(
                response,
                ResponseCodes.NOT_FOUND,
                ResponseBuilder.error({ message, data, responseCode, ...extras }),
            );
        },

        validationError(options: HandlerValidationOptions = {}): unknown {
            const {
                errors = [],
                message = ResponseMessages.VALIDATION_ERROR,
                responseCode = ResponseCodes.PAYLOAD.BAD_REQUEST.toString(),
                ...extras
            } = options;

            return respond(
                response,
                ResponseCodes.BAD_REQUEST,
                ResponseBuilder.validation({ message, errors, responseCode, ...extras }),
            );
        },

        unauthorized(options: HandlerBaseOptions = {}): unknown {
            const {
                data = [],
                message = ResponseMessages.UNAUTHORIZED,
                responseCode = ResponseCodes.PAYLOAD.UNAUTHORIZED.toString(),
                ...extras
            } = options;

            return respond(
                response,
                ResponseCodes.UNAUTHORIZED,
                ResponseBuilder.error({ message, data, responseCode, ...extras }),
            );
        },

        forbidden(options: HandlerBaseOptions = {}): unknown {
            const {
                data = [],
                message = ResponseMessages.FORBIDDEN,
                responseCode = ResponseCodes.PAYLOAD.FORBIDDEN.toString(),
                ...extras
            } = options;

            return respond(
                response,
                ResponseCodes.FORBIDDEN,
                ResponseBuilder.error({ message, data, responseCode, ...extras }),
            );
        },

        error(options: HandlerErrorOptions = {}): unknown {
            const {
                data = [],
                message = ResponseMessages.INTERNAL_ERROR,
                error = null,
                responseCode = ResponseCodes.PAYLOAD.INTERNAL_ERROR.toString(),
                ...extras
            } = options;

            if (error) {
                console.error(error);
            }

            return respond(
                response,
                ResponseCodes.INTERNAL_ERROR,
                ResponseBuilder.error({ message, data, responseCode, ...extras }),
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
