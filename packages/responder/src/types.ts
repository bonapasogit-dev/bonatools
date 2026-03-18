export type ApiMeta = Record<string, unknown>;

export interface ApiErrorDetail {
    field?: string;
    issue: string;
    [key: string]: unknown;
}

export interface ApiErrorObject {
    code?: string;
    message: string;
    details?: ApiErrorDetail[];
    traceId?: string;
    [key: string]: unknown;
}

export interface ApiResponse<TData = unknown> {
    message: string;
    data: TData | null;
    meta: ApiMeta;
    error: ApiErrorObject | null;
}

export interface BuilderSuccessOptions<TData = unknown> {
    message?: string;
    data?: TData | null;
    meta?: Record<string, unknown>;
}

export interface BuilderErrorOptions<TData = unknown> {
    message?: string;
    code?: string;
    data?: TData | null;
    details?: ApiErrorDetail[];
    traceId?: string;
    meta?: Record<string, unknown>;
    error?: Record<string, unknown>;
}

export interface BuilderValidationOptions<TData = unknown> {
    message?: string;
    code?: string;
    data?: TData | null;
    details?: ApiErrorDetail[];
    traceId?: string;
    meta?: Record<string, unknown>;
    error?: Record<string, unknown>;
}

export interface MinimalResponse {
    status: (statusCode: number) => MinimalResponse;
    json: (payload: unknown) => unknown;
    send?: (payload?: unknown) => unknown;
    end?: () => unknown;
}

export interface HandlerBaseOptions<TData = unknown> {
    message?: string;
    data?: TData | null;
    meta?: Record<string, unknown>;
}

export interface HandlerValidationOptions<TData = unknown> {
    message?: string;
    code?: string;
    data?: TData | null;
    details?: ApiErrorDetail[];
    traceId?: string;
    meta?: Record<string, unknown>;
    error?: Record<string, unknown>;
}

export interface HandlerErrorOptions<TData = unknown> {
    message?: string;
    code?: string;
    error?: unknown;
    data?: TData | null;
    details?: ApiErrorDetail[];
    traceId?: string;
    meta?: Record<string, unknown>;
    errorPayload?: Record<string, unknown>;
}

export interface HandlerForwardOptions {
    response: unknown;
    statusCode?: number;
}

export interface NormalizedError {
    field: string;
    issue: string;
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
    send?: (payload?: unknown) => unknown;
    end?: () => unknown;
    [key: string]: unknown;
}

export type MiddlewareNext = () => unknown;

export interface ResponderMethods {
    success: (options?: HandlerBaseOptions) => unknown;
    created: (options?: HandlerBaseOptions) => unknown;
    noContent: () => unknown;
    badRequest: (options?: HandlerValidationOptions) => unknown;
    notFound: (options?: HandlerBaseOptions) => unknown;
    conflict: (options?: HandlerBaseOptions) => unknown;
    validationError: (options?: HandlerValidationOptions) => unknown;
    unauthorized: (options?: HandlerBaseOptions) => unknown;
    forbidden: (options?: HandlerBaseOptions) => unknown;
    internalError: (options?: HandlerErrorOptions) => unknown;
    error: (options?: HandlerErrorOptions) => unknown;
    forward: (options: HandlerForwardOptions) => unknown;
}
