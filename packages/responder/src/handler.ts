import ResponseCodes from './codes';
import ResponseMessages from './messages';
import ResponseBuilder from './builder';
import {
    HandlerBaseOptions,
    HandlerErrorOptions,
    HandlerForwardOptions,
    HandlerValidationOptions,
    MinimalResponse,
} from './types';

class ResponseHandler {
    static success(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            data = null,
            message = ResponseMessages.SUCCESS,
            meta = {},
        } = options;

        return res.status(ResponseCodes.SUCCESS).json(
            ResponseBuilder.success({
                message,
                data,
                meta,
            }),
        );
    }

    static created(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            data = null,
            message = ResponseMessages.CREATED,
            meta = {},
        } = options;

        return res.status(ResponseCodes.CREATED).json(
            ResponseBuilder.success({
                message,
                data,
                meta,
            }),
        );
    }

    static noContent(res: MinimalResponse): unknown {
        const response = res.status(ResponseCodes.NO_CONTENT);

        if (typeof response.end === 'function') {
            return response.end();
        }

        if (typeof response.send === 'function') {
            return response.send();
        }

        return response.json(
            ResponseBuilder.success({
                message: ResponseMessages.NO_CONTENT,
                data: null,
            }),
        );
    }

    static badRequest(res: MinimalResponse, options: HandlerValidationOptions = {}): unknown {
        const {
            message = ResponseMessages.BAD_REQUEST,
            code = 'BAD_REQUEST',
            data = null,
            details = [],
            traceId,
            meta = {},
            error = {},
        } = options;

        return res.status(ResponseCodes.BAD_REQUEST).json(
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
    }

    static notFound(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.NOT_FOUND,
            data = null,
            meta = {},
        } = options;

        return res.status(ResponseCodes.NOT_FOUND).json(
            ResponseBuilder.error({
                message,
                code: 'NOT_FOUND',
                data,
                meta,
            }),
        );
    }

    static conflict(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.CONFLICT,
            data = null,
            meta = {},
        } = options;

        return res.status(ResponseCodes.CONFLICT).json(
            ResponseBuilder.error({
                message,
                code: 'CONFLICT',
                data,
                meta,
            }),
        );
    }

    static validationError(res: MinimalResponse, options: HandlerValidationOptions = {}): unknown {
        const {
            details = [],
            message = ResponseMessages.VALIDATION_ERROR,
            code = 'VALIDATION_FAILED',
            data = null,
            traceId,
            meta = {},
            error = {},
        } = options;

        return res.status(ResponseCodes.BAD_REQUEST).json(
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
    }

    static unauthorized(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.UNAUTHORIZED,
            data = null,
            meta = {},
        } = options;

        return res.status(ResponseCodes.UNAUTHORIZED).json(
            ResponseBuilder.error({
                message,
                code: 'UNAUTHORIZED',
                data,
                meta,
            }),
        );
    }

    static forbidden(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.FORBIDDEN,
            data = null,
            meta = {},
        } = options;

        return res.status(ResponseCodes.FORBIDDEN).json(
            ResponseBuilder.error({
                message,
                code: 'FORBIDDEN',
                data,
                meta,
            }),
        );
    }

    static internalError(res: MinimalResponse, options: HandlerErrorOptions = {}): unknown {
        return ResponseHandler.error(res, options);
    }

    static error(res: MinimalResponse, options: HandlerErrorOptions = {}): unknown {
        const {
            message = ResponseMessages.INTERNAL_ERROR,
            code = 'INTERNAL_ERROR',
            error = null,
            data = null,
            details = [],
            traceId,
            meta = {},
            errorPayload = {},
        } = options;

        if (error) {
            console.error(error);
        }

        return res.status(ResponseCodes.INTERNAL_ERROR).json(
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
    }

    static forward(res: MinimalResponse, options: HandlerForwardOptions): unknown {
        const { response, statusCode = 200 } = options;
        return res.status(statusCode).json(ResponseBuilder.forward(response));
    }
}

export default ResponseHandler;
