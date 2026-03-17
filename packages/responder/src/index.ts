import ResponseHandler from './handler';
import ResponseBuilder from './builder';
import ResponseCodes from './codes';
import ResponseMessages from './messages';
import ErrorNormalizer from './normalizer';
import ResponseMiddleware from './middleware';

const responder = Object.freeze({
    handler: ResponseHandler,
    builder: ResponseBuilder,
    codes: ResponseCodes,
    messages: ResponseMessages,
    normalizer: ErrorNormalizer,
    middleware: ResponseMiddleware,
});

export = responder;
