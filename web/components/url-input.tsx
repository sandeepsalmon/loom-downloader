"use client";

import { useState, useCallback } from "react";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { isLoomUrl } from "@/lib/loom";

interface URLInputProps {
  onAdd: (url: string) => void;
}

export function URLInput({ onAdd }: URLInputProps) {
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = useCallback(() => {
    const trimmed = value.trim();
    if (!trimmed) return;

    // Support multiple URLs (newline or comma separated)
    const urls = trimmed
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    const invalid = urls.find((u) => !isLoomUrl(u));
    if (invalid) {
      setError(`Not a valid Loom URL: ${invalid.slice(0, 50)}`);
      return;
    }

    urls.forEach((u) => onAdd(u));
    setValue("");
    setError("");
  }, [value, onAdd]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text").trim();
    // Split by newlines/commas and check each URL
    const urls = text
      .split(/[\n,]+/)
      .map((u) => u.trim())
      .filter(Boolean);

    if (urls.length > 0 && urls.every((u) => isLoomUrl(u))) {
      e.preventDefault();
      urls.forEach((u) => onAdd(u));
      setValue("");
      setError("");
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground font-mono text-sm select-none">
            {">_"}
          </span>
          <Input
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              setError("");
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder="Paste Loom URL..."
            className="pl-10 font-mono text-sm bg-background border-foreground/20 focus:border-foreground/50 h-12"
          />
        </div>
        <Button
          onClick={handleSubmit}
          disabled={!value.trim()}
          className="h-12 px-6 font-mono text-sm"
        >
          <Plus size={16} className="mr-1" />
          ADD
        </Button>
      </div>
      {error && (
        <p className="mt-2 text-sm font-mono text-red-400">{error}</p>
      )}
    </div>
  );
}
