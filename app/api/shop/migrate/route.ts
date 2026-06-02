import { NextRequest, NextResponse } from 'next/server';
import { Client } from 'pg';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const sql = `
      -- 1. Create shop_aisles table
      CREATE TABLE IF NOT EXISTS shop_aisles (
        id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name                text NOT NULL,
        description         text,
        slug                text UNIQUE,
        is_active           boolean NOT NULL DEFAULT true,
        created_by          uuid REFERENCES public.users(id),
        affiliate_studio_id uuid REFERENCES public.affiliate_studios(id) ON DELETE CASCADE,
        created_at          timestamptz NOT NULL DEFAULT now(),
        updated_at          timestamptz NOT NULL DEFAULT now()
      );

      -- 2. Create index on affiliate_studio_id
      CREATE INDEX IF NOT EXISTS idx_shop_aisles_affiliate ON shop_aisles(affiliate_studio_id);

      -- 3. Add aisle_id to shop_categories referencing shop_aisles
      ALTER TABLE shop_categories ADD COLUMN IF NOT EXISTS aisle_id uuid REFERENCES shop_aisles(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_shop_categories_aisle ON shop_categories(aisle_id);

      -- 4. Enable RLS and create select policy
      ALTER TABLE shop_aisles ENABLE ROW LEVEL SECURITY;

      DO $$
      BEGIN
          IF NOT EXISTS (
              SELECT 1 FROM pg_policies 
              WHERE tablename = 'shop_aisles' AND policyname = 'Authenticated can read aisles'
          ) THEN
              CREATE POLICY "Authenticated can read aisles" ON shop_aisles FOR SELECT USING (auth.role() = 'authenticated');
          END IF;
      END
      $$;

      -- 5. Trigger for updated_at
      DROP TRIGGER IF EXISTS trg_shop_aisles_upd ON shop_aisles;
      CREATE TRIGGER trg_shop_aisles_upd BEFORE UPDATE ON shop_aisles FOR EACH ROW EXECUTE FUNCTION update_shop_updated_at();

      -- 6. Reload schema
      NOTIFY pgrst, 'reload schema';
    `;
    
    await client.query(sql);
    return NextResponse.json({ success: true, message: "Migration applied successfully!" });
  } catch (err: any) {
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  } finally {
    await client.end();
  }
}
