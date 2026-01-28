import { describe, it, expect } from 'vitest';
import { formatDate, formatTime, isSameDay } from './utils';

describe('formatDate', () => {
	it('should format date correctly', () => {
		const date = new Date('2025-12-05T15:30:00');
		const formatted = formatDate(date);
		expect(formatted).toMatch(/Dec 5, 2025/);
	});
});

describe('formatTime', () => {
	it('should format time correctly', () => {
		const date = new Date('2025-12-05T15:30:00');
		const formatted = formatTime(date);
		expect(formatted).toMatch(/3:30 PM/);
	});
});

describe('isSameDay', () => {
	it('should return true for same day', () => {
		const date1 = new Date('2025-12-05T10:00:00');
		const date2 = new Date('2025-12-05T20:00:00');
		expect(isSameDay(date1, date2)).toBe(true);
	});

	it('should return false for different days', () => {
		const date1 = new Date('2025-12-05T10:00:00');
		const date2 = new Date('2025-12-06T10:00:00');
		expect(isSameDay(date1, date2)).toBe(false);
	});

	it('should return false for different months', () => {
		const date1 = new Date('2025-12-05T10:00:00');
		const date2 = new Date('2025-11-05T10:00:00');
		expect(isSameDay(date1, date2)).toBe(false);
	});

	it('should return false for different years', () => {
		const date1 = new Date('2025-12-05T10:00:00');
		const date2 = new Date('2024-12-05T10:00:00');
		expect(isSameDay(date1, date2)).toBe(false);
	});
});
