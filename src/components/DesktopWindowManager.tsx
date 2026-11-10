import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Minus,
  Maximize2,
  Minimize2,
  X,
  Layers,
  LayoutGrid,
  Eye,
  EyeOff,
  LayoutDashboard,
  AppWindow,
  Monitor,
  ChevronsUpDown,
  Move,
  Grid2X2,
  Columns2,
  Columns3,
  Rows2,
  PanelLeftClose,
  PanelLeftOpen,
  PanelRightClose,
  PanelRightOpen,
  Menu
} from 'lucide-react';
import AlertsNotificationBell from './AlertsNotificationBell';

export interface DesktopWindow {
  id: string;
  view: string;
  title: string;
  badge: string;
  badgeColor: string;
  isMinimized: boolean;
  isMaximized: boolean;
  zIndex: number;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

// Window Mode Context to indicate whether content is hosted inside an MDI Desktop Window
export const WindowModeContext = React.createContext<boolean>(false);

export function useIsInWindow(explicitProp?: boolean): boolean {
  const inContext = React.useContext(WindowModeContext);
  if (explicitProp !== undefined) return explicitProp;
  return inContext;
}

interface DesktopWindowManagerProps {
  windows: DesktopWindow[];
  activeWindowId: string | null;
  onFocusWindow: (id: string) => void;
  onCloseWindow: (id: string) => void;
  onMinimizeWindow: (id: string) => void;
  onRestoreWindow: (id: string) => void;
  onToggleMaximize: (id: string) => void;
  onUpdatePosition: (id: string, x: number, y: number) => void;
  onUpdateDimensions?: (id: string, width: number, height: number, x?: number, y?: number) => void;
  onBatchUpdateWindows?: (updater: (prev: DesktopWindow[]) => DesktopWindow[]) => void;
  onMinimizeAll: () => void;
  onRestoreAll: () => void;
  onCloseAll: () => void;
  onCascadeWindows: () => void;
  onTileWindows: () => void;
  onShowDashboard: () => void;
  renderContent: (view: string, windowId: string) => React.ReactNode;
  language: 'ar' | 'en';
  isRtl: boolean;
  isMultiWindowMode: boolean;
  onToggleMultiWindowMode: () => void;
  backgroundContent: React.ReactNode;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onNavigate?: (screen: string) => void;
}

// Snapping & Layouts state
interface SnapGhostZone {
  type: string;
  label: string;
  style: React.CSSProperties;
  x: number;
  y: number;
  width: number;
  height: number;
  isMaximize?: boolean;
}

// Memoized window content wrapper to prevent heavy re-renders when other windows change
const WindowContentWrapper = React.memo<{
  view: string;
  windowId: string;
  renderContent: (view: string, windowId: string) => React.ReactNode;
}>(({ view, windowId, renderContent }) => {
  return <>{renderContent(view, windowId)}</>;
}, (prev, next) => prev.view === next.view && prev.windowId === next.windowId);

export const DesktopWindowManager: React.FC<DesktopWindowManagerProps> = ({
  windows,
  activeWindowId,
  onFocusWindow,
  onCloseWindow,
  onMinimizeWindow,
  onRestoreWindow,
  onToggleMaximize,
  onUpdatePosition,
  onUpdateDimensions,
  onBatchUpdateWindows,
  onMinimizeAll,
  onRestoreAll,
  onCloseAll,
  onCascadeWindows,
  onTileWindows,
  onShowDashboard,
  renderContent,
  language,
  isRtl,
  isMultiWindowMode,
  onToggleMultiWindowMode,
  backgroundContent,
  isSidebarOpen = true,
  onToggleSidebar,
  onNavigate
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const windowRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const windowsRef = useRef(windows);
  windowsRef.current = windows;
  const isRtlRef = useRef(isRtl);
  isRtlRef.current = isRtl;

  // Dragging state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const dragPosRef = useRef<{ x: number; y: number } | null>(null);

  // Resizing state
  const [resizingId, setResizingId] = useState<string | null>(null);
  const resizeRef = useRef<{
    handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origWidth: number;
    origHeight: number;
  } | null>(null);
  const resizeDimsRef = useRef<{ width: number; height: number; x: number; y: number } | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const [snapGhostZone, setSnapGhostZone] = useState<SnapGhostZone | null>(null);
  const snapGhostZoneRef = useRef<SnapGhostZone | null>(null);
  const [openSnapMenuId, setOpenSnapMenuId] = useState<string | null>(null);
  const [showGridMenu, setShowGridMenu] = useState<boolean>(false);

  // Close menus when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-snap-menu]') && !target.closest('[data-snap-trigger]')) {
        setOpenSnapMenuId(null);
      }
      if (!target.closest('[data-grid-menu]') && !target.closest('[data-grid-trigger]')) {
        setShowGridMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Snapping a single window to a specific preset
  const snapWindowTo = useCallback((id: string, snapType: string) => {
    const container = containerRef.current;
    const contW = container?.clientWidth || window.innerWidth;
    const contH = (container?.clientHeight || window.innerHeight) - 44;
    const win = windows.find(w => w.id === id);
    if (!win) return;

    onFocusWindow(id);
    setOpenSnapMenuId(null);

    if (snapType === 'maximize') {
      if (!win.isMaximized) {
        onToggleMaximize(id);
      }
      return;
    }

    if (win.isMaximized) {
      onToggleMaximize(id);
    }

    let w = Math.round(contW * 0.5);
    let h = contH;
    let x = 0;
    let y = 0;

    switch (snapType) {
      case 'left-half':
        w = Math.round(contW * 0.5);
        h = contH;
        x = 0;
        y = 0;
        break;

      case 'right-half':
        w = contW - Math.round(contW * 0.5);
        h = contH;
        x = Math.round(contW * 0.5);
        y = 0;
        break;

      case 'top-half':
        w = contW;
        h = Math.round(contH * 0.5);
        x = 0;
        y = 0;
        break;

      case 'bottom-half':
        w = contW;
        h = contH - Math.round(contH * 0.5);
        x = 0;
        y = Math.round(contH * 0.5);
        break;

      case 'top-left':
        w = Math.round(contW * 0.5);
        h = Math.round(contH * 0.5);
        x = 0;
        y = 0;
        break;

      case 'top-right':
        w = contW - Math.round(contW * 0.5);
        h = Math.round(contH * 0.5);
        x = Math.round(contW * 0.5);
        y = 0;
        break;

      case 'bottom-left':
        w = Math.round(contW * 0.5);
        h = contH - Math.round(contH * 0.5);
        x = 0;
        y = Math.round(contH * 0.5);
        break;

      case 'bottom-right':
        w = contW - Math.round(contW * 0.5);
        h = contH - Math.round(contH * 0.5);
        x = Math.round(contW * 0.5);
        y = Math.round(contH * 0.5);
        break;

      case 'col-left':
        w = Math.round(contW / 3);
        h = contH;
        x = 0;
        y = 0;
        break;

      case 'col-center':
        w = Math.round(contW / 3);
        h = contH;
        x = Math.round(contW / 3);
        y = 0;
        break;

      case 'col-right':
        w = contW - Math.round(contW / 3) * 2;
        h = contH;
        x = Math.round(contW / 3) * 2;
        y = 0;
        break;

      case 'center':
      default:
        w = Math.min(Math.round(contW * 0.78), 1200);
        h = Math.min(Math.round(contH * 0.85), 820);
        x = Math.max(0, Math.round((contW - w) / 2));
        y = Math.max(0, Math.round((contH - h) / 2));
        break;
    }

    if (onUpdateDimensions) {
      onUpdateDimensions(id, w, h, x, y);
    }
  }, [windows, onFocusWindow, onToggleMaximize, onUpdateDimensions]);

  // Applying full workspace grid layouts to visible windows
  const applyGridLayout = useCallback((layoutType: string) => {
    setShowGridMenu(false);
    const container = containerRef.current;
    const contW = container?.clientWidth || window.innerWidth;
    const contH = (container?.clientHeight || window.innerHeight) - 44;

    if (layoutType === 'cascade') {
      onCascadeWindows();
      return;
    }

    if (layoutType === 'tile') {
      onTileWindows();
      return;
    }

    if (!onBatchUpdateWindows) return;

    onBatchUpdateWindows(prev => {
      let targetWins = prev.filter(w => !w.isMinimized);
      if (targetWins.length === 0) {
        targetWins = prev;
      }
      if (targetWins.length === 0) return prev;

      if (layoutType === 'split-2') {
        const halfW = Math.round(contW / 2);
        return prev.map(w => {
          const vIdx = targetWins.findIndex(t => t.id === w.id);
          if (vIdx === -1) return w;
          // In RTL reading order: 1st window is on the right, 2nd window is on the left
          // In LTR reading order: 1st window is on the left, 2nd window is on the right
          const posX = isRtl
            ? (vIdx === 0 ? halfW : 0)
            : (vIdx === 0 ? 0 : halfW);
          const posW = (isRtl && vIdx === 0) || (!isRtl && vIdx === 1)
            ? (contW - halfW)
            : halfW;
          return {
            ...w,
            isMinimized: false,
            isMaximized: false,
            width: posW,
            height: contH,
            y: 0,
            x: posX
          };
        });
      }

      if (layoutType === 'split-3') {
        const colW = Math.round(contW / 3);
        return prev.map(w => {
          const vIdx = targetWins.findIndex(t => t.id === w.id);
          if (vIdx === -1 || vIdx >= 3) return { ...w, isMinimized: true };
          let posX = 0;
          let width = colW;
          if (isRtl) {
            if (vIdx === 0) {
              posX = contW - colW;
              width = colW;
            } else if (vIdx === 1) {
              posX = colW;
              width = colW;
            } else {
              posX = 0;
              width = colW;
            }
          } else {
            if (vIdx === 0) {
              posX = 0;
              width = colW;
            } else if (vIdx === 1) {
              posX = colW;
              width = colW;
            } else {
              posX = colW * 2;
              width = contW - colW * 2;
            }
          }
          return {
            ...w,
            isMinimized: false,
            isMaximized: false,
            width,
            height: contH,
            y: 0,
            x: posX
          };
        });
      }

      if (layoutType === 'grid-4') {
        const halfW = Math.round(contW / 2);
        const halfH = Math.round(contH / 2);
        return prev.map(w => {
          const vIdx = targetWins.findIndex(t => t.id === w.id);
          if (vIdx === -1 || vIdx >= 4) return { ...w, isMinimized: true };
          let qX = 0;
          let qY = 0;
          if (isRtl) {
            if (vIdx === 0) { qX = halfW; qY = 0; }
            else if (vIdx === 1) { qX = 0; qY = 0; }
            else if (vIdx === 2) { qX = halfW; qY = halfH; }
            else { qX = 0; qY = halfH; }
          } else {
            if (vIdx === 0) { qX = 0; qY = 0; }
            else if (vIdx === 1) { qX = halfW; qY = 0; }
            else if (vIdx === 2) { qX = 0; qY = halfH; }
            else { qX = halfW; qY = halfH; }
          }
          return {
            ...w,
            isMinimized: false,
            isMaximized: false,
            width: qX === 0 ? halfW : (contW - halfW),
            height: qY === 0 ? halfH : (contH - halfH),
            x: qX,
            y: qY
          };
        });
      }

      if (layoutType === 'focus-70-30') {
        const mainW = Math.round(contW * 0.70);
        const sideW = contW - mainW;
        return prev.map(w => {
          const vIdx = targetWins.findIndex(t => t.id === w.id);
          if (vIdx === -1 || vIdx >= 2) return { ...w, isMinimized: true };
          if (vIdx === 0) {
            return {
              ...w,
              isMinimized: false,
              isMaximized: false,
              width: mainW,
              height: contH,
              y: 0,
              x: isRtl ? sideW : 0
            };
          }
          if (vIdx === 1) {
            return {
              ...w,
              isMinimized: false,
              isMaximized: false,
              width: sideW,
              height: contH,
              y: 0,
              x: isRtl ? 0 : mainW
            };
          }
          return { ...w, isMinimized: true };
        });
      }

      if (layoutType === 'split-horizontal') {
        const halfH = Math.round(contH / 2);
        return prev.map(w => {
          const vIdx = targetWins.findIndex(t => t.id === w.id);
          if (vIdx === -1 || vIdx >= 2) return { ...w, isMinimized: true };
          if (vIdx === 0) {
            return {
              ...w,
              isMinimized: false,
              isMaximized: false,
              width: contW,
              height: halfH,
              x: 0,
              y: 0
            };
          }
          if (vIdx === 1) {
            return {
              ...w,
              isMinimized: false,
              isMaximized: false,
              width: contW,
              height: contH - halfH,
              x: 0,
              y: halfH
            };
          }
          return { ...w, isMinimized: true };
        });
      }

      return prev;
    });
  }, [onCascadeWindows, onTileWindows, onBatchUpdateWindows, isRtl]);

  const handleMouseDownHeader = (e: React.MouseEvent, win: DesktopWindow) => {
    // Don't drag if clicking buttons
    if ((e.target as HTMLElement).closest('button')) return;
    if (win.isMaximized) return;

    onFocusWindow(win.id);
    setDraggingId(win.id);
    dragStartRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y
    };
    dragPosRef.current = { x: win.x, y: win.y };
  };

  const handleMouseDownResize = (
    e: React.MouseEvent,
    win: DesktopWindow,
    handle: 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw'
  ) => {
    e.stopPropagation();
    e.preventDefault();
    if (win.isMaximized) return;

    onFocusWindow(win.id);
    setResizingId(win.id);

    // Current effective width and height
    const currentWidth = win.width || Math.min(window.innerWidth * 0.92, 1260);
    const currentHeight = win.height || Math.min(window.innerHeight * 0.86, 850);

    resizeRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      origX: win.x,
      origY: win.y,
      origWidth: currentWidth,
      origHeight: currentHeight
    };
    resizeDimsRef.current = {
      width: currentWidth,
      height: currentHeight,
      x: win.x,
      y: win.y
    };
  };

  useEffect(() => {
    if (!draggingId && !resizingId) return;

    const handleMouseMove = (e: MouseEvent) => {
      // Handle Window Dragging with Edge Snapping Detection
      if (draggingId && dragStartRef.current) {
        const dx = e.clientX - dragStartRef.current.startX;
        const dy = e.clientY - dragStartRef.current.startY;

        const containerRect = containerRef.current?.getBoundingClientRect();
        const contW = containerRect?.width || window.innerWidth;
        const contH = (containerRect?.height || window.innerHeight) - 44;

        // Current window width for boundary calculation
        const currentWin = windowsRef.current.find(w => w.id === draggingId);
        const winW = currentWin?.width || 800;

        // Allow free horizontal movement across the desktop:
        // Window can move freely right and left without any right-side clamping,
        // keeping at least 80px visible so it remains grabbable.
        const minX = -winW + 80;
        const maxX = contW - 80;
        const newX = Math.max(minX, Math.min(maxX, dragStartRef.current.origX + dx));
        const newY = Math.max(0, Math.min(contH - 40, dragStartRef.current.origY + dy));
        dragPosRef.current = { x: newX, y: newY };

        // Direct GPU-accelerated DOM update without triggering React re-renders!
        // dx > 0 moves right, dx < 0 moves left uniformly regardless of page direction!
        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const el = windowRefs.current[draggingId];
          if (el) {
            el.style.transform = `translate3d(${dx}px, ${dy}px, 0)`;
          }
        });

        // Check edge snapping zones
        if (containerRect) {
          const relX = e.clientX - containerRect.left;
          const relY = e.clientY - containerRect.top;

          const EDGE_MARGIN = 24;
          const CORNER_MARGIN = 80;
          const halfW = Math.round(contW / 2);
          const halfH = Math.round(contH / 2);

          let detected: SnapGhostZone | null = null;

          if (relY <= 14) {
            // Top edge -> Maximize ghost
            detected = {
              type: 'max',
              label: language === 'ar' ? 'تكبير ملء الشاشة' : 'Maximize Window',
              style: { top: 0, left: 0, width: `${contW}px`, height: `${contH}px` },
              x: 0,
              y: 0,
              width: contW,
              height: contH,
              isMaximize: true
            };
          } else if (relX <= EDGE_MARGIN) {
            // Physical Left Edge of canvas
            if (relY <= CORNER_MARGIN) {
              detected = {
                type: 'top-left',
                label: language === 'ar' ? 'الربع العلوي الأيسر' : 'Top Left Quarter',
                style: { top: 0, left: 0, width: `${halfW}px`, height: `${halfH}px` },
                x: 0,
                y: 0,
                width: halfW,
                height: halfH
              };
            } else if (relY >= contH - CORNER_MARGIN) {
              detected = {
                type: 'bottom-left',
                label: language === 'ar' ? 'الربع السفلي الأيسر' : 'Bottom Left Quarter',
                style: { top: `${halfH}px`, left: 0, width: `${halfW}px`, height: `${contH - halfH}px` },
                x: 0,
                y: halfH,
                width: halfW,
                height: contH - halfH
              };
            } else {
              detected = {
                type: 'left',
                label: language === 'ar' ? 'محاذاة للنصف الأيسر (50%)' : 'Snap Left (50%)',
                style: { top: 0, left: 0, width: `${halfW}px`, height: `${contH}px` },
                x: 0,
                y: 0,
                width: halfW,
                height: contH
              };
            }
          } else if (relX >= contW - EDGE_MARGIN) {
            // Physical Right Edge of canvas
            const rightW = contW - halfW;
            if (relY <= CORNER_MARGIN) {
              detected = {
                type: 'top-right',
                label: language === 'ar' ? 'الربع العلوي الأيمن' : 'Top Right Quarter',
                style: { top: 0, left: `${halfW}px`, width: `${rightW}px`, height: `${halfH}px` },
                x: halfW,
                y: 0,
                width: rightW,
                height: halfH
              };
            } else if (relY >= contH - CORNER_MARGIN) {
              detected = {
                type: 'bottom-right',
                label: language === 'ar' ? 'الربع السفلي الأيمن' : 'Bottom Right Quarter',
                style: { top: `${halfH}px`, left: `${halfW}px`, width: `${rightW}px`, height: `${contH - halfH}px` },
                x: halfW,
                y: halfH,
                width: rightW,
                height: contH - halfH
              };
            } else {
              detected = {
                type: 'right',
                label: language === 'ar' ? 'محاذاة للنصف الأيمن (50%)' : 'Snap Right (50%)',
                style: { top: 0, left: `${halfW}px`, width: `${rightW}px`, height: `${contH}px` },
                x: halfW,
                y: 0,
                width: rightW,
                height: contH
              };
            }
          }

          setSnapGhostZone(detected);
          snapGhostZoneRef.current = detected;
        }
        return;
      }

      // Handle Window Resizing (True Physical Handles: each edge only adjusts its own boundary)
      if (resizingId && resizeRef.current) {
        const { handle, startX, startY, origX, origY, origWidth, origHeight } = resizeRef.current;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;

        let newW = origWidth;
        let newH = origHeight;
        let newX = origX;
        let newY = origY;

        const MIN_W = 380;
        const MIN_H = 260;

        // Horizontal sizing:
        // 'e' = right edge: user pulls right edge, left position remains completely static!
        if (handle.includes('e')) {
          newW = Math.max(MIN_W, origWidth + dx);
        } else if (handle.includes('w')) {
          // 'w' = left edge: user pulls left edge, right edge remains completely static!
          const calculatedW = Math.max(MIN_W, origWidth - dx);
          newW = calculatedW;
          newX = origX + (origWidth - calculatedW);
        }

        // Vertical sizing:
        // 's' = bottom edge: user pulls bottom edge, top position remains completely static!
        if (handle.includes('s')) {
          newH = Math.max(MIN_H, origHeight + dy);
        } else if (handle.includes('n')) {
          // 'n' = top edge: user pulls top edge, bottom edge remains completely static!
          const calculatedH = Math.max(MIN_H, origHeight - dy);
          newH = calculatedH;
          newY = Math.max(0, origY + (origHeight - calculatedH));
        }

        const roundedW = Math.round(newW);
        const roundedH = Math.round(newH);
        const roundedX = Math.round(newX);
        const roundedY = Math.round(newY);

        resizeDimsRef.current = {
          width: roundedW,
          height: roundedH,
          x: roundedX,
          y: roundedY
        };

        if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = requestAnimationFrame(() => {
          const el = windowRefs.current[resizingId];
          if (el) {
            el.style.width = `${roundedW}px`;
            el.style.height = `${roundedH}px`;
            el.style.top = `${roundedY}px`;
            el.style.left = `${roundedX}px`;
          }
        });
      }
    };

    const handleMouseUp = () => {
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }

      // If releasing while hovering over a snap edge zone, snap immediately
      if (draggingId && snapGhostZoneRef.current) {
        const zone = snapGhostZoneRef.current;
        const currentWin = windowsRef.current.find(w => w.id === draggingId);
        const el = windowRefs.current[draggingId];
        if (el) el.style.transform = '';

        if (zone.isMaximize) {
          if (currentWin && !currentWin.isMaximized) {
            onToggleMaximize(draggingId);
          }
        } else if (onUpdateDimensions) {
          if (currentWin?.isMaximized) {
            onToggleMaximize(draggingId);
          }
          onUpdateDimensions(draggingId, zone.width, zone.height, zone.x, zone.y);
        }
      } else if (draggingId && dragPosRef.current) {
        const el = windowRefs.current[draggingId];
        if (el) el.style.transform = '';
        onUpdatePosition(draggingId, dragPosRef.current.x, dragPosRef.current.y);
      }

      // Resizing finalize
      if (resizingId) {
        const el = windowRefs.current[resizingId];
        if (el) {
          el.style.width = '';
          el.style.height = '';
          el.style.top = '';
          el.style.left = '';
          el.style.right = '';
        }
        if (resizeDimsRef.current && onUpdateDimensions) {
          const { width, height, x, y } = resizeDimsRef.current;
          onUpdateDimensions(resizingId, width, height, x, y);
        }
      }

      setDraggingId(null);
      setResizingId(null);
      setSnapGhostZone(null);
      dragStartRef.current = null;
      dragPosRef.current = null;
      resizeRef.current = null;
      resizeDimsRef.current = null;
      snapGhostZoneRef.current = null;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [draggingId, resizingId, onUpdatePosition, onUpdateDimensions, onToggleMaximize, language]);

  const activeWindow = windows.find(w => w.id === activeWindowId);
  const visibleWindows = windows.filter(w => !w.isMinimized);
  const minimizedCount = windows.filter(w => w.isMinimized).length;

  return (
    <div ref={containerRef} className="relative flex-1 flex flex-col w-full h-full overflow-hidden select-text">
      {/* Background Layer: Dashboard Screen / Workspace */}
      <div 
        className={`w-full flex-1 overflow-y-auto transition-opacity duration-200 ${
          visibleWindows.length > 0 && activeWindow?.isMaximized 
            ? 'opacity-0 pointer-events-none' 
            : visibleWindows.length > 0 
              ? 'opacity-75' 
              : 'opacity-100'
        }`}
      >
        {backgroundContent}
      </div>

      {/* Interactive Edge Snapping Ghost Overlay */}
      {snapGhostZone && (
        <div
          style={snapGhostZone.style}
          className="absolute z-50 pointer-events-none rounded-xl border-2 border-blue-500 bg-blue-500/20 backdrop-blur-xs flex items-center justify-center shadow-2xl transition-all duration-150 animate-pulse"
        >
          <div className="bg-slate-900/90 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold shadow-lg border border-slate-700/80 flex items-center gap-2">
            <Grid2X2 size={14} className="text-blue-400" />
            <span>{snapGhostZone.label}</span>
          </div>
        </div>
      )}

      {/* Floating & Maximized MDI Windows Container */}
      {windows.map((win) => {
        const isActive = win.id === activeWindowId && !win.isMinimized;
        const isDragging = draggingId === win.id;

        return (
          <div
            key={win.id}
            ref={(el) => {
              windowRefs.current[win.id] = el;
            }}
            onMouseDown={() => onFocusWindow(win.id)}
            style={{
              zIndex: win.zIndex,
              ...(win.isMaximized
                ? {
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: '44px',
                    width: '100%',
                    height: 'calc(100% - 44px)'
                  }
                : {
                    top: `${win.y}px`,
                    left: `${win.x}px`,
                    width: win.width ? `${win.width}px` : 'min(92vw, 1260px)',
                    height: win.height ? `${win.height}px` : 'min(86vh, 850px)',
                    maxHeight: 'calc(100% - 50px)'
                  })
            }}
            className={`absolute flex flex-col bg-white rounded-xl shadow-2xl border transition-shadow duration-150 ${
              win.isMinimized ? 'hidden' : 'flex'
            } ${
              isActive
                ? 'ring-2 ring-blue-500/40 border-blue-600/50 shadow-blue-950/20 shadow-2xl'
                : 'border-slate-300/80 shadow-lg opacity-98 hover:border-slate-400'
            } ${win.isMaximized ? 'rounded-none border-x-0 border-t-0' : 'rounded-xl'} ${
              isDragging ? 'opacity-90 select-none cursor-grabbing transition-none' : ''
            }`}
          >
            {/* Window Header Title Bar */}
            <div
              onMouseDown={(e) => handleMouseDownHeader(e, win)}
              onDoubleClick={() => onToggleMaximize(win.id)}
              className={`flex items-center justify-between px-3.5 py-2.5 select-none shrink-0 transition-colors cursor-grab ${
                win.isMaximized ? 'rounded-none' : 'rounded-t-xl'
              } ${
                isActive
                  ? 'bg-[#0f172a] text-white border-b border-slate-700/80'
                  : 'bg-[#1e293b]/95 text-slate-200 border-b border-slate-700/50 hover:bg-[#1e293b]'
              }`}
            >
              {/* Left Side: Window Badge & Title */}
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                <span
                  className={`text-[10px] font-mono font-extrabold px-2 py-0.5 rounded shadow-xs shrink-0 ${
                    win.badgeColor || 'bg-blue-600 text-white'
                  }`}
                >
                  {win.badge}
                </span>

                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-xs sm:text-sm font-bold truncate leading-tight tracking-tight">
                    {win.title}
                  </h3>
                  {isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0 hidden sm:inline-block" title="نشط" />
                  )}
                </div>
              </div>

              {/* Window Controls: Drag indicator, Minimize, Maximize/Restore, Close */}
              <div className="flex items-center gap-1 shrink-0 rtl:flex-row-reverse" onClick={(e) => e.stopPropagation()}>
                {/* Minimize Button */}
                <button
                  type="button"
                  onClick={() => onMinimizeWindow(win.id)}
                  title={language === 'ar' ? 'تصغير إلى شريط المهام' : 'Minimize Window'}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors cursor-pointer"
                >
                  <Minus size={14} />
                </button>

                {/* Snap Layouts Button & Menu */}
                <div className="relative" data-snap-trigger="true">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenSnapMenuId(prev => prev === win.id ? null : win.id);
                    }}
                    title={language === 'ar' ? 'سناب ومحاذاة النافذة (Snap Layouts)' : 'Window Snap Layouts'}
                    className={`w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors cursor-pointer ${
                      openSnapMenuId === win.id ? 'bg-blue-600 text-white' : ''
                    }`}
                  >
                    <Grid2X2 size={13} />
                  </button>

                  {openSnapMenuId === win.id && (
                    <div
                      data-snap-menu="true"
                      onClick={(e) => e.stopPropagation()}
                      className="absolute top-8 rtl:left-0 ltr:right-0 w-64 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-3 z-50 text-slate-200 select-none backdrop-blur-md"
                      dir={isRtl ? 'rtl' : 'ltr'}
                    >
                      <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          <Grid2X2 size={13} className="text-blue-400" />
                          {language === 'ar' ? 'سناب ومحاذاة سريعة' : 'Quick Snap'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setOpenSnapMenuId(null)}
                          className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                        >
                          <X size={12} />
                        </button>
                      </div>

                      <div className="space-y-3">
                        {/* Preset 1: 50 / 50 Halves */}
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 font-semibold">
                            {language === 'ar' ? 'نصفين (50% / 50%)' : 'Two Halves (50% / 50%)'}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 h-10">
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'right-half')}
                              className="h-full bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex flex-col items-center justify-center text-[10px] text-slate-300 hover:text-white transition-all cursor-pointer group"
                              title={language === 'ar' ? 'النصف الأيمن' : 'Right Half'}
                            >
                              <span className="font-bold">{language === 'ar' ? 'الأيمن' : 'Right'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'left-half')}
                              className="h-full bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex flex-col items-center justify-center text-[10px] text-slate-300 hover:text-white transition-all cursor-pointer group"
                              title={language === 'ar' ? 'النصف الأيسر' : 'Left Half'}
                            >
                              <span className="font-bold">{language === 'ar' ? 'الأيسر' : 'Left'}</span>
                            </button>
                          </div>
                        </div>

                        {/* Preset 2: 3 Columns */}
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 font-semibold">
                            {language === 'ar' ? '3 أعمدة (33% لكل عمود)' : '3 Columns (33% each)'}
                          </div>
                          <div className="grid grid-cols-3 gap-1 h-9">
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'col-right')}
                              className="h-full bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'يمين' : 'Right'}
                            </button>
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'col-center')}
                              className="h-full bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'وسط' : 'Center'}
                            </button>
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'col-left')}
                              className="h-full bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'يسار' : 'Left'}
                            </button>
                          </div>
                        </div>

                        {/* Preset 3: 4 Quarters */}
                        <div>
                          <div className="text-[10px] text-slate-400 mb-1 font-semibold">
                            {language === 'ar' ? 'أرباع الشاشة (2 × 2)' : 'Quadrants (2 × 2)'}
                          </div>
                          <div className="grid grid-cols-2 gap-1.5 h-14">
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'top-right')}
                              className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'أعلى يمين' : 'Top Right'}
                            </button>
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'top-left')}
                              className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'أعلى يسار' : 'Top Left'}
                            </button>
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'bottom-right')}
                              className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'أسفل يمين' : 'Bottom Right'}
                            </button>
                            <button
                              type="button"
                              onClick={() => snapWindowTo(win.id, 'bottom-left')}
                              className="bg-slate-800 hover:bg-blue-600 border border-slate-700 hover:border-blue-500 rounded flex items-center justify-center text-[9px] font-bold text-slate-300 hover:text-white transition-all cursor-pointer"
                            >
                              {language === 'ar' ? 'أسفل يسار' : 'Bottom Left'}
                            </button>
                          </div>
                        </div>

                        {/* Preset 4: Quick actions */}
                        <div className="pt-1.5 border-t border-slate-800 flex items-center justify-between gap-1 text-[10px]">
                          <button
                            type="button"
                            onClick={() => snapWindowTo(win.id, 'center')}
                            className="flex-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition-colors text-center cursor-pointer"
                          >
                            {language === 'ar' ? 'توسيط 75%' : 'Center 75%'}
                          </button>
                          <button
                            type="button"
                            onClick={() => snapWindowTo(win.id, 'top-half')}
                            className="flex-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition-colors text-center cursor-pointer"
                          >
                            {language === 'ar' ? 'نصف علوي' : 'Top Half'}
                          </button>
                          <button
                            type="button"
                            onClick={() => snapWindowTo(win.id, 'bottom-half')}
                            className="flex-1 py-1 px-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white font-semibold transition-colors text-center cursor-pointer"
                          >
                            {language === 'ar' ? 'نصف سفلي' : 'Bottom Half'}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Maximize / Restore Button */}
                <button
                  type="button"
                  onClick={() => onToggleMaximize(win.id)}
                  title={
                    win.isMaximized
                      ? language === 'ar' ? 'استعادة الحجم الأصلي' : 'Restore Window'
                      : language === 'ar' ? 'تكبير ملء الشاشة' : 'Maximize Window'
                  }
                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-slate-700/80 transition-colors cursor-pointer"
                >
                  {win.isMaximized ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>

                {/* Close Button */}
                <button
                  type="button"
                  onClick={() => onCloseWindow(win.id)}
                  title={language === 'ar' ? 'إغلاق النافذة' : 'Close Window'}
                  className="w-7 h-7 rounded-md flex items-center justify-center text-slate-300 hover:text-white hover:bg-rose-600 transition-colors cursor-pointer ml-1"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Window Content Body */}
            <div className={`window-content-body flex-1 overflow-y-auto bg-[#f8fafc] p-2 sm:p-4 text-slate-900 flex flex-col ${
              draggingId === win.id || resizingId === win.id ? 'pointer-events-none select-none' : ''
            }`}>
              <WindowModeContext.Provider value={true}>
                <WindowContentWrapper view={win.view} windowId={win.id} renderContent={renderContent} />
              </WindowModeContext.Provider>
            </div>

            {/* Resizing Edge & Corner Handles (Active only when not maximized) */}
            {!win.isMaximized && (
              <>
                {/* Top Edge Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'n')}
                  className="absolute -top-1 left-2 right-2 h-2 cursor-ns-resize hover:bg-blue-500/25 active:bg-blue-500/50 transition-colors z-20"
                />
                {/* Bottom Edge Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 's')}
                  className="absolute -bottom-1 left-2 right-2 h-2.5 cursor-ns-resize hover:bg-blue-500/25 active:bg-blue-500/50 transition-colors z-20"
                />
                {/* Right Edge Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'e')}
                  className="absolute top-2 bottom-2 -right-1 w-2.5 cursor-ew-resize hover:bg-blue-500/25 active:bg-blue-500/50 transition-colors z-20"
                />
                {/* Left Edge Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'w')}
                  className="absolute top-2 bottom-2 -left-1 w-2.5 cursor-ew-resize hover:bg-blue-500/25 active:bg-blue-500/50 transition-colors z-20"
                />
                {/* Top-Right Corner Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'ne')}
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 cursor-nesw-resize hover:bg-blue-500/30 active:bg-blue-500/50 z-30"
                />
                {/* Top-Left Corner Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'nw')}
                  className="absolute -top-1 -left-1 w-3.5 h-3.5 cursor-nwse-resize hover:bg-blue-500/30 active:bg-blue-500/50 z-30"
                />
                {/* Bottom-Right Corner Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'se')}
                  className="absolute -bottom-1 -right-1 w-4 h-4 cursor-nwse-resize hover:bg-blue-500/30 active:bg-blue-500/50 flex items-end justify-end p-0.5 z-30"
                >
                  <div className="w-2 h-2 border-r-2 border-b-2 border-slate-400/80 rounded-br-sm" />
                </div>
                {/* Bottom-Left Corner Handle */}
                <div
                  onMouseDown={(e) => handleMouseDownResize(e, win, 'sw')}
                  className="absolute -bottom-1 -left-1 w-4 h-4 cursor-nesw-resize hover:bg-blue-500/30 active:bg-blue-500/50 flex items-end justify-start p-0.5 z-30"
                >
                  <div className="w-2 h-2 border-l-2 border-b-2 border-slate-400/80 rounded-bl-sm" />
                </div>
              </>
            )}
          </div>
        );
      })}

      {/* Desktop Bottom Windows Taskbar (شريط النوافذ السريع على الديسك توب) */}
      <footer
        className="hidden md:flex h-11 bg-[#0f172a] border-t border-slate-800 text-slate-300 items-center justify-between px-3 shrink-0 z-40 select-none shadow-xl"
        dir={isRtl ? 'rtl' : 'ltr'}
      >
        {/* Left Section: Active Windows Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none flex-1 min-w-0 pr-2">
          {/* Sidebar Toggle Button (زر فتح وإغلاق القائمة الجانبية) */}
          {onToggleSidebar && (
            <button
              type="button"
              onClick={onToggleSidebar}
              title={
                isSidebarOpen
                  ? (language === 'ar' ? 'إغلاق وطي القائمة الجانبية (Ctrl+B)' : 'Collapse Sidebar (Ctrl+B)')
                  : (language === 'ar' ? 'فتح وإظهار القائمة الجانبية (Ctrl+B)' : 'Expand Sidebar (Ctrl+B)')
              }
              aria-label={
                isSidebarOpen
                  ? (language === 'ar' ? 'إغلاق القائمة الجانبية' : 'Collapse Sidebar')
                  : (language === 'ar' ? 'فتح القائمة الجانبية' : 'Expand Sidebar')
              }
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border group ${
                isSidebarOpen
                  ? 'bg-amber-500/15 text-amber-300 border-amber-500/50 hover:bg-amber-500/25 shadow-xs'
                  : 'bg-slate-800/90 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700/80 hover:border-amber-500/60'
              }`}
            >
              {isSidebarOpen ? (
                isRtl ? (
                  <PanelRightClose size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <PanelLeftClose size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                )
              ) : (
                isRtl ? (
                  <PanelRightOpen size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                ) : (
                  <PanelLeftOpen size={15} className="text-amber-400 group-hover:scale-110 transition-transform" />
                )
              )}
              <span className="hidden sm:inline">
                {language === 'ar'
                  ? (isSidebarOpen ? 'إخفاء القائمة' : 'القائمة الرئيسية')
                  : (isSidebarOpen ? 'Hide Menu' : 'Main Menu')}
              </span>
              <span className="text-[10px] text-slate-400 font-mono bg-slate-900/80 px-1 py-0.2 rounded border border-slate-700/60 hidden xl:inline">
                Ctrl+B
              </span>
            </button>
          )}



          {/* Window Buttons */}
          {windows.map((win) => {
            const isActive = win.id === activeWindowId && !win.isMinimized;
            return (
              <div
                key={`taskbar-${win.id}`}
                onClick={() => {
                  if (win.isMinimized) {
                    onRestoreWindow(win.id);
                  } else if (isActive) {
                    onMinimizeWindow(win.id);
                  } else {
                    onFocusWindow(win.id);
                  }
                }}
                className={`flex items-center gap-2 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer shrink-0 border max-w-[200px] group ${
                  isActive
                    ? 'bg-blue-600/30 text-blue-200 border-blue-500/60 shadow-xs ring-1 ring-blue-500/40'
                    : win.isMinimized
                      ? 'bg-slate-900/60 text-slate-400 border-slate-800/80 hover:bg-slate-800/80 hover:text-slate-200 opacity-75'
                      : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700 hover:text-white'
                }`}
                title={`${win.title} ${win.isMinimized ? (language === 'ar' ? '(مصغرة)' : '(Minimized)') : ''}`}
              >
                <span
                  className={`text-[9px] font-mono px-1 py-0.2 rounded font-bold shrink-0 ${
                    win.badgeColor || 'bg-slate-700 text-slate-200'
                  }`}
                >
                  {win.badge}
                </span>

                <span className="truncate text-xs flex-1">{win.title}</span>

                {/* Close Button on Tab */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseWindow(win.id);
                  }}
                  title={language === 'ar' ? 'إغلاق' : 'Close'}
                  className="opacity-60 group-hover:opacity-100 hover:text-rose-400 hover:bg-slate-900/60 p-0.5 rounded transition-all"
                >
                  <X size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Right Section: Window Utilities & Actions */}
        <div className="flex items-center gap-1.5 shrink-0 pl-2">
          {/* Unified Alerts Notification Bell in Desktop Taskbar */}
          <AlertsNotificationBell
            onNavigate={(screen) => {
              if (onNavigate) {
                onNavigate(screen);
              }
            }}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
            iconSize={15}
          />

          {windows.length > 0 && (
            <>
              {/* Smart Grid Presets Dropdown Menu */}
              <div className="relative" data-grid-trigger="true">
                <button
                  type="button"
                  onClick={() => setShowGridMenu(prev => !prev)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    showGridMenu
                      ? 'bg-blue-600 text-white border-blue-500 shadow-xs ring-1 ring-blue-400'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border-slate-700'
                  }`}
                  title={language === 'ar' ? 'خيارات سناب وتقسيم الشاشة الذكية' : 'Smart Grid & Snap Layouts'}
                >
                  <Grid2X2 size={13} className="text-blue-400" />
                  <span className="hidden sm:inline">{language === 'ar' ? 'شبكة النوافذ' : 'Window Grid'}</span>
                </button>

                {showGridMenu && (
                  <div
                    data-grid-menu="true"
                    onClick={(e) => e.stopPropagation()}
                    className="absolute bottom-11 rtl:left-0 ltr:right-0 w-72 bg-slate-900 border border-slate-700/90 rounded-xl shadow-2xl p-2.5 z-50 text-slate-200 select-none backdrop-blur-md"
                    dir={isRtl ? 'rtl' : 'ltr'}
                  >
                    <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
                      <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                        <Grid2X2 size={13} className="text-blue-400" />
                        {language === 'ar' ? 'تنسيقات وتقسيم الشاشة' : 'Workspace Layouts'}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowGridMenu(false)}
                        className="text-slate-400 hover:text-white p-0.5 rounded cursor-pointer"
                      >
                        <X size={12} />
                      </button>
                    </div>

                    <div className="space-y-1">
                      {/* Split 50 / 50 */}
                      <button
                        type="button"
                        onClick={() => applyGridLayout('split-2')}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/90 text-right rtl:text-right ltr:text-left transition-colors cursor-pointer group border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-blue-950/60 text-blue-400 border border-blue-800/50 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                            <Columns2 size={15} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-200 group-hover:text-blue-300">
                              {language === 'ar' ? 'شاشتان جنباً إلى جنب (50 / 50)' : 'Side by Side (50 / 50)'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {language === 'ar' ? 'مقارنة مباشرة بين فاتورتين أو كشف حساب' : 'Direct side-by-side comparison'}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* 3 Columns */}
                      <button
                        type="button"
                        onClick={() => applyGridLayout('split-3')}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/90 text-right rtl:text-right ltr:text-left transition-colors cursor-pointer group border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-indigo-950/60 text-indigo-400 border border-indigo-800/50 flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                            <Columns3 size={15} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-200 group-hover:text-indigo-300">
                              {language === 'ar' ? '3 أعمدة متساوية (33% لكل عمود)' : '3 Equal Columns'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {language === 'ar' ? 'عرض ثلاث شاشات متزامنة في نفس الوقت' : 'Three simultaneous viewports'}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* 4 Quarters 2x2 Grid */}
                      <button
                        type="button"
                        onClick={() => applyGridLayout('grid-4')}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/90 text-right rtl:text-right ltr:text-left transition-colors cursor-pointer group border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-emerald-950/60 text-emerald-400 border border-emerald-800/50 flex items-center justify-center shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                            <Grid2X2 size={15} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-200 group-hover:text-emerald-300">
                              {language === 'ar' ? 'شبكة رباعية (2 × 2 أرباع)' : '2x2 Quadrants Grid'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {language === 'ar' ? 'توزيع متكافئ لأربع نوافذ في الشاشة' : 'Four equal window quadrants'}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Focus 70 / 30 */}
                      <button
                        type="button"
                        onClick={() => applyGridLayout('focus-70-30')}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/90 text-right rtl:text-right ltr:text-left transition-colors cursor-pointer group border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-amber-950/60 text-amber-400 border border-amber-800/50 flex items-center justify-center shrink-0 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                            <Columns2 size={15} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-200 group-hover:text-amber-300">
                              {language === 'ar' ? 'تركيز رئيسي (70% + 30% جانبي)' : 'Focus View (70% / 30%)'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {language === 'ar' ? 'شاشة عمل رئيسية عريضة + شاشة مرجعية جانبية' : 'Primary workstation with side reference'}
                            </div>
                          </div>
                        </div>
                      </button>

                      {/* Horizontal Split */}
                      <button
                        type="button"
                        onClick={() => applyGridLayout('split-horizontal')}
                        className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-slate-800/90 text-right rtl:text-right ltr:text-left transition-colors cursor-pointer group border border-transparent hover:border-slate-700"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded bg-purple-950/60 text-purple-400 border border-purple-800/50 flex items-center justify-center shrink-0 group-hover:bg-purple-600 group-hover:text-white transition-colors">
                            <Rows2 size={15} />
                          </div>
                          <div>
                            <div className="text-xs font-bold text-slate-200 group-hover:text-purple-300">
                              {language === 'ar' ? 'تقسيم أفقي (50% علوي / 50% سفلي)' : 'Horizontal Split (Top / Bottom)'}
                            </div>
                            <div className="text-[10px] text-slate-400">
                              {language === 'ar' ? 'شاشتان مقسمتان بالتساوي أفقياً' : 'Two stacked horizontal screens'}
                            </div>
                          </div>
                        </div>
                      </button>

                      <div className="pt-1.5 mt-1 border-t border-slate-800 flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => applyGridLayout('cascade')}
                          className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <Layers size={13} />
                          <span>{language === 'ar' ? 'تتالي' : 'Cascade'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => applyGridLayout('tile')}
                          className="flex-1 py-1.5 px-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                        >
                          <LayoutGrid size={13} />
                          <span>{language === 'ar' ? 'شبكة تلقائية' : 'Tile All'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Cascade Windows */}
              <button
                type="button"
                onClick={onCascadeWindows}
                title={language === 'ar' ? 'ترتيب النوافذ بشكل متتالي' : 'Cascade Windows'}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
              >
                <Layers size={14} />
              </button>

              {/* Tile Windows */}
              <button
                type="button"
                onClick={onTileWindows}
                title={language === 'ar' ? 'ترتيب النوافذ جنباً إلى جنب' : 'Tile Windows'}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
              >
                <LayoutGrid size={14} />
              </button>

              {/* Minimize All */}
              <button
                type="button"
                onClick={onMinimizeAll}
                title={language === 'ar' ? 'تصغير كل النوافذ' : 'Minimize All'}
                className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs transition-colors cursor-pointer"
              >
                <EyeOff size={14} />
              </button>

              {/* Restore All */}
              {minimizedCount > 0 && (
                <button
                  type="button"
                  onClick={onRestoreAll}
                  title={language === 'ar' ? 'استعادة كل النوافذ' : 'Restore All'}
                  className="p-1.5 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 border border-slate-700 text-xs transition-colors cursor-pointer"
                >
                  <Eye size={14} />
                </button>
              )}

              {/* Close All */}
              <button
                type="button"
                onClick={onCloseAll}
                title={language === 'ar' ? 'إغلاق كل النوافذ' : 'Close All'}
                className="p-1.5 rounded-md bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-800/50 text-xs transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>

              <div className="w-[1px] h-4 bg-slate-700 mx-1 hidden sm:block" />
            </>
          )}


        </div>
      </footer>
    </div>
  );
};
