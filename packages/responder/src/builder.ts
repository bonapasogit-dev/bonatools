import ResponseMessages from './messages';
import {
    ApiResponse,
    BuilderErrorOptions,
    BuilderSuccessOptions,
    BuilderValidationOptions,
} from './types';

class ResponseBuilder {
    static success({
        message = ResponseMessages.SUCCESS,
        data = null,
        meta = {},
    }: BuilderSuccessOptions = {}): Readonly<ApiResponse> {
        return Object.freeze({
            message,
            data,
            meta,
            error: null,
        });
    }

    static error({
        message = ResponseMessages.INTERNAL_ERROR,
        code = 'INTERNAL_ERROR',
        data = null,
        details = [],
        traceId,
        meta = {},
        error = {},
    }: BuilderErrorOptions = {}): Readonly<ApiResponse> {
        return Object.freeze({
            message,
            data,
            meta,
            error: {
                ...error,
                code,
                message,
                details,
                ...(typeof traceId === 'string' ? { traceId } : {}),
            },
        });
    }

    static validation({
        message = ResponseMessages.VALIDATION_ERROR,
        code = 'VALIDATION_FAILED',
        data = null,
        details = [],
        traceId,
        meta = {},
        error = {},
    }: BuilderValidationOptions = {}): Readonly<ApiResponse> {
        return ResponseBuilder.error({
            message,
            code,
            data,
            details,
            traceId,
            meta,
            error,
        });
    }

    static forward(response: unknown): Readonly<unknown> {
        return Object.freeze(response);
    }
}

export default ResponseBuilder;
