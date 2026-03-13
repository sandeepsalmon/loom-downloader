"use client";

import { Download, X, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AnimatedDownload } from "@/components/ui/animated-download";
import type { DownloadJob } from "@/types";

interface DownloadCardProps {
  job: DownloadJob;
  onCancel: (id: string) => void;
  onRemove: (id: string) => void;
  onSave: (job: DownloadJob) => void;
}

const statusColors: Record<string, string> = {
  queued: "bg-zinc-700 text-zinc-300",
  resolving: "bg-yellow-900/50 text-yellow-400 border-yellow-800",
  downloading: "bg-blue-900/50 text-blue-400 border-blue-800",
  muxing: "bg-purple-900/50 text-purple-400 border-purple-800",
  complete: "bg-green-900/50 text-green-400 border-green-800",
  error: "bg-red-900/50 text-red-400 border-red-800",
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

export function DownloadCard({
  job,
  onCancel,
  onRemove,
  onSave,
}: DownloadCardProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="border border-foreground/10 rounded-lg p-5 bg-card"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1 min-w-0 mr-4">
          <h3 className="font-mono text-sm font-medium truncate">
            {job.title || job.url}
          </h3>
          {job.videoId && (
            <p className="text-xs font-mono text-muted-foreground mt-0.5">
              ID: {job.videoId.slice(0, 12)}...
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`font-mono text-[10px] uppercase ${statusColors[job.status]}`}
          >
            {job.status}
          </Badge>
        </div>
      </div>

      {/* Animated progress */}
      <AnimatedDownload
        progress={job.progress}
        status={job.status}
        segmentsDownloaded={job.downloadedSegments}
        totalSegments={job.totalSegments}
        eta={job.eta}
        speed={job.speed}
      />

      {/* Error message */}
      {job.status === "error" && job.error && (
        <p className="mt-2 text-xs font-mono text-red-400 break-words" title={job.error}>
          {job.error}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-foreground/5">
        <div className="text-xs font-mono text-muted-foreground">
          {job.status === "complete" && job.fileSize
            ? formatBytes(job.fileSize)
            : job.totalBytes > 0
              ? `${formatBytes(job.totalBytes)} downloaded`
              : ""}
        </div>
        <div className="flex gap-2">
          {job.status === "complete" && (
            <Button
              size="sm"
              onClick={() => onSave(job)}
              className="font-mono text-xs h-8"
            >
              <Download size={14} className="mr-1" />
              SAVE
            </Button>
          )}
          {job.status === "error" && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onRemove(job.id)}
              className="font-mono text-xs h-8"
            >
              <RotateCcw size={14} className="mr-1" />
              DISMISS
            </Button>
          )}
          {(job.status === "downloading" ||
            job.status === "resolving" ||
            job.status === "muxing") && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => onCancel(job.id)}
              className="font-mono text-xs h-8 text-red-400 border-red-800 hover:bg-red-950"
            >
              <X size={14} className="mr-1" />
              CANCEL
            </Button>
          )}
          {(job.status === "complete" || job.status === "error") && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => onRemove(job.id)}
              className="font-mono text-xs h-8 text-muted-foreground"
            >
              <X size={14} />
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
