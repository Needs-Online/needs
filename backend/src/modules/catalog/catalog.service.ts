import { CatalogRepository } from './catalog.repository';
import { CreateCategoryDto, CreateServiceDto } from './dto/catalog.dto';
import { ConflictError, NotFoundError } from '@/common/errors/app-error';

export class CatalogService {
  constructor(private readonly catalogRepo: CatalogRepository = new CatalogRepository()) {}

  async getCategories(includeInactive = false) {
    return this.catalogRepo.findCategories(includeInactive);
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.catalogRepo.findCategoryBySlug(dto.slug);
    if (existing) {
      throw new ConflictError(`Category with slug '${dto.slug}' already exists`);
    }
    return this.catalogRepo.createCategory(dto);
  }

  async getServices(params: { categoryId?: string; search?: string; includeInactive?: boolean }) {
    return this.catalogRepo.findServices(params);
  }

  async getServiceById(id: string) {
    const service = await this.catalogRepo.findServiceById(id);
    if (!service) {
      throw new NotFoundError('Service offering not found');
    }
    return service;
  }

  async createService(dto: CreateServiceDto) {
    return this.catalogRepo.createService(dto);
  }
}
