import { GoogleGenAI } from "@google/genai";

const getApiKey = (): string => {
  const key = process.env.API_KEY;
  if (!key) {
    throw new Error("API Key not found in environment variables");
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

/**
 * Generates a scientific mechanism diagram using the specified Gemini model and style.
 */
export const generateMechanismDiagram = async (
  userPrompt: string, 
  model: ModelOption,
  style: VisualStyle
): Promise<GenerateImageResult> => {
  try {
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

    const response = await ai.models.generateContent({
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
    return { 
      imageUrl: "", 
      success: false, 
      error: error.message || "Failed to generate image." 
    };
  }
};
