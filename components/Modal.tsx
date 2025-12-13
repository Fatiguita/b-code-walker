
import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon, CheckIcon, ExclamationTriangleIcon, InformationCircleIcon } from './Icons';

export type ModalType = 'info' | 'confirm' | 'prompt' | 'danger';

interface ModalProps {
  isOpen: boolean;
  type: ModalType;
  title: string;
  message?: string;
  initialValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: (value?: string) => void;
  onClose: () => void;
}

export const Dialog: React.FC<ModalProps> = ({
  isOpen,
  type,
  title,
  message,
  initialValue = '',
  placeholder = '',
  confirmText = 'OK',
  cancelText = 'Cancel',
  onConfirm,
  onClose
}) => {
  const [inputValue, setInputValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setInputValue(initialValue);
      // Focus input on prompt open
      if (type === 'prompt') {
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    }
  }, [isOpen, initialValue, type]);

  if (!isOpen) return null;

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    onConfirm(inputValue);
    onClose();
  };

  const isDanger = type === 'danger';

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div 
        className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all scale-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className={`p-4 border-b border-[var(--border-color)] flex justify-between items-center ${isDanger ? 'bg-red-900/20' : 'bg-[var(--bg-tertiary)]'}`}>
          <div className="flex items-center gap-2">
            {isDanger ? <ExclamationTriangleIcon className="w-5 h-5 text-red-400" /> : <InformationCircleIcon className="w-5 h-5 text-blue-400" />}
            <h3 className={`font-bold ${isDanger ? 'text-red-400' : 'text-[var(--text-primary)]'}`}>{title}</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded text-[var(--text-secondary)]">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {message && (
            <p className="text-sm text-[var(--text-secondary)] mb-4 leading-relaxed whitespace-pre-wrap">
              {message}
            </p>
          )}

          {type === 'prompt' && (
            <form onSubmit={handleSubmit}>
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder={placeholder}
                className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 transition-colors"
              />
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 bg-[var(--bg-tertiary)]/50 border-t border-[var(--border-color)] flex justify-end gap-2">
          {type !== 'info' && (
            <button 
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium rounded text-[var(--text-secondary)] hover:bg-[var(--bg-primary)] hover:text-[var(--text-primary)] transition-colors"
            >
              {cancelText}
            </button>
          )}
          
          <button 
            onClick={() => handleSubmit()}
            className={`
              px-4 py-2 text-xs font-medium rounded text-white flex items-center gap-2 transition-colors
              ${isDanger 
                ? 'bg-red-600 hover:bg-red-700' 
                : 'bg-blue-600 hover:bg-blue-700'}
            `}
          >
            {confirmText}
            <CheckIcon className="w-3 h-3" />
          </button>
        </div>
      </div>
    </div>
  );
};

