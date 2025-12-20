
import React, { useState, useRef, useEffect } from 'react';
import { 
  WorkflowNode, 
  WorkflowEdge, 
  WorkflowNodeType, 
  WorkflowState,
  HandlePosition
} from '../types';
import { 
  ArrowPathIcon, 
  TrashIcon, 
  PhotoIcon,
  XMarkIcon,
  WrenchScrewdriverIcon,
  ChevronUpIcon,
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
  // NEW: Store initial edge control points for synced dragging
  const [edgeStartSnapshots, setEdgeStartSnapshots] = useState<{id: string, cp: {x:number, y:number}[]}[]>([]);
  const [didMove, setDidMove] = useState(false);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  
  // Updated Connection Mode State to include Handle info
  const [connectionMode, setConnectionMode] = useState<{ active: boolean; sourceId: string | null; sourceHandle: HandlePosition | null }>({ active: false, sourceId: null, sourceHandle: null });
  
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

  const moveSelectedNode = (dx: number, dy: number) => {
    if (!selectedNodeId) return;
    
    // Update node position
    setNodes(prev => prev.map(n => n.id === selectedNodeId ? { ...n, x: n.x + dx, y: n.y + dy } : n));
    
    // Update connected edges' control points relative to movement
    setEdges(prev => prev.map(e => {
        if (!e.controlPoints) return e;
        const newCPs = [...e.controlPoints];
        let updated = false;
        
        if (e.source === selectedNodeId) {
            newCPs[0] = { x: newCPs[0].x + dx, y: newCPs[0].y + dy };
            updated = true;
        }
        if (e.target === selectedNodeId) {
            newCPs[1] = { x: newCPs[1].x + dx, y: newCPs[1].y + dy };
            updated = true;
        }
        return updated ? { ...e, controlPoints: newCPs } : e;
    }));
  };

  // Helper to get absolute coordinates of a specific handle
  const getHandleCoords = (node: WorkflowNode, handle: HandlePosition) => {
      const w = node.width || 120;
      const h = node.height || 60;
      let x = node.x;
      let y = node.y;

      switch (handle) {
          case 'top': x += w / 2; break;
          case 'right': x += w; y += h / 2; break;
          case 'bottom': x += w / 2; y += h; break;
          case 'left': y += h / 2; break;
      }
      return { x, y };
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
        return; 
    }

    if (connectionMode.active) return;

    const node = nodes.find(n => n.id === id);
    if (!node) return;

    setDraggingId(id);
    setDragStartPos({ x: e.clientX, y: e.clientY });
    setNodeStartPos({ x: node.x, y: node.y });
    
    // Capture snapshots of connected edges to move their handles
    const attachedEdges = edges.filter(e => e.source === id || e.target === id);
    setEdgeStartSnapshots(attachedEdges.map(e => ({
        id: e.id,
        cp: e.controlPoints ? [...e.controlPoints] : []
    })));
    
    setDidMove(false);
  };

  const handleCanvasMouseMove = (e: React.MouseEvent) => {
    if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
    }

    if (draggingId) {
        const dx = (e.clientX - dragStartPos.x) / zoom;
        const dy = (e.clientY - dragStartPos.y) / zoom;

        if (Math.abs(dx) > 2 || Math.abs(dy) > 2) setDidMove(true);

        // Update Node Position
        setNodes(prev => prev.map(n => n.id === draggingId ? { 
            ...n, 
            x: nodeStartPos.x + dx, 
            y: nodeStartPos.y + dy 
        } : n));

        // Update Connected Edge Handles (Synchronized Movement)
        setEdges(prev => prev.map(edge => {
            const snapshot = edgeStartSnapshots.find(s => s.id === edge.id);
            if (!snapshot || !snapshot.cp.length) return edge;

            const newCPs = [...edge.controlPoints || []];
            
            // If dragging source node, move start control point (cp[0])
            if (edge.source === draggingId && snapshot.cp[0]) {
                newCPs[0] = { 
                    x: snapshot.cp[0].x + dx, 
                    y: snapshot.cp[0].y + dy 
                };
            }
            
            // If dragging target node, move end control point (cp[1])
            if (edge.target === draggingId && snapshot.cp[1]) {
                newCPs[1] = { 
                    x: snapshot.cp[1].x + dx, 
                    y: snapshot.cp[1].y + dy 
                };
            }

            return { ...edge, controlPoints: newCPs };
        }));

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
    if (draggingId && !didMove) {
        setSelectedNodeId(draggingId);
        setSelectedEdgeId(null);
    }
    setDraggingId(null);
    setDraggingControlPoint(null);
    setEdgeStartSnapshots([]);
  };

  // --- Mobile Touch Handlers ---
  const handleNodeTouchStart = (id: string) => {
      longPressTimer.current = setTimeout(() => {
          setSelectedNodeId(id);
          setSelectedEdgeId(null);
          if (navigator.vibrate) navigator.vibrate(50);
          longPressTimer.current = null;
      }, 600); 
  };

  const handleNodeTouchMove = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleNodeTouchEnd = () => {
      if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
      }
  };

  const handleCanvasClick = (e: React.MouseEvent) => {
      if (activeTool) {
          const coords = getCanvasCoordinates(e);
          createNode(activeTool, coords.x, coords.y);
          setActiveTool(null); 
          return;
      }
      if (!draggingId && !draggingControlPoint && !didMove) {
          setSelectedNodeId(null);
          setSelectedEdgeId(null);
      }
  };

  const handleConnectClick = (e: React.MouseEvent, nodeId: string, handle: HandlePosition) => {
      e.stopPropagation();
      e.preventDefault();
      
      if (!connectionMode.active) return;

      if (!connectionMode.sourceId) {
          setConnectionMode({ ...connectionMode, sourceId: nodeId, sourceHandle: handle });
      } else {
          const sourceId = connectionMode.sourceId;
          const sourceHandle = connectionMode.sourceHandle || 'right'; // Fallback
          
          const src = nodes.find(n => n.id === sourceId);
          const tgt = nodes.find(n => n.id === nodeId);
          
          if (src && tgt) {
              const start = getHandleCoords(src, sourceHandle);
              const end = getHandleCoords(tgt, handle);
              
              // Smart default Control Points for Bezier
              const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
              const controlDist = Math.max(dist * 0.5, 50);

              const getControlOffset = (h: HandlePosition, d: number) => {
                  switch(h) {
                      case 'top': return { x: 0, y: -d };
                      case 'bottom': return { x: 0, y: d };
                      case 'left': return { x: -d, y: 0 };
                      case 'right': return { x: d, y: 0 };
                  }
              };

              const srcOffset = getControlOffset(sourceHandle, controlDist);
              const tgtOffset = getControlOffset(handle, controlDist);

              // Basic CP coordinates
              const cp1 = { x: start.x + srcOffset.x, y: start.y + srcOffset.y };
              const cp2 = { x: end.x + tgtOffset.x, y: end.y + tgtOffset.y };

              // --- INITIAL CONTROL POINT OFFSET PREVENTION ---
              // Check how many existing edges connect these two nodes (in any direction)
              const existingEdges = edges.filter(ed => 
                  (ed.source === sourceId && ed.target === nodeId) ||
                  (ed.source === nodeId && ed.target === sourceId)
              );
              
              // If multiple connections exist, fan out the control points initially
              if (existingEdges.length > 0 && sourceId !== nodeId) {
                  const count = existingEdges.length;
                  // Alternate offset: +30, -30, +60, -60...
                  const offsetMag = Math.ceil((count + 1) / 2) * 40; 
                  const sign = (count % 2 === 0) ? 1 : -1;
                  const offset = offsetMag * sign;

                  // Apply perpendicular offset to Bezier handles
                  if (sourceHandle === 'left' || sourceHandle === 'right') {
                      cp1.y += offset; 
                  } else {
                      cp1.x += offset;
                  }
                  
                  if (handle === 'left' || handle === 'right') {
                      cp2.y += offset;
                  } else {
                      cp2.x += offset;
                  }
              }

              // Self-loop special case
              if (sourceId === nodeId) {
                 const selfLoopCount = existingEdges.length;
                 const expand = 50 + (selfLoopCount * 20);
                 
                 cp1.x += (sourceHandle === 'right' ? expand : sourceHandle === 'left' ? -expand : 0);
                 cp1.y += (sourceHandle === 'bottom' ? expand : sourceHandle === 'top' ? -expand : 0);
                 
                 if (sourceHandle === handle) {
                     cp2.x = cp1.x; 
                     cp2.y = cp1.y + (sourceHandle === 'top' || sourceHandle === 'bottom' ? 0 : 50);
                 }
              }

              const newEdge: WorkflowEdge = {
                  id: `e-${Date.now()}`,
                  source: sourceId,
                  target: nodeId,
                  sourceHandle: sourceHandle,
                  targetHandle: handle,
                  type: 'curved',
                  controlPoints: [cp1, cp2]
              };
              
              setEdges(prev => [...prev, newEdge]);
          }
          
          setConnectionMode({ active: false, sourceId: null, sourceHandle: null });
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

  const initCurve = (edgeId: string) => {
      setEdges(prev => prev.map(e => {
          if (e.id !== edgeId) return e;

          // If already curved and has control points, just ensure type is updated
          if (e.controlPoints && e.controlPoints.length === 2) {
              return { ...e, type: 'curved' };
          }
          
          // Calculate default control points if converting from straight to curved
          const src = nodes.find(n => n.id === e.source);
          const tgt = nodes.find(n => n.id === e.target);
          
          if (!src || !tgt) return { ...e, type: 'curved' };

          const start = getHandleCoords(src, e.sourceHandle || 'right');
          const end = getHandleCoords(tgt, e.targetHandle || 'left');
          
          const dist = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
          const controlDist = Math.max(dist * 0.5, 50);

          const getControlOffset = (h: HandlePosition, d: number) => {
              switch(h) {
                  case 'top': return { x: 0, y: -d };
                  case 'bottom': return { x: 0, y: d };
                  case 'left': return { x: -d, y: 0 };
                  case 'right': return { x: d, y: 0 };
              }
          };

          const srcOffset = getControlOffset(e.sourceHandle || 'right', controlDist);
          const tgtOffset = getControlOffset(e.targetHandle || 'left', controlDist);

          const cp1 = { 
              x: start.x + srcOffset.x, 
              y: start.y + srcOffset.y 
          };
          const cp2 = { 
              x: end.x + tgtOffset.x, 
              y: end.y + tgtOffset.y 
          };

          return { 
              ...e, 
              type: 'curved', 
              controlPoints: [cp1, cp2] 
          };
      }));
  };

  const exportAsImage = () => {
      if (!svgRef.current) return;
      const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
      // Hide handles in export
      const handles = clone.querySelectorAll('.control-handle');
      handles.forEach(h => h.remove());
      const connectors = clone.querySelectorAll('.node-connector');
      connectors.forEach(c => c.remove());
      
      const contentGroup = clone.getElementById('workflow-content');
      if(contentGroup) contentGroup.setAttribute('transform', 'scale(1)');

      const svgData = new XMLSerializer().serializeToString(clone);
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const img = new Image();
      
      const bbox = svgRef.current.getBBox(); 
      const width = (bbox.width || 800) + 100;
      const height = (bbox.height || 600) + 100;
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

  const renderHandles = (node: WorkflowNode) => {
      const w = node.width || 120;
      const h = node.height || 60;
      const handles: { h: HandlePosition; x: number; y: number }[] = [
          { h: 'top', x: w/2, y: 0 },
          { h: 'right', x: w, y: h/2 },
          { h: 'bottom', x: w/2, y: h },
          { h: 'left', x: 0, y: h/2 }
      ];

      return handles.map(handle => {
          const isSource = connectionMode.sourceId === node.id && connectionMode.sourceHandle === handle.h;
          
          return (
              <circle
                  key={handle.h}
                  cx={handle.x}
                  cy={handle.y}
                  r={6}
                  className={`node-connector transition-all duration-200 ${
                      connectionMode.active ? 'opacity-100 cursor-pointer' : 'opacity-0 group-hover:opacity-100'
                  }`}
                  fill={isSource ? '#22c55e' : '#3b82f6'}
                  stroke="#111827"
                  strokeWidth={2}
                  onMouseDown={(e) => handleConnectClick(e, node.id, handle.h)}
              />
          );
      });
  };

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

          const start = getHandleCoords(src, edge.sourceHandle || 'right');
          const end = getHandleCoords(tgt, edge.targetHandle || 'left');

          // --- Automatic Start/End Offset Distribution ---
          // Prevent overlapping lines from same port by offsetting them slightly
          const sourceHandle = edge.sourceHandle || 'right';
          const sourceSiblings = edges.filter(e => e.source === edge.source && (e.sourceHandle || 'right') === sourceHandle);
          if (sourceSiblings.length > 1) {
              const idx = sourceSiblings.findIndex(e => e.id === edge.id);
              if (idx !== -1) {
                  // Distribute within +/- 15px
                  const offset = (idx - (sourceSiblings.length - 1) / 2) * 12;
                  if (sourceHandle === 'left' || sourceHandle === 'right') start.y += offset;
                  else start.x += offset;
              }
          }

          const targetHandle = edge.targetHandle || 'left';
          const targetSiblings = edges.filter(e => e.target === edge.target && (e.targetHandle || 'left') === targetHandle);
          if (targetSiblings.length > 1) {
              const idx = targetSiblings.findIndex(e => e.id === edge.id);
              if (idx !== -1) {
                  const offset = (idx - (targetSiblings.length - 1) / 2) * 12;
                  if (targetHandle === 'left' || targetHandle === 'right') end.y += offset;
                  else end.x += offset;
              }
          }

          let pathD = '';
          let midX = (start.x + end.x) / 2;
          let midY = (start.y + end.y) / 2;

          if (edge.type === 'curved' && edge.controlPoints && edge.controlPoints.length >= 2) {
              const cp1 = edge.controlPoints[0];
              const cp2 = edge.controlPoints[1];
              pathD = `M${start.x},${start.y} C${cp1.x},${cp1.y}, ${cp2.x},${cp2.y}, ${end.x},${end.y}`;
              
              // Approximate midpoint for label
              const t = 0.5;
              midX = (1-t)**3 * start.x + 3*(1-t)**2 * t * cp1.x + 3*(1-t) * t**2 * cp2.x + t**3 * end.x;
              midY = (1-t)**3 * start.y + 3*(1-t)**2 * t * cp1.y + 3*(1-t) * t**2 * cp2.y + t**3 * end.y;
          } else {
              pathD = `M${start.x},${start.y} L${end.x},${end.y}`;
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
                          <path d={`M${start.x},${start.y} L${edge.controlPoints[0].x},${edge.controlPoints[0].y}`} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                          <path d={`M${end.x},${end.y} L${edge.controlPoints[1].x},${edge.controlPoints[1].y}`} stroke="#3b82f6" strokeWidth="1" strokeDasharray="4 2" opacity="0.5" />
                          
                          {/* Handle 1 */}
                          <g 
                             className="cursor-move"
                             onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingControlPoint({ edgeId: edge.id, index: 0 }); }}
                          >
                             {/* Transparent larger hit area for easier grabbing */}
                             <circle cx={edge.controlPoints[0].x} cy={edge.controlPoints[0].y} r="15" fill="transparent" />
                             {/* Visual Handle - No CSS transforms to avoid bouncing loop */}
                             <circle cx={edge.controlPoints[0].x} cy={edge.controlPoints[0].y} r="6" fill="#22c55e" stroke="white" strokeWidth="1" />
                          </g>

                          {/* Handle 2 */}
                          <g 
                             className="cursor-move"
                             onMouseDown={(e) => { e.stopPropagation(); e.preventDefault(); setDraggingControlPoint({ edgeId: edge.id, index: 1 }); }}
                          >
                             <circle cx={edge.controlPoints[1].x} cy={edge.controlPoints[1].y} r="15" fill="transparent" />
                             <circle cx={edge.controlPoints[1].x} cy={edge.controlPoints[1].y} r="6" fill="#22c55e" stroke="white" strokeWidth="1" />
                          </g>
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
                    onClick={() => setConnectionMode({ active: !connectionMode.active, sourceId: null, sourceHandle: null })}
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
            <div className="order-2 md:order-1 flex-none w-full h-24 md:w-60 md:h-full bg-gray-900 border-t md:border-t-0 md:border-r border-gray-800 flex flex-row md:flex-col z-30 shadow-xl overflow-x-auto md:overflow-y-auto overflow-y-hidden">
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
                className="order-1 md:order-2 flex-1 relative bg-gray-950 overflow-hidden cursor-crosshair touch-none z-0"
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
                                className={`group ${connectionMode.active ? 'cursor-pointer' : 'cursor-move'}`}
                            >
                                {renderNodeShape(node)}
                                <foreignObject x="0" y="0" width={node.width || 120} height={node.height || 60} style={{ pointerEvents: 'none' }}>
                                    <div className={`w-full h-full flex items-center justify-center text-xs text-center p-2 break-words leading-tight ${node.type === 'note' ? 'text-yellow-900 font-serif italic' : 'text-white font-medium'}`}>
                                        {node.label}
                                    </div>
                                </foreignObject>
                                {/* Render 4 Connector Handles */}
                                {renderHandles(node)}
                            </g>
                        ))}
                    </g>
                </svg>

                {/* Selection / Connection Hint */}
                {connectionMode.active && (
                    <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-green-600 text-white text-xs px-3 py-1 rounded-full shadow-lg pointer-events-none animate-bounce">
                        {connectionMode.sourceId ? 'Click Target Blue Dot' : 'Click Source Blue Dot'}
                    </div>
                )}
                
                {activeTool && (
                     <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-blue-600 text-white text-xs px-3 py-1 rounded-full shadow-lg pointer-events-none animate-pulse">
                        Tap canvas to place {activeTool}
                    </div>
                )}
            </div>

            {/* --- Inspector Panel --- */}
            {(selectedNode || selectedEdge) && (
                <div className="absolute left-0 right-0 bottom-0 h-[45vh] md:h-auto md:inset-y-0 md:right-0 md:left-auto md:w-72 bg-gray-900 border-t md:border-t-0 md:border-l border-gray-800 p-4 flex flex-col z-40 shadow-2xl overflow-y-auto md:order-3">
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
                                        rows={2}
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

                                {/* Mobile Movement Controls */}
                                <div className="mt-4 p-3 bg-gray-800/50 rounded-lg border border-gray-700">
                                    <label className="block text-xs text-gray-500 mb-2 font-bold uppercase">Position & Movement</label>
                                    <div className="flex gap-2 mb-2">
                                        <div className="flex-1">
                                            <span className="text-[10px] text-gray-500 mr-1">X</span>
                                            <input 
                                                type="number" 
                                                value={Math.round(selectedNode.x)} 
                                                onChange={(e) => moveSelectedNode(Number(e.target.value) - selectedNode.x, 0)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                            />
                                        </div>
                                        <div className="flex-1">
                                            <span className="text-[10px] text-gray-500 mr-1">Y</span>
                                            <input 
                                                type="number" 
                                                value={Math.round(selectedNode.y)} 
                                                onChange={(e) => moveSelectedNode(0, Number(e.target.value) - selectedNode.y)}
                                                className="w-full bg-gray-900 border border-gray-700 rounded px-2 py-1 text-xs text-white"
                                            />
                                        </div>
                                    </div>
                                    
                                    {/* D-Pad Grid */}
                                    <div className="grid grid-cols-3 gap-1 w-24 mx-auto">
                                        <div />
                                        <button onClick={() => moveSelectedNode(0, -10)} className="bg-gray-700 hover:bg-gray-600 p-1 rounded text-white active:bg-blue-600 flex justify-center">
                                            <ChevronUpIcon className="w-4 h-4" />
                                        </button>
                                        <div />
                                        
                                        <button onClick={() => moveSelectedNode(-10, 0)} className="bg-gray-700 hover:bg-gray-600 p-1 rounded text-white active:bg-blue-600 flex justify-center">
                                            <ChevronUpIcon className="w-4 h-4 -rotate-90" />
                                        </button>
                                        <div className="w-4 h-4 bg-gray-600 rounded-full m-auto opacity-50" />
                                        <button onClick={() => moveSelectedNode(10, 0)} className="bg-gray-700 hover:bg-gray-600 p-1 rounded text-white active:bg-blue-600 flex justify-center">
                                            <ChevronUpIcon className="w-4 h-4 rotate-90" />
                                        </button>

                                        <div />
                                        <button onClick={() => moveSelectedNode(0, 10)} className="bg-gray-700 hover:bg-gray-600 p-1 rounded text-white active:bg-blue-600 flex justify-center">
                                            <ChevronUpIcon className="w-4 h-4 rotate-180" />
                                        </button>
                                        <div />
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
                                    <p className="text-[10px] text-green-400 mt-2 flex items-center gap-1">
                                        <WrenchScrewdriverIcon className="w-3 h-3" /> Drag green handles to sculpt.
                                    </p>
                                </div>
                            </>
                        )}

                        <div className="pt-4 border-t border-gray-800 pb-10 md:pb-0">
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
