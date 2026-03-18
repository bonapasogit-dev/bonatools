import { ExpressValidatorErrorLike, JoiErrorLike, NormalizedError } from './types';

class ErrorNormalizer {
    static fromJoi(error: JoiErrorLike | undefined | null): NormalizedError[] {
        if (!error?.details) {
            return [];
        }

        return error.details.map((detail) => ({
            field: detail.path.join('.'),
            issue: detail.message.replace(/"/g, ''),
        }));
    }

    static fromExpressValidator(errors: ExpressValidatorErrorLike[] | unknown): NormalizedError[] {
        if (!Array.isArray(errors)) {
            return [];
        }

        return errors.map((entry) => ({
            field: entry.param,
            issue: entry.msg,
        }));
    }

    static fromCustom(field: string, issue: string): NormalizedError[] {
        return [{ field, issue }];
    }
}

export default ErrorNormalizer;
