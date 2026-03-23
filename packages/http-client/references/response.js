class HttpSuccess {
  constructor(status, message, body) {
    this.status = status;
    this.body = body;
    this.message = message;
  }

    json() {
    return Promise.resolve(this.body);
  }
}

module.exports = {
  HttpSuccess
};