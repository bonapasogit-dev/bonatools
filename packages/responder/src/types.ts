export type ResponseData = unknown[];

export interface BaseResponse {
    responseCode: string;
    status: boolean;
    message: string;
    data: ResponseData;
    [key: string]: unknown;
}

export interface BuilderSuccessOptions {
    message?: string;
    data?: ResponseData;
    responseCode?: string;
    [key: string]: unknown;
}

export interface BuilderErrorOptions {
    message?: string;
    data?: ResponseData;
    responseCode?: string;
    [key: string]: unknown;
}

export interface BuilderValidationOptions {
    message?: string;
    errors?: ResponseData;
    responseCode?: string;
    [key: string]: unknown;
}

export interface MinimalResponse {
    status: (statusCode: number) => MinimalResponse;
    json: (payload: unknown) => unknown;
}

export interface HandlerBaseOptions {
    message?: string;
    data?: ResponseData;
    responseCode?: string;
    [key: string]: unknown;
}

export interface HandlerValidationOptions {
    message?: string;
    errors?: ResponseData;
    responseCode?: string;
    [key: string]: unknown;
}

export interface HandlerErrorOptions {
    message?: string;
    error?: unknown;
    data?: ResponseData;
    responseCode?: string;
    [key: string]: unknown;
}

export interface HandlerForwardOptions {
    response: unknown;
    statusCode?: number;
}

export interface NormalizedError {
    field: string;
    error: string;
}

export interface JoiDetail {
    path: Array<string | number>;
    message: string;
}

export interface JoiErrorLike {
    details?: JoiDetail[];
}

export interface ExpressValidatorErrorLike {
    param: string;
    msg: string;
}

export interface MiddlewareAttachOptions {
    overwrite?: boolean;
}

export interface MiddlewareRequestLike {
    [key: string]: unknown;
}

export interface MiddlewareResponseLike {
    status?: (statusCode: number) => unknown;
    code?: (statusCode: number) => unknown;
    json?: (payload: unknown) => unknown;
    send?: (payload: unknown) => unknown;
    [key: string]: unknown;
}

export type MiddlewareNext = () => unknown;

export interface ResponderMethods {
    success: (options?: HandlerBaseOptions) => unknown;
    created: (options?: HandlerBaseOptions) => unknown;
    notFound: (options?: HandlerBaseOptions) => unknown;
    validationError: (options?: HandlerValidationOptions) => unknown;
    unauthorized: (options?: HandlerBaseOptions) => unknown;
    forbidden: (options?: HandlerBaseOptions) => unknown;
    error: (options?: HandlerErrorOptions) => unknown;
    forward: (options: HandlerForwardOptions) => unknown;
}
