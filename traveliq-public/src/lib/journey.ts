import type { Booking } from './model';

/** Summarize the first connected, outward journey without hiding the individual legs. */
export function journeyRoute(booking: Pick<Booking, 'segments'>) {
  const [first] = booking.segments;
  if (!first) return { origin: '', destination: '', via: [] as string[], hasMoreJourneys: false };
  const visited = new Set([first.origin, first.destination]);
  const outward = [first];
  for (const segment of booking.segments.slice(1)) {
    // A disconnected trip or a flight back to an earlier airport starts another journey.
    if (segment.origin !== outward.at(-1)!.destination || visited.has(segment.destination)) break;
    outward.push(segment);
    visited.add(segment.destination);
  }
  return {
    origin: first.origin,
    destination: outward.at(-1)!.destination,
    via: outward.slice(0, -1).map((segment) => segment.destination),
    hasMoreJourneys: outward.length < booking.segments.length,
  };
}

export function journeyLabel(booking: Pick<Booking, 'segments'>) {
  const route = journeyRoute(booking);
  return `${route.origin || '—'} → ${route.destination || '—'}`;
}
