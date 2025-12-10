// __mocks__/heic2any.js
module.exports = jest.fn().mockResolvedValue(new Blob(['fake-jpeg'], { type: 'image/jpeg' }));
