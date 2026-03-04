import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format } from 'date-fns';
import { createEvent, DateArray } from 'ics';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORIES = ["Exam", "Event", "Holiday", "Fee", "Urgent", "General"];
export const ISSUE_CATEGORIES = ["Electrical", "Plumbing", "Furniture", "IT/Projector", "Cleaning", "Other"];
export const DEPARTMENTS = ["Engineering", "Pharmacy", "Diploma"];
export const BRANCHES = ["Computer Science", "Mechanical", "Civil", "Electronics", "B.Pharm", "M.Pharm", "Polytechnic"];
export const YEARS = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

export function safeFormatDate(dateStr: string, formatStr: string): string {
  if (!dateStr) return 'N/A';
  try {
    const isoStr = dateStr.includes(' ') && !dateStr.includes('T')
      ? dateStr.replace(' ', 'T')
      : dateStr;
    const date = new Date(isoStr);
    if (isNaN(date.getTime())) return 'Invalid Date';
    return format(date, formatStr);
  } catch (error) {
    console.error('Date formatting error:', error);
    return 'Invalid Date';
  }
}

// Helper to parse various date strings into a DateArray for ics
function parseDateToArray(dateStr: string): DateArray | undefined {
  if (!dateStr) return undefined;

  // Try to parse as ISO first
  let date = new Date(dateStr);
  if (!isNaN(date.getTime())) {
    return [date.getFullYear(), date.getMonth() + 1, date.getDate(), 9, 0];
  }

  // Month name to number mapping
  const monthNames: { [key: string]: number } = {
    january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
    july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
    jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12
  };

  // Pattern: Month Day, Year (e.g., "March 25th, 2026")
  const monthDayYear = dateStr.match(/([A-Za-z]+)\s+(\d{1,2})(?:st|nd|rd|th)?,?\s+(\d{4})/i);
  if (monthDayYear) {
    const monthName = monthDayYear[1].toLowerCase();
    const month = monthNames[monthName];
    const day = parseInt(monthDayYear[2], 10);
    const year = parseInt(monthDayYear[3], 10);
    if (month && day && year) {
      return [year, month, day, 9, 0];
    }
  }

  // Pattern: Day Month Year (e.g., "25th March 2026")
  const dayMonthYear = dateStr.match(/(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+)\s+(\d{4})/i);
  if (dayMonthYear) {
    const day = parseInt(dayMonthYear[1], 10);
    const monthName = dayMonthYear[2].toLowerCase();
    const month = monthNames[monthName];
    const year = parseInt(dayMonthYear[3], 10);
    if (month && day && year) {
      return [year, month, day, 9, 0];
    }
  }

  // Fallback: use tomorrow as a demo date
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate(), 9, 0];
}

export function generateCalendarEvent(event: { title: string; description: string; date?: string }) {
  let startDate = parseDateToArray(event.date || '');
  if (!startDate) {
    alert('Could not parse event date. Using tomorrow as default.');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    startDate = [tomorrow.getFullYear(), tomorrow.getMonth() + 1, tomorrow.getDate(), 9, 0];
  }

  const eventData = {
    start: startDate,
    duration: { hours: 1 },
    title: event.title,
    description: event.description,
    location: 'Campus',
    status: 'CONFIRMED' as const,
    busyStatus: 'BUSY' as const,
  };

  createEvent(eventData, (error, value) => {
    if (error) {
      console.error('Failed to create calendar event', error);
      alert('Failed to create calendar event. Please try again.');
      return;
    }
    // Download the .ics file
    const blob = new Blob([value], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${event.title.replace(/\s+/g, '_')}.ics`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });
}