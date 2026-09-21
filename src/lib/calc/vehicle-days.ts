/**
 * Private vehicle days: the count of unique trip dates that contain at
 * least one Private Transport & Guide line item. Multiple vehicles on the
 * same day still count as a single private vehicle day.
 */
export function countPrivateVehicleDays(
  days: { dayId: string; hasPrivateTransport: boolean }[]
): number {
  return days.filter((d) => d.hasPrivateTransport).length;
}
