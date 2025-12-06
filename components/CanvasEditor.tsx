import React, { useRef, useEffect, useState, useCallback } from 'react';
import { 
  Eraser, Type, MousePointer2, Download, Undo, Trash2, Pipette, Bold, 
  Square, Circle, MoveRight, ZoomIn, ZoomOut, Hand, PenTool
} from 'lucide-react';
import { TextElement, EraserPath, EditorMode, Point, ShapeElement, ShapeToolType } from '../types';

interface CanvasEditorProps {
  imageUrl: string;
  onReset: () => void;
}

export const CanvasEditor: React.FC<CanvasEditorProps> = ({ imageUrl, onReset }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Refs for interactions
  const dragStartRef = useRef<Point>({ x: 0, y: 0 });
  const elementStartPosRef = useRef<Point>({ x: 0, y: 0 }); // Original pos of element being dragged
  const tempTextPosRef = useRef<Point>({ x: 0, y: 0 });

  // Viewport State
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState<Point>({ x: 0, y: 0 });

  const [mode, setMode] = useState<EditorMode>('view');
  const [activeShapeTool, setActiveShapeTool] = useState<ShapeToolType>('rectangle');
  
  // Canvas Objects
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [shapes, setShapes] = useState<ShapeElement[]>([]);
  const [eraserPaths, setEraserPaths] = useState<EraserPath[]>([]);
  
  // Selection
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<'text' | 'shape' | null>(null);
  
  // Drawing / Interaction State
  const [isDragging, setIsDragging] = useState(false);
  const [currentPath, setCurrentPath] = useState<Point[]>([]); // For eraser
  const [currentShape, setCurrentShape] = useState<ShapeElement | null>(null); // For drawing new shape

  // Tool Settings
  const [eraserColor, setEraserColor] = useState<string>('#ffffff');
  const [eraserSize, setEraserSize] = useState<number>(20);
  
  const [shapeColor, setShapeColor] = useState<string>('#ef4444'); // Default red for visibility
  const [shapeWidth, setShapeWidth] = useState<number>(4);

  // Text Styling State
  const [currentFontSize, setCurrentFontSize] = useState<number>(20);
  const [isBold, setIsBold] = useState<boolean>(false);
  const [textColor, setTextColor] = useState<string>('#0f172a');

  // Modal State
  const [inputText, setInputText] = useState('');
  const [showTextModal, setShowTextModal] = useState(false);
  const [textModalPos, setTextModalPos] = useState({ x: 0, y: 0 });

  // Load Image
  const [imageObj, setImageObj] = useState<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.src = imageUrl;
    img.onload = () => {
      setImageObj(img);
      // Reset view on new image
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
    };
  }, [imageUrl]);

  // Sync selection state with UI controls
  useEffect(() => {
    if (selectedId && selectedType === 'text') {
      const el = textElements.find(t => t.id === selectedId);
      if (el) {
        setCurrentFontSize(el.fontSize);
        setIsBold(el.fontWeight === '700' || el.fontWeight === 'bold');
        setTextColor(el.color);
      }
    } else if (selectedId && selectedType === 'shape') {
        const el = shapes.find(s => s.id === selectedId);
        if (el) {
            setShapeColor(el.strokeColor);
            setShapeWidth(el.strokeWidth);
        }
    }
  }, [selectedId, selectedType, textElements, shapes]);

  // Apply UI control changes to selected item
  useEffect(() => {
    if (!selectedId) return;

    if (selectedType === 'text') {
      setTextElements(prev => prev.map(el => 
        el.id === selectedId 
          ? { ...el, fontSize: currentFontSize, fontWeight: isBold ? '700' : '400', color: textColor }
          : el
      ));
    } else if (selectedType === 'shape') {
       setShapes(prev => prev.map(el => 
          el.id === selectedId
            ? { ...el, strokeColor: shapeColor, strokeWidth: shapeWidth }
            : el
       ));
    }
  }, [currentFontSize, isBold, textColor, shapeColor, shapeWidth, selectedId, selectedType]);


  // --- Drawing Logic ---

  const drawArrow = (ctx: CanvasRenderingContext2D, fromX: number, fromY: number, toX: number, toY: number, width: number) => {
    const headLength = width * 4; 
    const angle = Math.atan2(toY - fromY, toX - fromX);
    
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.lineWidth = width;
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headLength * Math.cos(angle - Math.PI / 6), toY - headLength * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headLength * Math.cos(angle + Math.PI / 6), toY - headLength * Math.sin(angle + Math.PI / 6));
    ctx.lineTo(toX, toY);
    ctx.fillStyle = ctx.strokeStyle;
    ctx.fill();
  };

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObj) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear and fill background
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // ctx.fillStyle = '#ffffff';
    // ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 1. Draw Base Image
    ctx.drawImage(imageObj, 0, 0, canvas.width, canvas.height);

    // 2. Draw Eraser Paths
    eraserPaths.forEach(path => {
      if (path.points.length < 1) return;
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = path.width;
      ctx.strokeStyle = path.color;
      
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });

    // Current Eraser Path
    if (isDragging && currentPath.length > 0 && mode === 'draw_eraser') {
      ctx.beginPath();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = eraserSize;
      ctx.strokeStyle = eraserColor;
      ctx.moveTo(currentPath[0].x, currentPath[0].y);
      for (let i = 1; i < currentPath.length; i++) {
        ctx.lineTo(currentPath[i].x, currentPath[i].y);
      }
      ctx.stroke();
    }

    // 3. Draw Shapes
    const renderShape = (s: ShapeElement) => {
        ctx.strokeStyle = s.strokeColor;
        ctx.lineWidth = s.strokeWidth;
        ctx.beginPath();
        
        if (s.type === 'rectangle') {
            ctx.strokeRect(s.x, s.y, s.width, s.height);
        } else if (s.type === 'ellipse') {
            ctx.ellipse(
                s.x + s.width / 2, 
                s.y + s.height / 2, 
                Math.abs(s.width / 2), 
                Math.abs(s.height / 2), 
                0, 0, 2 * Math.PI
            );
            ctx.stroke();
        } else if (s.type === 'arrow') {
            // For arrow, x,y is start, width/height is vector to end
            drawArrow(ctx, s.x, s.y, s.x + s.width, s.y + s.height, s.strokeWidth);
        }

        // Selection Highlight
        if (selectedId === s.id && selectedType === 'shape') {
            ctx.save();
            ctx.strokeStyle = '#3b82f6';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            // Bounding box approximation
            let bx=s.x, by=s.y, bw=s.width, bh=s.height;
            if (s.type === 'arrow') {
                // Bounds for arrow are tricky, simple box around start/end
                const minX = Math.min(s.x, s.x + s.width);
                const minY = Math.min(s.y, s.y + s.height);
                const maxX = Math.max(s.x, s.x + s.width);
                const maxY = Math.max(s.y, s.y + s.height);
                bx = minX - 10; by = minY - 10; bw = maxX - minX + 20; bh = maxY - minY + 20;
            } else {
                bx = s.x - 5; by = s.y - 5; bw = s.width + 10; bh = s.height + 10;
            }
            ctx.strokeRect(bx, by, bw, bh);
            ctx.restore();
        }
    };

    shapes.forEach(renderShape);
    if (currentShape) renderShape(currentShape);

    // 4. Draw Text
    textElements.forEach(el => {
      ctx.font = `${el.fontWeight} ${el.fontSize}px Inter, sans-serif`;
      ctx.fillStyle = el.color;
      ctx.textBaseline = 'top';
      
      // Selection Highlight
      if (selectedId === el.id && selectedType === 'text') {
        const metrics = ctx.measureText(el.text);
        const height = el.fontSize * 1.2;
        ctx.save();
        ctx.strokeStyle = '#3b82f6';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 3]);
        ctx.strokeRect(el.x - 4, el.y - 4, metrics.width + 8, height + 8);
        ctx.restore();
        
        ctx.fillStyle = '#3b82f6';
        ctx.beginPath();
        ctx.arc(el.x - 4, el.y - 4, 4, 0, Math.PI * 2);
        ctx.fill();
      }
      
      ctx.fillText(el.text, el.x, el.y);
    });

  }, [imageObj, eraserPaths, currentPath, isDragging, mode, eraserSize, eraserColor, textElements, shapes, currentShape, selectedId, selectedType]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  // Handle Resize
  useEffect(() => {
    if (!imageObj || !containerRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = imageObj.width;
    canvas.height = imageObj.height;
    drawCanvas();
  }, [imageObj, drawCanvas]);


  // --- Input Handlers ---

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent): Point => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    
    const rect = canvas.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    // Account for CSS Zoom (rect size) and internal scale if any
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const handlePointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    const pt = getCanvasPoint(e);
    
    // Pan Mode
    if (mode === 'pan') {
       setIsDragging(true);
       const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
       const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
       dragStartRef.current = { x: clientX, y: clientY }; // Use client coords for panning
       return;
    }

    // Color Picker
    if (mode === 'pick_color') {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const p = ctx.getImageData(Math.floor(pt.x), Math.floor(pt.y), 1, 1).data;
        const hex = "#" + ("000000" + ((p[0] << 16) | (p[1] << 8) | p[2]).toString(16)).slice(-6);
        setEraserColor(hex);
        setShapeColor(hex); // Also set shape color? Maybe useful for arrows.
        setMode('draw_eraser');
      }
      return;
    }

    setIsDragging(true);

    if (mode === 'draw_eraser') {
      setCurrentPath([pt]);
    } 
    else if (mode === 'draw_shape') {
        dragStartRef.current = pt;
        setCurrentShape({
            id: Date.now().toString(),
            type: activeShapeTool,
            x: pt.x,
            y: pt.y,
            width: 0,
            height: 0,
            strokeColor: shapeColor,
            strokeWidth: shapeWidth
        });
    }
    else if (mode === 'add_text') {
      const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
      setTextModalPos({ x: clientX, y: clientY });
      setShowTextModal(true);
      setInputText('');
      tempTextPosRef.current = pt; 
    } 
    else if (mode === 'move_item' || mode === 'view') {
      // Hit Test Text
      const ctx = canvasRef.current?.getContext('2d');
      if (!ctx) return;
      
      // Check Text (Reverse order for z-index)
      for (let i = textElements.length - 1; i >= 0; i--) {
        const el = textElements[i];
        ctx.font = `${el.fontWeight} ${el.fontSize}px Inter, sans-serif`;
        const metrics = ctx.measureText(el.text);
        if (pt.x >= el.x && pt.x <= el.x + metrics.width && pt.y >= el.y && pt.y <= el.y + el.fontSize * 1.2) {
          setSelectedId(el.id);
          setSelectedType('text');
          setMode('move_item');
          dragStartRef.current = pt;
          elementStartPosRef.current = { x: el.x, y: el.y };
          return; // Stop after first hit
        }
      }

      // Check Shapes
      for (let i = shapes.length - 1; i >= 0; i--) {
         const s = shapes[i];
         // Simple bounding box hit test for now
         let hit = false;
         if (s.type === 'arrow') {
             // Check start and end points proximity
             const startDist = Math.hypot(pt.x - s.x, pt.y - s.y);
             const endDist = Math.hypot(pt.x - (s.x + s.width), pt.y - (s.y + s.height));
             // Or mid point? Simple check: bounding box
             const minX = Math.min(s.x, s.x + s.width) - 10;
             const minY = Math.min(s.y, s.y + s.height) - 10;
             const maxX = Math.max(s.x, s.x + s.width) + 10;
             const maxY = Math.max(s.y, s.y + s.height) + 10;
             if (pt.x >= minX && pt.x <= maxX && pt.y >= minY && pt.y <= maxY) hit = true;
         } else {
             if (pt.x >= s.x && pt.x <= s.x + s.width && pt.y >= s.y && pt.y <= s.y + s.height) hit = true;
         }

         if (hit) {
             setSelectedId(s.id);
             setSelectedType('shape');
             setMode('move_item');
             dragStartRef.current = pt;
             elementStartPosRef.current = { x: s.x, y: s.y };
             return;
         }
      }

      // If clicked nothing
      setSelectedId(null);
      setSelectedType(null);
    }
  };

  const handlePointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return;
    
    // Pan Logic
    if (mode === 'pan') {
        const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
        const dx = clientX - dragStartRef.current.x;
        const dy = clientY - dragStartRef.current.y;
        setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
        dragStartRef.current = { x: clientX, y: clientY }; // Reset for next delta
        return;
    }

    const pt = getCanvasPoint(e);

    if (mode === 'draw_eraser') {
      setCurrentPath(prev => [...prev, pt]);
    } 
    else if (mode === 'draw_shape' && currentShape) {
        // Calculate width/height based on start point
        const start = dragStartRef.current;
        setCurrentShape({
            ...currentShape,
            width: pt.x - start.x,
            height: pt.y - start.y
        });
    }
    else if (mode === 'move_item' && selectedId) {
      const dx = pt.x - dragStartRef.current.x;
      const dy = pt.y - dragStartRef.current.y;
      const initial = elementStartPosRef.current;
      
      if (selectedType === 'text') {
        setTextElements(prev => prev.map(el => 
            el.id === selectedId ? { ...el, x: initial.x + dx, y: initial.y + dy } : el
        ));
      } else if (selectedType === 'shape') {
          setShapes(prev => prev.map(el => 
            el.id === selectedId ? { ...el, x: initial.x + dx, y: initial.y + dy } : el
          ));
      }
    }
  };

  const handlePointerUp = () => {
    if (!isDragging) return;
    
    if (mode === 'draw_eraser') {
      setEraserPaths(prev => [...prev, {
        points: currentPath,
        width: eraserSize,
        color: eraserColor
      }]);
      setCurrentPath([]);
    } else if (mode === 'draw_shape' && currentShape) {
        // Only add if it has some size
        if (Math.abs(currentShape.width) > 5 || Math.abs(currentShape.height) > 5) {
            setShapes(prev => [...prev, currentShape]);
            setSelectedId(currentShape.id);
            setSelectedType('shape');
            setMode('move_item');
        }
        setCurrentShape(null);
    }

    setIsDragging(false);
  };

  // --- Actions ---

  const handleAddText = () => {
    if (!inputText.trim()) { setShowTextModal(false); return; }
    const pos = tempTextPosRef.current || { x: 50, y: 50 };
    const newText: TextElement = {
      id: Date.now().toString(),
      x: pos.x,
      y: pos.y,
      text: inputText,
      fontSize: currentFontSize,
      color: textColor,
      fontWeight: isBold ? '700' : '400'
    };
    setTextElements(prev => [...prev, newText]);
    setShowTextModal(false);
    setInputText('');
    setMode('move_item'); 
    setSelectedId(newText.id);
    setSelectedType('text');
  };

  const handleDeleteSelected = () => {
    if (selectedId && selectedType === 'text') {
      setTextElements(prev => prev.filter(t => t.id !== selectedId));
    } else if (selectedId && selectedType === 'shape') {
      setShapes(prev => prev.filter(s => s.id !== selectedId));
    }
    setSelectedId(null);
    setSelectedType(null);
  };

  const handleUndo = () => {
    // Simple undo: try to remove last added item from whichever list changed last?
    // A proper undo stack is complex. Simplification: Undo last eraser, then last shape, then last text.
    if (eraserPaths.length > 0) {
      setEraserPaths(prev => prev.slice(0, -1));
    } else if (shapes.length > 0) {
        setShapes(prev => prev.slice(0, -1));
    } else if (textElements.length > 0) {
      setTextElements(prev => prev.slice(0, -1));
    }
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'scientific-mechanism-edited.png';
    link.href = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const zoomIn = () => setZoom(z => Math.min(z + 0.2, 3));
  const zoomOut = () => setZoom(z => Math.max(z - 0.2, 0.5));

  const getCursorClass = () => {
    switch(mode) {
      case 'pick_color': return 'cursor-copy';
      case 'add_text': return 'cursor-text';
      case 'move_item': return 'cursor-move';
      case 'draw_eraser': return 'cursor-crosshair';
      case 'draw_shape': return 'cursor-crosshair';
      case 'pan': return 'cursor-grab';
      default: return 'cursor-default';
    }
  };

  const ToolButton = ({ active, onClick, children, title }: any) => (
    <button 
      onClick={onClick}
      title={title}
      className={`p-2 rounded-lg flex items-center justify-center transition-all ${active ? 'bg-blue-100 text-blue-700 shadow-inner' : 'text-slate-600 hover:bg-slate-200'}`}
    >
      {children}
    </button>
  );

  return (
    <div className="flex flex-col h-full w-full max-w-[1400px] mx-auto bg-white shadow-xl rounded-xl overflow-hidden border border-slate-200">
      
      {/* Top Toolbar */}
      <div className="bg-slate-50 border-b border-slate-200 p-2 flex flex-wrap items-center justify-between gap-2 z-10">
        
        {/* Left: Modes */}
        <div className="flex items-center gap-1">
          <div className="bg-slate-200/50 p-1 rounded-lg flex gap-1">
             <ToolButton active={mode === 'view' || mode === 'move_item'} onClick={() => setMode('view')} title="Select / Move">
               <MousePointer2 size={18} />
             </ToolButton>
             <ToolButton active={mode === 'pan'} onClick={() => setMode('pan')} title="Pan View">
               <Hand size={18} />
             </ToolButton>
          </div>
          
          <div className="w-px h-6 bg-slate-300 mx-1"></div>

          {/* Draw Tools */}
          <div className="bg-slate-200/50 p-1 rounded-lg flex gap-1">
             <ToolButton active={mode === 'draw_eraser'} onClick={() => setMode('draw_eraser')} title="Eraser">
                <Eraser size={18} />
             </ToolButton>
             <ToolButton active={mode === 'pick_color'} onClick={() => setMode('pick_color')} title="Eyedropper">
                <Pipette size={18} />
             </ToolButton>
             <ToolButton active={mode === 'add_text'} onClick={() => setMode('add_text')} title="Add Text">
                <Type size={18} />
             </ToolButton>
             
             {/* Shape Dropdown/Group */}
             <div className="flex gap-1 border-l border-slate-300 pl-1">
                <ToolButton active={mode === 'draw_shape' && activeShapeTool === 'rectangle'} onClick={() => { setMode('draw_shape'); setActiveShapeTool('rectangle'); }} title="Rectangle">
                    <Square size={18} />
                </ToolButton>
                <ToolButton active={mode === 'draw_shape' && activeShapeTool === 'ellipse'} onClick={() => { setMode('draw_shape'); setActiveShapeTool('ellipse'); }} title="Circle">
                    <Circle size={18} />
                </ToolButton>
                <ToolButton active={mode === 'draw_shape' && activeShapeTool === 'arrow'} onClick={() => { setMode('draw_shape'); setActiveShapeTool('arrow'); }} title="Arrow">
                    <MoveRight size={18} />
                </ToolButton>
             </div>
          </div>
        </div>

        {/* Center: Contextual Settings */}
        <div className="flex-1 flex items-center justify-center gap-4 px-4 overflow-x-auto">
             {/* Eraser Settings */}
             {(mode === 'draw_eraser') && (
                 <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-2 py-1 rounded shadow-sm border">
                    <span className="text-xs font-bold uppercase">Eraser</span>
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: eraserColor }}></div>
                    <input type="range" min="5" max="100" value={eraserSize} onChange={e => setEraserSize(Number(e.target.value))} className="w-20" />
                 </div>
             )}
             {/* Text Settings */}
             {(mode === 'add_text' || (selectedId && selectedType === 'text')) && (
                 <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-2 py-1 rounded shadow-sm border">
                    <span className="text-xs font-bold uppercase">Text</span>
                    <input type="number" min="8" max="100" value={currentFontSize} onChange={e => setCurrentFontSize(Number(e.target.value))} className="w-12 border rounded px-1" />
                    <button onClick={() => setIsBold(!isBold)} className={`p-1 rounded ${isBold ? 'bg-slate-200' : ''}`}><Bold size={14}/></button>
                    <input type="color" value={textColor} onChange={e => setTextColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                 </div>
             )}
             {/* Shape Settings */}
             {(mode === 'draw_shape' || (selectedId && selectedType === 'shape')) && (
                 <div className="flex items-center gap-2 text-sm text-slate-600 bg-white px-2 py-1 rounded shadow-sm border">
                    <span className="text-xs font-bold uppercase">Shape</span>
                    <input type="color" value={shapeColor} onChange={e => setShapeColor(e.target.value)} className="w-6 h-6 p-0 border-0 rounded cursor-pointer" />
                    <span className="text-xs">Width:</span>
                    <input type="number" min="1" max="20" value={shapeWidth} onChange={e => setShapeWidth(Number(e.target.value))} className="w-12 border rounded px-1" />
                 </div>
             )}
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2">
           <button onClick={zoomOut} className="p-2 hover:bg-slate-200 rounded text-slate-600" title="Zoom Out"><ZoomOut size={18} /></button>
           <span className="text-xs font-mono w-12 text-center">{Math.round(zoom * 100)}%</span>
           <button onClick={zoomIn} className="p-2 hover:bg-slate-200 rounded text-slate-600" title="Zoom In"><ZoomIn size={18} /></button>
           
           <div className="w-px h-6 bg-slate-300 mx-1"></div>

           {selectedId && <button onClick={handleDeleteSelected} className="p-2 text-red-500 hover:bg-red-50 rounded"><Trash2 size={18}/></button>}
           <button onClick={handleUndo} className="p-2 text-slate-600 hover:bg-slate-200 rounded"><Undo size={18}/></button>
           
           <div className="w-px h-6 bg-slate-300 mx-1"></div>

           <button onClick={handleDownload} className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium shadow-sm">
             <Download size={16} /> Export
           </button>
           <button onClick={onReset} className="text-sm text-slate-500 hover:text-slate-800 underline px-2">New</button>
        </div>
      </div>

      {/* Workspace */}
      <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center">
         
         {/* Canvas Container with Zoom/Pan */}
         <div 
           ref={containerRef}
           className={`relative shadow-2xl transition-transform duration-75 ease-out origin-center ${getCursorClass()}`}
           style={{
             transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
           }}
           onMouseDown={handlePointerDown}
           onMouseMove={handlePointerMove}
           onMouseUp={handlePointerUp}
           onTouchStart={handlePointerDown}
           onTouchMove={handlePointerMove}
           onTouchEnd={handlePointerUp}
         >
           {!imageObj ? (
             <div className="w-96 h-64 flex items-center justify-center text-slate-400 bg-white rounded">Loading Image...</div>
           ) : (
             <canvas ref={canvasRef} className="bg-white block" />
           )}
           
           {/* Text Modal stays fixed relative to screen, mapped dynamically */}
           {/* Note: We handle text modal outside this scaled container usually, but for simplicity we keep it absolute on screen. */}
         </div>

         {/* Overlay UI Elements (Floating) */}
         {showTextModal && (
            <div 
              className="fixed z-50 bg-white p-4 rounded-xl shadow-2xl border border-slate-200 w-72 animate-in fade-in zoom-in duration-200"
              style={{ 
                top: Math.min(textModalPos.y, window.innerHeight - 200), 
                left: Math.min(textModalPos.x, window.innerWidth - 300) 
              }}
            >
              <h3 className="text-xs font-bold text-slate-500 uppercase mb-2">New Label</h3>
              <input
                autoFocus
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddText()}
                placeholder="Enter text..."
                className="w-full border border-slate-300 rounded p-2 mb-3 text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowTextModal(false)} className="px-3 py-1 text-xs text-slate-500 hover:bg-slate-100 rounded">Cancel</button>
                <button onClick={handleAddText} className="px-3 py-1 text-xs bg-blue-600 text-white rounded hover:bg-blue-700">Add</button>
              </div>
            </div>
          )}

      </div>
      
      {/* Footer Info */}
      <div className="bg-slate-50 border-t border-slate-200 px-4 py-1 text-xs text-slate-400 flex justify-between select-none">
         <span>{Math.round(imageObj?.width || 0)} x {Math.round(imageObj?.height || 0)}px</span>
         <span>Hold <span className="font-bold">Pan Tool</span> to move view</span>
      </div>
    </div>
  );
};
