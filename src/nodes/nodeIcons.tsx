import type { ComponentType, ReactNode } from 'react';
import {
  PhoneIncoming, PhoneOff, LayoutGrid, Volume2, Hash, Users, UserCheck,
  PhoneCall, CornerDownRight, RotateCcw, Clock, PhoneForwarded, Voicemail,
  GitBranch, Globe, Variable,
} from 'lucide-react';

// Single source of truth for NODE_DEFINITIONS icon names — consumed by BaseNode
// (canvas nodes), NodePalette (Node Library drag source), and NodeLegend (read-mode
// key), so all three always render the same icon for a given node kind instead of
// drifting across separately hand-rolled maps.
const NODE_ICONS: Record<string, ComponentType<{ size?: number }>> = {
  PhoneIncoming, PhoneOff, LayoutGrid, Volume2, Hash, Users, UserCheck,
  PhoneCall, CornerDownRight, RotateCcw, Clock, PhoneForwarded, Voicemail,
  GitBranch, Globe, Variable,
};

export function getNodeIcon(name: string, size = 14): ReactNode {
  const Icon = NODE_ICONS[name];
  return Icon ? <Icon size={size} /> : <span>●</span>;
}
