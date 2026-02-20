"use client";

import { useFormStatus } from "react-dom";

type ManualSyncAction = (formData: FormData) => Promise<void>;

type ManualSyncFormProps = {
  action: ManualSyncAction;
  labels: {
    syncAll: string;
    syncCalendar: string;
    syncPeople: string;
    syncing: string;
    progressHint: string;
  };
};

function SyncControls({ labels }: { labels: ManualSyncFormProps["labels"] }) {
  const { pending } = useFormStatus();

  return (
    <div className="space-y-3">
      {pending ? (
        <div aria-live="polite" className="rounded-xl border border-accent/35 bg-accent/5 px-3 py-3">
          <p className="text-sm font-medium text-text">{labels.syncing}</p>
          <div aria-hidden="true" className="sync-progress-track mt-2">
            <span className="sync-progress-indeterminate" />
          </div>
          <p className="mt-2 text-xs text-muted">{labels.progressHint}</p>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button aria-busy={pending} className="btn btn-primary" disabled={pending} name="mode" type="submit" value="all">
          {labels.syncAll}
        </button>
        <button aria-busy={pending} className="btn btn-secondary" disabled={pending} name="mode" type="submit" value="calendar">
          {labels.syncCalendar}
        </button>
        <button aria-busy={pending} className="btn btn-secondary" disabled={pending} name="mode" type="submit" value="people">
          {labels.syncPeople}
        </button>
      </div>
    </div>
  );
}

export function ManualSyncForm({ action, labels }: ManualSyncFormProps) {
  return (
    <form action={action} className="mt-4">
      <SyncControls labels={labels} />
    </form>
  );
}
