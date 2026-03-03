"use client";

import { ChevronDown } from "lucide-react";
import { URLInput } from "@/components/url-input";
import { DownloadQueue } from "@/components/download-queue";
import { useDownloads } from "@/hooks/use-downloads";

export default function Home() {
  const { jobs, addJob, cancelJob, removeJob, saveFile } = useDownloads();

  return (
    <main className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Header */}
        <div className="mb-10">
          <div className="flex items-center gap-2 mb-2">
            <ChevronDown size={20} className="text-foreground" />
            <ChevronDown size={20} className="text-foreground -ml-4 mt-2 opacity-60" />
            <h1 className="text-lg font-bold tracking-tight ml-1">
              LOOM DOWNLOADER
            </h1>
          </div>
          <div className="w-full h-[2px] bg-foreground mb-2" />
          <p className="text-xs text-muted-foreground">
            Paste a Loom URL to download the full video as MP4
          </p>
        </div>

        {/* Input */}
        <div className="mb-8">
          <URLInput onAdd={addJob} />
        </div>

        {/* Queue */}
        <DownloadQueue
          jobs={jobs}
          onCancel={cancelJob}
          onRemove={removeJob}
          onSave={saveFile}
        />

        {/* Footer */}
        <div className="mt-16 pt-4 border-t border-foreground/5 space-y-1">
          <p className="text-[10px] text-muted-foreground/50 font-mono text-center">
            Videos are processed entirely in your browser. Nothing is stored on the server.
          </p>
          <p className="text-[10px] text-muted-foreground/40 font-mono text-center">
            Created by Sandeep
          </p>
        </div>
      </div>
    </main>
  );
}
