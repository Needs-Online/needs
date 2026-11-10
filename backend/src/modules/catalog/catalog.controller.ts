import { NextRequest, NextResponse } from 'next/server';
import { CatalogService } from './catalog.service';
import {
  createCategorySchema,
  createServiceSchema,
  updateCategorySchema,
  updateServiceSchema,
} from './dto/catalog.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class CatalogController {
  constructor(private readonly catalogService: CatalogService = new CatalogService()) {}

  async getCategories(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const includeInactive = url.searchParams.get('includeInactive') === 'true';
      const categories = await this.catalogService.getCategories(includeInactive);
      return NextResponse.json(successResponse(categories, 'Categories retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getCategoryBySlug(slug: string): Promise<NextResponse> {
    try {
      const category = await this.catalogService.getCategoryBySlug(slug);
      return NextResponse.json(successResponse(category, 'Category details retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async createCategory(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, createCategorySchema);
      const category = await this.catalogService.createCategory(dto);
      return NextResponse.json(successResponse(category, 'Category created successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateCategory(req: NextRequest, id: string): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, updateCategorySchema);
      const category = await this.catalogService.updateCategory(id, dto);
      return NextResponse.json(successResponse(category, 'Category updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getServices(req: NextRequest): Promise<NextResponse> {
    try {
      const url = new URL(req.url);
      const categoryId = url.searchParams.get('categoryId') || undefined;
      const search = url.searchParams.get('search') || undefined;
      const includeInactive = url.searchParams.get('includeInactive') === 'true';

      const services = await this.catalogService.getServices({ categoryId, search, includeInactive });
      return NextResponse.json(successResponse(services, 'Services retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getServiceById(id: string): Promise<NextResponse> {
    try {
      const service = await this.catalogService.getServiceById(id);
      return NextResponse.json(successResponse(service, 'Service details retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getServiceBySlug(slug: string): Promise<NextResponse> {
    try {
      const service = await this.catalogService.getServiceBySlug(slug);
      return NextResponse.json(successResponse(service, 'Service details retrieved successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async createService(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, createServiceSchema);
      const service = await this.catalogService.createService(dto);
      return NextResponse.json(successResponse(service, 'Service created successfully'), {
        status: 201,
      });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async updateService(req: NextRequest, id: string): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, updateServiceSchema);
      const service = await this.catalogService.updateService(id, dto);
      return NextResponse.json(successResponse(service, 'Service updated successfully'));
    } catch (error) {
      return handleApiError(error);
    }
  }
}
