// __tests__/api/analyze.test.ts
import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';
import { getJson } from 'serpapi';
import { GoogleGenerativeAI } from '@google/generative-ai';
import fetchMock from 'jest-fetch-mock';

// Enable fetch mocks
fetchMock.enableMocks();

// Mock external dependencies
jest.mock('serpapi');
jest.mock('@google/generative-ai');
// Mock heic-convert
jest.mock('heic-convert', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(Buffer.from('converted-jpeg')),
}));

const mockGetJson = getJson as jest.Mock;
const mockGoogleGenerativeAI = GoogleGenerativeAI as jest.Mock;
const mockHeicConvert = require('heic-convert');

// Mock the nested generative AI model methods
const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContentStream: mockGenerateContentStream,
}));
mockGoogleGenerativeAI.mockImplementation(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

describe('/api/analyze POST', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Clear mock history before each test
    jest.clearAllMocks();
    fetchMock.resetMocks();
    process.env = { ...originalEnv, GEMINI_API_KEY: 'test-key', SERPAPI_API_KEY: 'test-key' };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  // Helper to create a mock FormData object with File objects
  const createMockFormData = (files: { name: string; content: string }[]): FormData => {
    const formData = new FormData();
    files.forEach(file => {
      const blob = new Blob([file.content], { type: 'image/jpeg' });
      // Create a more realistic File object with the arrayBuffer method
      const fileWithBuffer = new File([blob], file.name, { type: 'image/jpeg' });
      formData.append('images', fileWithBuffer);
    });
    return formData;
  };

  it('should successfully analyze an image, get pricing from SerpApi, and condition from Gemini', async () => {
    // Arrange: 
    // 1. Mock Vision REST API response
    fetchMock.mockResponseOnce(JSON.stringify({
      responses: [{
        webDetection: {
          bestGuessLabels: [{ label: 'Hermes Hat' }],
          visuallySimilarImages: [{ url: 'http://similar-image.com' }],
          webEntities: [{ score: 0.95 }]
        }
      }]
    }));

    // 2. Mock SerpApi to return pricing for that label
    mockGetJson.mockImplementation((params, callback) => {
      callback({
        shopping_results: [
          { 
            title: 'Hermes Hat', 
            price: '$250',
            link: 'http://hermes.com', 
            thumbnail: 'http://hermes.com/img.jpg' 
          }
        ]
      });
    });

    // 3. Mock Gemini condition
    mockGenerateContentStream.mockResolvedValue({
      response: Promise.resolve({ text: () => 'Used (Good): Minor signs of wear.' }),
    });

    const mockFormData = createMockFormData([{ name: 'test.jpg', content: 'fake-image-content' }]);
    const mockRequest = { formData: async () => mockFormData } as NextRequest;

    // Act
    const response = await POST(mockRequest);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(1);

    const result = data.results[0];
    expect(result.brand).toBe('Hermes'); 
    expect(result.model).toBe('Hat');
    expect(result.currentRetailPrice).toBe('$250');
    expect(result.condition).toContain('Used (Good)');

    expect(fetchMock).toHaveBeenCalledTimes(1); // Vision API called
    expect(mockGetJson).toHaveBeenCalledTimes(1); // SerpApi called
  });

  it('should prioritize typical price range from SerpApi', async () => {
    // Arrange
    fetchMock.mockResponseOnce(JSON.stringify({
      responses: [{
        webDetection: { bestGuessLabels: [{ label: 'Hermes Hat' }] }
      }]
    }));

    mockGetJson.mockImplementation((params, callback) => {
      callback({
        shopping_results: [
          { 
            title: 'Hermes Hat', 
            // detected_prices would be ignored if typical_price_range exists
            price_results: { typical_price_range: ['$300 - $350'] }
          }
        ]
      });
    });

    mockGenerateContentStream.mockResolvedValue({ response: Promise.resolve({ text: () => 'New' }) });
    
    const mockFormData = createMockFormData([{ name: 'test.jpg', content: 'fake' }]);
    const mockRequest = { formData: async () => mockFormData } as NextRequest;

    // Act
    const response = await POST(mockRequest);
    const data = await response.json();

    // Assert
    expect(data.results[0].currentRetailPrice).toBe('$300 - $350');
  });

  it('should correctly handle HEIC files by converting them with heic-convert', async () => {
    // Arrange
    fetchMock.mockResponseOnce(JSON.stringify({ responses: [{ webDetection: {} }] }));
    mockGetJson.mockImplementation((params, callback) => callback({ shopping_results: [] }));
    mockGenerateContentStream.mockResolvedValue({ response: Promise.resolve({ text: () => 'New' }) });
    
    const mockFormData = createMockFormData([{ name: 'test.heic', content: 'fake-heic-content' }]);
    const mockRequest = { formData: async () => mockFormData } as NextRequest;

    // Act
    await POST(mockRequest);

    // Assert
    expect(mockHeicConvert.default).toHaveBeenCalledTimes(1);
  });
});



