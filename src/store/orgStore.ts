import { create } from 'zustand';
import { createWebexApi } from '../api/webexApi';
import { WebexApiError } from '../types/webex';
import type {
  WebexLocation,
  WebexQueue,
  WebexUser,
  WebexSchedule,
  WebexNumber,
  WebexAutoAttendant,
  WebexHuntGroup,
} from '../types/webex';

function isCxQueue(detail: { callPolicies?: { policyType?: string; transferToAgentEnabled?: boolean }; queueSettings?: { wrapUpTimerEnabled?: boolean; postCallSurveyEnabled?: boolean; digitalChannelHandoffEnabled?: boolean } }): boolean {
  return (
    detail.callPolicies?.policyType === 'SKILL_BASED' ||
    !!detail.callPolicies?.transferToAgentEnabled ||
    !!detail.queueSettings?.wrapUpTimerEnabled ||
    !!detail.queueSettings?.postCallSurveyEnabled ||
    !!detail.queueSettings?.digitalChannelHandoffEnabled
  );
}

const SESSION_KEY = 'webex_pat';

interface OrgStore {
  // Connection state
  connected: boolean;
  token: string | null;
  orgId: string | null;
  orgName: string | null;
  userName: string | null;
  userEmail: string | null;
  userAvatar: string | null;

  // Loaded resources
  locations: WebexLocation[];
  queues: WebexQueue[];
  users: WebexUser[];
  schedules: WebexSchedule[];
  phoneNumbers: WebexNumber[];
  autoAttendants: WebexAutoAttendant[];
  huntGroups: WebexHuntGroup[];

  // UI state
  isLoading: boolean;
  loadError: string | null;
  lastSyncedAt: string | null;
  hasWriteScope: boolean | null;  // null = unknown (tokeninfo unavailable), true/false = confirmed

  // CX Essentials scan
  cxQueues: WebexQueue[];
  cxScanStatus: 'idle' | 'scanning' | 'done';
  cxScanned: number;   // how many queues have been checked so far

  // Actions
  connect: (token: string) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  restoreSession: () => void;
  scanCxQueues: () => Promise<void>;
}

const emptyResources = {
  locations: [],
  queues: [],
  users: [],
  schedules: [],
  phoneNumbers: [],
  autoAttendants: [],
  huntGroups: [],
};

export const useOrgStore = create<OrgStore>((set, get) => ({
  connected: false,
  token: null,
  orgId: null,
  orgName: null,
  userName: null,
  userEmail: null,
  userAvatar: null,
  ...emptyResources,
  isLoading: false,
  loadError: null,
  lastSyncedAt: null,
  hasWriteScope: null,
  cxQueues: [],
  cxScanStatus: 'idle',
  cxScanned: 0,

  connect: async (token: string) => {
    set({ isLoading: true, loadError: null });

    try {
      const api = createWebexApi(token);

      // Step 1: verify token + get identity (this call validates the token)
      const me = await api.getMe();

      // Step 2: detect write scope via token introspection (non-fatal)
      // PATs from developer.webex.com have all scopes; OAuth tokens may not.
      // If tokeninfo is unavailable we keep null (unknown) and let publish fail naturally.
      let hasWriteScope: boolean | null = null;
      try {
        const tokenInfo = await api.getTokenInfo();
        if (tokenInfo?.scopes) {
          hasWriteScope = tokenInfo.scopes.includes('spark-admin:telephony_config_write');
        }
      } catch { /* tokeninfo endpoint unavailable — leave as null */ }

      // Step 3: get org display name — non-fatal, some tokens lack org:read scope
      const org = await api.getOrg(me.orgId).catch(() => ({ id: me.orgId, displayName: me.orgId }));

      // Step 4: load all resources in parallel
      // Each fetch fails gracefully so a single scope gap doesn't break everything.
      // Errors are logged to console so devtools shows exactly which resource failed.
      const [locations, queues, users, schedules, phoneNumbers, autoAttendants, huntGroups] =
        await Promise.all([
          api.getLocations().catch((e) => { console.error('[Webex] getLocations failed:', e); return [] as WebexLocation[]; }),
          api.getQueues().catch((e) => { console.error('[Webex] getQueues failed:', e); return [] as WebexQueue[]; }),
          api.getUsers().catch((e) => { console.error('[Webex] getUsers failed:', e); return [] as WebexUser[]; }),
          api.getSchedules().catch((e) => { console.error('[Webex] getSchedules failed:', e); return [] as WebexSchedule[]; }),
          api.getPhoneNumbers().catch((e) => { console.error('[Webex] getPhoneNumbers failed:', e); return [] as WebexNumber[]; }),
          api.getAutoAttendants().catch((e) => { console.error('[Webex] getAutoAttendants failed:', e); return [] as WebexAutoAttendant[]; }),
          api.getHuntGroups().catch((e) => { console.error('[Webex] getHuntGroups failed:', e); return [] as WebexHuntGroup[]; }),
        ]);

      // Persist token in sessionStorage — clears on tab close
      sessionStorage.setItem(SESSION_KEY, token);

      set({
        connected: true,
        token,
        orgId: me.orgId,
        orgName: org.displayName,
        userName: me.displayName,
        userEmail: me.emails[0] ?? null,
        userAvatar: me.avatar ?? null,
        locations,
        queues,
        users,
        schedules,
        phoneNumbers,
        autoAttendants,
        huntGroups,
        isLoading: false,
        loadError: null,
        lastSyncedAt: new Date().toISOString(),
        hasWriteScope,
        // Reset CX scan whenever org data refreshes
        cxQueues: [],
        cxScanStatus: 'idle',
        cxScanned: 0,
      });
    } catch (err) {
      // Always log so browser devtools shows the real cause
      console.error('[Webex Connect] Error:', err);

      let message: string;
      if (err instanceof WebexApiError) {
        message = err.message;
      } else if (err instanceof TypeError) {
        // Typically "Failed to fetch" — CORS block, no network, or DNS failure
        message = `Network error: ${err.message}. Check your internet connection. If this persists, your browser may be blocking the request (CORS).`;
      } else if (err instanceof Error) {
        message = err.message;
      } else {
        message = 'Unexpected error connecting to Webex. Please try again.';
      }

      set({ isLoading: false, loadError: message, connected: false });
    }
  },

  disconnect: () => {
    sessionStorage.removeItem(SESSION_KEY);
    set({
      connected: false,
      token: null,
      orgId: null,
      orgName: null,
      userName: null,
      userEmail: null,
      userAvatar: null,
      ...emptyResources,
      loadError: null,
      lastSyncedAt: null,
      hasWriteScope: null,
      cxQueues: [],
      cxScanStatus: 'idle',
      cxScanned: 0,
    });
  },

  refresh: async () => {
    const { token, connect } = get();
    if (!token) return;
    await connect(token);
  },

  // Called once on app mount to restore a saved session
  restoreSession: () => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      get().connect(saved);
    }
  },

  // Fetch detail for every queue and keep only those with CX Essentials features.
  // Runs in batches of 5 to stay within Webex rate limits.
  scanCxQueues: async () => {
    const { token, queues, cxScanStatus } = get();
    if (!token || cxScanStatus === 'scanning') return;

    set({ cxScanStatus: 'scanning', cxQueues: [], cxScanned: 0 });

    const api = createWebexApi(token);
    const found: WebexQueue[] = [];
    const BATCH = 5;

    for (let i = 0; i < queues.length; i += BATCH) {
      const batch = queues.slice(i, i + BATCH);
      const details = await Promise.all(
        batch.map(q => api.getQueueDetail(q.locationId, q.id).catch(() => null)),
      );
      for (let j = 0; j < batch.length; j++) {
        const detail = details[j];
        if (detail && isCxQueue(detail)) found.push(batch[j]);
      }
      set({ cxScanned: i + batch.length, cxQueues: [...found] });
    }

    set({ cxScanStatus: 'done' });
  },
}));
