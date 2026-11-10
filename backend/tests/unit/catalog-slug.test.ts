import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { CatalogRepository } from '@/modules/catalog/catalog.repository';
import { NotFoundError, ConflictError } from '@/common/errors/app-error';

describe('CatalogService - Slugs & Hierarchy (Unit)', () => {
  let catalogService: CatalogService;
  let mockRepo: Partial<CatalogRepository>;

  beforeEach(() => {
    mockRepo = {
      findCategories: vi.fn(),
      findCategoryById: vi.fn(),
      findCategoryBySlug: vi.fn(),
      createCategory: vi.fn(),
      updateCategory: vi.fn(),
      findServices: vi.fn(),
      findServiceById: vi.fn(),
      findServiceBySlug: vi.fn(),
      createService: vi.fn(),
      updateService: vi.fn(),
    };
    catalogService = new CatalogService(mockRepo as CatalogRepository);
  });

  describe('Category Slugs & Updates', () => {
    it('should find category by slug', async () => {
      mockRepo.findCategoryBySlug = vi.fn().mockResolvedValue({
        id: 'cat-1',
        name: 'AC Repair',
        slug: 'ac-repair',
        children: [],
        services: [],
      });

      const cat = await catalogService.getCategoryBySlug('ac-repair');
      expect(cat.name).toBe('AC Repair');
      expect(mockRepo.findCategoryBySlug).toHaveBeenCalledWith('ac-repair');
    });

    it('should throw NotFoundError for non-existent category slug', async () => {
      mockRepo.findCategoryBySlug = vi.fn().mockResolvedValue(null);

      await expect(catalogService.getCategoryBySlug('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if updated slug conflicts with existing category', async () => {
      mockRepo.findCategoryById = vi.fn().mockResolvedValue({
        id: 'cat-1',
        slug: 'old-slug',
      });
      mockRepo.findCategoryBySlug = vi.fn().mockResolvedValue({
        id: 'cat-2',
        slug: 'existing-slug',
      });

      await expect(
        catalogService.updateCategory('cat-1', { slug: 'existing-slug' })
      ).rejects.toThrow(ConflictError);
    });
  });

  describe('Service Slugs & Updates', () => {
    it('should find service by slug', async () => {
      mockRepo.findServiceBySlug = vi.fn().mockResolvedValue({
        id: 'srv-1',
        name: 'AC Master Clean',
        slug: 'ac-master-clean',
        basePrice: 1200,
      });

      const srv = await catalogService.getServiceBySlug('ac-master-clean');
      expect(srv.name).toBe('AC Master Clean');
    });

    it('should throw NotFoundError for non-existent service slug', async () => {
      mockRepo.findServiceBySlug = vi.fn().mockResolvedValue(null);

      await expect(catalogService.getServiceBySlug('non-existent')).rejects.toThrow(NotFoundError);
    });

    it('should throw ConflictError if creating service with duplicate slug', async () => {
      mockRepo.findServiceBySlug = vi.fn().mockResolvedValue({
        id: 'srv-1',
        slug: 'duplicate-service',
      });

      await expect(
        catalogService.createService({
          categoryId: '00000000-0000-0000-0000-000000000001',
          name: 'AC Clean',
          slug: 'duplicate-service',
          basePrice: 500,
          durationMinutes: 60,
          pricingType: 'FIXED' as any,
        })
      ).rejects.toThrow(ConflictError);
    });
  });
});
