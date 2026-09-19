import { useOrgStore } from '../store/orgStore';

// Convenience hook that exposes all org resources + connection state.
// Components only need to import this — not the store directly.
export function useOrgData() {
  const {
    connected, isLoading, loadError,
    orgName, userName, userEmail, userAvatar,
    lastSyncedAt, hasWriteScope,
    locations, queues, users, schedules,
    phoneNumbers, autoAttendants, huntGroups,
    cxQueues, cxScanStatus, cxScanned,
    connect, disconnect, refresh, scanCxQueues,
  } = useOrgStore();

  return {
    // Connection state
    connected,
    isLoading,
    loadError,
    orgName,
    userName,
    userEmail,
    userAvatar,
    lastSyncedAt,
    hasWriteScope,

    // Resources
    locations,
    queues,
    users,
    schedules,
    phoneNumbers,
    autoAttendants,
    huntGroups,

    // Derived helpers used by OrgSelect dropdowns
    queueOptions: queues.map((q) => ({
      value: q.id,
      label: q.name,
      meta: [q.locationName, q.extension ? `Ext: ${q.extension}` : undefined].filter(Boolean).join(' · '),
      extension: q.extension,
      phoneNumber: q.phoneNumber,
    })),

    userOptions: users
      .filter((u) => u.extension) // only users with calling enabled
      .map((u) => ({
        value: u.id,
        label: u.displayName,
        meta: u.extension ? `Ext: ${u.extension}` : u.emails[0] ?? '',
        extension: u.extension,
      })),

    businessHoursOptions: schedules
      .filter((s) => s.type === 'businessHours')
      .map((s) => ({
        value: s.id,
        label: s.name,
        meta: s.locationName,
      })),

    holidayOptions: schedules
      .filter((s) => s.type === 'holidays')
      .map((s) => ({
        value: s.id,
        label: s.name,
        meta: s.locationName,
      })),

    phoneNumberOptions: phoneNumbers.map((n) => ({
      value: n.phoneNumber,
      label: n.phoneNumber,
      meta: n.extension ? `Ext: ${n.extension}` : n.location?.name ?? '',
    })),

    huntGroupOptions: huntGroups.map((h) => ({
      value: h.id,
      label: h.name,
      meta: [h.locationName, h.extension ? `Ext: ${h.extension}` : undefined].filter(Boolean).join(' · '),
      extension: h.extension,
    })),

    autoAttendantOptions: autoAttendants.map((a) => ({
      value: a.id,
      label: a.name,
      meta: a.locationName,
    })),

    // CX Essentials scan
    cxQueues,
    cxScanStatus,
    cxScanned,
    cxTotal: queues.length,

    // Actions
    connect,
    disconnect,
    refresh,
    scanCxQueues,

    // Resource counts for the modal summary
    counts: {
      queues: queues.length,
      users: users.filter((u) => u.extension).length,
      schedules: schedules.length,
      phoneNumbers: phoneNumbers.length,
      autoAttendants: autoAttendants.length,
      locations: locations.length,
    },
  };
}
