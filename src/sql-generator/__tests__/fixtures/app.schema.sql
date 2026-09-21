-- Extensions

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;

-- Enums

CREATE TYPE order_status AS ENUM ('PENDING', 'PROCESSING', 'SHIPPED', 'DELIVERED', 'CANCELLED');

CREATE TYPE user_role AS ENUM ('ADMIN', 'USER', 'PUBLIC');

-- Drop tables

DROP TABLE IF EXISTS "user" CASCADE;

DROP TABLE IF EXISTS team_member CASCADE;

DROP TABLE IF EXISTS team CASCADE;

DROP TABLE IF EXISTS profile CASCADE;

DROP TABLE IF EXISTS product_order CASCADE;

DROP TABLE IF EXISTS product CASCADE;

DROP TABLE IF EXISTS "order" CASCADE;

DROP TABLE IF EXISTS note CASCADE;

DROP TABLE IF EXISTS log CASCADE;

DROP TABLE IF EXISTS announcement CASCADE;

-- Create tables

CREATE TABLE announcement (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  team_id UUID NOT NULL,
  message TEXT NOT NULL
);

CREATE TABLE log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  message TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL
);

CREATE TABLE note (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  team_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL
);

CREATE TABLE "order" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID NOT NULL,
  status order_status DEFAULT 'PENDING' NOT NULL,
  total_amount DECIMAL(10, 2) NOT NULL,
  items JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE product (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER NOT NULL,
  category VARCHAR(100) NOT NULL,
  tags TEXT[] NOT NULL,
  metadata JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE product_order (
  id SERIAL NOT NULL,
  order_id UUID NOT NULL,
  product_id UUID NOT NULL,
  quantity INTEGER NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  PRIMARY KEY (order_id, product_id)
);

CREATE TABLE profile (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  user_id UUID UNIQUE NOT NULL,
  bio TEXT NOT NULL,
  avatar VARCHAR(255) NOT NULL,
  location POINT NOT NULL
);

CREATE TABLE team (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  name VARCHAR(100) NOT NULL
);

CREATE TABLE team_member (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  team_id UUID NOT NULL,
  user_id UUID NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL
);

CREATE TABLE "user" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  -- @regex: pattern = '^[\w.-]+@[\w.-]+\.\w+$', message = 'Invalid email address'
  name VARCHAR(150) NOT NULL,
  role user_role DEFAULT 'USER' NOT NULL,
  age SMALLINT,
  -- @range: min = 1, max = 120, message = 'Age must be between 1 and 120'
  balance INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  password_hash VARCHAR(255)
);

-- Create indexes

CREATE INDEX order_user_id_idx ON "order" (user_id);

CREATE INDEX order_status_created_idx ON "order" (status, created_at);

CREATE INDEX team_member_user_id_team_id_idx ON team_member (user_id, team_id);

CREATE INDEX user_role_is_active_idx ON "user" (role, is_active);

CREATE INDEX active_users_name_idx ON "user" USING btree (name) WHERE is_active = true;

CREATE UNIQUE INDEX user_email_idx ON "user" (email) WHERE role = 'PUBLIC';

-- Alter tables (foreign keys)

ALTER TABLE announcement ADD CONSTRAINT announcement_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES team (id)
  ON DELETE CASCADE;

ALTER TABLE note ADD CONSTRAINT note_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES team (id)
  ON DELETE CASCADE;

ALTER TABLE "order" ADD CONSTRAINT order_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user" (id);

ALTER TABLE product_order ADD CONSTRAINT product_order_order_id_fkey
  FOREIGN KEY (order_id) REFERENCES "order" (id);

ALTER TABLE product_order ADD CONSTRAINT product_order_product_id_fkey
  FOREIGN KEY (product_id) REFERENCES product (id);

ALTER TABLE profile ADD CONSTRAINT profile_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user" (id)
  ON DELETE CASCADE
  ON UPDATE SET NULL;

ALTER TABLE team_member ADD CONSTRAINT team_member_team_id_fkey
  FOREIGN KEY (team_id) REFERENCES team (id)
  ON DELETE CASCADE;

ALTER TABLE team_member ADD CONSTRAINT team_member_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES "user" (id)
  ON DELETE CASCADE;

-- Create functions

CREATE OR REPLACE FUNCTION get_user_balance(user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
AS $$
  SELECT balance FROM "user" WHERE id = user_id
$$;

CREATE OR REPLACE FUNCTION search_products(query TEXT)
RETURNS TABLE (id UUID, name TEXT, price DECIMAL)
LANGUAGE sql
STABLE
AS $$
  SELECT id, name, price FROM product
        WHERE name ILIKE '%' || query || '%'
$$;

-- Create triggers

CREATE OR REPLACE FUNCTION product_after_update_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.stock <> NEW.stock) THEN
            INSERT INTO Log (message) VALUES ('Product stock changed');
          END IF;
          RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_after_update_trigger
  AFTER UPDATE ON product
  FOR EACH ROW
  EXECUTE FUNCTION product_after_update_trigger_func();

CREATE OR REPLACE FUNCTION product_before_update_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.price <> NEW.price) THEN
            INSERT INTO Log (message) VALUES ('Product price changed');
          END IF;
          RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER product_before_update_trigger
  BEFORE UPDATE ON product
  FOR EACH ROW
  EXECUTE FUNCTION product_before_update_trigger_func();

CREATE OR REPLACE FUNCTION user_before_update_trigger_func()
RETURNS TRIGGER AS $$
BEGIN
  IF (OLD.balance <> NEW.balance) THEN
            RAISE EXCEPTION 'Balance cannot be updated directly';
          END IF;
          RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER user_before_update_trigger
  BEFORE UPDATE ON "user"
  FOR EACH ROW
  EXECUTE FUNCTION user_before_update_trigger_func();

