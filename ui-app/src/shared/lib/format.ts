export function formatMinutes(minutes: number): string {
  const hours = minutes / 60;
  if (hours < 1) return `${minutes} min`;
  return `${hours.toLocaleString("es-CL", { maximumFractionDigits: 1 })} h`;
}

export function formatPercent(value: number): string {
  return `${Math.round(value)}%`;
}
