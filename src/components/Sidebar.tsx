/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { FileEntry } from '../types';
import { 
  File, 
  Folder, 
  Plus, 
  FileCode, 
  FolderPlus, 
  Download, 
  Upload, 
  X, 
  Edit2, 
  Trash2, 
  Share2, 
  MoreVertical,
  RotateCcw,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { exportAsZip } from '../vfs';

interface SidebarProps {
  files: FileEntry[];
  activeFileId: string | null;
  onSelectFile: (id: string) => void;
  onCreateFile: (name: string, type: 'file' | 'folder') => void;
  onRenameFile: (id: string, newName: string) => void;
  onRemoveFile: (id: string) => void;
  onShare: () => void;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

/**
 * Sidebar component for file system navigation and management.
 * Provides functionality for creating, renaming, and deleting files and folders.
 */
export const Sidebar: React.FC<SidebarProps> = ({ 
  files, 
  activeFileId, 
  onSelectFile, 
  onCreateFile, 
  onRenameFile,
  onRemoveFile,
}) => {
  const handleRename = (id: string, currentName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newName = prompt('New name:', currentName);
    if (newName && newName !== currentName) {
      onRenameFile(id, newName);
    }
  };

  const handleRemove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm('Are you sure you want to delete this?')) {
      onRemoveFile(id);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#252526] text-slate-400 font-sans select-none w-full border-r border-[#1e1e1e]">
      <div className="px-4 py-2 flex justify-between items-center h-11 border-b border-[#1e1e1e] bg-[#252526]">
        <span className="text-[10px] font-black tracking-[0.2em] text-slate-500">Explorer</span>
        <div className="flex gap-1 items-center">
          <button 
            title="New File"
            onClick={() => {
              const name = prompt('File name:', 'main.je');
              if (name) onCreateFile(name, 'file');
            }} 
            className="p-1.5 hover:bg-[#37373d] rounded text-slate-400 hover:text-emerald-500 transition-all border border-transparent hover:border-emerald-500/20"
          >
            <Plus size={16} />
          </button>
          <button 
            title="New Folder"
            onClick={() => {
              const name = prompt('Folder name:', 'src');
              if (name) onCreateFile(name, 'folder');
            }} 
            className="p-1.5 hover:bg-[#37373d] rounded text-slate-400 hover:text-emerald-500 transition-all border border-transparent hover:border-emerald-500/20"
          >
            <FolderPlus size={16} />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto py-2 scrollbar-thin">
        <div className="px-4 mb-2">
           <div className="flex items-center gap-1.5 text-[11px] font-black text-emerald-500/80 tracking-widest">
              <ChevronDown size={14} />
              <span>Project</span>
           </div>
        </div>
        <AnimatePresence initial={false}>
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => onSelectFile(file.id)}
              className={`group flex items-center gap-3 px-5 py-1.5 cursor-pointer relative transition-all ${
                activeFileId === file.id 
                    ? 'bg-emerald-500/10 text-emerald-400' 
                    : 'hover:bg-[#2a2d2e] text-slate-400 hover:text-white'
              }`}
            >
              {activeFileId === file.id && <div className="absolute left-0 top-0 bottom-0 w-[2.5px] bg-emerald-500 shadow-[2px_0_10px_rgba(80,200,120,0.4)]" />}
              {file.type === 'folder' ? (
                <Folder size={14} className="text-slate-600" />
              ) : (
                <FileCode size={14} className={activeFileId === file.id ? 'text-emerald-500' : 'text-slate-500'} />
              )}
              <span className={`text-[12px] truncate flex-1 ${activeFileId === file.id ? 'font-black' : 'font-medium'}`}>{file.name}</span>
              
              <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleRename(file.id, file.name, e)}
                  title="Rename"
                  className="p-1 hover:bg-[#3c3c3c] rounded text-slate-500 hover:text-emerald-400"
                >
                  <Edit2 size={12} />
                </button>
                <button 
                  onClick={(e) => handleRemove(file.id, e)}
                  title="Delete"
                  className="p-1 hover:bg-[#3c3c3c] rounded text-slate-500 hover:text-red-400"
                >
                  <Trash2 size={12} />
                </button>
              </div>
            </div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};
