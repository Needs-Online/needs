import { NextRequest } from 'next/server';
import { CatalogController } from '@/modules/catalog/catalog.controller';
import { withAdminAuth, AuthenticatedNextRequest } from '@/common/guards/auth.guard';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const controller = new CatalogController();

export async function GET(req: NextRequest) {
  return controller.getServices(req);
}

export const POST = withAdminAuth(async (req: AuthenticatedNextRequest) => {
  return controller.createService(req);
});
