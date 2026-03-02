-- Permitir borrado real de productos: order_items y stock_transfers
-- no bloquean el DELETE; se desvinculan (SET NULL) para conservar historial.

-- shop_order_items: permitir product_id NULL y SET NULL al borrar producto
ALTER TABLE shop_order_items
  DROP CONSTRAINT IF EXISTS shop_order_items_product_id_fkey;

ALTER TABLE shop_order_items
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE shop_order_items
  ADD CONSTRAINT shop_order_items_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE SET NULL;

-- shop_stock_transfers: permitir product_id NULL y SET NULL al borrar producto
ALTER TABLE shop_stock_transfers
  DROP CONSTRAINT IF EXISTS shop_stock_transfers_product_id_fkey;

ALTER TABLE shop_stock_transfers
  ALTER COLUMN product_id DROP NOT NULL;

ALTER TABLE shop_stock_transfers
  ADD CONSTRAINT shop_stock_transfers_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES shop_products(id) ON DELETE SET NULL;
