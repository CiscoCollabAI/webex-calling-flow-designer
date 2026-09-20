export type NodeCategory = 'control' | 'voice' | 'routing' | 'time' | 'integration' | 'transfer';

export type CanvasMode = 'aa' | 'cq' | 'cxe' | null;

export type NodeKind =
  | 'start'
  | 'end'
  | 'menu'
  | 'playMessage'
  | 'collectDigits'
  | 'queue'
  | 'huntGroup'
  | 'subAutoAttendant'
  | 'repeatMenu'
  | 'businessHours'
  | 'transfer'
  | 'voicemail'
  | 'branch'
  | 'httpRequest'
  | 'callback'
  | 'setVariable'
  | 'agentDirect';

export interface MenuOption {
  digit: string;
  label: string;
  description?: string;
  actionKind?: NodeKind;
}

export interface BusinessHoursSchedule {
  day: string;
  open: boolean;
  start: string;
  end: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface NodeData extends Record<string, unknown> {
  label: string;
  description?: string;
  kind: NodeKind;

  // Start node
  phoneNumber?: string;
  phoneNumberId?: string;   // Webex number ID
  extensionNumber?: string;
  aaLanguage?: string;
  aaLanguageCode?: string;
  aaExtensionDialing?: string;
  aaNameDialing?: string;
  // AA Overview (read-only, from Webex import)
  aaEnabled?: boolean;
  aaCallForwardingEnabled?: boolean;
  aaCallForwardingDestination?: string;
  aaCallForwardingToVoicemail?: boolean;
  aaDialingOptions?: string;       // 'ENTERPRISE' | 'GROUP' | 'NONE' — org-level dialing scope
  // AA General Settings (read-only, from Webex import)
  aaLocationName?: string;
  aaCallerIdPolicy?: string;       // 'DIRECT_LINE' | 'OTHER_EXTERNAL_NUMBER' | 'LOCATION_NUMBER'
  aaCallerIdDisplayName?: string;  // firstName + lastName (used when policy = DIRECT_LINE)
  aaCustomCallerIdName?: string;   // used when policy = OTHER_EXTERNAL_NUMBER
  aaDialByNameEnabled?: boolean;

  // Call Queue flow fields (read-only, from Webex import)
  cqEnabled?: boolean;
  cqLocationName?: string;
  // "External caller ID phone number" (Control Hub section) — which number is shown externally
  cqCallingLineIdPolicy?: string;
  cqCallingLineIdPhoneNumber?: string;
  // "Direct line caller ID name" (separate Control Hub section) — which name accompanies it
  cqDirectLineCallerIdSelection?: string;
  cqCallerIdDisplayName?: string;
  cqDialByName?: string;
  cqRoutingType?: string;          // mode: 'PRIORITY_BASED' | 'SKILL_BASED' — confirmed via OpenAPI spec
  cqRoutingPolicy?: string;        // pattern: 'CIRCULAR' | 'REGULAR' | 'SIMULTANEOUS' | 'UNIFORM' | 'WEIGHTED' — confirmed via OpenAPI spec
  cqMaxSize?: number;
  cqLanguage?: string;             // friendly name, e.g. "English"
  cqLanguageCode?: string;
  cqTimezone?: string;
  cqNotificationTonesUseOrgDefault?: boolean;
  cqToneBargeInEnabled?: boolean;
  cqToneSilentMonitoringEnabled?: boolean;
  cqToneSupervisorCoachingEnabled?: boolean;
  cqDistinctiveRingEnabled?: boolean;
  cqDistinctiveRingPattern?: string;
  // Confirmed via OpenAPI spec — previously unmodeled top-level queue toggles.
  cqBusinessTextingEnabled?: boolean;
  cqPhoneNumberForOutgoingCallsEnabled?: boolean;
  cqAllowCallWaitingForAgentsEnabled?: boolean;
  cqDigitalInboxEnabled?: boolean;
  cqAgents?: { name: string; extension?: string; phoneNumber?: string; agentType?: string; skillLevel?: number; joinEnabled?: boolean; weight?: number }[];
  cqCallbackEnabled?: boolean;
  cqCallForwardingEnabled?: boolean;
  cqCallForwardingDestination?: string;
  cqCallForwardingToVoicemail?: boolean;
  cqCallForwardingRingReminder?: boolean;
  // Selective Call Forwarding — confirmed via OpenAPI spec (queues/{id}/callForwarding.selective/.rules)
  cqSelectiveForwardingEnabled?: boolean;
  cqSelectiveForwardingDestination?: string;
  cqSelectiveForwardingRules?: { name: string; enabled: boolean; forwardTo: string }[];
  // Business Continuity "operating modes" — confirmed via OpenAPI spec
  // (queues/{id}/callForwarding.operatingModes); summary only.
  cqOperatingModesEnabled?: boolean;
  cqOperatingModesCount?: number;
  // DNIS queue-wide settings — confirmed via OpenAPI spec (queues/{id}/dnis/settings)
  cqDnisDistinctiveRingingEnabled?: boolean;
  cqDnisDisplayNameAndNumberEnabled?: boolean;
  cqDnisNumbers?: {
    name: string;
    extension?: string;
    ringPattern?: string;
    customAnnouncementEnabled?: boolean;
    announcementSummary?: { label: string; enabled: boolean; greeting?: string; fileName?: string; extra?: string }[];
  }[];

  // Play message node
  messageType?: 'tts' | 'audio';
  messageText?: string;
  audioFile?: string;
  language?: string;
  voice?: string;

  // Menu / IVR node
  menuPromptType?: 'tts' | 'audio';
  menuPrompt?: string;
  menuGreetingFile?: string;
  menuOptions?: MenuOption[];
  timeoutSeconds?: number;
  maxRetries?: number;
  invalidInputAction?: 'repeat' | 'disconnect' | 'transfer';
  menuExtensionEnabled?: boolean;
  menuNameDialingEnabled?: boolean;
  menuTransferToOperatorEnabled?: boolean;

  // Set when this node is a direct branch from a menu key
  menuKey?: string;   // DTMF digit that routes here ("1", "0", "*", "∅" for no-input)

  // Collect digits node
  collectPrompt?: string;
  minDigits?: number;
  maxDigits?: number;
  terminationDigit?: string;
  interDigitTimeout?: number;

  // Queue node
  queueName?: string;
  queueId?: string;           // Webex queue UUID (set when connected to org)
  queueLocationId?: string;   // Webex location UUID
  maxWaitTime?: number;
  queueMaxSize?: number;
  mohEnabled?: boolean;
  holdMusicType?: 'default' | 'custom';
  agentJoinEnabled?: boolean;
  estimatedWaitEnabled?: boolean;
  callbackEnabled?: boolean;
  // Comfort Message + Comfort Message Bypass — confirmed via OpenAPI spec
  // (queueSettings.comfortMessage / .comfortMessageBypass). Bypass skips the comfort
  // message entirely when the caller's wait time is still under the threshold.
  comfortMessageEnabled?: boolean;
  comfortMessageTimeBetween?: number;
  comfortMessageBypassEnabled?: boolean;
  comfortMessageBypassThreshold?: number;
  // Whisper Message — confirmed via OpenAPI spec (queueSettings.whisperMessage).
  // Plays to the agent (not the caller) just before the call connects.
  whisperMessageEnabled?: boolean;
  priorityEscalationEnabled?: boolean;
  priorityEscalationThreshold?: number;
  digitalHandoffEnabled?: boolean;
  callTimeoutHandlingEnabled?: boolean;
  // Set by the Webex importer only — confirmed absent from the entire public Cloud
  // Calling OpenAPI spec (read and write schemas both checked), not just callPolicies.
  // Distinguishes "imported, unknowable" from "manually authored" so the UI doesn't
  // assert false certainty about an imported queue's actual state.
  priorityEscalationSourceUnknown?: boolean;
  callTimeoutHandlingSourceUnknown?: boolean;
  // Bounced Calls — confirmed via callPolicies.callBounce
  callBounceEnabled?: boolean;
  callBounceMaxRings?: number;
  callBounceOnAgentUnavailableEnabled?: boolean;
  callBounceAlertAgentEnabled?: boolean;
  callBounceAlertAgentMaxSeconds?: number;
  callBounceOnHoldEnabled?: boolean;
  callBounceOnHoldMaxSeconds?: number;

  // Business hours node
  scheduleName?: string;
  scheduleId?: string;          // Webex schedule UUID
  scheduleLevel?: 'LOCATION' | 'ORGANIZATION';
  holidaySchedule?: string;
  holidayScheduleId?: string;   // Webex holiday schedule UUID
  holidayScheduleLevel?: 'LOCATION' | 'ORGANIZATION';
  timezone?: string;
  businessHours?: BusinessHoursSchedule[];

  // Transfer node
  transferType?: 'blind' | 'consultative' | 'queue';
  transferTarget?: string;
  transferNumber?: string;

  // Voicemail node
  voicemailTarget?: 'user' | 'group';
  voicemailExtension?: string;
  voicemailUserId?: string;     // Webex user/hunt-group UUID
  greetingType?: 'default' | 'custom';

  // Branch / Condition node
  variable?: string;
  operator?: string;
  compareValue?: string;

  // HTTP Request node
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: string;
  responseMapping?: Record<string, string>;

  // Callback node
  callbackType?: 'immediate' | 'scheduled';
  callbackNumber?: string;
  callbackMessage?: string;
  callbackAnnouncement?: string;

  // Set Variable node
  variableName?: string;
  variableValue?: string;

  // Agent Direct
  agentId?: string;         // Webex user UUID
  agentExtension?: string;
  agentName?: string;

  // Hunt Group
  huntGroupId?: string;     // Webex hunt group UUID
  huntGroupName?: string;
  huntGroupExtension?: string;

  // Sub Auto-Attendant
  targetAutoAttendantId?: string;
  targetAutoAttendantName?: string;

  // Validation state
  hasError?: boolean;
  errorMessage?: string;

  // Set on nodes downstream of a Forced Forward bypass — config still exists but
  // currently doesn't execute (Forced Forward overrides it).
  bypassed?: boolean;
}

export interface NodeDefinition {
  kind: NodeKind;
  label: string;
  description: string;
  category: NodeCategory;
  color: string;
  bgColor: string;
  borderColor: string;
  icon: string;
  maxInputs?: number;
  maxOutputs?: number;
  outputLabels?: string[];
}

export const NODE_DEFINITIONS: NodeDefinition[] = [
  {
    kind: 'start',
    label: 'Entry Point',
    description: 'Call flow start — phone number or extension',
    category: 'control',
    color: '#FFFFFF',
    bgColor: '#16A34A',
    borderColor: '#15803D',
    icon: 'PhoneIncoming',
    maxInputs: 0,
    maxOutputs: 1,
  },
  {
    kind: 'end',
    label: 'Disconnect',
    description: 'End the call and disconnect',
    category: 'control',
    color: '#FFFFFF',
    bgColor: '#DC2626',
    borderColor: '#B91C1C',
    icon: 'PhoneOff',
    maxInputs: 1,
    maxOutputs: 0,
  },
  {
    kind: 'menu',
    label: 'IVR Menu',
    description: 'Play a prompt and collect DTMF keypress',
    category: 'voice',
    color: '#1E3A5F',
    bgColor: '#DBEAFE',
    borderColor: '#3B82F6',
    icon: 'LayoutGrid',
    maxOutputs: 12,
  },
  {
    kind: 'playMessage',
    label: 'Play Message',
    description: 'Play TTS or audio file announcement',
    category: 'voice',
    color: '#3B0764',
    bgColor: '#F3E8FF',
    borderColor: '#A855F7',
    icon: 'Volume2',
    maxOutputs: 1,
  },
  {
    kind: 'collectDigits',
    label: 'Collect Digits',
    description: 'Collect DTMF digits from caller',
    category: 'voice',
    color: '#431407',
    bgColor: '#FFF7ED',
    borderColor: '#F97316',
    icon: 'Hash',
    maxOutputs: 2,
    outputLabels: ['Success', 'Timeout/Error'],
  },
  {
    kind: 'queue',
    label: 'Call Queue',
    description: 'Route to a Webex Calling call queue',
    category: 'routing',
    color: '#0C1A2E',
    bgColor: '#E0F2FE',
    borderColor: '#0284C7',
    icon: 'Users',
    maxOutputs: 3,
    outputLabels: ['Answered', 'Max Wait', 'Full Queue'],
  },
  {
    kind: 'agentDirect',
    label: 'Direct to Agent',
    description: 'Route directly to a specific agent',
    category: 'routing',
    color: '#0C1A2E',
    bgColor: '#DCFCE7',
    borderColor: '#16A34A',
    icon: 'UserCheck',
    maxOutputs: 2,
    outputLabels: ['Connected', 'No Answer'],
  },
  {
    kind: 'huntGroup',
    label: 'Hunt Group',
    description: 'Route to a Webex Calling hunt group — rings agents sequentially or simultaneously',
    category: 'routing',
    color: '#1E1B4B',
    bgColor: '#EEF2FF',
    borderColor: '#4F46E5',
    icon: 'PhoneCall',
    maxOutputs: 2,
    outputLabels: ['Answered', 'No Answer'],
  },
  {
    kind: 'subAutoAttendant',
    label: 'Sub Auto-Attendant',
    description: 'Jump to another Auto-Attendant — used for nested IVR menus',
    category: 'routing',
    color: '#431407',
    bgColor: '#FFF7ED',
    borderColor: '#EA580C',
    icon: 'CornerDownRight',
    maxOutputs: 1,
    outputLabels: ['Transferred'],
  },
  {
    kind: 'repeatMenu',
    label: 'Repeat Menu',
    description: 'Replay the current IVR menu prompt for the caller — loop back on invalid input',
    category: 'voice',
    color: '#4A044E',
    bgColor: '#FDF4FF',
    borderColor: '#A21CAF',
    icon: 'RotateCcw',
    maxOutputs: 1,
    outputLabels: ['Back to Menu'],
  },
  {
    kind: 'businessHours',
    label: 'Business Hours',
    description: 'Check business hours or holiday schedule',
    category: 'time',
    color: '#3D2700',
    bgColor: '#FFFBEB',
    borderColor: '#F59E0B',
    icon: 'Clock',
    maxOutputs: 3,
    outputLabels: ['Open', 'Closed', 'Holiday'],
  },
  {
    kind: 'transfer',
    label: 'Transfer',
    description: 'Blind or consultative call transfer',
    category: 'transfer',
    color: '#042F2E',
    bgColor: '#CCFBF1',
    borderColor: '#0D9488',
    icon: 'PhoneForwarded',
    maxOutputs: 2,
    outputLabels: ['Success', 'Failed'],
  },
  {
    kind: 'voicemail',
    label: 'Voicemail',
    description: 'Send caller to voicemail box',
    category: 'transfer',
    color: '#1C1917',
    bgColor: '#F5F5F4',
    borderColor: '#78716C',
    icon: 'Voicemail',
    maxOutputs: 1,
  },
  {
    kind: 'branch',
    label: 'Branch / Condition',
    description: 'Route based on variable or condition',
    category: 'control',
    color: '#2D1B69',
    bgColor: '#EDE9FE',
    borderColor: '#7C3AED',
    icon: 'GitBranch',
    maxOutputs: 3,
    outputLabels: ['Match', 'No Match', 'Error'],
  },
  {
    kind: 'httpRequest',
    label: 'HTTP Request',
    description: 'Call external API or webhook (CRM screen pop)',
    category: 'integration',
    color: '#0F172A',
    bgColor: '#F1F5F9',
    borderColor: '#475569',
    icon: 'Globe',
    maxOutputs: 2,
    outputLabels: ['Success', 'Error'],
  },
  {
    kind: 'callback',
    label: 'Schedule Callback',
    description: 'Offer caller a callback instead of waiting',
    category: 'routing',
    color: '#052E16',
    bgColor: '#DCFCE7',
    borderColor: '#22C55E',
    icon: 'PhoneCall',
    maxOutputs: 2,
    outputLabels: ['Accepted', 'Declined'],
  },
  {
    kind: 'setVariable',
    label: 'Set Variable',
    description: 'Store a value to a flow variable',
    category: 'control',
    color: '#1A1A2E',
    bgColor: '#F0F9FF',
    borderColor: '#0EA5E9',
    icon: 'Variable',
    maxOutputs: 1,
  },
];

export const CATEGORY_LABELS: Record<NodeCategory, string> = {
  control: 'Flow Control',
  voice: 'Voice & IVR',
  routing: 'Routing',
  time: 'Time & Schedule',
  transfer: 'Transfer & Voicemail',
  integration: 'Integration',
};

export const CATEGORY_COLORS: Record<NodeCategory, string> = {
  control: '#6366F1',
  voice: '#8B5CF6',
  routing: '#0284C7',
  time: '#F59E0B',
  transfer: '#0D9488',
  integration: '#475569',
};
