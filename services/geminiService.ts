import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    // In the context of AI Studio, this might be empty initially until injected.
    // However, the service is usually called after checking existence.
    // We return an empty string to allow initialization, but the call will fail if not injected.
    return "";
  }
  return key;
};

export interface GenerateImageResult {
  imageUrl: string;
  success: boolean;
  error?: string;
}

export type ModelOption = 'gemini-3-pro-image-preview' | 'gemini-2.5-flash-image';
export type VisualStyle = 'flat_vector' | '3d_isometric' | 'sketch' | 'photorealistic';

// Helper for exponential backoff
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 429 (Resource Exhausted) or 5xx server errors
    // Sometimes the SDK wraps the error, so we check status or message
    const isQuotaError = error.status === 429 || error.message?.includes('429') || error.message?.includes('Quota exceeded');
    const isServerError = error.status >= 500 && error.status < 600;

    if (retries > 0 && (isQuotaError || isServerError)) {
      console.warn(`Gemini API Error (${error.status || 'unknown'}). Retrying in ${delay}ms... (Attempts left: ${retries})`);
      await wait(delay);
      return retryOperation(operation, retries - 1, delay * 2); // Exponential backoff
    }
    throw error;
  }
}

/**
 * Generates a scientific mechanism diagram using the specified Gemini model and style.
 */
export const generateMechanismDiagram = async (
  userPrompt: string, 
  model: ModelOption,
  style: VisualStyle
): Promise<GenerateImageResult> => {
  try {
    // Always create a new instance to grab the latest injected key
    const ai = new GoogleGenAI({ apiKey: getApiKey() });

    let styleInstruction = "";
    switch (style) {
      case 'flat_vector':
        styleInstruction = `
          - **Aesthetic**: Clean, 2D flat vector art. Minimalist. Top-tier journal style (e.g. Nature/Science).
          - **Color Palette**: Predominantly White background, Light Blue accents, Navy Blue for structures. High contrast.
          - **Look**: Crisp outlines, solid fills, no gradients.
        `;
        break;
      case '3d_isometric':
        styleInstruction = `
          - **Aesthetic**: 3D Isometric view. Clean, glossy 3D rendering style suitable for textbook covers.
          - **Color Palette**: Professional scientific colors (blues, greys, teals). White background.
          - **Look**: Soft shadows, depth, volumetric forms.
        `;
        break;
      case 'sketch':
        styleInstruction = `
          - **Aesthetic**: Hand-drawn scientific sketch, black ink on white paper.
          - **Look**: Rougher lines, artistic shading, academic notebook style.
        `;
        break;
      case 'photorealistic':
        styleInstruction = `
          - **Aesthetic**: Highly detailed, photorealistic macro photography style.
          - **Look**: Depth of field, realistic textures, cinematic lighting.
        `;
        break;
    }

    const enhancedPrompt = `
      Create a professional scientific mechanism diagram (schematic illustration).
      
      **Visual Style Definition:**
      ${styleInstruction}
      
      **Layout & Clarity:**
      - If the process has steps, use a clear left-to-right or panel-based layout (e.g., Panel A, Panel B).
      - **Details**: Structures and particles should be distinct.
      
      **Editability Requirements (CRUCIAL):**
      - Place text labels on **solid color backgrounds** (preferably white) or use leader lines. 
      - **Avoid** placing text directly on top of complex noise.
      
      **Content Description:**
      ${userPrompt}
    `;

    // Wrap the API call in the retry logic
    const response = await retryOperation(async () => {
      return await ai.models.generateContent({
        model: model,
        contents: {
          parts: [
            {
              text: enhancedPrompt,
            },
          ],
        },
        config: {
          imageConfig: {
            aspectRatio: "16:9",
          },
        },
      });
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        const imageUrl = `data:image/png;base64,${base64EncodeString}`;
        return { imageUrl, success: true };
      }
    }

    return { imageUrl: "", success: false, error: "No image data returned from Gemini." };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = error.message || "Failed to generate image.";
    
    if (errorMessage.includes('429')) {
      errorMessage = "Quota exceeded. Please try again in a few moments, or check your API key billing status.";
    }

    return { 
      imageUrl: "", 
      success: false, 
      error: errorMessage
    };
  }
};