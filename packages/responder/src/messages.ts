const ResponseMessages = Object.freeze({
    SUCCESS: 'Success',
    CREATED: 'Resource created successfully',

    VALIDATION_ERROR: 'Validation Error',
    NOT_FOUND: 'Not Found',

    UNAUTHORIZED: 'Authentication failed. Please provide a valid API token.',

    FORBIDDEN: 'You do not have permission to access this resource.',

    INTERNAL_ERROR: 'Internal server error',
});

export default ResponseMessages;
