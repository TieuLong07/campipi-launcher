// Side-effect: patch undici 7 to expose legacy undici 6 error classes that
// @xmcl/installer / @xmcl/file-transfer expect. Must be imported before any
// XMCL module captures its `undici` reference.
import { errors } from 'undici';
if (!errors.ResponseStatusCodeError) {
  class ResponseStatusCodeError extends Error {
    constructor(message, statusCode, headers, body) {
      super(message || `Response status code ${statusCode}`);
      this.name = 'ResponseStatusCodeError';
      this.statusCode = statusCode;
      this.status = statusCode;
      this.headers = headers;
      this.body = body;
    }
  }
  Object.defineProperty(errors, 'ResponseStatusCodeError', {value: ResponseStatusCodeError, writable: true, configurable: true});
}
if (!errors.RequestRetryError) {
  class RequestRetryError extends Error { constructor() { super('Request retried'); this.name = 'RequestRetryError'; } }
  Object.defineProperty(errors, 'RequestRetryError', {value: RequestRetryError, writable: true, configurable: true});
}
