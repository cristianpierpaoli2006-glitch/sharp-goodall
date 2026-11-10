import React, { useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/utils/cn';
import { Button } from './Button';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  showClose?: boolean;
  fullScreen?: boolean;
}

export function Modal({ isOpen, onClose, title, children, className, showClose = true, fullScreen = false }: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.showModal();
      document.body.style.overflow = 'hidden';
    } else {
      dialogRef.current?.close();
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className={cn(
        'fixed inset-0 z-50 m-auto bg-transparent p-0',
        'backdrop:bg-black/70 backdrop:backdrop-blur-sm',
        fullScreen && 'max-w-full max-h-full w-full h-full'
      )}
      onClose={onClose}
      onClick={(e) => { if (e.target === dialogRef.current) onClose(); }}
    >
      <div className={cn(
        'relative bg-surface-100 border border-surface-300/50 rounded-3xl animate-slide-up',
        fullScreen
          ? 'w-full h-full rounded-none flex flex-col'
          : 'w-[calc(100vw-2rem)] max-w-sm mx-auto',
        className
      )}>
        {(title || showClose) && (
          <div className="flex items-center justify-between p-4 border-b border-surface-300/30">
            {title && (
              <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            )}
            {showClose && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onClose}
                className="ml-auto"
                aria-label="Chiudi"
              >
                <X size={20} />
              </Button>
            )}
          </div>
        )}
        <div className={cn('overflow-y-auto', fullScreen && 'flex-1')}>
          {children}
        </div>
      </div>
    </dialog>
  );
}

// Bottom Sheet (slide up dal basso, stile iOS)
interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function BottomSheet({ isOpen, onClose, title, children, className }: BottomSheetProps) {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className={cn(
        'relative bg-surface-100 border-t border-surface-300/50 rounded-t-3xl',
        'animate-slide-up',
        'max-h-[90vh] max-h-[90dvh] overflow-hidden flex flex-col',
        className
      )}>
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 bg-surface-400 rounded-full" />
        </div>
        {title && (
          <div className="flex items-center justify-between px-4 pb-3 flex-shrink-0">
            <h2 className="text-base font-semibold text-slate-100">{title}</h2>
            <Button variant="ghost" size="icon" onClick={onClose} aria-label="Chiudi">
              <X size={20} />
            </Button>
          </div>
        )}
        <div className="overflow-y-auto flex-1 pb-safe">
          {children}
        </div>
      </div>
    </div>
  );
}
