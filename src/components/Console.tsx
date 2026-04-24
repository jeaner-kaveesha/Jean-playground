/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useCallback, useRef } from 'react';
import { Terminal, Bug, Cpu, BarChart3, ChevronDown, ChevronUp, RotateCcw, Copy, Download, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

// CodeMirror for WAT view
import CodeMirror from '@uiw/react-codemirror';
import { wast } from '@codemirror/lang-wast';
import { json } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

/**
 * Represents the diagnostic and output panel of the IDE.
 * Includes terminal output, debug logs, build artifacts, and execution profiling.
 */

interface ConsoleProps {
  output: string[];
  debug: string[];
  ast: any;
  wat: string;
  wasmHex: string;
  profileData: { 
    cycle: number; 
    instructions: number; 
    memory: number; 
    stack: number;
    compileTime: number;
    startupTime: number;
    runtimeTime: number;
  }[];
  sizes: { ast: number; wat: number; wasm: number };
  isRunning: boolean;
  height: number;
  setHeight: (h: number) => void;
  isResizing: boolean;
  onResizeStart: (e: React.MouseEvent) => void;
}

export const Console: React.FC<ConsoleProps> = ({ 
  output, 
  debug, 
  wat, 
  wasmHex,
  ast,
  profileData, 
  sizes,
  isRunning,
  height,
  setHeight,
  isResizing,
  onResizeStart
}) => {
  const [activeTab, setActiveTab] = useState<'output' | 'debug' | 'build' | 'profile'>('output');
  const [buildTab, setBuildTab] = useState<'ast' | 'wat' | 'wasm'>('ast');
  const [debugTab, setDebugTab] = useState<'log' | 'watch' | 'stack'>('log');
  const [copiedTab, setCopiedTab] = useState<string | null>(null);
  const [prevHeight, setPrevHeight] = useState(height);

  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedTab(id);
    setTimeout(() => setCopiedTab(null), 2000);
  };

  const handleDownloadWasm = () => {
    if (!wasmHex) return;
    const bytes = new Uint8Array(wasmHex.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const blob = new Blob([bytes], { type: 'application/wasm' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'jean_program.wasm';
    a.click();
    URL.revokeObjectURL(url);
  };

  const toggleCollapse = () => {
    if (height > 35) {
      setPrevHeight(height);
      setHeight(34);
    } else {
      setHeight(prevHeight || 260);
    }
  };

  const tabs = [
    { id: 'output', label: 'Output', icon: <Terminal size={12} /> },
    { id: 'debug', label: 'Debug', icon: <Bug size={12} /> },
    { id: 'build', label: 'Build', icon: <Cpu size={12} /> },
    { id: 'profile', label: 'Profile', icon: <BarChart3 size={12} /> },
  ];

  const chartData = {
    labels: profileData.map(d => d.cycle),
    datasets: [
      {
        label: 'Instructions',
        data: profileData.map(d => d.instructions),
        borderColor: '#50C878',
        backgroundColor: 'rgba(80, 200, 120, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 2,
      },
      {
        label: 'Memory (KB)',
        data: profileData.map(d => d.memory),
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 2,
      },
      {
        label: 'Stack Depth',
        data: profileData.map(d => d.stack),
        borderColor: '#f59e0b',
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        pointRadius: 2,
      }
    ],
  };

  const chartOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { 
        display: true, 
        position: 'top' as const,
        labels: { color: '#888', font: { size: 10 }, usePointStyle: true, padding: 15 }
      },
      tooltip: {
        backgroundColor: '#1e1e1e',
        titleColor: '#50C878',
        bodyColor: '#fff',
        borderColor: '#3c3c3c',
        borderWidth: 1,
        padding: 10,
        intersect: false,
        mode: 'index' as const,
      },
    },
    scales: {
      y: { 
        grid: { color: '#2d2d2d' }, 
        ticks: { color: '#64748b', font: { size: 9 } },
        beginAtZero: true
      },
      x: { 
        grid: { color: '#2d2d2d' }, 
        ticks: { color: '#64748b', font: { size: 9 } } 
      },
    }
  };

  const latestProfile = profileData[profileData.length - 1] || { 
    compileTime: 0, 
    startupTime: 0, 
    runtimeTime: 0,
    instructions: 0,
    memory: 0,
    stack: 0
  };

  return (
    <div 
      style={{ height: `${height}px` }}
      className={`flex flex-col bg-[#1e1e1e] border-t border-[#3c3c3c] ${!isResizing ? 'transition-[height] duration-150 ease-out' : ''} z-20 relative`}
    >
      {/* High-visibility Resize Handle (The Resizable Line) */}
      <div 
        onMouseDown={onResizeStart}
        className={`absolute top-0 left-0 right-0 h-1 cursor-ns-resize z-50 group`}
        title="Drag to resize panel"
      >
          {/* Hit area extension - invisible but clickable */}
          <div className="absolute -top-1 left-0 right-0 h-4" />
          
          <div className={`absolute top-0 left-0 right-0 h-[2px] transition-all duration-200 ${isResizing ? 'bg-emerald-500 opacity-100 shadow-[0_0_15px_rgba(80,200,120,0.4)]' : 'bg-transparent group-hover:bg-emerald-500/40 opacity-0 group-hover:opacity-100'}`} />
          <div className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity`}>
              <div className="w-16 h-[3px] rounded-full bg-emerald-500/30" />
          </div>
      </div>

      <div className="flex items-center justify-between px-3 bg-[#252526] h-9 select-none border-b border-[#3c3c3c] shrink-0 font-sans">
        <div className="flex h-full items-center">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id as any); }}
              className={`flex items-center gap-1.5 h-full text-[11px] tracking-wide transition-all relative px-3 ${
                activeTab === tab.id 
                    ? 'text-slate-100 font-bold' 
                    : 'text-slate-500 hover:text-slate-300'
              }`}
            >
              <span className={activeTab === tab.id ? 'text-emerald-500' : 'text-slate-500'}>{tab.icon}</span>
              {tab.label}
              {activeTab === tab.id && (
                <div className="absolute bottom-0 left-0 right-0 h-[1.5px] bg-emerald-500" />
              )}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
            <button 
                onClick={toggleCollapse}
                className="p-1 hover:bg-[#3c3c3c] rounded text-slate-500 hover:text-slate-100 transition-colors"
                title={height > 35 ? "Collapse Console" : "Expand Console"}
            >
                {height > 35 ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
            </button>
            <div className="text-[9px] text-slate-600 font-mono tracking-widest bg-[#1e1e1e] px-2 py-0.5 rounded border border-[#3c3c3c]">
                {isRunning ? 'RUNNING_SYNC' : 'ENGINE_IDLE'}
            </div>
        </div>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex-1 overflow-hidden p-3 font-mono text-[12px] leading-relaxed relative"
          >
            {activeTab === 'output' && (
              <div className="space-y-0.5 h-full overflow-auto scrollbar-thin scroll-smooth select-text selection:bg-emerald-500/20">
                {output.length === 0 ? (
                  <div className="flex items-center justify-center h-full gap-2 text-slate-600 opacity-40 uppercase tracking-[0.2em] text-[10px]">
                     <Terminal size={18} />
                     <span>No execution output record</span>
                  </div>
                ) : (
                  output.map((line, i) => (
                    <div key={i} className="flex gap-3 animate-slide-up">
                         <span className="text-emerald-500/40 font-bold tracking-tight select-none">❯</span>
                         <span className="text-slate-200">{line}</span>
                    </div>
                  ))
                )}
                {isRunning && (
                  <div className="flex gap-2 animate-pulse mt-2 text-emerald-500">
                    <span>█</span>
                  </div>
                )}
              </div>
            )}
            {activeTab === 'debug' && (
              <div className="absolute inset-0 flex flex-col p-3 bg-[#1e1e1e]">
                <div className="flex w-full mb-3 bg-[#252526] rounded border border-[#3c3c3c] overflow-hidden p-0.5">
                    <button 
                        onClick={() => setDebugTab('log')}
                        className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-1.5 rounded transition-all ${debugTab === 'log' ? 'bg-[#3c3c3c] text-emerald-500 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                    >Log</button>
                    <button 
                        onClick={() => setDebugTab('watch')}
                        className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-1.5 rounded transition-all ${debugTab === 'watch' ? 'bg-[#3c3c3c] text-emerald-500 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                    >Watch</button>
                    <button 
                        onClick={() => setDebugTab('stack')}
                        className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-1.5 rounded transition-all ${debugTab === 'stack' ? 'bg-[#3c3c3c] text-emerald-500 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                    >Stack</button>
                </div>
                <div className="flex-1 overflow-auto scrollbar-thin">
                    {debugTab === 'log' && (
                        <div className="space-y-1 tracking-tight text-[11px]">
                            {debug.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-slate-700 opacity-40">Empty log</div>
                            ) : (
                                debug.map((line, i) => {
                                    let borderColor = 'border-l-slate-600';
                                    let textColor = 'text-slate-400';
                                    let bgColor = 'bg-[#252526]/30';

                                    const lower = line.toLowerCase();
                                    if (lower.includes('success') || lower.includes('finished')) {
                                        borderColor = 'border-l-emerald-500';
                                        textColor = 'text-emerald-400';
                                        bgColor = 'bg-emerald-500/5';
                                    } else if (lower.includes('error') || lower.includes('failed')) {
                                        borderColor = 'border-l-red-500';
                                        textColor = 'text-red-400';
                                        bgColor = 'bg-red-500/5';
                                    } else if (lower.includes('warning')) {
                                        borderColor = 'border-l-yellow-500';
                                        textColor = 'text-yellow-400';
                                        bgColor = 'bg-yellow-500/5';
                                    } else if (lower.includes('info') || lower.includes('[system]')) {
                                        borderColor = 'border-l-blue-500';
                                        textColor = 'text-blue-400';
                                        bgColor = 'bg-blue-500/5';
                                    }

                                    return (
                                        <div key={i} className="flex gap-3 items-start group animate-slide-up">
                                            <span className="text-[#3c3c3c] font-bold min-w-[14px] text-right text-[10px] select-none">{i+1}</span>
                                            <div className={`px-3 py-1.5 rounded border border-[#3c3c3c] border-l-4 shadow-sm flex-1 ${bgColor} ${borderColor} ${textColor} transition-colors group-hover:bg-[#2a2a2b]`}>
                                                {line}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    )}
                    {debugTab === 'watch' && (
                        <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-30 space-y-2">
                             <Bug size={32} strokeWidth={1} />
                             <span className="text-[10px] uppercase font-black tracking-[0.3em]">No variables tracked</span>
                        </div>
                    )}
                    {debugTab === 'stack' && (
                         <div className="flex flex-col items-center justify-center h-full text-slate-600 opacity-30 space-y-2">
                            <RotateCcw size={32} strokeWidth={1} />
                            <span className="text-[10px] uppercase font-black tracking-[0.3em]">Stack trace empty</span>
                        </div>
                    )}
                </div>
              </div>
            )}
            {activeTab === 'build' && (
              <div className="absolute inset-0 flex flex-col p-3 bg-[#1e1e1e]">
                <div className="flex w-full mb-3 bg-[#252526] rounded border border-[#3c3c3c] overflow-hidden p-0.5 relative">
                    <button 
                        onClick={() => setBuildTab('ast')}
                        className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-1.5 rounded transition-all ${buildTab === 'ast' ? 'bg-[#3c3c3c] text-emerald-500 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                    >AST</button>
                    <button 
                        onClick={() => setBuildTab('wat')}
                        className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-1.5 rounded transition-all border-x border-[#3c3c3c] ${buildTab === 'wat' ? 'bg-[#3c3c3c] text-emerald-500 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                    >WAT</button>
                    <button 
                        onClick={() => setBuildTab('wasm')}
                        className={`flex-1 text-[10px] uppercase font-bold tracking-widest py-1.5 rounded transition-all ${buildTab === 'wasm' ? 'bg-[#3c3c3c] text-emerald-500 shadow-inner' : 'text-slate-500 hover:text-slate-300'}`}
                    >WASM</button>

                    {/* Action Buttons */}
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-2">
                        {buildTab !== 'wasm' ? (
                            <button 
                                onClick={() => handleCopy(buildTab === 'ast' ? JSON.stringify(ast, null, 2) : wat, buildTab)}
                                className="p-1 px-2 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-500 transition-all flex items-center gap-1.5 border border-emerald-500/20 hover:scale-105 active:scale-95"
                                title="Copy to clipboard"
                            >
                                {copiedTab === buildTab ? <Check size={10} /> : <Copy size={10} />}
                                <span className="text-[8px] font-black uppercase tracking-tighter">{copiedTab === buildTab ? 'Copied' : 'Copy'}</span>
                            </button>
                        ) : (
                            <button 
                                onClick={handleDownloadWasm}
                                className="p-1 px-2 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 transition-all flex items-center gap-1.5 border border-blue-500/20 hover:scale-105 active:scale-95"
                                title="Download .wasm binary"
                                disabled={!wasmHex}
                            >
                                <Download size={10} />
                                <span className="text-[8px] font-black uppercase tracking-tighter">Download</span>
                            </button>
                        )}
                    </div>
                </div>
                <div className="flex-1 rounded border border-[#3c3c3c] overflow-hidden bg-[#0d0d0d] selection:bg-emerald-500/30">
                  {buildTab === 'ast' ? (
                     <CodeMirror
                        value={ast ? JSON.stringify(ast, null, 2) : "// Compile to generate AST view."}
                        height="100%"
                        theme={oneDark}
                        extensions={[json()]}
                        editable={false}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLine: false,
                        }}
                        className="h-full text-[11px]"
                    />
                  ) : buildTab === 'wat' ? (
                    <CodeMirror
                        value={wat || ";; No WAT data available."}
                        height="100%"
                        theme={oneDark}
                        extensions={[wast()]}
                        editable={false}
                        basicSetup={{
                            lineNumbers: true,
                            foldGutter: true,
                            highlightActiveLine: false,
                            tabSize: 2,
                        }}
                        className="h-full text-[11px]"
                    />
                  ) : (
                    <div className="p-4 text-[10px] leading-relaxed break-all text-emerald-500/60 font-mono overflow-auto h-full scrollbar-thin">
                        {wasmHex ? (
                           <div className="grid grid-cols-8 gap-2 uppercase tracking-widest">
                               {wasmHex.match(/.{1,2}/g)?.map((byte, i) => (
                                   <span key={i} className="hover:text-emerald-400 transition-colors cursor-default">{byte}</span>
                               ))}
                           </div>
                        ) : ">> HEX View unavailable."}
                    </div>
                  )}
                </div>
              </div>
            )}
            {activeTab === 'profile' && (
              <div className="h-full flex flex-col gap-4 overflow-hidden animate-fade-in">
                <div className="grid grid-cols-4 gap-3 shrink-0">
                  <div className="bg-[#252526] p-3 rounded border border-[#3c3c3c] group hover:border-emerald-500/50 transition-colors shadow-lg flex flex-col justify-between">
                    <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase block mb-2 border-b border-[#3c3c3c] pb-1">Code Size</span>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400 uppercase tracking-tighter">AST</span><span className="font-bold">{((sizes?.ast || 0)/1024).toFixed(2)} KB</span></div>
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400 uppercase tracking-tighter">WAT</span><span className="font-bold">{((sizes?.wat || 0)/1024).toFixed(2)} KB</span></div>
                        <div className="flex justify-between text-[10px]"><span className="text-emerald-500 uppercase tracking-tighter">WASM</span><span className="font-bold">{((sizes?.wasm || 0)/1024).toFixed(2)} KB</span></div>
                    </div>
                  </div>
                  <div className="bg-[#252526] p-3 rounded border border-[#3c3c3c] group hover:border-blue-500/50 transition-colors shadow-lg flex flex-col justify-between">
                    <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase block mb-2 border-b border-[#3c3c3c] pb-1">Times (ms)</span>
                    <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400 uppercase tracking-tighter">Compile</span><span className="font-bold text-blue-400">{(latestProfile.compileTime || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-[10px]"><span className="text-slate-400 uppercase tracking-tighter">Startup</span><span className="font-bold text-blue-400">{(latestProfile.startupTime || 0).toFixed(2)}</span></div>
                        <div className="flex justify-between text-[10px]"><span className="text-blue-500 font-bold uppercase tracking-tighter">Run</span><span className="font-bold text-emerald-500">{(latestProfile.runtimeTime || 0).toFixed(2)}</span></div>
                    </div>
                  </div>
                  <div className="col-span-2 bg-[#252526] p-3 rounded border border-[#3c3c3c] flex flex-col shadow-lg">
                    <span className="text-[9px] font-black text-slate-500 tracking-widest uppercase block mb-2 border-b border-[#3c3c3c] pb-1">System Load</span>
                    <div className="flex-1 flex items-center justify-around">
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-black">OPS/SEC</span>
                            <span className="text-xl font-bold text-emerald-500 font-mono">{(latestProfile.instructions / Math.max(0.001, (latestProfile.runtimeTime || 0) / 1000)).toLocaleString(undefined, {maximumFractionDigits: 0})}</span>
                        </div>
                        <div className="w-[1px] h-8 bg-[#3c3c3c]" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Memory</span>
                            <span className="text-xl font-bold text-blue-400 font-mono">{(latestProfile.memory || 0).toFixed(1)} <span className="text-[10px]">KB</span></span>
                        </div>
                        <div className="w-[1px] h-8 bg-[#3c3c3c]" />
                        <div className="flex flex-col items-center">
                            <span className="text-[10px] text-slate-500 uppercase font-black">Stack</span>
                            <span className="text-xl font-bold text-yellow-500 font-mono">{latestProfile.stack || 0} <span className="text-[10px]">LVL</span></span>
                        </div>
                    </div>
                  </div>
                </div>
                <div className="flex-1 min-h-[140px] bg-[#0d0d0d] rounded p-4 border border-[#2d2d2d] relative shadow-inner overflow-hidden">
                  <Line data={chartData} options={chartOptions} />
                  <div className="absolute top-14 right-4 flex flex-col items-end gap-1 pointer-events-none">
                     <div className="bg-[#252526]/80 backdrop-blur-md px-3 py-1.5 rounded border border-[#3c3c3c] flex flex-col gap-0.5 shadow-xl">
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                            <span className="text-[10px] font-black text-emerald-500 tracking-wide">AGGREGATED USAGE</span>
                        </div>
                        <span className="text-[18px] font-black text-slate-200 leading-none">{(profileData.reduce((acc, curr) => acc + curr.instructions, 0)).toLocaleString()} <span className="text-[10px] text-slate-500 font-normal">INST.</span></span>
                     </div>
                  </div>
                </div>
              </div>
            )}
          </motion.div>
      </AnimatePresence>
    </div>
  );
};
