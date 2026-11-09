import { NextRequest } from 'next/server';
import { CatalogController } from '@/modules/catalog/catalog.controller';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CatalogController();

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params;
  return controller.getServiceById(req, id);
}
