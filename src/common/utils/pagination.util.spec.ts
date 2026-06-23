import { buildPaginationMeta, paginateOffset } from './pagination.util';

describe('pagination.util', () => {
  describe('buildPaginationMeta', () => {
    it('computes totalPages from total and limit', () => {
      expect(buildPaginationMeta(1, 20, 45)).toEqual({
        page: 1,
        limit: 20,
        total: 45,
        totalPages: 3,
      });
    });

    it('returns zero totalPages when limit is zero', () => {
      expect(buildPaginationMeta(1, 0, 10).totalPages).toBe(0);
    });
  });

  describe('paginateOffset', () => {
    it('returns zero-based offset', () => {
      expect(paginateOffset(1, 20)).toBe(0);
      expect(paginateOffset(3, 10)).toBe(20);
    });
  });
});
