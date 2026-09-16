import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { getSession } from "../replitAuth";
import type { UserAssessmentWithDetails } from "@workspace/db";
import { insertOrderSchema, insertOrderItemSchema, insertUserAssessmentSchema, registerSchema, loginSchema, otpVerificationSchema, adminLoginSchema, userUpdateSchema, passwordResetSchema } from "@workspace/db";
import { z } from "zod/v4";
import PDFDocument from "pdfkit";
import { createHmac, randomBytes } from "crypto";
import { AuthUtils } from "../authUtils";
import { emailService } from "../emailService";
import path from "path";
import fs from "fs";
import express from "express";
import sanitizeHtml from "sanitize-html";
import { pool } from "../db";
import { initializeInstagram, registerInstagramRoutes } from "../instagram";
import { DEFAULT_THERAPY_CATEGORIES, DEFAULT_THERAPY_SERVICES } from "../therapy-seed";
import { DEFAULT_ONSITE_ASSESSMENT_SERVICES } from "../onsite-assessment-seed";
// Using Midtrans payment gateway
import { createMidtransTransaction, handleMidtransCallback, checkTransactionStatus, getMidtransPaymentStatus } from "../midtrans";

type ConsultationType = "child" | "adult" | "family";
type PsychologistOption = {
  name: string;
  types: ConsultationType[];
  prices: Partial<Record<ConsultationType, string>>;
  sipp?: string | null;
  licenseType?: "SIPP" | "SILP" | null;
  description?: string | null;
  details?: string | null;
  profileImageUrl?: string | null;
  signatureUrl?: string | null;
};

const PSYCHOLOGISTS: PsychologistOption[] = [
  {
    name: "Tria Khusni Barokah, M.Psi., Psikolog",
    types: ["child"],
    prices: { child: "300000" },
    sipp: "20230079-2023-01-2583",
    licenseType: "SIPP",
    signatureUrl: "asset:signature-tria.png",
    description: "Saya psikolog yang berpengalaman dalam mendampingi tumbuh kembang anak, penanganan Anak Berkebutuhan Khusus (ABK), serta manajemen emosi dan perilaku. Berpengalaman dalam menangani kasus kecemasan, dampak bullying, serta menyediakan ruang konsultasi parenting yang suportif untuk membantu orang tua mendampingi setiap fase perkembangan anak secara optimal.",
  },
  {
    name: "Retno Rahayu, M.Psi., Psikolog",
    types: ["child", "adult", "family"],
    prices: { child: "300000", adult: "200000", family: "200000" },
    sipp: "20191360-2022-01-2917",
    licenseType: "SIPP",
    signatureUrl: "asset:signature-retno.png",
    description: "Saya psikolog yang berpengalaman dalam menangani problem seputar perkembangan anak (autisme, ADHD, gangguan belajar, bullying) serta isu kesehatan mental remaja dan dewasa (kecemasan, depresi, stres, trauma), adiksi, masalah relasi, keluarga/parenting.",
  },
  {
    name: "Dr. Yeni Triwahyuningsih, S.Psi., MM., Psikolog",
    types: ["child", "adult", "family"],
    prices: { child: "300000", adult: "300000", family: "200000" },
    sipp: "19930009-2025-03-1359",
    licenseType: "SIPP",
    signatureUrl: "asset:signature-yeni.png",
    description: "Saya merupakan Psikolog Klinis dan Neuropsikolog yang berpengalaman dalam menangani kasus perkembangan anak (ADHD, autisme, dan gangguan belajar), serta berbagai permasalahan pada dewasa dan keluarga, seperti konflik pengasuhan, trauma, adiksi, dan masalah relasi. Bersertifikat ABA, TEACCH, Brain training, CBT, DBT, Mindfulness, Clinical Hypnotherapy, Brainspotting, PoV, Braingym, dan Touch for Health dll untuk mendukung layanan psikologis yang komprehensif dan berpusat pada kebutuhan klien.",
  },
  {
    name: "Ridwan Rahmawan, S.Psi., M.H., Psikolog",
    types: ["adult"],
    prices: { adult: "200000" },
    sipp: "397259DD89DA",
    licenseType: "SILP",
    signatureUrl: "asset:signature-ridwan.png",
    description: "Saya psikolog yang berpengalaman dalam mendampingi berbagai permasalahan psikologis pada rentang usia remaja hingga lansia, mulai dari kecemasan, stres, masalah emosi, kepercayaan diri, relasi keluarga, hubungan sosial, penyesuaian diri, kebingungan arah hidup, masalah akademik atau pekerjaan, hingga perasaan kesepian dan perubahan hidup pada usia lanjut.",
  },
];

function getPsychologistFee(psychologist: PsychologistOption, consultationType: ConsultationType) {
  return psychologist.prices[consultationType] ?? "200000";
}

function normalizePsychologistTypes(value?: string[] | null): ConsultationType[] {
  const types = (value ?? []).filter((type): type is ConsultationType => type === "child" || type === "adult" || type === "family");
  return types.length ? types : ["child", "adult", "family"];
}

async function getPsychologistOptions() {
  const users = await storage.getAllUsers();
  const associatePsychologists = users
    .filter((user) => user.role === "psychologist" && user.isActive)
    .map((user) => ({
      name: user.psychologistProfileName || getDisplayName(user),
      types: normalizePsychologistTypes(user.psychologistConsultationTypes),
      prices: {
        child: user.psychologistChildPrice || "300000",
        adult: user.psychologistAdultPrice || "200000",
        family: user.psychologistFamilyPrice || "200000",
      },
      sipp: user.psychologistSipp,
      licenseType: user.psychologistLicenseType === "SILP" ? "SILP" as const : user.psychologistLicenseType === "SIPP" ? "SIPP" as const : null,
      description: user.psychologistDescription,
      details: user.psychologistDetails,
      profileImageUrl: user.profileImageUrl,
      signatureUrl: user.psychologistSignatureUrl,
    }))
    .filter((psychologist) => psychologist.name.trim().length > 0);

  const byName = new Map<string, PsychologistOption>();
  [...PSYCHOLOGISTS, ...associatePsychologists].forEach((psychologist) => {
    const existing = byName.get(psychologist.name);
    byName.set(psychologist.name, existing ? {
      ...existing,
      ...psychologist,
      sipp: psychologist.sipp || existing.sipp,
      licenseType: psychologist.licenseType || existing.licenseType,
      description: psychologist.description || existing.description,
      details: psychologist.details || existing.details,
      profileImageUrl: psychologist.profileImageUrl || existing.profileImageUrl,
      signatureUrl: psychologist.signatureUrl || existing.signatureUrl,
    } : psychologist);
  });
  return Array.from(byName.values());
}

async function getPsychologistOption(name: string) {
  return (await getPsychologistOptions()).find((psychologist) => psychologist.name === name);
}

function canManageBookingsRole(role?: string | null) {
  return role === "admin" || role === "internal" || role === "cso";
}

function canManagePsychologistSchedulesRole(role?: string | null) {
  return role === "admin";
}

function canAccessPsychologistAreaRole(role?: string | null) {
  return role === "psychologist" || canManageBookingsRole(role);
}

const TIME_SLOTS = ["08.00 - 10.00", "10.30 - 12.30", "13.30 - 15.30"] as const;
const TIME_SLOT_PATTERN = /^([01]\d|2[0-1])[.:][0-5]\d\s*-\s*([01]\d|2[0-1])[.:][0-5]\d$/;
const SCHEDULE_WINDOW_DAYS = 30;
const PAYMENT_EXPIRY_MINUTES = 15;
const DASS_DEPRESSION_ITEMS = [3, 5, 10, 13, 16, 17, 21, 24, 26, 31, 34, 37, 38, 42] as const;
const DASS_ANXIETY_ITEMS = [2, 4, 7, 9, 15, 19, 20, 23, 25, 28, 30, 36, 40, 41] as const;
const DASS_STRESS_ITEMS = [1, 6, 8, 11, 12, 14, 18, 22, 27, 29, 32, 33, 35, 39] as const;
const DASS_QUESTIONS = [
  "Saya merasa bahwa diri saya menjadi marah karena hal-hal sepele.",
  "Saya merasa bibir saya sering kering.",
  "Saya sama sekali tidak dapat merasakan perasaan positif.",
  "Saya mengalami kesulitan bernapas (misalnya sering terengah-engah atau tidak dapat bernapas padahal tidak melakukan aktivitas fisik sebelumnya).",
  "Saya sepertinya tidak kuat lagi untuk melakukan suatu kegiatan.",
  "Saya cenderung bereaksi berlebihan terhadap suatu situasi.",
  "Saya merasa goyah (misalnya kaki terasa mau 'copot').",
  "Saya merasa sulit untuk bersantai.",
  "Saya menemukan diri saya berada dalam situasi yang membuat saya merasa sangat cemas dan saya akan merasa sangat lega jika semua ini berakhir.",
  "Saya merasa tidak ada hal yang dapat diharapkan di masa depan.",
  "Saya menemukan diri saya mudah merasa kesal.",
  "Saya merasa telah menghabiskan banyak energi untuk merasa cemas.",
  "Saya merasa sedih dan tertekan.",
  "Saya menemukan diri saya menjadi tidak sabar ketika mengalami penundaan (misalnya kemacetan lalu lintas atau menunggu sesuatu).",
  "Saya merasa lemas seperti mau pingsan.",
  "Saya merasa saya kehilangan minat akan segala hal.",
  "Saya merasa bahwa saya tidak berharga sebagai seorang manusia.",
  "Saya merasa bahwa saya sangat mudah tersinggung.",
  "Saya berkeringat secara berlebihan (misalnya tangan berkeringat), padahal temperatur tidak panas atau tidak melakukan aktivitas fisik sebelumnya.",
  "Saya merasa takut tanpa alasan yang jelas.",
  "Saya merasa bahwa hidup tidak bermanfaat.",
  "Saya merasa sulit untuk beristirahat.",
  "Saya mengalami kesulitan dalam menelan.",
  "Saya tidak dapat merasakan kenikmatan dari berbagai hal yang saya lakukan.",
  "Saya menyadari kegiatan jantung, walaupun saya tidak sehabis melakukan aktivitas fisik (misalnya merasa detak jantung meningkat atau melemah).",
  "Saya merasa putus asa dan sedih.",
  "Saya merasa bahwa saya sangat mudah marah.",
  "Saya merasa saya hampir panik.",
  "Saya merasa sulit untuk tenang setelah sesuatu membuat saya kesal.",
  "Saya takut bahwa saya akan 'terhambat' oleh tugas-tugas sepele yang tidak biasa saya lakukan.",
  "Saya tidak merasa antusias dalam hal apa pun.",
  "Saya sulit untuk sabar dalam menghadapi gangguan terhadap hal yang sedang saya lakukan.",
  "Saya sedang merasa gelisah.",
  "Saya merasa bahwa saya tidak berharga.",
  "Saya tidak dapat memaklumi hal apa pun yang menghalangi saya untuk menyelesaikan hal yang sedang saya lakukan.",
  "Saya merasa sangat ketakutan.",
  "Saya melihat tidak ada harapan untuk masa depan.",
  "Saya merasa bahwa hidup tidak berarti.",
  "Saya menemukan diri saya mudah gelisah.",
  "Saya merasa khawatir dengan situasi di mana saya mungkin menjadi panik dan mempermalukan diri sendiri.",
  "Saya merasa gemetar (misalnya pada tangan).",
  "Saya merasa sulit untuk meningkatkan inisiatif dalam melakukan sesuatu.",
] as const;
const DASS_RESPONSE_LABELS = [
  "Tidak sesuai dengan saya sama sekali, atau tidak pernah.",
  "Sesuai dengan saya sampai tingkat tertentu, atau kadang-kadang.",
  "Sesuai dengan saya sampai batas yang dapat dipertimbangkan, atau lumayan sering.",
  "Sangat sesuai dengan saya, atau sering sekali.",
] as const;

const dassSubmissionSchema = z.object({
  orderId: z.number().int().positive(),
  answers: z.array(z.number().int().min(0).max(3)).length(42),
});

const srqSubmissionSchema = z.object({
  orderId: z.number().int().positive(),
  answers: z.array(z.boolean()).length(29),
});

function sumDassItems(answers: number[], items: readonly number[]) {
  return items.reduce((total, itemNumber) => total + answers[itemNumber - 1], 0);
}

function canManageExternalAssessmentsRole(role?: string | null) {
  return role === "admin" || role === "internal" || role === "cso";
}

function canManageDigitalProductsRole(role?: string | null) {
  return role === "admin" || role === "internal";
}

function canManageTrainingsRole(role?: string | null) {
  return role === "admin" || role === "internal";
}

async function ensureTrainingInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS training_page_settings (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      hero_image bytea,
      hero_file_name varchar(255),
      hero_mime_type varchar(100),
      hero_focus_x smallint NOT NULL DEFAULT 50,
      hero_focus_y smallint NOT NULL DEFAULT 50,
      updated_by varchar REFERENCES users(id),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT training_page_hero_focus_check CHECK (hero_focus_x BETWEEN 0 AND 100 AND hero_focus_y BETWEEN 0 AND 100)
    );
    INSERT INTO training_page_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
    ALTER TABLE training_page_settings
      ADD COLUMN IF NOT EXISTS testimonial_background bytea,
      ADD COLUMN IF NOT EXISTS testimonial_background_file_name varchar(255),
      ADD COLUMN IF NOT EXISTS testimonial_background_mime_type varchar(100),
      ADD COLUMN IF NOT EXISTS testimonial_background_focus_x smallint NOT NULL DEFAULT 50,
      ADD COLUMN IF NOT EXISTS testimonial_background_focus_y smallint NOT NULL DEFAULT 50,
      ADD COLUMN IF NOT EXISTS testimonial_instagram_url varchar(1000);
    CREATE TABLE IF NOT EXISTS trainings (
      id serial PRIMARY KEY,
      slug varchar(255) NOT NULL UNIQUE,
      title varchar(255) NOT NULL,
      summary varchar(1000) NOT NULL,
      description text NOT NULL,
      starts_at timestamp,
      ends_at timestamp,
      location varchar(500),
      registration_deadline timestamp,
      sort_order integer NOT NULL DEFAULT 0,
      status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'closed', 'completed')),
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp
    );
    ALTER TABLE trainings ADD COLUMN IF NOT EXISTS description_html text;
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trainings_status_check'
          AND conrelid = 'trainings'::regclass
          AND POSITION('completed' IN pg_get_constraintdef(oid)) = 0
      ) THEN
        ALTER TABLE trainings DROP CONSTRAINT trainings_status_check;
      END IF;
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'trainings_status_check'
          AND conrelid = 'trainings'::regclass
      ) THEN
        ALTER TABLE trainings ADD CONSTRAINT trainings_status_check
          CHECK (status IN ('draft', 'published', 'closed', 'completed'));
      END IF;
    END $$;
    CREATE INDEX IF NOT EXISTS trainings_public_idx ON trainings(status, sort_order, starts_at);
    CREATE TABLE IF NOT EXISTS training_posters (
      id serial PRIMARY KEY,
      training_id integer NOT NULL UNIQUE REFERENCES trainings(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT training_posters_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS training_description_images (
      id serial PRIMARY KEY,
      training_id integer NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS training_description_images_training_idx ON training_description_images(training_id, id);
    CREATE TABLE IF NOT EXISTS training_options (
      id serial PRIMARY KEY,
      training_id integer NOT NULL REFERENCES trainings(id) ON DELETE CASCADE,
      name varchar(255) NOT NULL,
      description varchar(1000),
      price numeric(10,2) NOT NULL CHECK (price >= 0),
      capacity integer CHECK (capacity IS NULL OR capacity > 0),
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS training_options_training_idx ON training_options(training_id, is_active, sort_order);
    CREATE TABLE IF NOT EXISTS training_registrations (
      id serial PRIMARY KEY,
      order_id integer NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
      user_id varchar NOT NULL REFERENCES users(id),
      training_id integer NOT NULL REFERENCES trainings(id),
      option_id integer NOT NULL REFERENCES training_options(id),
      training_title varchar(255) NOT NULL,
      option_name varchar(255) NOT NULL,
      price numeric(10,2) NOT NULL,
      full_name varchar(255) NOT NULL,
      birth_date varchar(20) NOT NULL,
      gender varchar(30) NOT NULL,
      address text NOT NULL,
      whatsapp_number varchar(50) NOT NULL,
      email varchar(255) NOT NULL,
      education varchar(255) NOT NULL,
      occupation varchar(255) NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'pending_payment',
      payment_status varchar(30) NOT NULL DEFAULT 'pending',
      admin_notes text,
      paid_at timestamp,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS training_registrations_user_idx ON training_registrations(user_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS training_registrations_training_idx ON training_registrations(training_id, option_id, payment_status);
    CREATE TABLE IF NOT EXISTS training_testimonials (
      id serial PRIMARY KEY,
      name varchar(255) NOT NULL,
      occupation varchar(255),
      training_name varchar(255),
      testimonial text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS training_gallery_images (
      id serial PRIMARY KEY,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      title varchar(255),
      caption varchar(1000),
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT training_gallery_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE INDEX IF NOT EXISTS training_gallery_public_idx ON training_gallery_images(is_active, sort_order, id);
  `);
}

async function ensureDigitalProductInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS digital_products (
      id serial PRIMARY KEY,
      slug varchar(255) NOT NULL UNIQUE,
      name varchar(255) NOT NULL,
      short_description varchar(500) NOT NULL,
      description text NOT NULL,
      description_html text,
      price numeric(10,2) NOT NULL CHECK (price >= 0),
      promo_price numeric(10,2),
      is_active boolean NOT NULL DEFAULT true,
      delivery_file bytea,
      delivery_file_name varchar(255),
      delivery_mime_type varchar(150),
      delivery_file_size integer,
      delivery_url varchar(2000),
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS digital_product_images (
      id serial PRIMARY KEY,
      product_id integer NOT NULL REFERENCES digital_products(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      created_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS digital_product_images_product_idx
      ON digital_product_images(product_id, sort_order, id);
    CREATE TABLE IF NOT EXISTS digital_product_external_media (
      id serial PRIMARY KEY,
      product_id integer NOT NULL REFERENCES digital_products(id) ON DELETE CASCADE,
      title varchar(255) NOT NULL,
      url varchar(2000) NOT NULL,
      media_type varchar(30) NOT NULL DEFAULT 'video',
      platform varchar(50) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CHECK (media_type IN ('video', 'documentation'))
    );
    CREATE INDEX IF NOT EXISTS digital_product_external_media_product_idx
      ON digital_product_external_media(product_id, sort_order, id);
    CREATE TABLE IF NOT EXISTS digital_order_items (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id integer NOT NULL REFERENCES digital_products(id),
      product_name varchar(255) NOT NULL,
      price numeric(10,2) NOT NULL,
      created_at timestamp DEFAULT now(),
      UNIQUE(order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS digital_order_items_order_idx ON digital_order_items(order_id);
    CREATE TABLE IF NOT EXISTS digital_order_customer_info (
      order_id integer PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      full_name varchar(255) NOT NULL,
      email varchar(255) NOT NULL,
      phone varchar(50) NOT NULL,
      notes text,
      created_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS digital_product_access_logs (
      id serial PRIMARY KEY,
      user_id varchar NOT NULL REFERENCES users(id),
      product_id integer NOT NULL REFERENCES digital_products(id),
      order_id integer NOT NULL REFERENCES orders(id),
      access_type varchar(30) NOT NULL,
      accessed_at timestamp DEFAULT now()
    );
    ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS promo_price numeric(10,2);
    ALTER TABLE digital_products ADD COLUMN IF NOT EXISTS description_html text;
    ALTER TABLE digital_product_images ADD COLUMN IF NOT EXISTS focus_x smallint NOT NULL DEFAULT 50;
    ALTER TABLE digital_product_images ADD COLUMN IF NOT EXISTS focus_y smallint NOT NULL DEFAULT 50;
    UPDATE digital_products SET promo_price = NULL
      WHERE promo_price IS NOT NULL AND (promo_price < 0 OR promo_price >= price);
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'digital_products_promo_price_check'
      ) THEN
        ALTER TABLE digital_products ADD CONSTRAINT digital_products_promo_price_check
          CHECK (promo_price IS NULL OR (promo_price >= 0 AND promo_price < price));
      END IF;
    END $$;
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'digital_product_images_focus_check'
      ) THEN
        ALTER TABLE digital_product_images ADD CONSTRAINT digital_product_images_focus_check
          CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100);
      END IF;
    END $$;
  `);
}

async function ensurePhysicalProductInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS physical_products (
      id serial PRIMARY KEY, slug varchar(255) NOT NULL UNIQUE, name varchar(255) NOT NULL,
      short_description varchar(500) NOT NULL, description text NOT NULL, description_html text,
      sku varchar(100) NOT NULL UNIQUE, price numeric(12,2) NOT NULL CHECK (price >= 0),
      promo_price numeric(12,2), stock integer NOT NULL DEFAULT 0 CHECK (stock >= 0),
      low_stock_threshold integer NOT NULL DEFAULT 0 CHECK (low_stock_threshold >= 0),
      weight_grams integer NOT NULL DEFAULT 0 CHECK (weight_grams >= 0),
      shipping_fee numeric(12,2) NOT NULL DEFAULT 0 CHECK (shipping_fee >= 0),
      is_active boolean NOT NULL DEFAULT true, created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
      CHECK (promo_price IS NULL OR (promo_price >= 0 AND promo_price < price))
    );
    CREATE TABLE IF NOT EXISTS physical_product_images (
      id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES physical_products(id) ON DELETE CASCADE,
      image_data bytea NOT NULL, file_name varchar(255) NOT NULL, mime_type varchar(100) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0, focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50, created_at timestamp DEFAULT now(),
      CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE INDEX IF NOT EXISTS physical_product_images_product_idx ON physical_product_images(product_id, sort_order, id);
    CREATE TABLE IF NOT EXISTS physical_product_external_media (
      id serial PRIMARY KEY, product_id integer NOT NULL REFERENCES physical_products(id) ON DELETE CASCADE,
      title varchar(255) NOT NULL, url varchar(2000) NOT NULL, media_type varchar(30) NOT NULL DEFAULT 'video',
      platform varchar(50) NOT NULL, sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
      created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
      CHECK (media_type IN ('video', 'documentation'))
    );
    CREATE INDEX IF NOT EXISTS physical_product_external_media_product_idx ON physical_product_external_media(product_id, sort_order, id);
    CREATE TABLE IF NOT EXISTS physical_order_items (
      id serial PRIMARY KEY, order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      product_id integer NOT NULL REFERENCES physical_products(id), product_name varchar(255) NOT NULL,
      sku varchar(100) NOT NULL, unit_price numeric(12,2) NOT NULL, quantity integer NOT NULL CHECK (quantity > 0),
      created_at timestamp DEFAULT now(), UNIQUE(order_id, product_id)
    );
    CREATE INDEX IF NOT EXISTS physical_order_items_order_idx ON physical_order_items(order_id);
    CREATE TABLE IF NOT EXISTS physical_order_shipping (
      order_id integer PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      recipient_name varchar(255) NOT NULL, email varchar(255) NOT NULL, phone varchar(50) NOT NULL,
      address text NOT NULL, district varchar(150) NOT NULL, city varchar(150) NOT NULL,
      province varchar(150) NOT NULL, postal_code varchar(10) NOT NULL, notes text,
      shipping_fee numeric(12,2) NOT NULL DEFAULT 0, fulfillment_status varchar(30) NOT NULL DEFAULT 'awaiting_payment',
      courier varchar(100), tracking_number varchar(255), tracking_url varchar(2000),
      stock_status varchar(20) NOT NULL DEFAULT 'reserved', reservation_expires_at timestamp NOT NULL,
      shipped_at timestamp, completed_at timestamp, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(),
      CHECK (fulfillment_status IN ('awaiting_payment','paid','processing','shipped','completed','cancelled')),
      CHECK (stock_status IN ('reserved','committed','released'))
    );
  `);
}

async function releasePhysicalOrderStock(orderId: number) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const reservation = await client.query(
      `SELECT order_id FROM physical_order_shipping WHERE order_id = $1 AND stock_status = 'reserved' FOR UPDATE`,
      [orderId],
    );
    if (reservation.rowCount) {
      const items = await client.query(`SELECT product_id, quantity FROM physical_order_items WHERE order_id = $1`, [orderId]);
      for (const item of items.rows) await client.query(`UPDATE physical_products SET stock = stock + $1, updated_at = now() WHERE id = $2`, [item.quantity, item.product_id]);
      await client.query(`UPDATE physical_order_shipping SET stock_status = 'released', fulfillment_status = 'cancelled', updated_at = now() WHERE order_id = $1`, [orderId]);
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function releaseExpiredPhysicalReservations() {
  const result = await pool.query(
    `SELECT shipping.order_id FROM physical_order_shipping shipping
     JOIN orders order_record ON order_record.id = shipping.order_id
     WHERE shipping.stock_status = 'reserved' AND shipping.reservation_expires_at <= now()
       AND order_record.payment_status <> 'paid'`,
  );
  for (const row of result.rows) await releasePhysicalOrderStock(row.order_id);
}

const DEFAULT_COURSES = [
  { slug: "balet", title: "Balet", price: "Mulai Rp 325.000/bulan", description: "Kelas balet membantu anak mengembangkan kelenturan, koordinasi gerak, keseimbangan motorik, disiplin, fokus, dan rasa percaya diri. Program bekerja sama dengan Flores Balet dengan pengajar bersertifikasi RAD.", details: ["Kurikulum RAD London", "4 kali pertemuan", "Free trial 1 kali", "Tersedia 7 klasifikasi kelompok", "Mulai usia 3 tahun (baby class)"], specialNote: null, sortOrder: 1 },
  { slug: "taekwondo", title: "Taekwondo", price: "Rp 250.000/bulan", description: "Kursus taekwondo melatih kekuatan fisik, ketahanan tubuh, dan kemampuan bela diri dasar. Anak juga belajar disiplin, tanggung jawab, pengendalian diri, serta membangun kepercayaan diri dan karakter positif.", details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"], specialNote: null, sortOrder: 2 },
  { slug: "renang-privat", title: "Renang Privat", price: "Rp 300.000/bulan", description: "Kursus renang membantu anak mempelajari teknik dasar berenang sekaligus meningkatkan kemampuan motorik dan koordinasi tubuh. Pembelajaran dilakukan secara aman dan bertahap sesuai usia serta kemampuan anak.", details: ["4 kali pertemuan", "Mulai usia 3 tahun"], specialNote: "Khusus tersedia di Pelangi Indonesia Cabang Bantul", sortOrder: 3 },
  { slug: "musik-privat", title: "Musik Privat", price: "Mulai Rp 390.000/bulan", description: "Kursus musik mendukung kreativitas, konsentrasi, dan kemampuan anak mengekspresikan diri melalui seni. Anak mempelajari nada, ritme, dan teknik dasar musik sesuai minat dan usianya.", details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"], specialNote: null, sortOrder: 4 },
  { slug: "tari", title: "Tari", price: "Rp 250.000/bulan", description: "Kursus tari membantu anak mengeksplorasi gerak, irama, dan ekspresi diri secara menyenangkan. Program ini mendukung rasa percaya diri, kerja sama, kreativitas, perkembangan motorik, dan koordinasi tubuh.", details: ["4 kali pertemuan", "Free trial 1 kali", "Mulai usia 3 tahun"], specialNote: null, sortOrder: 5 },
  { slug: "bimbingan-belajar-privat", title: "Bimbingan Belajar Privat", price: "Rp 250.000/bulan", description: "Program bimbingan belajar privat memberikan pendampingan sesuai kebutuhan akademik anak. Perhatian yang lebih terfokus membantu proses belajar menjadi lebih optimal dan terarah.", details: ["4 kali pertemuan", "Tersedia home visit atau belajar onsite di Pelangi Indonesia"], specialNote: null, sortOrder: 6 },
  { slug: "baca-tulis", title: "Baca Tulis", price: "Rp 325.000/bulan", description: "Program baca tulis dirancang untuk membantu anak mengembangkan kemampuan dasar literasi, mulai dari mengenal huruf, membaca, menulis, hingga memahami kalimat sederhana. Pembelajaran dilakukan secara interaktif dan menyenangkan sesuai tahap perkembangan anak.", details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali", "Modul disusun oleh tim Pelangi Indonesia dan telah digunakan kurang lebih 15 tahun"], specialNote: null, sortOrder: 7 },
  { slug: "matematika", title: "Matematika", price: "Rp 325.000/bulan", description: "Kursus matematika membantu peserta memahami konsep berhitung, logika, dan pemecahan masalah dengan metode yang mudah dipahami. Materi disesuaikan dengan usia dan tingkat kemampuan anak agar proses belajar lebih efektif.", details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali"], specialNote: null, sortOrder: 8 },
  { slug: "sempoa", title: "Sempoa", price: "Rp 275.000/bulan", description: "Kursus sempoa membantu melatih kemampuan berhitung cepat, konsentrasi, dan daya ingat anak melalui metode visual dan motorik. Latihan dilakukan secara bertahap agar anak mampu menghitung dengan cepat dan tepat.", details: ["8 kali pertemuan", "Maksimal 6 anak per kelas", "Free trial 1 kali"], specialNote: null, sortOrder: 9 },
] as const;

async function ensureCourseInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS courses (
      id serial PRIMARY KEY,
      slug varchar(255) NOT NULL UNIQUE,
      title varchar(255) NOT NULL,
      price varchar(100) NOT NULL,
      description text NOT NULL,
      details jsonb NOT NULL DEFAULT '[]'::jsonb,
      special_note text,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS course_images (
      id serial PRIMARY KEY,
      course_id integer NOT NULL UNIQUE REFERENCES courses(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT course_images_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS course_gallery_images (
      id serial PRIMARY KEY,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      title varchar(255),
      caption varchar(1000),
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT course_gallery_images_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE INDEX IF NOT EXISTS courses_catalog_idx ON courses(is_active, sort_order, id);
    CREATE INDEX IF NOT EXISTS course_gallery_catalog_idx ON course_gallery_images(is_active, sort_order, id);
  `);

  for (const course of DEFAULT_COURSES) {
    await pool.query(
      `INSERT INTO courses (slug, title, price, description, details, special_note, sort_order)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7)
       ON CONFLICT (slug) DO NOTHING`,
      [course.slug, course.title, course.price, course.description, JSON.stringify(course.details), course.specialNote, course.sortOrder],
    );
  }
}

async function ensureTherapyGalleryInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS therapy_categories (
      id serial PRIMARY KEY, slug varchar(150) NOT NULL UNIQUE,
      kind varchar(30) NOT NULL DEFAULT 'general' CHECK (kind IN ('development', 'psychotherapy', 'general')),
      title varchar(255) NOT NULL, description text NOT NULL, introduction text, availability varchar(500),
      summary_items jsonb NOT NULL DEFAULT '[]'::jsonb, theme varchar(30) NOT NULL DEFAULT 'green',
      sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
      hero_image_data bytea, hero_file_name varchar(255), hero_mime_type varchar(100),
      hero_focus_x smallint NOT NULL DEFAULT 50, hero_focus_y smallint NOT NULL DEFAULT 50,
      created_by varchar REFERENCES users(id), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp,
      CONSTRAINT therapy_categories_focus_check CHECK (hero_focus_x BETWEEN 0 AND 100 AND hero_focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS therapy_services (
      id serial PRIMARY KEY, category_id integer NOT NULL REFERENCES therapy_categories(id),
      slug varchar(150) NOT NULL, title varchar(255) NOT NULL, price varchar(100), description text NOT NULL,
      full_description text, focus_text text, target_text text,
      benefits jsonb NOT NULL DEFAULT '[]'::jsonb, conditions jsonb NOT NULL DEFAULT '[]'::jsonb, sections jsonb NOT NULL DEFAULT '[]'::jsonb,
      sort_order integer NOT NULL DEFAULT 0, is_active boolean NOT NULL DEFAULT true,
      image_data bytea, image_file_name varchar(255), image_mime_type varchar(100), image_focus_x smallint NOT NULL DEFAULT 50, image_focus_y smallint NOT NULL DEFAULT 50,
      created_by varchar REFERENCES users(id), created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), deleted_at timestamp,
      UNIQUE(category_id, slug), CONSTRAINT therapy_services_focus_check CHECK (image_focus_x BETWEEN 0 AND 100 AND image_focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS therapy_gallery_images (
      id serial PRIMARY KEY,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      title varchar(255),
      caption varchar(1000),
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT therapy_gallery_images_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    ALTER TABLE therapy_gallery_images ADD COLUMN IF NOT EXISTS category_id integer REFERENCES therapy_categories(id) ON DELETE SET NULL;
    CREATE INDEX IF NOT EXISTS therapy_categories_catalog_idx ON therapy_categories(is_active, sort_order, id);
    CREATE INDEX IF NOT EXISTS therapy_services_catalog_idx ON therapy_services(category_id, is_active, sort_order, id);
    CREATE INDEX IF NOT EXISTS therapy_gallery_catalog_idx ON therapy_gallery_images(is_active, sort_order, id);
  `);

  for (const category of DEFAULT_THERAPY_CATEGORIES) {
    await pool.query(
      `INSERT INTO therapy_categories (slug, kind, title, description, introduction, availability, summary_items, theme, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9) ON CONFLICT (slug) DO NOTHING`,
      [category.slug, category.kind, category.title, category.description, category.introduction, category.availability, JSON.stringify(category.summaryItems), category.theme, category.sortOrder],
    );
  }
  for (const service of DEFAULT_THERAPY_SERVICES) {
    await pool.query(
      `INSERT INTO therapy_services (category_id, slug, title, price, description, full_description, focus_text, target_text, benefits, conditions, sections, sort_order)
       SELECT id,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12 FROM therapy_categories WHERE slug = $1
       ON CONFLICT (category_id, slug) DO NOTHING`,
      [service.categorySlug, service.slug, service.title, service.price, service.description, service.fullDescription, service.focus, service.target,
        JSON.stringify(service.benefits), JSON.stringify(service.conditions), JSON.stringify(service.sections), service.sortOrder],
    );
  }
}

async function ensureOnsiteAssessmentInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS onsite_assessment_services (
      id serial PRIMARY KEY,
      slug varchar(180) NOT NULL UNIQUE,
      title varchar(255) NOT NULL,
      description text NOT NULL,
      result_text text,
      target_text text,
      price integer NOT NULL DEFAULT 0 CHECK (price >= 0),
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      image_data bytea,
      image_file_name varchar(255),
      image_mime_type varchar(100),
      image_focus_x smallint NOT NULL DEFAULT 50,
      image_focus_y smallint NOT NULL DEFAULT 50,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp,
      CONSTRAINT onsite_assessment_services_focus_check CHECK (image_focus_x BETWEEN 0 AND 100 AND image_focus_y BETWEEN 0 AND 100)
    );
    ALTER TABLE onsite_assessment_services ADD COLUMN IF NOT EXISTS result_text text;
    ALTER TABLE onsite_assessment_services ADD COLUMN IF NOT EXISTS target_text text;
    CREATE INDEX IF NOT EXISTS onsite_assessment_services_catalog_idx ON onsite_assessment_services(is_active, sort_order, id);
  `);
  for (const service of DEFAULT_ONSITE_ASSESSMENT_SERVICES) {
    await pool.query(
      `INSERT INTO onsite_assessment_services (slug,title,description,price,sort_order)
       VALUES ($1,$2,$3,$4,$5) ON CONFLICT (slug) DO NOTHING`,
      [service.slug, service.title, service.description, service.price, service.sortOrder],
    );
  }
}

async function ensurePsychologyTestToolInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS psychology_test_tools (
      id serial PRIMARY KEY,
      slug varchar(255) NOT NULL UNIQUE,
      category varchar(50) NOT NULL,
      title varchar(255) NOT NULL,
      description varchar(1000) NOT NULL,
      detail_text text NOT NULL,
      result_text text,
      target_text text,
      price numeric(12,2) NOT NULL CHECK (price >= 0),
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      image_data bytea,
      image_file_name varchar(255),
      image_mime_type varchar(100),
      image_focus_x smallint NOT NULL DEFAULT 50,
      image_focus_y smallint NOT NULL DEFAULT 50,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp,
      CHECK (category IN ('kognitif','perkembangan','klinis','inventori-kepribadian')),
      CHECK (image_focus_x BETWEEN 0 AND 100 AND image_focus_y BETWEEN 0 AND 100)
    );
    CREATE INDEX IF NOT EXISTS psychology_test_tools_catalog_idx
      ON psychology_test_tools(category, is_active, sort_order, id) WHERE deleted_at IS NULL;
  `);
}

async function ensureWebsiteAnalyticsInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS website_analytics_events (
      id bigserial PRIMARY KEY,
      occurred_at timestamptz NOT NULL DEFAULT now(),
      visitor_hash varchar(64) NOT NULL,
      session_id varchar(64) NOT NULL,
      event_type varchar(40) NOT NULL CHECK (event_type IN ('page_view','content_view','cta_click','checkout_start')),
      page_path varchar(500) NOT NULL,
      content_type varchar(50),
      content_slug varchar(255),
      cta_type varchar(50),
      source varchar(100),
      medium varchar(100),
      campaign varchar(150),
      referrer_host varchar(255),
      device_type varchar(20) NOT NULL CHECK (device_type IN ('desktop','tablet','mobile','unknown')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS website_analytics_events_date_idx ON website_analytics_events(occurred_at);
    CREATE INDEX IF NOT EXISTS website_analytics_events_content_idx ON website_analytics_events(content_type,content_slug,occurred_at);
    CREATE INDEX IF NOT EXISTS website_analytics_events_type_idx ON website_analytics_events(event_type,occurred_at);
    CREATE TABLE IF NOT EXISTS website_checkout_attempts (
      order_id integer PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
      checkout_type varchar(30) NOT NULL CHECK (checkout_type IN ('assessment','counseling','digital_product','physical_product','training')),
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS website_checkout_attempts_date_idx ON website_checkout_attempts(created_at);
  `);
  await pool.query(`DELETE FROM website_analytics_events WHERE occurred_at < now() - interval '90 days'`);
}

async function recordWebsiteCheckout(orderId: number, checkoutType: 'assessment' | 'counseling' | 'digital_product' | 'physical_product' | 'training') {
  try {
    await pool.query(
      `INSERT INTO website_checkout_attempts (order_id,checkout_type) VALUES ($1,$2) ON CONFLICT (order_id) DO NOTHING`,
      [orderId, checkoutType],
    );
  } catch (error) {
    // Analytics must never prevent a customer order from completing.
    console.error('Error recording website checkout:', error);
  }
}

async function ensureArticleInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS managed_articles (
      id serial PRIMARY KEY,
      slug varchar(255) NOT NULL UNIQUE,
      title varchar(255) NOT NULL,
      excerpt varchar(1000) NOT NULL,
      content text NOT NULL,
      category varchar(100) NOT NULL DEFAULT 'berita',
      author_name varchar(255),
      status varchar(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
      published_at timestamp,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp
    );
    CREATE TABLE IF NOT EXISTS article_categories (
      id serial PRIMARY KEY,
      slug varchar(100) NOT NULL UNIQUE,
      name varchar(255) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp
    );
    CREATE TABLE IF NOT EXISTS managed_article_images (
      id serial PRIMARY KEY,
      article_id integer NOT NULL REFERENCES managed_articles(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      alt_text varchar(500),
      caption varchar(1000),
      placement varchar(30) NOT NULL DEFAULT 'end' CHECK (placement IN ('cover', 'after-first', 'middle', 'end')),
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT managed_article_images_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS article_promos (
      id serial PRIMARY KEY,
      title varchar(255) NOT NULL,
      description varchar(1000) NOT NULL,
      button_text varchar(100) NOT NULL DEFAULT 'Info lebih lanjut',
      link_url varchar(2000) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp
    );
    CREATE TABLE IF NOT EXISTS booking_promos (
      id serial PRIMARY KEY,
      title varchar(255) NOT NULL,
      description varchar(1000) NOT NULL,
      button_text varchar(100) NOT NULL DEFAULT 'Info lebih lanjut',
      link_url varchar(2000) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp
    );
    CREATE TABLE IF NOT EXISTS application_data_migrations (
      migration_key varchar(255) PRIMARY KEY,
      applied_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS managed_articles_public_idx
      ON managed_articles(status, published_at DESC, id DESC) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS article_categories_select_idx
      ON article_categories(is_active, sort_order, id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS managed_article_images_article_idx
      ON managed_article_images(article_id, sort_order, id);
    CREATE INDEX IF NOT EXISTS article_promos_public_idx
      ON article_promos(is_active, sort_order, id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS booking_promos_public_idx
      ON booking_promos(is_active, sort_order, id) WHERE deleted_at IS NULL;
  `);

  await pool.query(`
    INSERT INTO article_categories (slug, name, sort_order)
    VALUES
      ('psikologi', 'Psikologi', 0),
      ('pendidikan', 'Pendidikan', 1),
      ('parenting', 'Parenting', 2),
      ('kesehatan-mental', 'Kesehatan Mental', 3),
      ('tips', 'Tips & Trik', 4),
      ('berita', 'Berita', 5)
    ON CONFLICT (slug) DO NOTHING
  `);

  await pool.query(`
    WITH applied AS (
      INSERT INTO application_data_migrations (migration_key)
      VALUES ('clear-initial-article-promos-v1')
      ON CONFLICT (migration_key) DO NOTHING
      RETURNING migration_key
    )
    UPDATE article_promos
       SET deleted_at = now(), is_active = false, updated_at = now()
     WHERE deleted_at IS NULL AND EXISTS (SELECT 1 FROM applied)
  `);

  await pool.query(`
    WITH applied AS (
      INSERT INTO application_data_migrations (migration_key)
      VALUES ('seed-booking-promos-v1')
      ON CONFLICT (migration_key) DO NOTHING
      RETURNING migration_key
    )
    INSERT INTO booking_promos (title, description, button_text, link_url, sort_order)
    SELECT seed.title, seed.description, 'Info lebih lanjut', 'https://wa.me/6285117658242', seed.sort_order
      FROM applied
      CROSS JOIN (VALUES
        ('Konsultasi Awal Gratis', 'Jadwalkan sesi konsultasi pertama Anda tanpa biaya.', 0),
        ('Workshop Pelangi Indonesia', 'Pelatihan Manajemen Perilaku Anak — Daftar sekarang!', 1),
        ('Paket Asesmen Lengkap', 'Dapatkan laporan komprehensif dengan rekomendasi terapi.', 2)
      ) AS seed(title, description, sort_order)
  `);
}

async function ensureHospitalityInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS hospitality_page_settings (
      id smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
      intro text NOT NULL,
      about_text text NOT NULL,
      why_items jsonb NOT NULL DEFAULT '[]'::jsonb,
      philosophy text NOT NULL,
      updated_by varchar REFERENCES users(id),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS hospitality_services (
      id serial PRIMARY KEY,
      slug varchar(255) NOT NULL UNIQUE,
      title varchar(255) NOT NULL,
      summary varchar(1000) NOT NULL,
      description text NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      image_data bytea,
      image_file_name varchar(255),
      image_mime_type varchar(100),
      image_focus_x smallint NOT NULL DEFAULT 50,
      image_focus_y smallint NOT NULL DEFAULT 50,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp,
      CONSTRAINT hospitality_service_image_focus_check CHECK (image_focus_x BETWEEN 0 AND 100 AND image_focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS hospitality_offerings (
      id serial PRIMARY KEY,
      service_id integer NOT NULL REFERENCES hospitality_services(id) ON DELETE CASCADE,
      slug varchar(255) NOT NULL,
      title varchar(255) NOT NULL,
      description text NOT NULL,
      capacity varchar(255),
      area varchar(255),
      facilities text,
      duration varchar(255),
      price_options jsonb NOT NULL DEFAULT '[]'::jsonb,
      sort_order integer NOT NULL DEFAULT 0,
      is_active boolean NOT NULL DEFAULT true,
      image_data bytea,
      image_file_name varchar(255),
      image_mime_type varchar(100),
      image_focus_x smallint NOT NULL DEFAULT 50,
      image_focus_y smallint NOT NULL DEFAULT 50,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      deleted_at timestamp,
      UNIQUE(service_id, slug),
      CONSTRAINT hospitality_offering_image_focus_check CHECK (image_focus_x BETWEEN 0 AND 100 AND image_focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS hospitality_gallery_images (
      id serial PRIMARY KEY,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      title varchar(255),
      caption varchar(1000),
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT hospitality_gallery_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS hospitality_offering_images (
      id serial PRIMARY KEY,
      offering_id integer NOT NULL REFERENCES hospitality_offerings(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT hospitality_offering_images_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    CREATE TABLE IF NOT EXISTS hospitality_service_gallery_images (
      id serial PRIMARY KEY,
      service_id integer NOT NULL REFERENCES hospitality_services(id) ON DELETE CASCADE,
      image_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL,
      sort_order integer NOT NULL DEFAULT 0,
      focus_x smallint NOT NULL DEFAULT 50,
      focus_y smallint NOT NULL DEFAULT 50,
      is_active boolean NOT NULL DEFAULT true,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      updated_at timestamp DEFAULT now(),
      CONSTRAINT hospitality_service_gallery_focus_check CHECK (focus_x BETWEEN 0 AND 100 AND focus_y BETWEEN 0 AND 100)
    );
    ALTER TABLE hospitality_services ADD COLUMN IF NOT EXISTS gallery_description text;
    CREATE TABLE IF NOT EXISTS application_data_migrations (
      migration_key varchar(255) PRIMARY KEY,
      applied_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS hospitality_services_public_idx
      ON hospitality_services(is_active, sort_order, id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS hospitality_offerings_public_idx
      ON hospitality_offerings(service_id, is_active, sort_order, id) WHERE deleted_at IS NULL;
    CREATE INDEX IF NOT EXISTS hospitality_gallery_public_idx
      ON hospitality_gallery_images(is_active, sort_order, id);
    CREATE INDEX IF NOT EXISTS hospitality_offering_images_public_idx
      ON hospitality_offering_images(offering_id, is_active, sort_order, id);
    CREATE INDEX IF NOT EXISTS hospitality_service_gallery_public_idx
      ON hospitality_service_gallery_images(service_id, is_active, sort_order, id);
  `);

  await pool.query(`
    WITH applied AS (
      INSERT INTO application_data_migrations (migration_key)
      VALUES ('migrate-hospitality-offering-images-v1')
      ON CONFLICT (migration_key) DO NOTHING RETURNING migration_key
    )
    INSERT INTO hospitality_offering_images
      (offering_id,image_data,file_name,mime_type,sort_order,focus_x,focus_y,is_active,created_by)
    SELECT offering.id,offering.image_data,COALESCE(offering.image_file_name,'foto-paket'),
           COALESCE(offering.image_mime_type,'image/jpeg'),0,offering.image_focus_x,offering.image_focus_y,true,offering.created_by
      FROM hospitality_offerings offering
      CROSS JOIN applied
     WHERE offering.image_data IS NOT NULL
  `);

  await pool.query(`
    WITH applied AS (
      INSERT INTO application_data_migrations (migration_key)
      VALUES ('normalize-hospitality-empty-promo-price-v1')
      ON CONFLICT (migration_key) DO NOTHING RETURNING migration_key
    ), normalized AS (
      SELECT offering.id,
             jsonb_agg(
               CASE
                 WHEN price_option.value ? 'promoPrice'
                  AND jsonb_typeof(price_option.value->'promoPrice') = 'number'
                  AND (price_option.value->>'promoPrice')::numeric = 0
                  AND jsonb_typeof(price_option.value->'price') = 'number'
                  AND (price_option.value->>'price')::numeric > 0
                 THEN price_option.value - 'promoPrice'
                 ELSE price_option.value
               END
               ORDER BY price_option.ordinality
             ) AS price_options
        FROM hospitality_offerings offering
        CROSS JOIN applied
        CROSS JOIN LATERAL jsonb_array_elements(offering.price_options)
          WITH ORDINALITY AS price_option(value, ordinality)
       GROUP BY offering.id
    )
    UPDATE hospitality_offerings offering
       SET price_options = normalized.price_options, updated_at = now()
      FROM normalized
     WHERE offering.id = normalized.id
       AND offering.price_options IS DISTINCT FROM normalized.price_options
  `);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const migration = await client.query(
      `INSERT INTO application_data_migrations (migration_key)
       VALUES ('seed-hospitality-services-v1')
       ON CONFLICT (migration_key) DO NOTHING RETURNING migration_key`,
    );
    if (migration.rowCount) {
      await client.query(
        `INSERT INTO hospitality_page_settings (id, intro, about_text, why_items, philosophy)
         VALUES (1, $1, $2, $3::jsonb, $4)
         ON CONFLICT (id) DO NOTHING`,
        [
          'Pelangi Indonesia Group menghadirkan layanan hospitality yang holistik dan terintegrasi di lingkungan Yogyakarta yang asri.',
          'Pelangi Indonesia Group berkomitmen menghadirkan layanan hospitality yang holistik dan terintegrasi. Layanan kami mendukung ekosistem pendidikan dan pengembangan psikologi sekaligus menyambut masyarakat umum dengan keramahan yang khas, fasilitas lengkap, serta suasana alam yang menenangkan.',
          JSON.stringify([
            { title: 'Kenyamanan Terpadu (One-Stop Service)', description: 'Solusi menyeluruh mulai dari tempat peristirahatan, ruang pertemuan, konsumsi, hingga perawatan pakaian.' },
            { title: 'Suasana yang Mendukung', description: 'Homestay dengan pemandangan sawah untuk ketenangan, istirahat, dan inspirasi.' },
            { title: 'Fleksibilitas Pelayanan', description: 'Melayani perjalanan pribadi, pertemuan komunitas, hingga acara berskala besar.' },
            { title: 'Visi yang Berdampak', description: 'Setiap layanan bergerak dan memberikan dampak positif bagi tamu dan lingkungan.' },
          ]),
          'Lebih dari sekadar penyedia akomodasi dan fasilitas acara, kami hadir sebagai rumah kedua yang memastikan kebutuhan logistik dan kenyamanan Anda tertangani dengan prima. Lingkungan yang nyaman, makanan bernutrisi, dan fasilitas memadai menjadi fondasi untuk melahirkan ide, kolaborasi, dan kenangan yang indah.',
        ],
      );

      const services = [
        { slug: 'homestay', title: 'Homestay', summary: 'Rasakan ketenangan menginap dengan pemandangan hamparan sawah yang asri.', description: 'Pilihan kamar berkapasitas 2 hingga 6 orang, cocok untuk keluarga maupun rombongan. Fasilitas meliputi dapur, akses kolam renang yang menyegarkan, dan layanan sarapan (include breakfast).', order: 0 },
        { slug: 'sewa-gedung-ruangan', title: 'Sewa Gedung & Ruangan', summary: 'Ruang representatif untuk pertemuan, workshop, dan acara berskala besar.', description: 'Paket ruangan mencakup ruang ber-AC, projector dan screen, sound system dan mic wireless, note dan pena, air mineral, permen, Wi-Fi, kursi sesuai kapasitas, serta area parkir dalam. Parkir di luar area gedung dikenakan biaya terpisah.', order: 1 },
        { slug: 'kedai', title: 'Kedai', summary: 'Ragam sajian mulai dari minuman segar, hidangan makan berat, hingga aneka snack ringan.', description: 'Nikmati ragam sajian istimewa Pelangi Indonesia untuk melengkapi waktu beristirahat maupun kegiatan Anda.', order: 2 },
        { slug: 'catering', title: 'Catering', summary: 'Layanan katering untuk sekolah, masyarakat umum, dan berbagai acara spesial.', description: 'Selain melayani kebutuhan nutrisi sekolah, Katering Pelangi hadir untuk melayani pesanan umum dengan pilihan yang dapat disesuaikan.', order: 3 },
        { slug: 'laundry', title: 'Laundry', summary: 'Perawatan pakaian yang bersih dan rapi dengan durasi sesuai ritme perjalanan Anda.', description: 'Pilih layanan Biasa, Cepat, atau Kilat sesuai kebutuhan waktu penyelesaian.', order: 4 },
      ];
      const serviceIds = new Map<string, number>();
      for (const service of services) {
        const result = await client.query(
          `INSERT INTO hospitality_services (slug, title, summary, description, sort_order)
           VALUES ($1,$2,$3,$4,$5) RETURNING id`,
          [service.slug, service.title, service.summary, service.description, service.order],
        );
        serviceIds.set(service.slug, result.rows[0].id);
      }

      const offerings = [
        { service: 'homestay', slug: 'standard', title: 'Standard', description: 'Pilihan pas untuk perjalanan berdua yang mengutamakan kenyamanan esensial. Tersedia pilihan kamar di lantai 2 dengan pemandangan sawah dan gunung, atau di lantai 1 dengan akses mudah ke dapur bersama.', capacity: '2 Pax (tersedia opsi 1 extra bed)', area: '18 m²', facilities: '1 Queen Bed', duration: '', prices: [{ label: 'Weekday', price: 280000, unit: '/ malam' }, { label: 'Weekend', price: 300000, unit: '/ malam' }, { label: 'Peak Season', price: 400000, unit: '/ malam' }], order: 0 },
        { service: 'homestay', slug: 'superior', title: 'Superior', description: 'Lebih luas dan fleksibel, cocok untuk rekan kerja atau sahabat. Dilengkapi opsi connecting room serta pemandangan alam dari lantai 2 dan 3.', capacity: '2 Pax (tersedia opsi 1-2 extra bed)', area: '24 m²', facilities: '2 Single Bed, opsi connecting room', duration: '', prices: [{ label: 'Weekday', price: 330000, unit: '/ malam' }, { label: 'Weekend', price: 350000, unit: '/ malam' }, { label: 'Peak Season', price: 500000, unit: '/ malam' }], order: 1 },
        { service: 'homestay', slug: 'family-room', title: 'Family Room', description: 'Ruang berkumpul yang hangat untuk keluarga kecil. Desain kamar luas dengan panorama matahari terbit berlatar gunung dan persawahan dari lantai 2.', capacity: '4 Pax (tersedia opsi 2 extra bed)', area: '81 m²', facilities: '1 Single Bed & 1 Queen Bed', duration: '', prices: [{ label: 'Weekday', price: 380000, unit: '/ malam' }, { label: 'Weekend', price: 400000, unit: '/ malam' }, { label: 'Peak Season', price: 580000, unit: '/ malam' }], order: 2 },
        { service: 'homestay', slug: 'suite-room', title: 'Suite Room', description: 'Fasilitas premium menyerupai apartemen pribadi, lengkap dengan ruang keluarga, balkon pribadi, dan dapur eksklusif. Tersedia di lantai 3 untuk pemandangan terbaik atau lantai 1 untuk aksesibilitas.', capacity: '4 Pax (tersedia opsi 2 extra bed)', area: '90 m²', facilities: '2 Single Bed & 2 Sofa Bed, balkon, ruang keluarga (sofa, TV, meja makan), dapur pribadi (kulkas, kompor, alat masak)', duration: '', prices: [{ label: 'Weekday', price: 580000, unit: '/ malam' }, { label: 'Weekend', price: 600000, unit: '/ malam' }, { label: 'Peak Season', price: 1100000, unit: '/ malam' }], order: 3 },
        { service: 'sewa-gedung-ruangan', slug: 'convention-hall', title: 'Convention Hall', description: 'Aula utama yang megah untuk perhelatan besar, pameran, kelulusan, atau seminar akbar.', capacity: '100-200 orang', area: '', facilities: 'Gratis panggung (stage) ukuran 4 x 8 meter', duration: '8 Jam', prices: [{ label: 'Sewa Convention Hall', price: 5000000, promoPrice: 3000000, unit: '/ 8 jam' }], order: 0 },
        { service: 'sewa-gedung-ruangan', slug: 'paket-meeting-lengkap', title: 'Paket Meeting Lengkap', description: 'Solusi praktis dan terpadu untuk rapat atau pelatihan. Pemesanan minimal 15 orang dan sudah termasuk penggunaan ruang pertemuan beserta alat pendukung acara.', capacity: '15-20 orang', area: '', facilities: 'Halfday: 1x Coffee Break + 1x Lunch. One Day: 2x Coffee Break + 1x Meal. Full-day: 3x Coffee Break + 1x Lunch.', duration: '6-12 Jam', prices: [{ label: 'Halfday Meeting (6 Jam)', price: 100000, promoPrice: 75000, unit: '/ pax' }, { label: 'One Day Meeting (8 Jam)', price: 150000, promoPrice: 100000, unit: '/ pax' }, { label: 'Full-day Meeting (12 Jam)', price: 200000, promoPrice: 150000, unit: '/ pax' }], order: 1 },
        { service: 'sewa-gedung-ruangan', slug: 'room-only', title: 'Sewa Ruangan (Room Only)', description: 'Opsi fleksibel untuk mengatur konsumsi secara mandiri, dengan pilihan add-on katering dari Kedai Pelangi bila dibutuhkan.', capacity: '', area: '', facilities: 'Opsi tambahan: Lunch/Dinner dan Coffee Break.', duration: 'Fleksibel', prices: [{ label: 'Durasi 8 Jam', price: 75000, promoPrice: 60000, unit: '' }, { label: 'Durasi > 8 Jam', price: 100000, promoPrice: 75000, unit: '' }, { label: 'Lunch/Dinner', price: 80000, promoPrice: 40000, unit: '/ pax' }, { label: 'Coffee Break', price: 30000, promoPrice: 15000, unit: '/ pax' }], order: 2 },
        { service: 'laundry', slug: 'biasa', title: 'Biasa', description: 'Paket laundry reguler untuk kebutuhan harian.', capacity: '', area: '', facilities: '', duration: '3-4 Hari', prices: [{ label: 'Tarif', price: 8000, unit: '/ kg' }], order: 0 },
        { service: 'laundry', slug: 'cepat', title: 'Cepat', description: 'Paket laundry dengan waktu pengerjaan lebih singkat.', capacity: '', area: '', facilities: '', duration: '1-2 Hari', prices: [{ label: 'Tarif', price: 10000, unit: '/ kg' }], order: 1 },
        { service: 'laundry', slug: 'kilat', title: 'Kilat', description: 'Paket prioritas untuk kebutuhan mendesak.', capacity: '', area: '', facilities: '', duration: '< 1 Hari', prices: [{ label: 'Tarif', price: 15000, unit: '/ kg' }], order: 2 },
      ];
      for (const offering of offerings) {
        await client.query(
          `INSERT INTO hospitality_offerings
            (service_id,slug,title,description,capacity,area,facilities,duration,price_options,sort_order)
           VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),$9::jsonb,$10)`,
          [serviceIds.get(offering.service), offering.slug, offering.title, offering.description, offering.capacity,
           offering.area, offering.facilities, offering.duration, JSON.stringify(offering.prices), offering.order],
        );
      }
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function makeDigitalProductSlug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 220);
}

const digitalProductSchema = z.object({
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(255).optional(),
  shortDescription: z.string().trim().min(5).max(500),
  description: z.string().trim().min(5).max(20000),
  descriptionHtml: z.string().max(200000).optional().default(""),
  price: z.coerce.number().min(0).max(99999999),
  promoPrice: z.union([z.number().min(0).max(99999999), z.null()]).optional().default(null),
  isActive: z.boolean().optional().default(true),
  deliveryUrl: z.union([
    z.string().trim().url().max(2000).refine((value) => /^https?:\/\//i.test(value), "Link harus menggunakan http atau https"),
    z.literal(""),
  ]).optional(),
}).superRefine((value, ctx) => {
  if (value.promoPrice !== null && value.promoPrice >= value.price) {
    ctx.addIssue({ code: "custom", path: ["promoPrice"], message: "Harga promo harus lebih rendah dari harga reguler" });
  }
});

const digitalOrderSchema = z.object({
  productIds: z.array(z.number().int().positive()).min(1).max(20),
  customer: z.object({
    fullName: z.string().trim().min(2).max(255),
    email: z.string().trim().email().max(255),
    phone: z.string().trim().min(7).max(50),
    notes: z.string().trim().max(2000).optional().default(""),
  }),
});

const digitalProductImageFocusSchema = z.object({
  focusX: z.number().int().min(0).max(100),
  focusY: z.number().int().min(0).max(100),
});

const allowedSocialMediaDomains = [
  "youtube.com", "youtu.be", "instagram.com", "tiktok.com", "facebook.com", "fb.watch",
  "vimeo.com", "x.com", "twitter.com", "linkedin.com",
];

function getSocialMediaPlatform(value: string) {
  const hostname = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
  if (hostname === "youtu.be" || hostname.endsWith("youtube.com")) return "youtube";
  if (hostname.endsWith("instagram.com")) return "instagram";
  if (hostname.endsWith("tiktok.com")) return "tiktok";
  if (hostname.endsWith("facebook.com") || hostname === "fb.watch") return "facebook";
  if (hostname.endsWith("vimeo.com")) return "vimeo";
  if (hostname === "x.com" || hostname.endsWith("twitter.com")) return "x";
  if (hostname.endsWith("linkedin.com")) return "linkedin";
  return "social-media";
}

function isAllowedSocialMediaUrl(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    return allowedSocialMediaDomains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`));
  } catch {
    return false;
  }
}

const digitalProductExternalMediaSchema = z.object({
  title: z.string().trim().min(2).max(255),
  url: z.string().trim().url().max(2000).refine(isAllowedSocialMediaUrl, "Gunakan tautan HTTPS dari platform media sosial yang didukung"),
  mediaType: z.enum(["video", "documentation"]).default("video"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const physicalProductSchema = z.object({
  name: z.string().trim().min(2).max(255), slug: z.string().trim().max(255).optional(),
  shortDescription: z.string().trim().min(5).max(500), description: z.string().trim().min(5).max(20000),
  descriptionHtml: z.string().max(200000).optional().default(""), sku: z.string().trim().min(2).max(100),
  price: z.coerce.number().min(0).max(999999999), promoPrice: z.union([z.number().min(0).max(999999999), z.null()]).optional().default(null),
  stock: z.coerce.number().int().min(0).max(1000000), lowStockThreshold: z.coerce.number().int().min(0).max(1000000).default(0),
  weightGrams: z.coerce.number().int().min(0).max(10000000).default(0), shippingFee: z.coerce.number().min(0).max(999999999).default(0),
  isActive: z.boolean().default(true),
}).superRefine((value, ctx) => {
  if (value.promoPrice !== null && value.promoPrice >= value.price) ctx.addIssue({ code: "custom", path: ["promoPrice"], message: "Harga promo harus lebih rendah dari harga reguler" });
});

const physicalOrderSchema = z.object({
  items: z.array(z.object({ productId: z.number().int().positive(), quantity: z.number().int().min(1).max(100) })).min(1).max(20),
  shipping: z.object({
    recipientName: z.string().trim().min(2).max(255), email: z.string().trim().email().max(255),
    phone: z.string().trim().min(7).max(50), address: z.string().trim().min(10).max(3000),
    district: z.string().trim().min(2).max(150), city: z.string().trim().min(2).max(150),
    province: z.string().trim().min(2).max(150), postalCode: z.string().trim().regex(/^\d{5}$/),
    notes: z.string().trim().max(2000).optional().default(""),
  }),
});

const physicalFulfillmentSchema = z.object({
  fulfillmentStatus: z.enum(["paid", "processing", "shipped", "completed", "cancelled"]),
  courier: z.string().trim().max(100).optional().default(""), trackingNumber: z.string().trim().max(255).optional().default(""),
  trackingUrl: z.union([z.string().trim().url().max(2000).refine(value => /^https:\/\//i.test(value)), z.literal("")]).optional().default(""),
});

const courseSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(255).optional(),
  price: z.string().trim().min(2).max(100),
  description: z.string().trim().min(5).max(20000),
  details: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
  specialNote: z.string().trim().max(2000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const courseGallerySchema = z.object({
  title: z.string().trim().max(255).optional().default(""),
  caption: z.string().trim().max(1000).optional().default(""),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  focusX: z.coerce.number().int().min(0).max(100).optional().default(50),
  focusY: z.coerce.number().int().min(0).max(100).optional().default(50),
  isActive: z.boolean().optional().default(true),
});

const therapyCategorySchema = z.object({
  title: z.string().trim().min(2).max(255), slug: z.string().trim().max(150).optional(),
  kind: z.enum(["development", "psychotherapy", "general"]).default("general"),
  description: z.string().trim().min(5).max(5000), introduction: z.string().trim().max(20000).optional().default(""),
  availability: z.string().trim().max(500).optional().default(""),
  summaryItems: z.array(z.string().trim().min(1).max(500)).max(30).optional().default([]),
  theme: z.enum(["green", "blue", "orange", "purple"]).default("green"),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0), isActive: z.boolean().default(true),
});

const therapyServiceSchema = z.object({
  categoryId: z.coerce.number().int().positive(), title: z.string().trim().min(2).max(255), slug: z.string().trim().max(150).optional(),
  price: z.string().trim().max(100).optional().default(""), description: z.string().trim().min(5).max(5000),
  fullDescription: z.string().trim().max(20000).optional().default(""), focus: z.string().trim().max(5000).optional().default(""),
  target: z.string().trim().max(5000).optional().default(""),
  benefits: z.array(z.string().trim().min(1).max(1000)).max(50).optional().default([]),
  conditions: z.array(z.string().trim().min(1).max(1000)).max(50).optional().default([]),
  sections: z.array(z.object({ title: z.string().trim().min(1).max(255), description: z.string().trim().max(5000).optional().default(""), conditions: z.array(z.string().trim().min(1).max(1000)).max(30).optional().default([]) })).max(20).optional().default([]),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0), isActive: z.boolean().default(true),
});

const therapyImageFocusSchema = z.object({ focusX: z.coerce.number().int().min(0).max(100), focusY: z.coerce.number().int().min(0).max(100) });
const therapyGallerySchema = courseGallerySchema.extend({ categoryId: z.union([z.coerce.number().int().positive(), z.null()]).optional().default(null) });

const onsiteAssessmentServiceSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(180).optional(),
  description: z.string().trim().min(5).max(10000),
  resultText: z.string().trim().max(10000).optional().default(""),
  targetText: z.string().trim().max(10000).optional().default(""),
  price: z.coerce.number().int().min(0).max(999999999),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const psychologyTestToolSchema = z.object({
  category: z.enum(["kognitif", "perkembangan", "klinis", "inventori-kepribadian"]),
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(255).optional(),
  description: z.string().trim().min(5).max(1000),
  detailText: z.string().trim().min(5).max(20000),
  resultText: z.string().trim().max(20000).optional().default(""),
  targetText: z.string().trim().max(20000).optional().default(""),
  price: z.coerce.number().min(0).max(999999999),
  sortOrder: z.coerce.number().int().min(0).max(9999).default(0),
  isActive: z.boolean().default(true),
});

const websiteAnalyticsEventSchema = z.object({
  sessionId: z.string().regex(/^[a-zA-Z0-9-]{16,64}$/),
  eventType: z.enum(["page_view", "content_view", "cta_click", "checkout_start"]),
  pagePath: z.string().trim().startsWith("/").max(500),
  contentType: z.enum(["digital-product", "physical-product", "psychology-test", "therapy", "course", "training", "hospitality", "article", "assessment"]).nullable().optional(),
  contentSlug: z.string().trim().regex(/^[a-z0-9-]{1,255}$/).nullable().optional(),
  ctaType: z.enum(["buy_now", "register_now", "more_info", "whatsapp", "contact", "add_to_cart"]).nullable().optional(),
  source: z.string().trim().max(100).nullable().optional(),
  medium: z.string().trim().max(100).nullable().optional(),
  campaign: z.string().trim().max(150).nullable().optional(),
  referrerHost: z.string().trim().max(255).nullable().optional(),
  deviceType: z.enum(["desktop", "tablet", "mobile", "unknown"]),
});

const trainingSchema = z.object({
  title: z.string().trim().min(3).max(255),
  slug: z.string().trim().max(255).optional(),
  summary: z.string().trim().min(10).max(1000),
  description: z.string().trim().min(20).max(50000),
  descriptionHtml: z.string().max(200000).optional().default(""),
  startsAt: z.union([z.string().min(10).max(40), z.literal(""), z.null()]).optional().default(null),
  endsAt: z.union([z.string().min(10).max(40), z.literal(""), z.null()]).optional().default(null),
  location: z.string().trim().max(500).optional().default(""),
  registrationDeadline: z.union([z.string().min(10).max(40), z.literal(""), z.null()]).optional().default(null),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  status: z.enum(["draft", "published", "closed", "completed"]).optional().default("draft"),
});

function sanitizeRichText(value: string, allowedImagePath?: RegExp) {
  return sanitizeHtml(value, {
    allowedTags: ["h2", "h3", "p", "div", "br", "strong", "b", "em", "i", "u", "ul", "ol", "li", "a", "img", "blockquote", "span", "font"],
    allowedAttributes: {
      a: ["href", "target", "rel"],
      img: ["src", "alt", "title", "style", "data-training-image-id"],
      div: ["style", "align"], p: ["style", "align"], h2: ["style", "align"], h3: ["style", "align"], span: ["style"],
      font: ["face", "color", "size"],
    },
    allowedSchemes: ["http", "https", "mailto"],
    allowedStyles: {
      "*": {
        color: [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/],
        "background-color": [/^#[0-9a-f]{3,8}$/i, /^rgb\([\d\s,]+\)$/],
        "text-align": [/^(left|center|right)$/],
        "font-family": [/^[\w\s,'-]+$/],
        "font-size": [/^(0\.75|0\.875|1|1\.125|1\.25|1\.5|1\.875|2\.25)rem$/],
      },
      img: {
        width: [/^\d{1,3}%$/], "max-width": [/^100%$/], height: [/^auto$/],
        display: [/^block$/], margin: [/^[\d.]+rem auto$/], "border-radius": [/^[\d.]+rem$/],
      },
    },
    transformTags: {
      a: (_tagName, attribs) => ({ tagName: "a", attribs: { ...attribs, target: "_blank", rel: "noopener noreferrer" } }),
    },
    exclusiveFilter: frame => frame.tag === "img" && (!allowedImagePath || !allowedImagePath.test(frame.attribs.src || "")),
  });
}

function sanitizeTrainingDescription(value: string) {
  return sanitizeRichText(value, /^\/api\/trainings\/description-images\/\d+$/);
}

function getTrainingDescriptionImageIds(value: string) {
  return Array.from(value.matchAll(/\/api\/trainings\/description-images\/(\d+)/g), match => Number(match[1]));
}

const trainingOptionSchema = z.object({
  name: z.string().trim().min(2).max(255),
  description: z.string().trim().max(1000).optional().default(""),
  price: z.coerce.number().min(0).max(99999999),
  capacity: z.union([z.coerce.number().int().min(1).max(100000), z.null()]).optional().default(null),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const trainingRegistrationSchema = z.object({
  trainingId: z.number().int().positive(),
  optionId: z.number().int().positive(),
  participant: z.object({
    fullName: z.string().trim().min(2).max(255),
    birthDate: z.string().trim().min(8).max(20),
    gender: z.string().trim().min(1).max(30),
    address: z.string().trim().min(5).max(2000),
    whatsappNumber: z.string().trim().min(7).max(50),
    email: z.string().trim().email().max(255),
    education: z.string().trim().min(2).max(255),
    occupation: z.string().trim().min(2).max(255),
  }),
});

const trainingTestimonialSchema = z.object({
  name: z.string().trim().min(2).max(255),
  occupation: z.string().trim().max(255).optional().default(""),
  trainingName: z.string().trim().max(255).optional().default(""),
  testimonial: z.string().trim().min(5).max(5000),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const trainingTestimonialSettingsSchema = z.object({
  backgroundFocusX: z.coerce.number().int().min(0).max(100),
  backgroundFocusY: z.coerce.number().int().min(0).max(100),
  instagramUrl: z.string().trim().max(1000).optional().default("").refine(value => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return url.protocol === "https:" && (url.hostname === "instagram.com" || url.hostname.endsWith(".instagram.com"));
    } catch {
      return false;
    }
  }, "Tautan harus berupa URL Instagram HTTPS"),
});

const trainingGallerySchema = courseGallerySchema;

const ARTICLE_IMAGE_PLACEMENTS = ["cover", "after-first", "middle", "end"] as const;

const managedArticleSchema = z.object({
  instagramEnabled: z.boolean().optional().default(false),
  instagramCaption: z.string().trim().max(2200).optional().default(''),
  title: z.string().trim().min(3).max(255),
  slug: z.string().trim().max(255).optional(),
  excerpt: z.string().trim().min(10).max(1000),
  content: z.string().trim().min(20).max(100000),
  category: z.string().trim().min(1).max(100).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).optional().default("berita"),
  authorName: z.string().trim().max(255).optional().default(""),
  status: z.enum(["draft", "published"]).optional().default("draft"),
  publishedAt: z.union([z.string().datetime(), z.literal(""), z.null()]).optional().default(null),
});

const managedArticleImageSchema = z.object({
  altText: z.string().trim().max(500).optional().default(""),
  caption: z.string().trim().max(1000).optional().default(""),
  placement: z.enum(ARTICLE_IMAGE_PLACEMENTS).optional().default("end"),
  sortOrder: z.coerce.number().int().min(0).max(2).optional().default(0),
  focusX: z.coerce.number().int().min(0).max(100).optional().default(50),
  focusY: z.coerce.number().int().min(0).max(100).optional().default(50),
});

const articlePromoSchema = z.object({
  title: z.string().trim().min(2).max(255),
  description: z.string().trim().min(3).max(1000),
  buttonText: z.string().trim().min(2).max(100).optional().default("Info lebih lanjut"),
  linkUrl: z.string().trim().min(1).max(2000).refine(
    (value) => (value.startsWith("/") && !value.startsWith("//")) || /^https?:\/\//i.test(value),
    "Tautan harus berupa halaman internal atau menggunakan http/https",
  ),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const articleCategorySchema = z.object({
  name: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(100).optional(),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const hospitalityPageSettingsSchema = z.object({
  intro: z.string().trim().min(10).max(2000),
  aboutText: z.string().trim().min(20).max(10000),
  whyItems: z.array(z.object({
    title: z.string().trim().min(2).max(255),
    description: z.string().trim().min(5).max(2000),
  })).min(1).max(12),
  philosophy: z.string().trim().min(20).max(10000),
});

const hospitalityServiceSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(255).optional(),
  summary: z.string().trim().min(5).max(1000),
  description: z.string().trim().min(5).max(20000),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const hospitalityPriceOptionSchema = z.object({
  label: z.string().trim().min(1).max(255),
  price: z.coerce.number().min(0).max(999999999),
  promoPrice: z.preprocess(
    (value) => value === "" || value === undefined ? null : value,
    z.union([z.null(), z.coerce.number().min(0).max(999999999)]),
  ).optional().default(null),
  unit: z.string().trim().max(100).optional().default(""),
}).superRefine((value, ctx) => {
  if (value.promoPrice !== null && value.promoPrice >= value.price) {
    ctx.addIssue({ code: "custom", path: ["promoPrice"], message: "Harga promo harus lebih rendah dari harga reguler" });
  }
});

const hospitalityOfferingSchema = z.object({
  title: z.string().trim().min(2).max(255),
  slug: z.string().trim().max(255).optional(),
  description: z.string().trim().min(5).max(20000),
  capacity: z.string().trim().max(255).optional().default(""),
  area: z.string().trim().max(255).optional().default(""),
  facilities: z.string().trim().max(10000).optional().default(""),
  duration: z.string().trim().max(255).optional().default(""),
  priceOptions: z.array(hospitalityPriceOptionSchema).max(20).optional().default([]),
  sortOrder: z.coerce.number().int().min(0).max(9999).optional().default(0),
  isActive: z.boolean().optional().default(true),
});

const hospitalityGallerySchema = courseGallerySchema;
const hospitalityServiceGalleryDescriptionSchema = z.object({
  description: z.string().trim().max(5000).optional().default(""),
});

const EXTERNAL_ASSESSMENT_TYPES = ["external-mental-health", "external-student-potential", "external-career-potential"] as const;

function isExternalAssessmentType(type?: string | null) {
  return Boolean(type && EXTERNAL_ASSESSMENT_TYPES.includes(type as (typeof EXTERNAL_ASSESSMENT_TYPES)[number]));
}

async function ensureExternalAssessmentInfrastructure() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS external_assessment_configs (
      assessment_id integer PRIMARY KEY REFERENCES assessments(id),
      original_price numeric(10,2) NOT NULL,
      website_name varchar(255),
      website_url varchar(1000),
      work_hours varchar(100) NOT NULL DEFAULT '08.00-17.00 WIB',
      result_eta_text varchar(255) NOT NULL DEFAULT 'Hasil akan dikirimkan dalam waktu 2x24 jam hari kerja',
      instructions_pdf bytea,
      instructions_file_name varchar(255),
      updated_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS external_assessment_codes (
      id serial PRIMARY KEY,
      assessment_id integer NOT NULL REFERENCES assessments(id),
      code varchar(255) NOT NULL,
      status varchar(30) NOT NULL DEFAULT 'available',
      order_id integer REFERENCES orders(id),
      user_id varchar REFERENCES users(id),
      allocated_at timestamp,
      created_by varchar REFERENCES users(id),
      created_at timestamp DEFAULT now(),
      UNIQUE (assessment_id, code)
    );
    CREATE INDEX IF NOT EXISTS external_assessment_code_status_idx ON external_assessment_codes(assessment_id, status);
    CREATE TABLE IF NOT EXISTS external_assessment_results (
      id serial PRIMARY KEY,
      order_id integer NOT NULL REFERENCES orders(id),
      assessment_id integer REFERENCES assessments(id),
      file_data bytea NOT NULL,
      file_name varchar(255) NOT NULL,
      mime_type varchar(100) NOT NULL DEFAULT 'application/pdf',
      uploaded_by varchar NOT NULL REFERENCES users(id),
      uploaded_at timestamp DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS psychologist_assessment_result_audits (
      id serial PRIMARY KEY,
      psychologist_user_id varchar NOT NULL REFERENCES users(id),
      source_type varchar(20) NOT NULL,
      user_assessment_id integer REFERENCES user_assessments(id),
      order_id integer REFERENCES orders(id),
      assessment_id integer NOT NULL REFERENCES assessments(id),
      viewed_at timestamp DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS psychologist_assessment_result_audit_psychologist_idx
      ON psychologist_assessment_result_audits(psychologist_user_id, viewed_at);
    CREATE INDEX IF NOT EXISTS psychologist_assessment_result_audit_assessment_idx
      ON psychologist_assessment_result_audits(assessment_id, viewed_at);
    ALTER TABLE external_assessment_codes DROP CONSTRAINT IF EXISTS external_assessment_codes_order_id_key;
    DROP INDEX IF EXISTS external_assessment_code_order_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS external_assessment_code_order_assessment_unique
      ON external_assessment_codes(order_id, assessment_id);
    ALTER TABLE external_assessment_results ADD COLUMN IF NOT EXISTS assessment_id integer REFERENCES assessments(id);
    UPDATE external_assessment_results result
      SET assessment_id = code.assessment_id
      FROM external_assessment_codes code
      WHERE result.assessment_id IS NULL AND code.order_id = result.order_id;
    UPDATE external_assessment_results result
      SET assessment_id = item.assessment_id
      FROM order_items item
      JOIN assessments assessment ON assessment.id = item.assessment_id
      WHERE result.assessment_id IS NULL AND item.order_id = result.order_id
        AND assessment.type IN ('external-mental-health', 'external-student-potential', 'external-career-potential');
    ALTER TABLE external_assessment_results DROP CONSTRAINT IF EXISTS external_assessment_results_order_id_key;
    DROP INDEX IF EXISTS external_assessment_result_order_unique;
    CREATE UNIQUE INDEX IF NOT EXISTS external_assessment_result_order_assessment_unique
      ON external_assessment_results(order_id, assessment_id);
  `);
}

async function allocateExternalAssessmentCodes(orderId: number) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    // Serialize fulfillment for the same order while still allowing different orders in parallel.
    await client.query("SELECT pg_advisory_xact_lock($1)", [orderId]);
    const orderResult = await client.query(
      `SELECT o.user_id, oi.assessment_id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN assessments a ON a.id = oi.assessment_id
       WHERE o.id = $1 AND a.type = ANY($2::text[])`,
      [orderId, EXTERNAL_ASSESSMENT_TYPES],
    );

    for (const item of orderResult.rows) {
      const existing = await client.query(
        "SELECT id FROM external_assessment_codes WHERE order_id = $1 AND assessment_id = $2 LIMIT 1",
        [orderId, item.assessment_id],
      );
      if (existing.rowCount) continue;

      const allocation = await client.query(
        `WITH candidate AS (
           SELECT id FROM external_assessment_codes
           WHERE assessment_id = $1 AND status = 'available' AND order_id IS NULL
           ORDER BY id
           FOR UPDATE SKIP LOCKED
           LIMIT 1
         )
         UPDATE external_assessment_codes c
         SET status = 'allocated', order_id = $2, user_id = $3, allocated_at = now()
         FROM candidate
         WHERE c.id = candidate.id
         RETURNING c.id`,
        [item.assessment_id, orderId, item.user_id],
      );
      if (!allocation.rowCount) {
        console.warn(`No available external assessment code for paid order ${orderId}`);
      }
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function getDassCategory(scale: "depression" | "anxiety" | "stress", score: number) {
  const thresholds = scale === "depression"
    ? [10, 14, 21, 28]
    : scale === "anxiety"
      ? [8, 10, 15, 20]
      : [15, 19, 26, 34];
  if (score < thresholds[0]) return "Normal";
  if (score < thresholds[1]) return "Ringan";
  if (score < thresholds[2]) return "Sedang";
  if (score < thresholds[3]) return "Berat";
  return "Sangat Berat";
}

function getSrqCategory(score: number) {
  if (score <= 5) return "Ringan";
  if (score <= 10) return "Sedang";
  return "Berat";
}

function isPaidCounselingBooking(booking: { status: string; order: { status: string; paymentStatus?: string | null } }) {
  return booking.status === "paid" || booking.order.status === "completed" || booking.order.paymentStatus === "paid";
}

function isScreeningEligibleConsultation(booking: { consultationType?: string | null }) {
  return booking.consultationType !== "child";
}

function hasPaymentExpired(order: { status: string; paymentId?: string | null; paymentStatus?: string | null; updatedAt?: Date | string | null }) {
  if (order.status !== "pending" || !order.paymentId || order.paymentStatus === "paid") return false;

  const updatedAt = order.updatedAt ? new Date(order.updatedAt).getTime() : Number.NaN;
  if (Number.isNaN(updatedAt)) return false;

  return Date.now() - updatedAt >= PAYMENT_EXPIRY_MINUTES * 60 * 1000;
}

async function expireOrderIfNeeded<T extends { id: number; status: string; paymentId?: string | null; paymentStatus?: string | null; updatedAt?: Date | string | null }>(order: T) {
  if (!hasPaymentExpired(order)) return order;

  await storage.updateOrderStatus(order.id, "cancelled", order.paymentId || undefined, "expired");
  await releasePhysicalOrderStock(order.id);
  return {
    ...order,
    status: "cancelled",
    paymentStatus: "expired",
  };
}

const bookingRequestSchema = z.object({
  serviceId: z.number().int().positive(),
  clientName: z.string().min(2),
  birthDate: z.string().optional(),
  gender: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.enum(["male", "female"]).optional(),
  ),
  age: z.number().int().min(0).max(120).optional(),
  email: z.string().email(),
  whatsappNumber: z.string().regex(/^[0-9]+$/, "Nomor WhatsApp hanya boleh angka").min(8),
  mainConcern: z.string().trim().min(1),
  concernHistory: z.string().optional(),
  consultationType: z.enum(["child", "adult", "family"]),
  childName: z.string().optional(),
  childBirthDate: z.string().optional(),
  previousDiagnosis: z.string().optional(),
  preferredDate: z.string().min(4),
  preferredTime: z.string().regex(TIME_SLOT_PATTERN, "Format waktu harus HH.MM - HH.MM"),
  additionalPreferredTime: z.preprocess(
    (value) => value === "" ? undefined : value,
    z.string().regex(TIME_SLOT_PATTERN, "Format waktu sesi kedua harus HH.MM - HH.MM").optional(),
  ),
  psychologistName: z.string().min(2),
  location: z.enum(["online", "colombo", "bantul"]),
}).superRefine((data, ctx) => {
  if (data.consultationType === "child") {
    if (!data.childName?.trim()) {
      ctx.addIssue({ code: "custom", path: ["childName"], message: "Nama anak wajib diisi" });
    }
  } else if (!data.birthDate?.trim()) {
    ctx.addIssue({ code: "custom", path: ["birthDate"], message: "Tanggal lahir wajib diisi" });
  }

  const today = getJakartaDateString();
  const maxDate = addDaysToDateString(today, SCHEDULE_WINDOW_DAYS);
  if (data.preferredDate < today || data.preferredDate > maxDate) {
    ctx.addIssue({
      code: "custom",
      path: ["preferredDate"],
      message: "Tanggal booking hanya dapat dipilih sampai 30 hari ke depan",
    });
  }
  if (!isValidTimeSlotRange(data.preferredTime)) {
    ctx.addIssue({
      code: "custom",
      path: ["preferredTime"],
      message: "Waktu konseling harus berada antara 07.00-21.00",
    });
  }
  if (data.additionalPreferredTime) {
    const first = parseTimeSlotRange(data.preferredTime);
    const second = parseTimeSlotRange(data.additionalPreferredTime);
    if (!second || !isValidTimeSlotRange(data.additionalPreferredTime) || !first || first.endMinutes !== second.startMinutes) {
      ctx.addIssue({
        code: "custom",
        path: ["additionalPreferredTime"],
        message: "Sesi kedua harus dimulai tepat setelah sesi pertama",
      });
    }
  }
});

const manualCounselingBookingSchema = bookingRequestSchema.extend({
  serviceId: z.number().int().positive().optional(),
  gender: z.enum(["male", "female"]),
  age: z.number().int().min(0).max(120),
  markAsPaid: z.boolean().optional(),
});

const psychologistPriceSchema = z.string().trim().regex(/^\d+$/, "Harga hanya boleh angka").optional().or(z.literal(""));

const adminCreatePsychologistSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
  firstName: z.string().trim().min(1, "Nama depan wajib diisi"),
  lastName: z.string().optional(),
  whatsappNumber: z.string().optional(),
  psychologistProfileName: z.string().trim().min(2, "Nama profil psikolog wajib diisi"),
  psychologistConsultationTypes: z.array(z.enum(["child", "adult", "family"])).min(1, "Pilih minimal satu jenis konsultasi"),
  psychologistChildPrice: psychologistPriceSchema,
  psychologistAdultPrice: psychologistPriceSchema,
  psychologistFamilyPrice: psychologistPriceSchema,
  psychologistSipp: z.string().optional(),
  psychologistLicenseType: z.enum(["SIPP", "SILP"]).optional(),
  psychologistDescription: z.string().optional(),
  psychologistDetails: z.string().optional(),
  psychologistSignatureUrl: z.string().url("URL tanda tangan tidak valid").optional().or(z.literal("")),
  profileImageUrl: z.string().url("URL foto tidak valid").optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  data.psychologistConsultationTypes.forEach((type) => {
    const field = (type === "child" ? "psychologistChildPrice" : type === "adult" ? "psychologistAdultPrice" : "psychologistFamilyPrice") as "psychologistChildPrice" | "psychologistAdultPrice" | "psychologistFamilyPrice";
    if (!data[field]?.trim()) {
      ctx.addIssue({ code: "custom", path: [field], message: "Harga wajib diisi untuk jenis konsultasi aktif" });
    }
  });
});

const bookingReportSchema = z.object({
  meetingUrl: z.string().url("Link meeting tidak valid").optional().or(z.literal("")),
  sessionReport: z.string().max(5000).optional(),
  reportRecommendations: z.string().max(5000).optional(),
  clientReportNotes: z.string().max(5000).optional(),
  counselingHistoryNotes: z.string().max(5000).optional(),
  counselingSubjectiveNotes: z.string().max(5000).optional(),
  counselingObservations: z.array(z.string().max(100)).max(20).optional(),
  counselingResultNotes: z.string().max(5000).optional(),
  counselingPlanNotes: z.string().max(5000).optional(),
  submit: z.boolean().optional(),
  submitClientReport: z.boolean().optional(),
  submitHistoryReport: z.boolean().optional(),
});

const bookingScheduleUpdateSchema = z.object({
  preferredDate: z.string().min(4),
  preferredTime: z.string().regex(TIME_SLOT_PATTERN, "Format waktu harus HH.MM - HH.MM"),
  location: z.enum(["online", "colombo", "bantul"]),
  meetingUrl: z.string().url("Link meeting tidak valid").optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  const today = getJakartaDateString();
  const maxDate = addDaysToDateString(today, SCHEDULE_WINDOW_DAYS);
  if (data.preferredDate < today || data.preferredDate > maxDate) {
    ctx.addIssue({
      code: "custom",
      path: ["preferredDate"],
      message: "Tanggal booking hanya dapat dipilih sampai 30 hari ke depan",
    });
  }
  if (!isValidTimeSlotRange(data.preferredTime)) {
    ctx.addIssue({
      code: "custom",
      path: ["preferredTime"],
      message: "Waktu konseling harus berada antara 07.00-21.00",
    });
  }
});

const meetingLinkUpdateSchema = z.object({
  meetingUrl: z.string().url("Link meeting tidak valid").or(z.literal("")),
});

const availabilitySlotSchema = z.object({
  dayOfWeek: z.number().int().min(0).max(6),
  timeSlot: z.enum(TIME_SLOTS),
  isAvailable: z.boolean(),
});

const psychologistAvailabilityUpdateSchema = z.object({
  psychologistName: z.string().min(2).optional(),
  availability: z.array(availabilitySlotSchema).max(21),
});

const scheduleSlotSchema = z.object({
  scheduleDate: z.string().min(4),
  timeSlot: z.string().regex(TIME_SLOT_PATTERN, "Format waktu harus HH.MM - HH.MM"),
  location: z.enum(["online", "colombo", "bantul"]),
  isAvailable: z.boolean().optional(),
});

const psychologistScheduleUpdateSchema = z.object({
  psychologistName: z.string().min(2).optional(),
  month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Format bulan harus YYYY-MM").optional(),
  slots: z.array(scheduleSlotSchema).max(900),
});

const resetPasswordWithOtpSchema = z.object({
  email: z.string().email("Email tidak valid"),
  otp: z.string().length(6, "OTP harus 6 digit"),
  newPassword: z.string().min(8, "Password minimal 8 karakter"),
});

// Custom authentication middleware for JWT tokens
function isAuthenticated(req: any, res: any, next: any) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    const decoded = AuthUtils.verifyToken(token);
    
    if (!decoded || decoded.type !== 'access') {
      return res.status(401).json({ message: "Unauthorized" });
    }

    req.user = { 
      claims: { sub: decoded.userId }, 
      email: decoded.email,
      role: decoded.role || 'user'
    };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
}

function getDisplayName(user: { firstName?: string | null; lastName?: string | null }) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim();
}

function cleanOptionalText(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function normalizePsychologistProfileInput<T extends {
  psychologistConsultationTypes?: ConsultationType[] | null;
  psychologistChildPrice?: string | null;
  psychologistAdultPrice?: string | null;
  psychologistFamilyPrice?: string | null;
  psychologistSipp?: string | null;
  psychologistLicenseType?: "SIPP" | "SILP" | null;
  psychologistDescription?: string | null;
  psychologistDetails?: string | null;
  psychologistSignatureUrl?: string | null;
  profileImageUrl?: string | null;
}>(data: T) {
  return {
    psychologistConsultationTypes: data.psychologistConsultationTypes?.length ? data.psychologistConsultationTypes : null,
    psychologistChildPrice: cleanOptionalText(data.psychologistChildPrice),
    psychologistAdultPrice: cleanOptionalText(data.psychologistAdultPrice),
    psychologistFamilyPrice: cleanOptionalText(data.psychologistFamilyPrice),
    psychologistSipp: cleanOptionalText(data.psychologistSipp),
    psychologistLicenseType: data.psychologistLicenseType || null,
    psychologistDescription: cleanOptionalText(data.psychologistDescription),
    psychologistDetails: cleanOptionalText(data.psychologistDetails),
    psychologistSignatureUrl: cleanOptionalText(data.psychologistSignatureUrl),
    profileImageUrl: cleanOptionalText(data.profileImageUrl),
  };
}

function getJakartaDateString(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function getScreeningDateAccess(preferredDate: string) {
  const today = getJakartaDateString();
  if (preferredDate === today) return { canAccess: true, accessStatus: "available" as const };
  if (preferredDate > today) return { canAccess: false, accessStatus: "upcoming" as const };
  return { canAccess: false, accessStatus: "expired" as const };
}

function screeningDateAccessMessage(testName: string, preferredDate: string) {
  const { accessStatus } = getScreeningDateAccess(preferredDate);
  return accessStatus === "upcoming"
    ? `${testName} hanya dapat diakses pada tanggal konseling, yaitu ${preferredDate}`
    : `Masa akses ${testName} untuk jadwal konseling ${preferredDate} telah berakhir`;
}

function addDaysToDateString(dateString: string, days: number) {
  const [year, month, day] = dateString.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function getDayOfWeek(dateString: string) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

function normalizeTimeSlot(slot: string) {
  return slot.replace(/\./g, ":").replace(/\s*-\s*/, " - ");
}

function timeToMinutes(value: string) {
  const [hour, minute] = value.replace(".", ":").split(":").map(Number);
  return hour * 60 + minute;
}

function parseTimeSlotRange(slot: string) {
  const normalized = normalizeTimeSlot(slot);
  const [start, end] = normalized.split(" - ");
  if (!start || !end) return null;
  return {
    start,
    end,
    startMinutes: timeToMinutes(start),
    endMinutes: timeToMinutes(end),
  };
}

function isValidTimeSlotRange(slot: string) {
  const range = parseTimeSlotRange(slot);
  if (!range) return false;
  return range.startMinutes >= 7 * 60 && range.endMinutes <= 21 * 60 && range.startMinutes < range.endMinutes;
}

function isBookingReservationActive(booking: { status: string; order: { status: string; paymentStatus?: string | null; createdAt?: Date | string | null; updatedAt?: Date | string | null } }) {
  if (booking.status === "paid" || booking.order.status === "completed" || booking.order.paymentStatus === "paid") return true;
  if (booking.order.status !== "pending" || ["expired", "cancelled", "failed"].includes(booking.order.paymentStatus ?? "")) return false;
  const referenceTime = booking.order.updatedAt ?? booking.order.createdAt;
  return Boolean(referenceTime && Date.now() - new Date(referenceTime).getTime() < PAYMENT_EXPIRY_MINUTES * 60 * 1000);
}

function findOverlappingScheduleSlot(slots: { scheduleDate: string; timeSlot: string; isAvailable?: boolean }[]) {
  const slotsByDate = new Map<string, { timeSlot: string; startMinutes: number; endMinutes: number }[]>();

  for (const slot of slots) {
    if (slot.isAvailable === false) continue;
    const range = parseTimeSlotRange(slot.timeSlot);
    if (!range) continue;
    const dateSlots = slotsByDate.get(slot.scheduleDate) ?? [];
    if (!dateSlots.some((item) => item.timeSlot === slot.timeSlot)) {
      dateSlots.push({
        timeSlot: slot.timeSlot,
        startMinutes: range.startMinutes,
        endMinutes: range.endMinutes,
      });
    }
    slotsByDate.set(slot.scheduleDate, dateSlots);
  }

  for (const [scheduleDate, dateSlots] of slotsByDate.entries()) {
    const sortedSlots = dateSlots.sort((a, b) => a.startMinutes - b.startMinutes);
    for (let index = 1; index < sortedSlots.length; index += 1) {
      const previous = sortedSlots[index - 1];
      const current = sortedSlots[index];
      if (!previous || !current) continue;
      if (current.startMinutes < previous.endMinutes) {
        return { scheduleDate, previous: previous.timeSlot, current: current.timeSlot };
      }
    }
  }

  return null;
}

function scheduleRange() {
  const today = getJakartaDateString();
  return {
    startDate: today,
    endDate: addDaysToDateString(today, SCHEDULE_WINDOW_DAYS),
  };
}

function formatDisplayDate(value?: string | Date | null) {
  if (!value) return "-";
  if (value instanceof Date) {
    return formatDateParts(value.getFullYear(), value.getMonth() + 1, value.getDate());
  }
  const isoDateMatch = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoDateMatch) {
    return `${isoDateMatch[3]}/${isoDateMatch[2]}/${isoDateMatch[1]}`;
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return formatDateParts(parsed.getFullYear(), parsed.getMonth() + 1, parsed.getDate());
}

function formatDateParts(year: number, month: number, day: number) {
  return `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}/${year}`;
}

async function isPsychologistAvailable(psychologistName: string, preferredDate: string, preferredTime: string, location = "online", excludeBookingId?: number) {
  const normalizedTime = normalizeTimeSlot(preferredTime);
  const requestedRange = parseTimeSlotRange(normalizedTime);
  const bookings = await storage.getPsychologistBookingsByProvider(psychologistName);
  const alreadyPaid = bookings.some((booking) =>
    booking.id !== excludeBookingId &&
    isBookingReservationActive(booking) &&
    booking.preferredDate === preferredDate &&
    (() => {
      const bookingRange = parseTimeSlotRange(booking.preferredTime);
      if (!requestedRange || !bookingRange) return normalizeTimeSlot(booking.preferredTime) === normalizedTime;
      return requestedRange.startMinutes < bookingRange.endMinutes && bookingRange.startMinutes < requestedRange.endMinutes;
    })()
  );
  if (alreadyPaid) return false;

  const scheduleSlots = await storage.getPsychologistScheduleSlots(psychologistName, preferredDate, preferredDate);
  if (scheduleSlots.length > 0) {
    return scheduleSlots.some((item) => {
      const matchesTime = item.scheduleDate === preferredDate && item.timeSlot === normalizedTime && item.isAvailable;
      if (!matchesTime) return false;
      return location === "online" || item.location === location;
    });
  }

  const availability = await storage.getPsychologistAvailability(psychologistName);
  if (availability.length === 0) return true;
  const dayOfWeek = getDayOfWeek(preferredDate);
  const slot = availability.find((item) => item.dayOfWeek === dayOfWeek && item.timeSlot === preferredTime);
  return slot?.isAvailable !== false;
}

function getClientReportText(booking: any) {
  return booking.clientReportNotes || booking.reportRecommendations || "";
}

function getHistoryReportText(booking: any) {
  return booking.counselingResultNotes || booking.counselingHistoryNotes || booking.sessionReport || "";
}

function createWaNotificationPlaceholder(event: string, details: Record<string, unknown>) {
  console.log(`[WA PLACEHOLDER] ${event}`, details);
  return {
    status: "placeholder",
    enabled: false,
    message: "WhatsApp notification is not active yet. Waiting for WhatsApp Business API setup.",
  };
}

const OBSERVATION_OPTIONS = [
  { value: "clean_appearance", label: "Penampilan bersih, rapi dan terawat" },
  { value: "notable_physical_signs", label: "Terdapat tanda fisik yang mencolok (tato/bekas luka, tremor, penggunaan alat bantu)" },
  { value: "maintains_eye_contact", label: "Mampu menjaga kontak mata" },
  { value: "repetitive_movements", label: "Adanya gerakan berulang (tic, menggigit kuku, mengetuk-ngetuk jari)" },
  { value: "cooperative", label: "Kooperatif, mampu merespon dan mengikuti instruksi" },
  { value: "emotional_problem", label: "Terdapat masalah emosi" },
  { value: "communication_barrier", label: "Ada hambatan komunikasi" },
  { value: "perception_thought_problem", label: "Ada masalah persepsi dan proses berpikir" },
] as const;

function getReportAssetPath(fileName: string) {
  const candidates = [
    path.resolve(process.cwd(), "src/assets/report", fileName),
    path.resolve(process.cwd(), "artifacts/api-server/src/assets/report", fileName),
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

async function getSignatureImage(signatureUrl?: string | null) {
  if (!signatureUrl) return undefined;
  if (signatureUrl.startsWith("asset:")) {
    return getReportAssetPath(signatureUrl.slice("asset:".length));
  }
  if (!/^https?:\/\//i.test(signatureUrl)) return undefined;
  try {
    const response = await fetch(signatureUrl);
    if (!response.ok) return undefined;
    return Buffer.from(await response.arrayBuffer());
  } catch {
    return undefined;
  }
}

function formatLongIndonesianDate(value?: string | Date | null, includeDay = false) {
  if (!value) return "-";
  const date = value instanceof Date
    ? value
    : /^\d{4}-\d{2}-\d{2}/.test(value)
      ? new Date(`${value.slice(0, 10)}T00:00:00+07:00`)
      : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    weekday: includeDay ? "long" : undefined,
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function calculateAgeAtDate(birthDate?: string | null, referenceDate?: string | null) {
  if (!birthDate || !/^\d{4}-\d{2}-\d{2}/.test(birthDate)) return null;
  const birth = new Date(`${birthDate.slice(0, 10)}T00:00:00+07:00`);
  const reference = referenceDate && /^\d{4}-\d{2}-\d{2}/.test(referenceDate)
    ? new Date(`${referenceDate.slice(0, 10)}T00:00:00+07:00`)
    : new Date();
  let age = reference.getFullYear() - birth.getFullYear();
  const monthDifference = reference.getMonth() - birth.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && reference.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

function extractConcernField(concernHistory: string | null | undefined, label: string) {
  if (!concernHistory) return null;
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return concernHistory.match(new RegExp(`^${escapedLabel}:\\s*(.+)$`, "im"))?.[1]?.trim() || null;
}

function drawReportHeader(doc: PDFKit.PDFDocument, compact = false) {
  const logoPath = getReportAssetPath("rppi-logo.png");
  const left = doc.page.margins.left;
  const width = doc.page.width - left - doc.page.margins.right;
  const top = doc.page.margins.top;
  const headerTop = Math.max(28, top - 16);
  const logoSize = compact ? 64 : 68;
  const contentLeft = left + 82;
  const contentWidth = width - 164;

  if (logoPath) {
    doc.image(logoPath, left + 8, headerTop, { fit: [logoSize, logoSize], align: "center", valign: "center" });
  }

  doc.fillColor("#347c26").font("Helvetica").fontSize(16.5)
    .text("Rumah Psikologi Pelangi Indonesia", contentLeft, headerTop + 8, { width: contentWidth, align: "center" });

  const contactTop = headerTop + 40;
  doc.fillColor("#111").font("Helvetica").fontSize(8)
    .text("Jl. Colombo No. 8, Samirono, Caturtunggal, Depok, Sleman, Yogyakarta 55281", contentLeft, contactTop, { width: contentWidth, align: "center" })
    .text("Jl. Mgr. Sugiyo Pranoto No. 14, Melikan Kidul, Bantul, Yogyakarta 55711", contentLeft, doc.y, { width: contentWidth, align: "center" })
    .text("Hotline: 0851-1765-8242 | Email: psikologi.pelangiindonesia@gmail.com", contentLeft, doc.y, { width: contentWidth, align: "center" });

  const lineY = Math.max(headerTop + logoSize + 5, doc.y + 6);
  doc.strokeColor("#145d78").lineWidth(1.15).moveTo(left, lineY).lineTo(left + width, lineY).stroke();
  doc.y = lineY + (compact ? 11 : 14);
}

function scheduleMonthRange(monthValue: string) {
  const match = monthValue.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return {
    startDate: `${monthValue}-01`,
    endDate: `${monthValue}-${String(lastDay).padStart(2, "0")}`,
  };
}

function ensureReportSpace(doc: PDFKit.PDFDocument, requiredHeight: number) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + requiredHeight <= bottom) return;
  doc.addPage();
  drawReportHeader(doc, true);
}

function drawLabelValue(doc: PDFKit.PDFDocument, label: string, value: string, labelWidth = 115) {
  const x = doc.page.margins.left;
  const y = doc.y;
  const width = doc.page.width - x - doc.page.margins.right;
  const textHeight = Math.max(
    doc.font("Helvetica-Bold").fontSize(10).heightOfString(label, { width: labelWidth }),
    doc.font("Helvetica").heightOfString(value || "-", { width: width - labelWidth - 8 }),
  );
  ensureReportSpace(doc, textHeight + 6);
  doc.font("Helvetica-Bold").fillColor("#222").text(label, x, y, { width: labelWidth });
  doc.font("Helvetica").text(value || "-", x + labelWidth, y, { width: width - labelWidth, lineGap: 2 });
  doc.y = y + textHeight + 6;
}

function drawClinicalSection(doc: PDFKit.PDFDocument, title: string, text: string, color: string, note?: string) {
  const x = doc.page.margins.left;
  const width = doc.page.width - x - doc.page.margins.right;
  let remaining = text.trim() || "-";
  let continuation = false;

  while (remaining) {
    ensureReportSpace(doc, 118);
    doc.font("Helvetica").fontSize(9.5);
    const pageBottom = doc.page.height - doc.page.margins.bottom;
    const availableContentHeight = Math.max(60, pageBottom - doc.y - 54);
    const tokens = remaining.match(/\S+\s*/g) || [remaining];
    let low = 1;
    let high = tokens.length;
    let best = 1;
    while (low <= high) {
      const middle = Math.floor((low + high) / 2);
      const candidate = tokens.slice(0, middle).join("").trimEnd();
      const height = doc.heightOfString(candidate, { width: width - 24, lineGap: 3 });
      if (height <= availableContentHeight) {
        best = middle;
        low = middle + 1;
      } else {
        high = middle - 1;
      }
    }

    const chunk = tokens.slice(0, best).join("").trim();
    remaining = tokens.slice(best).join("").trim();
    const contentHeight = doc.heightOfString(chunk, { width: width - 24, lineGap: 3 });
    const boxHeight = Math.max(92, contentHeight + 42);
    const y = doc.y;
    doc.strokeColor("#777").lineWidth(0.7).rect(x, y, width, boxHeight).stroke();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(color)
      .text(`${title}${continuation ? " (LANJUTAN)" : ""}`, x + 10, y + 8, { width: width - 20 });
    doc.font("Helvetica").fontSize(9.5).fillColor("#222")
      .text(chunk, x + 12, y + 28, { width: width - 24, lineGap: 3 });
    doc.y = y + boxHeight + 5;

    if (remaining) {
      doc.addPage();
      drawReportHeader(doc, true);
      continuation = true;
      continue;
    }

    if (note) {
      ensureReportSpace(doc, 24);
      doc.font("Helvetica-Oblique").fontSize(8.3).fillColor("#596579").text(note, x + 8, doc.y, { width: width - 16 });
      doc.y += 10;
    }
    doc.y += 8;
  }
}

function drawObservationSection(doc: PDFKit.PDFDocument, selectedValues: string[]) {
  const x = doc.page.margins.left;
  const width = doc.page.width - x - doc.page.margins.right;
  ensureReportSpace(doc, 132);
  const y = doc.y;
  doc.strokeColor("#777").lineWidth(0.7).rect(x, y, width, 124).stroke();
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#2166d1").text("OBSERVASI", x + 10, y + 8);
  const columnWidth = (width - 30) / 2;
  OBSERVATION_OPTIONS.forEach((option, index) => {
    const column = index < 4 ? 0 : 1;
    const row = index % 4;
    const itemX = x + 12 + column * (columnWidth + 8);
    const itemY = y + 30 + row * 22;
    const checked = selectedValues.includes(option.value);
    doc.lineWidth(0.8).strokeColor(checked ? "#178253" : "#777").rect(itemX, itemY, 9, 9).stroke();
    if (checked) {
      doc.lineWidth(1.4).moveTo(itemX + 2, itemY + 5).lineTo(itemX + 4, itemY + 8).lineTo(itemX + 8, itemY + 2).stroke();
    }
    doc.font("Helvetica").fontSize(7.8).fillColor("#253248").text(option.label, itemX + 14, itemY - 1, { width: columnWidth - 18, height: 21 });
  });
  doc.y = y + 136;
}

async function drawPsychologistSignature(doc: PDFKit.PDFDocument, booking: any, psychologist?: PsychologistOption) {
  ensureReportSpace(doc, 175);
  const width = 235;
  const x = doc.page.width - doc.page.margins.right - width;
  const reportDate = booking.reportSubmittedAt || new Date();
  doc.font("Helvetica").fontSize(9.5).fillColor("#222")
    .text(`Yogyakarta, ${formatLongIndonesianDate(reportDate)}`, x, doc.y, { width, align: "center" })
    .text("Psikolog,", { width, align: "center" });
  const signature = await getSignatureImage(psychologist?.signatureUrl);
  const stamp = getReportAssetPath("rppi-stamp.png");
  const imageY = doc.y + 4;
  if (signature) doc.image(signature, x + 32, imageY, { fit: [171, 72], align: "center", valign: "center" });
  if (stamp) {
    doc.save().opacity(0.72).image(stamp, x + 106, imageY + 2, { fit: [68, 68] }).restore();
  }
  doc.y = imageY + 76;
  doc.font("Helvetica-Bold").fontSize(9.2).text(booking.psychologistName || psychologist?.name || "-", x, doc.y, { width, align: "center" });
  doc.font("Helvetica").fontSize(8.7).text(`${psychologist?.licenseType || "SIPP"}: ${psychologist?.sipp || "-"}`, x, doc.y + 3, { width, align: "center" });
  doc.y += 24;
}

export async function streamClientCounselingReportPdf(res: any, booking: any, psychologist?: PsychologistOption) {
  const fileName = `laporan-konseling-${booking.clientName || "klien"}-${booking.id}.pdf`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  const doc = new PDFDocument({ size: "A4", margin: 48, info: { Title: "Laporan Konseling Psikologi" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  doc.pipe(res);

  drawReportHeader(doc);
  doc.font("Helvetica-Bold").fontSize(15).fillColor("#111").text("LAPORAN KONSELING PSIKOLOGI", { align: "center" });
  doc.moveDown(1.5);
  drawLabelValue(doc, "Hari/Tanggal", formatLongIndonesianDate(booking.preferredDate, true));
  drawLabelValue(doc, "Nama Klien", booking.clientName || "-");
  drawLabelValue(doc, "Nama Psikolog", booking.psychologistName || "-");
  doc.moveDown(0.5);
  drawClinicalSection(doc, "CATATAN HASIL KONSELING", getClientReportText(booking), "#178253");
  drawClinicalSection(doc, "REKOMENDASI (OPSIONAL)", booking.reportRecommendations || "-", "#315a29");
  await drawPsychologistSignature(doc, booking, psychologist);
  doc.end();
}

function getDassScaleLabel(itemNumber: number) {
  if ((DASS_DEPRESSION_ITEMS as readonly number[]).includes(itemNumber)) return "Depresi";
  if ((DASS_ANXIETY_ITEMS as readonly number[]).includes(itemNumber)) return "Kecemasan";
  return "Stres";
}

function drawDassAnswerTableHeader(doc: PDFKit.PDFDocument) {
  const x = doc.page.margins.left;
  const width = doc.page.width - x - doc.page.margins.right;
  const columns = { number: 25, scale: 64, answer: 142 };
  const questionWidth = width - columns.number - columns.scale - columns.answer;
  const y = doc.y;
  doc.rect(x, y, width, 25).fill("#315a78");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#ffffff")
    .text("No.", x + 4, y + 8, { width: columns.number - 8, align: "center" })
    .text("Skala", x + columns.number + 5, y + 8, { width: columns.scale - 10 })
    .text("Pernyataan", x + columns.number + columns.scale + 5, y + 8, { width: questionWidth - 10 })
    .text("Jawaban", x + width - columns.answer + 5, y + 8, { width: columns.answer - 10 });
  doc.y = y + 25;
}

function startDassAnswerPage(doc: PDFKit.PDFDocument, continuation = false) {
  if (continuation) {
    doc.addPage();
  }
  const x = doc.page.margins.left;
  const width = doc.page.width - x - doc.page.margins.right;
  doc.font("Helvetica-Bold").fontSize(11).fillColor("#243047")
    .text(`JAWABAN LENGKAP${continuation ? " (LANJUTAN)" : ""}`, x, doc.y, { width });
  doc.moveDown(0.45);
  drawDassAnswerTableHeader(doc);
}

export function streamDassScreeningReportPdf(res: any, screening: any, booking: any) {
  const fileName = `laporan-dass-${booking.clientName || "klien"}-${screening.id}.pdf`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  const doc = new PDFDocument({ size: "A4", margin: 42, info: { Title: "Laporan Tes DASS" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  doc.pipe(res);
  doc.on("pageAdded", () => drawReportHeader(doc, true));

  drawReportHeader(doc, true);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#243047")
    .text("LAPORAN TES DASS", { align: "center" });
  doc.font("Helvetica").fontSize(9).fillColor("#596579")
    .text("Depression Anxiety Stress Scale - 42 Item", { align: "center" });
  doc.moveDown(1.1);
  drawLabelValue(doc, "Nama Klien", booking.clientName || "-", 120);
  drawLabelValue(doc, "Psikolog", booking.psychologistName || "-", 120);
  drawLabelValue(doc, "Jadwal Konseling", `${formatLongIndonesianDate(booking.preferredDate, true)}, ${booking.preferredTime || "-"}`, 120);
  drawLabelValue(doc, "Tanggal Pengisian", formatLongIndonesianDate(screening.completedAt, true), 120);
  doc.moveDown(0.35);

  const scores = [
    { label: "Depresi", score: screening.depressionScore, category: screening.depressionCategory, color: "#315a78" },
    { label: "Kecemasan", score: screening.anxietyScore, category: screening.anxietyCategory, color: "#347c26" },
    { label: "Stres", score: screening.stressScore, category: screening.stressCategory, color: "#a56514" },
  ];
  const x = doc.page.margins.left;
  const contentWidth = doc.page.width - x - doc.page.margins.right;
  const gap = 10;
  const cardWidth = (contentWidth - gap * 2) / 3;
  const scoreY = doc.y;
  scores.forEach((item, index) => {
    const cardX = x + index * (cardWidth + gap);
    doc.roundedRect(cardX, scoreY, cardWidth, 61, 5).fillAndStroke("#f8fafc", "#cbd5e1");
    doc.font("Helvetica-Bold").fontSize(8).fillColor(item.color).text(item.label.toUpperCase(), cardX + 9, scoreY + 9, { width: cardWidth - 18 });
    doc.font("Helvetica-Bold").fontSize(18).fillColor("#111827").text(String(item.score), cardX + 9, scoreY + 25, { width: 42 });
    doc.font("Helvetica").fontSize(8.5).fillColor("#334155").text(item.category, cardX + 51, scoreY + 31, { width: cardWidth - 60, align: "right" });
  });
  doc.y = scoreY + 74;
  doc.font("Helvetica-Oblique").fontSize(8).fillColor("#596579")
    .text("DASS-42 merupakan instrumen screening, bukan diagnosis. Interpretasi hasil perlu mempertimbangkan informasi klinis dan proses konseling.", x, doc.y, { width: contentWidth, lineGap: 2 });
  doc.moveDown(0.9);

  startDassAnswerPage(doc);
  const columns = { number: 25, scale: 64, answer: 142 };
  const questionWidth = contentWidth - columns.number - columns.scale - columns.answer;
  screening.answers.forEach((answer: number, index: number) => {
    const question = DASS_QUESTIONS[index] || `Pernyataan ${index + 1}`;
    const answerLabel = `${answer} - ${DASS_RESPONSE_LABELS[answer] || "-"}`;
    doc.font("Helvetica").fontSize(7.5);
    const rowHeight = Math.max(
      31,
      doc.heightOfString(question, { width: questionWidth - 10, lineGap: 1.5 }) + 12,
      doc.heightOfString(answerLabel, { width: columns.answer - 10, lineGap: 1.5 }) + 12,
    );
    const bottom = doc.page.height - doc.page.margins.bottom;
    // PDFKit can advance a page while laying out wrapped text near the bottom.
    // Keep a conservative buffer so every continuation page is created here and receives the report header.
    if (doc.y + rowHeight + 30 > bottom) startDassAnswerPage(doc, true);

    const rowY = doc.y;
    const background = index % 2 === 0 ? "#f8fafc" : "#ffffff";
    doc.rect(x, rowY, contentWidth, rowHeight).fillAndStroke(background, "#d7dee8");
    const boundaries = [x + columns.number, x + columns.number + columns.scale, x + contentWidth - columns.answer];
    boundaries.forEach((boundary) => doc.moveTo(boundary, rowY).lineTo(boundary, rowY + rowHeight).strokeColor("#d7dee8").stroke());
    doc.font("Helvetica-Bold").fontSize(7.5).fillColor("#243047")
      .text(String(index + 1), x + 4, rowY + 7, { width: columns.number - 8, align: "center" })
      .text(getDassScaleLabel(index + 1), x + columns.number + 5, rowY + 7, { width: columns.scale - 10 });
    doc.font("Helvetica").fillColor("#222")
      .text(question, x + columns.number + columns.scale + 5, rowY + 7, { width: questionWidth - 10, height: rowHeight - 12, lineGap: 1.5 })
      .text(answerLabel, x + contentWidth - columns.answer + 5, rowY + 7, { width: columns.answer - 10, height: rowHeight - 12, lineGap: 1.5 });
    doc.y = rowY + rowHeight;
  });

  doc.moveDown(0.8);
  doc.font("Helvetica-Oblique").fontSize(7.8).fillColor("#596579")
    .text("Dokumen ini bersifat rahasia dan ditujukan untuk psikolog yang menangani klien.", x, doc.y, { width: contentWidth, align: "center" });
  doc.end();
}

export async function streamHistoryCounselingReportPdf(res: any, booking: any, psychologist?: PsychologistOption) {
  const fileName = `riwayat-konseling-${booking.clientName || "klien"}-${booking.id}.pdf`.replace(/[^a-z0-9.-]+/gi, "-").toLowerCase();
  const doc = new PDFDocument({ size: "A4", margin: 42, info: { Title: "Laporan Hasil Pemeriksaan Psikologis" } });
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename="${fileName}"`);
  doc.pipe(res);

  drawReportHeader(doc, true);
  doc.font("Helvetica-Bold").fontSize(14).fillColor("#243047").text("LAPORAN HASIL PEMERIKSAAN PSIKOLOGIS", { align: "center" });
  doc.moveDown(1.2);
  const birthDate = booking.birthDate || booking.childBirthDate;
  const age = booking.age ?? calculateAgeAtDate(birthDate, booking.preferredDate);
  const gender = booking.gender === "male"
    ? "Laki-laki"
    : booking.gender === "female"
      ? "Perempuan"
      : extractConcernField(booking.concernHistory, "Jenis kelamin") || "-";
  drawLabelValue(doc, "Nama Pasien / Klien", booking.clientName || "-", 135);
  drawLabelValue(doc, "No. Identitas", "-", 135);
  drawLabelValue(doc, "Tanggal Lahir / Usia", `${formatDisplayDate(birthDate)}${age !== null ? ` / ${age} tahun` : ""}`, 135);
  drawLabelValue(doc, "Jenis Kelamin", gender, 135);
  drawLabelValue(doc, "Tanggal Pemeriksaan", formatDisplayDate(booking.preferredDate), 135);
  drawLabelValue(doc, "Pemeriksa / Psikolog", booking.psychologistName || "-", 135);
  doc.moveDown(0.5);
  drawClinicalSection(
    doc,
    "KELUHAN & RIWAYAT SUBJEKTIF",
    booking.counselingSubjectiveNotes || booking.mainConcern || "-",
    "#c86400",
    "Catatan: Meliputi keluhan yang dirasakan atau dialami oleh klien saat ini.",
  );
  drawObservationSection(doc, booking.counselingObservations || []);
  drawClinicalSection(
    doc,
    "HASIL KONSELING",
    booking.counselingResultNotes || booking.counselingHistoryNotes || booking.sessionReport || "-",
    "#178253",
    "Catatan: Meliputi hasil anamnesa (riwayat kasus), serta gambaran diagnosa.",
  );
  drawClinicalSection(
    doc,
    "RENCANA PENATALAKSANAAN",
    booking.counselingPlanNotes || "-",
    "#8a3ffc",
    "Catatan: Meliputi tindakan yang diberikan saat sesi, tugas rumah dan jadwal konseling berikutnya (jika ada).",
  );
  await drawPsychologistSignature(doc, booking, psychologist);
  ensureReportSpace(doc, 26);
  doc.font("Helvetica-Oblique").fontSize(8.5).fillColor("#7f8ca3")
    .text("*Laporan ini bersifat rahasia dan merupakan hak medis klinis klien.", doc.page.margins.left, doc.y + 5);
  doc.end();
}

// Result calculation functions
function calculateSensoryProfileResults(responses: any, participantInfo: any) {
  // Mapping berdasarkan PDF Sensory Profile asli
  const sectionQuestions = {
    A: [1, 2, 3, 4, 5, 6, 7, 8], // Pemrosesan Pendengaran (8 items)
    B: [9, 10, 11, 12, 13, 14, 15, 16, 17], // Pemrosesan Visual (9 items)
    C: [18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28], // Pemrosesan Vestibular (11 items)
    D: [29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46], // Pemrosesan Sentuhan (18 items)
    E: [47, 48, 49, 50, 51, 52, 53], // Pemrosesan Multisensori (7 items)
    F: [54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65], // Pengolahan Sensorik Oral (12 items)
    G: [66, 67, 68, 69, 70, 71, 72, 73, 74], // Pemrosesan Sensorik Terkait Daya Tahan/Keselarasan (9 items)
    H: [75, 76, 77, 78, 79, 80, 81, 82, 83, 84], // Modulasi Berkaitan dengan Posisi dan Gerakan Tubuh (10 items)
    I: [85, 86, 87, 88, 89, 90, 91], // Modulasi Gerakan yang Mempengaruhi Tingkat Aktivitas (7 items)
    J: [92, 93, 94, 95], // Modulasi Input Sensorik yang Mempengaruhi Respon Emosional (4 items)
    K: [96, 97, 98, 99], // Modulasi Input Visual yang Mempengaruhi Respon Emosional dan Tingkat Aktivitas (4 items)
    L: [100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125] // Respon Emosional/Sosial (26 items)
  };

  const sectionScores: any = {};
  let totalScore = 0;
  let totalResponses = 0;

  // Calculate scores for each section
  for (const [section, questions] of Object.entries(sectionQuestions)) {
    let sectionTotal = 0;
    let sectionCount = 0;
    
    for (const questionId of questions) {
      const response = responses[questionId.toString()];
      if (response && response !== 'NA') {
        sectionTotal += parseInt(response);
        sectionCount++;
      }
    }
    
    sectionScores[section] = {
      total: sectionTotal,
      count: sectionCount,
      average: sectionCount > 0 ? (sectionTotal / sectionCount).toFixed(2) : 0
    };
    
    totalScore += sectionTotal;
    totalResponses += sectionCount;
  }

  // Determine sensory patterns
  const patterns = determineSensoryPatterns(sectionScores);
  
  return {
    responses,
    participantInfo,
    totalScore,
    totalResponses,
    averageScore: totalResponses > 0 ? (totalScore / totalResponses).toFixed(2) : 0,
    sectionScores,
    patterns,
    completedAt: new Date().toISOString()
  };
}

function calculateLearningStyleResults(responses: any, participantInfo: any) {
  const styleScores = {
    visual: 0,
    auditori: 0,
    kinestetik: 0
  };

  // Validate responses parameter
  if (!responses || typeof responses !== 'object') {
    console.error('Invalid responses parameter:', responses);
    return {
      responses: responses || {},
      participantInfo: participantInfo || {},
      primaryStyle: 'visual',
      styleScores,
      totalResponses: 0,
      completedAt: new Date().toISOString()
    };
  }

  // Count responses for each learning style
  for (const [questionId, response] of Object.entries(responses)) {
    if (response) {
      styleScores[response as keyof typeof styleScores]++;
    }
  }

  // Determine primary learning style
  const primaryStyle = Object.entries(styleScores).reduce((a, b) => 
    styleScores[a[0] as keyof typeof styleScores] > styleScores[b[0] as keyof typeof styleScores] ? a : b
  )[0];

  const totalResponses = Object.values(styleScores).reduce((a, b) => a + b, 0);
  
  return {
    responses,
    participantInfo,
    styleScores,
    primaryStyle,
    totalResponses,
    percentages: {
      visual: totalResponses > 0 ? ((styleScores.visual / totalResponses) * 100).toFixed(1) : 0,
      auditori: totalResponses > 0 ? ((styleScores.auditori / totalResponses) * 100).toFixed(1) : 0,
      kinestetik: totalResponses > 0 ? ((styleScores.kinestetik / totalResponses) * 100).toFixed(1) : 0
    },
    completedAt: new Date().toISOString()
  };
}

const MENTAL_HEALTH_DOMAIN_ITEMS = {
  anxiety: ["anxiety_1", "anxiety_2", "anxiety_3", "anxiety_4", "anxiety_5", "anxiety_6"],
  stress: ["stress_1", "stress_2", "stress_3", "stress_4", "stress_5", "stress_6"],
  depression: ["depression_1", "depression_2", "depression_3", "depression_4", "depression_5", "depression_6"],
  burnout: ["burnout_1", "burnout_2", "burnout_3", "burnout_4", "burnout_5", "burnout_6"],
} as const;

function getMentalHealthAttentionLevel(score: number) {
  if (score <= 4) return { key: "low", label: "Rendah", color: "green" };
  if (score <= 8) return { key: "mild", label: "Perlu dipantau", color: "blue" };
  if (score <= 13) return { key: "elevated", label: "Perlu perhatian", color: "orange" };
  return { key: "high", label: "Perlu perhatian tinggi", color: "red" };
}

function calculateMentalHealthCheckupResults(responses: any, participantInfo: any) {
  const safeResponses = responses && typeof responses === "object" ? responses : {};
  const domainScores = Object.fromEntries(
    Object.entries(MENTAL_HEALTH_DOMAIN_ITEMS).map(([domain, itemIds]) => {
      const score = itemIds.reduce((total, itemId) => {
        const value = Number(safeResponses[itemId]);
        return total + (Number.isInteger(value) && value >= 0 && value <= 3 ? value : 0);
      }, 0);
      return [domain, { score, maxScore: itemIds.length * 3, level: getMentalHealthAttentionLevel(score) }];
    }),
  );
  const safetyResponse = Number(safeResponses.safety_1);

  return {
    responses: safeResponses,
    participantInfo: participantInfo || {},
    domainScores,
    safetyFlag: Number.isInteger(safetyResponse) && safetyResponse > 0,
    timeframe: "2 minggu terakhir",
    instrumentNote: "Skrining internal non-diagnostik; bukan alat penegakan diagnosis klinis.",
    completedAt: new Date().toISOString(),
  };
}

const STUDENT_COGNITIVE_ITEMS: Record<string, { answer: string; domain: string }> = {
  cog_1: { answer: "C", domain: "Verbal" }, cog_2: { answer: "B", domain: "Verbal" },
  cog_3: { answer: "D", domain: "Verbal" }, cog_4: { answer: "C", domain: "Numerik" },
  cog_5: { answer: "B", domain: "Numerik" }, cog_6: { answer: "D", domain: "Numerik" },
  cog_7: { answer: "B", domain: "Logis" }, cog_8: { answer: "C", domain: "Logis" },
  cog_9: { answer: "A", domain: "Spasial" }, cog_10: { answer: "D", domain: "Spasial" },
};

const STUDENT_EQ_SCORES: Record<string, Record<string, number>> = {
  eq_1: { A: 0, B: 1, C: 3, D: 2 }, eq_2: { A: 1, B: 3, C: 0, D: 2 },
  eq_3: { A: 0, B: 2, C: 3, D: 1 }, eq_4: { A: 3, B: 1, C: 0, D: 2 },
  eq_5: { A: 1, B: 0, C: 2, D: 3 }, eq_6: { A: 2, B: 3, C: 0, D: 1 },
};

const STUDENT_PERSONALITY_ITEMS: Record<string, { trait: string; reverse?: boolean }> = {
  per_1: { trait: "Keterbukaan" }, per_2: { trait: "Keterbukaan", reverse: true },
  per_3: { trait: "Ketekunan" }, per_4: { trait: "Ketekunan", reverse: true },
  per_5: { trait: "Sosial" }, per_6: { trait: "Sosial", reverse: true },
  per_7: { trait: "Kerja Sama" }, per_8: { trait: "Kerja Sama", reverse: true },
  per_9: { trait: "Ketenangan Emosi" }, per_10: { trait: "Ketenangan Emosi", reverse: true },
};

const STUDENT_INTEREST_ITEMS: Record<string, string> = {
  int_1: "R", int_2: "R", int_3: "I", int_4: "I", int_5: "A", int_6: "A",
  int_7: "S", int_8: "S", int_9: "E", int_10: "E", int_11: "C", int_12: "C",
};

const STUDENT_INTEREST_INFO: Record<string, { label: string; fields: string[]; activities: string[] }> = {
  R: { label: "Realistic (Praktis)", fields: ["Teknik, teknologi terapan, olahraga, dan bidang vokasi"], activities: ["Klub robotika atau engineering", "Proyek lapangan dan praktik langsung"] },
  I: { label: "Investigative (Analitis)", fields: ["Sains, kesehatan, matematika, data, dan riset"], activities: ["Klub sains atau karya ilmiah", "Eksperimen dan proyek analisis data"] },
  A: { label: "Artistic (Kreatif)", fields: ["Desain, bahasa, media, seni, dan industri kreatif"], activities: ["Membangun portofolio kreatif", "Teater, musik, desain, atau penulisan"] },
  S: { label: "Social (Menolong)", fields: ["Psikologi, pendidikan, kesehatan, dan layanan sosial"], activities: ["Relawan dan kegiatan sosial", "Mentoring atau tutor sebaya"] },
  E: { label: "Enterprising (Persuasif)", fields: ["Bisnis, hukum, komunikasi, manajemen, dan pemasaran"], activities: ["Kewirausahaan siswa", "Debat, organisasi, dan kepemimpinan"] },
  C: { label: "Conventional (Terstruktur)", fields: ["Akuntansi, administrasi, sistem informasi, dan pengelolaan data"], activities: ["Bendahara atau administrasi organisasi", "Proyek pengolahan data dan perencanaan"] },
};

function getStudentPotentialBand(percentage: number) {
  if (percentage >= 80) return "Sangat kuat";
  if (percentage >= 65) return "Kuat";
  if (percentage >= 45) return "Cukup berkembang";
  return "Perlu dikembangkan";
}

function calculateStudentPotentialResults(responses: any, participantInfo: any) {
  const safe = responses && typeof responses === "object" ? responses : {};
  const domainScores: Record<string, { score: number; maxScore: number; percentage: number }> = {};
  let cognitiveScore = 0;
  Object.entries(STUDENT_COGNITIVE_ITEMS).forEach(([id, item]) => {
    if (!domainScores[item.domain]) domainScores[item.domain] = { score: 0, maxScore: 0, percentage: 0 };
    domainScores[item.domain].maxScore += 1;
    if (safe[id] === item.answer) { cognitiveScore += 1; domainScores[item.domain].score += 1; }
  });
  Object.values(domainScores).forEach((domain) => { domain.percentage = Math.round((domain.score / domain.maxScore) * 100); });
  const cognitivePercentage = Math.round((cognitiveScore / Object.keys(STUDENT_COGNITIVE_ITEMS).length) * 100);

  const emotionalScore = Object.entries(STUDENT_EQ_SCORES).reduce((total, [id, scores]) => total + (scores[String(safe[id])] || 0), 0);
  const emotionalMax = Object.keys(STUDENT_EQ_SCORES).length * 3;
  const emotionalPercentage = Math.round((emotionalScore / emotionalMax) * 100);

  const personalityMap: Record<string, { score: number; maxScore: number }> = {};
  Object.entries(STUDENT_PERSONALITY_ITEMS).forEach(([id, item]) => {
    if (!personalityMap[item.trait]) personalityMap[item.trait] = { score: 0, maxScore: 0 };
    const raw = Math.max(0, Math.min(3, Number(safe[id]) || 0));
    personalityMap[item.trait].score += item.reverse ? 3 - raw : raw;
    personalityMap[item.trait].maxScore += 3;
  });
  const personality = Object.entries(personalityMap).map(([label, data]) => ({ label, ...data, percentage: Math.round((data.score / data.maxScore) * 100) })).sort((a, b) => b.percentage - a.percentage);

  const interestMap: Record<string, { score: number; maxScore: number }> = {};
  Object.entries(STUDENT_INTEREST_ITEMS).forEach(([id, code]) => {
    if (!interestMap[code]) interestMap[code] = { score: 0, maxScore: 0 };
    interestMap[code].score += Math.max(0, Math.min(3, Number(safe[id]) || 0));
    interestMap[code].maxScore += 3;
  });
  const interests = Object.entries(interestMap).map(([code, data]) => ({ code, label: STUDENT_INTEREST_INFO[code].label, ...data, percentage: Math.round((data.score / data.maxScore) * 100) })).sort((a, b) => b.percentage - a.percentage);
  const topInterests = interests.slice(0, 2);

  return {
    responses: safe, participantInfo: participantInfo || {},
    cognitive: { score: cognitiveScore, maxScore: Object.keys(STUDENT_COGNITIVE_ITEMS).length, percentage: cognitivePercentage, band: getStudentPotentialBand(cognitivePercentage), domains: domainScores },
    emotional: { score: emotionalScore, maxScore: emotionalMax, percentage: emotionalPercentage, band: getStudentPotentialBand(emotionalPercentage) },
    personality, interests, topInterests,
    studyRecommendations: topInterests.flatMap((item) => STUDENT_INTEREST_INFO[item.code].fields),
    activityRecommendations: topInterests.flatMap((item) => STUDENT_INTEREST_INFO[item.code].activities),
    instrumentNote: "Hasil ini adalah pemetaan awal potensi, bukan skor IQ formal, diagnosis, atau keputusan tunggal penentuan studi. Skor IQ formal memerlukan alat terstandar dan pemeriksaan psikolog dalam kondisi terkontrol.",
    completedAt: new Date().toISOString(),
  };
}

const CAREER_COGNITIVE_ITEMS: Record<string, { answer: string; domain: string }> = {
  career_cog_1: { answer: "B", domain: "Verbal" }, career_cog_2: { answer: "D", domain: "Verbal" },
  career_cog_3: { answer: "C", domain: "Numerik" }, career_cog_4: { answer: "A", domain: "Numerik" },
  career_cog_5: { answer: "D", domain: "Logis" }, career_cog_6: { answer: "B", domain: "Logis" },
  career_cog_7: { answer: "C", domain: "Analitis" }, career_cog_8: { answer: "A", domain: "Analitis" },
  career_cog_9: { answer: "B", domain: "Ketelitian" }, career_cog_10: { answer: "D", domain: "Ketelitian" },
};

const CAREER_SJT_SCORES: Record<string, Record<string, number>> = {
  career_sjt_1: { A: 0, B: 2, C: 3, D: 1 }, career_sjt_2: { A: 1, B: 3, C: 0, D: 2 },
  career_sjt_3: { A: 3, B: 1, C: 0, D: 2 }, career_sjt_4: { A: 0, B: 2, C: 1, D: 3 },
  career_sjt_5: { A: 2, B: 0, C: 3, D: 1 }, career_sjt_6: { A: 1, B: 3, C: 2, D: 0 },
  career_sjt_7: { A: 3, B: 0, C: 2, D: 1 }, career_sjt_8: { A: 2, B: 1, C: 0, D: 3 },
};

const CAREER_COMPETENCY_ITEMS: Record<string, { competency: string; reverse?: boolean }> = {
  career_comp_1: { competency: "Orientasi Hasil" }, career_comp_2: { competency: "Orientasi Hasil", reverse: true },
  career_comp_3: { competency: "Kolaborasi" }, career_comp_4: { competency: "Kolaborasi", reverse: true },
  career_comp_5: { competency: "Adaptabilitas" }, career_comp_6: { competency: "Adaptabilitas", reverse: true },
  career_comp_7: { competency: "Orientasi Pelanggan" }, career_comp_8: { competency: "Orientasi Pelanggan", reverse: true },
  career_comp_9: { competency: "Kepemimpinan" }, career_comp_10: { competency: "Kepemimpinan", reverse: true },
  career_comp_11: { competency: "Integritas Kerja" }, career_comp_12: { competency: "Integritas Kerja", reverse: true },
};

const CAREER_INTEREST_ITEMS: Record<string, string> = {
  career_int_1: "analytical", career_int_2: "analytical", career_int_3: "people", career_int_4: "people",
  career_int_5: "operations", career_int_6: "operations", career_int_7: "commercial", career_int_8: "commercial",
  career_int_9: "innovation", career_int_10: "innovation", career_int_11: "leadership", career_int_12: "leadership",
};

const CAREER_ROLE_INFO: Record<string, { label: string; roles: string[]; development: string[] }> = {
  analytical: { label: "Analisis & Data", roles: ["Analitik bisnis, keuangan, riset, quality assurance, atau data"], development: ["Latih analisis data dan penyusunan insight", "Ambil proyek pemecahan masalah berbasis bukti"] },
  people: { label: "People & Service", roles: ["Human resources, learning & development, customer experience, atau layanan"], development: ["Latih active listening dan fasilitasi", "Ambil peran mentoring atau layanan lintas fungsi"] },
  operations: { label: "Operasional & Proses", roles: ["Operasional, project coordination, supply chain, administrasi, atau compliance"], development: ["Pelajari process mapping dan manajemen proyek", "Pimpin perbaikan proses berskala kecil"] },
  commercial: { label: "Komersial & Relasi", roles: ["Sales, business development, account management, atau partnership"], development: ["Latih negosiasi dan presentasi nilai", "Bangun pengalaman mengelola relasi pemangku kepentingan"] },
  innovation: { label: "Inovasi & Produk", roles: ["Product, desain layanan, teknologi, komunikasi kreatif, atau continuous improvement"], development: ["Bangun portofolio eksperimen atau prototipe", "Latih discovery kebutuhan pengguna"] },
  leadership: { label: "Strategi & Kepemimpinan", roles: ["Team lead, supervisor, program management, atau strategic planning"], development: ["Latih delegasi, coaching, dan pengambilan keputusan", "Ambil tanggung jawab memimpin proyek lintas fungsi"] },
};

function getCareerPotentialBand(percentage: number) {
  if (percentage >= 80) return "Sangat kuat";
  if (percentage >= 65) return "Kuat";
  if (percentage >= 45) return "Cukup berkembang";
  return "Perlu dikembangkan";
}

function calculateCareerPotentialResults(responses: any, participantInfo: any) {
  const safe = responses && typeof responses === "object" ? responses : {};
  const cognitiveDomains: Record<string, { score: number; maxScore: number; percentage: number }> = {};
  let cognitiveScore = 0;
  Object.entries(CAREER_COGNITIVE_ITEMS).forEach(([id, item]) => {
    if (!cognitiveDomains[item.domain]) cognitiveDomains[item.domain] = { score: 0, maxScore: 0, percentage: 0 };
    cognitiveDomains[item.domain].maxScore += 1;
    if (safe[id] === item.answer) { cognitiveScore += 1; cognitiveDomains[item.domain].score += 1; }
  });
  Object.values(cognitiveDomains).forEach((domain) => { domain.percentage = Math.round((domain.score / domain.maxScore) * 100); });
  const cognitivePercentage = Math.round((cognitiveScore / Object.keys(CAREER_COGNITIVE_ITEMS).length) * 100);

  const situationalScore = Object.entries(CAREER_SJT_SCORES).reduce((total, [id, scores]) => total + (scores[String(safe[id])] || 0), 0);
  const situationalMax = Object.keys(CAREER_SJT_SCORES).length * 3;
  const situationalPercentage = Math.round((situationalScore / situationalMax) * 100);

  const competencyMap: Record<string, { score: number; maxScore: number }> = {};
  Object.entries(CAREER_COMPETENCY_ITEMS).forEach(([id, item]) => {
    if (!competencyMap[item.competency]) competencyMap[item.competency] = { score: 0, maxScore: 0 };
    const raw = Math.max(0, Math.min(4, Number(safe[id]) || 0));
    competencyMap[item.competency].score += item.reverse ? 4 - raw : raw;
    competencyMap[item.competency].maxScore += 4;
  });
  const competencies = Object.entries(competencyMap).map(([label, data]) => ({ label, ...data, percentage: Math.round((data.score / data.maxScore) * 100), band: getCareerPotentialBand(Math.round((data.score / data.maxScore) * 100)) })).sort((a, b) => b.percentage - a.percentage);

  const interestMap: Record<string, { score: number; maxScore: number }> = {};
  Object.entries(CAREER_INTEREST_ITEMS).forEach(([id, code]) => {
    if (!interestMap[code]) interestMap[code] = { score: 0, maxScore: 0 };
    interestMap[code].score += Math.max(0, Math.min(4, Number(safe[id]) || 0));
    interestMap[code].maxScore += 4;
  });
  const rolePreferences = Object.entries(interestMap).map(([code, data]) => ({ code, label: CAREER_ROLE_INFO[code].label, ...data, percentage: Math.round((data.score / data.maxScore) * 100) })).sort((a, b) => b.percentage - a.percentage);
  const topRolePreferences = rolePreferences.slice(0, 2);

  return {
    responses: safe, participantInfo: participantInfo || {},
    cognitive: { score: cognitiveScore, maxScore: 10, percentage: cognitivePercentage, band: getCareerPotentialBand(cognitivePercentage), domains: cognitiveDomains },
    situational: { score: situationalScore, maxScore: situationalMax, percentage: situationalPercentage, band: getCareerPotentialBand(situationalPercentage) },
    competencies, rolePreferences, topRolePreferences,
    roleRecommendations: topRolePreferences.flatMap((item) => CAREER_ROLE_INFO[item.code].roles),
    developmentRecommendations: [...competencies.slice(-2).flatMap((item) => [`Kembangkan ${item.label} melalui target perilaku yang terukur dan umpan balik berkala.`]), ...topRolePreferences.flatMap((item) => CAREER_ROLE_INFO[item.code].development)],
    instrumentNote: "Hasil ini adalah pemetaan awal potensi kerja dan bukan keputusan otomatis atau alat tunggal untuk rekrutmen, promosi, evaluasi kinerja, maupun pengembangan karyawan. Organisasi perlu melakukan analisis jabatan dan validasi untuk konteks penggunaan, menyediakan akomodasi yang wajar, memantau potensi bias, serta menggabungkan hasil dengan wawancara terstruktur, simulasi kerja, bukti kinerja, dan penilaian profesional.",
    completedAt: new Date().toISOString(),
  };
}

function calculateMultipleIntelligenceResults(responses: any, participantInfo: any) {
  // Define the 7 intelligence categories with question mappings
  const categoryMapping = {
    'visual_spasial': [1, 2, 3, 4, 5, 6, 7, 8, 9, 10],
    'linguistik': [11, 12, 13, 14, 15, 16, 17, 18, 19, 20],
    'logis_matematis': [21, 22, 23, 24, 25, 26, 27, 28, 29, 30],
    'kinestetik': [31, 32, 33, 34, 35, 36, 37, 38, 39, 40],
    'musik': [41, 42, 43, 44, 45, 46, 47, 48, 49, 50],
    'interpersonal': [51, 52, 53, 54, 55, 56, 57, 58, 59, 60],
    'intrapersonal': [61, 62, 63, 64, 65, 66, 67, 68, 69, 70]
  };

  const categoryNames = {
    'visual_spasial': 'Visual Spasial',
    'linguistik': 'Linguistik', 
    'logis_matematis': 'Logis Matematis',
    'kinestetik': 'Kinestetik',
    'musik': 'Musik',
    'interpersonal': 'Interpersonal',
    'intrapersonal': 'Intrapersonal'
  };

  // Validate responses parameter
  if (!responses || typeof responses !== 'object') {
    console.error('Invalid responses parameter:', responses);
    return {
      responses: responses || {},
      participantInfo: participantInfo || {},
      scoresByCategory: {},
      percentages: {},
      ranking: [],
      profilKecerdasanLengkap: [],
      completedAt: new Date().toISOString()
    };
  }

  // Calculate scores for each category
  const scoresByCategory: Record<string, { score: number; total: number; percentage: number }> = {};
  
  for (const [category, questionIds] of Object.entries(categoryMapping)) {
    let score = 0;
    let total = questionIds.length;
    
    // Count "true" responses (answered "Ya") for this category
    for (const questionId of questionIds) {
      if (responses[questionId.toString()] === true) {
        score += 1;
      }
    }
    
    const percentage = Math.round((score / total) * 100);
    
    scoresByCategory[category] = {
      score,
      total,
      percentage
    };
  }

  // Create ranking (highest to lowest percentage)
  const ranking = Object.entries(scoresByCategory)
    .map(([category, data]) => ({
      category,
      name: categoryNames[category as keyof typeof categoryNames],
      score: data.score,
      total: data.total,
      percentage: data.percentage
    }))
    .sort((a, b) => b.percentage - a.percentage);

  // Create profil kecerdasan lengkap for PDF generation
  const profilKecerdasanLengkap = ranking.map((item, index) => ({
    dimensi: item.name,
    skor: item.score,
    total: item.total,
    persentase: item.percentage,
    ranking: index + 1,
    kategori: item.percentage >= 70 ? 'Tinggi' : item.percentage >= 40 ? 'Sedang' : 'Rendah',
    rekomendasi: getIntelligenceRecommendationsForPDF(item.category)
  }));

  return {
    responses,
    participantInfo: participantInfo || {},
    scoresByCategory,
    percentages: Object.fromEntries(
      Object.entries(scoresByCategory).map(([cat, data]) => [cat, data.percentage])
    ),
    ranking,
    categoryScores: ranking, // For PDF generation compatibility
    dominantIntelligences: ranking.slice(0, 3), // Top 3
    profilKecerdasanLengkap,
    completedAt: new Date().toISOString()
  };
}

function determineSensoryPatterns(sectionScores: any) {
  const patterns: any = {};
  
  for (const [section, scores] of Object.entries(sectionScores)) {
    const average = parseFloat((scores as any).average);
    
    if (average >= 4.0) {
      patterns[section] = 'hypersensitive';
    } else if (average <= 2.0) {
      patterns[section] = 'hyposensitive';
    } else {
      patterns[section] = 'typical';
    }
  }
  
  return patterns;
}

// Helper function for intelligence-specific recommendations in PDF
function getIntelligenceRecommendationsForPDF(category: string): string[] {
  const recommendations: Record<string, string[]> = {
    'visual_spasial': [
      'Gunakan mind map dan diagram saat belajar',
      'Manfaatkan media visual seperti gambar dan video',
      'Praktikkan aktivitas seni dan design',
      'Latih kemampuan navigasi dan orientasi ruang'
    ],
    'linguistik': [
      'Perbanyak membaca dan menulis',
      'Latih public speaking dan storytelling',
      'Pelajari bahasa asing',
      'Ikuti aktivitas debat dan diskusi'
    ],
    'logis_matematis': [
      'Latih kemampuan problem solving',
      'Pelajari programming dan logika',
      'Mainkan game strategi dan puzzle',
      'Praktikkan metode ilmiah dalam berpikir'
    ],
    'kinestetik': [
      'Integrasikan gerakan dalam proses belajar',
      'Ikuti aktivitas olahraga dan tari',
      'Praktikkan pembelajaran hands-on',
      'Gunakan role-play dan simulasi'
    ],
    'musik': [
      'Gunakan lagu untuk mengingat informasi',
      'Pelajari alat musik',
      'Ikuti aktivitas bernyanyi atau paduan suara',
      'Manfaatkan ritme dalam pembelajaran'
    ],
    'interpersonal': [
      'Ikuti kegiatan kelompok dan teamwork',
      'Praktikkan empati dan komunikasi',
      'Latih kemampuan leadership',
      'Terlibat dalam aktivitas sosial dan volunteer'
    ],
    'intrapersonal': [
      'Luangkan waktu untuk refleksi diri',
      'Latih journaling dan self-assessment',
      'Praktikkan mindfulness dan meditasi',
      'Tentukan tujuan personal yang jelas'
    ]
  };
  
  return recommendations[category] || [];
}

// PDF Generation Function
function generatePdfContent(userAssessment: UserAssessmentWithDetails): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: {
          top: 50,
          bottom: 50,
          left: 50,
          right: 50
        }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      const results = userAssessment.results as any;
      const assessmentType = userAssessment.assessment.type;

      // Header with Logo - Positioned at top left to avoid text overlap
      const logoPath = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..', 'src', 'assets', 'logo.png');
      
      try {
        if (fs.existsSync(logoPath)) {
          // Position logo at top left corner
          doc.image(logoPath, 50, 50, { width: 60 });
        }
      } catch (logoError) {
        console.error('Logo error:', logoError);
        // Continue without logo
      }

      // Title text positioned normally without logo interference
      doc.fontSize(20).font('Helvetica-Bold')
         .text('LAPORAN HASIL ASESMEN', { align: 'center' });
      
      doc.moveDown(1);
      
      doc.fontSize(16).font('Helvetica-Bold')
         .text('Rumah Psikologi Pelangi Indonesia', { align: 'center' });

      doc.moveDown(2);

      // Assessment Info
      doc.fontSize(14).font('Helvetica-Bold')
         .text('Informasi Asesmen', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica')
         .text(`Nama Asesmen: ${userAssessment.assessment.name}`)
           .text(`Tanggal Selesai: ${formatDisplayDate(userAssessment.completedAt)}`)
         .text(`Durasi: ${userAssessment.assessment.duration}`)
         .text(`Rentang Usia: ${userAssessment.assessment.ageRange}`);

      doc.moveDown(1.5);

      // Results Section
      if (assessmentType === 'learning') {
        const { styleScores, primaryStyle, percentages } = results;
        
        doc.fontSize(14).font('Helvetica-Bold')
           .text('HASIL INVENTORI GAYA BELAJAR', { underline: true });
        
        doc.moveDown(0.5);
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text(`Gaya Belajar Dominan: ${(primaryStyle || '').toUpperCase()}`);
        
        doc.moveDown(0.5);
        
        doc.fontSize(12).font('Helvetica')
           .text('Skor Detail:')
           .text(`• Visual: ${styleScores?.visual || 0} (${percentages?.visual || 0}%)`)
           .text(`• Auditori: ${styleScores?.auditori || 0} (${percentages?.auditori || 0}%)`)
           .text(`• Kinestetik: ${styleScores?.kinestetik || 0} (${percentages?.kinestetik || 0}%)`);
        
        doc.moveDown(1);
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Interpretasi:');
        
        doc.fontSize(12).font('Helvetica');
        const interpretation = primaryStyle === 'visual' 
          ? 'Anda belajar terbaik melalui melihat dan mengamati. Lebih mudah memahami informasi melalui diagram, grafik, dan presentasi visual.'
          : primaryStyle === 'auditori' 
          ? 'Anda belajar terbaik melalui mendengar dan berbicara. Lebih mudah memahami informasi melalui penjelasan lisan dan diskusi.'
          : 'Anda belajar terbaik melalui praktik langsung dan gerakan. Lebih mudah memahami informasi melalui aktivitas hands-on.';
        
        doc.text(interpretation, { align: 'justify' });
        
      } else if (assessmentType === 'intelligence') {
        const { categoryScores, dominantIntelligences } = results;
        
        doc.fontSize(14).font('Helvetica-Bold')
           .text('HASIL ASESMEN KECERDASAN MAJEMUK', { underline: true });
        
        doc.moveDown(0.5);
        
        // Display top 3 intelligences
        if (dominantIntelligences && dominantIntelligences.length > 0) {
          doc.fontSize(12).font('Helvetica-Bold')
             .text('Kecerdasan Dominan:');
          
          doc.moveDown(0.3);
          
          dominantIntelligences.slice(0, 3).forEach((intelligence: any, index: number) => {
            doc.fontSize(12).font('Helvetica')
               .text(`${index + 1}. ${intelligence.name}: ${intelligence.percentage}%`);
          });
        }
        
        doc.moveDown(1);
        
        // Complete intelligence profile
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Profil Kecerdasan Lengkap:');
        
        doc.moveDown(0.3);
        
        if (categoryScores && categoryScores.length > 0) {
          categoryScores.forEach((intelligence: any) => {
            doc.fontSize(11).font('Helvetica')
               .text(`• ${intelligence.name}: ${intelligence.score}/${intelligence.total} (${intelligence.percentage}%)`);
          });
        }
        
        doc.moveDown(1);
        
        // Interpretation and recommendations
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Interpretasi:');
        
        doc.fontSize(11).font('Helvetica')
           .text('Hasil asesmen menunjukkan profil kecerdasan majemuk Anda. Setiap orang memiliki kombinasi unik dari berbagai jenis kecerdasan. Kecerdasan dominan menunjukkan area di mana Anda memiliki potensi terbesar untuk belajar dan berkembang.', { align: 'justify' });
        
        doc.moveDown(0.8);
        
        // Recommendations based on top intelligence
        if (dominantIntelligences && dominantIntelligences.length > 0) {
          const topIntelligence = dominantIntelligences[0];
          doc.fontSize(12).font('Helvetica-Bold')
             .text('Rekomendasi Pengembangan:');
          
          doc.fontSize(11).font('Helvetica');
          
          // Get specific recommendations based on category
          const recommendations = getIntelligenceRecommendationsForPDF(topIntelligence.category);
          recommendations.forEach((rec: string) => {
            doc.text(`• ${rec}`);
          });
        }
        
      } else if (assessmentType === 'mental-health') {
        const domainNames: Record<string, string> = {
          anxiety: 'Kecemasan',
          stress: 'Stres',
          depression: 'Depresi',
          burnout: 'Burnout kerja/studi',
        };

        doc.fontSize(14).font('Helvetica-Bold')
          .text('HASIL MENTAL HEALTH CHECK UP', { underline: true });
        doc.moveDown(0.6);
        doc.fontSize(10.5).font('Helvetica')
          .text('Periode jawaban: 2 minggu terakhir')
          .text('Hasil ini merupakan skrining internal non-diagnostik dan bukan penegakan diagnosis klinis.');
        doc.moveDown(0.8);

        Object.entries(results?.domainScores || {}).forEach(([domain, data]: [string, any]) => {
          doc.fontSize(11).font('Helvetica-Bold')
            .text(`${domainNames[domain] || domain}: ${data.score}/${data.maxScore} - ${data.level?.label || '-'}`);
          doc.moveDown(0.25);
        });

        if (results?.safetyFlag) {
          doc.moveDown(0.8);
          doc.fillColor('#a40000').fontSize(11).font('Helvetica-Bold')
            .text('PERHATIAN KESELAMATAN');
          doc.font('Helvetica').fontSize(10.5)
            .text('Jawaban menunjukkan adanya pikiran menyakiti diri. Hubungi 119 ekstensi 8, akses Healing119.id, minta orang tepercaya menemani, atau datang ke IGD terdekat bila ada risiko langsung.', { align: 'justify' });
          doc.fillColor('black');
        }

        doc.moveDown(1);
        doc.fontSize(11).font('Helvetica-Bold').text('Langkah berikutnya:');
        doc.fontSize(10.5).font('Helvetica')
          .text('- Pantau pola tidur, energi, emosi, serta beban kerja atau belajar.')
          .text('- Konsultasikan dengan psikolog atau tenaga kesehatan jika keluhan mengganggu aktivitas, bertahan, atau memburuk.')
          .text('- Hubungi WhatsApp PI di 0851-1765-8242 untuk informasi dan konsultasi lebih lanjut.');

      } else if (assessmentType === 'student-potential') {
        doc.fontSize(14).font('Helvetica-Bold').text('HASIL PEMETAAN INTELEGENSI & POTENSI SISWA', { underline: true });
        doc.moveDown(0.6);
        doc.fontSize(10.5).font('Helvetica').text(`Potensi penalaran: ${results?.cognitive?.score || 0}/${results?.cognitive?.maxScore || 10} (${results?.cognitive?.band || '-'})`)
          .text(`Kecerdasan emosional situasional: ${results?.emotional?.score || 0}/${results?.emotional?.maxScore || 18} (${results?.emotional?.band || '-'})`);
        doc.moveDown(0.7);
        doc.fontSize(11).font('Helvetica-Bold').text('Dua kecenderungan minat utama:');
        (results?.topInterests || []).forEach((item: any) => doc.fontSize(10.5).font('Helvetica').text(`- ${item.label}: ${item.percentage}%`));
        doc.moveDown(0.6);
        doc.fontSize(11).font('Helvetica-Bold').text('Pilihan bidang studi untuk dieksplorasi:');
        (results?.studyRecommendations || []).forEach((item: string) => doc.fontSize(10.5).font('Helvetica').text(`- ${item}`));
        doc.moveDown(0.6);
        doc.fontSize(11).font('Helvetica-Bold').text('Aktivitas pengembangan:');
        (results?.activityRecommendations || []).forEach((item: string) => doc.fontSize(10.5).font('Helvetica').text(`- ${item}`));
        doc.moveDown(0.8);
        doc.fontSize(9.5).font('Helvetica-Oblique').text(results?.instrumentNote || '', { align: 'justify' });

      } else if (assessmentType === 'career-potential') {
        doc.fontSize(14).font('Helvetica-Bold').text('HASIL TES POTENSI KARIR (PERUSAHAAN)', { underline: true });
        doc.moveDown(0.6);
        doc.fontSize(10.5).font('Helvetica').text(`Penalaran kerja: ${results?.cognitive?.percentage || 0}% (${results?.cognitive?.band || '-'})`)
          .text(`Pertimbangan situasional: ${results?.situational?.percentage || 0}% (${results?.situational?.band || '-'})`);
        doc.moveDown(0.7);
        doc.fontSize(11).font('Helvetica-Bold').text('Kompetensi perilaku:');
        (results?.competencies || []).forEach((item: any) => doc.fontSize(10).font('Helvetica').text(`- ${item.label}: ${item.percentage}% (${item.band})`));
        doc.moveDown(0.6);
        doc.fontSize(11).font('Helvetica-Bold').text('Preferensi peran utama:');
        (results?.topRolePreferences || []).forEach((item: any) => doc.fontSize(10).font('Helvetica').text(`- ${item.label}: ${item.percentage}%`));
        doc.moveDown(0.6);
        doc.fontSize(11).font('Helvetica-Bold').text('Arah pengembangan:');
        (results?.developmentRecommendations || []).forEach((item: string) => doc.fontSize(9.5).font('Helvetica').text(`- ${item}`));
        doc.moveDown(0.7);
        doc.fontSize(9).font('Helvetica-Oblique').text(results?.instrumentNote || '', { align: 'justify' });

      } else if (assessmentType === 'sensory') {
        const { totalScore, interpretation, sectionScores, participantInfo, responses } = results;
        
        doc.fontSize(14).font('Helvetica-Bold')
           .text('HASIL ASESMEN PROFIL SENSORI', { underline: true });
        
        doc.moveDown(0.5);

        // Participant Info - Enhanced
        if (participantInfo && Object.keys(participantInfo).length > 0) {
          doc.fontSize(12).font('Helvetica-Bold')
             .text('INFORMASI PARTISIPAN', { underline: true });
          
          doc.moveDown(0.3);
          
          doc.fontSize(11).font('Helvetica')
             .text(`Nama Anak: ${participantInfo.childName || '-'}`)
             .text(`Tanggal Lahir: ${formatDisplayDate(participantInfo.childBirthDate)}`)
             .text(`Nama Orang Tua: ${participantInfo.parentName || '-'}`)
             .text(`Hubungan: ${participantInfo.relationship || '-'}`)
             .text(`Tanggal Tes: ${participantInfo.testDate || '-'}`);
          
          if (participantInfo.concerns) {
            doc.moveDown(0.3);
            doc.fontSize(11).font('Helvetica-Bold')
               .text('Kekhawatiran:');
            doc.fontSize(11).font('Helvetica')
               .text(participantInfo.concerns, { align: 'justify' });
          }
          
          if (participantInfo.otherInfo) {
            doc.moveDown(0.3);
            doc.fontSize(11).font('Helvetica-Bold')
               .text('Informasi Tambahan:');
            doc.fontSize(11).font('Helvetica')
               .text(participantInfo.otherInfo, { align: 'justify' });
          }
          
          doc.moveDown(1);
        }
        
        // Summary Results
        doc.fontSize(12).font('Helvetica-Bold')
           .text('RINGKASAN HASIL', { underline: true });
        
        doc.moveDown(0.3);
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text(`Skor Total: ${totalScore}/625`);
        
        // Generate interpretation if not present
        let finalInterpretation = interpretation;
        if (!finalInterpretation) {
          if (totalScore < 155) {
            finalInterpretation = 'Sensitivitas Rendah - Kemungkinan memerlukan stimulasi sensoris yang lebih kuat';
          } else if (totalScore < 190) {
            finalInterpretation = 'Sensitivitas Sedang Rendah - Beberapa area memerlukan perhatian';
          } else if (totalScore < 240) {
            finalInterpretation = 'Sensitivitas Normal - Respons sensoris dalam batas normal';
          } else if (totalScore < 285) {
            finalInterpretation = 'Sensitivitas Sedang Tinggi - Beberapa area menunjukkan kepekaan berlebih';
          } else {
            finalInterpretation = 'Sensitivitas Tinggi - Kemungkinan mengalami hipersensitivitas sensoris';
          }
        }
        
        doc.fontSize(11).font('Helvetica')
           .text(`Interpretasi: ${finalInterpretation}`);
        
        doc.moveDown(1);
        
        // Detailed Section Analysis
        if (sectionScores && Object.keys(sectionScores).length > 0) {
          doc.fontSize(12).font('Helvetica-Bold')
             .text('ANALISIS DETAIL PER BAGIAN', { underline: true });
          
          doc.moveDown(0.3);
          
          const sectionDetails = {
            'A': {
              name: 'Pemrosesan Auditori',
              description: 'Kemampuan memproses informasi yang diterima melalui pendengaran',
              normal: [13, 19],
              lowThreshold: '≤12 (Hipersensitif - mudah terganggu suara)',
              highThreshold: '≥20 (Hiposensitif - butuh stimulasi suara lebih kuat)'
            },
            'B': {
              name: 'Pemrosesan Visual',
              description: 'Kemampuan memproses informasi yang diterima melalui penglihatan',
              normal: [8, 14],
              lowThreshold: '≤7 (Hipersensitif - mudah terganggu cahaya/visual)',
              highThreshold: '≥15 (Hiposensitif - butuh stimulasi visual lebih kuat)'
            },
            'C': {
              name: 'Pemrosesan Vestibular',
              description: 'Kemampuan memproses informasi terkait keseimbangan dan gerakan',
              normal: [13, 19],
              lowThreshold: '≤12 (Hipersensitif - mudah mual/pusing)',
              highThreshold: '≥20 (Hiposensitif - mencari gerakan intens)'
            },
            'D': {
              name: 'Pemrosesan Taktil',
              description: 'Kemampuan memproses informasi melalui sentuhan dan tekstur',
              normal: [16, 24],
              lowThreshold: '≤15 (Hipersensitif - menghindari sentuhan)',
              highThreshold: '≥25 (Hiposensitif - butuh tekanan/sentuhan kuat)'
            },
            'E': {
              name: 'Pemrosesan Multisensoris',
              description: 'Kemampuan mengintegrasikan informasi dari berbagai sistem sensoris',
              normal: [7, 11],
              lowThreshold: '≤6 (Kesulitan integrasi - mudah kewalahan)',
              highThreshold: '≥12 (Butuh stimulasi multi-sensoris tinggi)'
            },
            'F': {
              name: 'Pemrosesan Oral Sensoris',
              description: 'Pemrosesan sensoris terkait mulut, makanan, dan rasa',
              normal: [11, 17],
              lowThreshold: '≤10 (Hipersensitif - pemilih makanan)',
              highThreshold: '≥18 (Hiposensitif - mencari stimulasi oral)'
            },
            'G': {
              name: 'Pemrosesan Sensorik Terkait Daya Tahan',
              description: 'Kemampuan mempertahankan daya tahan dan tonus otot',
              normal: [6, 12],
              lowThreshold: '≤5 (Kesulitan daya tahan motorik)',
              highThreshold: '≥13 (Mencari tantangan motorik kompleks)'
            },
            'H': {
              name: 'Modulasi Posisi dan Gerakan Tubuh',
              description: 'Regulasi posisi tubuh dan respons terhadap gerakan',
              normal: [7, 13],
              lowThreshold: '≤6 (Takut gerakan - overresponsive)',
              highThreshold: '≥14 (Mencari gerakan berisiko - underresponsive)'
            },
            'I': {
              name: 'Modulasi Gerakan dan Tingkat Aktivitas',
              description: 'Modulasi tingkat aktivitas dan gerakan dalam keseharian',
              normal: [6, 12],
              lowThreshold: '≤5 (Tingkat aktivitas rendah)',
              highThreshold: '≥13 (Hiperaktif - sulit mengatur diri)'
            },
            'J': {
              name: 'Modulasi Input Sensoris - Respons Emosional',
              description: 'Regulasi respons emosional terhadap stimulasi sensoris',
              normal: [3, 7],
              lowThreshold: '≤2 (Under-responsive secara emosional)',
              highThreshold: '≥8 (Over-responsive secara emosional)'
            },
            'K': {
              name: 'Modulasi Input Visual - Respons Emosional',
              description: 'Regulasi respons emosional terhadap stimulasi visual',
              normal: [2, 6],
              lowThreshold: '≤1 (Under-responsive terhadap visual)',
              highThreshold: '≥7 (Over-responsive terhadap visual)'
            },
            'L': {
              name: 'Respon Emosional/Sosial',
              description: 'Respons emosional dan sosial terhadap berbagai situasi',
              normal: [60, 90],
              lowThreshold: '≤59 (Respons emosional rendah)',
              highThreshold: '≥91 (Respons emosional tinggi)'
            }
          };
          
          Object.entries(sectionScores).forEach(([section, scoreData]: [string, any]) => {
            const detail = sectionDetails[section as keyof typeof sectionDetails];
            if (detail) {
              // Extract the actual score value - handle both old and new data structures
              const score = typeof scoreData === 'object' ? scoreData.total || scoreData : scoreData;
              
              doc.fontSize(11).font('Helvetica-Bold')
                 .text(`${detail.name}: ${score}`, { continued: false });
              
              // Determine threshold category
              let category = 'Normal';
              let categoryColor = 'black';
              if (score <= detail.normal[0] - 1) {
                category = 'Hipersensitif (Ambang sensorik rendah)';
                categoryColor = 'red';
              } else if (score >= detail.normal[1] + 1) {
                category = 'Hiposensitif (Ambang sensorik tinggi)';
                categoryColor = 'blue';
              }
              
              doc.fontSize(10).font('Helvetica')
                 .text(`  Kategori: ${category}`)
                 .text(`  ${detail.description}`)
                 .text(`  Rentang Normal: ${detail.normal[0]}-${detail.normal[1]}`);
              
              if (category !== 'Normal') {
                doc.text(`  ${category.includes('Hipersensitif') ? detail.lowThreshold : detail.highThreshold}`);
              }
              
              doc.moveDown(0.3);
            }
          });
        }
        
        // Add new page for recommendations
        doc.addPage();
        
        // Recommendations Section
        doc.fontSize(14).font('Helvetica-Bold')
           .text('REKOMENDASI DAN STRATEGI', { underline: true });
        
        doc.moveDown(0.5);
        
        // General recommendations based on total score
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Rekomendasi Umum:');
        
        doc.fontSize(11).font('Helvetica');
        if (totalScore < 125) {
          doc.text('• Kemungkinan mengalami hipersensitivitas sensoris secara umum')
             .text('• Ciptakan lingkungan yang tenang dan tidak terlalu stimulasi')
             .text('• Berikan waktu transisi yang cukup untuk perubahan aktivitas')
             .text('• Gunakan pendekatan bertahap dalam memperkenalkan stimulasi baru');
        } else if (totalScore > 375) {
          doc.text('• Kemungkinan mengalami hiposensitivitas sensoris secara umum')
             .text('• Berikan stimulasi sensoris yang lebih kuat dan bervariasi')
             .text('• Dorong aktivitas fisik dan eksplorasi sensoris')
             .text('• Gunakan alat bantu sensoris seperti fidget toys atau weighted blanket');
        } else {
          doc.text('• Profil sensoris dalam rentang normal')
             .text('• Pertahankan keseimbangan stimulasi sensoris dalam keseharian')
             .text('• Amati respons terhadap lingkungan yang berbeda')
             .text('• Konsultasikan jika ada perubahan pola perilaku sensoris');
        }
        
        doc.moveDown(0.5);
        
        // Specific recommendations by section
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Strategi Spesifik Per Area:');
        
        doc.moveDown(0.3);
        
        if (sectionScores) {
          const sectionDetailsForRecommendations = {
            'A': {
              name: 'Pemrosesan Auditori',
              normal: [13, 19]
            },
            'B': {
              name: 'Pemrosesan Visual',
              normal: [8, 14]
            },
            'C': {
              name: 'Pemrosesan Vestibular',
              normal: [13, 19]
            },
            'D': {
              name: 'Pemrosesan Taktil',
              normal: [16, 24]
            },
            'E': {
              name: 'Pemrosesan Multisensoris',
              normal: [7, 11]
            },
            'F': {
              name: 'Pemrosesan Oral Sensoris',
              normal: [11, 17]
            },
            'G': {
              name: 'Pemrosesan Sensorik Terkait Daya Tahan',
              normal: [6, 12]
            },
            'H': {
              name: 'Modulasi Posisi dan Gerakan Tubuh',
              normal: [7, 13]
            },
            'I': {
              name: 'Modulasi Gerakan dan Tingkat Aktivitas',
              normal: [6, 12]
            },
            'J': {
              name: 'Modulasi Input Sensoris - Respons Emosional',
              normal: [3, 7]
            },
            'K': {
              name: 'Modulasi Input Visual - Respons Emosional',
              normal: [2, 6]
            },
            'L': {
              name: 'Respon Emosional/Sosial',
              normal: [60, 90]
            }
          };
          
          Object.entries(sectionScores).forEach(([section, scoreData]: [string, any]) => {
            const detail = sectionDetailsForRecommendations[section as keyof typeof sectionDetailsForRecommendations];
            if (detail) {
              // Extract the actual score value - handle both old and new data structures
              const score = typeof scoreData === 'object' ? scoreData.total || scoreData : scoreData;
              let isAbnormal = score <= detail.normal[0] - 1 || score >= detail.normal[1] + 1;
              
              if (isAbnormal) {
                doc.fontSize(11).font('Helvetica-Bold')
                   .text(`${detail.name}:`);
                
                doc.fontSize(10).font('Helvetica');
                
                if (score <= detail.normal[0] - 1) {
                  // Hypersensitive recommendations
                  switch (section) {
                    case 'A': // Pemrosesan Auditori
                      doc.text('  • Gunakan ear plugs atau headphone peredam suara')
                         .text('  • Hindari lingkungan bising, pilih tempat yang tenang')
                         .text('  • Berikan peringatan sebelum suara keras')
                         .text('  • Pertimbangkan terapi integrasi sensoris');
                      break;
                    case 'B': // Pemrosesan Visual
                      doc.text('  • Kurangi pencahayaan yang terlalu terang')
                         .text('  • Gunakan kacamata anti-silau jika perlu')
                         .text('  • Hindari pola visual yang terlalu kompleks')
                         .text('  • Ciptakan area visual yang tenang');
                      break;
                    case 'C': // Pemrosesan Vestibular
                      doc.text('  • Hindari gerakan yang terlalu cepat atau berputar')
                         .text('  • Berikan dukungan fisik saat berpindah posisi')
                         .text('  • Latihan keseimbangan bertahap')
                         .text('  • Konsultasi dengan terapis okupasi');
                      break;
                    case 'D': // Pemrosesan Taktil
                      doc.text('  • Respek preferensi tekstur dan sentuhan')
                         .text('  • Gunakan pakaian dengan bahan yang nyaman')
                         .text('  • Berikan pilihan dalam aktivitas sentuhan')
                         .text('  • Latihan desensitisasi bertahap');
                      break;
                    case 'E': // Pemrosesan Multisensoris
                      doc.text('  • Kurangi kompleksitas lingkungan sensoris')
                         .text('  • Berikan satu jenis stimulasi pada satu waktu')
                         .text('  • Ciptakan ruang tenang untuk beristirahat')
                         .text('  • Latihan integrasi sensoris bertahap');
                      break;
                    case 'F': // Pemrosesan Oral Sensoris
                      doc.text('  • Respek preferensi makanan dan tekstur')
                         .text('  • Perkenalkan makanan baru secara bertahap')
                         .text('  • Hindari memaksa makan makanan tertentu')
                         .text('  • Konsultasi dengan terapis wicara/okupasi');
                      break;
                    case 'G': // Pemrosesan Sensorik Terkait Daya Tahan
                      doc.text('  • Istirahat yang cukup di antara aktivitas')
                         .text('  • Berikan dukungan postural saat duduk')
                         .text('  • Hindari aktivitas yang terlalu melelahkan')
                         .text('  • Konsultasi dengan terapis okupasi');
                      break;
                    case 'H': // Modulasi Posisi dan Gerakan Tubuh
                      doc.text('  • Berikan rasa aman saat bergerak')
                         .text('  • Hindari aktivitas dengan risiko tinggi')
                         .text('  • Latihan keseimbangan yang aman')
                         .text('  • Gunakan alat bantu stabilitas');
                      break;
                    case 'I': // Modulasi Gerakan dan Tingkat Aktivitas
                      doc.text('  • Ciptakan lingkungan yang tenang')
                         .text('  • Berikan aktivitas yang tidak terlalu stimulatif')
                         .text('  • Atur jadwal dengan istirahat yang cukup')
                         .text('  • Hindari overstimulasi sensoris');
                      break;
                    case 'J': // Modulasi Input Sensoris - Respons Emosional
                      doc.text('  • Berikan dukungan emosional yang konsisten')
                         .text('  • Ciptakan rutinitas yang dapat diprediksi')
                         .text('  • Hindari perubahan mendadak')
                         .text('  • Konsultasi dengan psikolog');
                      break;
                    case 'K': // Modulasi Input Visual - Respons Emosional
                      doc.text('  • Kurangi stimulasi visual yang berlebihan')
                         .text('  • Ciptakan lingkungan visual yang tenang')
                         .text('  • Gunakan pencahayaan yang lembut')
                         .text('  • Hindari pola visual yang kompleks');
                      break;
                    case 'L': // Respon Emosional/Sosial
                      doc.text('  • Berikan dukungan emosional yang konsisten')
                         .text('  • Ciptakan lingkungan yang aman dan mendukung')
                         .text('  • Hindari kritik berlebihan')
                         .text('  • Konsultasi dengan psikolog/terapis');
                      break;
                  }
                } else {
                  // Hyposensitive recommendations
                  switch (section) {
                    case 'A': // Pemrosesan Auditori
                      doc.text('  • Berikan stimulasi suara yang bervariasi')
                         .text('  • Gunakan musik atau suara latar yang menenangkan')
                         .text('  • Libatkan dalam aktivitas musik')
                         .text('  • Berikan instruksi verbal yang jelas dan berulang');
                      break;
                    case 'B': // Pemrosesan Visual
                      doc.text('  • Gunakan warna-warna cerah dan kontras tinggi')
                         .text('  • Berikan stimulasi visual yang menarik')
                         .text('  • Gunakan alat bantu visual untuk fokus')
                         .text('  • Libatkan dalam aktivitas seni visual');
                      break;
                    case 'C': // Pemrosesan Vestibular
                      doc.text('  • Dorong aktivitas yang melibatkan gerakan')
                         .text('  • Berikan kesempatan untuk berayun atau berputar')
                         .text('  • Libatkan dalam olahraga atau aktivitas fisik')
                         .text('  • Gunakan alat seperti balance ball');
                      break;
                    case 'D': // Pemrosesan Taktil
                      doc.text('  • Berikan berbagai tekstur untuk eksplorasi')
                         .text('  • Gunakan weighted blanket atau deep pressure')
                         .text('  • Libatkan dalam aktivitas sensory play')
                         .text('  • Berikan pijatan atau tekanan dalam');
                      break;
                    case 'E': // Pemrosesan Multisensoris
                      doc.text('  • Berikan aktivitas multi-sensoris yang kaya')
                         .text('  • Kombinasikan berbagai jenis stimulasi')
                         .text('  • Libatkan dalam permainan eksplorasi')
                         .text('  • Gunakan mainan dengan tekstur dan suara');
                      break;
                    case 'F': // Pemrosesan Oral Sensoris
                      doc.text('  • Berikan makanan dengan tekstur yang bervariasi')
                         .text('  • Sediakan mainan oral yang aman untuk dikunyah')
                         .text('  • Libatkan dalam aktivitas oral motorik')
                         .text('  • Berikan makanan dengan rasa yang kuat');
                      break;
                    case 'G': // Pemrosesan Sensorik Terkait Daya Tahan
                      doc.text('  • Berikan latihan penguatan otot')
                         .text('  • Dorong aktivitas fisik yang teratur')
                         .text('  • Gunakan weighted vest atau alat pemberat')
                         .text('  • Libatkan dalam aktivitas proprioseptif');
                      break;
                    case 'H': // Modulasi Posisi dan Gerakan Tubuh
                      doc.text('  • Dorong aktivitas dengan risiko yang terkontrol')
                         .text('  • Berikan kesempatan untuk memanjat/melompat')
                         .text('  • Libatkan dalam olahraga ekstrem yang aman')
                         .text('  • Gunakan trampolin atau balance board');
                      break;
                    case 'I': // Modulasi Gerakan dan Tingkat Aktivitas
                      doc.text('  • Berikan aktivitas yang meningkatkan energi')
                         .text('  • Dorong olahraga dan aktivitas fisik')
                         .text('  • Sediakan waktu untuk gerakan aktif')
                         .text('  • Libatkan dalam permainan yang dinamis');
                      break;
                    case 'J': // Modulasi Input Sensoris - Respons Emosional
                      doc.text('  • Berikan stimulasi yang lebih intens')
                         .text('  • Dorong eksplorasi lingkungan yang bervariasi')
                         .text('  • Libatkan dalam aktivitas yang menantang')
                         .text('  • Berikan feedback yang lebih eksplisit');
                      break;
                    case 'K': // Modulasi Input Visual - Respons Emosional
                      doc.text('  • Berikan stimulasi visual yang kaya')
                         .text('  • Gunakan warna-warna cerah dan menarik')
                         .text('  • Libatkan dalam aktivitas visual yang kompleks')
                         .text('  • Berikan variasi dalam lingkungan visual');
                      break;
                    case 'L': // Respon Emosional/Sosial
                      doc.text('  • Berikan stimulasi sosial yang lebih intens')
                         .text('  • Dorong partisipasi dalam kegiatan kelompok')
                         .text('  • Libatkan dalam aktivitas yang menantang')
                         .text('  • Berikan feedback yang lebih ekspresif');
                      break;
                  }
                }
                doc.moveDown(0.3);
              }
            }
          });
        }
        
        doc.moveDown(0.5);
        
        // Follow-up recommendations
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Tindak Lanjut:');
        
        doc.fontSize(11).font('Helvetica')
           .text('• Konsultasikan hasil dengan terapis okupasi untuk evaluasi lebih mendalam')
           .text('• Amati perubahan perilaku sensoris dalam 3-6 bulan ke depan')
           .text('• Dokumentasikan strategi yang efektif untuk referensi masa depan')
           .text('• Libatkan guru atau caregiver dalam implementasi strategi')
           .text('• Pertimbangkan asesmen ulang jika ada perubahan signifikan');
        
        doc.moveDown(1);
        
        // Professional note
        doc.fontSize(10).font('Helvetica-Oblique')
           .text('Catatan: Hasil ini merupakan gambaran pola pemrosesan sensoris dan bukan diagnosis medis. Konsultasikan dengan profesional kesehatan atau terapis okupasi untuk interpretasi yang lebih komprehensif dan rencana intervensi yang sesuai.', { align: 'justify' });
      }

      // Move to bottom of page for disclaimer
      const pageHeight = doc.page.height;
      const bottomMargin = 50;
      
      // Different disclaimer based on assessment type
      let disclaimerText = '';
      let disclaimerHeight = 60;
      
      if (assessmentType === 'learning') {
        disclaimerText = 'Hasil asesmen menunjukkan kecenderungan kondisi Anda saat ini dan bukan merupakan diagnosa, sehingga diperlukan konsultasi lebih lanjut.';
        disclaimerHeight = 40;
      } else if (assessmentType === 'mental-health') {
        disclaimerText = 'Hasil ini merupakan skrining awal, bukan diagnosis. Jika gejala mengganggu aktivitas, menetap, memburuk, atau muncul risiko keselamatan diri, segera cari bantuan profesional.';
        disclaimerHeight = 52;
      } else if (assessmentType === 'student-potential') {
        disclaimerText = 'Hasil ini merupakan pemetaan awal, bukan skor IQ formal atau keputusan tunggal penentuan studi. Pertimbangkan nilai akademik, aspirasi siswa, pilihan mata pelajaran yang tersedia, serta diskusi dengan orang tua dan guru BK.';
        disclaimerHeight = 65;
      } else if (assessmentType === 'career-potential') {
        disclaimerText = 'Hasil ini bukan keputusan otomatis atau alat tunggal untuk rekrutmen, promosi, evaluasi kinerja, atau pengembangan. Gunakan hanya setelah analisis jabatan dan validasi profesional, bersama bukti kerja serta metode penilaian lain yang relevan.';
        disclaimerHeight = 68;
      } else {
        disclaimerText = 'Hasil asesmen menunjukkan kecenderungan kondisi Anda saat ini dan bukan merupakan diagnosa, sehingga diperlukan konsultasi lebih lanjut. Untuk penjadwalan konsultasi online, silakan kirim pesan ke WhatsApp Rumah Psikologi Pelangi Indonesia di nomor +62 819-9146-6546, dengan melampirkan hasil asesmen ini.';
        disclaimerHeight = 80;
      }
      
      doc.y = pageHeight - bottomMargin - disclaimerHeight;

      // Disclaimer at bottom of page
      doc.fontSize(9).font('Helvetica-Bold')
         .text('DISCLAIMER: ', { continued: true });

      doc.fontSize(9).font('Helvetica')
         .text(disclaimerText, { align: 'justify' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

async function fulfillPaidOrder(orderId: number, paymentId?: string) {
  const order = await storage.getOrder(orderId);
  if (!order) {
    console.log(`❌ Order ${orderId} not found`);
    return { assessmentsCreated: 0, bookingUpdated: false };
  }

  await storage.updateOrderStatus(orderId, 'completed', paymentId, 'paid');

  let assessmentsCreated = 0;
  if (order.orderItems.length > 0) {
    for (const item of order.orderItems) {
      if (isExternalAssessmentType(item.assessment.type)) {
        continue;
      }
      const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, order.id);
      if (!existingAssessment) {
        await storage.createUserAssessment({
          userId: order.userId,
          assessmentId: item.assessmentId,
          orderId: order.id,
          status: 'available',
        });
        assessmentsCreated++;
        console.log(`📚 Created assessment ${item.assessmentId} for user ${order.userId}`);
      }
    }

    await allocateExternalAssessmentCodes(orderId);

    return { assessmentsCreated, bookingUpdated: false };
  }

  const digitalItems = await pool.query(
    `SELECT id FROM digital_order_items WHERE order_id = $1 LIMIT 1`,
    [orderId],
  );
  if (digitalItems.rowCount) {
    return { assessmentsCreated: 0, bookingUpdated: false };
  }

  const physicalItems = await pool.query(`SELECT id FROM physical_order_items WHERE order_id = $1 LIMIT 1`, [orderId]);
  if (physicalItems.rowCount) {
    await pool.query(
      `UPDATE physical_order_shipping SET stock_status = 'committed', fulfillment_status = CASE WHEN fulfillment_status = 'awaiting_payment' THEN 'paid' ELSE fulfillment_status END, updated_at = now()
       WHERE order_id = $1 AND stock_status <> 'released'`,
      [orderId],
    );
    return { assessmentsCreated: 0, bookingUpdated: false };
  }

  const trainingRegistration = await pool.query(
    `UPDATE training_registrations
     SET status = 'registered', payment_status = 'paid', paid_at = COALESCE(paid_at, now()), updated_at = now()
     WHERE order_id = $1
     RETURNING id`,
    [orderId],
  );
  if (trainingRegistration.rowCount) {
    return { assessmentsCreated: 0, bookingUpdated: false };
  }

  const bookings = await storage.getPsychologistBookingsByOrder(orderId);
  const unpaidBookings = bookings.filter((booking) => booking.status !== 'paid');
  for (const booking of unpaidBookings) {
    await storage.updatePsychologistBookingStatus(booking.id, 'paid');
    console.log(`📅 Booking ${booking.id} marked as paid for order ${orderId}`);
  }
  if (unpaidBookings.length > 0) {
    return { assessmentsCreated: 0, bookingUpdated: true };
  }

  return { assessmentsCreated: 0, bookingUpdated: false };
}

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Session middleware for custom authentication
    app.use(getSession());

    // Initialize default assessments
    await ensureExternalAssessmentInfrastructure();
    await ensureDigitalProductInfrastructure();
    await ensurePhysicalProductInfrastructure();
    await ensureCourseInfrastructure();
    await ensureOnsiteAssessmentInfrastructure();
    await ensurePsychologyTestToolInfrastructure();
    await ensureWebsiteAnalyticsInfrastructure();
    await ensureTherapyGalleryInfrastructure();
    await ensureTrainingInfrastructure();
    await ensureArticleInfrastructure();
    await initializeInstagram(pool);
    await ensureHospitalityInfrastructure();
    await initializeAssessments();
    await initializeBookingServices();
    await ensureDefaultAdminUser();
  } catch (error) {
    console.error('Failed to initialize routes:', error);
    throw error;
  }

  // Contact form endpoint - public, no auth required
  app.post('/api/contact', async (req: any, res: any) => {
    try {
      const contactSchema = z.object({
        name: z.string().min(2),
        email: z.string().email(),
        phone: z.string().optional(),
        subject: z.string().min(3),
        message: z.string().min(10),
      });

      const parsed = contactSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: 'Data tidak valid', errors: parsed.error.flatten() });
      }

      const { name, email, phone, subject, message } = parsed.data;
      const sent = await emailService.sendContactEmail({ name, email, phone, subject, message });

      if (sent) {
        return res.json({ success: true, message: 'Pesan berhasil dikirim' });
      }

      if (!emailService.isContactEmailConfigured()) {
        return res.status(202).json({
          success: true,
          delivered: false,
          message: 'Pesan diterima, tetapi pengiriman email belum dikonfigurasi.',
        });
      }

      return res.status(500).json({ message: 'Gagal mengirim pesan. Silakan coba lagi.' });
    } catch (error) {
      console.error('Contact form error:', error);
      return res.status(500).json({ message: 'Terjadi kesalahan server' });
    }
  });

  // Auth routes
  app.get('/api/auth/user', async (req: any, res) => {
    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const token = authHeader.substring(7);
      const decoded = AuthUtils.verifyToken(token);
      
      if (!decoded || decoded.type !== 'access') {
        return res.status(401).json({ message: "Unauthorized" });
      }

      const user = await storage.getUser(decoded.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Remove password from response for security
      const { password, ...safeUser } = user;
      res.json(safeUser);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  app.get('/api/psychologist/bookings', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (canManageBookingsRole(user.role)) {
        return res.json(await storage.getAllPsychologistBookings());
      }

      const providerName = user.psychologistProfileName || getDisplayName(user);
      if (!providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const bookings = (await storage.getPsychologistBookingsByProvider(providerName)).filter((booking) => booking.status === "paid");
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching psychologist bookings:", error);
      res.status(500).json({ message: "Failed to fetch psychologist bookings" });
    }
  });

  app.get('/api/psychologist/availability', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const requestedName = typeof req.query.psychologistName === "string" ? req.query.psychologistName : undefined;
      const providerName = canManageBookingsRole(user.role)
        ? requestedName
        : user.psychologistProfileName || getDisplayName(user);

      if (!providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const availability = await storage.getPsychologistAvailability(providerName);
      res.json({ psychologistName: providerName, availability });
    } catch (error) {
      console.error("Error fetching psychologist availability:", error);
      res.status(500).json({ message: "Failed to fetch psychologist availability" });
    }
  });

  app.put('/api/psychologist/availability', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (canManageBookingsRole(user.role) && !canManagePsychologistSchedulesRole(user.role)) {
        return res.status(403).json({ message: "CSO hanya dapat melihat jadwal psikolog. Perubahan jadwal psikolog hanya dapat dilakukan admin." });
      }

      const data = psychologistAvailabilityUpdateSchema.parse(req.body);
      const providerName = canManagePsychologistSchedulesRole(user.role)
        ? data.psychologistName
        : user.psychologistProfileName || getDisplayName(user);

      if (!providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const availability = await storage.setPsychologistAvailability(providerName, data.availability);
      res.json({ psychologistName: providerName, availability });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data ketersediaan tidak valid", errors: error.flatten() });
      }
      console.error("Error updating psychologist availability:", error);
      res.status(500).json({ message: "Failed to update psychologist availability" });
    }
  });

  app.get('/api/psychologist/schedule-slots', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const requestedName = typeof req.query.psychologistName === "string" ? req.query.psychologistName : undefined;
      const providerName = canManageBookingsRole(user.role)
        ? requestedName
        : user.psychologistProfileName || getDisplayName(user);

      if (!providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const requestedMonth = typeof req.query.month === "string" ? req.query.month : undefined;
      const requestedRange = requestedMonth ? scheduleMonthRange(requestedMonth) : scheduleRange();
      if (!requestedRange) {
        return res.status(400).json({ message: "Format bulan harus YYYY-MM" });
      }
      const { startDate, endDate } = requestedRange;
      const scheduleSlots = await storage.getPsychologistScheduleSlots(providerName, startDate, endDate);
      res.json({ psychologistName: providerName, startDate, endDate, scheduleSlots });
    } catch (error) {
      console.error("Error fetching psychologist schedule slots:", error);
      res.status(500).json({ message: "Failed to fetch psychologist schedule slots" });
    }
  });

  app.put('/api/psychologist/schedule-slots', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (canManageBookingsRole(user.role) && !canManagePsychologistSchedulesRole(user.role)) {
        return res.status(403).json({ message: "CSO hanya dapat melihat jadwal psikolog. Perubahan jadwal psikolog hanya dapat dilakukan admin." });
      }

      const data = psychologistScheduleUpdateSchema.parse(req.body);
      const providerName = canManagePsychologistSchedulesRole(user.role)
        ? data.psychologistName
        : user.psychologistProfileName || getDisplayName(user);

      if (!providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const requestedRange = data.month ? scheduleMonthRange(data.month) : scheduleRange();
      if (!requestedRange) {
        return res.status(400).json({ message: "Format bulan harus YYYY-MM" });
      }
      const { startDate, endDate } = requestedRange;
      const normalizedSlots = data.slots.map((slot) => ({
        scheduleDate: slot.scheduleDate,
        timeSlot: normalizeTimeSlot(slot.timeSlot),
        location: slot.location,
        isAvailable: slot.isAvailable !== false,
      }));

      const invalidSlot = normalizedSlots.find((slot) =>
        slot.scheduleDate < startDate ||
        slot.scheduleDate > endDate ||
        !isValidTimeSlotRange(slot.timeSlot),
      );
      if (invalidSlot) {
        return res.status(400).json({ message: "Jadwal harus berada pada bulan yang dipilih dan jam 07.00-21.00." });
      }

      const overlappingSlot = findOverlappingScheduleSlot(normalizedSlots);
      if (overlappingSlot) {
        return res.status(400).json({
          message: `Jadwal konflik pada ${formatDisplayDate(overlappingSlot.scheduleDate)}: ${overlappingSlot.previous} bertabrakan dengan ${overlappingSlot.current}.`,
        });
      }

      if (normalizedSlots.length > 0) {
        await storage.setPsychologistScheduleSlots(providerName, normalizedSlots, user.id);
      }
      const scheduleSlots = await storage.getPsychologistScheduleSlots(providerName, startDate, endDate);
      res.json({ psychologistName: providerName, startDate, endDate, scheduleSlots });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data jadwal tidak valid", errors: error.flatten() });
      }
      console.error("Error updating psychologist schedule slots:", error);
      res.status(500).json({ message: "Failed to update psychologist schedule slots" });
    }
  });

  app.get('/api/psychologist/reports', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const search = typeof req.query.search === "string" ? req.query.search : undefined;
      const reports = await storage.searchPsychologistBookingReports(search);
      res.json(reports);
    } catch (error) {
      console.error("Error fetching psychologist reports:", error);
      res.status(500).json({ message: "Failed to fetch psychologist reports" });
    }
  });

  app.patch('/api/psychologist/bookings/:id/schedule', isAuthenticated, async (req: any, res) => {
    try {
      if (!canManageBookingsRole(req.user.role)) {
        return res.status(403).json({ message: "Perubahan jadwal klien hanya dapat dilakukan oleh admin/CSO." });
      }

      const bookingId = parseInt(req.params.id);
      const booking = await storage.getPsychologistBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (booking.status !== "paid") {
        return res.status(400).json({ message: "Jadwal hanya dapat diubah untuk klien yang sudah membayar." });
      }

      const data = bookingScheduleUpdateSchema.parse(req.body);
      if (!(await isPsychologistAvailable(booking.psychologistName, data.preferredDate, data.preferredTime, data.location, booking.id))) {
        return res.status(400).json({ message: "Psikolog tidak tersedia pada hari dan jam yang dipilih, atau jadwal bertabrakan dengan booking lain yang sudah dibayar." });
      }

      await storage.updatePsychologistBookingSchedule(booking.id, {
        preferredDate: data.preferredDate,
        preferredTime: normalizeTimeSlot(data.preferredTime),
        location: data.location,
      });

      const updatedBooking = await storage.getPsychologistBooking(booking.id);
      const waSchedulePlaceholder = createWaNotificationPlaceholder("client_counseling_schedule_notification", {
        bookingId: booking.id,
        orderId: booking.orderId,
        clientName: booking.clientName,
        clientWhatsapp: booking.whatsappNumber,
        preferredDate: data.preferredDate,
        preferredTime: normalizeTimeSlot(data.preferredTime),
        location: data.location,
        trigger: "admin_cso_schedule_saved_for_paid_booking",
      });
      res.json({ ...updatedBooking, waSchedulePlaceholder });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data jadwal tidak valid", errors: error.flatten() });
      }
      console.error("Error updating psychologist schedule:", error);
      res.status(500).json({ message: "Failed to update psychologist schedule" });
    }
  });

  app.patch('/api/psychologist/bookings/:id/meeting-link', isAuthenticated, async (req: any, res) => {
    try {
      if (req.user.role !== "admin") {
        return res.status(403).json({ message: "Input link meeting hanya dapat dilakukan oleh admin super." });
      }

      const bookingId = parseInt(req.params.id);
      const booking = await storage.getPsychologistBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.location !== "online") {
        return res.status(400).json({ message: "Link meeting hanya untuk konseling online." });
      }

      if (booking.status !== "paid") {
        return res.status(400).json({ message: "Link meeting hanya dapat disimpan untuk klien yang sudah membayar." });
      }

      const data = meetingLinkUpdateSchema.parse(req.body);
      await storage.updatePsychologistBookingSchedule(booking.id, {
        meetingUrl: data.meetingUrl || null,
      });

      const updatedBooking = await storage.getPsychologistBooking(booking.id);
      res.json(updatedBooking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data link meeting tidak valid", errors: error.flatten() });
      }
      console.error("Error updating meeting link:", error);
      res.status(500).json({ message: "Failed to update meeting link" });
    }
  });

  app.patch('/api/psychologist/bookings/:id/report', isAuthenticated, async (req: any, res) => {
    try {
      if (!canAccessPsychologistAreaRole(req.user.role)) {
        return res.status(403).json({ message: "Access denied. Psychologist role required." });
      }

      const bookingId = parseInt(req.params.id);
      const booking = await storage.getPsychologistBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (canManageBookingsRole(user.role) && user.role !== "admin") {
        return res.status(403).json({ message: "CSO hanya dapat melihat laporan. Perubahan laporan hanya dapat dilakukan psikolog atau admin." });
      }

      const providerName = user.psychologistProfileName || getDisplayName(user);
      if (!canManageBookingsRole(user.role) && booking.psychologistName !== providerName) {
        return res.status(403).json({ message: "Access denied" });
      }

      const data = bookingReportSchema.parse(req.body);
      const isAdminSuper = user.role === "admin";
      const submitClientReport = Boolean(data.submitClientReport || data.submit);
      const submitHistoryReport = Boolean(data.submitHistoryReport || data.submit);
      const clientReportFieldsTouched = data.clientReportNotes !== undefined || data.reportRecommendations !== undefined;
      if (booking.reportSubmittedAt && !isAdminSuper && clientReportFieldsTouched) {
        return res.status(403).json({
          message: "Laporan untuk klien sudah selesai dan hanya admin super yang dapat mengeditnya.",
        });
      }

      const nextClientReportText = data.clientReportNotes?.trim() || data.reportRecommendations?.trim() || "";
      if (submitClientReport && !nextClientReportText && !getClientReportText(booking)) {
        return res.status(400).json({
          message: "Laporan untuk klien wajib diisi sebelum diselesaikan.",
        });
      }

      const nextSubjective = data.counselingSubjectiveNotes?.trim() || booking.counselingSubjectiveNotes || booking.mainConcern || "";
      const nextResult = data.counselingResultNotes?.trim() || data.counselingHistoryNotes?.trim() || getHistoryReportText(booking);
      const nextPlan = data.counselingPlanNotes?.trim() || booking.counselingPlanNotes || "";
      if (submitHistoryReport && (!nextSubjective || !nextResult || !nextPlan)) {
        return res.status(400).json({
          message: "Keluhan/riwayat subjektif, hasil konseling, dan rencana penatalaksanaan wajib diisi.",
        });
      }

      await storage.updatePsychologistBookingReport(booking.id, {
        meetingUrl: data.meetingUrl !== undefined ? data.meetingUrl || null : undefined,
        sessionReport: data.sessionReport !== undefined ? data.sessionReport?.trim() || null : undefined,
        reportRecommendations: data.reportRecommendations !== undefined ? data.reportRecommendations?.trim() || null : undefined,
        clientReportNotes: data.clientReportNotes !== undefined ? data.clientReportNotes?.trim() || null : undefined,
        counselingHistoryNotes: data.counselingHistoryNotes !== undefined ? data.counselingHistoryNotes?.trim() || null : undefined,
        counselingSubjectiveNotes: data.counselingSubjectiveNotes !== undefined ? data.counselingSubjectiveNotes?.trim() || null : undefined,
        counselingObservations: data.counselingObservations,
        counselingResultNotes: data.counselingResultNotes !== undefined ? data.counselingResultNotes?.trim() || null : undefined,
        counselingPlanNotes: data.counselingPlanNotes !== undefined ? data.counselingPlanNotes?.trim() || null : undefined,
        submit: submitClientReport,
      });

      const updatedBooking = await storage.getPsychologistBooking(booking.id);
      res.json(updatedBooking);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data laporan tidak valid", errors: error.flatten() });
      }
      console.error("Error updating psychologist report:", error);
      res.status(500).json({ message: "Failed to update psychologist report" });
    }
  });

  // Custom Authentication Routes
  
  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Remove confirmPassword from data before saving to database
      const { confirmPassword, ...userData } = validatedData;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      const canClaimManualUser = existingUser && existingUser.authProvider === "manual" && !existingUser.password;
      if (existingUser && !canClaimManualUser) {
        return res.status(400).json({ message: "Email sudah terdaftar" });
      }

      // Validate WhatsApp number
      if (!AuthUtils.isValidWhatsAppNumber(userData.whatsappNumber)) {
        return res.status(400).json({ message: "Nomor WhatsApp tidak valid" });
      }

      // Hash password
      const hashedPassword = await AuthUtils.hashPassword(userData.password);
      
      // Generate user ID
      const userId = AuthUtils.generateUserId();
      
      // Normalize WhatsApp number
      const normalizedWhatsApp = AuthUtils.normalizeWhatsAppNumber(userData.whatsappNumber);

      const newUser = canClaimManualUser
        ? await storage.updateUser(existingUser.id, {
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            whatsappNumber: normalizedWhatsApp,
            authProvider: "custom",
            isEmailVerified: true,
            isActive: true,
          })
        : await storage.createUser({
            id: userId,
            email: userData.email,
            password: hashedPassword,
            firstName: userData.firstName,
            lastName: userData.lastName,
            whatsappNumber: normalizedWhatsApp,
            authProvider: 'custom',
            isEmailVerified: true
          });

      // Generate tokens for immediate login
      const accessToken = AuthUtils.generateAccessToken(newUser.id, newUser.email, newUser.role || 'user');
      const refreshToken = AuthUtils.generateRefreshToken(newUser.id);

      // Set session data
      (req as any).session.user = AuthUtils.generateSessionData(newUser);

      res.status(201).json({
        message: "Registrasi berhasil. Anda sudah masuk ke sistem.",
        user: {
          id: newUser.id,
          email: newUser.email,
          firstName: newUser.firstName,
          lastName: newUser.lastName,
          whatsappNumber: newUser.whatsappNumber,
          isEmailVerified: true
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      console.error("Registration error:", error);
      res.status(500).json({ message: "Gagal mendaftar akun" });
    }
  });

  // Verify email with OTP
  app.post('/api/auth/verify-email', async (req, res) => {
    try {
      const { email, otp } = otpVerificationSchema.parse(req.body);

      // Check if OTP is valid
      const otpRecord = await storage.getValidOtp(email, otp, 'email_verification');
      if (!otpRecord) {
        return res.status(400).json({ message: "OTP tidak valid atau sudah kadaluarsa" });
      }

      // Get user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      // Mark email as verified
      await storage.updateUserVerification(user.id, true);
      
      // Mark OTP as used
      await storage.markOtpAsUsed(otpRecord.id);

      // Generate tokens
      const accessToken = AuthUtils.generateAccessToken(user.id, user.email, user.role || 'user');
      const refreshToken = AuthUtils.generateRefreshToken(user.id);

      // Set session data
      (req as any).session.user = AuthUtils.generateSessionData(user);

      res.json({
        message: "Email berhasil diverifikasi",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          whatsappNumber: user.whatsappNumber,
          isEmailVerified: true
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      console.error("Email verification error:", error);
      res.status(500).json({ message: "Gagal memverifikasi email" });
    }
  });

  // Login user
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { email, password } = loginSchema.parse(req.body);

      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Email atau password salah" });
      }

      // Check password
      const isPasswordValid = await AuthUtils.comparePassword(password, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({ message: "Email atau password salah" });
      }

      // Check if email is verified
      if (!user.isEmailVerified) {
        return res.status(401).json({ 
          message: "Email belum diverifikasi. Silakan cek email Anda.",
          requiresVerification: true,
          email: user.email
        });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);

      // Generate tokens
      const accessToken = AuthUtils.generateAccessToken(user.id, user.email, user.role || 'user');
      const refreshToken = AuthUtils.generateRefreshToken(user.id);

      // Set session data
      (req as any).session.user = AuthUtils.generateSessionData(user);

      res.json({
        message: "Login berhasil",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          whatsappNumber: user.whatsappNumber,
          isEmailVerified: user.isEmailVerified,
          role: user.role,
          psychologistProfileName: user.psychologistProfileName
        },
        accessToken,
        refreshToken
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      console.error("Login error:", error);
      res.status(500).json({ message: "Gagal login" });
    }
  });

  app.post('/api/auth/forgot-password', async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email("Email tidak valid") }).parse(req.body);
      const user = await storage.getUserByEmail(email);

      if (!user || !user.password) {
        return res.json({ message: "Jika email terdaftar, kode reset password akan dikirim." });
      }

      const otp = AuthUtils.generateOtp();
      await storage.createOtpVerification({
        email,
        otp,
        purpose: "password_reset",
        expiresAt: AuthUtils.getOtpExpirationTime(),
      });

      const emailSent = await emailService.sendOtpEmail({
        to: email,
        otp,
        purpose: "password_reset",
        firstName: user.firstName || undefined,
      });

      if (!emailSent) {
        return res.status(500).json({ message: "Gagal mengirim email reset password" });
      }

      res.json({ message: "Kode reset password telah dikirim ke email Anda." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data tidak valid", errors: error.errors });
      }
      console.error("Forgot password error:", error);
      res.status(500).json({ message: "Gagal memproses reset password" });
    }
  });

  app.post('/api/auth/reset-password', async (req, res) => {
    try {
      const data = resetPasswordWithOtpSchema.parse(req.body);
      const otpRecord = await storage.getValidOtp(data.email, data.otp, "password_reset");
      if (!otpRecord) {
        return res.status(400).json({ message: "Kode OTP tidak valid atau sudah kadaluarsa" });
      }

      const user = await storage.getUserByEmail(data.email);
      if (!user) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      await storage.resetUserPassword(user.id, data.newPassword);
      await storage.markOtpAsUsed(otpRecord.id);

      res.json({ message: "Password berhasil direset. Silakan login dengan password baru." });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data tidak valid", errors: error.errors });
      }
      console.error("Reset password error:", error);
      res.status(500).json({ message: "Gagal mereset password" });
    }
  });

  // Resend OTP
  app.post('/api/auth/resend-otp', async (req, res) => {
    try {
      const { email } = req.body;
      
      if (!AuthUtils.isValidEmail(email)) {
        return res.status(400).json({ message: "Email tidak valid" });
      }

      // Check if user exists
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User tidak ditemukan" });
      }

      // Check if already verified
      if (user.isEmailVerified) {
        return res.status(400).json({ message: "Email sudah diverifikasi" });
      }

      // Generate new OTP
      const otp = AuthUtils.generateOtp();
      const otpExpiry = AuthUtils.getOtpExpirationTime();

      await storage.createOtpVerification({
        email,
        otp,
        purpose: 'email_verification',
        expiresAt: otpExpiry
      });

      // Send OTP email
      const emailSent = await emailService.sendOtpEmail({
        to: email,
        otp,
        purpose: 'email_verification',
        firstName: user.firstName
      });

      if (!emailSent) {
        return res.status(500).json({ message: "Gagal mengirim email OTP" });
      }

      res.json({ message: "OTP baru telah dikirim ke email Anda" });

    } catch (error) {
      console.error("Resend OTP error:", error);
      res.status(500).json({ message: "Gagal mengirim ulang OTP" });
    }
  });

  // Logout (both GET and POST for compatibility)
  const logoutHandler = async (req: any, res: any) => {
    try {
      // For JWT auth, we just return success since tokens are handled client-side
      res.json({ message: "Logout berhasil" });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Gagal logout" });
    }
  };

  app.post('/api/auth/logout', logoutHandler);
  app.get('/api/logout', logoutHandler);

  // Assessment routes
  app.get('/api/assessments', async (req, res) => {
    try {
      const assessments = await storage.getAssessments();
      res.json(assessments);
    } catch (error) {
      console.error("Error fetching assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  app.get('/api/assessments/:id', async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      const assessment = await storage.getAssessment(id);
      if (!assessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }
      res.json(assessment);
    } catch (error) {
      console.error("Error fetching assessment:", error);
      res.status(500).json({ message: "Failed to fetch assessment" });
    }
  });

  // Psychologist booking routes
  app.get('/api/booking-services', async (_req, res) => {
    try {
      const services = await storage.getBookingServices();
      res.json(services);
    } catch (error) {
      console.error("Error fetching booking services:", error);
      res.status(500).json({ message: "Failed to fetch booking services" });
    }
  });

  app.get('/api/psychologists', async (_req, res) => {
    try {
      res.json(await getPsychologistOptions());
    } catch (error) {
      console.error("Error fetching psychologists:", error);
      res.status(500).json({ message: "Failed to fetch psychologists" });
    }
  });

  app.get('/api/psychologist-availability', async (req, res) => {
    try {
      const psychologistName = typeof req.query.psychologistName === "string" ? req.query.psychologistName : "";
      if (!psychologistName) {
        return res.status(400).json({ message: "Nama psikolog wajib diisi" });
      }
      const { startDate, endDate } = scheduleRange();
      const availability = await storage.getPsychologistAvailability(psychologistName);
      const scheduleSlots = await storage.getPsychologistScheduleSlots(psychologistName, startDate, endDate);
      const paidBookings = (await storage.getPsychologistBookingsByProvider(psychologistName))
        .filter(isBookingReservationActive)
        .map((booking) => ({
          preferredDate: booking.preferredDate,
          preferredTime: normalizeTimeSlot(booking.preferredTime),
          range: parseTimeSlotRange(booking.preferredTime),
        }));
      const publicScheduleSlots = scheduleSlots.map((slot) => ({
        ...slot,
        isAvailable: slot.isAvailable && !paidBookings.some((booking) => {
          if (booking.preferredDate !== slot.scheduleDate) return false;
          const slotRange = parseTimeSlotRange(slot.timeSlot);
          if (!slotRange || !booking.range) return booking.preferredTime === slot.timeSlot;
          return slotRange.startMinutes < booking.range.endMinutes && booking.range.startMinutes < slotRange.endMinutes;
        }),
      }));
      res.json({ psychologistName, availability, scheduleSlots: publicScheduleSlots });
    } catch (error) {
      console.error("Error fetching public psychologist availability:", error);
      res.status(500).json({ message: "Failed to fetch psychologist availability" });
    }
  });

  app.get('/api/dass-screenings/eligibility', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [bookings, screenings] = await Promise.all([
        storage.getUserPsychologistBookings(userId),
        storage.getDassScreeningsByUser(userId),
      ]);
      const screeningByOrder = new Map(screenings.map((screening) => [screening.orderId, screening]));
      const eligibleOrders = new Map<number, {
        orderId: number;
        psychologistName: string | null;
        preferredDate: string;
        preferredTime: string;
        completed: boolean;
        completedAt: Date | null;
        canAccess: boolean;
        accessStatus: "available" | "upcoming" | "expired";
      }>();

      const latestPaidBooking = bookings
        .filter(isPaidCounselingBooking)
        .sort((left, right) => right.id - left.id)[0];

      bookings
        .filter((booking) => latestPaidBooking
          && booking.orderId === latestPaidBooking.orderId
          && isScreeningEligibleConsultation(booking))
        .forEach((booking) => {
          if (eligibleOrders.has(booking.orderId)) return;
          const screening = screeningByOrder.get(booking.orderId);
          const dateAccess = getScreeningDateAccess(booking.preferredDate);
          eligibleOrders.set(booking.orderId, {
            orderId: booking.orderId,
            psychologistName: booking.psychologistName,
            preferredDate: booking.preferredDate,
            preferredTime: booking.preferredTime,
            completed: Boolean(screening),
            completedAt: screening?.completedAt ?? null,
            ...dateAccess,
          });
        });

      return res.json({ eligibleOrders: Array.from(eligibleOrders.values()) });
    } catch (error) {
      console.error("Error fetching DASS eligibility:", error);
      return res.status(500).json({ message: "Failed to fetch DASS eligibility" });
    }
  });

  app.post('/api/dass-screenings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = dassSubmissionSchema.parse(req.body);
      const booking = await storage.getPsychologistBookingByOrder(data.orderId);

      if (!booking || booking.userId !== userId) {
        return res.status(404).json({ message: "Booking konseling tidak ditemukan" });
      }
      if (!isScreeningEligibleConsultation(booking)) {
        return res.status(403).json({ message: "Tes DASS tidak tersedia untuk konsultasi perkembangan anak & remaja" });
      }
      if (!isPaidCounselingBooking(booking)) {
        return res.status(403).json({ message: "Tes DASS hanya tersedia setelah pembayaran konseling selesai" });
      }
      if (!getScreeningDateAccess(booking.preferredDate).canAccess) {
        return res.status(403).json({ message: screeningDateAccessMessage("Tes DASS", booking.preferredDate) });
      }
      const latestPaidBooking = (await storage.getUserPsychologistBookings(userId))
        .filter(isPaidCounselingBooking)
        .sort((left, right) => right.id - left.id)[0];
      if (!latestPaidBooking || latestPaidBooking.orderId !== data.orderId) {
        return res.status(403).json({ message: "Tes DASS hanya tersedia untuk booking konseling berbayar terbaru" });
      }
      if (await storage.getDassScreeningByOrder(data.orderId)) {
        return res.status(409).json({ message: "Tes DASS untuk booking ini sudah pernah diselesaikan" });
      }

      const depressionScore = sumDassItems(data.answers, DASS_DEPRESSION_ITEMS);
      const anxietyScore = sumDassItems(data.answers, DASS_ANXIETY_ITEMS);
      const stressScore = sumDassItems(data.answers, DASS_STRESS_ITEMS);
      await storage.createDassScreening({
        userId,
        orderId: data.orderId,
        answers: data.answers,
        depressionScore,
        anxietyScore,
        stressScore,
        depressionCategory: getDassCategory("depression", depressionScore),
        anxietyCategory: getDassCategory("anxiety", anxietyScore),
        stressCategory: getDassCategory("stress", stressScore),
      });

      return res.status(201).json({ completed: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Jawaban DASS tidak lengkap atau tidak valid", errors: error.flatten() });
      }
      console.error("Error saving DASS screening:", error);
      return res.status(500).json({ message: "Failed to save DASS screening" });
    }
  });

  app.get('/api/psychologist/dass-screenings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "psychologist" && user.role !== "admin") {
        return res.status(403).json({ message: "Hasil DASS hanya dapat diakses oleh psikolog atau admin" });
      }
      const providerName = user.role === "psychologist"
        ? user.psychologistProfileName || getDisplayName(user)
        : undefined;
      if (user.role === "psychologist" && !providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const screenings = await storage.getDassScreeningsByPsychologist(providerName);
      return res.json(screenings.map((screening) => ({
        id: screening.id,
        orderId: screening.orderId,
        clientName: screening.clientName,
        preferredDate: screening.preferredDate,
        preferredTime: screening.preferredTime,
        completedAt: screening.completedAt,
        depressionScore: screening.depressionScore,
        depressionCategory: screening.depressionCategory,
        anxietyScore: screening.anxietyScore,
        anxietyCategory: screening.anxietyCategory,
        stressScore: screening.stressScore,
        stressCategory: screening.stressCategory,
      })));
    } catch (error) {
      console.error("Error fetching psychologist DASS screenings:", error);
      return res.status(500).json({ message: "Failed to fetch DASS screenings" });
    }
  });

  app.get('/api/psychologist/dass-screenings/:id/report.pdf', isAuthenticated, async (req: any, res) => {
    try {
      const screeningId = Number(req.params.id);
      if (!Number.isInteger(screeningId) || screeningId <= 0) {
        return res.status(400).json({ message: "ID hasil DASS tidak valid" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "psychologist" && user.role !== "admin") {
        return res.status(403).json({ message: "Laporan DASS hanya dapat diakses oleh psikolog atau admin" });
      }
      const providerName = user.role === "psychologist"
        ? user.psychologistProfileName || getDisplayName(user)
        : undefined;
      if (user.role === "psychologist" && !providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const screening = (await storage.getDassScreeningsByPsychologist(providerName))
        .find((item) => item.id === screeningId);
      if (!screening) {
        return res.status(404).json({ message: "Hasil DASS tidak ditemukan untuk psikolog ini" });
      }
      const booking = await storage.getPsychologistBookingByOrder(screening.orderId);
      if (!booking || (user.role === "psychologist" && booking.psychologistName !== providerName)) {
        return res.status(403).json({ message: "Anda tidak memiliki akses ke laporan DASS ini" });
      }
      if (!Array.isArray(screening.answers) || screening.answers.length !== DASS_QUESTIONS.length) {
        return res.status(422).json({ message: "Jawaban DASS tidak lengkap" });
      }

      streamDassScreeningReportPdf(res, screening, booking);
      return;
    } catch (error) {
      console.error("Error generating DASS screening PDF:", error);
      if (!res.headersSent) return res.status(500).json({ message: "Failed to generate DASS PDF" });
      res.end();
      return;
    }
  });

  app.get('/api/srq-screenings/eligibility', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const [bookings, screenings] = await Promise.all([
        storage.getUserPsychologistBookings(userId),
        storage.getSrqScreeningsByUser(userId),
      ]);
      const screeningByOrder = new Map(screenings.map((screening) => [screening.orderId, screening]));
      const latestPaidBooking = bookings
        .filter(isPaidCounselingBooking)
        .sort((left, right) => right.id - left.id)[0];
      const eligibleOrders = new Map<number, {
        orderId: number;
        psychologistName: string | null;
        preferredDate: string;
        preferredTime: string;
        completed: boolean;
        completedAt: Date | null;
        canAccess: boolean;
        accessStatus: "available" | "upcoming" | "expired";
      }>();

      bookings
        .filter((booking) => latestPaidBooking
          && booking.orderId === latestPaidBooking.orderId
          && isScreeningEligibleConsultation(booking))
        .forEach((booking) => {
          if (eligibleOrders.has(booking.orderId)) return;
          const screening = screeningByOrder.get(booking.orderId);
          const dateAccess = getScreeningDateAccess(booking.preferredDate);
          eligibleOrders.set(booking.orderId, {
            orderId: booking.orderId,
            psychologistName: booking.psychologistName,
            preferredDate: booking.preferredDate,
            preferredTime: booking.preferredTime,
            completed: Boolean(screening),
            completedAt: screening?.completedAt ?? null,
            ...dateAccess,
          });
        });

      return res.json({ eligibleOrders: Array.from(eligibleOrders.values()) });
    } catch (error) {
      console.error("Error fetching SRQ eligibility:", error);
      return res.status(500).json({ message: "Failed to fetch SRQ eligibility" });
    }
  });

  app.post('/api/srq-screenings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = srqSubmissionSchema.parse(req.body);
      const booking = await storage.getPsychologistBookingByOrder(data.orderId);

      if (!booking || booking.userId !== userId) {
        return res.status(404).json({ message: "Booking konseling tidak ditemukan" });
      }
      if (!isScreeningEligibleConsultation(booking)) {
        return res.status(403).json({ message: "Tes SRQ tidak tersedia untuk konsultasi perkembangan anak & remaja" });
      }
      if (!isPaidCounselingBooking(booking)) {
        return res.status(403).json({ message: "Tes SRQ hanya tersedia setelah pembayaran konseling selesai" });
      }
      if (!getScreeningDateAccess(booking.preferredDate).canAccess) {
        return res.status(403).json({ message: screeningDateAccessMessage("Tes SRQ", booking.preferredDate) });
      }
      const latestPaidBooking = (await storage.getUserPsychologistBookings(userId))
        .filter(isPaidCounselingBooking)
        .sort((left, right) => right.id - left.id)[0];
      if (!latestPaidBooking || latestPaidBooking.orderId !== data.orderId) {
        return res.status(403).json({ message: "Tes SRQ hanya tersedia untuk booking konseling berbayar terbaru" });
      }
      if (await storage.getSrqScreeningByOrder(data.orderId)) {
        return res.status(409).json({ message: "Tes SRQ untuk booking ini sudah pernah diselesaikan" });
      }

      const score = data.answers.filter(Boolean).length;
      await storage.createSrqScreening({
        userId,
        orderId: data.orderId,
        answers: data.answers,
        score,
        category: getSrqCategory(score),
        hasSafetyAlert: data.answers[16],
      });

      return res.status(201).json({ completed: true });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Jawaban SRQ tidak lengkap atau tidak valid", errors: error.flatten() });
      }
      console.error("Error saving SRQ screening:", error);
      return res.status(500).json({ message: "Failed to save SRQ screening" });
    }
  });

  app.get('/api/psychologist/srq-screenings', isAuthenticated, async (req: any, res) => {
    try {
      const user = await storage.getUser(req.user.claims.sub);
      if (!user) return res.status(404).json({ message: "User not found" });
      if (user.role !== "psychologist" && user.role !== "admin") {
        return res.status(403).json({ message: "Hasil SRQ hanya dapat diakses oleh psikolog atau admin" });
      }
      const providerName = user.role === "psychologist"
        ? user.psychologistProfileName || getDisplayName(user)
        : undefined;
      if (user.role === "psychologist" && !providerName) {
        return res.status(400).json({ message: "Profil psikolog belum dihubungkan ke daftar booking" });
      }

      const screenings = await storage.getSrqScreeningsByPsychologist(providerName);
      return res.json(screenings.map((screening) => ({
        id: screening.id,
        orderId: screening.orderId,
        clientName: screening.clientName,
        preferredDate: screening.preferredDate,
        preferredTime: screening.preferredTime,
        completedAt: screening.completedAt,
        score: screening.score,
        category: screening.category,
        hasSafetyAlert: screening.hasSafetyAlert,
        affirmativeItems: screening.answers
          .map((answer, index) => answer ? index + 1 : null)
          .filter((itemNumber): itemNumber is number => itemNumber !== null),
      })));
    } catch (error) {
      console.error("Error fetching psychologist SRQ screenings:", error);
      return res.status(500).json({ message: "Failed to fetch SRQ screenings" });
    }
  });

  app.get('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const bookings = await storage.getUserPsychologistBookings(userId);
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  app.get('/api/bookings/:id/client-report.pdf', isAuthenticated, async (req: any, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getPsychologistBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const canAccess =
        booking.userId === req.user.claims.sub ||
        canManageBookingsRole(user.role) ||
        user.role === "psychologist";
      if (!canAccess) {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!booking.reportSubmittedAt || !getClientReportText(booking)) {
        return res.status(404).json({ message: "Laporan untuk klien belum tersedia" });
      }

      const psychologist = booking.psychologistName ? await getPsychologistOption(booking.psychologistName) : undefined;
      await streamClientCounselingReportPdf(res, booking, psychologist);
    } catch (error) {
      console.error("Error generating client counseling report PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.get('/api/bookings/:id/history-report.pdf', isAuthenticated, async (req: any, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getPsychologistBooking(bookingId);
      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      const user = await storage.getUser(req.user.claims.sub);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      if (!canManageBookingsRole(user.role) && user.role !== "psychologist") {
        return res.status(403).json({ message: "Access denied" });
      }

      if (!getHistoryReportText(booking)) {
        return res.status(404).json({ message: "Riwayat konseling belum tersedia" });
      }

      const psychologist = booking.psychologistName ? await getPsychologistOption(booking.psychologistName) : undefined;
      await streamHistoryCounselingReportPdf(res, booking, psychologist);
    } catch (error) {
      console.error("Error generating counseling history PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  app.post('/api/bookings', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const data = bookingRequestSchema.parse(req.body);
      const service = await storage.getBookingService(data.serviceId);

      if (!service || !service.isActive) {
        return res.status(404).json({ message: "Booking service not found" });
      }

      const psychologist = await getPsychologistOption(data.psychologistName);
      if (!psychologist || !psychologist.types.includes(data.consultationType)) {
        return res.status(400).json({ message: "Psikolog tidak sesuai dengan jenis konsultasi." });
      }
      const preferredTimes = [data.preferredTime, data.additionalPreferredTime].filter((time): time is string => Boolean(time));
      for (const preferredTime of preferredTimes) {
        if (!(await isPsychologistAvailable(data.psychologistName, data.preferredDate, preferredTime, data.location))) {
          return res.status(400).json({ message: "Salah satu sesi tidak lagi tersedia. Silakan pilih jadwal kembali." });
        }
      }

      const amount = getPsychologistFee(psychologist, data.consultationType);
      const bookingData = {
        userId,
        serviceId: service.id,
        clientName: data.clientName,
        birthDate: data.birthDate,
        gender: data.gender,
        age: data.age,
        email: data.email,
        whatsappNumber: data.whatsappNumber,
        mainConcern: data.mainConcern,
        concernHistory: data.concernHistory,
        consultationType: data.consultationType,
        childName: data.childName,
        childBirthDate: data.childBirthDate,
        previousDiagnosis: data.previousDiagnosis,
        preferredDate: data.preferredDate,
        psychologistName: data.psychologistName,
        psychologistFee: amount,
        location: data.location,
        status: 'pending_payment',
      };
      const created = await storage.createPsychologistBookingOrder(
        {
          userId,
          totalAmount: String(Number(amount) * preferredTimes.length),
          status: 'pending',
        },
        preferredTimes.map((preferredTime) => ({
          ...bookingData,
          preferredTime: normalizeTimeSlot(preferredTime),
        })),
      );

      await recordWebsiteCheckout(created.order.id, 'counseling');
      const groupedBookings = await storage.getPsychologistBookingsByOrder(created.order.id);
      return res.status(201).json({
        ...groupedBookings[0],
        groupBookings: groupedBookings,
        sessionCount: groupedBookings.length,
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data booking tidak valid", errors: error.flatten() });
      }
      if (error instanceof Error && error.message === "BOOKING_SLOT_UNAVAILABLE") {
        return res.status(409).json({ message: "Salah satu sesi baru saja dipilih klien lain. Silakan pilih jadwal kembali." });
      }
      console.error("Error creating booking:", error);
      return res.status(500).json({ message: "Failed to create booking" });
    }
  });

  app.post('/api/bookings/:id/pay', isAuthenticated, async (req: any, res) => {
    try {
      const bookingId = parseInt(req.params.id);
      const booking = await storage.getPsychologistBooking(bookingId);

      if (!booking) {
        return res.status(404).json({ message: "Booking not found" });
      }

      if (booking.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      const order = await storage.getOrder(booking.orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      const normalizedOrder = await expireOrderIfNeeded(order);
      if (normalizedOrder.status === "completed" || normalizedOrder.paymentStatus === "paid") {
        return res.status(400).json({ message: "Order is already paid" });
      }

      if (normalizedOrder.status === "cancelled" || normalizedOrder.paymentStatus === "expired" || normalizedOrder.paymentStatus === "cancelled" || normalizedOrder.paymentStatus === "failed") {
        return res.status(400).json({ message: "Pesanan sudah dibatalkan atau kadaluwarsa. Silakan isi booking ulang." });
      }

      const timestamp = Date.now();
      const midtransOrderId = `order_${booking.orderId}_${timestamp}`;
      const user = await storage.getUser(booking.userId);
      const groupedBookings = await storage.getPsychologistBookingsByOrder(booking.orderId);
      const bookingAmount = order.totalAmount;
      const unitPrice = parseInt(booking.psychologistFee || booking.service.price);

      const transaction = await createMidtransTransaction({
        orderId: midtransOrderId,
        amount: parseInt(bookingAmount),
        expiryMinutes: PAYMENT_EXPIRY_MINUTES,
        customerDetails: {
          first_name: booking.clientName || user?.firstName || 'Customer',
          last_name: user?.lastName || '',
          email: booking.email,
          phone: booking.whatsappNumber,
        },
        itemDetails: [
          {
            id: `booking_service_${booking.serviceId}`,
            name: `${booking.service.name} - ${booking.psychologistName || "Psikolog"}${groupedBookings.length > 1 ? ` (${groupedBookings.length} sesi)` : ""}`,
            price: unitPrice,
            quantity: groupedBookings.length,
          },
        ],
      });

      await storage.updateOrderStatus(booking.orderId, 'pending', midtransOrderId, 'pending');

      const waReminderPlaceholder = createWaNotificationPlaceholder("booking_payment_reminder", {
        bookingId: booking.id,
        bookingIds: groupedBookings.map((item) => item.id),
        orderId: booking.orderId,
        clientName: booking.clientName,
        clientWhatsapp: booking.whatsappNumber,
        paymentId: midtransOrderId,
        trigger: "after_midtrans_payment_deadline_if_unpaid",
      });

      res.json({
        ...transaction,
        paymentId: midtransOrderId,
        orderId: booking.orderId,
        bookingId: booking.id,
        bookingIds: groupedBookings.map((item) => item.id),
        sessionCount: groupedBookings.length,
        amount: bookingAmount,
        status: 'pending',
        waReminderPlaceholder,
      });
    } catch (error) {
      console.error("Error creating booking payment:", error);
      res.status(500).json({ message: "Failed to create booking payment" });
    }
  });

  app.post('/api/admin/manual-counseling-bookings', isAuthenticated, async (req: any, res) => {
    try {
      if (!canManageBookingsRole(req.user.role)) {
        return res.status(403).json({ message: "Akses hanya untuk admin/CSO." });
      }

      const data = manualCounselingBookingSchema.parse(req.body);
      const psychologist = await getPsychologistOption(data.psychologistName);
      if (!psychologist || !psychologist.types.includes(data.consultationType)) {
        return res.status(400).json({ message: "Psikolog tidak sesuai dengan jenis konsultasi." });
      }

      const services = await storage.getBookingServices();
      const service = data.serviceId
        ? await storage.getBookingService(data.serviceId)
        : services.find((item) => item.isActive) || services[0];
      if (!service) {
        return res.status(404).json({ message: "Layanan booking belum tersedia." });
      }

      if (!(await isPsychologistAvailable(data.psychologistName, data.preferredDate, data.preferredTime, data.location))) {
        return res.status(400).json({ message: "Psikolog tidak tersedia pada hari dan jam yang dipilih, atau jadwal bertabrakan dengan booking lain yang sudah dibayar." });
      }

      let user = await storage.getUserByEmail(data.email);
      let integrationStatus: "linked_existing_user" | "created_manual_user" = "linked_existing_user";

      if (!user) {
        user = await storage.createUser({
          id: AuthUtils.generateUserId(),
          email: data.email,
          firstName: data.clientName,
          lastName: "",
          whatsappNumber: AuthUtils.normalizeWhatsAppNumber(data.whatsappNumber),
          authProvider: "manual",
          role: "user",
          isActive: true,
          isEmailVerified: false,
        });
        integrationStatus = "created_manual_user";
      }

      const timestamp = Date.now();
      const manualPaymentId = `manual_counseling_${timestamp}`;
      const amount = getPsychologistFee(psychologist, data.consultationType);

      const paidAt = data.markAsPaid === false ? undefined : new Date();
      const created = await storage.createPsychologistBookingOrder(
        {
          userId: user.id,
          totalAmount: amount,
          status: data.markAsPaid === false ? "pending" : "completed",
          paymentStatus: data.markAsPaid === false ? "pending" : "paid",
          paymentId: manualPaymentId,
          paymentMethod: "manual_offline",
          paidAt,
          paidAmount: data.markAsPaid === false ? undefined : amount,
        },
        [{
          userId: user.id,
          serviceId: service.id,
          clientName: data.clientName,
          birthDate: data.birthDate,
          gender: data.gender,
          age: data.age,
          email: data.email,
          whatsappNumber: data.whatsappNumber,
          mainConcern: data.mainConcern,
          concernHistory: data.concernHistory,
          consultationType: data.consultationType,
          childName: data.childName,
          childBirthDate: data.childBirthDate,
          previousDiagnosis: data.previousDiagnosis,
          preferredDate: data.preferredDate,
          preferredTime: normalizeTimeSlot(data.preferredTime),
          psychologistName: data.psychologistName,
          psychologistFee: amount,
          location: data.location,
          status: data.markAsPaid === false ? "pending_payment" : "paid",
          paidAt,
        }],
      );

      const bookingWithDetails = await storage.getPsychologistBooking(created.bookings[0].id);
      return res.status(201).json({
        booking: bookingWithDetails,
        integrationStatus,
        message: integrationStatus === "linked_existing_user"
          ? "Booking manual terhubung dengan akun klien yang sudah terdaftar."
          : "Booking manual dibuat dengan akun klien manual. Klien dapat diintegrasikan saat mendaftar dengan email yang sama.",
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data booking manual tidak valid", errors: error.flatten() });
      }
      if (error instanceof Error && error.message === "BOOKING_SLOT_UNAVAILABLE") {
        return res.status(409).json({ message: "Jadwal baru saja dipilih oleh booking lain. Silakan pilih jadwal yang berbeda." });
      }
      console.error("Error creating manual counseling booking:", error);
      return res.status(500).json({ message: "Failed to create manual counseling booking" });
    }
  });

  // Order routes
  app.post('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { assessmentIds } = req.body;

      if (!assessmentIds || !Array.isArray(assessmentIds) || assessmentIds.length === 0) {
        return res.status(400).json({ message: "Assessment IDs are required" });
      }

      // Calculate total amount
      let totalAmount = 0;
      const assessments = [];
      
      for (const assessmentId of assessmentIds) {
        const assessment = await storage.getAssessment(assessmentId);
        if (!assessment) {
          return res.status(404).json({ message: `Assessment ${assessmentId} not found` });
        }
        assessments.push(assessment);
        totalAmount += parseFloat(assessment.price);
      }

      // Create order
      const order = await storage.createOrder({
        userId,
        totalAmount: totalAmount.toString(),
        status: 'pending',
      });

      // Create order items
      for (const assessment of assessments) {
        await storage.createOrderItem({
          orderId: order.id,
          assessmentId: assessment.id,
          price: assessment.price,
        });
      }

      await recordWebsiteCheckout(order.id, 'assessment');
      const orderWithItems = await storage.getOrder(order.id);
      res.json(orderWithItems);
    } catch (error) {
      console.error("Error creating order:", error);
      res.status(500).json({ message: "Failed to create order" });
    }
  });

  app.get('/api/orders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orders = await storage.getUserOrders(userId);
      const normalizedOrders = await Promise.all(orders.map((order) => expireOrderIfNeeded(order)));
      res.json(normalizedOrders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      let order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order
      if (order.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      order = await expireOrderIfNeeded(order);
      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Payment routes - Enhanced with proper Midtrans integration
  app.post('/api/payments/create', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, paymentMethod } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      let order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      order = await expireOrderIfNeeded(order);

      if (order.status === 'completed' || order.paymentStatus === 'paid') {
        return res.status(400).json({ message: "Order is already paid" });
      }

      if (order.status === 'cancelled' || order.paymentStatus === 'expired' || order.paymentStatus === 'cancelled' || order.paymentStatus === 'failed') {
        return res.status(400).json({ message: "Pesanan sudah dibatalkan atau kadaluwarsa. Silakan isi booking ulang." });
      }

      console.log(`🔄 Creating Midtrans payment for order ${orderId}`);

      // Get user details for customer info
      const user = await storage.getUser(order.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create Midtrans transaction ID with timestamp
      const timestamp = Date.now();
      const midtransOrderId = `order_${orderId}_${timestamp}`;
      
      // Prepare Midtrans transaction data
      const bookings = order.orderItems.length === 0
        ? await storage.getPsychologistBookingsByOrder(order.id)
        : [];
      const booking = bookings[0];

      const digitalItemsResult = order.orderItems.length === 0 && !booking
        ? await pool.query(
            `SELECT product_id, product_name, price FROM digital_order_items WHERE order_id = $1 ORDER BY id`,
            [order.id],
          )
        : { rows: [] as any[] };
      const digitalCustomerResult = digitalItemsResult.rows.length
        ? await pool.query(`SELECT full_name, email, phone FROM digital_order_customer_info WHERE order_id = $1`, [order.id])
        : { rows: [] as any[] };
      const digitalCustomer = digitalCustomerResult.rows[0];

      const physicalItemsResult = order.orderItems.length === 0 && !booking && digitalItemsResult.rows.length === 0
        ? await pool.query(
            `SELECT product_id, product_name, sku, unit_price, quantity
             FROM physical_order_items WHERE order_id = $1 ORDER BY id`,
            [order.id],
          )
        : { rows: [] as any[] };
      const physicalCustomerResult = physicalItemsResult.rows.length
        ? await pool.query(
            `SELECT recipient_name, email, phone, shipping_fee
             FROM physical_order_shipping WHERE order_id = $1`,
            [order.id],
          )
        : { rows: [] as any[] };
      const physicalCustomer = physicalCustomerResult.rows[0];

      const trainingResult = order.orderItems.length === 0 && !booking && digitalItemsResult.rows.length === 0 && physicalItemsResult.rows.length === 0
        ? await pool.query(
            `SELECT registration.training_title, registration.option_name, registration.price,
                    registration.full_name, registration.email, registration.whatsapp_number
             FROM training_registrations registration WHERE registration.order_id = $1 LIMIT 1`,
            [order.id],
          )
        : { rows: [] as any[] };
      const trainingRegistration = trainingResult.rows[0];

      const itemDetails = order.orderItems.length > 0 ? order.orderItems.map(item => ({
        id: `assessment_${item.assessmentId}`,
        name: item.assessment.name,
        price: parseInt(item.price),
        quantity: 1
      })) : booking ? [{
        id: `booking_service_${booking.serviceId}`,
        name: `${booking.service.name}${bookings.length > 1 ? ` (${bookings.length} sesi)` : ""}`,
        price: parseInt(booking.psychologistFee || booking.service.price),
        quantity: bookings.length,
      }] : digitalItemsResult.rows.length ? digitalItemsResult.rows.map((item: any) => ({
        id: `digital_product_${item.product_id}`,
        name: item.product_name,
        price: parseInt(item.price),
        quantity: 1,
      })) : physicalItemsResult.rows.length ? [
        ...physicalItemsResult.rows.map((item: any) => ({
          id: `physical_product_${item.product_id}`,
          name: item.product_name,
          price: parseInt(item.unit_price),
          quantity: parseInt(item.quantity),
        })),
        ...(parseInt(physicalCustomer?.shipping_fee || "0") > 0 ? [{
          id: `physical_shipping_${order.id}`,
          name: "Biaya pengiriman",
          price: parseInt(physicalCustomer.shipping_fee),
          quantity: 1,
        }] : []),
      ] : trainingRegistration ? [{
        id: `training_${order.id}`,
        name: `${trainingRegistration.training_title} - ${trainingRegistration.option_name}`,
        price: parseInt(trainingRegistration.price),
        quantity: 1,
      }] : [];

      if (itemDetails.length === 0) {
        return res.status(400).json({ message: "Order has no payable items" });
      }

      const transactionData = {
        orderId: midtransOrderId,
        amount: parseInt(order.totalAmount),
        expiryMinutes: PAYMENT_EXPIRY_MINUTES,
        customerDetails: {
          first_name: physicalCustomer?.recipient_name || digitalCustomer?.full_name || trainingRegistration?.full_name || user.firstName || 'Customer',
          last_name: physicalCustomer || digitalCustomer || trainingRegistration ? '' : (user.lastName || ''),
          email: physicalCustomer?.email || digitalCustomer?.email || trainingRegistration?.email || user.email,
          phone: physicalCustomer?.phone || digitalCustomer?.phone || trainingRegistration?.whatsapp_number || user.whatsappNumber || ''
        },
        itemDetails
      };

      console.log(`💳 Creating Midtrans transaction:`, transactionData);

      // Create Midtrans transaction
      const midtransResult = await createMidtransTransaction(transactionData);
      
      // Update order with Midtrans payment ID immediately
      await storage.updateOrderStatus(orderId, 'pending', midtransOrderId, 'pending');

      const waReminderPlaceholder = createWaNotificationPlaceholder("order_payment_reminder", {
        orderId,
        clientName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
        clientWhatsapp: user.whatsappNumber || '',
        paymentId: midtransOrderId,
        trigger: "after_midtrans_payment_deadline_if_unpaid",
      });
      
      console.log(`✅ Midtrans transaction created successfully:`, {
        token: midtransResult.token?.substring(0, 20) + '...',
        redirect_url: midtransResult.redirect_url,
        orderId: midtransOrderId
      });

      res.json({
        token: midtransResult.token,
        redirect_url: midtransResult.redirect_url,
        paymentId: midtransOrderId,
        status: 'pending',
        amount: order.totalAmount,
        orderId: orderId,
        waReminderPlaceholder,
      });
    } catch (error) {
      console.error("❌ Error creating Midtrans payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Direct access for free assessments or admin bypass (no payment required)
  app.post('/api/assessments/:assessmentId/direct-access', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const assessmentId = parseInt(req.params.assessmentId);
      const isAdmin = req.user.role === 'admin';
      const isInternal = req.user.role === 'internal';
      
      // Verify assessment exists
      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Asesmen tidak ditemukan" });
      }
      
      const isFree = parseFloat(assessment.price) === 0;
      
      // Allow access if: assessment is free OR user is admin OR user is internal
      if (!isFree && !isAdmin && !isInternal) {
        return res.status(400).json({ message: "Asesmen ini tidak gratis dan memerlukan pembayaran" });
      }
      
      // Check if user already has this assessment
      const existingUserAssessment = await storage.getUserAssessment(userId, assessmentId);
      if (existingUserAssessment) {
        return res.status(200).json({ 
          message: "Asesmen sudah tersedia",
          userAssessmentId: existingUserAssessment.id
        });
      }
      
      // Create order (free or admin bypass)
      const order = await storage.createOrder({
        userId,
        totalAmount: isFree ? '0.00' : assessment.price,
        status: 'completed'
      });
      
      // Create order item
      await storage.createOrderItem({
        orderId: order.id,
        assessmentId,
        price: isFree ? '0.00' : assessment.price
      });
      
      // Create user assessment
      const userAssessmentData = {
        userId,
        assessmentId,
        orderId: order.id,
        status: 'purchased' as const
      };
      
      const accessType = (isAdmin || isInternal) && !isFree 
        ? (isAdmin ? 'admin access' : 'internal access')
        : 'free access';
      console.log(`🎁 Creating ${accessType} for user ${userId}, assessment ${assessmentId}`);
      const userAssessmentId = await storage.createUserAssessment(userAssessmentData);
      
      res.json({ 
        message: (isAdmin || isInternal) && !isFree 
          ? (isAdmin ? "Akses admin berhasil dibuat" : "Akses internal berhasil dibuat")
          : "Akses gratis berhasil dibuat",
        userAssessmentId,
        isAdminAccess: isAdmin && !isFree,
        isInternalAccess: isInternal && !isFree
      });
      
    } catch (error) {
      console.error("Error creating direct access:", error);
      res.status(500).json({ message: "Gagal membuat akses" });
    }
  });

  // User assessment routes
  app.get('/api/user-assessments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      console.log(`Fetching user assessments for user: ${userId}`);
      const userAssessments = await storage.getUserAssessments(userId);
      console.log(`Found ${userAssessments.length} user assessments:`, userAssessments);
      res.json(userAssessments);
    } catch (error) {
      console.error("Error fetching user assessments:", error);
      res.status(500).json({ message: "Failed to fetch user assessments" });
    }
  });

  // Get user assessment by assessment ID (for starting assessment from dashboard)
  app.get('/api/user-assessments/:assessmentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const assessmentId = parseInt(req.params.assessmentId);
      
      const userAssessment = await storage.getUserAssessment(userId, assessmentId);
      if (!userAssessment) {
        return res.status(404).json({ message: "Assessment not found or not purchased" });
      }

      res.json(userAssessment);
    } catch (error) {
      console.error("Error fetching user assessment:", error);
      res.status(500).json({ message: "Failed to fetch user assessment" });
    }
  });

  // Get user assessment by user assessment ID (for continuing assessment)
  app.get('/api/user-assessments/by-id/:userAssessmentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessmentId = parseInt(req.params.userAssessmentId);
      
      const userAssessments = await storage.getUserAssessments(userId);
      const userAssessment = userAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment) {
        return res.status(404).json({ message: "Assessment not found or access denied" });
      }

      res.json(userAssessment);
    } catch (error) {
      console.error("Error fetching user assessment:", error);
      res.status(500).json({ message: "Failed to fetch user assessment" });
    }
  });

  app.get('/api/user-assessments/result/:userAssessmentId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessmentId = parseInt(req.params.userAssessmentId);
      
      const userAssessments = await storage.getUserAssessments(userId);
      const userAssessment = userAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment) {
        return res.status(404).json({ message: "Assessment result not found or access denied" });
      }

      res.json(userAssessment);
    } catch (error) {
      console.error("Error fetching user assessment result:", error);
      res.status(500).json({ message: "Failed to fetch assessment result" });
    }
  });

  app.post('/api/user-assessments/:id/start', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      await storage.updateUserAssessmentStatus(id, 'in_progress');
      res.json({ message: 'Assessment started' });
    } catch (error) {
      console.error("Error starting assessment:", error);
      res.status(500).json({ message: "Failed to start assessment" });
    }
  });

  // Save assessment progress
  app.post('/api/user-assessments/:id/save-progress', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessmentId = parseInt(req.params.id);
      const { responses, participantInfo, currentPage, currentStep, notApplicable, comments } = req.body;

      // Verify ownership
      const userAssessments = await storage.getUserAssessments(userId);
      const userAssessment = userAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment) {
        return res.status(404).json({ message: "Assessment not found or access denied" });
      }

      // Merge with existing results to preserve all data
      const existingResults = (userAssessment.results as any) || {};
      const progressData = {
        ...existingResults,
        responses: responses || existingResults.responses || {},
        participantInfo: participantInfo || existingResults.participantInfo || {},
        currentPage: currentPage !== undefined ? currentPage : existingResults.currentPage || 0,
        notApplicable: notApplicable || existingResults.notApplicable || {},
        comments: comments || existingResults.comments || {},
        lastSaved: new Date().toISOString()
      };

      await storage.updateUserAssessmentStatus(userAssessmentId, 'in_progress', progressData);

      res.json({ message: "Progress saved successfully" });
    } catch (error) {
      console.error("Error saving assessment progress:", error);
      res.status(500).json({ message: "Failed to save progress" });
    }
  });

  app.post('/api/user-assessments/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessmentId = parseInt(req.params.id);
      
      // Handle different data formats from frontend
      let responses, participantInfo;
      if (req.body.results) {
        // Learning style assessment format: { results: { scores, dominantStyle, responses } }
        responses = req.body.results.responses;
        participantInfo = req.body.results.participantInfo || {};
      } else {
        // Sensory profile assessment format: { responses, participantInfo }
        responses = req.body.responses;
        participantInfo = req.body.participantInfo;
      }
      

      
      // Verify ownership
      const userAssessments = await storage.getUserAssessments(userId);
      const userAssessment = userAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment) {
        return res.status(404).json({ message: "Assessment not found or access denied" });
      }

      // Calculate results based on assessment type
      let processedResults;
      
      if (userAssessment.assessment.type === 'sensory') {
        // Calculate sensory profile results
        processedResults = calculateSensoryProfileResults(responses, participantInfo);
      } else if (userAssessment.assessment.type === 'learning') {
        // Calculate learning style results
        processedResults = calculateLearningStyleResults(responses, participantInfo);
      } else if (userAssessment.assessment.type === 'intelligence') {
        // Calculate multiple intelligence results
        processedResults = calculateMultipleIntelligenceResults(responses, participantInfo);
      } else if (userAssessment.assessment.type === 'mental-health') {
        processedResults = calculateMentalHealthCheckupResults(responses, participantInfo);
      } else if (userAssessment.assessment.type === 'student-potential') {
        processedResults = calculateStudentPotentialResults(responses, participantInfo);
      } else if (userAssessment.assessment.type === 'career-potential') {
        processedResults = calculateCareerPotentialResults(responses, participantInfo);
      } else {
        // Default results structure
        processedResults = {
          responses,
          participantInfo,
          totalScore: 0,
          completedAt: new Date().toISOString()
        };
      }

      await storage.updateUserAssessmentStatus(userAssessmentId, 'completed', processedResults);
      res.json({ message: 'Assessment completed' });
    } catch (error) {
      console.error("Error completing assessment:", error);
      res.status(500).json({ message: "Failed to complete assessment" });
    }
  });

  // PDF download endpoint
  app.get('/api/user-assessments/:id/pdf', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessmentId = parseInt(req.params.id);

      // Verify ownership
      const userAssessments = await storage.getUserAssessments(userId);
      const userAssessment = userAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment || userAssessment.status !== 'completed') {
        return res.status(404).json({ message: "Assessment not found or not completed" });
      }

      // Generate PDF content
      const pdfBuffer = await generatePdfContent(userAssessment);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Hasil_${userAssessment.assessment.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Share results endpoint
  app.post('/api/user-assessments/:id/share', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessmentId = parseInt(req.params.id);

      // Verify ownership
      const userAssessments = await storage.getUserAssessments(userId);
      const userAssessment = userAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment || userAssessment.status !== 'completed') {
        return res.status(404).json({ message: "Assessment not found or not completed" });
      }

      // Generate a unique share token
      const shareToken = randomBytes(32).toString('hex');
      
      // Store the share token (in a real app, you'd save this to database)
      // For now, we'll use the assessment ID as a simple share mechanism
      
      res.json({ 
        shareToken: `${userAssessmentId}-${shareToken.substring(0, 8)}`,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 days
      });
    } catch (error) {
      console.error("Error creating share link:", error);
      res.status(500).json({ message: "Failed to create share link" });
    }
  });

  // Admin middleware
  registerInstagramRoutes(app, pool, isAuthenticated, isAdmin);

  function isAdmin(req: any, res: any, next: any) {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Access denied. Admin role required.' });
    }
    next();
  }

  function canManageExternalAssessments(req: any, res: any, next: any) {
    if (!req.user || !canManageExternalAssessmentsRole(req.user.role)) {
      return res.status(403).json({ message: 'Akses hanya untuk Admin atau CSO.' });
    }
    next();
  }

  function canManageDigitalProducts(req: any, res: any, next: any) {
    if (!req.user || !canManageDigitalProductsRole(req.user.role)) {
      return res.status(403).json({ message: 'Akses hanya untuk Admin.' });
    }
    next();
  }

  function canManageTrainings(req: any, res: any, next: any) {
    if (!req.user || !canManageTrainingsRole(req.user.role)) {
      return res.status(403).json({ message: 'Akses hanya untuk Admin.' });
    }
    next();
  }

  const analyticsHashSecret = process.env.ANALYTICS_HASH_SECRET || process.env.SESSION_SECRET || randomBytes(32).toString('hex');
  const analyticsRateLimits = new Map<string, { startedAt: number; count: number }>();
  app.post('/api/analytics/events', async (req: any, res) => {
    const origin = String(req.headers.origin || '');
    if (origin) {
      try {
        const hostname = new URL(origin).hostname.toLowerCase();
        if (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== 'pi-psychology.com' && hostname !== 'www.pi-psychology.com' && hostname !== 'asesmen.pi-psychology.com') {
          return res.status(403).json({ message: 'Origin tidak diizinkan' });
        }
      } catch { return res.status(403).json({ message: 'Origin tidak valid' }); }
    }
    const parsed = websiteAnalyticsEventSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Event analytics tidak valid' });
    const data = parsed.data;
    const pagePath = data.pagePath.split('?')[0].split('#')[0].replace(/\/{2,}/g, '/');
    const privatePath = /^\/(admin|cso|dashboard|psychologist|results|assessment\/|sensory-profile|learning-style|multiple-intelligence|mental-health-checkup|student-potential-test|career-potential-test|dass-screening|srq-screening|payment-)/;
    const checkoutPath = /^\/(cart|checkout|digital-products\/checkout|physical-products\/checkout|training\/register)$/;
    if (privatePath.test(pagePath) || (checkoutPath.test(pagePath) && data.eventType !== 'checkout_start')) return res.status(204).end();
    const month = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit' }).format(new Date());
    const forwardedIp = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || req.ip || '').split(',')[0].trim();
    const visitorHash = createHmac('sha256', analyticsHashSecret).update(`${month}|${forwardedIp}|${String(req.headers['user-agent'] || '').slice(0, 300)}`).digest('hex');
    const now = Date.now(); const rate = analyticsRateLimits.get(visitorHash);
    if (!rate || now - rate.startedAt > 60_000) analyticsRateLimits.set(visitorHash, { startedAt: now, count: 1 });
    else if (rate.count >= 120) return res.status(429).json({ message: 'Terlalu banyak event' });
    else rate.count += 1;
    if (analyticsRateLimits.size > 10_000) for (const [key, value] of analyticsRateLimits) if (now - value.startedAt > 120_000) analyticsRateLimits.delete(key);
    try {
      await pool.query(
        `INSERT INTO website_analytics_events
          (visitor_hash,session_id,event_type,page_path,content_type,content_slug,cta_type,source,medium,campaign,referrer_host,device_type)
         VALUES ($1,$2,$3,$4,NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),NULLIF($8,''),NULLIF($9,''),NULLIF($10,''),NULLIF($11,''),$12)`,
        [visitorHash,data.sessionId,data.eventType,pagePath,data.contentType || '',data.contentSlug || '',data.ctaType || '',data.source || '',data.medium || '',data.campaign || '',data.referrerHost || '',data.deviceType],
      );
      return res.status(204).end();
    } catch (error) { console.error('Error recording website analytics:', error); return res.status(500).json({ message: 'Gagal mencatat analytics' }); }
  });

  app.get('/api/admin/website-analytics', isAuthenticated, isAdmin, async (req, res) => {
    const requestedDays = Number(req.query.days); const days = [7,30,90].includes(requestedDays) ? requestedDays : 30;
    const baseParams = [days];
    const analyticsWindow = (column: string) => `${column} >= (((now() AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1))::timestamp AT TIME ZONE 'Asia/Jakarta')
      AND ${column} < (((now() AT TIME ZONE 'Asia/Jakarta')::date + 1)::timestamp AT TIME ZONE 'Asia/Jakarta')`;
    try {
      const [summary,daily,topContent,topPages,sources,devices,paid,checkoutCohort] = await Promise.all([
        pool.query(`SELECT COUNT(*) FILTER (WHERE event_type='page_view')::int AS "pageViews",COUNT(DISTINCT visitor_hash)::int AS "uniqueVisitors",COUNT(DISTINCT session_id)::int AS sessions,COUNT(*) FILTER (WHERE event_type='content_view')::int AS "contentViews",COUNT(*) FILTER (WHERE event_type='cta_click')::int AS "ctaClicks",COUNT(*) FILTER (WHERE event_type='checkout_start')::int AS "checkoutPageViews",COUNT(DISTINCT visitor_hash) FILTER (WHERE event_type='checkout_start')::int AS "checkoutVisitors" FROM website_analytics_events WHERE ${analyticsWindow('occurred_at')}`,baseParams),
        pool.query(`WITH bounds AS (
          SELECT (now() AT TIME ZONE 'Asia/Jakarta')::date - ($1::int - 1) AS start_date,
                 (now() AT TIME ZONE 'Asia/Jakarta')::date AS end_date
        ), dates AS (
          SELECT generate_series(start_date,end_date,interval '1 day')::date AS day FROM bounds
        ), totals AS (
          SELECT (event.occurred_at AT TIME ZONE 'Asia/Jakarta')::date AS day,
                 COUNT(*) FILTER (WHERE event.event_type='page_view')::int AS "pageViews",
                 COUNT(DISTINCT event.visitor_hash)::int AS visitors,
                 COUNT(*) FILTER (WHERE event.event_type='cta_click')::int AS "ctaClicks"
          FROM website_analytics_events event WHERE ${analyticsWindow('event.occurred_at')} GROUP BY 1
        ) SELECT to_char(dates.day,'YYYY-MM-DD') AS day,COALESCE(totals."pageViews",0)::int AS "pageViews",
                 COALESCE(totals.visitors,0)::int AS visitors,COALESCE(totals."ctaClicks",0)::int AS "ctaClicks"
          FROM dates LEFT JOIN totals USING(day) ORDER BY dates.day`,baseParams),
        pool.query(`SELECT content_type AS "contentType",content_slug AS "contentSlug",COUNT(*)::int AS views,COUNT(DISTINCT visitor_hash)::int AS visitors FROM website_analytics_events WHERE ${analyticsWindow('occurred_at')} AND event_type='content_view' AND content_slug IS NOT NULL GROUP BY 1,2 ORDER BY views DESC LIMIT 12`,baseParams),
        pool.query(`SELECT page_path AS path,COUNT(*)::int AS views,COUNT(DISTINCT visitor_hash)::int AS visitors FROM website_analytics_events WHERE ${analyticsWindow('occurred_at')} AND event_type='page_view' GROUP BY 1 ORDER BY views DESC LIMIT 12`,baseParams),
        pool.query(`SELECT COALESCE(source,'direct') AS source,COUNT(DISTINCT session_id)::int AS sessions FROM website_analytics_events WHERE ${analyticsWindow('occurred_at')} AND event_type='page_view' GROUP BY 1 ORDER BY sessions DESC LIMIT 10`,baseParams),
        pool.query(`SELECT device_type AS device,COUNT(DISTINCT session_id)::int AS sessions FROM website_analytics_events WHERE ${analyticsWindow('occurred_at')} GROUP BY 1 ORDER BY sessions DESC`,baseParams),
        pool.query(`SELECT COUNT(*)::int AS orders,COALESCE(SUM(order_data.total_amount),0) AS revenue FROM orders order_data JOIN website_checkout_attempts attempt ON attempt.order_id=order_data.id WHERE order_data.payment_status='paid' AND order_data.paid_at IS NOT NULL AND ${analyticsWindow('order_data.paid_at')}`,baseParams),
        pool.query(`SELECT COUNT(*)::int AS "checkoutStarts",COUNT(*) FILTER (WHERE order_data.payment_status='paid')::int AS "convertedOrders" FROM website_checkout_attempts attempt JOIN orders order_data ON order_data.id=attempt.order_id WHERE ${analyticsWindow('attempt.created_at')}`,baseParams),
      ]);
      const stats = summary.rows[0] || {}; const paidStats = paid.rows[0] || { orders:0,revenue:0 };
      const checkoutStats = checkoutCohort.rows[0] || { checkoutStarts:0,convertedOrders:0 };
      return res.json({ days,startDate:daily.rows[0]?.day,endDate:daily.rows[daily.rows.length-1]?.day,timezone:'Asia/Jakarta',summary:{...stats,...checkoutStats,paidOrders:paidStats.orders,revenue:paidStats.revenue,conversionRate:Number(checkoutStats.checkoutStarts)>0?Math.round((Number(checkoutStats.convertedOrders)/Number(checkoutStats.checkoutStarts))*1000)/10:0}, daily:daily.rows,topContent:topContent.rows,topPages:topPages.rows,sources:sources.rows,devices:devices.rows,privacy:{rawRetentionDays:90,visitorRotation:'monthly'} });
    } catch (error) { console.error('Error loading website analytics:',error); return res.status(500).json({message:'Gagal memuat analytics website'}); }
  });

  const hospitalityServiceSelect = `
    SELECT service.id, service.slug, service.title, service.summary, service.description,
           COALESCE(service.gallery_description, '') AS "galleryDescription",
           service.sort_order AS "sortOrder", service.is_active AS "isActive",
           service.image_data IS NOT NULL AS "hasImage",
           service.image_file_name AS "imageFileName",
           service.image_focus_x AS "imageFocusX", service.image_focus_y AS "imageFocusY",
           service.created_at AS "createdAt", service.updated_at AS "updatedAt"
      FROM hospitality_services service`;
  const hospitalityOfferingSelect = `
    SELECT offering.id, offering.service_id AS "serviceId", offering.slug, offering.title,
           offering.description, offering.capacity, offering.area, offering.facilities,
           offering.duration, offering.price_options AS "priceOptions",
           offering.sort_order AS "sortOrder", offering.is_active AS "isActive",
           offering.image_data IS NOT NULL AS "hasImage",
           offering.image_file_name AS "imageFileName",
           offering.image_focus_x AS "imageFocusX", offering.image_focus_y AS "imageFocusY",
           offering.created_at AS "createdAt", offering.updated_at AS "updatedAt"
      FROM hospitality_offerings offering`;

  async function getHospitalityCatalog(includeInactive: boolean) {
    const settings = await pool.query(
      `SELECT intro, about_text AS "aboutText", why_items AS "whyItems", philosophy,
              updated_at AS "updatedAt" FROM hospitality_page_settings WHERE id = 1`,
    );
    const serviceWhere = includeInactive
      ? `WHERE service.deleted_at IS NULL`
      : `WHERE service.deleted_at IS NULL AND service.is_active = true`;
    const offeringWhere = includeInactive
      ? `WHERE offering.deleted_at IS NULL`
      : `WHERE offering.deleted_at IS NULL AND offering.is_active = true`;
    const imageWhere = includeInactive ? `` : `WHERE is_active = true`;
    const [services, offerings, offeringImages, serviceGalleryImages] = await Promise.all([
      pool.query(`${hospitalityServiceSelect} ${serviceWhere} ORDER BY service.sort_order, service.id`),
      pool.query(`${hospitalityOfferingSelect} ${offeringWhere} ORDER BY offering.sort_order, offering.id`),
      pool.query(`SELECT id,offering_id AS "offeringId",file_name AS "fileName",sort_order AS "sortOrder",
                         focus_x AS "focusX",focus_y AS "focusY",is_active AS "isActive"
                    FROM hospitality_offering_images ${imageWhere} ORDER BY sort_order,id`),
      pool.query(`SELECT id,service_id AS "serviceId",file_name AS "fileName",sort_order AS "sortOrder",
                         focus_x AS "focusX",focus_y AS "focusY",is_active AS "isActive",
                         updated_at AS "updatedAt"
                    FROM hospitality_service_gallery_images ${imageWhere} ORDER BY sort_order,id`),
    ]);
    const byService = new Map<number, any[]>();
    offerings.rows.forEach((offering: any) => {
      const list = byService.get(offering.serviceId) || [];
      const images = offeringImages.rows.filter((image: any) => image.offeringId === offering.id);
      list.push({ ...offering, hasImage: images.length > 0, images });
      byService.set(offering.serviceId, list);
    });
    return {
      settings: settings.rows[0],
      services: services.rows.map((service: any) => ({
        ...service,
        offerings: byService.get(service.id) || [],
        galleryImages: serviceGalleryImages.rows.filter((image: any) => image.serviceId === service.id),
      })),
    };
  }

  app.get('/api/hospitality', async (_req, res) => {
    try {
      return res.json(await getHospitalityCatalog(false));
    } catch (error) {
      console.error('Error fetching hospitality catalog:', error);
      return res.status(500).json({ message: 'Gagal memuat layanan Hospitality Services' });
    }
  });

  app.get('/api/hospitality/services/:serviceId/image', async (req, res) => {
    const result = await pool.query(
      `SELECT image_data, image_mime_type FROM hospitality_services
       WHERE id = $1 AND deleted_at IS NULL AND image_data IS NOT NULL`,
      [Number(req.params.serviceId)],
    );
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Content-Type', result.rows[0].image_mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(result.rows[0].image_data);
  });

  app.get('/api/hospitality/offerings/:offeringId/image', async (req, res) => {
    const result = await pool.query(
      `SELECT image_data, image_mime_type FROM hospitality_offerings
       WHERE id = $1 AND deleted_at IS NULL AND image_data IS NOT NULL`,
      [Number(req.params.offeringId)],
    );
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Content-Type', result.rows[0].image_mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(result.rows[0].image_data);
  });

  app.get('/api/hospitality/gallery', async (_req, res) => {
    const result = await pool.query(
      `SELECT id, file_name AS "fileName", title, caption, sort_order AS "sortOrder",
              focus_x AS "focusX", focus_y AS "focusY"
         FROM hospitality_gallery_images WHERE is_active = true ORDER BY sort_order, id`,
    );
    return res.json(result.rows);
  });

  app.get('/api/hospitality/gallery/images/:imageId', async (req, res) => {
    const result = await pool.query(
      `SELECT image_data, mime_type FROM hospitality_gallery_images WHERE id = $1`,
      [Number(req.params.imageId)],
    );
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Content-Type', result.rows[0].mime_type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(result.rows[0].image_data);
  });

  app.get('/api/admin/hospitality', isAuthenticated, isAdmin, async (_req, res) => {
    return res.json(await getHospitalityCatalog(true));
  });

  app.put('/api/admin/hospitality/settings', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = hospitalityPageSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data halaman tidak valid', errors: parsed.error.flatten() });
    const data = parsed.data;
    await pool.query(
      `UPDATE hospitality_page_settings SET intro=$1,about_text=$2,why_items=$3::jsonb,
         philosophy=$4,updated_by=$5,updated_at=now() WHERE id=1`,
      [data.intro, data.aboutText, JSON.stringify(data.whyItems), data.philosophy, req.user.claims.sub],
    );
    return res.json({ message: 'Informasi Hospitality Services diperbarui' });
  });

  app.post('/api/admin/hospitality/services', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = hospitalityServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data layanan tidak valid', errors: parsed.error.flatten() });
    const data = parsed.data;
    const slug = makeDigitalProductSlug(data.slug || data.title);
    if (!slug) return res.status(400).json({ message: 'Slug layanan tidak valid' });
    try {
      const result = await pool.query(
        `INSERT INTO hospitality_services (slug,title,summary,description,sort_order,is_active,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id,slug`,
        [slug, data.title, data.summary, data.description, data.sortOrder, data.isActive, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug layanan sudah digunakan' });
      return res.status(500).json({ message: 'Gagal menambahkan layanan' });
    }
  });

  app.put('/api/admin/hospitality/services/:serviceId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = hospitalityServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data layanan tidak valid', errors: parsed.error.flatten() });
    const data = parsed.data;
    const slug = makeDigitalProductSlug(data.slug || data.title);
    try {
      const result = await pool.query(
        `UPDATE hospitality_services SET slug=$1,title=$2,summary=$3,description=$4,
           sort_order=$5,is_active=$6,updated_at=now()
         WHERE id=$7 AND deleted_at IS NULL RETURNING id,slug`,
        [slug, data.title, data.summary, data.description, data.sortOrder, data.isActive, Number(req.params.serviceId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug layanan sudah digunakan' });
      return res.status(500).json({ message: 'Gagal memperbarui layanan' });
    }
  });

  app.delete('/api/admin/hospitality/services/:serviceId', isAuthenticated, isAdmin, async (req, res) => {
    const result = await pool.query(
      `UPDATE hospitality_services SET deleted_at=now(),is_active=false,updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
      [Number(req.params.serviceId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
    return res.json({ message: 'Layanan dihapus dari katalog' });
  });

  app.put('/api/admin/hospitality/services/:serviceId/image', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto layanan wajib dipilih' });
      const result = await pool.query(
        `UPDATE hospitality_services SET image_data=$1,image_file_name=$2,image_mime_type=$3,updated_at=now()
         WHERE id=$4 AND deleted_at IS NULL RETURNING id`,
        [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'foto-layanan')), req.headers['content-type'], Number(req.params.serviceId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
      return res.json({ message: 'Foto layanan disimpan' });
    });

  app.put('/api/admin/hospitality/services/:serviceId/image/focus', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = digitalProductImageFocusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid' });
    const result = await pool.query(
      `UPDATE hospitality_services SET image_focus_x=$1,image_focus_y=$2,updated_at=now()
       WHERE id=$3 AND deleted_at IS NULL RETURNING id`,
      [parsed.data.focusX, parsed.data.focusY, Number(req.params.serviceId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.post('/api/admin/hospitality/services/:serviceId/offerings', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = hospitalityOfferingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pilihan layanan tidak valid', errors: parsed.error.flatten() });
    const data = parsed.data;
    const slug = makeDigitalProductSlug(data.slug || data.title);
    try {
      const result = await pool.query(
        `INSERT INTO hospitality_offerings
          (service_id,slug,title,description,capacity,area,facilities,duration,price_options,sort_order,is_active,created_by)
         SELECT id,$1,$2,$3,NULLIF($4,''),NULLIF($5,''),NULLIF($6,''),NULLIF($7,''),$8::jsonb,$9,$10,$11
           FROM hospitality_services WHERE id=$12 AND deleted_at IS NULL RETURNING id,slug`,
        [slug, data.title, data.description, data.capacity, data.area, data.facilities, data.duration,
         JSON.stringify(data.priceOptions), data.sortOrder, data.isActive, req.user.claims.sub, Number(req.params.serviceId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Layanan induk tidak ditemukan' });
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug pilihan sudah digunakan pada layanan ini' });
      return res.status(500).json({ message: 'Gagal menambahkan pilihan layanan' });
    }
  });

  app.put('/api/admin/hospitality/services/:serviceId/offerings/:offeringId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = hospitalityOfferingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pilihan layanan tidak valid', errors: parsed.error.flatten() });
    const data = parsed.data;
    const slug = makeDigitalProductSlug(data.slug || data.title);
    try {
      const result = await pool.query(
        `UPDATE hospitality_offerings SET slug=$1,title=$2,description=$3,capacity=NULLIF($4,''),
           area=NULLIF($5,''),facilities=NULLIF($6,''),duration=NULLIF($7,''),price_options=$8::jsonb,
           sort_order=$9,is_active=$10,updated_at=now()
         WHERE id=$11 AND service_id=$12 AND deleted_at IS NULL RETURNING id,slug`,
        [slug, data.title, data.description, data.capacity, data.area, data.facilities, data.duration,
         JSON.stringify(data.priceOptions), data.sortOrder, data.isActive,
         Number(req.params.offeringId), Number(req.params.serviceId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pilihan layanan tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug pilihan sudah digunakan pada layanan ini' });
      return res.status(500).json({ message: 'Gagal memperbarui pilihan layanan' });
    }
  });

  app.delete('/api/admin/hospitality/services/:serviceId/offerings/:offeringId', isAuthenticated, isAdmin, async (req, res) => {
    const result = await pool.query(
      `UPDATE hospitality_offerings SET deleted_at=now(),is_active=false,updated_at=now()
       WHERE id=$1 AND service_id=$2 AND deleted_at IS NULL RETURNING id`,
      [Number(req.params.offeringId), Number(req.params.serviceId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pilihan layanan tidak ditemukan' });
    return res.json({ message: 'Pilihan layanan dihapus dari katalog' });
  });

  app.put('/api/admin/hospitality/services/:serviceId/offerings/:offeringId/image', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto pilihan wajib dipilih' });
      const result = await pool.query(
        `UPDATE hospitality_offerings SET image_data=$1,image_file_name=$2,image_mime_type=$3,updated_at=now()
         WHERE id=$4 AND service_id=$5 AND deleted_at IS NULL RETURNING id`,
        [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'foto-pilihan')), req.headers['content-type'],
         Number(req.params.offeringId), Number(req.params.serviceId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pilihan layanan tidak ditemukan' });
      return res.json({ message: 'Foto pilihan disimpan' });
    });

  app.put('/api/admin/hospitality/services/:serviceId/offerings/:offeringId/image/focus', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = digitalProductImageFocusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid' });
    const result = await pool.query(
      `UPDATE hospitality_offerings SET image_focus_x=$1,image_focus_y=$2,updated_at=now()
       WHERE id=$3 AND service_id=$4 AND deleted_at IS NULL RETURNING id`,
      [parsed.data.focusX, parsed.data.focusY, Number(req.params.offeringId), Number(req.params.serviceId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pilihan layanan tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.get('/api/hospitality/offering-images/:imageId', async (req, res) => {
    const result = await pool.query(
      `SELECT image_data,mime_type FROM hospitality_offering_images WHERE id=$1`,
      [Number(req.params.imageId)],
    );
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Content-Type', result.rows[0].mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(result.rows[0].image_data);
  });

  app.post('/api/admin/hospitality/services/:serviceId/offerings/:offeringId/images', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto paket wajib dipilih' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const offeringId = Number(req.params.offeringId);
        await client.query(`SELECT pg_advisory_xact_lock($1)`, [offeringId]);
        const offering = await client.query(`SELECT id FROM hospitality_offerings WHERE id=$1 AND service_id=$2 AND deleted_at IS NULL`, [offeringId, Number(req.params.serviceId)]);
        if (!offering.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Detail/Paket tidak ditemukan' }); }
        const count = await client.query(`SELECT COUNT(*)::int AS total FROM hospitality_offering_images WHERE offering_id=$1`, [offeringId]);
        if (Number(count.rows[0]?.total || 0) >= 6) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Setiap Detail/Paket maksimal memiliki 6 foto' }); }
        const next = await client.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS value FROM hospitality_offering_images WHERE offering_id=$1`, [offeringId]);
        const result = await client.query(
          `INSERT INTO hospitality_offering_images (offering_id,image_data,file_name,mime_type,sort_order,created_by)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [offeringId,req.body,decodeURIComponent(String(req.headers['x-file-name']||'foto-paket')),req.headers['content-type'],Number(next.rows[0].value),req.user.claims.sub],
        );
        await client.query('COMMIT'); return res.status(201).json(result.rows[0]);
      } catch (error) { await client.query('ROLLBACK').catch(()=>undefined); console.error('Error uploading hospitality offering image:',error); return res.status(500).json({ message:'Gagal mengunggah foto paket' }); }
      finally { client.release(); }
    });

  app.put('/api/admin/hospitality/services/:serviceId/offerings/:offeringId/images/:imageId', isAuthenticated, isAdmin, async (req,res) => {
    const parsed=courseGallerySchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({message:'Data foto tidak valid'});
    const result=await pool.query(
      `UPDATE hospitality_offering_images image SET sort_order=$1,focus_x=$2,focus_y=$3,is_active=$4,updated_at=now()
        FROM hospitality_offerings offering
       WHERE image.id=$5 AND image.offering_id=$6 AND offering.id=image.offering_id AND offering.service_id=$7 AND offering.deleted_at IS NULL RETURNING image.id`,
      [parsed.data.sortOrder,parsed.data.focusX,parsed.data.focusY,parsed.data.isActive,Number(req.params.imageId),Number(req.params.offeringId),Number(req.params.serviceId)],
    );
    if(!result.rowCount)return res.status(404).json({message:'Foto paket tidak ditemukan'}); return res.json(result.rows[0]);
  });

  app.put('/api/admin/hospitality/services/:serviceId/offerings/:offeringId/images/:imageId/file', isAuthenticated, isAdmin,
    express.raw({ type:['image/jpeg','image/png','image/webp'],limit:'8mb' }), async(req,res)=>{
      if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({message:'Foto paket wajib dipilih'});
      const result=await pool.query(
        `UPDATE hospitality_offering_images image SET image_data=$1,file_name=$2,mime_type=$3,updated_at=now()
          FROM hospitality_offerings offering
         WHERE image.id=$4 AND image.offering_id=$5 AND offering.id=image.offering_id AND offering.service_id=$6 AND offering.deleted_at IS NULL RETURNING image.id`,
        [req.body,decodeURIComponent(String(req.headers['x-file-name']||'foto-paket')),req.headers['content-type'],Number(req.params.imageId),Number(req.params.offeringId),Number(req.params.serviceId)],
      );
      if(!result.rowCount)return res.status(404).json({message:'Foto paket tidak ditemukan'});return res.json(result.rows[0]);
    });

  app.delete('/api/admin/hospitality/services/:serviceId/offerings/:offeringId/images/:imageId', isAuthenticated, isAdmin, async(req,res)=>{
    const result=await pool.query(
      `DELETE FROM hospitality_offering_images image USING hospitality_offerings offering
       WHERE image.id=$1 AND image.offering_id=$2 AND offering.id=image.offering_id AND offering.service_id=$3 AND offering.deleted_at IS NULL RETURNING image.id`,
      [Number(req.params.imageId),Number(req.params.offeringId),Number(req.params.serviceId)],
    );
    if(!result.rowCount)return res.status(404).json({message:'Foto paket tidak ditemukan'});return res.json({message:'Foto paket dihapus'});
  });

  app.get('/api/hospitality/service-gallery-images/:imageId', async (req, res) => {
    const result = await pool.query(
      `SELECT image_data,mime_type FROM hospitality_service_gallery_images WHERE id=$1`,
      [Number(req.params.imageId)],
    );
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Content-Type', result.rows[0].mime_type || 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    return res.send(result.rows[0].image_data);
  });

  app.put('/api/admin/hospitality/services/:serviceId/gallery-description', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = hospitalityServiceGalleryDescriptionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Deskripsi galeri tidak valid' });
    const result = await pool.query(
      `UPDATE hospitality_services SET gallery_description=NULLIF($1,''),updated_at=now()
       WHERE id=$2 AND deleted_at IS NULL RETURNING id`,
      [parsed.data.description, Number(req.params.serviceId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Layanan tidak ditemukan' });
    return res.json({ message: 'Deskripsi galeri disimpan' });
  });

  app.post('/api/admin/hospitality/services/:serviceId/gallery', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto galeri wajib dipilih' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const serviceId = Number(req.params.serviceId);
        await client.query(`SELECT pg_advisory_xact_lock($1,$2)`, [20260829, serviceId]);
        const service = await client.query(`SELECT id FROM hospitality_services WHERE id=$1 AND deleted_at IS NULL`, [serviceId]);
        if (!service.rowCount) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Layanan tidak ditemukan' }); }
        const count = await client.query(`SELECT COUNT(*)::int AS total FROM hospitality_service_gallery_images WHERE service_id=$1`, [serviceId]);
        if (Number(count.rows[0]?.total || 0) >= 5) { await client.query('ROLLBACK'); return res.status(409).json({ message: 'Galeri setiap layanan maksimal memiliki 5 foto' }); }
        const next = await client.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS value FROM hospitality_service_gallery_images WHERE service_id=$1`, [serviceId]);
        const result = await client.query(
          `INSERT INTO hospitality_service_gallery_images (service_id,image_data,file_name,mime_type,sort_order,created_by)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING id`,
          [serviceId,req.body,decodeURIComponent(String(req.headers['x-file-name']||'galeri-layanan')),req.headers['content-type'],Number(next.rows[0].value),req.user.claims.sub],
        );
        await client.query('COMMIT');
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK').catch(()=>undefined);
        console.error('Error uploading hospitality service gallery image:',error);
        return res.status(500).json({ message:'Gagal mengunggah foto galeri layanan' });
      } finally { client.release(); }
    });

  app.put('/api/admin/hospitality/services/:serviceId/gallery/:imageId', isAuthenticated, isAdmin, async (req,res) => {
    const parsed=courseGallerySchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({message:'Data foto tidak valid'});
    const result=await pool.query(
      `UPDATE hospitality_service_gallery_images SET sort_order=$1,focus_x=$2,focus_y=$3,is_active=$4,updated_at=now()
       WHERE id=$5 AND service_id=$6 RETURNING id`,
      [parsed.data.sortOrder,parsed.data.focusX,parsed.data.focusY,parsed.data.isActive,Number(req.params.imageId),Number(req.params.serviceId)],
    );
    if(!result.rowCount)return res.status(404).json({message:'Foto galeri layanan tidak ditemukan'});
    return res.json(result.rows[0]);
  });

  app.put('/api/admin/hospitality/services/:serviceId/gallery/:imageId/file', isAuthenticated, isAdmin,
    express.raw({ type:['image/jpeg','image/png','image/webp'],limit:'8mb' }), async(req,res)=>{
      if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({message:'Foto galeri wajib dipilih'});
      const result=await pool.query(
        `UPDATE hospitality_service_gallery_images SET image_data=$1,file_name=$2,mime_type=$3,updated_at=now()
         WHERE id=$4 AND service_id=$5 RETURNING id`,
        [req.body,decodeURIComponent(String(req.headers['x-file-name']||'galeri-layanan')),req.headers['content-type'],Number(req.params.imageId),Number(req.params.serviceId)],
      );
      if(!result.rowCount)return res.status(404).json({message:'Foto galeri layanan tidak ditemukan'});
      return res.json(result.rows[0]);
    });

  app.delete('/api/admin/hospitality/services/:serviceId/gallery/:imageId', isAuthenticated, isAdmin, async(req,res)=>{
    const result=await pool.query(
      `DELETE FROM hospitality_service_gallery_images WHERE id=$1 AND service_id=$2 RETURNING id`,
      [Number(req.params.imageId),Number(req.params.serviceId)],
    );
    if(!result.rowCount)return res.status(404).json({message:'Foto galeri layanan tidak ditemukan'});
    return res.json({message:'Foto galeri layanan dihapus'});
  });

  app.get('/api/admin/hospitality/gallery', isAuthenticated, isAdmin, async (_req, res) => {
    const result = await pool.query(
      `SELECT id,file_name AS "fileName",title,caption,sort_order AS "sortOrder",
              focus_x AS "focusX",focus_y AS "focusY",is_active AS "isActive"
         FROM hospitality_gallery_images ORDER BY sort_order,id`,
    );
    return res.json(result.rows);
  });

  app.post('/api/admin/hospitality/gallery', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto galeri wajib dipilih' });
      const next = await pool.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS value FROM hospitality_gallery_images`);
      const result = await pool.query(
        `INSERT INTO hospitality_gallery_images (image_data,file_name,mime_type,sort_order,created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'galeri-hospitality')), req.headers['content-type'],
         Number(next.rows[0].value), req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    });

  app.put('/api/admin/hospitality/gallery/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = hospitalityGallerySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data galeri tidak valid', errors: parsed.error.flatten() });
    const data = parsed.data;
    const result = await pool.query(
      `UPDATE hospitality_gallery_images SET title=NULLIF($1,''),caption=NULLIF($2,''),sort_order=$3,
         focus_x=$4,focus_y=$5,is_active=$6,updated_at=now() WHERE id=$7 RETURNING id`,
      [data.title, data.caption, data.sortOrder, data.focusX, data.focusY, data.isActive, Number(req.params.imageId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.delete('/api/admin/hospitality/gallery/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    const result = await pool.query(`DELETE FROM hospitality_gallery_images WHERE id=$1 RETURNING id`, [Number(req.params.imageId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri tidak ditemukan' });
    return res.json({ message: 'Foto galeri dihapus' });
  });

  const trainingSelect = `
    SELECT training.id, training.slug, training.title, training.summary, training.description,
           training.description_html AS "descriptionHtml",
           training.starts_at AS "startsAt", training.ends_at AS "endsAt", training.location,
           training.registration_deadline AS "registrationDeadline",
           training.sort_order AS "sortOrder", training.status,
           training.created_at AS "createdAt", training.updated_at AS "updatedAt",
           poster.id AS "posterId", poster.focus_x AS "posterFocusX", poster.focus_y AS "posterFocusY",
           poster.updated_at AS "posterUpdatedAt",
           COALESCE(json_agg(
             json_build_object('id', option.id, 'name', option.name, 'description', option.description,
               'price', option.price, 'capacity', option.capacity, 'sortOrder', option.sort_order,
               'isActive', option.is_active)
             ORDER BY option.sort_order, option.id
           ) FILTER (WHERE option.id IS NOT NULL), '[]'::json) AS options
    FROM trainings training
    LEFT JOIN training_posters poster ON poster.training_id = training.id
    LEFT JOIN training_options option ON option.training_id = training.id`;

  app.get('/api/trainings/hero', async (_req, res) => {
    try {
      const result = await pool.query(`SELECT hero_image, hero_mime_type FROM training_page_settings WHERE id = 1`);
      if (!result.rows[0]?.hero_image) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].hero_mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=3600');
      return res.send(result.rows[0].hero_image);
    } catch (error) {
      console.error('Error fetching training hero:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/trainings/testimonial-settings', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT testimonial_background IS NOT NULL AS "hasBackground",
                testimonial_background_focus_x AS "backgroundFocusX",
                testimonial_background_focus_y AS "backgroundFocusY",
                testimonial_instagram_url AS "instagramUrl",
                updated_at AS "updatedAt"
         FROM training_page_settings WHERE id = 1`,
      );
      return res.json(result.rows[0] || { hasBackground: false, backgroundFocusX: 50, backgroundFocusY: 50, instagramUrl: '' });
    } catch (error) {
      console.error('Error fetching training testimonial settings:', error);
      return res.status(500).json({ message: 'Gagal memuat pengaturan testimoni' });
    }
  });

  app.get('/api/trainings/testimonial-background', async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT testimonial_background, testimonial_background_mime_type FROM training_page_settings WHERE id = 1`,
      );
      if (!result.rows[0]?.testimonial_background) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].testimonial_background_mime_type || 'image/jpeg');
      res.setHeader('Cache-Control', 'public, max-age=300');
      return res.send(result.rows[0].testimonial_background);
    } catch (error) {
      console.error('Error fetching training testimonial background:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/trainings/posters/:posterId', async (req, res) => {
    try {
      const result = await pool.query(`SELECT image_data, mime_type FROM training_posters WHERE id = $1`, [Number(req.params.posterId)]);
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching training poster:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/trainings/gallery/images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(`SELECT image_data, mime_type FROM training_gallery_images WHERE id = $1`, [Number(req.params.imageId)]);
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching training gallery image:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/trainings/description-images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(`SELECT image_data, mime_type FROM training_description_images WHERE id = $1`, [Number(req.params.imageId)]);
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching training description image:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/trainings/testimonials', async (_req, res) => {
    const result = await pool.query(
      `SELECT id, name, occupation, training_name AS "trainingName", testimonial, sort_order AS "sortOrder"
       FROM training_testimonials WHERE is_active = true ORDER BY sort_order, id`,
    );
    return res.json(result.rows);
  });

  app.get('/api/trainings/gallery', async (_req, res) => {
    const result = await pool.query(
      `SELECT id, file_name AS "fileName", title, caption, sort_order AS "sortOrder",
              focus_x AS "focusX", focus_y AS "focusY"
       FROM training_gallery_images WHERE is_active = true ORDER BY sort_order, id`,
    );
    return res.json(result.rows);
  });

  app.get('/api/trainings', async (_req, res) => {
    try {
      const result = await pool.query(
        `${trainingSelect}
         WHERE training.deleted_at IS NULL AND training.status IN ('published', 'closed', 'completed')
           AND (option.is_active = true OR option.id IS NULL)
         GROUP BY training.id, poster.id
         ORDER BY CASE training.status WHEN 'published' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END,
                  training.sort_order, training.starts_at NULLS LAST, training.id DESC`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching trainings:', error);
      return res.status(500).json({ message: 'Gagal memuat agenda pelatihan' });
    }
  });

  app.get('/api/trainings/:slug', async (req, res) => {
    try {
      const result = await pool.query(
        `${trainingSelect}
         WHERE training.slug = $1 AND training.deleted_at IS NULL AND training.status IN ('published', 'closed', 'completed')
           AND (option.is_active = true OR option.id IS NULL)
         GROUP BY training.id, poster.id LIMIT 1`,
        [req.params.slug],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Agenda pelatihan tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching training:', error);
      return res.status(500).json({ message: 'Gagal memuat agenda pelatihan' });
    }
  });

  app.get('/api/training-registrations/profile', isAuthenticated, async (req: any, res) => {
    const userId = req.user.claims.sub;
    const user = await storage.getUser(userId);
    const previous = await pool.query(
      `SELECT full_name AS "fullName", birth_date AS "birthDate", gender, address,
              whatsapp_number AS "whatsappNumber", email, education, occupation
       FROM training_registrations WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return res.json(previous.rows[0] || {
      fullName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      birthDate: '', gender: '', address: '', whatsappNumber: user?.whatsappNumber || '',
      email: user?.email || '', education: '', occupation: '',
    });
  });

  app.post('/api/training-registrations', isAuthenticated, async (req: any, res) => {
    const parsed = trainingRegistrationSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pendaftaran tidak valid', errors: parsed.error.flatten() });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const userId = req.user.claims.sub;
      const training = await client.query(
        `SELECT id, title, status, registration_deadline, starts_at, ends_at FROM trainings
         WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [parsed.data.trainingId],
      );
      if (!training.rowCount || training.rows[0].status !== 'published') {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Pendaftaran agenda ini tidak tersedia' });
      }
      if (training.rows[0].registration_deadline && new Date(training.rows[0].registration_deadline).getTime() < Date.now()) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Batas waktu pendaftaran telah berakhir' });
      }
      const trainingFinishedAt = training.rows[0].ends_at || training.rows[0].starts_at;
      if (trainingFinishedAt && new Date(trainingFinishedAt).getTime() < Date.now()) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Pelatihan telah selesai' });
      }
      const option = await client.query(
        `SELECT id, name, price, capacity FROM training_options
         WHERE id = $1 AND training_id = $2 AND is_active = true FOR UPDATE`,
        [parsed.data.optionId, parsed.data.trainingId],
      );
      if (!option.rowCount) {
        await client.query('ROLLBACK');
        return res.status(409).json({ message: 'Pilihan agenda tidak tersedia' });
      }
      if (option.rows[0].capacity) {
        const used = await client.query(
          `SELECT COUNT(*)::int AS total FROM training_registrations registration
           JOIN orders order_data ON order_data.id = registration.order_id
           WHERE registration.option_id = $1 AND order_data.payment_status IN ('pending', 'paid')
             AND order_data.status <> 'cancelled'`,
          [parsed.data.optionId],
        );
        if (Number(used.rows[0].total) >= Number(option.rows[0].capacity)) {
          await client.query('ROLLBACK');
          return res.status(409).json({ message: 'Kuota pilihan agenda sudah penuh' });
        }
      }
      const order = await client.query(
        `INSERT INTO orders (user_id, total_amount, status, payment_status, payment_method)
         VALUES ($1, $2, 'pending', 'pending', 'midtrans') RETURNING id, total_amount AS "totalAmount"`,
        [userId, option.rows[0].price],
      );
      const participant = parsed.data.participant;
      const registration = await client.query(
        `INSERT INTO training_registrations
          (order_id, user_id, training_id, option_id, training_title, option_name, price,
           full_name, birth_date, gender, address, whatsapp_number, email, education, occupation)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
         RETURNING id, order_id AS "orderId"`,
        [order.rows[0].id, userId, parsed.data.trainingId, parsed.data.optionId, training.rows[0].title,
         option.rows[0].name, option.rows[0].price, participant.fullName, participant.birthDate,
         participant.gender, participant.address, participant.whatsappNumber, participant.email,
         participant.education, participant.occupation],
      );
      await client.query('COMMIT');
      await recordWebsiteCheckout(order.rows[0].id, 'training');
      return res.status(201).json({ ...registration.rows[0], totalAmount: order.rows[0].totalAmount });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating training registration:', error);
      return res.status(500).json({ message: 'Gagal membuat pendaftaran pelatihan' });
    } finally {
      client.release();
    }
  });

  app.get('/api/training-registrations/me', isAuthenticated, async (req: any, res) => {
    const result = await pool.query(
      `SELECT registration.id, registration.order_id AS "orderId", registration.training_title AS "trainingTitle",
              registration.option_name AS "optionName", registration.price, registration.status,
              COALESCE(order_data.payment_status, registration.payment_status) AS "paymentStatus", registration.created_at AS "createdAt",
              training.starts_at AS "startsAt", training.ends_at AS "endsAt", training.location,
              poster.id AS "posterId", poster.focus_x AS "posterFocusX", poster.focus_y AS "posterFocusY",
              poster.updated_at AS "posterUpdatedAt"
       FROM training_registrations registration
       JOIN orders order_data ON order_data.id = registration.order_id
       JOIN trainings training ON training.id = registration.training_id
       LEFT JOIN training_posters poster ON poster.training_id = training.id
       WHERE registration.user_id = $1 ORDER BY registration.created_at DESC`,
      [req.user.claims.sub],
    );
    return res.json(result.rows);
  });

  app.get('/api/admin/trainings', isAuthenticated, canManageTrainings, async (_req, res) => {
    const result = await pool.query(
      `${trainingSelect} WHERE training.deleted_at IS NULL GROUP BY training.id, poster.id ORDER BY training.sort_order, training.id DESC`,
    );
    const settings = await pool.query(
      `SELECT hero_image IS NOT NULL AS "hasHero", hero_file_name AS "heroFileName",
              hero_focus_x AS "heroFocusX", hero_focus_y AS "heroFocusY",
              testimonial_background IS NOT NULL AS "hasTestimonialBackground",
              testimonial_background_file_name AS "testimonialBackgroundFileName",
              testimonial_background_focus_x AS "testimonialBackgroundFocusX",
              testimonial_background_focus_y AS "testimonialBackgroundFocusY",
              testimonial_instagram_url AS "testimonialInstagramUrl",
              updated_at AS "settingsUpdatedAt"
       FROM training_page_settings WHERE id = 1`,
    );
    const trainings = result.rows.map((training: any) => ({
      ...training,
      options: Array.isArray(training.options)
        ? training.options.filter((option: any) => option.isActive)
        : [],
    }));
    return res.json({ trainings, settings: settings.rows[0] });
  });

  app.post('/api/admin/trainings', isAuthenticated, canManageTrainings, async (req: any, res) => {
    const parsed = trainingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pelatihan tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title);
    if (!slug) return res.status(400).json({ message: 'Slug pelatihan tidak valid' });
    try {
      const result = await pool.query(
        `INSERT INTO trainings (slug, title, summary, description, description_html, starts_at, ends_at, location,
          registration_deadline, sort_order, status, created_by)
         VALUES ($1,$2,$3,$4,NULLIF($5,''),$6,$7,NULLIF($8,''),$9,$10,$11,$12) RETURNING id, slug`,
        [slug, parsed.data.title, parsed.data.summary, parsed.data.description, sanitizeTrainingDescription(parsed.data.descriptionHtml), parsed.data.startsAt || null,
         parsed.data.endsAt || null, parsed.data.location, parsed.data.registrationDeadline || null,
         parsed.data.sortOrder, parsed.data.status, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug pelatihan sudah digunakan' });
      return res.status(500).json({ message: 'Gagal menambahkan pelatihan' });
    }
  });

  app.put('/api/admin/trainings/:trainingId', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = trainingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pelatihan tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title);
    const descriptionHtml = sanitizeTrainingDescription(parsed.data.descriptionHtml);
    try {
      const result = await pool.query(
        `UPDATE trainings SET slug=$1,title=$2,summary=$3,description=$4,description_html=NULLIF($5,''),starts_at=$6,ends_at=$7,
          location=NULLIF($8,''),registration_deadline=$9,sort_order=$10,status=$11,updated_at=now()
         WHERE id=$12 AND deleted_at IS NULL RETURNING id, slug`,
        [slug, parsed.data.title, parsed.data.summary, parsed.data.description, descriptionHtml, parsed.data.startsAt || null,
         parsed.data.endsAt || null, parsed.data.location, parsed.data.registrationDeadline || null,
         parsed.data.sortOrder, parsed.data.status, Number(req.params.trainingId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Pelatihan tidak ditemukan' });
      const retainedImageIds = getTrainingDescriptionImageIds(descriptionHtml);
      if (retainedImageIds.length) {
        await pool.query(
          `DELETE FROM training_description_images WHERE training_id=$1 AND NOT (id = ANY($2::int[]))`,
          [Number(req.params.trainingId), retainedImageIds],
        );
      } else {
        await pool.query(`DELETE FROM training_description_images WHERE training_id=$1`, [Number(req.params.trainingId)]);
      }
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug pelatihan sudah digunakan' });
      return res.status(500).json({ message: 'Gagal memperbarui pelatihan' });
    }
  });

  app.delete('/api/admin/trainings/:trainingId', isAuthenticated, canManageTrainings, async (req, res) => {
    const result = await pool.query(
      `UPDATE trainings SET deleted_at=now(),status='draft',updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,
      [Number(req.params.trainingId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pelatihan tidak ditemukan' });
    return res.json({ message: 'Pelatihan dihapus dari katalog' });
  });

  app.post('/api/admin/trainings/:trainingId/options', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = trainingOptionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pilihan tidak valid', errors: parsed.error.flatten() });
    const result = await pool.query(
      `INSERT INTO training_options (training_id,name,description,price,capacity,sort_order,is_active)
       VALUES ($1,$2,NULLIF($3,''),$4,$5,$6,$7) RETURNING id`,
      [Number(req.params.trainingId), parsed.data.name, parsed.data.description, parsed.data.price,
       parsed.data.capacity, parsed.data.sortOrder, parsed.data.isActive],
    );
    return res.status(201).json(result.rows[0]);
  });

  app.put('/api/admin/trainings/:trainingId/options/:optionId', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = trainingOptionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pilihan tidak valid', errors: parsed.error.flatten() });
    const result = await pool.query(
      `UPDATE training_options SET name=$1,description=NULLIF($2,''),price=$3,capacity=$4,sort_order=$5,is_active=$6,updated_at=now()
       WHERE id=$7 AND training_id=$8 RETURNING id`,
      [parsed.data.name, parsed.data.description, parsed.data.price, parsed.data.capacity, parsed.data.sortOrder,
       parsed.data.isActive, Number(req.params.optionId), Number(req.params.trainingId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pilihan agenda tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.delete('/api/admin/trainings/:trainingId/options/:optionId', isAuthenticated, canManageTrainings, async (req, res) => {
    const result = await pool.query(
      `UPDATE training_options SET is_active=false,updated_at=now() WHERE id=$1 AND training_id=$2 RETURNING id`,
      [Number(req.params.optionId), Number(req.params.trainingId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Pilihan agenda tidak ditemukan' });
    return res.json({ message: 'Pilihan agenda dinonaktifkan' });
  });

  app.put('/api/admin/trainings/:trainingId/poster', isAuthenticated, canManageTrainings,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File poster wajib dipilih' });
      const result = await pool.query(
        `INSERT INTO training_posters (training_id,image_data,file_name,mime_type) VALUES ($1,$2,$3,$4)
         ON CONFLICT (training_id) DO UPDATE SET image_data=EXCLUDED.image_data,file_name=EXCLUDED.file_name,
           mime_type=EXCLUDED.mime_type,updated_at=now() RETURNING id`,
        [Number(req.params.trainingId), req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'poster-pelatihan')), req.headers['content-type']],
      );
      return res.json(result.rows[0]);
    });

  app.post('/api/admin/trainings/:trainingId/description-images', isAuthenticated, canManageTrainings,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '5mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto deskripsi wajib dipilih' });
      const trainingId = Number(req.params.trainingId);
      const training = await pool.query(`SELECT id FROM trainings WHERE id=$1 AND deleted_at IS NULL`, [trainingId]);
      if (!training.rowCount) return res.status(404).json({ message: 'Pelatihan tidak ditemukan' });
      const count = await pool.query(`SELECT COUNT(*)::int AS total FROM training_description_images WHERE training_id=$1`, [trainingId]);
      if (Number(count.rows[0].total) >= 5) return res.status(400).json({ message: 'Maksimal 5 foto pada deskripsi lengkap' });
      const result = await pool.query(
        `INSERT INTO training_description_images (training_id,image_data,file_name,mime_type,created_by)
         VALUES ($1,$2,$3,$4,$5) RETURNING id`,
        [trainingId, req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'foto-deskripsi-pelatihan')), req.headers['content-type'], req.user.claims.sub],
      );
      return res.status(201).json({ id: result.rows[0].id, src: `/api/trainings/description-images/${result.rows[0].id}` });
    });

  app.put('/api/admin/trainings/:trainingId/poster/focus', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = digitalProductImageFocusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid' });
    const result = await pool.query(
      `UPDATE training_posters SET focus_x=$1,focus_y=$2,updated_at=now() WHERE training_id=$3 RETURNING id`,
      [parsed.data.focusX, parsed.data.focusY, Number(req.params.trainingId)],
    );
    if (!result.rowCount) return res.status(404).json({ message: 'Poster tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.put('/api/admin/trainings/hero/image', isAuthenticated, canManageTrainings,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File banner wajib dipilih' });
      await pool.query(
        `UPDATE training_page_settings SET hero_image=$1,hero_file_name=$2,hero_mime_type=$3,updated_by=$4,updated_at=now() WHERE id=1`,
        [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'banner-pelatihan')), req.headers['content-type'], req.user.claims.sub],
      );
      return res.json({ message: 'Banner berhasil disimpan' });
    });

  app.put('/api/admin/trainings/hero/focus', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = digitalProductImageFocusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid' });
    await pool.query(`UPDATE training_page_settings SET hero_focus_x=$1,hero_focus_y=$2,updated_at=now() WHERE id=1`, [parsed.data.focusX, parsed.data.focusY]);
    return res.json({ message: 'Posisi fokus banner disimpan' });
  });

  app.put('/api/admin/training-testimonial-section/background', isAuthenticated, canManageTrainings,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto background wajib dipilih' });
      await pool.query(
        `UPDATE training_page_settings
         SET testimonial_background=$1,testimonial_background_file_name=$2,testimonial_background_mime_type=$3,
             updated_by=$4,updated_at=now() WHERE id=1`,
        [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'background-testimoni-pelatihan')), req.headers['content-type'], req.user.claims.sub],
      );
      return res.json({ message: 'Background testimoni berhasil disimpan' });
    });

  app.delete('/api/admin/training-testimonial-section/background', isAuthenticated, canManageTrainings, async (_req: any, res) => {
    await pool.query(
      `UPDATE training_page_settings
       SET testimonial_background=NULL,testimonial_background_file_name=NULL,testimonial_background_mime_type=NULL,updated_at=now()
       WHERE id=1`,
    );
    return res.json({ message: 'Background testimoni dihapus' });
  });

  app.put('/api/admin/training-testimonial-section/settings', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = trainingTestimonialSettingsSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Pengaturan testimoni tidak valid', errors: parsed.error.flatten() });
    await pool.query(
      `UPDATE training_page_settings
       SET testimonial_background_focus_x=$1,testimonial_background_focus_y=$2,
           testimonial_instagram_url=NULLIF($3,''),updated_at=now() WHERE id=1`,
      [parsed.data.backgroundFocusX, parsed.data.backgroundFocusY, parsed.data.instagramUrl],
    );
    return res.json({ message: 'Pengaturan testimoni berhasil disimpan' });
  });

  app.get('/api/admin/training-testimonials', isAuthenticated, canManageTrainings, async (_req, res) => {
    const result = await pool.query(`SELECT id,name,occupation,training_name AS "trainingName",testimonial,sort_order AS "sortOrder",is_active AS "isActive" FROM training_testimonials ORDER BY sort_order,id`);
    return res.json(result.rows);
  });

  app.post('/api/admin/training-testimonials', isAuthenticated, canManageTrainings, async (req: any, res) => {
    const parsed = trainingTestimonialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data testimoni tidak valid', errors: parsed.error.flatten() });
    const d = parsed.data;
    const result = await pool.query(`INSERT INTO training_testimonials (name,occupation,training_name,testimonial,sort_order,is_active,created_by) VALUES ($1,NULLIF($2,''),NULLIF($3,''),$4,$5,$6,$7) RETURNING id`, [d.name,d.occupation,d.trainingName,d.testimonial,d.sortOrder,d.isActive,req.user.claims.sub]);
    return res.status(201).json(result.rows[0]);
  });

  app.put('/api/admin/training-testimonials/:testimonialId', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = trainingTestimonialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data testimoni tidak valid', errors: parsed.error.flatten() });
    const d = parsed.data;
    const result = await pool.query(`UPDATE training_testimonials SET name=$1,occupation=NULLIF($2,''),training_name=NULLIF($3,''),testimonial=$4,sort_order=$5,is_active=$6,updated_at=now() WHERE id=$7 RETURNING id`, [d.name,d.occupation,d.trainingName,d.testimonial,d.sortOrder,d.isActive,Number(req.params.testimonialId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Testimoni tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.delete('/api/admin/training-testimonials/:testimonialId', isAuthenticated, canManageTrainings, async (req, res) => {
    const result = await pool.query(`DELETE FROM training_testimonials WHERE id=$1 RETURNING id`, [Number(req.params.testimonialId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Testimoni tidak ditemukan' });
    return res.json({ message: 'Testimoni dihapus' });
  });

  app.get('/api/admin/training-gallery', isAuthenticated, canManageTrainings, async (_req, res) => {
    const result = await pool.query(`SELECT id,file_name AS "fileName",title,caption,sort_order AS "sortOrder",focus_x AS "focusX",focus_y AS "focusY",is_active AS "isActive" FROM training_gallery_images ORDER BY sort_order,id`);
    return res.json(result.rows);
  });

  app.post('/api/admin/training-gallery', isAuthenticated, canManageTrainings,
    express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'Foto wajib dipilih' });
      const next = await pool.query(`SELECT COALESCE(MAX(sort_order),-1)+1 AS value FROM training_gallery_images`);
      const result = await pool.query(`INSERT INTO training_gallery_images (image_data,file_name,mime_type,sort_order,created_by) VALUES ($1,$2,$3,$4,$5) RETURNING id`, [req.body,decodeURIComponent(String(req.headers['x-file-name'] || 'galeri-pelatihan')),req.headers['content-type'],Number(next.rows[0].value),req.user.claims.sub]);
      return res.status(201).json(result.rows[0]);
    });

  app.put('/api/admin/training-gallery/:imageId', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = trainingGallerySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data galeri tidak valid', errors: parsed.error.flatten() });
    const d = parsed.data;
    const result = await pool.query(`UPDATE training_gallery_images SET title=NULLIF($1,''),caption=NULLIF($2,''),sort_order=$3,focus_x=$4,focus_y=$5,is_active=$6,updated_at=now() WHERE id=$7 RETURNING id`, [d.title,d.caption,d.sortOrder,d.focusX,d.focusY,d.isActive,Number(req.params.imageId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Foto tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.delete('/api/admin/training-gallery/:imageId', isAuthenticated, canManageTrainings, async (req, res) => {
    const result = await pool.query(`DELETE FROM training_gallery_images WHERE id=$1 RETURNING id`, [Number(req.params.imageId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Foto tidak ditemukan' });
    return res.json({ message: 'Foto galeri dihapus' });
  });

  app.get('/api/admin/training-registrations', isAuthenticated, canManageTrainings, async (req, res) => {
    const params: any[] = [];
    let where = '';
    if (req.query.trainingId) { params.push(Number(req.query.trainingId)); where = `WHERE registration.training_id = $${params.length}`; }
    const result = await pool.query(
      `SELECT registration.id,registration.order_id AS "orderId",registration.training_id AS "trainingId",
              registration.training_title AS "trainingTitle",registration.option_name AS "optionName",registration.price,
              registration.full_name AS "fullName",registration.birth_date AS "birthDate",registration.gender,
              registration.address,registration.whatsapp_number AS "whatsappNumber",registration.email,
              registration.education,registration.occupation,registration.status,
              COALESCE(order_data.payment_status, registration.payment_status) AS "paymentStatus",registration.admin_notes AS "adminNotes",
              registration.created_at AS "createdAt" FROM training_registrations registration
       JOIN orders order_data ON order_data.id = registration.order_id
       ${where} ORDER BY registration.created_at DESC`, params);
    return res.json(result.rows);
  });

  app.put('/api/admin/training-registrations/:registrationId', isAuthenticated, canManageTrainings, async (req, res) => {
    const parsed = z.object({ status: z.enum(['pending_payment','registered','cancelled','attended']), adminNotes: z.string().trim().max(5000).optional().default('') }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pendaftaran tidak valid' });
    const result = await pool.query(`UPDATE training_registrations SET status=$1,admin_notes=NULLIF($2,''),updated_at=now() WHERE id=$3 RETURNING id`, [parsed.data.status,parsed.data.adminNotes,Number(req.params.registrationId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Pendaftaran tidak ditemukan' });
    return res.json(result.rows[0]);
  });

  app.get('/api/admin/training-registrations.csv', isAuthenticated, canManageTrainings, async (_req, res) => {
    const result = await pool.query(`SELECT registration.training_title,registration.option_name,registration.full_name,
      registration.birth_date,registration.gender,registration.address,registration.whatsapp_number,registration.email,
      registration.education,registration.occupation,registration.price,registration.status,
      COALESCE(order_data.payment_status, registration.payment_status) AS payment_status,registration.created_at
      FROM training_registrations registration JOIN orders order_data ON order_data.id=registration.order_id
      ORDER BY registration.created_at DESC`);
    const escape = (value: any) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const headers = ['Pelatihan','Pilihan','Nama','Tanggal Lahir','Jenis Kelamin','Alamat','WhatsApp','Email','Pendidikan','Pekerjaan','Harga','Status','Pembayaran','Tanggal Daftar'];
    const rows = result.rows.map((row: any) => [row.training_title,row.option_name,row.full_name,row.birth_date,row.gender,row.address,row.whatsapp_number,row.email,row.education,row.occupation,row.price,row.status,row.payment_status,row.created_at].map(escape).join(','));
    res.setHeader('Content-Type','text/csv; charset=utf-8');
    res.setHeader('Content-Disposition','attachment; filename="pendaftaran-pelatihan.csv"');
    return res.send(`\ufeff${headers.map(escape).join(',')}\n${rows.join('\n')}`);
  });

  const digitalProductSelect = (includeInactiveMedia = false) => `
    SELECT p.id, p.slug, p.name, p.short_description AS "shortDescription",
           p.description, p.description_html AS "descriptionHtml", p.price, p.promo_price AS "promoPrice",
           COALESCE(p.promo_price, p.price) AS "effectivePrice", p.is_active AS "isActive",
           p.delivery_url IS NOT NULL AND p.delivery_url <> '' AS "hasDeliveryUrl",
           p.delivery_file IS NOT NULL AS "hasDeliveryFile",
           p.delivery_file_name AS "deliveryFileName",
           p.delivery_file_size AS "deliveryFileSize",
           p.created_at AS "createdAt", p.updated_at AS "updatedAt",
           COALESCE((
             SELECT json_agg(
               json_build_object(
                 'id', media.id,
                 'title', media.title,
                 'url', media.url,
                 'mediaType', media.media_type,
                 'platform', media.platform,
                 'sortOrder', media.sort_order,
                 'isActive', media.is_active
               ) ORDER BY media.sort_order, media.id
             )
             FROM digital_product_external_media media
             WHERE media.product_id = p.id${includeInactiveMedia ? "" : " AND media.is_active = true"}
           ), '[]'::json) AS media,
           COALESCE(json_agg(
             json_build_object(
               'id', image.id,
               'fileName', image.file_name,
               'sortOrder', image.sort_order,
               'focusX', image.focus_x,
               'focusY', image.focus_y
             )
             ORDER BY image.sort_order, image.id
           ) FILTER (WHERE image.id IS NOT NULL), '[]'::json) AS images
    FROM digital_products p
    LEFT JOIN digital_product_images image ON image.product_id = p.id`;

  app.get('/api/digital-products', async (_req, res) => {
    try {
      const result = await pool.query(
        `${digitalProductSelect()} WHERE p.is_active = true GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC`,
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching digital products:', error);
      res.status(500).json({ message: 'Gagal memuat produk digital' });
    }
  });

  app.get('/api/digital-products/:slug', async (req, res) => {
    try {
      const result = await pool.query(
        `${digitalProductSelect()} WHERE p.slug = $1 AND p.is_active = true GROUP BY p.id LIMIT 1`,
        [req.params.slug],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Produk digital tidak ditemukan' });
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching digital product:', error);
      res.status(500).json({ message: 'Gagal memuat produk digital' });
    }
  });

  app.get('/api/digital-products/images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT image_data, mime_type, file_name FROM digital_product_images WHERE id = $1`,
        [Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching digital product image:', error);
      res.status(500).end();
    }
  });

  app.post('/api/digital-products/orders', isAuthenticated, async (req: any, res) => {
    const parsed = digitalOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pesanan tidak valid', errors: parsed.error.flatten() });

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const productIds = [...new Set(parsed.data.productIds)];
      const products = await client.query(
        `SELECT id, name, COALESCE(promo_price, price) AS price
         FROM digital_products WHERE id = ANY($1::int[]) AND is_active = true FOR SHARE`,
        [productIds],
      );
      if (products.rowCount !== productIds.length) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Satu atau lebih produk tidak tersedia' });
      }

      const totalAmount = products.rows.reduce((sum, product) => sum + Number(product.price), 0);
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_amount, status, payment_status, created_at, updated_at)
         VALUES ($1, $2, 'pending', 'pending', now(), now()) RETURNING *`,
        [req.user.claims.sub, totalAmount],
      );
      const order = orderResult.rows[0];
      for (const product of products.rows) {
        await client.query(
          `INSERT INTO digital_order_items (order_id, product_id, product_name, price) VALUES ($1, $2, $3, $4)`,
          [order.id, product.id, product.name, product.price],
        );
      }
      await client.query(
        `INSERT INTO digital_order_customer_info (order_id, full_name, email, phone, notes)
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, parsed.data.customer.fullName, parsed.data.customer.email, parsed.data.customer.phone, parsed.data.customer.notes || null],
      );
      await client.query('COMMIT');
      await recordWebsiteCheckout(order.id, 'digital_product');
      res.status(201).json({ id: order.id, totalAmount: String(totalAmount), status: 'pending' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error creating digital product order:', error);
      res.status(500).json({ message: 'Gagal membuat pesanan produk digital' });
    } finally {
      client.release();
    }
  });

  app.get('/api/digital-products/purchases/me', isAuthenticated, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT DISTINCT ON (p.id) p.id AS "productId", p.slug, p.name,
                p.short_description AS "shortDescription", p.price,
                o.id AS "orderId", o.paid_at AS "paidAt",
                p.delivery_file IS NOT NULL AS "hasFile",
                p.delivery_url IS NOT NULL AND p.delivery_url <> '' AS "hasLink",
                p.delivery_file_name AS "fileName",
                (SELECT image.id FROM digital_product_images image
                 WHERE image.product_id = p.id ORDER BY image.sort_order, image.id LIMIT 1) AS "imageId",
                (SELECT image.focus_x FROM digital_product_images image
                 WHERE image.product_id = p.id ORDER BY image.sort_order, image.id LIMIT 1) AS "imageFocusX",
                (SELECT image.focus_y FROM digital_product_images image
                 WHERE image.product_id = p.id ORDER BY image.sort_order, image.id LIMIT 1) AS "imageFocusY"
         FROM orders o
         JOIN digital_order_items item ON item.order_id = o.id
         JOIN digital_products p ON p.id = item.product_id
         WHERE o.user_id = $1 AND (o.status = 'completed' OR o.payment_status = 'paid')
         ORDER BY p.id, o.paid_at DESC NULLS LAST, o.id DESC`,
        [req.user.claims.sub],
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching digital purchases:', error);
      res.status(500).json({ message: 'Gagal memuat produk digital Anda' });
    }
  });

  async function getOwnedDigitalProduct(userId: string, productId: number) {
    return pool.query(
      `SELECT p.*, o.id AS order_id FROM orders o
       JOIN digital_order_items item ON item.order_id = o.id
       JOIN digital_products p ON p.id = item.product_id
       WHERE o.user_id = $1 AND p.id = $2 AND (o.status = 'completed' OR o.payment_status = 'paid')
       ORDER BY o.paid_at DESC NULLS LAST, o.id DESC LIMIT 1`,
      [userId, productId],
    );
  }

  app.get('/api/digital-products/purchases/:productId/download', isAuthenticated, async (req: any, res) => {
    try {
      const productId = Number(req.params.productId);
      const result = await getOwnedDigitalProduct(req.user.claims.sub, productId);
      if (!result.rowCount || !result.rows[0].delivery_file) return res.status(404).json({ message: 'File produk tidak tersedia' });
      const product = result.rows[0];
      await pool.query(
        `INSERT INTO digital_product_access_logs (user_id, product_id, order_id, access_type) VALUES ($1, $2, $3, 'download')`,
        [req.user.claims.sub, productId, product.order_id],
      );
      res.setHeader('Content-Type', product.delivery_mime_type || 'application/octet-stream');
      res.setHeader('Content-Disposition', `attachment; filename="${String(product.delivery_file_name || 'produk-digital').replace(/["\\\r\n]/g, '_')}"`);
      res.send(product.delivery_file);
    } catch (error) {
      console.error('Error downloading digital product:', error);
      res.status(500).json({ message: 'Gagal mengunduh produk digital' });
    }
  });

  app.get('/api/digital-products/purchases/:productId/link', isAuthenticated, async (req: any, res) => {
    try {
      const productId = Number(req.params.productId);
      const result = await getOwnedDigitalProduct(req.user.claims.sub, productId);
      if (!result.rowCount || !result.rows[0].delivery_url) return res.status(404).json({ message: 'Link produk tidak tersedia' });
      const product = result.rows[0];
      await pool.query(
        `INSERT INTO digital_product_access_logs (user_id, product_id, order_id, access_type) VALUES ($1, $2, $3, 'link')`,
        [req.user.claims.sub, productId, product.order_id],
      );
      res.json({ url: product.delivery_url });
    } catch (error) {
      console.error('Error opening digital product link:', error);
      res.status(500).json({ message: 'Gagal membuka link produk digital' });
    }
  });

  app.get('/api/admin/digital-products', isAuthenticated, canManageDigitalProducts, async (_req, res) => {
    try {
      const result = await pool.query(`${digitalProductSelect(true).replace('p.delivery_url IS NOT NULL', 'p.delivery_url AS "deliveryUrl", p.delivery_url IS NOT NULL')} GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC`);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin digital products:', error);
      res.status(500).json({ message: 'Gagal memuat produk digital' });
    }
  });

  app.get('/api/admin/digital-product-orders', isAuthenticated, canManageDigitalProducts, async (_req, res) => {
    try {
      const result = await pool.query(
        `SELECT o.id AS "orderId", o.user_id AS "userId", o.total_amount AS "totalAmount",
                o.status AS "orderStatus", o.payment_status AS "paymentStatus",
                o.payment_method AS "paymentMethod", o.paid_amount AS "paidAmount",
                o.paid_at AS "paidAt", o.created_at AS "createdAt",
                customer.full_name AS "fullName", customer.email, customer.phone, customer.notes,
                account.email AS "accountEmail", account.first_name AS "accountFirstName",
                account.last_name AS "accountLastName",
                COALESCE(items.products, '[]'::json) AS products
         FROM orders o
         JOIN digital_order_customer_info customer ON customer.order_id = o.id
         LEFT JOIN users account ON account.id = o.user_id
         JOIN LATERAL (
           SELECT json_agg(
             json_build_object(
               'productId', item.product_id,
               'productName', item.product_name,
               'price', item.price
             ) ORDER BY item.id
           ) AS products
           FROM digital_order_items item
           WHERE item.order_id = o.id
         ) items ON items.products IS NOT NULL
         ORDER BY o.created_at DESC, o.id DESC`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching digital product orders:', error);
      return res.status(500).json({ message: 'Gagal memuat pembelian produk digital' });
    }
  });

  app.post('/api/admin/digital-products', isAuthenticated, canManageDigitalProducts, async (req: any, res) => {
    const parsed = digitalProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data produk tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.name);
    if (!slug) return res.status(400).json({ message: 'Slug produk tidak valid' });
    try {
      const result = await pool.query(
        `INSERT INTO digital_products (slug, name, short_description, description, description_html, price, promo_price, is_active, delivery_url, created_by)
         VALUES ($1, $2, $3, $4, NULLIF($5, ''), $6, $7, $8, NULLIF($9, ''), $10) RETURNING id, slug`,
        [slug, parsed.data.name, parsed.data.shortDescription, parsed.data.description, sanitizeRichText(parsed.data.descriptionHtml), parsed.data.price, parsed.data.promoPrice, parsed.data.isActive, parsed.data.deliveryUrl || '', req.user.claims.sub],
      );
      res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug produk sudah digunakan' });
      console.error('Error creating digital product:', error);
      res.status(500).json({ message: 'Gagal menambahkan produk digital' });
    }
  });

  app.put('/api/admin/digital-products/:productId', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    const parsed = digitalProductSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data produk tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.name);
    try {
      const result = await pool.query(
        `UPDATE digital_products SET slug = $1, name = $2, short_description = $3, description = $4,
           description_html = NULLIF($5, ''), price = $6, promo_price = $7, is_active = $8, delivery_url = NULLIF($9, ''), updated_at = now()
         WHERE id = $10 RETURNING id, slug`,
        [slug, parsed.data.name, parsed.data.shortDescription, parsed.data.description, sanitizeRichText(parsed.data.descriptionHtml), parsed.data.price, parsed.data.promoPrice, parsed.data.isActive, parsed.data.deliveryUrl || '', Number(req.params.productId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Produk tidak ditemukan' });
      res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug produk sudah digunakan' });
      console.error('Error updating digital product:', error);
      res.status(500).json({ message: 'Gagal memperbarui produk digital' });
    }
  });

  app.delete('/api/admin/digital-products/:productId', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE digital_products SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`,
        [Number(req.params.productId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Produk tidak ditemukan' });
      res.json({ message: 'Produk dinonaktifkan' });
    } catch (error) {
      console.error('Error deleting digital product:', error);
      res.status(500).json({ message: 'Gagal menghapus produk digital' });
    }
  });

  app.post('/api/admin/digital-products/:productId/images', isAuthenticated, canManageDigitalProducts,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req: any, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
        const result = await pool.query(
          `INSERT INTO digital_product_images (product_id, image_data, file_name, mime_type, sort_order)
           VALUES ($1, $2, $3, $4, COALESCE((SELECT max(sort_order) + 1 FROM digital_product_images WHERE product_id = $1), 0)) RETURNING id`,
          [Number(req.params.productId), req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'gambar-produk')), req.headers['content-type']],
        );
        res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Error uploading digital product image:', error);
        res.status(500).json({ message: 'Gagal mengunggah gambar' });
      }
    });

  app.delete('/api/admin/digital-products/:productId/images/:imageId', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    const result = await pool.query(`DELETE FROM digital_product_images WHERE id = $1 AND product_id = $2 RETURNING id`, [Number(req.params.imageId), Number(req.params.productId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Gambar tidak ditemukan' });
    res.json({ message: 'Gambar dihapus' });
  });

  app.put('/api/admin/digital-products/:productId/images/:imageId/focus', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    const parsed = digitalProductImageFocusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE digital_product_images SET focus_x = $1, focus_y = $2
         WHERE id = $3 AND product_id = $4 RETURNING id, focus_x AS "focusX", focus_y AS "focusY"`,
        [parsed.data.focusX, parsed.data.focusY, Number(req.params.imageId), Number(req.params.productId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Gambar tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating digital product image focus:', error);
      return res.status(500).json({ message: 'Gagal menyimpan posisi fokus gambar' });
    }
  });

  app.post('/api/admin/digital-products/:productId/media', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    const parsed = digitalProductExternalMediaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data video atau dokumentasi tidak valid', errors: parsed.error.flatten() });
    try {
      const productId = Number(req.params.productId);
      const count = await pool.query(`SELECT count(*)::int AS total FROM digital_product_external_media WHERE product_id = $1`, [productId]);
      if (Number(count.rows[0]?.total || 0) >= 10) return res.status(400).json({ message: 'Maksimal 10 video atau dokumentasi per produk' });
      const result = await pool.query(
        `INSERT INTO digital_product_external_media (product_id, title, url, media_type, platform, sort_order, is_active)
         SELECT id, $2, $3, $4, $5, $6, $7 FROM digital_products WHERE id = $1
         RETURNING id`,
        [productId, parsed.data.title, parsed.data.url, parsed.data.mediaType, getSocialMediaPlatform(parsed.data.url), parsed.data.sortOrder, parsed.data.isActive],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Produk tidak ditemukan' });
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating digital product external media:', error);
      return res.status(500).json({ message: 'Gagal menambahkan video atau dokumentasi' });
    }
  });

  app.put('/api/admin/digital-products/:productId/media/:mediaId', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    const parsed = digitalProductExternalMediaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data video atau dokumentasi tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE digital_product_external_media
         SET title = $1, url = $2, media_type = $3, platform = $4, sort_order = $5, is_active = $6, updated_at = now()
         WHERE id = $7 AND product_id = $8 RETURNING id`,
        [parsed.data.title, parsed.data.url, parsed.data.mediaType, getSocialMediaPlatform(parsed.data.url), parsed.data.sortOrder, parsed.data.isActive, Number(req.params.mediaId), Number(req.params.productId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Video atau dokumentasi tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating digital product external media:', error);
      return res.status(500).json({ message: 'Gagal memperbarui video atau dokumentasi' });
    }
  });

  app.delete('/api/admin/digital-products/:productId/media/:mediaId', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM digital_product_external_media WHERE id = $1 AND product_id = $2 RETURNING id`,
        [Number(req.params.mediaId), Number(req.params.productId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Video atau dokumentasi tidak ditemukan' });
      return res.json({ message: 'Video atau dokumentasi dihapus' });
    } catch (error) {
      console.error('Error deleting digital product external media:', error);
      return res.status(500).json({ message: 'Gagal menghapus video atau dokumentasi' });
    }
  });

  app.put('/api/admin/digital-products/:productId/file', isAuthenticated, canManageDigitalProducts,
    express.raw({ type: () => true, limit: '50mb' }), async (req: any, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File produk wajib dipilih' });
        await pool.query(
          `UPDATE digital_products SET delivery_file = $1, delivery_file_name = $2, delivery_mime_type = $3,
             delivery_file_size = $4, updated_at = now() WHERE id = $5`,
          [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'produk-digital')), req.headers['x-original-mime-type'] || req.headers['content-type'] || 'application/octet-stream', req.body.length, Number(req.params.productId)],
        );
        res.json({ message: 'File produk berhasil diunggah' });
      } catch (error) {
        console.error('Error uploading digital product file:', error);
        res.status(500).json({ message: 'Gagal mengunggah file produk' });
      }
    });

  app.delete('/api/admin/digital-products/:productId/file', isAuthenticated, canManageDigitalProducts, async (req, res) => {
    await pool.query(
      `UPDATE digital_products SET delivery_file = NULL, delivery_file_name = NULL, delivery_mime_type = NULL,
       delivery_file_size = NULL, updated_at = now() WHERE id = $1`,
      [Number(req.params.productId)],
    );
    res.json({ message: 'File produk dihapus' });
  });

  const physicalProductSelect = (includeInactiveMedia = false) => `
    SELECT p.id, p.slug, p.name, p.short_description AS "shortDescription",
           p.description, p.description_html AS "descriptionHtml", p.sku, p.price,
           p.promo_price AS "promoPrice", COALESCE(p.promo_price, p.price) AS "effectivePrice",
           p.stock, p.low_stock_threshold AS "lowStockThreshold", p.weight_grams AS "weightGrams",
           p.shipping_fee AS "shippingFee", p.is_active AS "isActive",
           p.created_at AS "createdAt", p.updated_at AS "updatedAt",
           COALESCE((SELECT json_agg(json_build_object(
             'id', media.id, 'title', media.title, 'url', media.url, 'mediaType', media.media_type,
             'platform', media.platform, 'sortOrder', media.sort_order, 'isActive', media.is_active
           ) ORDER BY media.sort_order, media.id)
           FROM physical_product_external_media media
           WHERE media.product_id = p.id${includeInactiveMedia ? "" : " AND media.is_active = true"}), '[]'::json) AS media,
           COALESCE(json_agg(json_build_object(
             'id', image.id, 'fileName', image.file_name, 'sortOrder', image.sort_order,
             'focusX', image.focus_x, 'focusY', image.focus_y
           ) ORDER BY image.sort_order, image.id) FILTER (WHERE image.id IS NOT NULL), '[]'::json) AS images
    FROM physical_products p LEFT JOIN physical_product_images image ON image.product_id = p.id`;

  app.get('/api/physical-products', async (_req, res) => {
    await releaseExpiredPhysicalReservations();
    const result = await pool.query(`${physicalProductSelect()} WHERE p.is_active = true GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC`);
    res.json(result.rows);
  });

  app.get('/api/physical-products/images/:imageId', async (req, res) => {
    const result = await pool.query(`SELECT image_data, mime_type FROM physical_product_images WHERE id = $1`, [Number(req.params.imageId)]);
    if (!result.rowCount) return res.status(404).end();
    res.setHeader('Content-Type', result.rows[0].mime_type);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.send(result.rows[0].image_data);
  });

  app.get('/api/physical-products/:slug', async (req, res) => {
    const result = await pool.query(`${physicalProductSelect()} WHERE p.slug = $1 AND p.is_active = true GROUP BY p.id LIMIT 1`, [req.params.slug]);
    if (!result.rowCount) return res.status(404).json({ message: 'Produk fisik tidak ditemukan' });
    res.json(result.rows[0]);
  });

  app.post('/api/physical-products/orders', isAuthenticated, async (req: any, res) => {
    const parsed = physicalOrderSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data pesanan tidak valid', errors: parsed.error.flatten() });
    const quantities = new Map<number, number>();
    for (const item of parsed.data.items) quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
    const client = await pool.connect();
    try {
      await releaseExpiredPhysicalReservations();
      await client.query('BEGIN');
      const ids = [...quantities.keys()];
      const products = await client.query(
        `SELECT id, name, sku, stock, COALESCE(promo_price, price) AS price, shipping_fee
         FROM physical_products WHERE id = ANY($1::int[]) AND is_active = true FOR UPDATE`, [ids]);
      if (products.rowCount !== ids.length) throw Object.assign(new Error('Satu atau lebih produk tidak tersedia'), { status: 404 });
      let subtotal = 0;
      let shippingFee = 0;
      for (const product of products.rows) {
        const quantity = quantities.get(product.id)!;
        if (Number(product.stock) < quantity) throw Object.assign(new Error(`Stok ${product.name} tidak mencukupi`), { status: 409 });
        subtotal += Number(product.price) * quantity;
        shippingFee += Number(product.shipping_fee) * quantity;
        await client.query(`UPDATE physical_products SET stock = stock - $1, updated_at = now() WHERE id = $2`, [quantity, product.id]);
      }
      const totalAmount = subtotal + shippingFee;
      const orderResult = await client.query(
        `INSERT INTO orders (user_id, total_amount, status, payment_status, created_at, updated_at)
         VALUES ($1, $2, 'pending', 'pending', now(), now()) RETURNING id`, [req.user.claims.sub, totalAmount]);
      const orderId = orderResult.rows[0].id;
      for (const product of products.rows) {
        await client.query(
          `INSERT INTO physical_order_items (order_id, product_id, product_name, sku, unit_price, quantity)
           VALUES ($1,$2,$3,$4,$5,$6)`, [orderId, product.id, product.name, product.sku, product.price, quantities.get(product.id)]);
      }
      const shipping = parsed.data.shipping;
      await client.query(
        `INSERT INTO physical_order_shipping
         (order_id,recipient_name,email,phone,address,district,city,province,postal_code,notes,shipping_fee,reservation_expires_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,NULLIF($10,''),$11,now() + ($12 || ' minutes')::interval)`,
        [orderId,shipping.recipientName,shipping.email,shipping.phone,shipping.address,shipping.district,shipping.city,shipping.province,shipping.postalCode,shipping.notes,shippingFee,PAYMENT_EXPIRY_MINUTES]);
      await client.query('COMMIT');
      await recordWebsiteCheckout(orderId, 'physical_product');
      res.status(201).json({ id: orderId, totalAmount: String(totalAmount), subtotal, shippingFee, status: 'pending' });
    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error('Error creating physical product order:', error);
      res.status(error?.status || 500).json({ message: error?.message || 'Gagal membuat pesanan produk fisik' });
    } finally { client.release(); }
  });

  app.get('/api/physical-products/orders/me', isAuthenticated, async (req: any, res) => {
    await releaseExpiredPhysicalReservations();
    const result = await pool.query(
      `SELECT o.id AS "orderId", o.total_amount AS "totalAmount", o.status AS "orderStatus",
              o.payment_status AS "paymentStatus", o.paid_at AS "paidAt", o.created_at AS "createdAt",
              shipping.*, COALESCE(items.products, '[]'::json) AS products
       FROM orders o JOIN physical_order_shipping shipping ON shipping.order_id=o.id
       JOIN LATERAL (SELECT json_agg(json_build_object(
         'productId',item.product_id,'productName',item.product_name,'sku',item.sku,
         'unitPrice',item.unit_price,'quantity',item.quantity,
         'imageId',(SELECT id FROM physical_product_images WHERE product_id=item.product_id ORDER BY sort_order,id LIMIT 1)
       ) ORDER BY item.id) AS products FROM physical_order_items item WHERE item.order_id=o.id) items ON true
       WHERE o.user_id=$1 ORDER BY o.created_at DESC`, [req.user.claims.sub]);
    res.json(result.rows);
  });

  app.get('/api/admin/physical-products', isAuthenticated, canManageDigitalProducts, async (_req, res) => {
    const result = await pool.query(`${physicalProductSelect(true)} GROUP BY p.id ORDER BY p.created_at DESC, p.id DESC`);
    res.json(result.rows);
  });

  app.get('/api/admin/physical-product-orders', isAuthenticated, canManageDigitalProducts, async (_req, res) => {
    await releaseExpiredPhysicalReservations();
    const result = await pool.query(
      `SELECT o.id AS "orderId",o.user_id AS "userId",o.total_amount AS "totalAmount",o.status AS "orderStatus",
       o.payment_status AS "paymentStatus",o.paid_at AS "paidAt",o.created_at AS "createdAt",
       shipping.*,COALESCE(items.products,'[]'::json) AS products
       FROM orders o JOIN physical_order_shipping shipping ON shipping.order_id=o.id
       JOIN LATERAL (SELECT json_agg(json_build_object('productId',item.product_id,'productName',item.product_name,
       'sku',item.sku,'unitPrice',item.unit_price,'quantity',item.quantity) ORDER BY item.id) products
       FROM physical_order_items item WHERE item.order_id=o.id) items ON true ORDER BY o.created_at DESC`);
    res.json(result.rows);
  });

  app.post('/api/admin/physical-products', isAuthenticated, canManageDigitalProducts, async (req: any, res) => {
    const parsed=physicalProductSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({message:'Data produk tidak valid',errors:parsed.error.flatten()});
    const slug=makeDigitalProductSlug(parsed.data.slug||parsed.data.name);
    try {
      const d=parsed.data; const result=await pool.query(
        `INSERT INTO physical_products (slug,name,short_description,description,description_html,sku,price,promo_price,stock,low_stock_threshold,weight_grams,shipping_fee,is_active,created_by)
         VALUES ($1,$2,$3,$4,NULLIF($5,''),$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING id,slug`,
        [slug,d.name,d.shortDescription,d.description,sanitizeRichText(d.descriptionHtml),d.sku,d.price,d.promoPrice,d.stock,d.lowStockThreshold,d.weightGrams,d.shippingFee,d.isActive,req.user.claims.sub]);
      res.status(201).json(result.rows[0]);
    } catch(error:any){ if(error?.code==='23505')return res.status(409).json({message:'Slug atau SKU sudah digunakan'}); res.status(500).json({message:'Gagal menambahkan produk fisik'}); }
  });

  app.put('/api/admin/physical-products/:productId', isAuthenticated, canManageDigitalProducts, async (req,res) => {
    const parsed=physicalProductSchema.safeParse(req.body);
    if(!parsed.success)return res.status(400).json({message:'Data produk tidak valid',errors:parsed.error.flatten()});
    const d=parsed.data; const slug=makeDigitalProductSlug(d.slug||d.name);
    try { const result=await pool.query(
      `UPDATE physical_products SET slug=$1,name=$2,short_description=$3,description=$4,description_html=NULLIF($5,''),sku=$6,
       price=$7,promo_price=$8,stock=$9,low_stock_threshold=$10,weight_grams=$11,shipping_fee=$12,is_active=$13,updated_at=now()
       WHERE id=$14 RETURNING id,slug`,[slug,d.name,d.shortDescription,d.description,sanitizeRichText(d.descriptionHtml),d.sku,d.price,d.promoPrice,d.stock,d.lowStockThreshold,d.weightGrams,d.shippingFee,d.isActive,Number(req.params.productId)]);
      if(!result.rowCount)return res.status(404).json({message:'Produk tidak ditemukan'}); res.json(result.rows[0]);
    } catch(error:any){if(error?.code==='23505')return res.status(409).json({message:'Slug atau SKU sudah digunakan'});res.status(500).json({message:'Gagal memperbarui produk fisik'});}
  });

  app.delete('/api/admin/physical-products/:productId',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const result=await pool.query(`UPDATE physical_products SET is_active=false,updated_at=now() WHERE id=$1 RETURNING id`,[Number(req.params.productId)]);
    if(!result.rowCount)return res.status(404).json({message:'Produk tidak ditemukan'});res.json({message:'Produk dinonaktifkan'});
  });

  app.post('/api/admin/physical-products/:productId/images',isAuthenticated,canManageDigitalProducts,
    express.raw({type:['image/jpeg','image/png','image/webp'],limit:'8mb'}),async(req:any,res)=>{
      if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({message:'File gambar wajib dipilih'});
      const count=await pool.query(`SELECT count(*)::int total FROM physical_product_images WHERE product_id=$1`,[Number(req.params.productId)]);
      if(Number(count.rows[0]?.total||0)>=10)return res.status(400).json({message:'Maksimal 10 gambar per produk'});
      const result=await pool.query(`INSERT INTO physical_product_images(product_id,image_data,file_name,mime_type,sort_order)
       SELECT id,$2,$3,$4,COALESCE((SELECT max(sort_order)+1 FROM physical_product_images WHERE product_id=$1),0) FROM physical_products WHERE id=$1 RETURNING id`,
       [Number(req.params.productId),req.body,decodeURIComponent(String(req.headers['x-file-name']||'gambar-produk')),req.headers['content-type']]);
      if(!result.rowCount)return res.status(404).json({message:'Produk tidak ditemukan'});res.status(201).json(result.rows[0]);
    });
  app.delete('/api/admin/physical-products/:productId/images/:imageId',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const result=await pool.query(`DELETE FROM physical_product_images WHERE id=$1 AND product_id=$2 RETURNING id`,[Number(req.params.imageId),Number(req.params.productId)]);
    if(!result.rowCount)return res.status(404).json({message:'Gambar tidak ditemukan'});res.json({message:'Gambar dihapus'});
  });
  app.put('/api/admin/physical-products/:productId/images/:imageId/focus',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const parsed=digitalProductImageFocusSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Posisi fokus tidak valid'});
    const result=await pool.query(`UPDATE physical_product_images SET focus_x=$1,focus_y=$2 WHERE id=$3 AND product_id=$4 RETURNING id`,[parsed.data.focusX,parsed.data.focusY,Number(req.params.imageId),Number(req.params.productId)]);
    if(!result.rowCount)return res.status(404).json({message:'Gambar tidak ditemukan'});res.json(result.rows[0]);
  });

  app.post('/api/admin/physical-products/:productId/media',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const parsed=digitalProductExternalMediaSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Data media tidak valid',errors:parsed.error.flatten()});
    const productId=Number(req.params.productId);const count=await pool.query(`SELECT count(*)::int total FROM physical_product_external_media WHERE product_id=$1`,[productId]);
    if(Number(count.rows[0]?.total||0)>=10)return res.status(400).json({message:'Maksimal 10 video atau dokumentasi per produk'});
    const d=parsed.data;const result=await pool.query(`INSERT INTO physical_product_external_media(product_id,title,url,media_type,platform,sort_order,is_active)
     SELECT id,$2,$3,$4,$5,$6,$7 FROM physical_products WHERE id=$1 RETURNING id`,[productId,d.title,d.url,d.mediaType,getSocialMediaPlatform(d.url),d.sortOrder,d.isActive]);
    if(!result.rowCount)return res.status(404).json({message:'Produk tidak ditemukan'});res.status(201).json(result.rows[0]);
  });
  app.put('/api/admin/physical-products/:productId/media/:mediaId',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const parsed=digitalProductExternalMediaSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Data media tidak valid'});const d=parsed.data;
    const result=await pool.query(`UPDATE physical_product_external_media SET title=$1,url=$2,media_type=$3,platform=$4,sort_order=$5,is_active=$6,updated_at=now()
     WHERE id=$7 AND product_id=$8 RETURNING id`,[d.title,d.url,d.mediaType,getSocialMediaPlatform(d.url),d.sortOrder,d.isActive,Number(req.params.mediaId),Number(req.params.productId)]);
    if(!result.rowCount)return res.status(404).json({message:'Media tidak ditemukan'});res.json(result.rows[0]);
  });
  app.delete('/api/admin/physical-products/:productId/media/:mediaId',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const result=await pool.query(`DELETE FROM physical_product_external_media WHERE id=$1 AND product_id=$2 RETURNING id`,[Number(req.params.mediaId),Number(req.params.productId)]);
    if(!result.rowCount)return res.status(404).json({message:'Media tidak ditemukan'});res.json({message:'Media dihapus'});
  });

  app.put('/api/admin/physical-product-orders/:orderId/fulfillment',isAuthenticated,canManageDigitalProducts,async(req,res)=>{
    const parsed=physicalFulfillmentSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Data pengiriman tidak valid',errors:parsed.error.flatten()});
    const orderId=Number(req.params.orderId);if(parsed.data.fulfillmentStatus==='cancelled')await releasePhysicalOrderStock(orderId);
    const d=parsed.data;const result=await pool.query(`UPDATE physical_order_shipping shipping SET fulfillment_status=$1,courier=NULLIF($2,''),tracking_number=NULLIF($3,''),tracking_url=NULLIF($4,''),
      shipped_at=CASE WHEN $1='shipped' AND shipped_at IS NULL THEN now() ELSE shipped_at END,completed_at=CASE WHEN $1='completed' THEN now() ELSE completed_at END,updated_at=now()
      FROM orders order_data WHERE shipping.order_id=$5 AND order_data.id=shipping.order_id
      AND (order_data.payment_status='paid' OR $1='cancelled') RETURNING shipping.order_id`,[d.fulfillmentStatus,d.courier,d.trackingNumber,d.trackingUrl,orderId]);
    if(!result.rowCount)return res.status(409).json({message:'Pesanan belum lunas atau tidak ditemukan'});res.json({message:'Status pengiriman diperbarui'});
  });

  const courseSelect = `
    SELECT course.id, course.slug, course.title, course.price, course.description,
           course.details, course.special_note AS "specialNote",
           course.sort_order AS "sortOrder", course.is_active AS "isActive",
           course.created_at AS "createdAt", course.updated_at AS "updatedAt",
           image.id AS "imageId", image.file_name AS "imageFileName",
           image.focus_x AS "imageFocusX", image.focus_y AS "imageFocusY"
    FROM courses course
    LEFT JOIN course_images image ON image.course_id = course.id`;

  app.get('/api/courses', async (_req, res) => {
    try {
      const result = await pool.query(
        `${courseSelect} WHERE course.is_active = true ORDER BY course.sort_order, course.id`,
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching courses:', error);
      res.status(500).json({ message: 'Gagal memuat katalog kursus' });
    }
  });

  app.get('/api/courses/images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT image_data, mime_type FROM course_images WHERE id = $1`,
        [Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching course image:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/admin/courses', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`${courseSelect} ORDER BY course.sort_order, course.id`);
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin courses:', error);
      res.status(500).json({ message: 'Gagal memuat data kursus' });
    }
  });

  app.post('/api/admin/courses', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data kursus tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title);
    if (!slug) return res.status(400).json({ message: 'Slug kursus tidak valid' });
    try {
      const result = await pool.query(
        `INSERT INTO courses (slug, title, price, description, details, special_note, sort_order, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, NULLIF($6, ''), $7, $8, $9)
         RETURNING id, slug`,
        [slug, parsed.data.title, parsed.data.price, parsed.data.description, JSON.stringify(parsed.data.details), parsed.data.specialNote, parsed.data.sortOrder, parsed.data.isActive, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Nama tautan kursus sudah digunakan' });
      console.error('Error creating course:', error);
      return res.status(500).json({ message: 'Gagal menambahkan kursus' });
    }
  });

  app.put('/api/admin/courses/:courseId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = courseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data kursus tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title);
    if (!slug) return res.status(400).json({ message: 'Slug kursus tidak valid' });
    try {
      const result = await pool.query(
        `UPDATE courses SET slug = $1, title = $2, price = $3, description = $4,
           details = $5::jsonb, special_note = NULLIF($6, ''), sort_order = $7,
           is_active = $8, updated_at = now()
         WHERE id = $9 RETURNING id, slug`,
        [slug, parsed.data.title, parsed.data.price, parsed.data.description, JSON.stringify(parsed.data.details), parsed.data.specialNote, parsed.data.sortOrder, parsed.data.isActive, Number(req.params.courseId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Kursus tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Nama tautan kursus sudah digunakan' });
      console.error('Error updating course:', error);
      return res.status(500).json({ message: 'Gagal memperbarui kursus' });
    }
  });

  app.delete('/api/admin/courses/:courseId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE courses SET is_active = false, updated_at = now() WHERE id = $1 RETURNING id`,
        [Number(req.params.courseId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Kursus tidak ditemukan' });
      return res.json({ message: 'Kursus dinonaktifkan dari katalog' });
    } catch (error) {
      console.error('Error deleting course:', error);
      return res.status(500).json({ message: 'Gagal menghapus kursus' });
    }
  });

  app.put('/api/admin/courses/:courseId/image', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req: any, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
        const courseId = Number(req.params.courseId);
        const course = await pool.query(`SELECT id FROM courses WHERE id = $1`, [courseId]);
        if (!course.rowCount) return res.status(404).json({ message: 'Kursus tidak ditemukan' });
        const result = await pool.query(
          `INSERT INTO course_images (course_id, image_data, file_name, mime_type)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (course_id) DO UPDATE SET image_data = EXCLUDED.image_data,
             file_name = EXCLUDED.file_name, mime_type = EXCLUDED.mime_type, updated_at = now()
           RETURNING id`,
          [courseId, req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'gambar-kursus')), req.headers['content-type']],
        );
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Error uploading course image:', error);
        return res.status(500).json({ message: 'Gagal mengunggah gambar kursus' });
      }
    });

  app.delete('/api/admin/courses/:courseId/image', isAuthenticated, isAdmin, async (req, res) => {
    const result = await pool.query(`DELETE FROM course_images WHERE course_id = $1 RETURNING id`, [Number(req.params.courseId)]);
    if (!result.rowCount) return res.status(404).json({ message: 'Gambar tidak ditemukan' });
    return res.json({ message: 'Gambar kursus dihapus' });
  });

  app.put('/api/admin/courses/:courseId/image/focus', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = digitalProductImageFocusSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE course_images SET focus_x = $1, focus_y = $2, updated_at = now()
         WHERE course_id = $3 RETURNING id, focus_x AS "focusX", focus_y AS "focusY"`,
        [parsed.data.focusX, parsed.data.focusY, Number(req.params.courseId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Gambar tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating course image focus:', error);
      return res.status(500).json({ message: 'Gagal menyimpan posisi fokus gambar' });
    }
  });

  const courseGallerySelect = `
    SELECT id, file_name AS "fileName", title, caption,
           sort_order AS "sortOrder", focus_x AS "focusX", focus_y AS "focusY",
           is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM course_gallery_images`;

  app.get('/api/course-gallery', async (_req, res) => {
    try {
      const result = await pool.query(`${courseGallerySelect} WHERE is_active = true ORDER BY sort_order, id`);
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching course gallery:', error);
      return res.status(500).json({ message: 'Gagal memuat galeri kegiatan kursus' });
    }
  });

  app.get('/api/course-gallery/images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT image_data, mime_type FROM course_gallery_images WHERE id = $1`,
        [Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching course gallery image:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/admin/course-gallery', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`${courseGallerySelect} ORDER BY sort_order, id`);
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin course gallery:', error);
      return res.status(500).json({ message: 'Gagal memuat galeri kegiatan kursus' });
    }
  });

  app.post('/api/admin/course-gallery', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req: any, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
        const count = await pool.query(`SELECT COUNT(*)::int AS total FROM course_gallery_images`);
        if (Number(count.rows[0]?.total ?? 0) >= 12) return res.status(409).json({ message: 'Galeri maksimal berisi 12 foto' });
        const nextOrder = await pool.query(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM course_gallery_images`);
        const fileName = decodeURIComponent(String(req.headers['x-file-name'] || 'foto-galeri-kursus'));
        const result = await pool.query(
          `INSERT INTO course_gallery_images (image_data, file_name, mime_type, title, sort_order, created_by)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [req.body, fileName, req.headers['content-type'], fileName.replace(/\.[^.]+$/, ''), Number(nextOrder.rows[0]?.value ?? 0), req.user.claims.sub],
        );
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        console.error('Error uploading course gallery image:', error);
        return res.status(500).json({ message: 'Gagal mengunggah foto galeri' });
      }
    });

  app.put('/api/admin/course-gallery/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = courseGallerySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data foto galeri tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE course_gallery_images SET title = NULLIF($1, ''), caption = NULLIF($2, ''),
           sort_order = $3, focus_x = $4, focus_y = $5, is_active = $6, updated_at = now()
         WHERE id = $7 RETURNING id`,
        [parsed.data.title, parsed.data.caption, parsed.data.sortOrder, parsed.data.focusX, parsed.data.focusY, parsed.data.isActive, Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating course gallery image:', error);
      return res.status(500).json({ message: 'Gagal memperbarui foto galeri' });
    }
  });

  app.put('/api/admin/course-gallery/:imageId/file', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
        const result = await pool.query(
          `UPDATE course_gallery_images SET image_data = $1, file_name = $2, mime_type = $3, updated_at = now()
           WHERE id = $4 RETURNING id`,
          [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'foto-galeri-kursus')), req.headers['content-type'], Number(req.params.imageId)],
        );
        if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri tidak ditemukan' });
        return res.json(result.rows[0]);
      } catch (error) {
        console.error('Error replacing course gallery image:', error);
        return res.status(500).json({ message: 'Gagal mengganti foto galeri' });
      }
    });

  app.delete('/api/admin/course-gallery/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM course_gallery_images WHERE id = $1 RETURNING id`, [Number(req.params.imageId)]);
      if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri tidak ditemukan' });
      return res.json({ message: 'Foto galeri berhasil dihapus' });
    } catch (error) {
      console.error('Error deleting course gallery image:', error);
      return res.status(500).json({ message: 'Gagal menghapus foto galeri' });
    }
  });

  const onsiteAssessmentSelect = `SELECT id,slug,title,description,COALESCE(result_text,'') AS "resultText",
    COALESCE(target_text,'') AS "targetText",price,sort_order AS "sortOrder",is_active AS "isActive",
    CASE WHEN image_data IS NULL THEN false ELSE true END AS "hasImage", image_focus_x AS "imageFocusX", image_focus_y AS "imageFocusY",
    created_at AS "createdAt",updated_at AS "updatedAt" FROM onsite_assessment_services`;

  app.get('/api/onsite-assessments', async (_req, res) => {
    try { const result = await pool.query(`${onsiteAssessmentSelect} WHERE deleted_at IS NULL AND is_active=true ORDER BY sort_order,id`); return res.json(result.rows); }
    catch (error) { console.error('Error fetching onsite assessments:', error); return res.status(500).json({ message: 'Gagal memuat katalog Asesmen Onsite' }); }
  });
  app.get('/api/admin/onsite-assessments', isAuthenticated, isAdmin, async (_req, res) => {
    try { const result = await pool.query(`${onsiteAssessmentSelect} WHERE deleted_at IS NULL ORDER BY sort_order,id`); return res.json(result.rows); }
    catch (error) { console.error('Error fetching admin onsite assessments:', error); return res.status(500).json({ message: 'Gagal memuat katalog Asesmen Onsite' }); }
  });
  app.post('/api/admin/onsite-assessments', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = onsiteAssessmentServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data layanan tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title).slice(0,180);
    try {
      const result = await pool.query(`INSERT INTO onsite_assessment_services (slug,title,description,result_text,target_text,price,sort_order,is_active,created_by) VALUES ($1,$2,$3,NULLIF($4,''),NULLIF($5,''),$6,$7,$8,$9) RETURNING id,slug`, [slug,parsed.data.title,parsed.data.description,parsed.data.resultText,parsed.data.targetText,parsed.data.price,parsed.data.sortOrder,parsed.data.isActive,req.user.claims.sub]);
      return res.status(201).json(result.rows[0]);
    } catch (error:any) { if (error?.code === '23505') return res.status(409).json({ message: 'Slug layanan sudah digunakan' }); console.error('Error creating onsite assessment:', error); return res.status(500).json({ message: 'Gagal menambahkan layanan' }); }
  });
  app.put('/api/admin/onsite-assessments/:serviceId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = onsiteAssessmentServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data layanan tidak valid', errors: parsed.error.flatten() });
    try { const result = await pool.query(`UPDATE onsite_assessment_services SET title=$1,description=$2,result_text=NULLIF($3,''),target_text=NULLIF($4,''),price=$5,sort_order=$6,is_active=$7,updated_at=now() WHERE id=$8 AND deleted_at IS NULL RETURNING id,slug`, [parsed.data.title,parsed.data.description,parsed.data.resultText,parsed.data.targetText,parsed.data.price,parsed.data.sortOrder,parsed.data.isActive,Number(req.params.serviceId)]); if (!result.rowCount) return res.status(404).json({ message:'Layanan tidak ditemukan' }); return res.json(result.rows[0]); }
    catch (error) { console.error('Error updating onsite assessment:', error); return res.status(500).json({ message:'Gagal memperbarui layanan' }); }
  });
  app.delete('/api/admin/onsite-assessments/:serviceId', isAuthenticated, isAdmin, async (req, res) => {
    try { const result = await pool.query(`UPDATE onsite_assessment_services SET deleted_at=now(),is_active=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [Number(req.params.serviceId)]); if (!result.rowCount) return res.status(404).json({ message:'Layanan tidak ditemukan' }); return res.json({ message:'Layanan berhasil dihapus' }); }
    catch (error) { console.error('Error deleting onsite assessment:', error); return res.status(500).json({ message:'Gagal menghapus layanan' }); }
  });
  app.get('/api/onsite-assessments/:serviceId/image', async (req, res) => {
    try { const result = await pool.query(`SELECT image_data,image_mime_type AS mime_type FROM onsite_assessment_services WHERE id=$1 AND deleted_at IS NULL`, [Number(req.params.serviceId)]); if (!result.rowCount || !result.rows[0].image_data) return res.status(404).end(); res.setHeader('Content-Type',result.rows[0].mime_type); res.setHeader('Cache-Control','public,max-age=3600'); return res.send(result.rows[0].image_data); }
    catch { return res.status(500).end(); }
  });
  app.put('/api/admin/onsite-assessments/:serviceId/image', isAuthenticated, isAdmin, express.raw({ type:['image/jpeg','image/png','image/webp'],limit:'5mb' }), async (req,res) => {
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message:'File gambar wajib dipilih' });
    try { const result = await pool.query(`UPDATE onsite_assessment_services SET image_data=$1,image_file_name=$2,image_mime_type=$3,updated_at=now() WHERE id=$4 AND deleted_at IS NULL RETURNING id`, [req.body,decodeURIComponent(String(req.headers['x-file-name']||'asesmen-onsite')),req.headers['content-type'],Number(req.params.serviceId)]); if(!result.rowCount)return res.status(404).json({message:'Layanan tidak ditemukan'}); return res.json(result.rows[0]); }
    catch(error){console.error('Error uploading onsite assessment image:',error);return res.status(500).json({message:'Gagal mengunggah gambar'});}
  });
  app.put('/api/admin/onsite-assessments/:serviceId/image-focus', isAuthenticated, isAdmin, async (req,res) => {
    const parsed=therapyImageFocusSchema.safeParse(req.body); if(!parsed.success)return res.status(400).json({message:'Posisi fokus tidak valid'});
    try{const result=await pool.query(`UPDATE onsite_assessment_services SET image_focus_x=$1,image_focus_y=$2,updated_at=now() WHERE id=$3 AND deleted_at IS NULL RETURNING id`,[parsed.data.focusX,parsed.data.focusY,Number(req.params.serviceId)]);if(!result.rowCount)return res.status(404).json({message:'Layanan tidak ditemukan'});return res.json(result.rows[0]);}catch{return res.status(500).json({message:'Gagal menyimpan fokus gambar'});}
  });
  app.delete('/api/admin/onsite-assessments/:serviceId/image', isAuthenticated, isAdmin, async (req,res) => {
    try{const result=await pool.query(`UPDATE onsite_assessment_services SET image_data=NULL,image_file_name=NULL,image_mime_type=NULL,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,[Number(req.params.serviceId)]);if(!result.rowCount)return res.status(404).json({message:'Layanan tidak ditemukan'});return res.json({message:'Gambar berhasil dihapus'});}catch{return res.status(500).json({message:'Gagal menghapus gambar'});}
  });

  const psychologyTestToolSelect = `SELECT id,slug,category,title,description,detail_text AS "detailText",
    COALESCE(result_text,'') AS "resultText",COALESCE(target_text,'') AS "targetText",price,
    sort_order AS "sortOrder",is_active AS "isActive",image_data IS NOT NULL AS "hasImage",
    image_focus_x AS "imageFocusX",image_focus_y AS "imageFocusY",created_at AS "createdAt",updated_at AS "updatedAt"
    FROM psychology_test_tools`;
  app.get('/api/psychology-test-tools', async (_req,res) => {
    try { const result=await pool.query(`${psychologyTestToolSelect} WHERE deleted_at IS NULL AND is_active=true ORDER BY sort_order,id`); return res.json(result.rows); }
    catch(error){console.error('Error fetching psychology test tools:',error);return res.status(500).json({message:'Gagal memuat katalog alat tes psikologi'});}
  });
  app.get('/api/admin/psychology-test-tools',isAuthenticated,isAdmin,async(_req,res)=>{
    try{const result=await pool.query(`${psychologyTestToolSelect} WHERE deleted_at IS NULL ORDER BY sort_order,id`);return res.json(result.rows);}
    catch(error){console.error('Error fetching admin psychology test tools:',error);return res.status(500).json({message:'Gagal memuat alat tes psikologi'});}
  });
  app.post('/api/admin/psychology-test-tools',isAuthenticated,isAdmin,async(req:any,res)=>{
    const parsed=psychologyTestToolSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Data alat tes tidak valid',errors:parsed.error.flatten()});
    const d=parsed.data,slug=makeDigitalProductSlug(d.slug||d.title);
    try{const result=await pool.query(`INSERT INTO psychology_test_tools(slug,category,title,description,detail_text,result_text,target_text,price,sort_order,is_active,created_by)
      VALUES($1,$2,$3,$4,$5,NULLIF($6,''),NULLIF($7,''),$8,$9,$10,$11) RETURNING id,slug`,[slug,d.category,d.title,d.description,d.detailText,d.resultText,d.targetText,d.price,d.sortOrder,d.isActive,req.user.claims.sub]);return res.status(201).json(result.rows[0]);}
    catch(error:any){if(error?.code==='23505')return res.status(409).json({message:'Slug alat tes sudah digunakan'});console.error(error);return res.status(500).json({message:'Gagal menambahkan alat tes'});}
  });
  app.put('/api/admin/psychology-test-tools/:toolId',isAuthenticated,isAdmin,async(req,res)=>{
    const parsed=psychologyTestToolSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Data alat tes tidak valid',errors:parsed.error.flatten()});const d=parsed.data;
    try{const result=await pool.query(`UPDATE psychology_test_tools SET category=$1,title=$2,description=$3,detail_text=$4,result_text=NULLIF($5,''),target_text=NULLIF($6,''),price=$7,sort_order=$8,is_active=$9,updated_at=now()
      WHERE id=$10 AND deleted_at IS NULL RETURNING id,slug`,[d.category,d.title,d.description,d.detailText,d.resultText,d.targetText,d.price,d.sortOrder,d.isActive,Number(req.params.toolId)]);if(!result.rowCount)return res.status(404).json({message:'Alat tes tidak ditemukan'});return res.json(result.rows[0]);}
    catch(error){console.error(error);return res.status(500).json({message:'Gagal memperbarui alat tes'});}
  });
  app.delete('/api/admin/psychology-test-tools/:toolId',isAuthenticated,isAdmin,async(req,res)=>{
    const result=await pool.query(`UPDATE psychology_test_tools SET deleted_at=now(),is_active=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,[Number(req.params.toolId)]);
    if(!result.rowCount)return res.status(404).json({message:'Alat tes tidak ditemukan'});return res.json({message:'Alat tes berhasil dihapus'});
  });
  app.get('/api/psychology-test-tools/:toolId/image',async(req,res)=>{
    const result=await pool.query(`SELECT image_data,image_mime_type FROM psychology_test_tools WHERE id=$1 AND deleted_at IS NULL`,[Number(req.params.toolId)]);
    if(!result.rowCount||!result.rows[0].image_data)return res.status(404).end();res.setHeader('Content-Type',result.rows[0].image_mime_type);res.setHeader('Cache-Control','public,max-age=3600');return res.send(result.rows[0].image_data);
  });
  app.put('/api/admin/psychology-test-tools/:toolId/image',isAuthenticated,isAdmin,express.raw({type:['image/jpeg','image/png','image/webp'],limit:'5mb'}),async(req,res)=>{
    if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({message:'File gambar wajib dipilih'});
    const result=await pool.query(`UPDATE psychology_test_tools SET image_data=$1,image_file_name=$2,image_mime_type=$3,updated_at=now() WHERE id=$4 AND deleted_at IS NULL RETURNING id`,[req.body,decodeURIComponent(String(req.headers['x-file-name']||'alat-tes')),req.headers['content-type'],Number(req.params.toolId)]);
    if(!result.rowCount)return res.status(404).json({message:'Alat tes tidak ditemukan'});return res.json(result.rows[0]);
  });
  app.put('/api/admin/psychology-test-tools/:toolId/image-focus',isAuthenticated,isAdmin,async(req,res)=>{
    const parsed=therapyImageFocusSchema.safeParse(req.body);if(!parsed.success)return res.status(400).json({message:'Posisi fokus tidak valid'});
    const result=await pool.query(`UPDATE psychology_test_tools SET image_focus_x=$1,image_focus_y=$2,updated_at=now() WHERE id=$3 AND deleted_at IS NULL RETURNING id`,[parsed.data.focusX,parsed.data.focusY,Number(req.params.toolId)]);
    if(!result.rowCount)return res.status(404).json({message:'Alat tes tidak ditemukan'});return res.json(result.rows[0]);
  });
  app.delete('/api/admin/psychology-test-tools/:toolId/image',isAuthenticated,isAdmin,async(req,res)=>{
    const result=await pool.query(`UPDATE psychology_test_tools SET image_data=NULL,image_file_name=NULL,image_mime_type=NULL,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`,[Number(req.params.toolId)]);
    if(!result.rowCount)return res.status(404).json({message:'Alat tes tidak ditemukan'});return res.json({message:'Gambar berhasil dihapus'});
  });

  const loadTherapies = async (admin = false) => {
    const visibility = admin ? `deleted_at IS NULL` : `deleted_at IS NULL AND is_active = true`;
    const categories = await pool.query(
      `SELECT id, slug, kind, title, description, COALESCE(introduction, '') AS introduction,
              COALESCE(availability, '') AS availability, summary_items AS "summaryItems", theme,
              sort_order AS "sortOrder", is_active AS "isActive",
              CASE WHEN hero_image_data IS NULL THEN NULL ELSE id END AS "heroImageId",
              hero_focus_x AS "heroFocusX", hero_focus_y AS "heroFocusY", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM therapy_categories WHERE ${visibility} ORDER BY sort_order, id`,
    );
    const services = await pool.query(
      `SELECT id, category_id AS "categoryId", slug, title, COALESCE(price, '') AS price, description,
              COALESCE(full_description, '') AS "fullDescription", COALESCE(focus_text, '') AS focus,
              COALESCE(target_text, '') AS target, benefits, conditions, sections,
              sort_order AS "sortOrder", is_active AS "isActive",
              CASE WHEN image_data IS NULL THEN NULL ELSE id END AS "imageId",
              image_focus_x AS "imageFocusX", image_focus_y AS "imageFocusY", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM therapy_services WHERE ${visibility} ORDER BY sort_order, id`,
    );
    return categories.rows.map((category) => ({ ...category, services: services.rows.filter((service) => service.categoryId === category.id) }));
  };

  app.get('/api/therapies', async (_req, res) => {
    try { return res.json(await loadTherapies(false)); }
    catch (error) { console.error('Error fetching therapies:', error); return res.status(500).json({ message: 'Gagal memuat data terapi' }); }
  });
  app.get('/api/admin/therapies', isAuthenticated, isAdmin, async (_req, res) => {
    try { return res.json(await loadTherapies(true)); }
    catch (error) { console.error('Error fetching admin therapies:', error); return res.status(500).json({ message: 'Gagal memuat data terapi' }); }
  });

  app.post('/api/admin/therapy-categories', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = therapyCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data kategori terapi tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title).slice(0, 150);
    try {
      const result = await pool.query(
        `INSERT INTO therapy_categories (slug,kind,title,description,introduction,availability,summary_items,theme,sort_order,is_active,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9,$10,$11) RETURNING id,slug`,
        [slug, parsed.data.kind, parsed.data.title, parsed.data.description, parsed.data.introduction, parsed.data.availability,
          JSON.stringify(parsed.data.summaryItems), parsed.data.theme, parsed.data.sortOrder, parsed.data.isActive, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug kategori sudah digunakan' });
      console.error('Error creating therapy category:', error); return res.status(500).json({ message: 'Gagal menambahkan kategori terapi' });
    }
  });

  app.put('/api/admin/therapy-categories/:categoryId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = therapyCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data kategori terapi tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE therapy_categories SET kind=$1,title=$2,description=$3,introduction=$4,availability=$5,summary_items=$6::jsonb,
          theme=$7,sort_order=$8,is_active=$9,updated_at=now() WHERE id=$10 AND deleted_at IS NULL RETURNING id,slug`,
        [parsed.data.kind, parsed.data.title, parsed.data.description, parsed.data.introduction, parsed.data.availability,
          JSON.stringify(parsed.data.summaryItems), parsed.data.theme, parsed.data.sortOrder, parsed.data.isActive, Number(req.params.categoryId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Kategori terapi tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) { console.error('Error updating therapy category:', error); return res.status(500).json({ message: 'Gagal memperbarui kategori terapi' }); }
  });

  app.delete('/api/admin/therapy-categories/:categoryId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const used = await pool.query(`SELECT 1 FROM therapy_services WHERE category_id=$1 AND deleted_at IS NULL LIMIT 1`, [Number(req.params.categoryId)]);
      if (used.rowCount) return res.status(409).json({ message: 'Hapus atau pindahkan semua jenis terapi pada kategori ini terlebih dahulu' });
      const result = await pool.query(`UPDATE therapy_categories SET deleted_at=now(),is_active=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [Number(req.params.categoryId)]);
      if (!result.rowCount) return res.status(404).json({ message: 'Kategori terapi tidak ditemukan' });
      return res.json({ message: 'Kategori terapi berhasil dihapus' });
    } catch (error) { console.error('Error deleting therapy category:', error); return res.status(500).json({ message: 'Gagal menghapus kategori terapi' }); }
  });

  app.post('/api/admin/therapy-services', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = therapyServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data jenis terapi tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title).slice(0, 150);
    try {
      const result = await pool.query(
        `INSERT INTO therapy_services (category_id,slug,title,price,description,full_description,focus_text,target_text,benefits,conditions,sections,sort_order,is_active,created_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13,$14) RETURNING id,slug`,
        [parsed.data.categoryId, slug, parsed.data.title, parsed.data.price, parsed.data.description, parsed.data.fullDescription,
          parsed.data.focus, parsed.data.target, JSON.stringify(parsed.data.benefits), JSON.stringify(parsed.data.conditions), JSON.stringify(parsed.data.sections),
          parsed.data.sortOrder, parsed.data.isActive, req.user.claims.sub],
      ); return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug jenis terapi sudah digunakan pada kategori tersebut' });
      if (error?.code === '23503') return res.status(400).json({ message: 'Kategori terapi tidak valid' });
      console.error('Error creating therapy service:', error); return res.status(500).json({ message: 'Gagal menambahkan jenis terapi' });
    }
  });

  app.put('/api/admin/therapy-services/:serviceId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = therapyServiceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data jenis terapi tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE therapy_services SET category_id=$1,title=$2,price=$3,description=$4,full_description=$5,focus_text=$6,target_text=$7,
          benefits=$8::jsonb,conditions=$9::jsonb,sections=$10::jsonb,sort_order=$11,is_active=$12,updated_at=now()
         WHERE id=$13 AND deleted_at IS NULL RETURNING id,slug`,
        [parsed.data.categoryId, parsed.data.title, parsed.data.price, parsed.data.description, parsed.data.fullDescription, parsed.data.focus,
          parsed.data.target, JSON.stringify(parsed.data.benefits), JSON.stringify(parsed.data.conditions), JSON.stringify(parsed.data.sections),
          parsed.data.sortOrder, parsed.data.isActive, Number(req.params.serviceId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Jenis terapi tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) { console.error('Error updating therapy service:', error); return res.status(500).json({ message: 'Gagal memperbarui jenis terapi' }); }
  });

  app.delete('/api/admin/therapy-services/:serviceId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(`UPDATE therapy_services SET deleted_at=now(),is_active=false,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [Number(req.params.serviceId)]);
      if (!result.rowCount) return res.status(404).json({ message: 'Jenis terapi tidak ditemukan' });
      return res.json({ message: 'Jenis terapi berhasil dihapus' });
    } catch (error) { console.error('Error deleting therapy service:', error); return res.status(500).json({ message: 'Gagal menghapus jenis terapi' }); }
  });

  const registerTherapyImageRoutes = (resource: 'categories' | 'services', table: 'therapy_categories' | 'therapy_services', prefix: 'hero' | 'image') => {
    const param = resource === 'categories' ? 'categoryId' : 'serviceId';
    const dataColumn = prefix === 'hero' ? 'hero_image_data' : 'image_data';
    const fileColumn = prefix === 'hero' ? 'hero_file_name' : 'image_file_name';
    const mimeColumn = prefix === 'hero' ? 'hero_mime_type' : 'image_mime_type';
    const focusXColumn = prefix === 'hero' ? 'hero_focus_x' : 'image_focus_x';
    const focusYColumn = prefix === 'hero' ? 'hero_focus_y' : 'image_focus_y';
    app.get(`/api/therapies/${resource}/:${param}/image`, async (req, res) => {
      try {
        const result = await pool.query(`SELECT ${dataColumn} AS data, ${mimeColumn} AS mime FROM ${table} WHERE id=$1 AND deleted_at IS NULL`, [Number((req.params as Record<string, string>)[param])]);
        if (!result.rowCount || !result.rows[0].data) return res.status(404).end();
        res.setHeader('Content-Type', result.rows[0].mime); res.setHeader('Cache-Control', 'public, max-age=3600'); return res.send(result.rows[0].data);
      } catch { return res.status(500).end(); }
    });
    app.put(`/api/admin/therapy-${resource}/:${param}/image`, isAuthenticated, isAdmin,
      express.raw({ type: ['image/jpeg','image/png','image/webp'], limit: '5mb' }), async (req, res) => {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
        try {
          const result = await pool.query(`UPDATE ${table} SET ${dataColumn}=$1,${fileColumn}=$2,${mimeColumn}=$3,updated_at=now() WHERE id=$4 AND deleted_at IS NULL RETURNING id`,
            [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'gambar-terapi')), req.headers['content-type'], Number((req.params as Record<string, string>)[param])]);
          if (!result.rowCount) return res.status(404).json({ message: 'Data terapi tidak ditemukan' }); return res.json(result.rows[0]);
        } catch (error) { console.error('Error uploading therapy image:', error); return res.status(500).json({ message: 'Gagal mengunggah gambar terapi' }); }
      });
    app.put(`/api/admin/therapy-${resource}/:${param}/image-focus`, isAuthenticated, isAdmin, async (req, res) => {
      const parsed = therapyImageFocusSchema.safeParse(req.body); if (!parsed.success) return res.status(400).json({ message: 'Posisi fokus tidak valid' });
      try { const result = await pool.query(`UPDATE ${table} SET ${focusXColumn}=$1,${focusYColumn}=$2,updated_at=now() WHERE id=$3 AND deleted_at IS NULL RETURNING id`, [parsed.data.focusX, parsed.data.focusY, Number((req.params as Record<string, string>)[param])]);
        if (!result.rowCount) return res.status(404).json({ message: 'Data terapi tidak ditemukan' }); return res.json(result.rows[0]);
      } catch { return res.status(500).json({ message: 'Gagal memperbarui fokus gambar' }); }
    });
    app.delete(`/api/admin/therapy-${resource}/:${param}/image`, isAuthenticated, isAdmin, async (req, res) => {
      try { const result = await pool.query(`UPDATE ${table} SET ${dataColumn}=NULL,${fileColumn}=NULL,${mimeColumn}=NULL,updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING id`, [Number((req.params as Record<string, string>)[param])]);
        if (!result.rowCount) return res.status(404).json({ message: 'Data terapi tidak ditemukan' }); return res.json({ message: 'Gambar berhasil dihapus' });
      } catch { return res.status(500).json({ message: 'Gagal menghapus gambar' }); }
    });
  };
  registerTherapyImageRoutes('categories', 'therapy_categories', 'hero');
  registerTherapyImageRoutes('services', 'therapy_services', 'image');

  const therapyGallerySelect = `
    SELECT id, file_name AS "fileName", title, caption,
           category_id AS "categoryId",
           sort_order AS "sortOrder", focus_x AS "focusX", focus_y AS "focusY",
           is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
    FROM therapy_gallery_images`;

  app.get('/api/therapy-gallery', async (_req, res) => {
    try {
      const result = await pool.query(`${therapyGallerySelect} WHERE is_active = true ORDER BY sort_order, id`);
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching therapy gallery:', error);
      return res.status(500).json({ message: 'Gagal memuat galeri terapi' });
    }
  });

  app.get('/api/therapy-gallery/images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT image_data, mime_type FROM therapy_gallery_images WHERE id = $1`,
        [Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching therapy gallery image:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/admin/therapy-gallery', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(`${therapyGallerySelect} ORDER BY sort_order, id`);
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin therapy gallery:', error);
      return res.status(500).json({ message: 'Gagal memuat galeri terapi' });
    }
  });

  app.post('/api/admin/therapy-gallery', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('therapy_gallery_upload'))`);
        const count = await client.query(`SELECT COUNT(*)::int AS total FROM therapy_gallery_images`);
        if (Number(count.rows[0]?.total ?? 0) >= 10) {
          await client.query('ROLLBACK');
          return res.status(409).json({ message: 'Galeri terapi maksimal berisi 10 foto' });
        }
        const nextOrder = await client.query(`SELECT COALESCE(MAX(sort_order), -1) + 1 AS value FROM therapy_gallery_images`);
        const fileName = decodeURIComponent(String(req.headers['x-file-name'] || 'foto-galeri-terapi'));
        const result = await client.query(
          `INSERT INTO therapy_gallery_images (image_data, file_name, mime_type, title, sort_order, created_by)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [req.body, fileName, req.headers['content-type'], fileName.replace(/\.[^.]+$/, ''), Number(nextOrder.rows[0]?.value ?? 0), req.user.claims.sub],
        );
        await client.query('COMMIT');
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        console.error('Error uploading therapy gallery image:', error);
        return res.status(500).json({ message: 'Gagal mengunggah foto galeri terapi' });
      } finally {
        client.release();
      }
    });

  app.put('/api/admin/therapy-gallery/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = therapyGallerySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data foto galeri tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE therapy_gallery_images SET title = NULLIF($1, ''), caption = NULLIF($2, ''),
           sort_order = $3, focus_x = $4, focus_y = $5, is_active = $6, category_id = $7, updated_at = now()
         WHERE id = $8 RETURNING id`,
        [parsed.data.title, parsed.data.caption, parsed.data.sortOrder, parsed.data.focusX, parsed.data.focusY, parsed.data.isActive, parsed.data.categoryId, Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri terapi tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating therapy gallery image:', error);
      return res.status(500).json({ message: 'Gagal memperbarui foto galeri terapi' });
    }
  });

  app.put('/api/admin/therapy-gallery/:imageId/file', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' }), async (req, res) => {
      try {
        if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
        const result = await pool.query(
          `UPDATE therapy_gallery_images SET image_data = $1, file_name = $2, mime_type = $3, updated_at = now()
           WHERE id = $4 RETURNING id`,
          [req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'foto-galeri-terapi')), req.headers['content-type'], Number(req.params.imageId)],
        );
        if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri terapi tidak ditemukan' });
        return res.json(result.rows[0]);
      } catch (error) {
        console.error('Error replacing therapy gallery image:', error);
        return res.status(500).json({ message: 'Gagal mengganti foto galeri terapi' });
      }
    });

  app.delete('/api/admin/therapy-gallery/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(`DELETE FROM therapy_gallery_images WHERE id = $1 RETURNING id`, [Number(req.params.imageId)]);
      if (!result.rowCount) return res.status(404).json({ message: 'Foto galeri terapi tidak ditemukan' });
      return res.json({ message: 'Foto galeri terapi berhasil dihapus' });
    } catch (error) {
      console.error('Error deleting therapy gallery image:', error);
      return res.status(500).json({ message: 'Gagal menghapus foto galeri terapi' });
    }
  });

  const articleCategorySelect = `
    SELECT id, slug, name, sort_order AS "sortOrder", is_active AS "isActive",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM article_categories`;

  app.get('/api/article-categories', async (_req, res) => {
    try {
      const result = await pool.query(
        `${articleCategorySelect} WHERE deleted_at IS NULL AND is_active = true ORDER BY sort_order, id`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching article categories:', error);
      return res.status(500).json({ message: 'Gagal memuat kategori artikel' });
    }
  });

  app.get('/api/admin/article-categories', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        `${articleCategorySelect} WHERE deleted_at IS NULL ORDER BY sort_order, id`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin article categories:', error);
      return res.status(500).json({ message: 'Gagal memuat data kategori artikel' });
    }
  });

  app.post('/api/admin/article-categories', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = articleCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data kategori tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.name).slice(0, 100);
    if (!slug) return res.status(400).json({ message: 'Slug kategori tidak valid' });
    try {
      const result = await pool.query(
        `INSERT INTO article_categories (slug, name, sort_order, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5) RETURNING id, slug`,
        [slug, parsed.data.name, parsed.data.sortOrder, parsed.data.isActive, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug kategori sudah digunakan' });
      console.error('Error creating article category:', error);
      return res.status(500).json({ message: 'Gagal menambahkan kategori artikel' });
    }
  });

  app.put('/api/admin/article-categories/:categoryId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = articleCategorySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data kategori tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE article_categories SET name = $1, sort_order = $2, is_active = $3, updated_at = now()
         WHERE id = $4 AND deleted_at IS NULL RETURNING id, slug`,
        [parsed.data.name, parsed.data.sortOrder, parsed.data.isActive, Number(req.params.categoryId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Kategori artikel tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating article category:', error);
      return res.status(500).json({ message: 'Gagal memperbarui kategori artikel' });
    }
  });

  const articlePromoSelect = `
    SELECT id, title, description, button_text AS "buttonText", link_url AS "linkUrl",
           sort_order AS "sortOrder", is_active AS "isActive",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM article_promos`;

  app.get('/api/article-promos', async (_req, res) => {
    try {
      const result = await pool.query(
        `${articlePromoSelect} WHERE deleted_at IS NULL AND is_active = true ORDER BY sort_order, id`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching article promos:', error);
      return res.status(500).json({ message: 'Gagal memuat Promo & Info' });
    }
  });

  app.get('/api/admin/article-promos', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        `${articlePromoSelect} WHERE deleted_at IS NULL ORDER BY sort_order, id`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin article promos:', error);
      return res.status(500).json({ message: 'Gagal memuat data Promo & Info' });
    }
  });

  app.post('/api/admin/article-promos', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = articlePromoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data Promo & Info tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `INSERT INTO article_promos (title, description, button_text, link_url, sort_order, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [parsed.data.title, parsed.data.description, parsed.data.buttonText, parsed.data.linkUrl, parsed.data.sortOrder, parsed.data.isActive, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating article promo:', error);
      return res.status(500).json({ message: 'Gagal menambahkan Promo & Info' });
    }
  });

  app.put('/api/admin/article-promos/:promoId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = articlePromoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data Promo & Info tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE article_promos SET title = $1, description = $2, button_text = $3,
           link_url = $4, sort_order = $5, is_active = $6, updated_at = now()
         WHERE id = $7 AND deleted_at IS NULL RETURNING id`,
        [parsed.data.title, parsed.data.description, parsed.data.buttonText, parsed.data.linkUrl, parsed.data.sortOrder, parsed.data.isActive, Number(req.params.promoId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Promo & Info tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating article promo:', error);
      return res.status(500).json({ message: 'Gagal memperbarui Promo & Info' });
    }
  });

  app.delete('/api/admin/article-promos/:promoId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE article_promos SET deleted_at = now(), is_active = false, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [Number(req.params.promoId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Promo & Info tidak ditemukan' });
      return res.json({ message: 'Promo & Info berhasil dihapus' });
    } catch (error) {
      console.error('Error deleting article promo:', error);
      return res.status(500).json({ message: 'Gagal menghapus Promo & Info' });
    }
  });

  const bookingPromoSelect = `
    SELECT id, title, description, button_text AS "buttonText", link_url AS "linkUrl",
           sort_order AS "sortOrder", is_active AS "isActive",
           created_at AS "createdAt", updated_at AS "updatedAt"
    FROM booking_promos`;

  app.get('/api/booking-promos', async (_req, res) => {
    try {
      const result = await pool.query(
        `${bookingPromoSelect} WHERE deleted_at IS NULL AND is_active = true ORDER BY sort_order, id`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching booking promos:', error);
      return res.status(500).json({ message: 'Gagal memuat Promo & Info Booking' });
    }
  });

  app.get('/api/admin/booking-promos', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        `${bookingPromoSelect} WHERE deleted_at IS NULL ORDER BY sort_order, id`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin booking promos:', error);
      return res.status(500).json({ message: 'Gagal memuat data Promo & Info Booking' });
    }
  });

  app.post('/api/admin/booking-promos', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = articlePromoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data Promo & Info Booking tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `INSERT INTO booking_promos (title, description, button_text, link_url, sort_order, is_active, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [parsed.data.title, parsed.data.description, parsed.data.buttonText, parsed.data.linkUrl, parsed.data.sortOrder, parsed.data.isActive, req.user.claims.sub],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Error creating booking promo:', error);
      return res.status(500).json({ message: 'Gagal menambahkan Promo & Info Booking' });
    }
  });

  app.put('/api/admin/booking-promos/:promoId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = articlePromoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data Promo & Info Booking tidak valid', errors: parsed.error.flatten() });
    try {
      const result = await pool.query(
        `UPDATE booking_promos SET title = $1, description = $2, button_text = $3,
           link_url = $4, sort_order = $5, is_active = $6, updated_at = now()
         WHERE id = $7 AND deleted_at IS NULL RETURNING id`,
        [parsed.data.title, parsed.data.description, parsed.data.buttonText, parsed.data.linkUrl, parsed.data.sortOrder, parsed.data.isActive, Number(req.params.promoId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Promo & Info Booking tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error updating booking promo:', error);
      return res.status(500).json({ message: 'Gagal memperbarui Promo & Info Booking' });
    }
  });

  app.delete('/api/admin/booking-promos/:promoId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE booking_promos SET deleted_at = now(), is_active = false, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [Number(req.params.promoId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Promo & Info Booking tidak ditemukan' });
      return res.json({ message: 'Promo & Info Booking berhasil dihapus' });
    } catch (error) {
      console.error('Error deleting booking promo:', error);
      return res.status(500).json({ message: 'Gagal menghapus Promo & Info Booking' });
    }
  });

  const managedArticleSelect = `
    SELECT article.id, article.slug, article.title, article.excerpt, article.content,
           article.category,
           COALESCE(category.name, article.category) AS "categoryLabel",
           article.author_name AS "authorName", article.status,
           article.published_at AS "publishedAt", article.created_at AS "createdAt",
           article.updated_at AS "updatedAt",
           COALESCE(json_agg(
             json_build_object(
               'id', image.id,
               'fileName', image.file_name,
               'altText', image.alt_text,
               'caption', image.caption,
               'placement', image.placement,
               'sortOrder', image.sort_order,
               'focusX', image.focus_x,
               'focusY', image.focus_y
             ) ORDER BY image.sort_order, image.id
           ) FILTER (WHERE image.id IS NOT NULL), '[]'::json) AS images
    FROM managed_articles article
    LEFT JOIN managed_article_images image ON image.article_id = article.id
    LEFT JOIN article_categories category ON category.slug = article.category AND category.deleted_at IS NULL`;

  app.get('/api/articles', async (_req, res) => {
    try {
      const result = await pool.query(
        `${managedArticleSelect}
         WHERE article.deleted_at IS NULL AND article.status = 'published'
         GROUP BY article.id, category.name
         ORDER BY COALESCE(article.published_at, article.created_at) DESC, article.id DESC`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching managed articles:', error);
      return res.status(500).json({ message: 'Gagal memuat artikel' });
    }
  });

  app.get('/api/articles/:slug', async (req, res) => {
    try {
      const result = await pool.query(
        `${managedArticleSelect}
         WHERE article.slug = $1 AND article.deleted_at IS NULL AND article.status = 'published'
         GROUP BY article.id, category.name LIMIT 1`,
        [req.params.slug],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Artikel tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error) {
      console.error('Error fetching managed article:', error);
      return res.status(500).json({ message: 'Gagal memuat artikel' });
    }
  });

  app.get('/api/articles/images/:imageId', async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT image_data, mime_type FROM managed_article_images WHERE id = $1`,
        [Number(req.params.imageId)],
      );
      if (!result.rowCount) return res.status(404).end();
      res.setHeader('Content-Type', result.rows[0].mime_type);
      res.setHeader('Cache-Control', 'public, max-age=86400');
      return res.send(result.rows[0].image_data);
    } catch (error) {
      console.error('Error fetching managed article image:', error);
      return res.status(500).end();
    }
  });

  app.get('/api/admin/articles', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const result = await pool.query(
        `${managedArticleSelect.replace('SELECT article.id', 'SELECT article.instagram_enabled AS "instagramEnabled", article.instagram_caption AS "instagramCaption", article.first_published AS "firstPublished", article.id')}
         WHERE article.deleted_at IS NULL
         GROUP BY article.id, category.name
         ORDER BY article.updated_at DESC, article.id DESC`,
      );
      return res.json(result.rows);
    } catch (error) {
      console.error('Error fetching admin articles:', error);
      return res.status(500).json({ message: 'Gagal memuat data artikel' });
    }
  });

  app.post('/api/admin/articles', isAuthenticated, isAdmin, async (req: any, res) => {
    const parsed = managedArticleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data artikel tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title);
    if (!slug) return res.status(400).json({ message: 'Slug artikel tidak valid' });
    const publishedAt = parsed.data.publishedAt || (parsed.data.status === 'published' ? new Date().toISOString() : null);
    try {
      const category = await pool.query(
        `SELECT id FROM article_categories WHERE slug = $1 AND deleted_at IS NULL AND is_active = true`,
        [parsed.data.category],
      );
      if (!category.rowCount) return res.status(400).json({ message: 'Kategori artikel tidak tersedia' });
      const result = await pool.query(
        `INSERT INTO managed_articles (slug, title, excerpt, content, category, author_name, status, published_at, created_by, instagram_enabled, instagram_caption)
         VALUES ($1, $2, $3, $4, $5, NULLIF($6, ''), $7, $8, $9, $10, $11)
         RETURNING id, slug`,
        [slug, parsed.data.title, parsed.data.excerpt, parsed.data.content, parsed.data.category, parsed.data.authorName, parsed.data.status, publishedAt, req.user.claims.sub, parsed.data.instagramEnabled, parsed.data.instagramCaption],
      );
      return res.status(201).json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug artikel sudah digunakan' });
      console.error('Error creating managed article:', error);
      return res.status(500).json({ message: 'Gagal menambahkan artikel' });
    }
  });

  app.put('/api/admin/articles/:articleId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = managedArticleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data artikel tidak valid', errors: parsed.error.flatten() });
    const slug = makeDigitalProductSlug(parsed.data.slug || parsed.data.title);
    if (!slug) return res.status(400).json({ message: 'Slug artikel tidak valid' });
    const publishedAt = parsed.data.publishedAt || (parsed.data.status === 'published' ? new Date().toISOString() : null);
    try {
      const currentArticle = await pool.query(
        `SELECT category FROM managed_articles WHERE id = $1 AND deleted_at IS NULL`,
        [Number(req.params.articleId)],
      );
      if (!currentArticle.rowCount) return res.status(404).json({ message: 'Artikel tidak ditemukan' });
      const category = await pool.query(
        `SELECT id FROM article_categories
         WHERE slug = $1 AND deleted_at IS NULL AND (is_active = true OR slug = $2)`,
        [parsed.data.category, currentArticle.rows[0].category],
      );
      if (!category.rowCount) return res.status(400).json({ message: 'Kategori artikel tidak tersedia' });
      const result = await pool.query(
        `UPDATE managed_articles SET slug = $1, title = $2, excerpt = $3, content = $4,
           category = $5, author_name = NULLIF($6, ''), status = $7, published_at = $8,
           updated_at = now(), instagram_enabled = $10, instagram_caption = $11
         WHERE id = $9 AND deleted_at IS NULL RETURNING id, slug`,
        [slug, parsed.data.title, parsed.data.excerpt, parsed.data.content, parsed.data.category, parsed.data.authorName, parsed.data.status, publishedAt, Number(req.params.articleId), parsed.data.instagramEnabled, parsed.data.instagramCaption],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Artikel tidak ditemukan' });
      return res.json(result.rows[0]);
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Slug artikel sudah digunakan' });
      console.error('Error updating managed article:', error);
      return res.status(500).json({ message: 'Gagal memperbarui artikel' });
    }
  });

  app.delete('/api/admin/articles/:articleId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `UPDATE managed_articles SET deleted_at = now(), status = 'draft', updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
        [Number(req.params.articleId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Artikel tidak ditemukan' });
      return res.json({ message: 'Artikel dihapus' });
    } catch (error) {
      console.error('Error deleting managed article:', error);
      return res.status(500).json({ message: 'Gagal menghapus artikel' });
    }
  });

  app.post('/api/admin/articles/:articleId/images', isAuthenticated, isAdmin,
    express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '8mb' }), async (req: any, res) => {
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ message: 'File gambar wajib dipilih' });
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const articleId = Number(req.params.articleId);
        const article = await client.query(`SELECT id FROM managed_articles WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [articleId]);
        if (!article.rowCount) {
          await client.query('ROLLBACK');
          return res.status(404).json({ message: 'Artikel tidak ditemukan' });
        }
        const count = await client.query(`SELECT count(*)::int AS total FROM managed_article_images WHERE article_id = $1`, [articleId]);
        if (Number(count.rows[0].total) >= 3) {
          await client.query('ROLLBACK');
          return res.status(409).json({ message: 'Maksimal tiga gambar untuk setiap artikel' });
        }
        const result = await client.query(
          `INSERT INTO managed_article_images (article_id, image_data, file_name, mime_type, sort_order, placement)
           VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
          [articleId, req.body, decodeURIComponent(String(req.headers['x-file-name'] || 'gambar-artikel')), req.headers['content-type'], Number(count.rows[0].total), Number(count.rows[0].total) === 0 ? 'cover' : 'end'],
        );
        await client.query('COMMIT');
        return res.status(201).json(result.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error uploading managed article image:', error);
        return res.status(500).json({ message: 'Gagal mengunggah gambar artikel' });
      } finally {
        client.release();
      }
    });

  app.put('/api/admin/articles/:articleId/images/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    const parsed = managedArticleImageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Data gambar tidak valid', errors: parsed.error.flatten() });
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      if (parsed.data.placement === 'cover') {
        await client.query(
          `UPDATE managed_article_images SET placement = 'end', updated_at = now()
           WHERE article_id = $1 AND id <> $2 AND placement = 'cover'`,
          [Number(req.params.articleId), Number(req.params.imageId)],
        );
      }
      const result = await client.query(
        `UPDATE managed_article_images SET alt_text = NULLIF($1, ''), caption = NULLIF($2, ''),
           placement = $3, sort_order = $4, focus_x = $5, focus_y = $6, updated_at = now()
         WHERE id = $7 AND article_id = $8
         RETURNING id`,
        [parsed.data.altText, parsed.data.caption, parsed.data.placement, parsed.data.sortOrder, parsed.data.focusX, parsed.data.focusY, Number(req.params.imageId), Number(req.params.articleId)],
      );
      if (!result.rowCount) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: 'Gambar tidak ditemukan' });
      }
      await client.query('COMMIT');
      return res.json(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Error updating managed article image:', error);
      return res.status(500).json({ message: 'Gagal memperbarui gambar artikel' });
    } finally {
      client.release();
    }
  });

  app.delete('/api/admin/articles/:articleId/images/:imageId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const result = await pool.query(
        `DELETE FROM managed_article_images WHERE id = $1 AND article_id = $2 RETURNING id`,
        [Number(req.params.imageId), Number(req.params.articleId)],
      );
      if (!result.rowCount) return res.status(404).json({ message: 'Gambar tidak ditemukan' });
      return res.json({ message: 'Gambar artikel dihapus' });
    } catch (error) {
      console.error('Error deleting managed article image:', error);
      return res.status(500).json({ message: 'Gagal menghapus gambar artikel' });
    }
  });

  app.get('/api/external-assessments/access', isAuthenticated, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT o.id AS "orderId", o.status AS "orderStatus", o.payment_status AS "paymentStatus",
                a.id AS "assessmentId", a.name AS "assessmentName", a.description,
                c.website_name AS "websiteName", c.website_url AS "websiteUrl",
                c.work_hours AS "workHours", c.result_eta_text AS "resultEtaText",
                COALESCE(octet_length(c.instructions_pdf), 0) > 0 AS "hasInstructions",
                c.instructions_file_name AS "instructionsFileName", c.updated_at AS "instructionsUpdatedAt",
                code.code AS token,
                r.file_data IS NOT NULL AS "hasResult", r.file_name AS "resultFileName",
                r.uploaded_at AS "resultUploadedAt"
         FROM orders o
         JOIN order_items oi ON oi.order_id = o.id
         JOIN assessments a ON a.id = oi.assessment_id AND a.type = ANY($2::text[])
         LEFT JOIN external_assessment_configs c ON c.assessment_id = a.id
         LEFT JOIN external_assessment_codes code ON code.order_id = o.id AND code.assessment_id = a.id
         LEFT JOIN external_assessment_results r ON r.order_id = o.id AND r.assessment_id = a.id
         WHERE o.user_id = $1 AND (o.status = 'completed' OR o.payment_status = 'paid')
         ORDER BY o.paid_at DESC NULLS LAST, o.id DESC`,
        [req.user.claims.sub, EXTERNAL_ASSESSMENT_TYPES],
      );
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.json(result.rows);
    } catch (error) {
      console.error('Error fetching external assessment access:', error);
      res.status(500).json({ message: 'Gagal memuat akses asesmen eksternal' });
    }
  });

  app.get('/api/external-assessments/:orderId/:assessmentId/instructions.pdf', isAuthenticated, async (req: any, res) => {
    const result = await pool.query(
      `SELECT c.instructions_pdf, c.instructions_file_name
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       JOIN assessments a ON a.id = oi.assessment_id AND a.id = $2 AND a.type = ANY($5::text[])
       JOIN external_assessment_configs c ON c.assessment_id = a.id
       WHERE o.id = $1 AND (o.user_id = $3 OR $4 = true) AND (o.status = 'completed' OR o.payment_status = 'paid') LIMIT 1`,
      [Number(req.params.orderId), Number(req.params.assessmentId), req.user.claims.sub, canManageExternalAssessmentsRole(req.user.role), EXTERNAL_ASSESSMENT_TYPES],
    );
    if (!result.rows[0]?.instructions_pdf) return res.status(404).json({ message: 'PDF ketentuan belum tersedia' });
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${String(result.rows[0].instructions_file_name || 'ketentuan-pengerjaan.pdf').replace(/["\r\n]/g, '')}"`);
    res.send(result.rows[0].instructions_pdf);
  });

  app.get('/api/external-assessments/:orderId/:assessmentId/result.pdf', isAuthenticated, async (req: any, res) => {
    const result = await pool.query(
      `SELECT r.file_data, r.file_name, r.mime_type FROM external_assessment_results r JOIN orders o ON o.id = r.order_id
       WHERE r.order_id = $1 AND r.assessment_id = $2 AND (o.user_id = $3 OR $4 = true)`,
      [Number(req.params.orderId), Number(req.params.assessmentId), req.user.claims.sub, canManageExternalAssessmentsRole(req.user.role)],
    );
    if (!result.rows[0]) return res.status(404).json({ message: 'Hasil belum tersedia' });
    res.setHeader('Content-Type', result.rows[0].mime_type || 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${String(result.rows[0].file_name).replace(/["\r\n]/g, '')}"`);
    res.send(result.rows[0].file_data);
  });

  app.get('/api/psychologist/online-assessment-results', isAuthenticated, async (req: any, res) => {
    try {
      const psychologist = await storage.getUser(req.user.claims.sub);
      if (!psychologist || psychologist.role !== 'psychologist' || !psychologist.isActive) {
        return res.status(403).json({ message: 'Akses hanya untuk akun psikolog aktif' });
      }

      const parsed = z.object({
        search: z.string().trim().max(120).optional().default(''),
        assessmentType: z.string().trim().max(100).optional().default(''),
        reportStatus: z.enum(['ready', 'pending']).optional(),
        startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
        page: z.coerce.number().int().min(1).optional().default(1),
        pageSize: z.coerce.number().int().min(1).max(50).optional().default(12),
      }).safeParse(req.query);
      if (!parsed.success) return res.status(400).json({ message: 'Filter hasil asesmen tidak valid' });

      const { search, assessmentType, reportStatus, startDate, endDate, page, pageSize } = parsed.data;
      const result = await pool.query(
        `WITH online_results AS (
           SELECT 'internal'::text AS source, ua.id AS "recordId", ua.order_id AS "orderId",
                  ua.user_id AS "userId", u.email, u.whatsapp_number AS "whatsappNumber",
                  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS "clientName",
                  a.id AS "assessmentId", a.name AS "assessmentName", a.type AS "assessmentType",
                  ua.status, ua.completed_at AS "completedAt", ua.created_at AS "createdAt",
                  (ua.status = 'completed') AS "hasReport", NULL::varchar AS "resultFileName"
           FROM user_assessments ua
           JOIN users u ON u.id = ua.user_id
           JOIN assessments a ON a.id = ua.assessment_id
           WHERE NOT (a.type = ANY($1::text[]))
           UNION ALL
           SELECT 'external'::text AS source, COALESCE(r.id, 0) AS "recordId", o.id AS "orderId",
                  o.user_id AS "userId", u.email, u.whatsapp_number AS "whatsappNumber",
                  COALESCE(NULLIF(TRIM(CONCAT_WS(' ', u.first_name, u.last_name)), ''), u.email) AS "clientName",
                  a.id AS "assessmentId", a.name AS "assessmentName", a.type AS "assessmentType",
                  CASE WHEN r.id IS NOT NULL THEN 'completed' ELSE 'processing' END AS status,
                  r.uploaded_at AS "completedAt", COALESCE(o.paid_at, o.created_at) AS "createdAt",
                  (r.id IS NOT NULL) AS "hasReport", r.file_name AS "resultFileName"
           FROM orders o
           JOIN users u ON u.id = o.user_id
           JOIN order_items oi ON oi.order_id = o.id
           JOIN assessments a ON a.id = oi.assessment_id AND a.type = ANY($1::text[])
           LEFT JOIN external_assessment_results r ON r.order_id = o.id AND r.assessment_id = a.id
           WHERE o.status = 'completed' OR o.payment_status = 'paid'
         )
         SELECT online_results.*, COUNT(*) OVER()::int AS total
         FROM online_results
         WHERE ($2::text = '' OR LOWER(CONCAT_WS(' ', "clientName", email, "assessmentName")) LIKE LOWER('%' || $2 || '%'))
           AND ($3::text = '' OR "assessmentType" = $3)
           AND ($4::text = '' OR ($4 = 'ready' AND "hasReport") OR ($4 = 'pending' AND NOT "hasReport"))
           AND ($5::date IS NULL OR COALESCE("completedAt", "createdAt")::date >= $5::date)
           AND ($6::date IS NULL OR COALESCE("completedAt", "createdAt")::date <= $6::date)
         ORDER BY COALESCE("completedAt", "createdAt") DESC NULLS LAST, "orderId" DESC, "recordId" DESC
         LIMIT $7 OFFSET $8`,
        [
          EXTERNAL_ASSESSMENT_TYPES,
          search,
          assessmentType,
          reportStatus || '',
          startDate || null,
          endDate || null,
          pageSize,
          (page - 1) * pageSize,
        ],
      );

      const total = result.rows[0]?.total ?? 0;
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      return res.json({ items: result.rows.map(({ total: _total, ...item }) => item), total, page, pageSize });
    } catch (error) {
      console.error('Error fetching psychologist online assessment results:', error);
      return res.status(500).json({ message: 'Gagal memuat hasil asesmen online' });
    }
  });

  app.get('/api/psychologist/online-assessment-results/internal/:id/pdf', isAuthenticated, async (req: any, res) => {
    try {
      const psychologist = await storage.getUser(req.user.claims.sub);
      if (!psychologist || psychologist.role !== 'psychologist' || !psychologist.isActive) {
        return res.status(403).json({ message: 'Akses hanya untuk akun psikolog aktif' });
      }
      const userAssessmentId = Number(req.params.id);
      if (!Number.isInteger(userAssessmentId) || userAssessmentId < 1) {
        return res.status(400).json({ message: 'ID hasil asesmen tidak valid' });
      }
      const userAssessment = (await storage.getAllUserAssessments()).find((item) => item.id === userAssessmentId);
      if (!userAssessment || userAssessment.status !== 'completed' || isExternalAssessmentType(userAssessment.assessment.type)) {
        return res.status(404).json({ message: 'Hasil asesmen tidak ditemukan atau belum selesai' });
      }

      const pdfBuffer = await generatePdfContent(userAssessment);
      await pool.query(
        `INSERT INTO psychologist_assessment_result_audits
           (psychologist_user_id, source_type, user_assessment_id, order_id, assessment_id)
         VALUES ($1, 'internal', $2, $3, $4)`,
        [psychologist.id, userAssessment.id, userAssessment.orderId, userAssessment.assessmentId],
      );
      const safeName = userAssessment.assessment.name.replace(/[^a-z0-9_-]+/gi, '_');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="Hasil_${safeName}.pdf"`);
      return res.send(pdfBuffer);
    } catch (error) {
      console.error('Error opening internal assessment result for psychologist:', error);
      return res.status(500).json({ message: 'Gagal membuka hasil asesmen' });
    }
  });

  app.get('/api/psychologist/online-assessment-results/external/:orderId/:assessmentId/pdf', isAuthenticated, async (req: any, res) => {
    try {
      const psychologist = await storage.getUser(req.user.claims.sub);
      if (!psychologist || psychologist.role !== 'psychologist' || !psychologist.isActive) {
        return res.status(403).json({ message: 'Akses hanya untuk akun psikolog aktif' });
      }
      const orderId = Number(req.params.orderId);
      const assessmentId = Number(req.params.assessmentId);
      if (!Number.isInteger(orderId) || orderId < 1 || !Number.isInteger(assessmentId) || assessmentId < 1) {
        return res.status(400).json({ message: 'ID hasil asesmen tidak valid' });
      }
      const result = await pool.query(
        `SELECT r.file_data, r.file_name, r.mime_type
         FROM external_assessment_results r
         JOIN assessments a ON a.id = r.assessment_id AND a.type = ANY($3::text[])
         WHERE r.order_id = $1 AND r.assessment_id = $2`,
        [orderId, assessmentId, EXTERNAL_ASSESSMENT_TYPES],
      );
      if (!result.rows[0]) return res.status(404).json({ message: 'Hasil asesmen belum tersedia' });

      await pool.query(
        `INSERT INTO psychologist_assessment_result_audits
           (psychologist_user_id, source_type, order_id, assessment_id)
         VALUES ($1, 'external', $2, $3)`,
        [psychologist.id, orderId, assessmentId],
      );
      const safeFileName = String(result.rows[0].file_name || `hasil-${orderId}.pdf`).replace(/["\r\n]/g, '');
      res.setHeader('Cache-Control', 'private, no-store, max-age=0');
      res.setHeader('Content-Type', result.rows[0].mime_type || 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
      return res.send(result.rows[0].file_data);
    } catch (error) {
      console.error('Error opening external assessment result for psychologist:', error);
      return res.status(500).json({ message: 'Gagal membuka hasil asesmen' });
    }
  });

  app.get('/api/admin/external-assessments', isAuthenticated, canManageExternalAssessments, async (_req, res) => {
    try {
      const products = await pool.query(
        `SELECT a.id, a.name, a.description, a.price, c.original_price AS "originalPrice",
                c.website_name AS "websiteName", c.website_url AS "websiteUrl", c.work_hours AS "workHours",
                c.result_eta_text AS "resultEtaText", c.instructions_file_name AS "instructionsFileName",
                COUNT(code.id) FILTER (WHERE code.status = 'available')::int AS "availableCodes",
                COUNT(code.id) FILTER (WHERE code.status = 'allocated')::int AS "allocatedCodes"
         FROM assessments a JOIN external_assessment_configs c ON c.assessment_id = a.id
         LEFT JOIN external_assessment_codes code ON code.assessment_id = a.id
         WHERE a.type = ANY($1::text[]) GROUP BY a.id, c.assessment_id ORDER BY a.id`,
        [EXTERNAL_ASSESSMENT_TYPES],
      );
      const orders = await pool.query(
        `SELECT o.id AS "orderId", o.user_id AS "userId", o.paid_at AS "paidAt", o.created_at AS "createdAt",
                u.email, u.first_name AS "firstName", u.last_name AS "lastName", a.id AS "assessmentId",
                code.code AS token, code.status AS "tokenStatus", r.file_name AS "resultFileName", r.uploaded_at AS "resultUploadedAt"
         FROM orders o JOIN users u ON u.id = o.user_id JOIN order_items oi ON oi.order_id = o.id
         JOIN assessments a ON a.id = oi.assessment_id AND a.type = ANY($1::text[])
         LEFT JOIN external_assessment_codes code ON code.order_id = o.id AND code.assessment_id = a.id
         LEFT JOIN external_assessment_results r ON r.order_id = o.id AND r.assessment_id = a.id
         WHERE o.status = 'completed' OR o.payment_status = 'paid'
         ORDER BY o.paid_at DESC NULLS LAST, o.id DESC`,
        [EXTERNAL_ASSESSMENT_TYPES],
      );
      const codes = await pool.query(
        `SELECT code.id, code.assessment_id AS "assessmentId", code.code, code.status,
                code.order_id AS "orderId", code.user_id AS "userId", code.allocated_at AS "allocatedAt",
                code.created_at AS "createdAt", u.email, u.first_name AS "firstName", u.last_name AS "lastName"
         FROM external_assessment_codes code
         JOIN assessments a ON a.id = code.assessment_id AND a.type = ANY($1::text[])
         LEFT JOIN orders o ON o.id = code.order_id
         LEFT JOIN users u ON u.id = COALESCE(code.user_id, o.user_id)
         ORDER BY code.created_at DESC NULLS LAST, code.id DESC`,
        [EXTERNAL_ASSESSMENT_TYPES],
      );
      res.json({ products: products.rows, orders: orders.rows, codes: codes.rows });
    } catch (error) {
      console.error('Error fetching external assessment admin data:', error);
      res.status(500).json({ message: 'Gagal memuat pengelolaan asesmen eksternal' });
    }
  });

  app.post('/api/admin/external-assessments/:assessmentId/codes', isAuthenticated, canManageExternalAssessments, async (req: any, res) => {
    const assessmentId = Number(req.params.assessmentId);
    const rawCodes = Array.isArray(req.body.codes) ? req.body.codes : String(req.body.codes || '').split(/[\n,;]/);
    const codes = Array.from(new Set(rawCodes.map((value: unknown) => String(value).trim()).filter(Boolean))).slice(0, 500);
    if (!codes.length) return res.status(400).json({ message: 'Masukkan minimal satu kode tes' });
    let added = 0;
    for (const code of codes) {
      const result = await pool.query(
        `INSERT INTO external_assessment_codes (assessment_id, code, created_by)
         SELECT $1, $2, $3 WHERE EXISTS (SELECT 1 FROM assessments WHERE id = $1 AND type = ANY($4::text[]))
         ON CONFLICT (assessment_id, code) DO NOTHING RETURNING id`,
        [assessmentId, code, req.user.claims.sub, EXTERNAL_ASSESSMENT_TYPES],
      );
      added += result.rowCount || 0;
    }
    if (added > 0) {
      const waitingOrders = await pool.query(
        `SELECT DISTINCT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id
         JOIN assessments a ON a.id = oi.assessment_id AND a.id = $1
         LEFT JOIN external_assessment_codes code ON code.order_id = o.id AND code.assessment_id = a.id
         WHERE (o.status = 'completed' OR o.payment_status = 'paid') AND code.id IS NULL ORDER BY o.id`,
        [assessmentId],
      );
      for (const order of waitingOrders.rows) await allocateExternalAssessmentCodes(order.id);
    }
    res.json({ added, duplicates: codes.length - added });
  });

  app.put('/api/admin/external-assessments/:assessmentId/codes/:codeId', isAuthenticated, canManageExternalAssessments, async (req: any, res) => {
    const assessmentId = Number(req.params.assessmentId);
    const codeId = Number(req.params.codeId);
    const parsed = z.object({ code: z.string().trim().min(1).max(255) }).safeParse(req.body);
    if (!Number.isInteger(assessmentId) || !Number.isInteger(codeId) || assessmentId < 1 || codeId < 1) {
      return res.status(400).json({ message: 'ID kode tes tidak valid' });
    }
    if (!parsed.success) return res.status(400).json({ message: 'Kode tes wajib diisi dan maksimal 255 karakter' });

    try {
      const updated = await pool.query(
        `UPDATE external_assessment_codes code
         SET code = $3
         WHERE code.assessment_id = $1 AND code.id = $2 AND code.status = 'available' AND code.order_id IS NULL
           AND EXISTS (SELECT 1 FROM assessments a WHERE a.id = code.assessment_id AND a.type = ANY($4::text[]))
         RETURNING code.id, code.code, code.status`,
        [assessmentId, codeId, parsed.data.code, EXTERNAL_ASSESSMENT_TYPES],
      );
      if (updated.rowCount) return res.json({ message: 'Kode tes berhasil diperbarui', code: updated.rows[0] });

      const existing = await pool.query(
        `SELECT code.id FROM external_assessment_codes code JOIN assessments a ON a.id = code.assessment_id
         WHERE code.assessment_id = $1 AND code.id = $2 AND a.type = ANY($3::text[])`,
        [assessmentId, codeId, EXTERNAL_ASSESSMENT_TYPES],
      );
      if (!existing.rowCount) return res.status(404).json({ message: 'Kode tes tidak ditemukan' });
      return res.status(409).json({ message: 'Kode yang sudah dialokasikan tidak dapat diedit' });
    } catch (error: any) {
      if (error?.code === '23505') return res.status(409).json({ message: 'Kode tes tersebut sudah tersedia di bank kode' });
      console.error('Error updating external assessment code:', error);
      return res.status(500).json({ message: 'Gagal memperbarui kode tes' });
    }
  });

  app.delete('/api/admin/external-assessments/:assessmentId/codes/:codeId', isAuthenticated, canManageExternalAssessments, async (req: any, res) => {
    const assessmentId = Number(req.params.assessmentId);
    const codeId = Number(req.params.codeId);
    if (!Number.isInteger(assessmentId) || !Number.isInteger(codeId) || assessmentId < 1 || codeId < 1) {
      return res.status(400).json({ message: 'ID kode tes tidak valid' });
    }

    try {
      const deleted = await pool.query(
        `DELETE FROM external_assessment_codes code
         USING assessments a
         WHERE code.assessment_id = $1 AND code.id = $2 AND code.status = 'available' AND code.order_id IS NULL
           AND a.id = code.assessment_id AND a.type = ANY($3::text[])
         RETURNING code.id`,
        [assessmentId, codeId, EXTERNAL_ASSESSMENT_TYPES],
      );
      if (deleted.rowCount) return res.json({ message: 'Kode tes berhasil dihapus' });

      const existing = await pool.query(
        `SELECT code.id FROM external_assessment_codes code JOIN assessments a ON a.id = code.assessment_id
         WHERE code.assessment_id = $1 AND code.id = $2 AND a.type = ANY($3::text[])`,
        [assessmentId, codeId, EXTERNAL_ASSESSMENT_TYPES],
      );
      if (!existing.rowCount) return res.status(404).json({ message: 'Kode tes tidak ditemukan' });
      return res.status(409).json({ message: 'Kode yang sudah dialokasikan tidak dapat dihapus' });
    } catch (error) {
      console.error('Error deleting external assessment code:', error);
      return res.status(500).json({ message: 'Gagal menghapus kode tes' });
    }
  });

  app.put('/api/admin/external-assessments/:assessmentId/config', isAuthenticated, canManageExternalAssessments, async (req, res) => {
    const parsed = z.object({
      websiteName: z.string().trim().max(255).nullable().optional(),
      websiteUrl: z.union([z.string().url(), z.literal('')]).nullable().optional(),
      workHours: z.string().trim().min(3).max(100),
      resultEtaText: z.string().trim().min(3).max(255),
    }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: 'Konfigurasi tidak valid', errors: parsed.error.flatten() });
    await pool.query(
      `UPDATE external_assessment_configs SET website_name = $2, website_url = $3, work_hours = $4, result_eta_text = $5, updated_at = now()
       WHERE assessment_id = $1`,
      [Number(req.params.assessmentId), parsed.data.websiteName || null, parsed.data.websiteUrl || null, parsed.data.workHours, parsed.data.resultEtaText],
    );
    res.json({ message: 'Konfigurasi tersimpan' });
  });

  app.put('/api/admin/external-assessments/:assessmentId/instructions.pdf', isAuthenticated, canManageExternalAssessments, express.raw({ type: 'application/pdf', limit: '10mb' }), async (req: any, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ message: 'File harus berupa PDF yang valid' });
    }
    const assessmentId = Number(req.params.assessmentId);
    if (!Number.isInteger(assessmentId) || assessmentId < 1) {
      return res.status(400).json({ message: 'ID asesmen tidak valid' });
    }
    const fileName = String(req.headers['x-file-name'] || 'ketentuan-pengerjaan.pdf').slice(0, 255);
    const updated = await pool.query(
      `UPDATE external_assessment_configs config
       SET instructions_pdf = $2, instructions_file_name = $3, updated_at = now()
       FROM assessments assessment
       WHERE config.assessment_id = $1 AND assessment.id = config.assessment_id
         AND assessment.type = ANY($4::text[])
       RETURNING config.instructions_file_name AS "instructionsFileName",
                 octet_length(config.instructions_pdf)::int AS "fileSize",
                 config.updated_at AS "updatedAt"`,
      [assessmentId, req.body, fileName, EXTERNAL_ASSESSMENT_TYPES],
    );
    if (!updated.rowCount || !updated.rows[0]?.fileSize) {
      return res.status(404).json({ message: 'Konfigurasi produk asesmen eksternal tidak ditemukan' });
    }
    res.setHeader('Cache-Control', 'no-store');
    res.json({ message: 'PDF ketentuan berhasil diunggah', ...updated.rows[0] });
  });

  app.put('/api/admin/external-assessments/orders/:orderId/:assessmentId/result.pdf', isAuthenticated, canManageExternalAssessments, express.raw({ type: 'application/pdf', limit: '10mb' }), async (req: any, res) => {
    if (!Buffer.isBuffer(req.body) || req.body.length < 5 || req.body.subarray(0, 4).toString() !== '%PDF') {
      return res.status(400).json({ message: 'File harus berupa PDF yang valid' });
    }
    const orderId = Number(req.params.orderId);
    const assessmentId = Number(req.params.assessmentId);
    const eligible = await pool.query(
      `SELECT o.id FROM orders o JOIN order_items oi ON oi.order_id = o.id JOIN assessments a ON a.id = oi.assessment_id
       WHERE o.id = $1 AND a.id = $2 AND a.type = ANY($3::text[]) AND (o.status = 'completed' OR o.payment_status = 'paid')`,
      [orderId, assessmentId, EXTERNAL_ASSESSMENT_TYPES],
    );
    if (!eligible.rowCount) return res.status(404).json({ message: 'Pesanan lunas tidak ditemukan' });
    const fileName = String(req.headers['x-file-name'] || `hasil-asesmen-${orderId}.pdf`).slice(0, 255);
    await pool.query(
      `INSERT INTO external_assessment_results (order_id, assessment_id, file_data, file_name, mime_type, uploaded_by)
       VALUES ($1, $2, $3, $4, 'application/pdf', $5)
       ON CONFLICT (order_id, assessment_id) DO UPDATE SET file_data = EXCLUDED.file_data, file_name = EXCLUDED.file_name,
       mime_type = EXCLUDED.mime_type, uploaded_by = EXCLUDED.uploaded_by, uploaded_at = now()`,
      [orderId, assessmentId, req.body, fileName, req.user.claims.sub],
    );
    res.json({ message: 'Hasil asesmen berhasil diunggah' });
  });

  // Admin login route
  app.post('/api/admin/login', async (req, res) => {
    try {
      const validatedData = adminLoginSchema.parse(req.body);
      
      // Get user by email
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user || (user.role !== 'admin' && user.role !== 'internal' && user.role !== 'cso')) {
        return res.status(401).json({ message: "Kredensial admin/CSO tidak valid" });
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(validatedData.password, user.password || '');
      if (!isValidPassword) {
        return res.status(401).json({ message: "Kredensial admin/CSO tidak valid" });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: "Akun tidak aktif" });
      }

      // Update last login
      await storage.updateUserLastLogin(user.id);

      // Generate tokens
      const accessToken = AuthUtils.generateAccessToken(user.id, user.email, user.role || 'admin');

      res.json({
        message: "Login admin berhasil",
        user: {
          id: user.id,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role
        },
        accessToken
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      console.error("Admin login error:", error);
      res.status(500).json({ message: "Gagal login admin" });
    }
  });

  // Admin dashboard stats
  app.get('/api/admin/stats', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const stats = await storage.getAssessmentStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching admin stats:", error);
      res.status(500).json({ message: "Failed to fetch stats" });
    }
  });

  // Admin user management
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      // Remove password hashes from response
      const safeUsers = users.map(user => ({
        ...user,
        password: undefined
      }));
      res.json(safeUsers);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  app.get('/api/admin/bookings', isAuthenticated, isAdmin, async (_req, res) => {
    try {
      const bookings = await storage.getAllPsychologistBookings();
      res.json(bookings);
    } catch (error) {
      console.error("Error fetching admin bookings:", error);
      res.status(500).json({ message: "Failed to fetch bookings" });
    }
  });

  // Update user
  app.patch('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.params.userId;
      const updates = userUpdateSchema.parse(req.body);
      const normalizedUpdates = updates.role === "psychologist"
        ? { ...updates, ...normalizePsychologistProfileInput(updates) }
        : updates;
      
      const updatedUser = await storage.updateUser(userId, normalizedUpdates);
      
      res.json({
        ...updatedUser,
        password: undefined
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      console.error("Error updating user:", error);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Reset user password
  app.post('/api/admin/users/:userId/reset-password', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.params.userId;
      const { newPassword } = passwordResetSchema.parse({ userId, newPassword: req.body.newPassword });
      
      await storage.resetUserPassword(userId, newPassword);
      
      res.json({ message: "Password berhasil direset" });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ 
          message: "Data tidak valid", 
          errors: error.errors 
        });
      }
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.post('/api/admin/psychologists', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const data = adminCreatePsychologistSchema.parse(req.body);
      const existingUser = await storage.getUserByEmail(data.email);
      if (existingUser) {
        return res.status(409).json({ message: "Email sudah terdaftar." });
      }

      const bcrypt = await import("bcryptjs");
      const user = await storage.createUser({
        id: AuthUtils.generateUserId(),
        email: data.email,
        password: await bcrypt.hash(data.password, 10),
        firstName: data.firstName,
        lastName: data.lastName || "",
        whatsappNumber: data.whatsappNumber?.replace(/\D/g, "") || "",
        psychologistProfileName: data.psychologistProfileName,
        ...normalizePsychologistProfileInput(data),
        role: "psychologist",
        authProvider: "custom",
        isActive: true,
        isEmailVerified: true,
      });

      res.status(201).json({ ...user, password: undefined });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Data psikolog tidak valid", errors: error.flatten() });
      }
      console.error("Error creating psychologist:", error);
      res.status(500).json({ message: "Failed to create psychologist" });
    }
  });

  app.delete('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.userId;
      if (userId === req.user.claims.sub) {
        return res.status(400).json({ message: "Admin tidak dapat menghapus akun sendiri." });
      }

      const deleted = await storage.deleteUnusedUser(userId);
      if (!deleted) {
        return res.status(409).json({ message: "User tidak dapat dihapus karena masih memiliki order, booking, atau asesmen. Nonaktifkan akun jika masih perlu menyimpan riwayatnya." });
      }

      res.json({ message: "User berhasil dihapus" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Admin assessment management
  app.get('/api/admin/assessments', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const allUserAssessments = await storage.getAllUserAssessments();
      res.json(allUserAssessments);
    } catch (error) {
      console.error("Error fetching all assessments:", error);
      res.status(500).json({ message: "Failed to fetch assessments" });
    }
  });

  // Admin view specific assessment result
  app.get('/api/admin/assessments/:id/result', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userAssessmentId = parseInt(req.params.id);
      const allUserAssessments = await storage.getAllUserAssessments();
      const userAssessment = allUserAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment) {
        return res.status(404).json({ message: "Assessment not found" });
      }

      res.json(userAssessment);
    } catch (error) {
      console.error("Error fetching assessment result:", error);
      res.status(500).json({ message: "Failed to fetch assessment result" });
    }
  });

  // Admin download PDF for specific assessment
  app.get('/api/admin/assessments/:id/pdf', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userAssessmentId = parseInt(req.params.id);
      const allUserAssessments = await storage.getAllUserAssessments();
      const userAssessment = allUserAssessments.find(ua => ua.id === userAssessmentId);
      
      if (!userAssessment || userAssessment.status !== 'completed') {
        return res.status(404).json({ message: "Assessment not found or not completed" });
      }

      // Generate PDF content
      const pdfBuffer = await generatePdfContent(userAssessment);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Admin_Hasil_${userAssessment.assessment.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(pdfBuffer);
    } catch (error) {
      console.error("Error generating admin PDF:", error);
      res.status(500).json({ message: "Failed to generate PDF" });
    }
  });

  // Midtrans payment routes

  // Midtrans Payment Routes
  app.post('/api/midtrans/create-transaction', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, amount, customerDetails, itemDetails } = req.body;
      
      console.log('💳 Creating Midtrans transaction with data:', {
        orderId,
        amount,
        customerDetails,
        itemCount: itemDetails?.length || 0,
        environment: process.env.NODE_ENV,
        domain: req.get('host'),
        userAgent: req.get('User-Agent')
      });

      // Validate required fields
      if (!orderId || !amount || !customerDetails || !itemDetails) {
        console.error('❌ Missing required fields:', { orderId, amount, customerDetails, itemDetails });
        return res.status(400).json({ 
          error: 'Missing required fields: orderId, amount, customerDetails, itemDetails' 
        });
      }

      if (!customerDetails.first_name || !customerDetails.email) {
        console.error('❌ Invalid customer details:', customerDetails);
        return res.status(400).json({ 
          error: 'Customer details must include first_name and email' 
        });
      }

      // Create Midtrans transaction
      const transaction = await createMidtransTransaction({
        orderId,
        amount,
        customerDetails,
        itemDetails
      });

      console.log('✅ Midtrans transaction created successfully:', {
        orderId,
        hasToken: !!transaction.token,
        hasRedirectUrl: !!transaction.redirect_url,
        tokenPrefix: transaction.token?.substring(0, 20) + '...'
      });

      // CRITICAL FIX: Save payment_id to database for auto-sync functionality
      try {
        const numericOrderId = parseInt(orderId.replace(/^order_/, '').replace(/_\d+$/, ''));
        console.log(`📝 Saving payment_id ${orderId} for order ${numericOrderId}`);
        
        await storage.updateOrderStatus(numericOrderId, 'pending', orderId, 'pending');
        console.log(`✅ Payment ID saved successfully for order ${numericOrderId}`);
      } catch (paymentIdSaveError) {
        console.error('❌ Failed to save payment_id to database:', paymentIdSaveError);
        // Continue anyway - transaction was created successfully
      }

      res.json(transaction);
    } catch (error: any) {
      console.error('❌ Error creating Midtrans transaction:', {
        message: error.message,
        stack: error.stack,
        name: error.name,
        cause: error.cause
      });
      
      // Return more specific error message
      let errorMessage = 'Failed to create transaction';
      if (error.message) {
        errorMessage = error.message;
      } else if (typeof error === 'string') {
        errorMessage = error;
      }
      
      res.status(500).json({ error: errorMessage });
    }
  });

  app.post('/api/midtrans/webhook', async (req, res) => {
    try {
      console.log('🔔 Midtrans webhook received:', req.body);
      
      const notificationResult = await handleMidtransCallback(req, res);
      
      if (!notificationResult) {
        return res.status(400).json({ error: 'Invalid notification' });
      }

      const { orderId, status, amount } = notificationResult;
      console.log(`📝 Midtrans notification: orderId=${orderId}, status=${status}, amount=${amount}`);
      
      // Extract numeric order ID from Midtrans format (order_123_timestamp)
      const orderIdMatch = orderId.match(/order_(\d+)_/);
      const numericOrderId = orderIdMatch ? parseInt(orderIdMatch[1]) : parseInt(orderId);
      
      console.log(`🔄 Processing real-time sync for order ${numericOrderId} with status: ${status}`);
      
      // Update order status based on Midtrans notification (ALWAYS sync regardless of current status)
      if (status === 'paid') {
        const fulfillment = await fulfillPaidOrder(numericOrderId, orderId);
        console.log(`🎉 Midtrans: Order ${numericOrderId} completed successfully`, fulfillment);
      } else if (status === 'failed' || status === 'cancelled') {
        await storage.updateOrderStatus(numericOrderId, 'cancelled', orderId, status);
        await releasePhysicalOrderStock(numericOrderId);
        console.log(`❌ Midtrans: Order ${numericOrderId} ${status}`);
      } else if (status === 'pending') {
        await storage.updateOrderStatus(numericOrderId, 'pending', orderId, 'pending');
        console.log(`⏳ Midtrans: Order ${numericOrderId} pending`);
      } else {
        console.log(`⚠️ Midtrans: Unknown status ${status} for order ${numericOrderId}`);
      }

      res.json({ status: 'ok' });
    } catch (error) {
      console.error('❌ Error handling Midtrans webhook:', error);
      res.status(500).json({ error: 'Webhook processing failed' });
    }
  });

  app.get('/api/midtrans/status/:orderId', isAuthenticated, async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const status = await checkTransactionStatus(orderId);
      res.json(status);
    } catch (error) {
      console.error('Error checking Midtrans transaction status:', error);
      res.status(500).json({ error: 'Failed to check transaction status' });
    }
  });

  // Sync order status with Midtrans - manually check and update
  app.post('/api/midtrans/sync-status/:orderId', isAuthenticated, async (req, res) => {
    try {
      const numericOrderId = parseInt(req.params.orderId);
      const order = await storage.getOrder(numericOrderId);
      
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }

      // Try different possible Midtrans order ID formats
      const baseTimestamp = Math.round(new Date(order.createdAt!).getTime() / 1000);
      const possibleOrderIds = [
        order.paymentId || '',                          // Use existing payment_id if available
        `order_${numericOrderId}_${baseTimestamp}511`,  // Order 211 specific format
        `order_${numericOrderId}_${baseTimestamp}795`,  // Millisecond variation
        `order_${numericOrderId}_${baseTimestamp}`,     // Standard format
        `order_${numericOrderId}_1753458173795`,        // Known working format for 210
        `order_${numericOrderId}_1753460559511`,        // Known working format for 211
        `order_${numericOrderId}_1753461365435`,        // Known working format for 212
      ].filter(id => id.length > 0);
      
      let midtransStatus: any = null;
      let workingOrderId: string = '';
      
      // Try each possible order ID format until one works
      for (const orderId of possibleOrderIds) {
        try {
          console.log(`🔍 Trying order ID: ${orderId}`);
          midtransStatus = await checkTransactionStatus(orderId);
          workingOrderId = orderId;
          console.log(`✅ Found working order ID: ${workingOrderId}`);
          break;
        } catch (error) {
          console.log(`❌ Failed with order ID: ${orderId}`, (error as Error).message);
          continue;
        }
      }
      
      if (!midtransStatus || !workingOrderId) {
        return res.status(404).json({ 
          error: 'Transaction not found in Midtrans',
          triedOrderIds: possibleOrderIds
        });
      }
      
      console.log(`🔄 Syncing order ${numericOrderId} with Midtrans...`);
      console.log(`   Working Midtrans Order ID: ${workingOrderId}`);
      console.log(`   Current Midtrans status:`, midtransStatus);
      
      // Convert Midtrans status to our system status
      const paymentStatus = getMidtransPaymentStatus(
        midtransStatus.transaction_status,
        midtransStatus.fraud_status
      );
      
      console.log(`   Converted payment status: ${paymentStatus}`);
      
      // Update order status if different
      let updatedStatus = order.status;
      if (paymentStatus === 'paid' && order.status !== 'completed') {
        updatedStatus = 'completed';
        await fulfillPaidOrder(numericOrderId, workingOrderId);
        
        console.log(`✅ Order ${numericOrderId} updated to completed`);
      } else if ((paymentStatus === 'failed' || paymentStatus === 'cancelled') && order.status === 'pending') {
        updatedStatus = 'cancelled';
        await storage.updateOrderStatus(numericOrderId, 'cancelled', workingOrderId, paymentStatus);
        console.log(`❌ Order ${numericOrderId} updated to cancelled (payment status: ${paymentStatus})`);
      }
      
      res.json({
        orderId: numericOrderId,
        previousStatus: order.status,
        currentStatus: updatedStatus,
        paymentStatus: paymentStatus,
        midtransStatus: midtransStatus.transaction_status,
        synced: updatedStatus !== order.status
      });
      
    } catch (error) {
      console.error('❌ Error syncing order status:', error);
      res.status(500).json({ error: 'Failed to sync order status' });
    }
  });

  // Simulate Midtrans payment completion (for testing) - no auth required for auto-completion
  app.post('/api/midtrans/simulate-payment/:orderId', async (req: any, res: any) => {
    try {
      const orderId = parseInt(req.params.orderId);
      
      console.log(`🧪 Auto-completing Midtrans payment for order ${orderId} - bypass mode enabled`);
      
      // Get order details
      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ error: 'Order not found' });
      }
      
      // Check if assessments exist for completed orders
      let assessmentsCreated = 0;
      if (order.status === 'completed' && order.paymentStatus === 'paid') {
        console.log(`Order ${orderId} already completed, checking for missing assessments...`);
        const fulfillment = await fulfillPaidOrder(orderId, order.paymentId || `midtrans_sim_${orderId}`);
        assessmentsCreated += fulfillment.assessmentsCreated;
        
        // Create user assessments if they don't exist for this specific order
        if (order.orderItems) {
          for (const item of order.orderItems) {
            if (isExternalAssessmentType(item.assessment.type)) continue;
            // Check if assessment exists for THIS SPECIFIC ORDER (not just user+assessment combo)
            const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, orderId);
            if (!existingAssessment) {
              await storage.createUserAssessment({
                userId: order.userId,
                assessmentId: item.assessmentId,
                orderId: orderId,
                status: 'available' as const
              });
              assessmentsCreated++;
              console.log(`📚 Created missing assessment ${item.assessmentId} for completed order ${orderId}`);
            } else {
              console.log(`⚠️ Assessment ${item.assessmentId} already exists for order ${orderId}`);
            }
          }
        }
        
        if (assessmentsCreated > 0) {
          return res.json({ 
            message: 'Missing assessments created for completed order',
            orderId,
            status: 'completed',
            assessmentsCreated
          });
        } else {
          return res.json({ 
            message: 'Order already completed and all assessments exist',
            orderId,
            status: 'completed'
          });
        }
      }
      
      const fulfillment = await fulfillPaidOrder(orderId, `midtrans_sim_${orderId}`);
      assessmentsCreated += fulfillment.assessmentsCreated;
      console.log(`✅ Order ${orderId} status updated to completed via Midtrans simulation`);
      
      res.json({ 
        message: 'Midtrans payment simulated successfully',
        orderId,
        status: 'completed',
        assessmentsCreated,
        bookingUpdated: fulfillment.bookingUpdated,
      });
    } catch (error: any) {
      console.error('❌ Error simulating Midtrans payment:', error);
      res.status(500).json({ error: error.message || 'Failed to simulate payment' });
    }
  });
  
  // Admin simulation endpoints for Midtrans

  // Payment success/failure pages endpoints
  app.get('/api/payment-status/:orderId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const orderId = parseInt(req.params.orderId);
      
      const order = await storage.getOrder(orderId);
      if (!order || order.userId !== userId) {
        return res.status(404).json({ message: "Order not found" });
      }

      const digitalItems = order.orderItems?.length ? [] : (await pool.query(
        `SELECT product_id AS "productId", product_name AS "productName", price FROM digital_order_items WHERE order_id = $1 ORDER BY id`,
        [orderId],
      )).rows;

      res.json({
        orderId: order.id,
        status: order.status,
        paymentStatus: order.paymentStatus,
        paymentMethod: order.paymentMethod,
        totalAmount: order.totalAmount,
        paidAt: order.paidAt,
        items: order.orderItems?.map(item => ({
          assessmentName: item.assessment.name,
          price: item.price
        })),
        digitalItems,
      });
    } catch (error) {
      console.error("Error getting payment status:", error);
      res.status(500).json({ message: "Failed to get payment status" });
    }
  });

  // Real-time sync trigger endpoint
  app.post('/api/sync/trigger', async (req, res) => {
    try {
      console.log('🔄 Manual sync trigger requested');
      
      // Import auto-sync function
      const { autoSyncOrders } = await import('../auto-sync');
      await autoSyncOrders();
      
      res.json({ 
        success: true, 
        message: 'Sync completed',
        timestamp: new Date().toISOString()
      });
    } catch (error: any) {
      console.error('❌ Manual sync failed:', error);
      res.status(500).json({ 
        success: false, 
        error: 'Sync failed',
        message: error.message 
      });
    }
  });

  // CMS Services endpoints - proxy to Payload CMS
  const getCmsBaseUrl = () => {
    if (process.env.REPLIT_DEV_DOMAIN) {
      return `https://${process.env.REPLIT_DEV_DOMAIN}`;
    }
    return process.env.PAYLOAD_PUBLIC_SERVER_URL || 'http://localhost:3000';
  };

  app.get('/api/cms/services', async (req, res) => {
    try {
      const baseUrl = getCmsBaseUrl();
      const url = `${baseUrl}/admin/api/services?where[status][equals]=active&sort=orderIndex&limit=100&depth=1`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: 'Failed to fetch services from CMS' });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching CMS services:', error);
      res.status(500).json({ message: 'Failed to fetch services' });
    }
  });

  app.get('/api/cms/services/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const baseUrl = getCmsBaseUrl();
      const url = `${baseUrl}/admin/api/services?where[slug][equals]=${encodeURIComponent(slug)}&where[status][equals]=active&depth=1`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: 'Failed to fetch service from CMS' });
      }
      const data = await response.json();
      if (!data.docs || data.docs.length === 0) {
        return res.status(404).json({ message: 'Service not found' });
      }
      res.json(data.docs[0]);
    } catch (error) {
      console.error('Error fetching CMS service by slug:', error);
      res.status(500).json({ message: 'Failed to fetch service' });
    }
  });

  app.get('/api/cms/posts', async (req, res) => {
    try {
      const baseUrl = getCmsBaseUrl();
      const url = `${baseUrl}/admin/api/posts?where[status][equals]=published&sort=-publishedAt&limit=100&depth=1`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: 'Failed to fetch posts from CMS' });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching CMS posts:', error);
      res.status(500).json({ message: 'Failed to fetch posts' });
    }
  });

  app.get('/api/cms/posts/:slug', async (req, res) => {
    try {
      const { slug } = req.params;
      const baseUrl = getCmsBaseUrl();
      const url = `${baseUrl}/admin/api/posts?where[slug][equals]=${encodeURIComponent(slug)}&where[status][equals]=published&depth=1`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: 'Failed to fetch post from CMS' });
      }
      const data = await response.json();
      if (!data.docs || data.docs.length === 0) {
        return res.status(404).json({ message: 'Post not found' });
      }
      res.json(data.docs[0]);
    } catch (error) {
      console.error('Error fetching CMS post by slug:', error);
      res.status(500).json({ message: 'Failed to fetch post' });
    }
  });

  app.get('/api/cms/team-members', async (req, res) => {
    try {
      const baseUrl = getCmsBaseUrl();
      const url = `${baseUrl}/admin/api/team-members?where[isActive][equals]=true&sort=orderIndex&limit=100&depth=1`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(response.status).json({ message: 'Failed to fetch team members from CMS' });
      }
      const data = await response.json();
      res.json(data);
    } catch (error) {
      console.error('Error fetching CMS team members:', error);
      res.status(500).json({ message: 'Failed to fetch team members' });
    }
  });

  app.get('/api/cms/team-members/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const baseUrl = getCmsBaseUrl();
      const url = `${baseUrl}/admin/api/team-members/${encodeURIComponent(id)}?depth=1`;
      const response = await fetch(url);
      if (!response.ok) {
        return res.status(404).json({ message: 'Team member not found' });
      }
      const data = await response.json();
      if (!data.isActive) {
        return res.status(404).json({ message: 'Team member not found' });
      }
      res.json(data);
    } catch (error) {
      console.error('Error fetching CMS team member:', error);
      res.status(500).json({ message: 'Failed to fetch team member' });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function initializeAssessments() {
  try {
    console.log("Initializing assessments...");
    const existingAssessments = await storage.getAssessments();
    
    if (existingAssessments.length === 0) {
      console.log("Creating default assessments...");
      // Create default assessments
      await storage.createAssessment({
        name: "Asesmen Profil Sensori",
        description: "Tes pola respon anak dan dewasa terhadap rangsangan sensorik, yang berkaitan dengan cara belajar dan cara hidup. Follow-up bersama psikolog klinis ternama bersama tim.",
        price: "200000",
        duration: "30-45 menit",
        ageRange: "Usia 3-65+",
        type: "sensory",
        isActive: true,
      });

      await storage.createAssessment({
        name: "Inventori Gaya Belajar",
        description: "Mengenali cara belajar pribadi dan pendekatan pendidikan yang optimal. Mengukur moda belajar visual, auditori, kinestetik, dan baca/tulis.",
        price: "0.00",
        duration: "20-30 menit",
        ageRange: "Usia 12+",
        type: "learning",
        isActive: true,
      });

      console.log("Asesmen default berhasil dibuat");
    } else {
      console.log(`Found ${existingAssessments.length} existing assessments`);
    }

    const sensoryAssessment = existingAssessments.find((assessment) => assessment.type === "sensory");
    if (sensoryAssessment && Number(sensoryAssessment.price) !== 200000) {
      await storage.updateAssessment(sensoryAssessment.id, { price: "200000" });
      console.log("Harga Asesmen Profil Sensori diperbarui menjadi Rp200.000");
    }

    const mentalHealthAssessment = existingAssessments.find((assessment) => assessment.type === "mental-health");
    if (!mentalHealthAssessment) {
      await storage.createAssessment({
        name: "Mental Health Check Up",
        description: "Skrining kecemasan, stress, depresi, burnout",
        price: "0.00",
        duration: "10-15 menit",
        ageRange: "Usia 17+",
        type: "mental-health",
        isActive: true,
      });
      console.log("Mental Health Check Up berhasil dibuat dengan free access sementara");
    }

    let externalMentalHealthAssessment = existingAssessments.find((assessment) => assessment.type === "external-mental-health");
    if (!externalMentalHealthAssessment) {
      externalMentalHealthAssessment = await storage.createAssessment({
        name: "Mental Health Check Up",
        description: "Skrining kecemasan, stress, depresi, burnout",
        price: "129000",
        duration: "Sesuai ketentuan pengerjaan",
        ageRange: "Dewasa",
        type: "external-mental-health",
        isActive: true,
      });
      console.log("Produk eksternal Mental Health Check Up berhasil dibuat");
    } else if (Number(externalMentalHealthAssessment.price) !== 129000) {
      await storage.updateAssessment(externalMentalHealthAssessment.id, { price: "129000", isActive: true });
    }
    await pool.query(
      `INSERT INTO external_assessment_configs (assessment_id, original_price)
       VALUES ($1, 200000) ON CONFLICT (assessment_id) DO NOTHING`,
      [externalMentalHealthAssessment.id],
    );

    let externalStudentPotentialAssessment = existingAssessments.find((assessment) => assessment.type === "external-student-potential");
    if (!externalStudentPotentialAssessment) {
      externalStudentPotentialAssessment = await storage.createAssessment({
        name: "Paket Tes Intelegensi & Potensi Siswa (SMA)",
        description: "Tes IQ, EQ, gambaran kepribadian dan jurusan serta saran aktivitas yang sesuai.",
        price: "190000",
        duration: "Sesuai ketentuan pengerjaan",
        ageRange: "Siswa SMA / sederajat",
        type: "external-student-potential",
        isActive: true,
      });
      console.log("Produk eksternal Paket Tes Intelegensi & Potensi Siswa (SMA) berhasil dibuat");
    } else if (Number(externalStudentPotentialAssessment.price) !== 190000) {
      await storage.updateAssessment(externalStudentPotentialAssessment.id, { price: "190000", isActive: true });
    }
    await pool.query(
      `INSERT INTO external_assessment_configs (assessment_id, original_price)
       VALUES ($1, 350000) ON CONFLICT (assessment_id) DO NOTHING`,
      [externalStudentPotentialAssessment.id],
    );

    const studentPotentialAssessment = existingAssessments.find((assessment) => assessment.type === "student-potential");
    if (!studentPotentialAssessment) {
      await storage.createAssessment({
        name: "Paket Tes Intelegensi & Potensi Siswa (SMA)",
        description: "Tes IQ, EQ, gambaran kepribadian dan jurusan serta saran aktivitas yang sesuai.",
        price: "0.00",
        duration: "35-45 menit",
        ageRange: "Siswa SMA / sederajat",
        type: "student-potential",
        isActive: true,
      });
      console.log("Paket Tes Intelegensi & Potensi Siswa berhasil dibuat dengan free access sementara");
    }

    let externalCareerPotentialAssessment = existingAssessments.find((assessment) => assessment.type === "external-career-potential");
    if (!externalCareerPotentialAssessment) {
      externalCareerPotentialAssessment = await storage.createAssessment({
        name: "Tes Potensi Karir (Perusahaan)",
        description: "Promosi jabatan, pengembangan karyawan, evaluasi kinerja, dan rekrutmen karyawan",
        price: "450000",
        duration: "Sesuai ketentuan pengerjaan",
        ageRange: "Karyawan & kandidat kerja",
        type: "external-career-potential",
        isActive: true,
      });
      console.log("Produk eksternal Tes Potensi Karir (Perusahaan) berhasil dibuat");
    } else if (Number(externalCareerPotentialAssessment.price) !== 450000) {
      await storage.updateAssessment(externalCareerPotentialAssessment.id, { price: "450000", isActive: true });
    }
    await pool.query(
      `INSERT INTO external_assessment_configs (assessment_id, original_price)
       VALUES ($1, 600000) ON CONFLICT (assessment_id) DO NOTHING`,
      [externalCareerPotentialAssessment.id],
    );

    const careerPotentialAssessment = existingAssessments.find((assessment) => assessment.type === "career-potential");
    if (!careerPotentialAssessment) {
      await storage.createAssessment({
        name: "Tes Potensi Karir (Perusahaan)",
        description: "Promosi jabatan, pengembangan karyawan, evaluasi kinerja, dan rekrutmen karyawan",
        price: "0.00",
        duration: "40-50 menit",
        ageRange: "Karyawan & kandidat kerja",
        type: "career-potential",
        isActive: true,
      });
      console.log("Tes Potensi Karir (Perusahaan) berhasil dibuat dengan free access sementara");
    }
  } catch (error) {
    console.error("Error initializing assessments:", error);
    throw error; // Re-throw to prevent silent failures
  }
}

async function initializeBookingServices() {
  try {
    console.log("Initializing booking services...");
    const existingServices = await storage.getBookingServices();

    if (existingServices.length === 0) {
      await storage.createBookingService({
        name: "Konsultasi Psikolog",
        description: "Sesi konsultasi bersama psikolog untuk membahas kebutuhan pribadi, keluarga, pendidikan, atau tindak lanjut asesmen. Tim akan mengonfirmasi jadwal final melalui WhatsApp setelah pembayaran.",
        price: "350000",
        duration: "60 menit",
        isActive: true,
      });
      console.log("Default psychologist booking service created");
    } else {
      console.log(`Found ${existingServices.length} existing booking services`);
    }
  } catch (error) {
    console.error("Error initializing booking services:", error);
    throw error;
  }
}

async function ensureDefaultAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL || (process.env.NODE_ENV !== "production" ? "admin@rppi.local" : "");
  const adminPassword = process.env.ADMIN_PASSWORD || (process.env.NODE_ENV !== "production" ? "Admin12345!" : "");

  if (!adminEmail || !adminPassword) {
    return;
  }

  const existingUser = await storage.getUserByEmail(adminEmail);
  if (existingUser) {
    if (existingUser.role !== "admin" || !existingUser.isActive) {
      await storage.updateUser(existingUser.id, {
        role: "admin",
        isActive: true,
        isEmailVerified: true,
      });
    }
    return;
  }

  const hashedPassword = await AuthUtils.hashPassword(adminPassword);
  await storage.createUser({
    id: AuthUtils.generateUserId(),
    email: adminEmail,
    password: hashedPassword,
    firstName: "Admin",
    lastName: "RPPI",
    authProvider: "custom",
    role: "admin",
    isActive: true,
    isEmailVerified: true,
  });

  console.log(`👤 Default admin user ready: ${adminEmail}`);
}
