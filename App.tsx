import React, { useState, useEffect } from 'react';
import { generateMechanismDiagram, ModelOption, VisualStyle } from './services/geminiService';
import { CanvasEditor } from './components/CanvasEditor';
import { Sparkles, Image as ImageIcon, Loader2, Settings2, Palette, Box, PenTool, Camera, Layout, Key, ExternalLink, Server, Globe } from 'lucide-react';

function App() {
  const [prompt, setPrompt] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<ModelOption>('gemini-3-pro-image-preview');
  const [selectedStyle, setSelectedStyle] = useState<VisualStyle>('flat_vector');
  
  // Auth State
  const [hasApiKey, setHasApiKey] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Custom Gateway State
  const [customApiKey, setCustomApiKey] = useState('');
  const [customBaseUrl, setCustomBaseUrl] = useState(''); // e.g. https://yinli.one/

  // Check for API Key selection on mount
  useEffect(() => {
    const checkKey = async () => {
      // If user has manually entered a key, we consider them authenticated
      if (customApiKey) {
        setHasApiKey(true);
        return;
      }

      if (window.aistudio) {
        try {
          const has = await window.aistudio.hasSelectedApiKey();
          setHasApiKey(has);
        } catch (e) {
          console.error("Error checking API key:", e);
          setHasApiKey(false); 
        }
      } else {
        // Fallback for dev environments with .env
        setHasApiKey(true);
      }
    };
    checkKey();
  }, [customApiKey]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        setHasApiKey(true);
      } catch (e) {
        console.error("Error selecting key:", e);
        setError("Failed to select API Key. Please try again.");
      }
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const config = {
        customApiKey: customApiKey || undefined,
        customBaseUrl: customBaseUrl || undefined
      };

      const result = await generateMechanismDiagram(prompt, selectedModel, selectedStyle, config);
      if (result.success && result.imageUrl) {
        setGeneratedImageUrl(result.imageUrl);
      } else {
        setError(result.error || "Failed to generate image");
      }
    } catch (e) {
      setError("An unexpected error occurred.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setGeneratedImageUrl(null);
    setPrompt('');
    setError(null);
  };

  // Helper for style cards
  const StyleCard = ({ id, label, icon: Icon, description }: { id: VisualStyle, label: string, icon: any, description: string }) => (
    <button 
      onClick={() => setSelectedStyle(id)}
      className={`flex flex-col items-start p-3 rounded-xl border transition-all w-full text-left ${
        selectedStyle === id 
        ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-500' 
        : 'border-slate-200 bg-white hover:border-blue-300'
      }`}
    >
      <div className={`p-2 rounded-lg mb-2 ${selectedStyle === id ? 'bg-blue-200 text-blue-700' : 'bg-slate-100 text-slate-500'}`}>
        <Icon size={20} />
      </div>
      <div className="font-medium text-slate-800 text-sm">{label}</div>
      <div className="text-xs text-slate-500 mt-1 leading-tight">{description}</div>
    </button>
  );

  // Settings Component (Reused in Auth Screen and Main Screen)
  const ConnectionSettings = () => (
    <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-700">
        <Server size={16} />
        Custom Gateway / Proxy
      </div>
      <div className="space-y-2">
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">Base URL (Optional)</label>
          <div className="relative">
            <Globe size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input 
              type="text" 
              placeholder="e.g. https://yinli.one/" 
              value={customBaseUrl}
              onChange={(e) => setCustomBaseUrl(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1">API Key</label>
          <div className="relative">
            <Key size={14} className="absolute left-2.5 top-2.5 text-slate-400" />
            <input 
              type="password" 
              placeholder="sk-..." 
              value={customApiKey}
              onChange={(e) => setCustomApiKey(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );

  // API Key Selection Screen (Auth Wall)
  if (!hasApiKey && !customApiKey) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white max-w-md w-full rounded-2xl shadow-xl border border-slate-200 p-8 space-y-6">
          <div className="text-center space-y-2">
             <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto text-blue-600 mb-4">
                <Key size={32} />
             </div>
             <h1 className="text-2xl font-bold text-slate-900">Connect AI Service</h1>
             <p className="text-slate-600 text-sm">
               Connect Google Cloud or use a custom API gateway.
             </p>
          </div>
          
          <div className="space-y-4">
            {/* Option 1: AI Studio */}
            {window.aistudio && (
                <button 
                  onClick={handleSelectKey}
                  className="w-full h-12 bg-white border-2 border-slate-200 hover:border-blue-500 hover:text-blue-600 text-slate-700 font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
                >
                  <Key size={18} />
                  Select Key via Google AI Studio
                </button>
            )}

            <div className="relative py-2">
                <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-white px-2 text-slate-500">Or Configure Manually</span>
                </div>
            </div>

            {/* Option 2: Manual / Proxy */}
            <ConnectionSettings />

            <button 
               disabled={!customApiKey}
               onClick={() => setHasApiKey(true)}
               className="w-full h-12 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:text-slate-500 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-md"
            >
               Continue
            </button>
          </div>

          <div className="text-xs text-center text-slate-400">
            <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noreferrer" className="hover:text-blue-600 transition-colors">
              Gemini API Pricing & Billing
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col text-slate-900 font-sans">
      
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <Sparkles size={20} />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-700 to-blue-500">
              SciGraph Gen
            </h1>
          </div>
          <div className="flex items-center gap-3">
             <button 
               onClick={() => setShowSettings(!showSettings)}
               className={`p-2 rounded-lg transition-colors ${showSettings ? 'bg-blue-100 text-blue-700' : 'text-slate-500 hover:bg-slate-100'}`}
               title="Connection Settings"
             >
               <Settings2 size={20} />
             </button>
             <div className="text-sm text-slate-500 hidden sm:block border-l pl-3 ml-1">
               Scientific Mechanism Generator
             </div>
          </div>
        </div>
      </header>

      {/* Settings Panel (Collapsible) */}
      {showSettings && (
        <div className="bg-slate-100 border-b border-slate-200 p-4 animate-in slide-in-from-top-2">
           <div className="max-w-2xl mx-auto">
              <ConnectionSettings />
           </div>
        </div>
      )}

      <main className="flex-1 p-4 md:p-6 lg:p-8">
        
        {!generatedImageUrl ? (
          /* Input View */
          <div className="max-w-5xl mx-auto mt-4 animate-in fade-in slide-in-from-bottom-4 duration-500 grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* Left Column: Input */}
            <div className="lg:col-span-2 space-y-6">
              <div className="mb-6">
                <h2 className="text-3xl font-bold text-slate-900 mb-2">
                  Visualize Your Research
                </h2>
                <p className="text-lg text-slate-600">
                  Turn complex mechanisms into professional diagrams in seconds.
                </p>
              </div>

              <div className="bg-white p-6 rounded-2xl shadow-xl border border-slate-100">
                <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
                   Mechanism Description
                </label>
                <div className="relative mb-6">
                  <textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="Describe the process steps, chemical components, and flow... (e.g. 'One-step synthesis of oil gel, showing PDMS mixture, cross-linking, and anti-contamination mechanism')"
                    className="w-full h-40 p-4 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none resize-none text-base transition-all"
                  />
                  <div className="absolute bottom-4 right-4 text-xs text-slate-400">
                    {prompt.length} chars
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 uppercase mb-2">AI Model</label>
                    <div className="relative">
                      <select 
                        value={selectedModel}
                        onChange={(e) => setSelectedModel(e.target.value as ModelOption)}
                        className="w-full appearance-none bg-slate-50 border border-slate-200 text-slate-800 text-sm rounded-xl focus:ring-blue-500 focus:border-blue-500 block p-3 outline-none"
                      >
                        <option value="gemini-3-pro-image-preview">Gemini 3 Pro (High Fidelity)</option>
                        <option value="imagen-3.0-generate-001">Imagen 3 (High Quality)</option>
                        <option value="gemini-2.5-flash-image">Gemini 2.5 Flash (Fast)</option>
                        <option value="gemini-2.0-flash-exp">Gemini 2.0 Flash (Exp)</option>
                        <option value="gemini-2.0-pro-exp-02-05">Gemini 2.0 Pro (Exp)</option>
                      </select>
                      <Sparkles className="absolute right-3 top-3.5 text-slate-400 pointer-events-none" size={16}/>
                    </div>
                  </div>
                </div>

                {error && (
                  <div className="mb-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg flex items-center gap-2 border border-red-100">
                    <span>⚠️</span> {error}
                  </div>
                )}

                <button
                  onClick={handleGenerate}
                  disabled={isLoading || !prompt.trim()}
                  className="w-full h-14 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-blue-200 text-lg"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="animate-spin" size={24} />
                      Generating Diagram...
                    </>
                  ) : (
                    <>
                      <ImageIcon size={24} />
                      Generate Diagram
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Right Column: Settings & Examples */}
            <div className="space-y-6">
               
               {/* Style Selection */}
               <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                 <div className="flex items-center gap-2 mb-4 text-slate-800 font-bold">
                    <Palette size={18} className="text-blue-500"/>
                    <h3>Visual Style</h3>
                 </div>
                 <div className="grid grid-cols-2 gap-3">
                    <StyleCard 
                      id="flat_vector" 
                      label="Flat Vector" 
                      icon={Layout} 
                      description="Clean, 2D, Journal-ready"
                    />
                    <StyleCard 
                      id="3d_isometric" 
                      label="3D Isometric" 
                      icon={Box} 
                      description="Depth, Glossy, Textbook"
                    />
                    <StyleCard 
                      id="sketch" 
                      label="Sketch" 
                      icon={PenTool} 
                      description="Hand-drawn, Notebook"
                    />
                    <StyleCard 
                      id="photorealistic" 
                      label="Realistic" 
                      icon={Camera} 
                      description="Detailed, Cinematic"
                    />
                 </div>
               </div>

               {/* Prompt Starters */}
               <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200">
                 <h3 className="text-sm font-bold text-slate-500 uppercase mb-3">Try these examples</h3>
                 <div className="flex flex-col gap-2">
                  {[
                     "Synthesis of Oil Gel: One-pot mixture of PDMS, modification & cross-linking.",
                     "CRISPR-Cas9 gene editing mechanism showing guide RNA and DNA cleavage.", 
                     "Lithium-ion battery charge cycle with anode, cathode and electrolyte flow.",
                     "Photosynthesis light-dependent reactions in the thylakoid membrane."
                   ].map((ex, i) => (
                     <button 
                        key={i}
                        onClick={() => setPrompt(ex)}
                        className="p-3 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:border-blue-400 hover:text-blue-700 transition-all text-left shadow-sm"
                     >
                       {ex}
                     </button>
                   ))}
                 </div>
               </div>

            </div>
          </div>
        ) : (
          /* Editor View */
          <div className="h-[calc(100vh-6rem)] animate-in fade-in duration-500 w-full flex justify-center">
             <CanvasEditor imageUrl={generatedImageUrl} onReset={handleReset} />
          </div>
        )}

      </main>
    </div>
  );
}

export default App;