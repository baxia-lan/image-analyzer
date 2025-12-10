import { NextRequest, NextResponse } from 'next/server';
import { ImageAnnotatorClient } from '@google-cloud/vision';
import { getJson } from "serpapi";
import { GoogleGenerativeAI } from '@google/generative-ai';
import sharp from 'sharp';

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

export async function POST(req: NextRequest) {
  try {
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
          imageBuffer = await sharp(imageBuffer).jpeg().toBuffer();
        } catch (convertError: any) {
          finalResults.push({ fileName: file.name, brand: 'CONVERSION_ERROR', model: 'N/A', description: `Server-side conversion failed: ${convertError.message}`, condition: 'N/A', currentRetailPrice: 'N/A', webLink: 'N/A', correspondingItemPictures: 'N/A', confidence: '0.00' });
          continue;
        }
      }

      // --- High-Accuracy Product Recognition with Google Lens API ---
      const lensResponse = await getJson({
        engine: "google_lens",
        url: `data:image/jpeg;base64,${imageBuffer.toString('base64')}`,
        api_key: process.env.SERPAPI_API_KEY,
      });

      const visualMatches = lensResponse["visual_matches"] || [];

      if (visualMatches.length === 0) {
        // Fallback to Vision AI if Lens finds nothing
        // (This part could be re-implemented if needed, but for now we rely on Lens)
        finalResults.push({ fileName: file.name, brand: 'Not Found', model: 'N/A', description: 'No items recognized by Google Lens.', condition: 'N/A', currentRetailPrice: 'N/A', webLink: 'N/A', correspondingItemPictures: 'N/A', confidence: '0.00' });
        continue;
      }
      
      const conditionPromise = getConditionFromAI(imageBuffer, visualMatches[0]?.title || 'the item');

      for (const item of visualMatches) {
        const title = item.title;
        if (!title || seenItems.has(title.toLowerCase())) {
          continue; // De-duplication
        }
        seenItems.add(title.toLowerCase());
        
        const priceInfo = item.price_results?.detected_prices?.[0] || { value: null };
        const price = priceInfo.value ? `$${priceInfo.value}` : 'N/A';
        const link = item.link || '#';
        const thumbnail = item.thumbnail || 'N/A';
        
        // --- Enhanced Brand/Model Extraction ---
        let brand = 'N/A';
        let model = title; // Default model to the full title

        if (item.source) {
          // Extract brand from source URL (e.g., "madewell.com" -> "Madewell")
          const domain = item.source.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
          const brandNameFromSource = domain.split('.')[0];
          brand = brandNameFromSource.charAt(0).toUpperCase() + brandNameFromSource.slice(1);
          
          // If brand is in the title, remove it to get a cleaner model name
          if (title.toLowerCase().startsWith(brand.toLowerCase())) {
            model = title.substring(brand.length).trim();
          }
        }
        
        finalResults.push({
          fileName: file.name,
          brand: brand,
          model: model,
          description: title,
          condition: 'Analyzing...', // Placeholder for now
          currentRetailPrice: price,
          webLink: link,
          correspondingItemPictures: thumbnail,
          confidence: item.serpapi_product_api_score || 'N/A',
        });
      }
      
      const condition = await conditionPromise;
      // Retroactively apply the single condition to all items from this image
      finalResults.filter(r => r.fileName === file.name).forEach(r => {
          r.condition = condition;
      });
    }

    return NextResponse.json({ success: true, results: finalResults });

  } catch (error: any) {
    console.error('Error processing images:', error.message);
    return NextResponse.json({ error: `Failed to process images. ${error.message}` }, { status: 500 });
  }
}
