
'use client';

import { useEffect, useRef } from 'react';

export type FlaggedEventType = 
  | 'visibility_hidden' 
  | 'visibility_visible' 
  | 'fullscreen_entered' 
  | 'fullscreen_exited'
  | 'blur' // Window lost focus
  | 'focus'; // Window gained focus

export interface FlaggedEvent {
  type: FlaggedEventType;
  timestamp: Date;
  studentId: string;
  examId: string;
  details?: string; 
}

interface UseActivityMonitorProps {
  studentId: string;
  examId: string;
  onFlagEvent: (event: FlaggedEvent) => void;
  enabled?: boolean;
}

export function useActivityMonitor({
  studentId,
  examId,
  onFlagEvent,
  enabled = true,
}: UseActivityMonitorProps) {
  const onFlagEventRef = useRef(onFlagEvent);

  useEffect(() => {
    onFlagEventRef.current = onFlagEvent;
  }, [onFlagEvent]);

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onFlagEventRef.current({ type: 'visibility_hidden', timestamp: new Date(), studentId, examId });
      } else {
        onFlagEventRef.current({ type: 'visibility_visible', timestamp: new Date(), studentId, examId });
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onFlagEventRef.current({ type: 'fullscreen_exited', timestamp: new Date(), studentId, examId });
      } else {
        onFlagEventRef.current({ type: 'fullscreen_entered', timestamp: new Date(), studentId, examId });
      }
    };
    
    const handleBlur = () => {
      // This can be noisy if devtools are opened, etc. Use with caution or specific SEB configurations.
      onFlagEventRef.current({ type: 'blur', timestamp: new Date(), studentId, examId, details: "Window lost focus" });
    };

    const handleFocus = () => {
      onFlagEventRef.current({ type: 'focus', timestamp: new Date(), studentId, examId, details: "Window gained focus" });
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Initial check for fullscreen
    if (document.fullscreenElement) {
        onFlagEventRef.current({ type: 'fullscreen_entered', timestamp: new Date(), studentId, examId, details: "Initial state: fullscreen" });
    }


    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, studentId, examId]);
}
