// __mocks__/browser-image-compression.js
module.exports = jest.fn().mockImplementation(file => Promise.resolve(file));
