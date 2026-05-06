import { SampleDisplay } from './SampleDisplay';
import { Mixer } from './Mixer';
import type { Sample } from '../types';

interface SamplePanelProps {
  selectedSample: Sample | null | undefined;
  selectedPadId: string | null;
  chopBoundaries: unknown;
  onChopBoundaryDrag: (...args: unknown[]) => void;
  onTrim: (start: number, end: number) => void;
  onLoopStart: () => unknown;
  onLoopStop: () => void;
  onSetIn: (time: number) => void;
  onSetOut: (time: number) => void;
  onVolumeChange: (v: number) => void;
  onPanChange: (p: number) => void;
  onRemove: () => void;
  onAutoChop: () => void;
  chopMessage: string | null;
}

export function SamplePanel({
  selectedSample,
  selectedPadId,
  chopBoundaries,
  onChopBoundaryDrag,
  onTrim,
  onLoopStart,
  onLoopStop,
  onSetIn,
  onSetOut,
  onVolumeChange,
  onPanChange,
  onRemove,
  onAutoChop,
  chopMessage,
}: SamplePanelProps) {
  return (
    <div className="sample-panel-stack">
      <SampleDisplay
        sample={selectedSample}
        chopBoundaries={chopBoundaries}
        onChopBoundaryDrag={onChopBoundaryDrag}
        onTrim={onTrim}
        onLoopStart={onLoopStart}
        onLoopStop={onLoopStop}
        onSetIn={onSetIn}
        onSetOut={onSetOut}
      />
      <Mixer
        sample={selectedSample}
        padId={selectedPadId}
        onVolumeChange={onVolumeChange}
        onPanChange={onPanChange}
        onRemove={onRemove}
        onAutoChop={onAutoChop}
        chopMessage={chopMessage}
      />
    </div>
  );
}
