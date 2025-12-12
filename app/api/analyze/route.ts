import { NextRequest, NextResponse } from 'next/server';
import { getJson } from "serpapi";
import { GoogleGenerativeAI } from '@google/generative-ai';

// --- Helper Function for Condition Analysis with Gemini ---
async function getConditionFromAI(imageBuffer: Buffer, description: string): Promise<string> {
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
  const model = genAI.getGenerativeModel({ model: 'gemini-pro-vision' });
  const prompt = `As an expert product appraiser, analyze the image of "${description}". Categorize its condition as "New", "Like New", "Used (Good)", "Used (Fair)", or "Damaged". Provide a one-sentence justification.`;
  const imageParts = [{ inlineData: { data: imageBuffer.toString('base64'), mimeType: 'image/jpeg' } }];

  try {
    const result = await model.generateContentStream([prompt, ...imageParts]);
    return (await result.response).text();
  } catch (error) {
    console.error('Error with Gemini Condition Analysis:', error);
    return 'AI Analysis Failed';
  }
}

// --- Helper Function to Search Pricing via SerpApi (Text Search) ---
async function getPricingFromSerpApi(query: string): Promise<{ price: string, link: string }> {
  if (!query || query === 'N/A') return { price: 'N/A', link: '#' };

  return new Promise((resolve) => {
    getJson({
      engine: "google_shopping",
      q: query,
      api_key: process.env.SERPAPI_API_KEY,
    }, (json) => {
      if (!json || !json.shopping_results || json.shopping_results.length === 0) {
        resolve({ price: 'N/A', link: '#' });
        return;
      }

      // Prioritize "New" items and typical prices if available (heuristic)
      const firstResult = json.shopping_results[0];
      let price = 'N/A';

      if (firstResult.price_results?.typical_price_range) {
        price = firstResult.price_results.typical_price_range[0];
      } else {
        price = firstResult.price || 'N/A';
      }

      const link = firstResult.link || '#';
      resolve({ price, link });
    });
  });
}

// --- Helper Function for Vision API (REST) ---
async function analyzeImageWithVisionRest(imageBase64: string) {
  const apiKey = process.env.GEMINI_API_KEY; // Reuse the Google API Key
  const url = `https://vision.googleapis.com/v1/images:annotate?key=${apiKey}`;

  const requestBody = {
    requests: [
      {
        image: { content: imageBase64 },
        features: [
          { type: 'WEB_DETECTION', maxResults: 5 },
          { type: 'LABEL_DETECTION', maxResults: 5 }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Vision API Error: ${errorData.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.responses[0];
}

export async function POST(req: NextRequest) {
  try {
    const heicConvert = (await import('heic-convert')).default;
    const formData = await req.formData();
    const files = formData.getAll('images') as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No images uploaded.' }, { status: 400 });
    }

    let finalResults: any[] = [];
    const seenItems = new Set();

    for (const file of files) {
      let imageBuffer = Buffer.from(await file.arrayBuffer());

      if (file.name.toLowerCase().endsWith('.heic') || file.name.toLowerCase().endsWith('.heif')) {
        try {
          const outputBuffer = await heicConvert({ buffer: imageBuffer, format: 'JPEG', quality: 0.9 });
          imageBuffer = Buffer.from(outputBuffer);
        } catch (convertError: any) {
          console.error(`Failed to convert HEIC file ${file.name}:`, convertError);
          finalResults.push({ fileName: file.name, brand: 'CONVERSION_ERROR', model: 'N/A', description: convertError.message, condition: 'N/A', currentRetailPrice: 'N/A', webLink: 'N/A', correspondingItemPictures: 'N/A', confidence: '0.00' });
          continue;
        }
      }
      
      const imageBase64 = imageBuffer.toString('base64');

      // 1. Identify Item with Vision AI (REST API)
      const result = await analyzeImageWithVisionRest(imageBase64);
      
      const webDetection = result.webDetection;
      
      let bestGuessLabel = webDetection?.bestGuessLabels?.[0]?.label;
      if (!bestGuessLabel && webDetection?.webEntities?.length) {
        bestGuessLabel = webDetection.webEntities[0].description;
      }
      
      const description = bestGuessLabel || 'Unknown Item';
      
      // 2. Get Condition from Gemini
      const conditionPromise = getConditionFromAI(imageBuffer, description);

      // 3. Get Pricing from SerpApi
      const pricePromise = getPricingFromSerpApi(description);

      const [condition, priceData] = await Promise.all([conditionPromise, pricePromise]);

      let brand = 'N/A';
      let model = description;
      
      const parts = description.split(' ');
      if (parts.length > 0) {
        brand = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        if (parts.length > 1) model = parts.slice(1).join(' ');
      }

      finalResults.push({
        fileName: file.name,
        brand: brand,
        model: model,
        description: description,
        condition: condition,
        currentRetailPrice: priceData.price,
        webLink: priceData.link,
        correspondingItemPictures: webDetection?.visuallySimilarImages?.[0]?.url || 'N/A',
        confidence: webDetection?.webEntities?.[0]?.score?.toFixed(2) || '0.00',
      });
    }

    return NextResponse.json({ success: true, results: finalResults });

  } catch (error: any) {
    console.error('Error processing images (FULL OBJECT):', JSON.stringify(error, null, 2));
    console.error('Error string:', error.toString());
    const errorMessage = error?.message || (typeof error === 'string' ? error : 'Unknown error occurred');
    return NextResponse.json({ error: `Failed to process images. ${errorMessage}` }, { status: 500 });
  }
}
