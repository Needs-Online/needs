import { describe, it, expect } from 'vitest';
import { createPaginationMeta, paginationQuerySchema } from '@/common/dto/pagination.dto';

describe('Pagination DTO & Utilities', () => {
  it('should parse and apply pagination defaults', () => {
    const parsed = paginationQuerySchema.parse({});
    expect(parsed.page).toBe(1);
    expect(parsed.limit).toBe(20);
    expect(parsed.sortOrder).toBe('desc');
  });

  it('should calculate pagination metadata correctly', () => {
    const meta = createPaginationMeta(95, 2, 20);
    expect(meta.total).toBe(95);
    expect(meta.page).toBe(2);
    expect(meta.limit).toBe(20);
    expect(meta.totalPages).toBe(5);
    expect(meta.hasNextPage).toBe(true);
    expect(meta.hasPrevPage).toBe(true);
  });

  it('should detect boundary pages correctly', () => {
    const firstPage = createPaginationMeta(10, 1, 20);
    expect(firstPage.hasNextPage).toBe(false);
    expect(firstPage.hasPrevPage).toBe(false);

    const lastPage = createPaginationMeta(50, 5, 10);
    expect(lastPage.hasNextPage).toBe(false);
    expect(lastPage.hasPrevPage).toBe(true);
  });
});
