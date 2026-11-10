import { NextRequest } from 'next/server';
import { CatalogController } from '@/modules/catalog/catalog.controller';
import { RouteContext } from '@/common/guards/auth.guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CatalogController();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_req: NextRequest, context: RouteContext<{ id: string }>) {
  const { id } = await context.params;
  if (UUID_REGEX.test(id)) {
    return controller.getServiceById(id);
  }
  return controller.getServiceBySlug(id);
}
