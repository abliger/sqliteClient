import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { formatDistanceToNow, formatDate } from './date'

describe('date utils', () => {
  describe('formatDistanceToNow', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2024-01-15 10:30:00'))
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it('should return "刚刚" for very recent dates', () => {
      const date = new Date('2024-01-15 10:29:52')
      expect(formatDistanceToNow(date)).toBe('刚刚')
    })

    it('should return seconds ago for recent dates', () => {
      const date = new Date('2024-01-15 10:29:30')
      expect(formatDistanceToNow(date)).toBe('30秒前')
    })

    it('should return minutes ago for dates within an hour', () => {
      const date = new Date('2024-01-15 10:15:00')
      expect(formatDistanceToNow(date)).toBe('15分钟前')
    })

    it('should return hours ago for dates within a day', () => {
      const date = new Date('2024-01-15 08:30:00')
      expect(formatDistanceToNow(date)).toBe('2小时前')
    })

    it('should return days ago for dates within a month', () => {
      const date = new Date('2024-01-10 10:30:00')
      expect(formatDistanceToNow(date)).toBe('5天前')
    })

    it('should return formatted date for dates over a month ago in same year', () => {
      const date = new Date('2024-01-01 10:30:00')
      vi.setSystemTime(new Date('2024-03-15 10:30:00'))
      
      const result = formatDistanceToNow(date)
      expect(result).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
    })

    it('should return formatted date with year for dates in different years', () => {
      const date = new Date('2023-06-01 10:30:00')
      
      const result = formatDistanceToNow(date)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/)
    })

    it('should handle exactly 10 seconds ago', () => {
      const date = new Date('2024-01-15 10:29:50')
      expect(formatDistanceToNow(date)).toBe('10秒前')
    })

    it('should handle exactly 1 minute ago', () => {
      const date = new Date('2024-01-15 10:29:00')
      expect(formatDistanceToNow(date)).toBe('1分钟前')
    })

    it('should handle exactly 1 hour ago', () => {
      const date = new Date('2024-01-15 09:30:00')
      expect(formatDistanceToNow(date)).toBe('1小时前')
    })

    it('should handle exactly 1 day ago', () => {
      const date = new Date('2024-01-14 10:30:00')
      expect(formatDistanceToNow(date)).toBe('1天前')
    })

    it('should handle 30 days boundary', () => {
      // 29 days ago should show "29天前"
      const date29 = new Date('2023-12-17 10:30:00')
      const result29 = formatDistanceToNow(date29)
      expect(result29).toBe('29天前')
      
      // 30 days ago should show date (over 30 days threshold)
      const date30 = new Date('2023-12-16 10:30:00')
      const result30 = formatDistanceToNow(date30)
      expect(result30).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })

    it('should handle 31 days ago (show date)', () => {
      const date = new Date('2023-12-15 10:30:00')
      const result = formatDistanceToNow(date)
      // Over 30 days, should show date
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2}/)
    })

    it('should pad single digit minutes and hours', () => {
      const date = new Date('2023-01-05 08:05:03')
      vi.setSystemTime(new Date('2024-01-15 10:30:00'))
      
      const result = formatDistanceToNow(date)
      // Should include year since different year
      expect(result).toBe('2023-01-05 08:05')
    })

    // 新增边界测试
    it('should handle exactly 0 seconds ago (刚刚)', () => {
      const date = new Date('2024-01-15 10:30:00')
      expect(formatDistanceToNow(date)).toBe('刚刚')
    })

    it('should handle 9 seconds ago (刚刚)', () => {
      const date = new Date('2024-01-15 10:29:51')
      expect(formatDistanceToNow(date)).toBe('刚刚')
    })

    it('should handle 59 seconds ago', () => {
      const date = new Date('2024-01-15 10:29:01')
      expect(formatDistanceToNow(date)).toBe('59秒前')
    })

    it('should handle 59 minutes ago', () => {
      const date = new Date('2024-01-15 09:31:00')
      expect(formatDistanceToNow(date)).toBe('59分钟前')
    })

    it('should handle 23 hours ago', () => {
      const date = new Date('2024-01-14 11:30:00')
      expect(formatDistanceToNow(date)).toBe('23小时前')
    })

    it('should handle 29 days ago', () => {
      const date = new Date('2023-12-17 10:30:00')
      expect(formatDistanceToNow(date)).toBe('29天前')
    })

    it('should handle future dates (negative diff)', () => {
      const date = new Date('2024-01-15 10:30:30')
      const result = formatDistanceToNow(date)
      // 未来时间会显示为负数秒，但应该仍然返回字符串
      expect(typeof result).toBe('string')
    })

    it('should show correct format for same year but over 30 days', () => {
      vi.setSystemTime(new Date('2024-06-15 10:30:00'))
      const date = new Date('2024-01-15 10:30:00')
      const result = formatDistanceToNow(date)
      // Same year, should not include year
      expect(result).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
      expect(result).toBe('01-15 10:30')
    })

    it('should handle date at beginning of year', () => {
      vi.setSystemTime(new Date('2024-12-31 23:59:59'))
      const date = new Date('2024-01-01 00:00:00')
      const result = formatDistanceToNow(date)
      expect(result).toMatch(/^\d{2}-\d{2} \d{2}:\d{2}$/)
    })

    it('should handle date at end of year', () => {
      vi.setSystemTime(new Date('2025-01-01 00:00:00'))
      const date = new Date('2024-12-31 23:59:59')
      const result = formatDistanceToNow(date)
      expect(result).toBe('刚刚')
    })

    it('should handle leap year February 29', () => {
      vi.setSystemTime(new Date('2024-03-01 10:30:00'))
      const date = new Date('2024-02-29 10:30:00')
      expect(formatDistanceToNow(date)).toBe('1天前')
    })

    it('should handle milliseconds difference', () => {
      vi.setSystemTime(new Date('2024-01-15 10:30:00.500'))
      const date = new Date('2024-01-15 10:30:00.100')
      expect(formatDistanceToNow(date)).toBe('刚刚')
    })
  })

  describe('formatDate', () => {
    it('should format date correctly', () => {
      const date = new Date('2024-03-15 14:30:45')
      
      expect(formatDate(date)).toBe('2024-03-15 14:30:45')
    })

    it('should pad single digit values', () => {
      const date = new Date('2024-01-05 08:05:03')
      
      expect(formatDate(date)).toBe('2024-01-05 08:05:03')
    })

    it('should handle midnight', () => {
      const date = new Date('2024-01-01 00:00:00')
      
      expect(formatDate(date)).toBe('2024-01-01 00:00:00')
    })

    it('should handle end of year', () => {
      const date = new Date('2024-12-31 23:59:59')
      
      expect(formatDate(date)).toBe('2024-12-31 23:59:59')
    })

    it('should handle leap year date', () => {
      const date = new Date('2024-02-29 12:00:00')
      
      expect(formatDate(date)).toBe('2024-02-29 12:00:00')
    })

    // 新增边界测试
    it('should handle all single digits', () => {
      const date = new Date('2024-01-01 01:01:01')
      expect(formatDate(date)).toBe('2024-01-01 01:01:01')
    })

    it('should handle all double digits', () => {
      const date = new Date('2024-12-31 23:59:59')
      expect(formatDate(date)).toBe('2024-12-31 23:59:59')
    })

    it('should handle year 2000', () => {
      const date = new Date('2000-01-01 00:00:00')
      expect(formatDate(date)).toBe('2000-01-01 00:00:00')
    })

    it('should handle year 1999', () => {
      const date = new Date('1999-12-31 23:59:59')
      expect(formatDate(date)).toBe('1999-12-31 23:59:59')
    })

    it('should handle current date', () => {
      const now = new Date()
      const result = formatDate(now)
      expect(result).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    })

    it('should handle noon', () => {
      const date = new Date('2024-06-15 12:00:00')
      expect(formatDate(date)).toBe('2024-06-15 12:00:00')
    })

    it('should handle PM times', () => {
      const date = new Date('2024-06-15 15:30:45')
      expect(formatDate(date)).toBe('2024-06-15 15:30:45')
    })
  })
})
