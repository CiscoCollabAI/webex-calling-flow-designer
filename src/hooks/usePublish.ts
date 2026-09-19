import { useCallback } from 'react';
import { useFlowStore } from '../store/flowStore';
import { useOrgStore } from '../store/orgStore';
import { createWebexApi } from '../api/webexApi';
import { exportAutoAttendant } from '../utils/exportAutoAttendant';
import { exportCallQueue } from '../utils/exportCallQueue';
import { WebexApiError } from '../types/webex';
import type { CanvasMode } from '../types';

export function usePublish(canvasMode: CanvasMode) {
  const {
    nodes, edges, flowName, flowMeta,
    appendPublishProgress, setPublishStatus, setFlowMeta,
  } = useFlowStore();

  const { token, users } = useOrgStore();

  const publish = useCallback(async () => {
    if (!token) {
      setPublishStatus('error', ['Not connected to Webex. Please connect your org first.']);
      return;
    }
    if (!flowMeta.locationId) {
      setPublishStatus('error', ['No Webex location set. Open a flow from the Dashboard first.']);
      return;
    }
    if (!canvasMode) {
      setPublishStatus('error', ['No flow type selected. Open a flow from the Dashboard first.']);
      return;
    }

    // status starts as 'validating' — PublishModal switches to the progress view
    setPublishStatus('validating');

    try {
      const api = createWebexApi(token);

      // ── Auto-Attendant publish ───────────────────────────────────────────────
      if (canvasMode === 'aa') {
        appendPublishProgress('Validating Auto-Attendant flow…');
        const { body, errors, warnings } = exportAutoAttendant(nodes, edges, flowName);

        if (errors.length > 0) {
          setPublishStatus('error', errors);
          return;
        }
        warnings.forEach(w => appendPublishProgress(`⚠ ${w}`));

        appendPublishProgress('Building configuration…');
        setPublishStatus('publishing');

        if (flowMeta.isNew) {
          appendPublishProgress('Creating Auto-Attendant in Webex…');
          const result = await api.createAutoAttendant(flowMeta.locationId, body);
          setFlowMeta({ resourceId: result.id, isNew: false });
          appendPublishProgress(`Auto-Attendant created`);
        } else {
          appendPublishProgress('Updating Auto-Attendant in Webex…');
          await api.updateAutoAttendant(flowMeta.locationId, flowMeta.resourceId!, body);
          appendPublishProgress('Auto-Attendant updated');
        }

        setFlowMeta({ lastPublishedAt: new Date().toISOString() });
        appendPublishProgress('Changes are live in Webex.');
        setPublishStatus('done');

      // ── Call Queue / CX Essentials publish ───────────────────────────────────
      } else if (canvasMode === 'cq' || canvasMode === 'cxe') {
        appendPublishProgress('Validating Call Queue flow…');
        const {
          mainBody, nightServiceBody, holidayServiceBody, strandedCallsBody,
          errors, warnings,
        } = exportCallQueue(nodes, edges, flowName, users);

        if (errors.length > 0) {
          setPublishStatus('error', errors);
          return;
        }
        warnings.forEach(w => appendPublishProgress(`⚠ ${w}`));

        appendPublishProgress('Building configuration…');
        setPublishStatus('publishing');

        let queueId = flowMeta.resourceId;

        if (flowMeta.isNew) {
          appendPublishProgress('Creating Call Queue in Webex…');
          const result = await api.createCallQueue(flowMeta.locationId, mainBody);
          queueId = result.id;
          setFlowMeta({ resourceId: queueId, isNew: false });
          appendPublishProgress('Call Queue created');
        } else {
          appendPublishProgress('Updating Call Queue…');
          await api.updateCallQueue(flowMeta.locationId, queueId!, mainBody);
          appendPublishProgress('Call Queue updated');
        }

        if (nightServiceBody && queueId) {
          appendPublishProgress('Configuring Night Service…');
          await api.updateQueueNightService(flowMeta.locationId, queueId, nightServiceBody);
          appendPublishProgress('Night Service configured');
        }

        if (holidayServiceBody && queueId) {
          appendPublishProgress('Configuring Holiday Service…');
          await api.updateQueueHolidayService(flowMeta.locationId, queueId, holidayServiceBody);
          appendPublishProgress('Holiday Service configured');
        }

        if (strandedCallsBody && queueId) {
          appendPublishProgress('Configuring Stranded Calls handling…');
          await api.updateQueueStrandedCalls(flowMeta.locationId, queueId, strandedCallsBody);
          appendPublishProgress('Stranded Calls configured');
        }

        setFlowMeta({ lastPublishedAt: new Date().toISOString() });
        appendPublishProgress('Changes are live in Webex.');
        setPublishStatus('done');
      }

    } catch (err) {
      const msg = err instanceof WebexApiError
        ? `Webex API error (${err.status}): ${err.message}`
        : err instanceof Error
        ? err.message
        : 'An unexpected error occurred during publish';
      setPublishStatus('error', [msg]);
    }
  }, [
    token, users, nodes, edges, flowName, flowMeta, canvasMode,
    appendPublishProgress, setPublishStatus, setFlowMeta,
  ]);

  return { publish };
}
