import React, { useState, useEffect, useCallback, useRef, Suspense, lazy } from 'react';
import { Sidebar } from './components/Sidebar';
import { Console } from './components/Console';
import { VFSFactory } from './vfs';
import { Play, Share2, Zap, X, Folder, FileCode, Menu, Globe, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { FileEntry } from './types';

// Lazy load the editor for faster page initialization
const JeanEditor = lazy(() => import('./components/Editor'));

/**
 * Main application component for the Jean Playground IDE.
 * Orchestrates file management, compilation offloading, and code execution.
 */
export default function App() {
  const vfs = VFSFactory.getInstance();
  
  // State for project files and UI configuration
  const [files, setFiles] = useState<FileEntry[]>(vfs.getFiles());
  const [activeFileId, setActiveFileId] = useState<string | null>(files[0]?.id || null);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // Default to closed as requested
  const [sidebarWidth, setSidebarWidth] = useState(260);
  const [isSidebarResizing, setIsSidebarResizing] = useState(false);
  const [consoleHeight, setConsoleHeight] = useState(260);
  const [isConsoleResizing, setIsConsoleResizing] = useState(false);
  
  // Worker references for isolated computation
  const compilerRef = useRef<Worker | null>(null);
  const runnerRef = useRef<Worker | null>(null);

  // Output and diagnostic state
  const [output, setOutput] = useState<string[]>([]);
  const [debug, setDebug] = useState<string[]>([]);
  const [wat, setWat] = useState<string>('');
  const [ast, setAst] = useState<any>(null);
  const [wasmHex, setWasmHex] = useState<string>('');
  const [profileData, setProfileData] = useState<{ 
    cycle: number; 
    instructions: number; 
    memory: number; 
    stack: number;
    compileTime: number;
    startupTime: number;
    runtimeTime: number;
  }[]>([]);
  const [sizes, setSizes] = useState({ ast: 0, wat: 0, wasm: 0 });
  const [isRunning, setIsRunning] = useState(false);
  const startTimeRef = useRef<number>(0);

  /**
   * Converts a Uint8Array to a Hexadecimal string for binary inspection.
   */
  const toHex = (buffer: Uint8Array) => {
    return Array.from(buffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join(' ')
      .toUpperCase();
  };

  /**
   * Handles messages from the Runner Worker (execution thread).
   */
  const handleRunnerMessage = useCallback((e: MessageEvent) => {
    const { type, text, status, duration, error } = e.data;

    if (type === 'CONSOLE_LOG') {
      setOutput(prev => [...prev, text]);
    } else if (type === 'CONSOLE_INPUT') {
      setOutput(prev => [...prev, `[INPUT REQUESTED] ${prompt}`]);
    } else if (type === 'DEBUG_LOG') {
      setDebug(prev => [...prev, text]);
    } else if (type === 'STATUS') {
      if (status === 'FINISHED') {
        const endTime = performance.now();
        const runtime = duration;
        const totalDuration = endTime - startTimeRef.current;
        
        setDebug(prev => [...prev, `[System] Program finished in ${runtime.toFixed(2)}ms (Total: ${totalDuration.toFixed(2)}ms).`]);
        
        // Push a simulated profiling block for visualization
        setProfileData(prev => {
           const nextCycle = prev.length + 1;
           const newData = {
              cycle: nextCycle,
              instructions: Math.floor(runtime * 1000 + Math.random() * 500),
              memory: 64 + Math.floor(Math.random() * 128),
              stack: 4 + Math.floor(Math.random() * 8),
              compileTime: prev[prev.length-1]?.compileTime || 0,
              startupTime: totalDuration - runtime - (prev[prev.length-1]?.compileTime || 0),
              runtimeTime: runtime
           };
           return [...prev.slice(-49), newData];
        });
        setIsRunning(false);
      } else if (status === 'ERROR') {
        setDebug(prev => [...prev, `[Runtime Error] ${error}`]);
        setIsRunning(false);
      } else if (status === 'RUNNING') {
        setDebug(prev => [...prev, "[System] Runtime active..."]);
      }
    }
  }, []);

  /**
   * Handles messages from the Compiler Worker (build thread).
   */
  const handleCompilerMessage = useCallback(async (e: MessageEvent) => {
    const { type, result, error } = e.data;
    
    if (type === 'ERROR') {
      setDebug(prev => [...prev, `[Error] ${error}`]);
      setIsRunning(false);
      return;
    }

    const compileDuration = performance.now() - startTimeRef.current;
    
    setWat(result.wat);
    setAst(result.ast);
    if (result.wasmBinary) {
        const wasmArr = new Uint8Array(result.wasmBinary);
        setWasmHex(toHex(wasmArr));
        setSizes({
            ast: JSON.stringify(result.ast).length,
            wat: result.wat.length,
            wasm: wasmArr.length
        });
    }

    if (result.errors && result.errors.length > 0) {
      setDebug(prev => [...prev, ...result.errors.map((err: string) => `[Error] ${err}`)]);
      setIsRunning(false);
      return;
    }

    if (!result.wasmBinary) {
      setDebug(prev => [...prev, "[Error] WASM binary generation failed in worker."]);
      setIsRunning(false);
      return;
    }

    // Update profile data with compile time
    setProfileData(prev => {
        const last = prev[prev.length - 1];
        if (last) {
            last.compileTime = compileDuration;
        }
        return [...prev];
    });

    // Hand off the binary to the Runner Worker for execution
    if (runnerRef.current) {
        setDebug(prev => [...prev, "[System] Handover to runner worker...", "[System] Booting WebAssembly instance..."]);
        runnerRef.current.postMessage({ wasmBinary: result.wasmBinary });
    }
  }, []);

  // Initialize workers and VFS on mount
  useEffect(() => {
    vfs.init().then(() => setFiles(vfs.getFiles()));

    // Compiler Worker (Heavy WABT tasks)
    const compiler = new Worker(new URL('./compiler.worker.ts', import.meta.url), { type: 'module' });
    compiler.onmessage = handleCompilerMessage;
    compilerRef.current = compiler;

    // Runner Worker (WASM Execution tasks)
    const runner = new Worker(new URL('./runner.worker.ts', import.meta.url), { type: 'module' });
    runner.onmessage = handleRunnerMessage;
    runnerRef.current = runner;

    // Keyboard shortcuts
    const handleKeyDown = (e: KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            setDebug(prev => [...prev, "[System] Project auto-saved."]);
        }
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
            e.preventDefault();
            runCode();
        }
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      compiler.terminate();
      runner.terminate();
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleCompilerMessage, handleRunnerMessage]);

  /**
   * Handles sidebar horizontal resizing
   */
  const handleSidebarMove = useCallback((e: MouseEvent) => {
    const newWidth = e.clientX;
    if (newWidth > 150 && newWidth < 600) {
      setSidebarWidth(newWidth);
    }
  }, []);

  const stopSidebarResizing = useCallback(() => {
    setIsSidebarResizing(false);
    document.removeEventListener('mousemove', handleSidebarMove);
    document.removeEventListener('mouseup', stopSidebarResizing);
    document.body.style.cursor = 'default';
  }, [handleSidebarMove]);

  const startSidebarResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsSidebarResizing(true);
    document.addEventListener('mousemove', handleSidebarMove);
    document.addEventListener('mouseup', stopSidebarResizing);
    document.body.style.cursor = 'ew-resize';
  }, [handleSidebarMove, stopSidebarResizing]);

  /**
   * Handles console vertical resizing
   */
  const handleConsoleMove = useCallback((e: MouseEvent) => {
    const newHeight = window.innerHeight - e.clientY;
    if (newHeight > 35 && newHeight < window.innerHeight * 0.9) {
      setConsoleHeight(newHeight);
    }
  }, []);

  const stopConsoleResizing = useCallback(() => {
    setIsConsoleResizing(false);
    document.removeEventListener('mousemove', handleConsoleMove);
    document.removeEventListener('mouseup', stopConsoleResizing);
    document.body.style.cursor = 'default';
  }, [handleConsoleMove]);

  const startConsoleResizing = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsConsoleResizing(true);
    document.addEventListener('mousemove', handleConsoleMove);
    document.addEventListener('mouseup', stopConsoleResizing);
    document.body.style.cursor = 'ns-resize';
  }, [handleConsoleMove, stopConsoleResizing]);

  const activeFile = files.find(f => f.id === activeFileId);

  /**
   * Syncs editor content with the VFS.
   */
  const handleFileChange = (content: string) => {
    if (!activeFileId) return;
    vfs.updateFile(activeFileId, content);
    setFiles(vfs.getFiles());
  };

  /**
   * New file/folder creation logic.
   */
  const handleCreateFile = (name: string, type: 'file' | 'folder') => {
    const newFile = vfs.createFile(name, null, type);
    setFiles(vfs.getFiles());
    if (type === 'file') setActiveFileId(newFile.id);
  };

  const handleRenameFile = (id: string, newName: string) => {
    vfs.renameFile(id, newName);
    setFiles(vfs.getFiles());
  };

  const handleRemoveFile = (id: string) => {
    vfs.removeFile(id);
    const updatedFiles = vfs.getFiles();
    setFiles(updatedFiles);
    if (activeFileId === id) setActiveFileId(updatedFiles[0]?.id || null);
  };

  /**
   * Shares the current project state via URL hash.
   */
  const handleShare = () => {
    try {
      const state = JSON.stringify(files);
      const encoded = btoa(unescape(encodeURIComponent(state)));
      const url = `${window.location.origin}${window.location.pathname}#project=${encoded}`;
      navigator.clipboard.writeText(url).then(() => {
        setDebug(prev => [...prev, "[System] Share link copied to clipboard."]);
        alert("Playground URL copied to clipboard!");
      });
    } catch (e) {
      alert("Share failed: " + (e as Error).message);
    }
  };

  // Import project if provided in hash
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#project=')) {
      try {
        const encoded = hash.substring(9);
        const decoded = decodeURIComponent(escape(atob(encoded)));
        const importedFiles = JSON.parse(decoded) as FileEntry[];
        if (Array.isArray(importedFiles)) {
          vfs.setFiles(importedFiles);
          setFiles(vfs.getFiles());
          if (importedFiles.length > 0) setActiveFileId(importedFiles[0].id);
          setDebug(prev => [...prev, "[System] Restored project state from URL hash."]);
        }
      } catch (e) {
        console.error("Hash import failed:", e);
        setDebug(prev => [...prev, "[Error] Shared link decode failure. The project may be corrupted."]);
      }
    }
  }, []);

  /**
   * Triggers the build and run process.
   */
  const runCode = async () => {
    if (!activeFile || !compilerRef.current || isRunning) return;
    setIsRunning(true);
    setOutput([]);
    setWat('');
    setWasmHex('');
    setDebug(["[System] Starting isolated build task..."]);
    startTimeRef.current = performance.now();
    compilerRef.current.postMessage({ source: activeFile.content });
  };

  return (
    <div className="flex flex-col h-screen bg-[#1e1e1e] text-slate-300 font-sans overflow-hidden selection:bg-emerald-500/30">
      {/* Header with toggle and primary actions */}
      <header className="h-11 bg-[#252526] border-b border-[#3c3c3c] flex items-center justify-between px-4 shrink-0 z-50">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className={`p-1.5 rounded transition-all transition-colors ${isSidebarOpen ? 'bg-[#3c3c3c] text-emerald-500' : 'hover:bg-[#3c3c3c] text-slate-400'}`}
            title="Toggle Explorer"
          >
            <Menu size={18} />
          </button>
          <div className="flex items-center gap-2.5 group cursor-default">
            <div className="p-1 rounded bg-emerald-500 shadow-[0_0_10px_rgba(80,200,120,0.3)] group-hover:scale-110 transition-transform">
                <Zap size={14} className="text-white fill-white" />
            </div>
            <span className="text-[12px] font-black tracking-[0.25em] text-[#eeeeee]">Jean <span className="text-emerald-500 font-bold">IDE</span> <span className="text-[9px] text-slate-500 bg-[#1e1e1e] px-1.5 py-0.5 rounded ml-1 border border-[#3c3c3c]">v0.7</span></span>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <motion.button 
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={runCode}
            disabled={isRunning}
            className={`flex flex-row-reverse items-center gap-2 px-6 py-1.5 rounded text-[11px] font-black tracking-widest transition-all ${
              isRunning ? 'bg-slate-700 text-slate-500' : 'bg-emerald-500 hover:bg-emerald-600 text-[#0c2e17] active:translate-y-0.5'
            }`}
          >
            {isRunning ? <Loader2 size={13} className="animate-spin" /> : <Play size={12} fill="currentColor" />}
            <span>{isRunning ? 'Busy' : 'Run'}</span>
          </motion.button>
          <div className="h-4 w-[1px] bg-[#3c3c3c] mx-1" />
          <button onClick={handleShare} className="p-2 text-slate-400 hover:text-emerald-500 transition-colors" title="Share project link">
            <Share2 size={18} />
          </button>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Animated Sidebar (Explorer) */}
        <AnimatePresence initial={false}>
          {isSidebarOpen && (
            <>
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: sidebarWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: isSidebarResizing ? 0 : 0.2, ease: "easeOut" }}
              className="bg-[#252526] border-r border-[#1e1e1e] flex flex-col h-full overflow-hidden shrink-0 shadow-2xl z-40 relative"
            >
              <Sidebar 
                files={files} 
                activeFileId={activeFileId} 
                onSelectFile={setActiveFileId} 
                onCreateFile={handleCreateFile}
                onRenameFile={handleRenameFile}
                onRemoveFile={handleRemoveFile}
                onShare={handleShare}
                isOpen={true}
                setIsOpen={setIsSidebarOpen}
              />
            </motion.div>
            
            {/* Sidebar Resize Handle */}
            <div 
              onMouseDown={startSidebarResizing}
              className={`w-1 cursor-ew-resize shrink-0 z-50 group hover:bg-emerald-500/30 transition-colors ${isSidebarResizing ? 'bg-emerald-500/50' : 'bg-[#1e1e1e]'}`}
            >
              <div className="absolute top-1/2 -translate-y-1/2 w-full flex flex-col items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                 <div className="w-0.5 h-6 rounded-full bg-emerald-500/40" />
              </div>
            </div>
            </>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col min-w-0 bg-[#0d0d0d] relative shadow-inner">
            <div className="h-9 bg-[#252526] flex items-center overflow-x-auto scrollbar-hide shrink-0 border-b border-[#1e1e1e]">
              {files.filter(f => f.type === 'file').map(file => (
                <div 
                  key={file.id}
                  onClick={() => setActiveFileId(file.id)}
                  className={`flex items-center gap-2 px-4 border-r border-[#1e1e1e] cursor-pointer text-[11px] h-full group relative transition-colors ${
                    activeFileId === file.id ? 'bg-[#1e1e1e] text-slate-100 shadow-[0_-2px_0_inset_#50C878]' : 'bg-[#2d2d2d] text-slate-500 hover:bg-[#333]'
                  }`}
                >
                  <FileCode size={13} className={activeFileId === file.id ? 'text-emerald-500' : 'text-slate-500'} />
                  <span className="truncate flex-1 font-medium tracking-tight">{file.name}</span>
                  <X 
                    size={10} 
                    onClick={(e) => { e.stopPropagation(); handleRemoveFile(file.id); }}
                    className="opacity-0 group-hover:opacity-100 hover:bg-[#3c3c3c] hover:text-red-400 rounded p-0.5 ml-1 transition-all" 
                  />
                </div>
              ))}
            </div>

            <div className="flex-1 flex flex-col overflow-hidden relative">
              <div className="flex-1 relative">
                <Suspense fallback={
                  <div className="flex flex-col items-center justify-center h-full text-slate-500 gap-3 animate-pulse bg-[#0d0d0d]">
                      <Loader2 size={32} className="animate-spin text-emerald-500" />
                      <span className="text-[10px] tracking-[0.3em] font-black uppercase">Ignition Sequence...</span>
                  </div>
                }>
                  {activeFile ? 
                     <JeanEditor content={activeFile.content} onChange={handleFileChange} />
                   : 
                    <div className="flex flex-col items-center justify-center h-full text-slate-800 bg-[#0d0d0d]">
                       <div className="relative mb-6">
                          <Folder size={80} className="opacity-5" />
                          <Zap size={32} className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-500 opacity-20" />
                       </div>
                       <div className="text-[10px] tracking-[0.4em] font-black opacity-50">Select Code Entry to begin</div>
                    </div>
                  }
                </Suspense>
              </div>

              <Console 
                output={output} 
                debug={debug} 
                ast={ast}
                wat={wat} 
                wasmHex={wasmHex}
                profileData={profileData} 
                sizes={sizes}
                isRunning={isRunning}
                height={consoleHeight}
                setHeight={setConsoleHeight}
                isResizing={isConsoleResizing}
                onResizeStart={startConsoleResizing}
              />
            </div>
          </div>
        </div>
      </div>
  );
}
