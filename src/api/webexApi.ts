import {
  WebexApiError,
  type WebexMe,
  type WebexOrg,
  type WebexLocation,
  type WebexQueue,
  type WebexUser,
  type WebexSchedule,
  type WebexScheduleDetail,
  type WebexNumber,
  type WebexAutoAttendant,
  type WebexAutoAttendantDetail,
  type WebexHuntGroup,
  type WebexQueueDetail,
  type WebexQueueNightService,
  type WebexQueueHolidayService,
  type WebexQueueStrandedCalls,
  type WebexQueueForcedForward,
  type WebexQueueDnis,
  type WebexQueueDnisAnnouncements,
  type WebexQueueCallForwarding,
  type WebexQueueDnisSettings,
  type WebexTokenInfo,
  type WebexAAWriteBody,
  type WebexQueueWriteBody,
  type WebexScheduleWriteBody,
  type WebexAnnouncement,
} from '../types/webex';
import { recordApiResponse } from '../utils/apiDebugCapture';

// Requests go through the Vite dev-server proxy (/webex-api → https://webexapis.com/v1)
// so the browser never makes a cross-origin request and CORS is not an issue.
const BASE_URL = '/webex-api';
const MAX_ITEMS = 1000;

export class WebexApiService {
  private readonly headers: HeadersInit;

  constructor(private readonly token: string) {
    // No Content-Type on GET-only service — avoids unnecessary CORS preflight
    this.headers = {
      Authorization: `Bearer ${token}`,
    };
  }

  // ── Core fetch with error handling ──────────────────────────────────────────

  private async fetch<T>(path: string): Promise<T> {
    const res = await window.fetch(`${BASE_URL}${path}`, {
      headers: this.headers,
    });

    if (!res.ok) {
      const trackingId = res.headers.get('TrackingID') ?? undefined;
      let message = `HTTP ${res.status}`;
      try {
        const body = await res.json() as { message?: string; errors?: { description: string }[] };
        message = body.message ?? body.errors?.[0]?.description ?? message;
      } catch { /* ignore parse errors */ }

      if (res.status === 401) {
        throw new WebexApiError(401, 'Invalid or expired token. Generate a new Personal Access Token at developer.webex.com', trackingId);
      }
      if (res.status === 403) {
        throw new WebexApiError(403, 'Insufficient permissions. Ensure your token has the spark-admin:telephony_config_read scope.', trackingId);
      }
      if (res.status === 429) {
        throw new WebexApiError(429, 'Rate limited by Webex API. Please wait a moment and try again.', trackingId);
      }
      throw new WebexApiError(res.status, message, trackingId);
    }

    const data = await res.json() as T;
    recordApiResponse(path, data);
    return data;
  }

  // ── Paginated list fetch ─────────────────────────────────────────────────────
  // Webex uses cursor-based pagination via a 'next' link in headers or response body.
  // We collect up to MAX_ITEMS items across pages.

  private async fetchList<T>(
    path: string,
    itemsKey: string,
    extraParams?: Record<string, string>,
  ): Promise<T[]> {
    const params = new URLSearchParams({ max: String(MAX_ITEMS), ...extraParams });
    const results: T[] = [];

    let url: string | null = `${BASE_URL}${path}?${params.toString()}`;

    while (url && results.length < MAX_ITEMS) {
      const res: Response = await window.fetch(url, { headers: this.headers });

      if (!res.ok) {
        const trackingId = res.headers.get('TrackingID') ?? undefined;
        let message = `HTTP ${res.status}`;
        try {
          const body = await res.json() as { message?: string };
          message = body.message ?? message;
        } catch { /* ignore */ }
        if (res.status === 401) throw new WebexApiError(401, 'Invalid or expired token.', trackingId);
        if (res.status === 403) throw new WebexApiError(403, 'Insufficient permissions. Required scope: spark-admin:telephony_config_read', trackingId);
        if (res.status === 404) return results; // feature not enabled in this org — return empty
        throw new WebexApiError(res.status, message, trackingId);
      }

      const data = await res.json() as Record<string, unknown>;
      recordApiResponse(path, data);
      const items = (data[itemsKey] as T[] | undefined) ?? [];
      results.push(...items);

      // Follow 'Link: <url>; rel="next"' header for pagination
      const linkHeader: string = res.headers.get('Link') ?? '';
      const nextMatch: RegExpMatchArray | null = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    }

    return results;
  }

  // ── JSON write (POST / PUT / DELETE) ────────────────────────────────────────

  private async write<T>(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    body?: unknown,
  ): Promise<T> {
    const res = await window.fetch(`${BASE_URL}${path}`, {
      method,
      headers: {
        ...(this.headers as Record<string, string>),
        'Content-Type': 'application/json',
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const trackingId = res.headers.get('TrackingID') ?? undefined;
      let message = `HTTP ${res.status}`;
      try {
        const errBody = await res.json() as { message?: string; errors?: { description: string }[] };
        message = errBody.message ?? errBody.errors?.[0]?.description ?? message;
      } catch { /* ignore parse errors */ }

      if (res.status === 401) throw new WebexApiError(401, 'Invalid or expired token.', trackingId);
      if (res.status === 403) throw new WebexApiError(403, 'Insufficient permissions. Ensure your token has the spark-admin:telephony_config_write scope.', trackingId);
      if (res.status === 409) throw new WebexApiError(409, message, trackingId);
      if (res.status === 429) throw new WebexApiError(429, 'Rate limited. Please wait and try again.', trackingId);
      throw new WebexApiError(res.status, message, trackingId);
    }

    // PUT / DELETE responses are typically 204 No Content
    if (res.status === 204 || res.headers.get('content-length') === '0') {
      return undefined as T;
    }

    const data = await res.json() as T;
    recordApiResponse(`${method} ${path}`, data);
    return data;
  }

  // ── Multipart file upload ────────────────────────────────────────────────────
  // Used for announcement WAV/WMA uploads — browser sets Content-Type with boundary.

  private async uploadFile<T>(path: string, form: FormData): Promise<T> {
    const res = await window.fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      headers: this.headers,  // Authorization only — no Content-Type override
      body: form,
    });

    if (!res.ok) {
      const trackingId = res.headers.get('TrackingID') ?? undefined;
      let message = `HTTP ${res.status}`;
      try {
        const errBody = await res.json() as { message?: string };
        message = errBody.message ?? message;
      } catch { /* ignore */ }
      throw new WebexApiError(res.status, message, trackingId);
    }

    const data = await res.json() as T;
    recordApiResponse(`upload ${path}`, data);
    return data;
  }

  // ── API methods ──────────────────────────────────────────────────────────────

  async getMe(): Promise<WebexMe> {
    return this.fetch<WebexMe>('/people/me');
  }

  async getOrg(orgId: string): Promise<WebexOrg> {
    return this.fetch<WebexOrg>(`/organizations/${orgId}`);
  }

  async getLocations(): Promise<WebexLocation[]> {
    return this.fetchList<WebexLocation>('/telephony/config/locations', 'locations');
  }

  async getQueues(): Promise<WebexQueue[]> {
    // Returns queues across all locations; locationName is included in each item
    return this.fetchList<WebexQueue>('/telephony/config/queues', 'queues');
  }

  async getUsers(): Promise<WebexUser[]> {
    // callingData=true enriches response with extension and location info
    return this.fetchList<WebexUser>('/people', 'items', { callingData: 'true' });
  }

  async getSchedules(): Promise<WebexSchedule[]> {
    // Org-level schedules (includes both businessHours and holidays types)
    return this.fetchList<WebexSchedule>('/telephony/config/schedules', 'schedules');
  }

  async getPhoneNumbers(): Promise<WebexNumber[]> {
    return this.fetchList<WebexNumber>('/telephony/config/numbers', 'phoneNumbers');
  }

  async getAutoAttendants(): Promise<WebexAutoAttendant[]> {
    return this.fetchList<WebexAutoAttendant>('/telephony/config/autoAttendants', 'autoAttendants');
  }

  async getHuntGroups(): Promise<WebexHuntGroup[]> {
    return this.fetchList<WebexHuntGroup>('/telephony/config/huntGroups', 'huntGroups');
  }

  async getAutoAttendantDetail(locationId: string, autoAttendantId: string): Promise<WebexAutoAttendantDetail> {
    return this.fetch<WebexAutoAttendantDetail>(
      `/telephony/config/locations/${locationId}/autoAttendants/${autoAttendantId}`,
    );
  }

  async getScheduleDetail(locationId: string, type: string, scheduleId: string): Promise<WebexScheduleDetail> {
    return this.fetch<WebexScheduleDetail>(
      `/telephony/config/locations/${locationId}/schedules/${type}/${scheduleId}`,
    );
  }

  async getQueueDetail(locationId: string, queueId: string): Promise<WebexQueueDetail> {
    return this.fetch<WebexQueueDetail>(
      `/telephony/config/locations/${locationId}/queues/${queueId}`,
    );
  }

  async getQueueNightService(locationId: string, queueId: string): Promise<WebexQueueNightService> {
    return this.fetch<WebexQueueNightService>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/nightService`,
    );
  }

  async getQueueHolidayService(locationId: string, queueId: string): Promise<WebexQueueHolidayService> {
    return this.fetch<WebexQueueHolidayService>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/holidayService`,
    );
  }

  async getQueueStrandedCalls(locationId: string, queueId: string): Promise<WebexQueueStrandedCalls> {
    return this.fetch<WebexQueueStrandedCalls>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/strandedCalls`,
    );
  }

  // Endpoint confirmed via Webex's public API docs; response shape not yet verified
  // against a live response — see WebexQueueForcedForward for details.
  async getQueueForcedForward(locationId: string, queueId: string): Promise<WebexQueueForcedForward> {
    return this.fetch<WebexQueueForcedForward>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/forcedForward`,
    );
  }

  // Endpoint confirmed directly (not guessed). Response shape not yet captured —
  // see WebexQueueDnis for details.
  async getQueueDnis(locationId: string, queueId: string): Promise<WebexQueueDnis> {
    return this.fetch<WebexQueueDnis>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/dnis`,
    );
  }

  async getQueueDnisAnnouncements(locationId: string, queueId: string, dnisId: string): Promise<WebexQueueDnisAnnouncements> {
    return this.fetch<WebexQueueDnisAnnouncements>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/dnis/${dnisId}/announcements`,
    );
  }

  // Confirmed via OpenAPI spec — call forwarding is NOT part of the main queue
  // detail response; it's a dedicated endpoint. Previously never fetched, which
  // silently left Call Forwarding blank in every imported Call Queue flow.
  async getQueueCallForwarding(locationId: string, queueId: string): Promise<WebexQueueCallForwarding> {
    return this.fetch<WebexQueueCallForwarding>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/callForwarding`,
    );
  }

  // Confirmed via OpenAPI spec — a separate queue-wide DNIS settings endpoint,
  // distinct from the per-DNIS entry list. Previously never fetched.
  async getQueueDnisSettings(locationId: string, queueId: string): Promise<WebexQueueDnisSettings> {
    return this.fetch<WebexQueueDnisSettings>(
      `/telephony/config/locations/${locationId}/queues/${queueId}/dnis/settings`,
    );
  }

  // ── Token introspection ──────────────────────────────────────────────────────

  async getTokenInfo(): Promise<WebexTokenInfo> {
    return this.fetch<WebexTokenInfo>('/tokeninfo');
  }

  // ── Auto-Attendant write operations ─────────────────────────────────────────

  async createAutoAttendant(
    locationId: string,
    body: WebexAAWriteBody,
  ): Promise<{ id: string }> {
    return this.write<{ id: string }>(
      'POST',
      `/telephony/config/locations/${locationId}/autoAttendants`,
      body,
    );
  }

  async updateAutoAttendant(
    locationId: string,
    autoAttendantId: string,
    body: WebexAAWriteBody,
  ): Promise<void> {
    return this.write<void>(
      'PUT',
      `/telephony/config/locations/${locationId}/autoAttendants/${autoAttendantId}`,
      body,
    );
  }

  // ── Call Queue write operations ──────────────────────────────────────────────

  async createCallQueue(
    locationId: string,
    body: WebexQueueWriteBody,
  ): Promise<{ id: string }> {
    return this.write<{ id: string }>(
      'POST',
      `/telephony/config/locations/${locationId}/queues`,
      body,
    );
  }

  async updateCallQueue(
    locationId: string,
    queueId: string,
    body: WebexQueueWriteBody,
  ): Promise<void> {
    return this.write<void>(
      'PUT',
      `/telephony/config/locations/${locationId}/queues/${queueId}`,
      body,
    );
  }

  async updateQueueNightService(
    locationId: string,
    queueId: string,
    body: WebexQueueNightService,
  ): Promise<void> {
    return this.write<void>(
      'PUT',
      `/telephony/config/locations/${locationId}/queues/${queueId}/nightService`,
      body,
    );
  }

  async updateQueueHolidayService(
    locationId: string,
    queueId: string,
    body: WebexQueueHolidayService,
  ): Promise<void> {
    return this.write<void>(
      'PUT',
      `/telephony/config/locations/${locationId}/queues/${queueId}/holidayService`,
      body,
    );
  }

  async updateQueueStrandedCalls(
    locationId: string,
    queueId: string,
    body: WebexQueueStrandedCalls,
  ): Promise<void> {
    return this.write<void>(
      'PUT',
      `/telephony/config/locations/${locationId}/queues/${queueId}/strandedCalls`,
      body,
    );
  }

  // ── Schedule write operations ────────────────────────────────────────────────

  async createSchedule(
    locationId: string,
    body: WebexScheduleWriteBody,
  ): Promise<{ id: string }> {
    return this.write<{ id: string }>(
      'POST',
      `/telephony/config/locations/${locationId}/schedules`,
      body,
    );
  }

  // ── Announcement listing + upload ────────────────────────────────────────────

  async getAnnouncements(locationId: string): Promise<WebexAnnouncement[]> {
    return this.fetchList<WebexAnnouncement>(
      `/telephony/config/locations/${locationId}/announcements`,
      'announcements',
    );
  }

  async uploadAnnouncement(
    locationId: string,
    file: File,
    name: string,
  ): Promise<{ id: string }> {
    const form = new FormData();
    form.append('name', name);
    form.append('file', file);
    return this.uploadFile<{ id: string }>(
      `/telephony/config/locations/${locationId}/announcements`,
      form,
    );
  }
}

export function createWebexApi(token: string): WebexApiService {
  return new WebexApiService(token);
}
