import ResponseMessages from './messages';
import ResponseCodes from './codes';
import {
    BaseResponse,
    BuilderErrorOptions,
    BuilderSuccessOptions,
    BuilderValidationOptions,
} from './types';

class ResponseBuilder {
    static success({
        message = ResponseMessages.SUCCESS,
        data = [],
        responseCode = ResponseCodes.PAYLOAD.SUCCESS.toString(),
        ...extras
    }: BuilderSuccessOptions = {}): Readonly<BaseResponse> {
        return Object.freeze({
            responseCode,
            status: true,
            message,
            data,
            ...extras,
        });
    }

    static error({
        message = ResponseMessages.INTERNAL_ERROR,
        data = [],
        responseCode = ResponseCodes.PAYLOAD.INTERNAL_ERROR.toString(),
        ...extras
    }: BuilderErrorOptions = {}): Readonly<BaseResponse> {
        return Object.freeze({
            responseCode,
            status: false,
            message,
            data,
            ...extras,
        });
    }

    static validation({
        message = ResponseMessages.VALIDATION_ERROR,
        errors = [],
        responseCode = ResponseCodes.PAYLOAD.BAD_REQUEST.toString(),
        ...extras
    }: BuilderValidationOptions = {}): Readonly<BaseResponse> {
        return Object.freeze({
            responseCode,
            status: false,
            message,
            data: errors,
            ...extras,
        });
    }

    static forward(response: unknown): Readonly<unknown> {
        return Object.freeze(response);
    }
}

export default ResponseBuilder;
