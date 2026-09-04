-- Base tables for FoodBoard.
--
-- Ownership and Row Level Security are added by the private-workspaces
-- migration that follows this one; nothing here grants access to anybody.
--
-- Records carry a JSONB "form descriptor" alongside their keys: an array of
-- field definitions with one localised tab per language. The dashboard renders
-- that descriptor directly and the public menu reads translations back out of
-- it. See the data-model note in README.md.

create table if not exists public.users (
    user_id text primary key,
    name text,
    surname text,
    settings jsonb,
    notifications jsonb
);

create table if not exists public.structures (
    structure_id text primary key,
    user_id text references public.users(user_id),
    title text,
    structure jsonb
);

create table if not exists public.lists (
    list_id text primary key,
    structure_id text references public.structures(structure_id),
    title text,
    is_active boolean,
    has_sublists boolean,
    data jsonb
);

-- One row per list, holding that list's categories.
create table if not exists public.categories (
    category_id text primary key,
    list_id text references public.lists(list_id),
    category jsonb
);

-- One row per category, holding that category's dishes and section breaks.
create table if not exists public.products (
    product_id text primary key,
    category_id text references public.categories(category_id),
    product jsonb
);
