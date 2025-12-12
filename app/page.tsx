 'use client';

import { useState, ChangeEvent, FormEvent } from 'react';
import { stringify } from 'csv-stringify/sync';

interface AnalysisResult {
  fileName: string;
  brand: string;
  model: string;
  description: string;
  condition: string;
  currentRetailPrice: string;
  webLink: string;
  correspondingItemPictures: string;
  confidence: string;
}

export default function Home() {
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<AnalysisResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setSelectedFiles(event.target.files);
    setResults([]);
    setError(null);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Please select images to upload.');
      return;
    }

    setLoading(true);
    setResults([]);
    setError(null);
    setProgress(0);

    const BATCH_SIZE = 20;
    let allResults: AnalysisResult[] = [];
    
    const filesToProcess = Array.from(selectedFiles);

    for (let i = 0; i < filesToProcess.length; i += BATCH_SIZE) {
      const batch = filesToProcess.slice(i, i + BATCH_SIZE);
      const batchFormData = new FormData();
      batch.forEach((file) => {
        batchFormData.append('images', file, file.name);
      });

      try {
        const response = await fetch('/api/analyze', {
          method: 'POST',
          body: batchFormData,
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || `Failed to analyze batch ${i / BATCH_SIZE + 1}.`);
        }

        const data = await response.json();
        allResults = [...allResults, ...data.results];
        setResults(allResults);
        setProgress(((i + batch.length) / filesToProcess.length) * 100);

      } catch (err: any) {
        console.error('Batch error:', err);
        setError(err.message || `An error occurred in batch ${i / BATCH_SIZE + 1}.`);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
  };



  const handleExportCsv = () => {
    if (results.length === 0) {
      alert('No results to export.');
      return;
    }
    const columns = [
      { key: 'fileName', header: 'File Name' },
      { key: 'brand', header: 'Brand' },
      { key: 'model', header: 'Model' },
      { key: 'description', header: 'Description' },
      { key: 'condition', header: 'Condition' },
      { key: 'currentRetailPrice', header: 'Current Retail Price' },
      { key: 'webLink', header: 'Web Link' },
      { key: 'correspondingItemPictures', header: 'Corresponding Item Pictures' },
      { key: 'confidence', header: 'Confidence (Similarity)' },
    ];
    const csvString = stringify(results, { header: true, columns: columns });
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'image_analysis_results.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
  };

  return (
    <main className="flex min-h-screen flex-col items-center p-6 md:p-12 bg-gray-50">
      <div className="w-full max-w-7xl">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800">Image Analyzer</h1>
          <p className="text-gray-600 mt-2">Upload your images to identify items and export the data to a spreadsheet.</p>
          <div className="mt-4 p-4 bg-blue-50 text-blue-800 rounded-lg">
            <p><b>Note:</b> The new AI Condition Analysis feature requires a Google AI Gemini API key. Please set the `GEMINI_API_KEY` environment variable before running the server.</p>
          </div>
        </header>

        <div className="bg-white p-8 rounded-lg shadow-lg w-full mb-8">
          <form onSubmit={handleSubmit} className="flex flex-col space-y-4">
            <div>
              <label htmlFor="images" className="block text-sm font-medium text-gray-700 mb-2">
                Upload Images (batches of 20 will be processed)
              </label>
              <input
                id="images"
                type="file"
                multiple
                accept="image/*,.heic,.heif"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-md disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? `Analyzing... (${Math.round(progress)}%)` : 'Analyze Images'}
            </button>
          </form>

          {error && (
            <p className="text-red-500 mt-4 text-sm">Error: {error}</p>
          )}
        </div>

        {results.length > 0 && (
          <div className="bg-white p-8 rounded-lg shadow-lg w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-800">Analysis Results</h2>
              <button
                onClick={handleExportCsv}
                className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-4 rounded-md"
              >
                Export to CSV
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">File</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Brand</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Model</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Condition</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Retail Price</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Web Link</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item Pictures</th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Confidence</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result, index) => (
                    <tr key={index} className={parseFloat(result.confidence) < 0.7 ? 'bg-yellow-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.fileName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{result.brand}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.model}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{result.confidence}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">{result.description}</td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">{result.condition}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{result.currentRetailPrice}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline"><a href={result.webLink} target="_blank" rel="noopener noreferrer">Product Link</a></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 hover:underline"><a href={result.correspondingItemPictures} target="_blank" rel="noopener noreferrer">Similar Image</a></td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{result.confidence}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-gray-500 mt-4">Note: Rows highlighted in yellow have a confidence score below 0.7 and may require manual review. "Condition" and "Price" are placeholders and must be verified manually in the exported CSV.</p>
          </div>
        )}
      </div>
    </main>
  );
}

