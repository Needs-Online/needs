import { NextRequest } from 'next/server';
import { CatalogController } from '@/modules/catalog/catalog.controller';
import { RouteContext } from '@/common/guards/auth.guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CatalogController();

export async function GET(_req: NextRequest, context: RouteContext<{ slug: string }>) {
  const { slug } = await context.params;
  return controller.getCategoryBySlug(slug);
}
