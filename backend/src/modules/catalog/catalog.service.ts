import { CatalogRepository } from './catalog.repository';
import {
  CreateCategoryDto,
  CreateServiceDto,
  UpdateCategoryDto,
  UpdateServiceDto,
} from './dto/catalog.dto';
import { ConflictError, NotFoundError } from '@/common/errors/app-error';

export class CatalogService {
  constructor(private readonly catalogRepo: CatalogRepository = new CatalogRepository()) {}

  async getCategories(includeInactive = false) {
    return this.catalogRepo.findCategories(includeInactive);
  }

  async getCategoryBySlug(slug: string) {
    const category = await this.catalogRepo.findCategoryBySlug(slug);
    if (!category) {
      throw new NotFoundError(`Category with slug '${slug}' not found`);
    }
    return category;
  }

  async createCategory(dto: CreateCategoryDto) {
    const existing = await this.catalogRepo.findCategoryBySlug(dto.slug);
    if (existing) {
      throw new ConflictError(`Category with slug '${dto.slug}' already exists`);
    }
    return this.catalogRepo.createCategory(dto);
  }

  async updateCategory(id: string, dto: UpdateCategoryDto) {
    const existing = await this.catalogRepo.findCategoryById(id);
    if (!existing) {
      throw new NotFoundError('Category not found');
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.catalogRepo.findCategoryBySlug(dto.slug);
      if (slugExists) {
        throw new ConflictError(`Category with slug '${dto.slug}' already exists`);
      }
    }

    return this.catalogRepo.updateCategory(id, dto);
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

  async getServiceBySlug(slug: string) {
    const service = await this.catalogRepo.findServiceBySlug(slug);
    if (!service) {
      throw new NotFoundError(`Service with slug '${slug}' not found`);
    }
    return service;
  }

  async createService(dto: CreateServiceDto) {
    const existing = await this.catalogRepo.findServiceBySlug(dto.slug);
    if (existing) {
      throw new ConflictError(`Service with slug '${dto.slug}' already exists`);
    }
    return this.catalogRepo.createService(dto);
  }

  async updateService(id: string, dto: UpdateServiceDto) {
    const existing = await this.catalogRepo.findServiceById(id);
    if (!existing) {
      throw new NotFoundError('Service not found');
    }

    if (dto.slug && dto.slug !== existing.slug) {
      const slugExists = await this.catalogRepo.findServiceBySlug(dto.slug);
      if (slugExists) {
        throw new ConflictError(`Service with slug '${dto.slug}' already exists`);
      }
    }

    return this.catalogRepo.updateService(id, dto);
  }
}
