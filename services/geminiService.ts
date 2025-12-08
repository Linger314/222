import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    return "";
  }
  return key;
};

export interface GenerateImageResult {
  imageUrl: string;
  success: boolean;
  error?: string;
}

export type ModelOption = 
  | 'gemini-3-pro-image-preview' 
  | 'gemini-2.5-flash-image'
  | 'gemini-2.0-flash-exp'
  | 'gemini-2.0-pro-exp-02-05'
  | 'imagen-3.0-generate-001';

export type VisualStyle = 'flat_vector' | '3d_isometric' | 'sketch' | 'photorealistic';

// Helper for exponential backoff
const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function retryOperation<T>(operation: () => Promise<T>, retries = 3, delay = 2000): Promise<T> {
  try {
    return await operation();
  } catch (error: any) {
    // Check for 429 (Resource Exhausted) or 5xx server errors
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
  style: VisualStyle,
  config?: { customBaseUrl?: string; customApiKey?: string }
): Promise<GenerateImageResult> => {
  try {
    // Priority: Custom Key -> Env Key -> Empty (Fail)
    const apiKey = config?.customApiKey || getApiKey();
    
    // Initialize AI Client with optional Base URL (Proxy)
    const clientOptions: any = { apiKey };
    if (config?.customBaseUrl) {
      clientOptions.baseUrl = config.customBaseUrl;
    }

    const ai = new GoogleGenAI(clientOptions);

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

    // Branch: Imagen Models use generateImages
    if (model.includes('imagen')) {
      const response = await retryOperation(async () => {
        return await ai.models.generateImages({
          model: model,
          prompt: enhancedPrompt,
          config: {
            numberOfImages: 1,
            aspectRatio: '16:9',
            outputMimeType: 'image/png',
          },
        });
      });

      const base64EncodeString = response.generatedImages?.[0]?.image?.imageBytes;
      if (base64EncodeString) {
        return { imageUrl: `data:image/png;base64,${base64EncodeString}`, success: true };
      }
      return { imageUrl: "", success: false, error: "No image data returned from Imagen model." };
    }

    // Branch: Gemini Models use generateContent
    // Only apply imageConfig (aspectRatio) for models that explicitly support it in generateContent
    const supportsImageConfig = model === 'gemini-3-pro-image-preview' || model === 'gemini-2.5-flash-image';
    
    const requestConfig: any = {};
    if (supportsImageConfig) {
      requestConfig.imageConfig = {
        aspectRatio: "16:9",
      };
    }

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
        config: requestConfig,
      });
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        const base64EncodeString = part.inlineData.data;
        const imageUrl = `data:image/png;base64,${base64EncodeString}`;
        return { imageUrl, success: true };
      }
    }

    return { imageUrl: "", success: false, error: "No image data returned from Gemini. This model might not support direct image generation." };

  } catch (error: any) {
    console.error("Gemini API Error:", error);
    let errorMessage = error.message || "Failed to generate image.";
    
    if (errorMessage.includes('429')) {
      errorMessage = "Quota exceeded. Please try again in a few moments, or check your billing details.";
    } else if (errorMessage.includes('400')) {
        errorMessage = `Model configuration error: ${error.message}. Try selecting a different model.`;
    }

    return { 
      imageUrl: "", 
      success: false, 
      error: errorMessage
    };
  }
};