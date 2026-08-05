import { column, Schema, Table } from "@powersync/web";

// Ce schéma est le miroir côté client (SQLite local) du schéma Postgres
// défini dans supabase/migrations/20260804000000_init_schema.sql (§4 du
// PROJECT_PLAN). Toute colonne ajoutée d'un côté doit l'être de l'autre.
//
// Types PowerSync/SQLite disponibles : text, integer, real (pas de type
// booléen/decimal natif : booléens -> integer 0/1, montants -> real,
// dates/horodatages -> text ISO 8601).

const companies = new Table({
  name: column.text,
  currency: column.text,
  created_at: column.text,
});

const users = new Table(
  {
    company_id: column.text,
    name: column.text,
    email: column.text,
    password_hash: column.text,
    role: column.text,
    created_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const boats = new Table(
  {
    company_id: column.text,
    name: column.text,
    registration_number: column.text,
    captain_name: column.text,
    notes: column.text,
    status: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const crew_members = new Table(
  {
    company_id: column.text,
    name: column.text,
    phone: column.text,
    notes: column.text,
    created_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const fish_categories = new Table(
  {
    company_id: column.text,
    name: column.text,
    default_unit: column.text,
    notes: column.text,
    created_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const fish_quality_levels = new Table(
  {
    company_id: column.text,
    fish_category_id: column.text,
    name: column.text,
    default_price: column.real,
    created_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      company: ["company_id"],
      fish_category: ["fish_category_id"],
    },
  },
);

const expense_categories = new Table(
  {
    company_id: column.text,
    name: column.text,
    is_default: column.integer,
    created_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const buyers = new Table(
  {
    company_id: column.text,
    name: column.text,
    phone: column.text,
    notes: column.text,
    created_at: column.text,
    deleted_at: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

const trips = new Table(
  {
    company_id: column.text,
    boat_id: column.text,
    captain_name: column.text,
    departure_date: column.text,
    expected_return_date: column.text,
    actual_return_date: column.text,
    status: column.text,
    crew_payment_method: column.text,
    notes: column.text,
    created_at: column.text,
    updated_at: column.text,
    deleted_at: column.text,
  },
  {
    indexes: {
      company: ["company_id"],
      boat: ["boat_id"],
      boat_status: ["boat_id", "status"],
    },
  },
);

const trip_crew = new Table(
  {
    company_id: column.text,
    trip_id: column.text,
    crew_member_id: column.text,
    payment_type: column.text,
    fixed_amount: column.real,
    percentage: column.real,
    computed_amount: column.real,
  },
  {
    indexes: {
      company: ["company_id"],
      trip: ["trip_id"],
      crew_member: ["crew_member_id"],
    },
  },
);

const expenses = new Table(
  {
    company_id: column.text,
    trip_id: column.text,
    expense_category_id: column.text,
    amount: column.real,
    date: column.text,
    description: column.text,
    photo_url: column.text,
    photo_local_status: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      company: ["company_id"],
      trip: ["trip_id"],
    },
  },
);

const catches = new Table(
  {
    company_id: column.text,
    trip_id: column.text,
    fish_category_id: column.text,
    fish_quality_level_id: column.text,
    quantity: column.real,
    unit: column.text,
    estimated_price: column.real,
    created_at: column.text,
  },
  {
    indexes: {
      company: ["company_id"],
      trip: ["trip_id"],
      trip_fish_quality: ["trip_id", "fish_category_id", "fish_quality_level_id"],
    },
  },
);

const sales = new Table(
  {
    company_id: column.text,
    trip_id: column.text,
    buyer_id: column.text,
    fish_category_id: column.text,
    fish_quality_level_id: column.text,
    quantity: column.real,
    sale_price: column.real,
    total_amount: column.real,
    date: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      company: ["company_id"],
      trip: ["trip_id"],
      buyer: ["buyer_id"],
      trip_fish_quality: ["trip_id", "fish_category_id", "fish_quality_level_id"],
    },
  },
);

const sale_payments = new Table(
  {
    company_id: column.text,
    sale_id: column.text,
    amount: column.real,
    date: column.text,
    notes: column.text,
    created_at: column.text,
  },
  {
    indexes: {
      company: ["company_id"],
      sale: ["sale_id"],
    },
  },
);

const settings = new Table(
  {
    company_id: column.text,
    default_crew_payment_method: column.text,
    currency: column.text,
    language: column.text,
  },
  { indexes: { company: ["company_id"] } },
);

export const AppSchema = new Schema({
  companies,
  users,
  boats,
  crew_members,
  fish_categories,
  fish_quality_levels,
  expense_categories,
  buyers,
  trips,
  trip_crew,
  expenses,
  catches,
  sales,
  sale_payments,
  settings,
});

export type Database = (typeof AppSchema)["types"];
