// __tests__/Home.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import fetchMock from 'jest-fetch-mock';
import Home from '../app/page';

// Mock csv-stringify
jest.mock('csv-stringify/sync', () => ({
  stringify: jest.fn(),
}));


describe('Home Page - User Interactions', () => {
  beforeEach(() => {
    fetchMock.resetMocks();
  });

  it('renders the main heading and upload form', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /image analyzer/i })).toBeInTheDocument();
  });

  it('displays analysis results after a successful API call', async () => {
    render(<Home />);
    const file = new File(['(⌐□_□)'], 'test.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    const mockResults = {
      success: true,
      results: [{ fileName: 'test.png', brand: 'TestBrand', model: 'TestModel', description: 'A test item', condition: 'New', currentRetailPrice: '00', webLink: '#', correspondingItemPictures: '#', confidence: '0.95' }],
    };
    fetchMock.mockResponseOnce(JSON.stringify(mockResults));

    const analyzeButton = screen.getByRole('button', { name: /analyze images/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText('TestBrand')).toBeInTheDocument();
    });
  });

  it('displays an error message if the API call fails', async () => {
    render(<Home />);
    const file = new File(['(⌐□_□)'], 'error.png', { type: 'image/png' });
    const input = screen.getByLabelText(/upload images/i) as HTMLInputElement;
    fireEvent.change(input, { target: { files: [file] } });

    fetchMock.mockResponseOnce(JSON.stringify({ error: 'API Failure' }), { status: 500 });

    const analyzeButton = screen.getByRole('button', { name: /analyze images/i });
    fireEvent.click(analyzeButton);

    await waitFor(() => {
      expect(screen.getByText(/error: api failure/i)).toBeInTheDocument();
    });
  });
});