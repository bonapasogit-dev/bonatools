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
            data = [],
            message = ResponseMessages.SUCCESS,
            responseCode = ResponseCodes.PAYLOAD.SUCCESS.toString(),
            ...extras
        } = options;
        return res.status(ResponseCodes.SUCCESS).json(
            ResponseBuilder.success({
                message,
                data,
                responseCode,
                ...extras,
            }),
        );
    }

    static created(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            data = [],
            message = ResponseMessages.CREATED,
            responseCode = ResponseCodes.PAYLOAD.CREATED.toString(),
            ...extras
        } = options;
        return res.status(ResponseCodes.CREATED).json(
            ResponseBuilder.success({
                message,
                data,
                responseCode,
                ...extras,
            }),
        );
    }

    static notFound(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.NOT_FOUND,
            data = [],
            responseCode = ResponseCodes.PAYLOAD.NOT_FOUND.toString(),
            ...extras
        } = options;
        return res.status(ResponseCodes.NOT_FOUND).json(
            ResponseBuilder.error({
                message,
                data,
                responseCode,
                ...extras,
            }),
        );
    }

    static validationError(res: MinimalResponse, options: HandlerValidationOptions = {}): unknown {
        const {
            errors = [],
            message = ResponseMessages.VALIDATION_ERROR,
            responseCode = ResponseCodes.PAYLOAD.BAD_REQUEST.toString(),
            ...extras
        } = options;
        return res.status(ResponseCodes.BAD_REQUEST).json(
            ResponseBuilder.validation({
                message,
                errors,
                responseCode,
                ...extras,
            }),
        );
    }

    static unauthorized(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.UNAUTHORIZED,
            data = [],
            responseCode = ResponseCodes.PAYLOAD.UNAUTHORIZED.toString(),
            ...extras
        } = options;
        return res.status(ResponseCodes.UNAUTHORIZED).json(
            ResponseBuilder.error({
                message,
                data,
                responseCode,
                ...extras,
            }),
        );
    }

    static forbidden(res: MinimalResponse, options: HandlerBaseOptions = {}): unknown {
        const {
            message = ResponseMessages.FORBIDDEN,
            data = [],
            responseCode = ResponseCodes.PAYLOAD.FORBIDDEN.toString(),
            ...extras
        } = options;
        return res.status(ResponseCodes.FORBIDDEN).json(
            ResponseBuilder.error({
                message,
                data,
                responseCode,
                ...extras,
            }),
        );
    }

    static error(res: MinimalResponse, options: HandlerErrorOptions = {}): unknown {
        const {
            message = ResponseMessages.INTERNAL_ERROR,
            error = null,
            data = [],
            responseCode = ResponseCodes.PAYLOAD.INTERNAL_ERROR.toString(),
            ...extras
        } = options;

        if (error) {
            console.error(error);
        }
        return res.status(ResponseCodes.INTERNAL_ERROR).json(
            ResponseBuilder.error({
                message,
                data,
                responseCode,
                ...extras,
            }),
        );
    }

    static forward(res: MinimalResponse, options: HandlerForwardOptions): unknown {
        const { response, statusCode = 200 } = options;
        return res.status(statusCode).json(ResponseBuilder.forward(response));
    }
}

export default ResponseHandler;
