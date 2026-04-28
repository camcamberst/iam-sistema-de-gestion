const { Client } = require('pg');
require('dotenv').config();

async function run() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    
    const sql = `
      CREATE OR REPLACE FUNCTION atomic_reserve_inventory(
        p_product_id uuid,
        p_variant_id uuid,
        p_location_type text,
        p_location_id uuid,
        p_quantity integer,
        p_payment_mode text
      )
      RETURNS jsonb
      LANGUAGE plpgsql
      AS $$
      DECLARE
        v_inventory_row shop_inventory%ROWTYPE;
        v_available integer;
      BEGIN
        SELECT *
        INTO v_inventory_row
        FROM shop_inventory
        WHERE product_id = p_product_id
          AND (variant_id = p_variant_id OR (variant_id IS NULL AND p_variant_id IS NULL))
          AND location_type = p_location_type
          AND (location_id = p_location_id OR (location_id IS NULL AND p_location_id IS NULL))
        FOR UPDATE;

        IF NOT FOUND THEN
          RETURN jsonb_build_object('success', false, 'error', 'INVENTORY_NOT_FOUND');
        END IF;

        v_available := v_inventory_row.quantity - v_inventory_row.reserved;

        IF v_available < p_quantity THEN
          RETURN jsonb_build_object('success', false, 'error', 'INVENTORY_SHORTAGE', 'available', v_available);
        END IF;

        IF p_payment_mode = '1q' THEN
          UPDATE shop_inventory
          SET quantity = quantity - p_quantity
          WHERE id = v_inventory_row.id;
        ELSE
          UPDATE shop_inventory
          SET reserved = reserved + p_quantity
          WHERE id = v_inventory_row.id;
        END IF;

        RETURN jsonb_build_object('success', true);
      END;
      $$;
    `;
    
    await client.query(sql);
    console.log('RPC Created Successfully!');
  } catch (err) {
    console.error('Error creating RPC:', err);
  } finally {
    await client.end();
  }
}
run();
