import { prisma } from '@/database/prisma';
import { Category, Service } from '@prisma/client';
import { CreateCategoryDto, CreateServiceDto } from './dto/catalog.dto';

export class CatalogRepository {
  async findCategories(includeInactive = false): Promise<Category[]> {
    return prisma.category.findMany({
      where: includeInactive ? {} : { isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        children: true,
      },
    });
  }

  async findCategoryBySlug(slug: string): Promise<Category | null> {
    return prisma.category.findUnique({
      where: { slug },
    });
  }

  async createCategory(data: CreateCategoryDto): Promise<Category> {
    return prisma.category.create({
      data,
    });
  }

  async findServices(params: {
    categoryId?: string;
    search?: string;
    includeInactive?: boolean;
  }): Promise<Service[]> {
    return prisma.service.findMany({
      where: {
        isActive: params.includeInactive ? undefined : true,
        categoryId: params.categoryId || undefined,
        OR: params.search
          ? [
              { name: { contains: params.search, mode: 'insensitive' } },
              { description: { contains: params.search, mode: 'insensitive' } },
            ]
          : undefined,
      },
      include: {
        category: true,
      },
      orderBy: { name: 'asc' },
    });
  }

  async findServiceById(id: string): Promise<Service | null> {
    return prisma.service.findUnique({
      where: { id },
      include: {
        category: true,
      },
    });
  }

  async createService(data: CreateServiceDto): Promise<Service> {
    return prisma.service.create({
      data: {
        ...data,
        basePrice: data.basePrice,
      },
      include: {
        category: true,
      },
    });
  }
}
