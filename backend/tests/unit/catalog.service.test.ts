import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogService } from '@/modules/catalog/catalog.service';
import { CatalogRepository } from '@/modules/catalog/catalog.repository';
import { ConflictError, NotFoundError } from '@/common/errors/app-error';
import { PricingType } from '@/common/enums';
import { Decimal } from '@prisma/client/runtime/library';

describe('CatalogService (Unit)', () => {
  let catalogService: CatalogService;
  let mockRepo: Partial<CatalogRepository>;

  beforeEach(() => {
    mockRepo = {
      findCategories: vi.fn(),
      findCategoryBySlug: vi.fn(),
      createCategory: vi.fn(),
      findServices: vi.fn(),
      findServiceById: vi.fn(),
      createService: vi.fn(),
    };

    catalogService = new CatalogService(mockRepo as CatalogRepository);
  });

  it('should return list of categories', async () => {
    const mockCategories = [
      { id: 'cat-1', name: 'Cleaning', slug: 'cleaning', isActive: true, sortOrder: 1 },
      { id: 'cat-2', name: 'Plumbing', slug: 'plumbing', isActive: true, sortOrder: 2 },
    ];
    mockRepo.findCategories = vi.fn().mockResolvedValue(mockCategories);

    const result = await catalogService.getCategories(false);
    expect(result).toHaveLength(2);
    expect(result[0].slug).toBe('cleaning');
    expect(mockRepo.findCategories).toHaveBeenCalledWith(false);
  });

  it('should throw ConflictError if category slug already exists', async () => {
    mockRepo.findCategoryBySlug = vi.fn().mockResolvedValue({ id: 'cat-1', slug: 'cleaning' });

    await expect(
      catalogService.createCategory({
        name: 'Cleaning',
        slug: 'cleaning',
        description: 'Cleaning services',
        sortOrder: 0,
      })
    ).rejects.toThrow(ConflictError);
  });

  it('should successfully create category when slug is unique', async () => {
    mockRepo.findCategoryBySlug = vi.fn().mockResolvedValue(null);
    mockRepo.createCategory = vi.fn().mockResolvedValue({
      id: 'cat-new',
      name: 'Electrical',
      slug: 'electrical',
      isActive: true,
      sortOrder: 0,
    });

    const result = await catalogService.createCategory({
      name: 'Electrical',
      slug: 'electrical',
      description: 'Electrical repairs',
      sortOrder: 0,
    });

    expect(result.id).toBe('cat-new');
    expect(result.slug).toBe('electrical');
  });

  it('should return service by ID', async () => {
    const mockService = {
      id: 'srv-1',
      categoryId: 'cat-1',
      name: 'Deep Cleaning',
      slug: 'deep-cleaning',
      basePrice: new Decimal('1500.00'),
      pricingType: PricingType.FIXED,
      isActive: true,
    };
    mockRepo.findServiceById = vi.fn().mockResolvedValue(mockService);

    const result = await catalogService.getServiceById('srv-1');
    expect(result.id).toBe('srv-1');
    expect(result.name).toBe('Deep Cleaning');
  });

  it('should throw NotFoundError if service not found', async () => {
    mockRepo.findServiceById = vi.fn().mockResolvedValue(null);

    await expect(catalogService.getServiceById('unknown-srv')).rejects.toThrow(NotFoundError);
  });

  it('should create service offering successfully', async () => {
    const newService = {
      id: 'srv-2',
      categoryId: 'cat-1',
      name: 'Kitchen Cleaning',
      slug: 'kitchen-cleaning',
      basePrice: new Decimal('800.00'),
      pricingType: PricingType.FIXED,
      isActive: true,
    };
    mockRepo.createService = vi.fn().mockResolvedValue(newService);

    const result = await catalogService.createService({
      categoryId: 'cat-1',
      name: 'Kitchen Cleaning',
      slug: 'kitchen-cleaning',
      basePrice: 800.0,
      pricingType: PricingType.FIXED,
      durationMinutes: 60,
    });

    expect(result.id).toBe('srv-2');
    expect(mockRepo.createService).toHaveBeenCalled();
  });
});
