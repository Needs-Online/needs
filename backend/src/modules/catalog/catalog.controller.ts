import { NextRequest, NextResponse } from 'next/server';
import { CatalogService } from './catalog.service';
import { createCategorySchema, createServiceSchema } from './dto/catalog.dto';
import { validateBody } from '@/common/validators/zod.validator';
import { successResponse } from '@/common/dto/response.dto';
import { handleApiError } from '@/common/errors/app-error';

export class CatalogController {
  constructor(private readonly catalogService: CatalogService = new CatalogService()) {}

  async getCategories(req: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(req.url);
      const includeInactive = searchParams.get('includeInactive') === 'true';
      const categories = await this.catalogService.getCategories(includeInactive);
      return NextResponse.json(successResponse(categories, 'Categories retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async createCategory(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, createCategorySchema);
      const category = await this.catalogService.createCategory(dto);
      return NextResponse.json(successResponse(category, 'Category created'), { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getServices(req: NextRequest): Promise<NextResponse> {
    try {
      const { searchParams } = new URL(req.url);
      const categoryId = searchParams.get('categoryId') || undefined;
      const search = searchParams.get('search') || undefined;
      const includeInactive = searchParams.get('includeInactive') === 'true';

      const services = await this.catalogService.getServices({ categoryId, search, includeInactive });
      return NextResponse.json(successResponse(services, 'Services retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async getServiceById(_req: NextRequest, serviceId: string): Promise<NextResponse> {
    try {
      const service = await this.catalogService.getServiceById(serviceId);
      return NextResponse.json(successResponse(service, 'Service retrieved'));
    } catch (error) {
      return handleApiError(error);
    }
  }

  async createService(req: NextRequest): Promise<NextResponse> {
    try {
      const dto = await validateBody(req, createServiceSchema);
      const service = await this.catalogService.createService(dto);
      return NextResponse.json(successResponse(service, 'Service created'), { status: 201 });
    } catch (error) {
      return handleApiError(error);
    }
  }
}
