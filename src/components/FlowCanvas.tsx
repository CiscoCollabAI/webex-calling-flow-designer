import { useCallback, useEffect, useRef } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  ConnectionLineType,
  SelectionMode,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { nodeTypes } from '../nodes/nodeTypes';
import { useFlowStore } from '../store/flowStore';
import type { NodeKind } from '../types';

interface FlowCanvasProps {
  dragNodeKind: NodeKind | null;
  onDragEnd: () => void;
}

export function FlowCanvas({ dragNodeKind, onDragEnd }: FlowCanvasProps) {
  const {
    nodes, edges,
    onNodesChange, onEdgesChange, onConnect,
    selectNode, addNode,
    fitViewTrigger,
  } = useFlowStore();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const rfInstance = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onInit = useCallback((instance: any) => {
    rfInstance.current = instance;
  }, []);

  const onDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData('application/flow-node') as NodeKind;
      if (!kind || !rfInstance.current || !containerRef.current) return;

      const bounds = containerRef.current.getBoundingClientRect();
      const position = rfInstance.current.screenToFlowPosition({
        x: event.clientX - bounds.left,
        y: event.clientY - bounds.top,
      });

      addNode(kind, { x: position.x - 100, y: position.y - 40 });
      onDragEnd();
    },
    [addNode, onDragEnd]
  );

  const onDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  }, []);

  const onPaneClick = useCallback(() => {
    selectNode(null);
  }, [selectNode]);

  useEffect(() => {
    if (fitViewTrigger === 0) return;
    // Small delay to let React render the new nodes before fitting
    const t = setTimeout(() => rfInstance.current?.fitView({ padding: 0.15, duration: 400 }), 80);
    return () => clearTimeout(t);
  }, [fitViewTrigger]);

  return (
    <div
      ref={containerRef}
      className="flex-1 h-full relative"
      style={{ background: 'var(--canvas-bg)' }}
    >
      {/* Drop zone hint when dragging */}
      {dragNodeKind && (
        <div className="absolute inset-0 border-4 border-dashed border-blue-400 rounded-none z-20 pointer-events-none flex items-center justify-center">
          <div className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg">
            Drop to add node
          </div>
        </div>
      )}

      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onInit={onInit}
        onDrop={onDrop}
        onDragOver={onDragOver}
        onPaneClick={onPaneClick}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        deleteKeyCode="Delete"
        multiSelectionKeyCode="Shift"
        selectionMode={SelectionMode.Partial}
        snapToGrid
        snapGrid={[16, 16]}
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: { stroke: '#94A3B8', strokeWidth: 2 },
          animated: false,
        }}
        connectionLineStyle={{ stroke: '#00BCF2', strokeWidth: 2.5 }}
        connectionLineType={ConnectionLineType.SmoothStep}
        style={{ width: '100%', height: '100%' }}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1.5}
          color="#CBD5E1"
        />
        <Controls
          position="bottom-left"
          showFitView
          showZoom
          showInteractive
          style={{ bottom: 16, left: 16 }}
        />
        <MiniMap
          position="bottom-right"
          style={{ bottom: 16, right: 16, width: 160, height: 100 }}
          nodeColor={(n) => {
            const colorMap: Record<string, string> = {
              start: '#16A34A',
              end: '#DC2626',
              menu: '#3B82F6',
              playMessage: '#A855F7',
              collectDigits: '#F97316',
              queue: '#0284C7',
              huntGroup: '#4F46E5',
              subAutoAttendant: '#EA580C',
              repeatMenu: '#A21CAF',
              agentDirect: '#16A34A',
              businessHours: '#F59E0B',
              transfer: '#0D9488',
              voicemail: '#78716C',
              branch: '#7C3AED',
              httpRequest: '#475569',
              callback: '#22C55E',
              setVariable: '#0EA5E9',
            };
            return colorMap[n.type as string] || '#94A3B8';
          }}
          maskColor="rgba(240,242,245,0.7)"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
