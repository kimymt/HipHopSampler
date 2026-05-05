import React, { useEffect, useState } from 'react';
import { getAudioLatency, type LatencyReport } from '../utils/audioLatency';
import './LatencyBadge.css';

interface Props {
  audioContext: AudioContext | null;
  /** poll interval in ms; outputLatency can drift over time */
  pollMs?: number;
}

const labelFor = (cls: LatencyReport['classification']): string => {
  switch (cls) {
    case 'excellent':
      return 'EXCELLENT';
    case 'good':
      return 'GOOD';
    case 'acceptable':
      return 'OK';
    case 'poor':
      return 'POOR';
  }
};

export const LatencyBadge: React.FC<Props> = ({ audioContext, pollMs = 2000 }) => {
  const [report, setReport] = useState<LatencyReport | null>(() => getAudioLatency(audioContext));

  useEffect(() => {
    if (!audioContext) return;
    setReport(getAudioLatency(audioContext));
    const id = window.setInterval(() => {
      setReport(getAudioLatency(audioContext));
    }, pollMs);
    return () => window.clearInterval(id);
  }, [audioContext, pollMs]);

  if (!report) {
    return <span className="latency-badge latency-badge--unknown">— ms</span>;
  }

  const total = Math.round(report.totalLatencyMs);
  return (
    <span
      className={`latency-badge latency-badge--${report.classification}`}
      title={`base ${report.baseLatencyMs.toFixed(1)}ms + output ${report.outputLatencyMs.toFixed(1)}ms · ${report.sampleRate / 1000}kHz${report.fullySupported ? '' : ' (partial)'}`}
    >
      {total}ms · {labelFor(report.classification)}
    </span>
  );
};
