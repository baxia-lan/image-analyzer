// __tests__/api/analyze.test.ts
import { POST } from '@/app/api/analyze/route';
import { NextRequest } from 'next/server';
import { getJson } from 'serpapi';
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

// Mock external dependencies
jest.mock('serpapi');
jest.mock('@google/generative-ai');
jest.mock('sharp');

const mockGetJson = getJson as jest.Mock;
const mockGoogleGenerativeAI = GoogleGenerativeAI as jest.Mock;
const mockSharp = sharp as jest.Mock;

// Mock the nested generative AI model methods
const mockGenerateContentStream = jest.fn();
const mockGetGenerativeModel = jest.fn(() => ({
  generateContentStream: mockGenerateContentStream,
}));
mockGoogleGenerativeAI.mockImplementation(() => ({
  getGenerativeModel: mockGetGenerativeModel,
}));

// Mock Sharp's chaining
const mockToBuffer = jest.fn();
const mockJpeg = jest.fn(() => ({ toBuffer: mockToBuffer }));
(mockSharp as any).mockReturnValue({ jpeg: mockJpeg });

describe('/api/analyze POST', () => {
  beforeEach(() => {
    // Clear mock history before each test
    jest.clearAllMocks();
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

  it('should successfully analyze an image, get condition, and return de-duplicated results', async () => {
    // Arrange: Mock the API responses
    mockGetJson.mockResolvedValue({
      visual_matches: [
        { title: 'Hermes Hat', source: 'hermes.com', price_results: { detected_prices: [{ value: 250 }] }, link: 'http://hermes.com', thumbnail: 'http://hermes.com/img.jpg' },
        { title: 'Madewell The Pouch Wallet', source: 'madewell.com', price_results: { detected_prices: [{ value: 75 }] }, link: 'http://madewell.com', thumbnail: 'http://madewell.com/img.jpg' },
        { title: 'hermes hat', source: 'hermes.com', price_results: { detected_prices: [{ value: 250 }] }, link: 'http://hermes.com', thumbnail: 'http://hermes.com/img.jpg' }, // Duplicate
      ],
    });
    mockGenerateContentStream.mockResolvedValue({
      response: Promise.resolve({ text: () => 'Used (Good): Minor signs of wear.' }),
    });

    const mockFormData = createMockFormData([{ name: 'test.jpg', content: 'fake-image-content' }]);
    const mockRequest = { formData: async () => mockFormData } as NextRequest;

    // Act: Call the API route handler
    const response = await POST(mockRequest);
    const data = await response.json();

    // Assert: Check the results
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.results).toHaveLength(2); // De-duplication should work

    // Check Hermes Hat
    expect(data.results[0].brand).toBe('Hermes');
    expect(data.results[0].model).toBe('Hat');
    expect(data.results[0].currentRetailPrice).toBe('$250');
    expect(data.results[0].condition).toContain('Used (Good)');

    // Check Madewell Wallet
    expect(data.results[1].brand).toBe('Madewell');
    expect(data.results[1].model).toBe('The Pouch Wallet'); // Title "Madewell The Pouch Wallet"
    expect(data.results[1].currentRetailPrice).toBe('$75');
  });

  it('should correctly handle HEIC files by converting them with sharp', async () => {
    // Arrange
    mockGetJson.mockResolvedValue({ visual_matches: [{ title: 'Test Product' }] });
    mockGenerateContentStream.mockResolvedValue({ response: Promise.resolve({ text: () => 'New' }) });
    mockToBuffer.mockResolvedValue(Buffer.from('converted-jpeg-content'));

    const mockFormData = createMockFormData([{ name: 'test.heic', content: 'fake-heic-content' }]);
    const mockRequest = { formData: async () => mockFormData } as NextRequest;

    // Act
    await POST(mockRequest);

    // Assert
    expect(mockSharp).toHaveBeenCalledTimes(1);
    expect(mockJpeg).toHaveBeenCalledTimes(1);
    expect(mockToBuffer).toHaveBeenCalledTimes(1);
    expect(mockGetJson).toHaveBeenCalledTimes(1);
  });

  it('should return an error if the SerpApi call fails', async () => {
    // Arrange
    mockGetJson.mockRejectedValue(new Error('SerpApi failed'));
    
    const mockFormData = createMockFormData([{ name: 'test.jpg', content: 'fake-image-content' }]);
    const mockRequest = { formData: async () => mockFormData } as NextRequest;

    // Act
    const response = await POST(mockRequest);
    const data = await response.json();

    // Assert
    expect(response.status).toBe(500);
    expect(data.error).toContain('SerpApi failed');
  });
});
