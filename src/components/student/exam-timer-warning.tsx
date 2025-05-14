
'use client';

import { useState, useEffect } from 'react';
import { AlertTriangle, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ExamTimerWarningProps {
  totalDurationSeconds: number;
  onTimeUp: () => void;
  examTitle?: string;
}

const WARNING_THRESHOLDS = [
  { threshold: 0.5, message: ( timeLeft: string) => `Half time remaining: ${timeLeft}` }, // 50%
  { thresholdSeconds: 15 * 60, message: (timeLeft: string) => `15 minutes remaining: ${timeLeft}` }, // 15 minutes
  { thresholdSeconds: 5 * 60, message: (timeLeft: string) => `5 minutes remaining: ${timeLeft}` },  // 5 minutes
  { thresholdSeconds: 1 * 60, message: (timeLeft: string) => `1 minute remaining: ${timeLeft}` },    // 1 minute
];

export function ExamTimerWarning({ totalDurationSeconds, onTimeUp, examTitle }: ExamTimerWarningProps) {
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(totalDurationSeconds);
  const [warningMessage, setWarningMessage] = useState<string | null>(null);

  useEffect(() => {
    if (timeLeftSeconds <= 0) {
      setWarningMessage('Time is up!');
      onTimeUp();
      return;
    }

    const intervalId = setInterval(() => {
      setTimeLeftSeconds(prevTime => prevTime - 1);
    }, 1000);

    return () => clearInterval(intervalId);
  }, [timeLeftSeconds, onTimeUp]);

  useEffect(() => {
    for (const warning of WARNING_THRESHOLDS) {
      const currentTimeFraction = timeLeftSeconds / totalDurationSeconds;
      if (warning.threshold && currentTimeFraction <= warning.threshold && currentTimeFraction > (warning.threshold - 0.05) ) { // Check within a small window
         // Only show if it's the *most* relevant threshold or if it's specifically seconds-based
        const currentThresholdTime = warning.threshold * totalDurationSeconds;
        if (timeLeftSeconds <= currentThresholdTime && timeLeftSeconds > currentThresholdTime - 60) { // Show for up to a minute after threshold
            setWarningMessage(warning.message(formatTime(timeLeftSeconds)));
            break;
        }
      } else if (warning.thresholdSeconds && timeLeftSeconds <= warning.thresholdSeconds && timeLeftSeconds > warning.thresholdSeconds - 5) { // Show for 5s for second-based
        setWarningMessage(warning.message(formatTime(timeLeftSeconds)));
        break;
      }
    }
    // If no specific threshold warning, but time is low (e.g. < 1min and not caught by 1min rule yet)
    if (timeLeftSeconds > 0 && timeLeftSeconds < 60 && !WARNING_THRESHOLDS.some(w => w.thresholdSeconds === 60 && timeLeftSeconds <= w.thresholdSeconds)) {
        // Do not override specific 1-minute warning
    } else if (timeLeftSeconds <=0) {
        setWarningMessage("Time is up!");
    }
  }, [timeLeftSeconds, totalDurationSeconds]);


  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h > 0 ? h + 'h ' : ''}${m > 0 ? m + 'm ' : ''}${s}s`;
  };
  
  const getBannerVariant = () => {
    if (timeLeftSeconds <= 0) return "destructive";
    if (timeLeftSeconds <= 5 * 60) return "destructive"; // 5 minutes or less
    if (timeLeftSeconds <= 15 * 60) return "warning"; // 15 minutes or less
    return "info";
  }

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 p-3 text-white shadow-lg transition-all duration-300",
        "flex items-center justify-between text-sm font-medium",
        {
          "bg-destructive": getBannerVariant() === "destructive", // Red for critical warnings
          "bg-yellow-500 text-black": getBannerVariant() === "warning", // Yellow for warnings
          "bg-primary": getBannerVariant() === "info", // Blue for general info
        }
      )}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-5 w-5" />
        <span>{examTitle ? `Exam: ${examTitle}` : 'Exam In Progress'}</span>
      </div>
      <div className="flex items-center gap-2">
        {warningMessage && (
            <>
            <AlertTriangle className="h-5 w-5"/>
            <span className="font-semibold">{warningMessage}</span>
            </>
        )}
        {!warningMessage && timeLeftSeconds > 0 && (
            <span>Time Remaining: {formatTime(timeLeftSeconds)}</span>
        )}
      </div>
    </div>
  );
}
