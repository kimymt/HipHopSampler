import { useCallback, useMemo } from 'react';

/**
 * Derives chop boundaries (vertical lines on the waveform display) for the
 * pad currently selected, when that pad belongs to an Auto Chop group.
 *
 * Boundary dragging mutates the IN time of one sibling and the OUT time of
 * its neighbor in a single `updateMany` call so the slices stay contiguous.
 *
 * Inputs:
 * - selectedSample: the currently selected sample object (or null)
 * - samples: full samples map (used to find chopGroup siblings)
 * - updateMany: persisted-samples updateMany setter
 *
 * Outputs:
 * - chopBoundaries: { times: number[], padIdsAt: { prev, next }[], currentIndex } or null
 * - handleBoundaryDrag: (boundaryIdx, newTime) => void
 */
export function useChopGroups({ selectedSample, samples, updateMany }) {
  const chopBoundaries = useMemo(() => {
    if (!selectedSample || !selectedSample.chopGroup) return null;
    const siblings = Object.entries(samples)
      .filter(([, s]) => s?.chopGroup === selectedSample.chopGroup)
      .sort((a, b) => (a[1].chopIndex ?? 0) - (b[1].chopIndex ?? 0));
    if (siblings.length === 0) return null;
    const boundaries = [siblings[0][1].startTime];
    siblings.forEach(([, s]) => boundaries.push(s.endTime));
    // Map index → padIds it touches.
    // Boundary i sits between sibling i-1 (out) and sibling i (in).
    const padIdsAt = boundaries.map((_, i) => ({
      prev: i > 0 ? siblings[i - 1][0] : null,
      next: i < siblings.length ? siblings[i][0] : null,
    }));
    return { times: boundaries, padIdsAt, currentIndex: selectedSample.chopIndex ?? 0 };
  }, [selectedSample, samples]);

  const handleBoundaryDrag = useCallback(
    (boundaryIdx, newTime) => {
      if (!chopBoundaries || !selectedSample?.buffer) return;
      const { padIdsAt, times } = chopBoundaries;
      const at = padIdsAt[boundaryIdx];
      // Clamp within neighbors so slices don't cross.
      const lo = boundaryIdx > 0 ? times[boundaryIdx - 1] + 0.01 : 0;
      const hi =
        boundaryIdx < times.length - 1
          ? times[boundaryIdx + 1] - 0.01
          : selectedSample.buffer.duration;
      const t = Math.max(lo, Math.min(hi, newTime));

      const updates = {};
      if (at.prev) updates[at.prev] = { endTime: t };
      if (at.next) updates[at.next] = { startTime: t };
      if (Object.keys(updates).length) updateMany(updates);
    },
    [chopBoundaries, selectedSample, updateMany],
  );

  return { chopBoundaries, handleBoundaryDrag };
}
