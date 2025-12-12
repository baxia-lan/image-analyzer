// In jest.setup.js
import '@testing-library/jest-dom';
import fetchMock from 'jest-fetch-mock';

fetchMock.enableMocks();

// Polyfill for arrayBuffer in JSDOM
if (typeof Blob.prototype.arrayBuffer === 'undefined') {
  Object.defineProperty(Blob.prototype, 'arrayBuffer', {
    value: function arrayBuffer() {
      return new Promise((resolve) => {
        const fr = new FileReader();
        fr.onload = () => {
          resolve(fr.result);
        };
        fr.readAsArrayBuffer(this);
      });
    },
  });
}

// Polyfill for Response.json in JSDOM
if (typeof Response.json === 'undefined') {
  Response.json = (data, options) => {
    const body = JSON.stringify(data);
    const headers = new Headers({
      'Content-Type': 'application/json',
      ...options?.headers,
    });
    return new Response(body, {
      ...options,
      headers,
    });
  };
}

// Global mock for heic2any
jest.mock('heic2any', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(options => Promise.resolve(options.blob)),
}));
