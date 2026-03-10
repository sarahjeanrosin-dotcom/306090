import { clsx, type ClassValue } from 'clsx';
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string | undefined, fmt = 'MMM d, yyyy') {
  if (!dateStr) return '—';
  try {
    return format(parseISO(dateStr.includes('T') ? dateStr : dateStr + 'T00:00:00'), fmt);
  } catch {
    return dateStr;
  }
}

export function getCurrentWeek() {
  const now = new Date();
  const start = startOfWeek(now, { weekStartsOn: 1 }); // Monday
  const end = endOfWeek(now, { weekStartsOn: 1 }); // Sunday
  return {
    weekStart: format(start, 'yyyy-MM-dd'),
    weekEnd: format(end, 'yyyy-MM-dd'),
    label: `${format(start, 'MMM d')} – ${format(end, 'MMM d, yyyy')}`,
  };
}

export function statusColor(status: string) {
  switch (status) {
    case 'completed': return 'bg-green-100 text-green-800';
    case 'in_progress': return 'bg-blue-100 text-blue-800';
    case 'blocked': return 'bg-red-100 text-red-800';
    case 'todo': return 'bg-gray-100 text-gray-700';
    case 'not_started': return 'bg-gray-100 text-gray-700';
    case 'paused': return 'bg-yellow-100 text-yellow-800';
    case 'active': return 'bg-blue-100 text-blue-800';
    default: return 'bg-gray-100 text-gray-700';
  }
}

export function statusLabel(status: string) {
  return status.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

export function milestoneLabel(type: number) {
  return `${type}-Day`;
}

export function progressColor(pct: number) {
  if (pct >= 80) return 'bg-green-500';
  if (pct >= 50) return 'bg-blue-500';
  if (pct >= 25) return 'bg-yellow-500';
  return 'bg-red-400';
}

export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function copyToClipboard(text: string) {
  return navigator.clipboard.writeText(text);
}
