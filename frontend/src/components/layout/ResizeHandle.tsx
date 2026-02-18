import { useState, useCallback, useEffect } from 'react';

interface ResizeHandleProps {
  side: 'left' | 'right';
  onResize: (delta: number) => void;
}

export function ResizeHandle({ side, onResize }: ResizeHandleProps) {
  const [isResizing, setIsResizing] = useState(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    document.body.style.cursor = side === 'left' ? 'ew-resize' : 'ew-resize';
    document.body.style.userSelect = 'none';
  }, [side]);

  useEffect(() => {
    if (!isResizing) return;

    let lastX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      if (lastX === 0) {
        lastX = e.clientX;
        return;
      }

      const delta = e.clientX - lastX;
      lastX = e.clientX;

      // For left handle, moving right increases width (positive delta)
      // For right handle, moving left increases width (negative delta)
      const resizeDelta = side === 'left' ? delta : -delta;
      onResize(resizeDelta);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, side, onResize]);

  return (
    <div
      className={`resize-handle resize-handle-${side} ${isResizing ? 'resizing' : ''}`}
      onMouseDown={handleMouseDown}
      title="Drag to resize"
    />
  );
}
