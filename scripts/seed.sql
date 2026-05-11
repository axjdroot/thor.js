-- Seed Stores
INSERT INTO stores (id, name, slug, contact_email, created_at, updated_at)
VALUES ('default-store-id', 'Thor Demo Store', 'thor-demo', 'admin@thor.com', 1715264000000, 1715264000000);

-- Seed Categories
INSERT INTO categories (id, store_id, name, slug, position) VALUES
('cat-1', 'default-store-id', 'Electronics', 'electronics', 0),
('cat-2', 'default-store-id', 'Clothing', 'clothing', 1),
('cat-3', 'default-store-id', 'Home & Living', 'home-living', 2),
('cat-4', 'default-store-id', 'Sports', 'sports', 3),
('cat-5', 'default-store-id', 'Books', 'books', 4);

-- Seed Products
INSERT INTO products (id, store_id, name, slug, description, status, created_at, updated_at) VALUES
('prod-1', 'default-store-id', 'Neon T-Shirt', 'neon-t-shirt', 'High-visibility streetwear shirt.', 'active', 1715264000000, 1715264000000),
('prod-2', 'default-store-id', 'Tech Hoodie', 'tech-hoodie', 'Water-resistant techwear hoodie.', 'active', 1715264000000, 1715264000000);

-- Seed Variants
INSERT INTO variants (id, product_id, store_id, sku, title, price, inventory_quantity) VALUES
('var-1', 'prod-1', 'default-store-id', 'NEON-S', 'Small', 2999, 50),
('var-2', 'prod-1', 'default-store-id', 'NEON-M', 'Medium', 2999, 100),
('var-3', 'prod-2', 'default-store-id', 'TECH-H-S', 'Small', 8999, 20);

-- Seed Shipping
INSERT INTO shipping_zones (id, store_id, name, country_codes) VALUES
('zone-us', 'default-store-id', 'Domestic US', '["US"]');

INSERT INTO shipping_rates (id, zone_id, store_id, name, rate_type, rate_value, min_order_amount) VALUES
('rate-us-flat', 'zone-us', 'default-store-id', 'Standard Shipping', 'flat', 599, 0),
('rate-us-free', 'zone-us', 'default-store-id', 'Free Shipping', 'free', 0, 5000);

-- Seed Taxes
INSERT INTO tax_rates (id, store_id, name, country_code, rate) VALUES
('tax-ca', 'default-store-id', 'US-CA', 'US', '0.0725');

-- Seed Discounts
INSERT INTO discounts (id, store_id, code, type, value, is_active) VALUES
('disc-1', 'default-store-id', 'WELCOME10', 'percentage', 10, 1);
