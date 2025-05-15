
'use client';

import { useEffect, useRef } _from_ 'react';
import type { FlaggedEvent, FlaggedEventType } _from_ '@/types/supabase'; // Using type from central location

interface UseActivityMonitorProps {
  studentId: string; // Can be actual student ID or a demo identifier
  examId: string;
  onFlagEvent: (event: FlaggedEvent) => void;
  enabled?: boolean; // Overall toggle for the monitor
  isDemoMode?: boolean; // Special mode for teacher demos
}

export function useActivityMonitor({
  studentId,
  examId,
  onFlagEvent,
  enabled = true,
  isDemoMode = false,
}: UseActivityMonitorProps) {
  const onFlagEventRef = useRef(onFlagEvent);

  useEffect(() => {
    onFlagEventRef.current = onFlagEvent;
  }, [onFlagEvent]);

  useEffect(() => {
    if (!enabled) return;

    const createEvent = (type: FlaggedEventType, details?: string): FlaggedEvent => ({
      type,
      timestamp: new Date(),
      studentId, // This will be the generic ID passed in props
      examId,
      details,
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        onFlagEventRef.current(createEvent('visibility_hidden'));
      } else {
        onFlagEventRef.current(createEvent('visibility_visible'));
      }
    };

    const handleFullscreenChange = () => {
      if (!document.fullscreenElement) {
        onFlagEventRef.current(createEvent('fullscreen_exited'));
      } else {
        onFlagEventRef.current(createEvent('fullscreen_entered'));
      }
    };
    
    const handleBlur = () => {
      onFlagEventRef.current(createEvent('blur', "Window lost focus"));
    };

    const handleFocus = () => {
      onFlagEventRef.current(createEvent('focus', "Window gained focus"));
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    // Initial check for fullscreen
    if (document.fullscreenElement) {
        onFlagEventRef.current(createEvent('fullscreen_entered', "Initial state: fullscreen"));
    }


    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [enabled, studentId, examId, isDemoMode]); // isDemoMode included if behavior needs to change
}

    