"use client";
import React, { useState, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { JobStatus } from "@/types";

interface DownloadProps {
  className?: string;
  progress?: number; // 0-100
  status?: JobStatus;
  segmentsDownloaded?: number;
  totalSegments?: number;
  eta?: number; // seconds
  speed?: number; // bytes/sec
}

const alphabets = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
const getRandomInt = (max: number) => Math.floor(Math.random() * max);

const STATUS_TEXT: Record<JobStatus, string> = {
  queued: "QUEUED",
  resolving: "RESOLVING",
  downloading: "DOWNLOADING",
  muxing: "PROCESSING",
  complete: "COMPLETE",
  error: "ERROR",
};

export function AnimatedDownload({
  className,
  progress = 0,
  status = "queued",
  segmentsDownloaded = 0,
  totalSegments = 0,
  eta = 0,
  speed = 0,
}: DownloadProps) {
  const shouldReduceMotion = useReducedMotion();
  const isActive = status === "downloading" || status === "resolving" || status === "muxing";

  // HyperText animation state
  const targetText = STATUS_TEXT[status];
  const [displayText, setDisplayText] = useState(targetText.split(""));
  const [isTextAnimating, setIsTextAnimating] = useState(false);
  const [textIterations, setTextIterations] = useState(0);
  const [prevTarget, setPrevTarget] = useState(targetText);

  useEffect(() => {
    if (targetText !== prevTarget) {
      setPrevTarget(targetText);
      setTextIterations(0);
      setIsTextAnimating(true);
    }
  }, [targetText, prevTarget]);

  useEffect(() => {
    if (!isTextAnimating) return;

    const interval = setInterval(() => {
      if (textIterations < targetText.length) {
        setDisplayText(
          targetText.split("").map((l, i) =>
            l === " "
              ? l
              : i <= textIterations
                ? targetText[i]
                : alphabets[getRandomInt(26)]
          )
        );
        setTextIterations((prev) => prev + 0.1);
      } else {
        setIsTextAnimating(false);
        setDisplayText(targetText.split(""));
        clearInterval(interval);
      }
    }, 800 / (targetText.length * 10));

    return () => clearInterval(interval);
  }, [isTextAnimating, targetText, textIterations]);

  const easing = shouldReduceMotion ? "linear" : "easeOut";

  const chevronVariants = {
    idle: { y: 0, opacity: 0.7 },
    animating: {
      y: shouldReduceMotion ? 0 : [0, 8, 0],
      opacity: shouldReduceMotion ? 0.7 : [0.7, 0.9, 0.7],
      transition: {
        duration: 1.5,
        ease: "easeInOut" as const,
        repeat: isActive ? Infinity : 0,
        repeatType: "loop" as const,
      },
    },
  };

  const chevron2Variants = {
    idle: { y: 14, opacity: 0.5 },
    animating: {
      y: shouldReduceMotion ? 8 : [14, 18, 14],
      opacity: shouldReduceMotion ? 0.5 : [0.5, 1, 0.5],
      transition: {
        duration: 1.5,
        ease: "easeInOut" as const,
        repeat: isActive ? Infinity : 0,
        repeatType: "loop" as const,
        delay: 0.3,
      },
    },
  };

  const dotsVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.2, delayChildren: 0.1 },
    },
  };

  const dotVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: [0, 1, 1, 0],
      transition: {
        duration: 1.5,
        repeat: Infinity,
        repeatType: "loop" as const,
        ease: "easeInOut" as const,
      },
    },
  };

  const formatTime = (seconds: number) => {
    if (seconds <= 0) return "0min 00sec";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}min ${secs.toString().padStart(2, "0")}sec`;
  };

  const formatSpeed = (bytesPerSec: number) => {
    if (bytesPerSec <= 0) return "-- MB/s";
    const mbps = bytesPerSec / (1024 * 1024);
    return `${mbps.toFixed(1)} MB/s`;
  };

  return (
    <motion.div
      className={cn("w-full", className)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: easing }}
    >
      {/* Top header row */}
      <div className="flex items-center mb-2">
        <div className="flex -mt-3 flex-col items-center justify-center w-8 h-16 overflow-hidden relative">
          <motion.div
            className="absolute"
            variants={chevronVariants}
            animate={isActive ? "animating" : "idle"}
          >
            <ChevronDown size={24} className="text-primary" />
          </motion.div>
          <motion.div
            className="absolute"
            variants={chevron2Variants}
            animate={isActive ? "animating" : "idle"}
          >
            <ChevronDown size={24} className="text-primary" />
          </motion.div>
        </div>

        {/* Status banner */}
        <div className="relative ml-2 flex-1 max-w-xs">
          <svg
            width="50%"
            height="32"
            viewBox="0 0 107 15"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute top-1/2 left-0 transform -translate-y-1/2 w-1/2 fill-foreground"
            preserveAspectRatio="none"
          >
            <path d="M0.445312 0.5H106.103V8.017L99.2813 14.838H0.445312V0.5Z" />
          </svg>
          <div className="relative px-4 py-1.5 font-mono font-bold text-sm">
            <div className="flex items-center">
              <div className="flex font-mono font-bold">
                {displayText.map((letter, i) => (
                  <motion.span
                    key={`${targetText}-${i}`}
                    className={cn(
                      "font-mono font-bold dark:text-black text-white",
                      letter === " " ? "w-3" : ""
                    )}
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                  >
                    {letter}
                  </motion.span>
                ))}
              </div>
              {isActive && (
                <motion.div
                  className="ml-1 flex dark:text-black text-white"
                  variants={dotsVariants}
                  initial="hidden"
                  animate="visible"
                >
                  <motion.span variants={dotVariants}>.</motion.span>
                  <motion.span variants={dotVariants}>.</motion.span>
                  <motion.span variants={dotVariants}>.</motion.span>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Separator */}
      <div className="w-full h-1 bg-foreground mb-3 rounded-full" />

      {/* Labels */}
      <div className="flex items-center mb-1">
        <div className="w-32">
          <div className="text-xs font-mono text-muted-foreground">PROGRESS</div>
        </div>
        <div className="flex ml-6">
          <div className="w-28 text-left">
            <div className="text-xs font-mono text-muted-foreground">EST. TIME</div>
          </div>
          <div className="w-28 text-left">
            <div className="text-xs font-mono text-muted-foreground">SEGMENTS</div>
          </div>
        </div>
      </div>

      {/* Values row */}
      <div className="flex items-center">
        <div className="w-32">
          <div className="w-full h-2.5 border border-foreground/50 bg-transparent rounded-full flex items-center px-0.5">
            <motion.div
              className={cn(
                "h-1 rounded-full",
                status === "complete"
                  ? "bg-green-400"
                  : status === "error"
                    ? "bg-red-400"
                    : "bg-foreground"
              )}
              animate={{ width: `${Math.max(progress, 0)}%` }}
              transition={{ duration: 0.3, ease: easing }}
            />
          </div>
        </div>

        <div className="flex ml-6">
          <div className="w-28 text-left">
            <div className="text-sm font-mono">
              {status === "complete"
                ? "Done"
                : status === "error"
                  ? "Failed"
                  : formatTime(eta)}
            </div>
          </div>
          <div className="w-28 text-left">
            <div className="text-sm font-mono">
              {segmentsDownloaded}/{totalSegments}
            </div>
          </div>
        </div>
      </div>

      {/* Speed indicator */}
      {status === "downloading" && speed > 0 && (
        <div className="mt-1 text-xs font-mono text-muted-foreground">
          {formatSpeed(speed)}
        </div>
      )}

      {/* Bottom bar */}
      <div
        className={cn(
          "w-3/4 h-0.5 mt-4 rounded-full",
          status === "complete"
            ? "bg-green-400"
            : status === "error"
              ? "bg-red-400"
              : "bg-primary"
        )}
      />
    </motion.div>
  );
}
