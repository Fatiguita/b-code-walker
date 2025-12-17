import React, { useState, useRef, useEffect } from 'react';
import { 
  WorkflowNode, 
  WorkflowEdge, 
  WorkflowNodeType, 
  WorkflowState 
} from '../types';
import { 
  ArrowPathIcon, 
  TrashIcon, 
  PhotoIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
} from './Icons';

interface WorkflowTabProps {
  workflowState: WorkflowState;
  setWorkflowState: React.Dispatch<React.SetStateAction<WorkflowState>>;
}

const NODE_TYPES: { type: WorkflowNodeType; label: string; shape: string; description: string }[] = [
  { type: 'start', label: 'Start / End', shape: 'capsule', description: 'Terminator: Indicates the beginning or end of a program flow.' },
  { type: 'process', label: 'Process', shape: 'rect', description: 'Process: Represents a set of operations that change value, form, or location of data.' },
  { type: 'decision', label: 'Decision', shape: 'diamond', description: 'Decision: Shows a conditional operation that determines which of the two paths the program will take.' },
  { type: 'input', label: 'Input / Output', shape: 'parallelogram', description: 'Data: Indicates the process of inputting and outputting data.' },
  { type: 'database', label: 'Database', shape: 'cylinder', description: 'Database: Represents data storage.' },
  { type: 'document', label: 'Document', shape: 'document', description: 'Document: Represents a document or report.' },
  { type: 'note', label: 'Note', shape: 'note', description: 'Comment: Adds explanation or remarks.' },
];

export const WorkflowTab: React.FC<WorkflowTabProps> = ({ workflowState, setWorkflowState }) => {
  const [nodes, setNodes] = useState<WorkflowNode[]>(workflowState.nodes || []);
  const [edges, setEdges] = useState<WorkflowEdge[]>(workflowState.edges || []);
  const [zoom, setZoom] = useState<number>(workflowState.zoom || 1);
  
  // Interaction State
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [draggingControlPoint, setDraggingControlPoint] = useState<{ edgeId: string, index: number } | null>(null);
  
  // Drag logic helpers
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 }); // Mouse screen pos
  const [nodeStartPos, setNodeStartPos] = useState({ x: 0, y: 0 }); // Node canvas pos
  const [didMove, setDidMove] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [connectionMode, setConnectionMode] = useState<{ active: boolean; sourceId: string | null }>({ active: false, sourceId: null });
  
  // TAP-TO-PLACE Mode (Mobile Fix)
  const [activeTool, setActiveTool] = useState<WorkflowNodeType | null>(null);

  // Mobile Long Press Logic
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  // Sync back to parent state
  useEffect(() => {
    setWorkflowState({ nodes, edges, zoom });
  }, [nodes, edges, zoom, setWorkflowState]);

  // --- Helpers ---

  const getCanvasCoordinates = (e: React.MouseEvent) => {
      if (!canvasRef.current) return { x: 0, y: 0 };
      const rect = canvasRef.current.getBoundingClientRect();
      return {
          x: (e.clientX - rect.left) / zoom,
          y: (e.clientY - rect.top) / zoom
      };
  };

  // --- Handlers ---

  const handleDragStart = (e: React.DragEvent, type: WorkflowNodeType) => {
    e.dataTransfer.setData('nodeType', type);
  };

  const createNode = (type: WorkflowNodeType, x: number, y: number) => {
    const newNode: WorkflowNode = {
        id: Date.now().toString(),
        type,
        x: x - 60, // Center approx
        y: y - 30,
        label: type === 'start' ? 'Start' : type === 'note' ? 'Comment' : 'New Node',
        width: 120,
        height: 60,
        color: '#1f2937' // Default dark
      };
  
      setNodes(prev => [...prev, newNode]);
      setSelectedNodeId(newNode.id);
      setSelectedEdgeId(null);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('nodeType') as WorkflowNodeType;
    if (!type || !canvasRef.current) return;

    const coords = getCanvasCoordinates(e);
    createNode(type, coords.x, coords.y);
  };

  const handleDragOver = (e: React.DragEvent) => e.preventDefault();

  // --- Node Dragging Logic ---

  const handleNodeMouseDown = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    e.preventDefault(); // Prevent text selection
    
    // Right click check (button 2)
    if (e.button === 2) {
        setSelectedNodeId(id);
        setSelectedEdgeId(null);
        return; // Let context menu logic handle or just open inspector
    }

    if (connectionMode.active) {
        handleConnectionClick(id);
        return;
    }

    const node = nodes.find(n => n.id === id);
    if (!node) return;

    setDraggingId(id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setNodeStartPos({ x: node.x, y: node.y });
    setDidMove(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    // If moving, cancel any pending long press (for mouse users mostly, touch handled separately)
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }

    if (draggingId) {
        // Calculate delta in zoom-independent screen pixels, then divide by zoom
        const dx = (e.clientX - dragStartPos.x) / zoom;
        const dy = (e.clientY - dragStartPos.y) / zoom;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setDidMove(true);

        setNodes(prev => prev.map(n => n.id === draggingId ? { 
            ...n, 
            x: nodeStartPos.x + dx, 
            y: nodeStartPos.y + dy 
        } : n));
    } else if (draggingControlPoint) {
        // Dragging a Bezier Handle
        const coords = getCanvasCoordinates(e);
        setEdges(prev => prev.map(edge => {
            if (edge.id === draggingControlPoint.edgeId && edge.controlPoints) {
                const newCPs = [...edge.controlPoints];
                newCPs[draggingControlPoint.index] = { x: coords.x, y: coords.y };
                return { ...edge, controlPoints: newCPs };
            }
            return edge;
        }));
    }
  };

  const handleCanvasMouseUp = () => {
    // If we released a node and didn't move it much, treat as click
    if (draggingId && !didMove) {
        setSelectedNodeId(draggingId);
        setSelectedEdgeId(null);
    }
    
    setDraggingId(null);
    setDraggingControlPoint(null);
  };

  // --- Mobile Touch Handlers ---
  const handleNodeTouchStart = (id: string) => {
      // Start long press timer
      longPressTimer.current = setTimeout(() => {
          // Trigger Selection / Context Menu equivalent
          setSelectedNodeId(id);
          setSelectedEdgeId(null);
          // Haptic feedback if available
          if (navigator.vibrate) navigator.vibrate(50);
          
          longPressTimer.current = null;
      }, 600); 
  };

  const handleNodeTouchMove = () => {
      // If user moves finger (scrolls or drags), cancel long press
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleNodeTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
          // Normal tap actions are usually handled by onClick or MouseUp that often fire after touch
      }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      // Tap-to-Place Logic
      if (activeTool) {
          const coords = getCanvasCoordinates(e);
          createNode(activeTool, coords.x, coords.y);
          // Optional: Reset active tool after placement, or keep it active for multiple?
          // Resetting feels more natural for mobile so you don't accidentally spam nodes.
          setActiveTool(null); 
          return;
      }

      // Background click
      if (!draggingId && !draggingControlPoint && !didMove) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
      }
  };

  const handleConnectionClick = (id: string) => {
      if (!connectionMode.sourceId) {
          setConnectionMode({ ...connectionMode, sourceId: id });
      } else {
          if (connectionMode.sourceId !== id) {
              const src = nodes.find(n => n.id === connectionMode.sourceId);
              const tgt = nodes.find(n => n.id === id);
              
              if (src && tgt) {
                  // Intelligent default curve points
                  const sx = src.x + 60; // center width
                  const sy = src.y + 30; // center height
                  const tx = tgt.x + 60;
                  const ty = tgt.y + 30;
                  
                  const isVertical = Math.abs(ty - sy) > Math.abs(tx - sx);
                  const cp1 = isVertical ? { x: sx, y: sy + 50 } : { x: sx + 50, y: sy };
                  const cp2 = isVertical ? { x: tx, y: ty - 50 } : { x: tx - 50, y: ty };

                  const newEdge: WorkflowEdge = {
                      id: `e-${Date.now()}`,
                      source: connectionMode.sourceId,
                      target: id,
                      type: 'straight',
                      controlPoints: [cp1, cp2] // Pre-calculate but don't use unless curved
                  };
                  
                  const exists = edges.some(e => e.source === newEdge.source && e.target === newEdge.target);
                  if (!exists) setEdges(prev => [...prev, newEdge]);
              }
              setConnectionMode({ active: false, sourceId: null });
          }
      }
  };

  const deleteSelected = () => {
      if (selectedNodeId) {
          setNodes(prev => prev.filter(n => n.id !== selectedNodeId));
          setEdges(prev => prev.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
          setSelectedNodeId(null);
      } else if (selectedEdgeId) {
          setEdges(prev => prev.filter(e => e.id !== selectedEdgeId));
          setSelectedEdgeId(null);
      }
  };

  // --- Curve Management ---

  const initCurve = (edgeId: string) => {
      setEdges(prev => prev.map(e => {
          if (e.id === edgeId) {
              // Calculate default CPs if they don't exist
              const src = nodes.find(n => n.id === e.source);
              const tgt = nodes.find(n => n.id === e.target);
              if (src && tgt) {
                  const sx = src.x + (src.width||120)/2;
                  const sy = src.y + (src.height||60)/2;
                  const tx = tgt.x + (tgt.width||120)/2;
                  const ty = tgt.y + (tgt.height||60)/2;
                  
                  const dx = Math.abs(tx - sx);
                  const dy = Math.abs(ty - sy);
                  
                  // Bias curve based on layout
                  let cp1, cp2;
                  if (dy > dx) {
                      // Vertical flow
                      cp1 = { x: sx, y: sy + dy * 0.4 };
                      cp2 = { x: tx, y: ty - dy * 0.4 };
                  } else {
                      // Horizontal flow
                      cp1 = { x: sx + dx * 0.4, y: sy };
                      cp2 = { x: tx - dx * 0.4, y: ty };
                  }
                  
                  return { ...e, type: 'curved', controlPoints: [cp1, cp2] };
              }
              return { ...e, type: 'curved', controlPoints: [] };
          }
          return e;
      }));
  };

  const exportAsImage = () => {
      if (!svgRef.current) return;
      const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
      // Hide handles in export
      const handles = clone.querySelectorAll('.control-handle');
      handles.forEach(h => h.remove());
      
      const contentGroup = clone.getElementById('workflow-content');
      if(contentGroup) contentGroup.setAttribute('transform', 'scale(1)');

      const svgData = new XMLSerializer().serializeToString(clone);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      const bbox = svgRef.current.getBBox(); 
      // Add padding
      const width = (bbox.width || 800) + 100;
      const height = (bbox.height || 600) + 100;
      // Offset to capture negative coords
      const offsetX = -bbox.x + 50;
      const offsetY = -bbox.y + 50;
      
      const svgBlob = new Blob([svgData], {type: "image/svg+xml;charset=utf-8"});
      const url = URL.createObjectURL(svgBlob);
      
      img.onload = () => {
          canvas.width = width;
          canvas.height = height;
          if (ctx) {
              ctx.fillStyle = "#111827"; 
              ctx.fillRect(0,0, width, height);
              ctx.drawImage(img, offsetX, offsetY);
          }
          const pngUrl = canvas.toDataURL("image/png");
          const downloadLink = document.createElement("a");
          downloadLink.href = pngUrl;
          downloadLink.download = "workflow_diagram.png";
          document.body.appendChild(downloadLink);
          downloadLink.click();
          document.body.removeChild(downloadLink);
      };
      img.src = url;
  };

  // --- Renderers ---

  const renderNodeShape = (node: WorkflowNode) => {
      const w = node.width || 120;
      const h = node.height || 60;
      const isSelected = selectedNodeId === node.id;
      const isSource = connectionMode.sourceId === node.id;
      const stroke = isSource ? '#22c55e' : isSelected ? '#3b82f6' : '#4b5563';
      const strokeWidth = isSelected || isSource ? 2 : 1;
      const fill = node.color || '#1f2937';

      switch(node.type) {
          case 'start': return <rect x="0" y="0" width={w} height={h} rx={h/2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
          case 'process': return <rect x="0" y="0" width={w} height={h} rx="4" fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
          case 'decision': return <polygon points={`${w/2},0 ${w},${h/2} ${w/2},${h} 0,${h/2}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
          case 'input': return <polygon points={`${h/3},0 ${w},0 ${w - h/3},${h} 0,${h}`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
          case 'database': return (<g><path d={`M0,${h*0.2} v${h*0.6} c0,${h*0.2} ${w*0.2},${h*0.2} ${w/2},${h*0.2} s${w/2},0 ${w/2},-${h*0.2} v-${h*0.6} `} fill={fill} stroke={stroke} strokeWidth={strokeWidth} /><ellipse cx={w/2} cy={h*0.2} rx={w/2} ry={h*0.2} fill={fill} stroke={stroke} strokeWidth={strokeWidth} /></g>);
          case 'document': return <path d={`M0,0 h${w} v${h*0.8} q${-w*0.25},${h*0.2} ${-w*0.5},0 t${-w*0.5},0 z`} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
          case 'note': return <path d={`M0,0 h${w-15} l15,15 v${h-15} h-${w} z`} fill="#fef3c7" stroke="#d97706" strokeWidth={strokeWidth} />;
          default: return <rect x="0" y="0" width={w} height={h} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />;
      }
  };

  const renderEdges = () => {
      return edges.map(edge => {
          const src = nodes.find(n => n.id === edge.source);
          const tgt = nodes.find(n => n.id === edge.target);
          if (!src || !tgt) return null;

          const sx = src.x + (src.width||120)/2;
          const sy = src.y + (src.height||60)/2;
          const tx = tgt.x + (tgt.width||120)/2;
          const ty = tgt.y + (tgt.height||60)/2;

          // Calculate trim for arrowhead
          // We need the line to stop at the edge of the node, not the center
          // Nodes are roughly 120x60. Radius approx 60.
          const offset = 65; 
          let dirX, dirY;
          
          if (edge.type === 'curved' && edge.controlPoints && edge.controlPoints.length >= 2) {
              // Direction from last control point to target
              const lastCP = edge.controlPoints[1];
              dirX = tx - lastCP.x;
              dirY = ty - lastCP.y;
          } else {
              // Direction from source to target
              dirX = tx - sx;
              dirY = ty - sy;
          }

          // Normalize and retract endpoint
          const len = Math.sqrt(dirX*dirX + dirY*dirY);
          let endX = tx;
          let endY = ty;
          
          if (len > 0) {
              const uX = dirX / len;
              const uY = dirY / len;
              endX = tx - (uX * offset);
              endY = ty - (uY * offset);
          }

          let pathD = '';
          let midX = (sx + endX) / 2;
          let midY = (sy + endY) / 2;

          if (edge.type === 'curved' && edge.controlPoints && edge.controlPoints.length >= 2) {
              const cp1 = edge.controlPoints[0];
              const cp2 = edge.controlPoints[1];
              pathD = `M${sx},${sy} C${cp1.x},${cp1.y}, ${cp2.x},${cp2.y}, ${endX},${endY}`;
              
              // Approximate midpoint for label using Bezier formula at t=0.5
              const t = 0.5;
              midX = (1-t)**3 * sx + 3*(1-t)**2 * t * cp1.x + 3*(1-t) * t**2 * cp2.x + t**3 * endX;
              midY = (1-t)**3 * sy + 3*(1-t)**2 * t * cp1.y + 3*(1-t) * t**2 * cp2.y + t**3 * endY;
          } else {
              // Straight Line fallback
              pathD = `M${sx},${sy} L${endX},${endY}`;
          }

          const isSelected = selectedEdgeId === edge.id;

          return (
              <g 
                key={edge.id} 
                onClick={(e) => { e.stopPropagation(); setSelectedEdgeId(edge.id); setSelectedNodeId(null); }}
                className="cursor-pointer group"
              >
                  {/* Hit Area */}
                  <path d={pathD} stroke="transparent" strokeWidth="20" fill="none" />
                  
                  {/* Visible Line */}
                  <path 
                    d={pathD} 
                    stroke={isSelected ? '#3b82f6' : '#6b7280'} 
                    strokeWidth={isSelected ? 3 : 2} 
                    fill="none"
                    markerEnd={isSelected ? "url(#arrowhead-selected)" : "url(#arrowhead)"} 
                    className="transition-colors"
                  />

                  {/* Bezier Handles (Only when selected) */}
                  {isSelected && edge.type === 'curved' && edge.controlPoints && (
                      <g className="control-handle">
                          {/* Guide Lines */}
                          <path d={`M${sx},${sy} L${edge.controlPoints[0].x},${edge.controlPoints[0].y}`} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                          <path d={`M${endX},${endY} L${edge.controlPoints[1].x},${edge.controlPoints[1].y}`} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                          
                          {/* Handles */}
                          <circle 
                             cx={edge.controlPoints[0].x} cy={edge.controlPoints[0].y} r="5" fill="#22c55e" stroke="white" strokeWidth="1"
                             className="cursor-move hover:scale-125 transition-transform"
                             onMouseDown={(e) => { e.stopPropagation(); setDraggingControlPoint({ edgeId: edge.id, index: 0 }); }}
                          />
                          <circle 
                             cx={edge.controlPoints[1].x} cy={edge.controlPoints[1].y} r="5" fill="#22c55e" stroke="white" strokeWidth="1"
                             className="cursor-move hover:scale-125 transition-transform"
                             onMouseDown={(e) => { e.stopPropagation(); setDraggingControlPoint({ edgeId: edge.id, index: 1 }); }}
                          />
                      </g>
                  )}

                  {/* Label */}
                  {edge.label && (
                      <g transform={`translate(${midX}, ${midY})`}>
                          <rect x="-20" y="-10" width="40" height="20" fill="#1f2937" rx="4" stroke={isSelected ? '#3b82f6' : '#374151'} />
                          <text 
                            x="0" y="4" 
                            textAnchor="middle" 
                            fill={isSelected ? '#93c5fd' : '#e5e7eb'} 
                            fontSize="10" 
                            fontWeight="bold"
                            style={{ pointerEvents: 'none' }}
                          >
                              {edge.label}
                          </text>
                      </g>
                  )}
              </g>
          );
      });
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);
  const selectedEdge = edges.find(e => e.id === selectedEdgeId);

  return (
    <div className="flex flex-col h-full bg-gray-950 text-gray-200 font-sans overflow-hidden">
        {/* --- Toolbar --- */}
        <div className="flex-none p-3 bg-gray-900 border-b border-gray-800 flex justify-between items-center z-20">
            <div className="flex gap-2 items-center">
                <button 
                    onClick={() => setNodes([])}
                    className="p-2 hover:bg-gray-800 rounded text-gray-400 hover:text-red-400 transition-colors"
                    title="Clear Canvas"
                >
                    <TrashIcon className="w-5 h-5" />
                </button>
                <div className="h-8 w-px bg-gray-700 mx-2" />
                
                <div className="flex items-center bg-gray-800 rounded px-1">
                    <button onClick={() => setZoom(Math.max(0.5, zoom - 0.1))} className="p-1.5 hover:text-white text-gray-400">-</button>
                    <span className="text-xs font-mono text-gray-400 w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button onClick={() => setZoom(Math.min(2, zoom + 0.1))} className="p-1.5 hover:text-white text-gray-400">+</button>
                </div>

                <div className="h-8 w-px bg-gray-700 mx-2" />
                
                <button 
                    onClick={() => setConnectionMode({ active: !connectionMode.active, sourceId: null })}
                    className={`px-4 py-1.5 rounded text-sm font-bold flex items-center gap-2 border transition-all ${connectionMode.active ? 'bg-green-900/30 border-green-500 text-green-400' : 'bg-gray-800 border-gray-700 text-gray-400 hover:bg-gray-700'}`}
                >
                    <ArrowPathIcon className="w-4 h-4" />
                    {connectionMode.active ? 'Linking...' : 'Connect Mode'}
                </button>
            </div>
            
            <button 
                onClick={exportAsImage}
                className="flex items-center gap-2 px-4 py-1.5 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors"
            >
                <PhotoIcon className="w-4 h-4" /> <span className="hidden sm:inline">Export</span>
            </button>
        </div>

        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {/* --- Palette Sidebar (Desktop) / Toolbar (Mobile) --- */}
            <div className="order-2 md:order-1 flex-none w-full h-20 md:w-60 md:h-full bg-gray-900 border-t md:border-t-0 md:border-r border-gray-800 flex flex-row md:flex-col z-10 shadow-xl overflow-x-auto md:overflow-y-auto overflow-y-hidden">
                <div className="hidden md:block p-3 text-xs font-bold text-gray-500 uppercase tracking-wider border-b border-gray-800 bg-gray-900/50 sticky top-0">
                    Symbol Library
                </div>
                <div className="flex md:flex-col gap-2 p-2 min-w-max">
                    {NODE_TYPES.map(item => (
                        <div
                            key={item.type}
                            draggable
                            onDragStart={(e) => handleDragStart(e, item.type)}
                            onClick={() => setActiveTool(activeTool === item.type ? null : item.type)}
                            className={`
                                relative flex flex-col md:flex-row items-center gap-2 bg-gray-800 border p-2 md:p-3 rounded cursor-pointer transition-all min-w-[80px] md:min-w-0
                                ${activeTool === item.type 
                                    ? 'border-green-500 ring-1 ring-green-500 bg-gray-800' 
                                    : 'border-gray-700 hover:bg-gray-700 hover:border-blue-500/50'}
                            `}
                        >
                            <div className={`w-8 h-8 flex items-center justify-center ${activeTool === item.type ? 'text-green-500' : 'text-gray-400'}`}>
                                {item.shape === 'diamond' && <div className="w-4 h-4 border-2 border-current transform rotate-45" />}
                                {item.shape === 'rect' && <div className="w-6 h-4 border-2 border-current rounded-sm" />}
                                {item.shape === 'capsule' && <div className="w-6 h-4 border-2 border-current rounded-full" />}
                                {item.shape === 'parallelogram' && <div className="w-6 h-4 border-2 border-current transform -skew-x-12" />}
                                {item.shape === 'cylinder' && <div className="w-4 h-5 border-2 border-current rounded-[50%/10%]" />}
                                {item.shape === 'document' && <div className="w-4 h-5 border-2 border-current rounded-bl-lg" />}
                                {item.shape === 'note' && <div className="w-5 h-5 border-2 border-current bg-yellow-900/20" />}
                            </div>
                            <div className="text-center md:text-left">
                                <span className="text-[10px] md:text-sm font-medium block">{item.label}</span>
                            </div>
                            {/* Tap indicator */}
                            {activeTool === item.type && (
                                <div className="absolute top-1 right-1 w-2 h-2 bg-green-500 rounded-full animate-pulse md:hidden" />
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* --- Canvas Area --- */}
            <div 
                ref={canvasRef}
                className="order-1 md:order-2 flex-1 relative bg-gray-950 overflow-hidden cursor-crosshair touch-none"
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onMouseMove={handleCanvasMouseMove}
                onMouseUp={handleCanvasMouseUp}
                onClick={handleCanvasClick}
                onContextMenu={(e) => e.preventDefault()}
            >
                <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20">
                    <defs>
                        <pattern id="dot-pattern" width="20" height="20" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1" fill="#4b5563" />
                        </pattern>
                        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#6b7280" />
                        </marker>
                        <marker id="arrowhead-selected" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                            <polygon points="0 0, 10 3.5, 0 7" fill="#3b82f6" />
                        </marker>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#dot-pattern)" />
                </svg>

                <svg ref={svgRef} className="w-full h-full absolute inset-0">
                    <g id="workflow-content" transform={`scale(${zoom})`}>
                        {renderEdges()}
                        {nodes.map(node => (
                            <g 
                                key={node.id} 
                                transform={`translate(${node.x},${node.y})`}
                                onMouseDown={(e) => handleNodeMouseDown(e, node.id)}
                                onTouchStart={() => handleNodeTouchStart(node.id)}
                                onTouchMove={handleNodeTouchMove}
                                onTouchEnd={handleNodeTouchEnd}
                                onContextMenu={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setSelectedNodeId(node.id);
                                    setSelectedEdgeId(null);
                                }}
                                className={`cursor-pointer ${connectionMode.active ? 'hover:opacity-80' : 'cursor-move'}`}
                            >
                                {renderNodeShape(node)}
                                <foreignObject x="0" y="0" width={node.width || 120} height={node.height || 60} style={{ pointerEvents: 'none' }}>
                                    <div className={`w-full h-full flex items-center justify-center text-xs text-center p-2 break-words leading-tight ${node.type === 'note' ? 'text-yellow-900 font-serif italic' : 'text-white font-medium'}`}>
                                        {node.label}
                                    </div>
                                </foreignObject>
                            </g>
                        ))}
                    </g>
                </svg>

                {/* Selection / Connection Hint */}
                {connectionMode.active && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-3 py-1 rounded-full shadow-lg pointer-events-none animate-bounce">
                        {connectionMode.sourceId ? 'Select Target Node' : 'Select Source Node'}
                    </div>
                )}
                
                {activeTool && (
                     <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg pointer-events-none animate-pulse">
                        Tap canvas to place {activeTool}
                    </div>
                )}
            </div>

            {/* --- Inspector Panel (Right) --- */}
            {(selectedNode || selectedEdge) && (
                <div className="absolute right-0 top-0 bottom-0 md:relative w-64 bg-gray-900 border-l border-gray-800 p-4 flex flex-col z-30 animate-fade-in shadow-xl h-full overflow-y-auto">
                    <div className="flex justify-between items-center mb-4 border-b border-gray-800 pb-2">
                        <span className="text-xs font-bold text-gray-500 uppercase">
                            {selectedNode ? 'Node Inspector' : 'Edge Inspector'}
                        </span>
                        <button onClick={() => { setSelectedNodeId(null); setSelectedEdgeId(null); }} className="text-gray-500 hover:text-white"><XMarkIcon className="w-4 h-4" /></button>
                    </div>

                    <div className="space-y-4">
                        {selectedNode && (
                            <>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Label Text</label>
                                    <textarea 
                                        value={selectedNode.label}
                                        onChange={(e) => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, label: e.target.value } : n))}
                                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                        rows={3}
                                    />
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Fill Color</label>
                                    <div className="grid grid-cols-5 gap-2">
                                        {['#1f2937', '#7f1d1d', '#14532d', '#1e3a8a', '#713f12'].map(color => (
                                            <button 
                                                key={color}
                                                onClick={() => setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, color } : n))}
                                                className={`w-6 h-6 rounded-full border border-gray-600 ${selectedNode.color === color ? 'ring-2 ring-white' : ''}`}
                                                style={{ backgroundColor: color }}
                                            />
                                        ))}
                                    </div>
                                </div>
                            </>
                        )}

                        {selectedEdge && (
                            <>
                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Connection Label</label>
                                    <input 
                                        type="text"
                                        value={selectedEdge.label || ''}
                                        onChange={(e) => setEdges(edges.map(ed => ed.id === selectedEdge.id ? { ...ed, label: e.target.value } : ed))}
                                        placeholder="e.g. True, Yes..."
                                        className="w-full bg-gray-800 border border-gray-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none"
                                    />
                                    <div className="flex gap-2 mt-2">
                                        {['True', 'False', 'Yes', 'No'].map(txt => (
                                            <button 
                                                key={txt}
                                                onClick={() => setEdges(edges.map(ed => ed.id === selectedEdge.id ? { ...ed, label: txt } : ed))}
                                                className="px-2 py-1 text-[10px] bg-gray-800 hover:bg-gray-700 rounded border border-gray-700"
                                            >
                                                {txt}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Line Style</label>
                                    <div className="flex bg-gray-800 rounded border border-gray-700 p-1">
                                        <button 
                                            onClick={() => setEdges(edges.map(ed => ed.id === selectedEdge.id ? { ...ed, type: 'straight' } : ed))}
                                            className={`flex-1 py-1 text-xs rounded ${(!selectedEdge.type || selectedEdge.type === 'straight') ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                                        >
                                            Straight
                                        </button>
                                        <button 
                                            onClick={() => initCurve(selectedEdge.id)}
                                            className={`flex-1 py-1 text-xs rounded ${selectedEdge.type === 'curved' ? 'bg-gray-600 text-white' : 'text-gray-400'}`}
                                        >
                                            Curved
                                        </button>
                                    </div>
                                    {selectedEdge.type === 'curved' && (
                                        <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                                            <WrenchScrewdriverIcon className="w-3 h-3" /> Drag green handles on line to sculpt.
                                        </p>
                                    )}
                                </div>
                            </>
                        )}

                        <div className="pt-4 border-t border-gray-800">
                            <button 
                                onClick={deleteSelected}
                                className="w-full bg-red-900/30 border border-red-900 text-red-400 py-2 rounded text-sm hover:bg-red-900/50 transition-colors flex justify-center items-center gap-2"
                            >
                                <TrashIcon className="w-4 h-4" /> Delete {selectedNode ? 'Node' : 'Connection'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};
