"use client";

import { AnimatePresence } from "framer-motion";
import { DownloadCard } from "./download-card";
import type { DownloadJob } from "@/types";

interface DownloadQueueProps {
  jobs: DownloadJob[];
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onSave: (job: DownloadJob) => void;
}

export function DownloadQueue({
  jobs,
  onCancel,
  onRemove,
  onSave,
}: DownloadQueueProps) {
  if (jobs.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="font-mono text-muted-foreground text-sm">
          Paste a Loom URL above to start downloading
        </p>
        <p className="font-mono text-muted-foreground/50 text-xs mt-2">
          Supports loom.com/share/... and loom.com/embed/... URLs
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AnimatePresence mode="popLayout">
        {jobs.map((job) => (
          <DownloadCard
            key={job.id}
            job={job}
            onCancel={onCancel}
            onRemove={onRemove}
            onSave={onSave}
          />
        ))}
      </AnimatePresence>
    </div>
  );
}
