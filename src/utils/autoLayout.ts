import dagre from '@dagrejs/dagre';
import type { Node, Edge } from '@xyflow/react';
import type { NodeData } from '../types';

// Approximate rendered height per node kind — used so dagre space them correctly
const NODE_HEIGHT: Record<string, number> = {
  menu:          220,
  businessHours: 100,
  start:         110,
  end:            72,
  default:       110,
};

export function autoLayout(
  nodes: Node<NodeData>[],
  edges: Edge[],
  direction: 'TB' | 'LR' = 'TB',
): Node<NodeData>[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, ranksep: 100, nodesep: 60, marginx: 60, marginy: 60 });

  nodes.forEach((node) => {
    const h = NODE_HEIGHT[node.type ?? 'default'] ?? NODE_HEIGHT.default;
    g.setNode(node.id, { width: 220, height: h });
  });

  edges.forEach((edge) => {
    // dagre requires both endpoints to be registered nodes; skip orphan edges
    if (g.hasNode(edge.source) && g.hasNode(edge.target)) {
      g.setEdge(edge.source, edge.target);
    }
  });

  dagre.layout(g);

  return nodes.map((node) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { x, y } = g.node(node.id) as any;
    return { ...node, position: { x: x - 110, y: y - (NODE_HEIGHT[node.type ?? 'default'] ?? NODE_HEIGHT.default) / 2 } };
  });
}
