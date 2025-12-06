export interface Point {
  x: number;
  y: number;
}

export interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  fontSize: number;
  color: string;
  fontWeight: string;
}

export type ShapeType = 'rectangle' | 'ellipse' | 'arrow';

export interface ShapeElement {
  id: string;
  type: ShapeType;
  x: number; // Start X
  y: number; // Start Y
  width: number; // For Arrow: End X - Start X
  height: number; // For Arrow: End Y - Start Y
  strokeColor: string;
  strokeWidth: number;
}

export interface EraserPath {
  points: Point[];
  width: number;
  color: string; // Usually mimics background color
}

export type EditorMode = 'view' | 'pan' | 'draw_eraser' | 'add_text' | 'move_item' | 'pick_color' | 'draw_shape';

export type ShapeToolType = 'rectangle' | 'ellipse' | 'arrow';

declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
}
