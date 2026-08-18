import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "../storage";
import { getSession } from "../replitAuth";
import type { UserAssessmentWithDetails } from "@workspace/db";
import { insertOrderSchema, insertOrderItemSchema, insertUserAssessmentSchema, registerSchema, loginSchema, otpVerificationSchema, adminLoginSchema, userUpdateSchema, passwordResetSchema } from "@workspace/db";
import { z } from "zod/v4";
import PDFDocument from "pdfkit";
import { randomBytes } from "crypto";
import { AuthUtils } from "../authUtils";
import { emailService } from "../emailService";
import path from "path";
import fs from "fs";
import express from "express";
import { pool } from "../db";
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
          eligibleOrders.set(booking.orderId, {
            orderId: booking.orderId,
            psychologistName: booking.psychologistName,
            preferredDate: booking.preferredDate,
            preferredTime: booking.preferredTime,
            completed: Boolean(screening),
            completedAt: screening?.completedAt ?? null,
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
      }>();

      bookings
        .filter((booking) => latestPaidBooking
          && booking.orderId === latestPaidBooking.orderId
          && isScreeningEligibleConsultation(booking))
        .forEach((booking) => {
          if (eligibleOrders.has(booking.orderId)) return;
          const screening = screeningByOrder.get(booking.orderId);
          eligibleOrders.set(booking.orderId, {
            orderId: booking.orderId,
            psychologistName: booking.psychologistName,
            preferredDate: booking.preferredDate,
            preferredTime: booking.preferredTime,
            completed: Boolean(screening),
            completedAt: screening?.completedAt ?? null,
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
      }] : [];

      if (itemDetails.length === 0) {
        return res.status(400).json({ message: "Order has no payable items" });
      }

      const transactionData = {
        orderId: midtransOrderId,
        amount: parseInt(order.totalAmount),
        expiryMinutes: PAYMENT_EXPIRY_MINUTES,
        customerDetails: {
          first_name: user.firstName || 'Customer',
          last_name: user.lastName || '',
          email: user.email,
          phone: user.whatsappNumber || ''
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

  app.get('/api/external-assessments/access', isAuthenticated, async (req: any, res) => {
    try {
      const result = await pool.query(
        `SELECT o.id AS "orderId", o.status AS "orderStatus", o.payment_status AS "paymentStatus",
                a.id AS "assessmentId", a.name AS "assessmentName", a.description,
                c.website_name AS "websiteName", c.website_url AS "websiteUrl",
                c.work_hours AS "workHours", c.result_eta_text AS "resultEtaText",
                c.instructions_pdf IS NOT NULL AS "hasInstructions", code.code AS token,
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
    const fileName = String(req.headers['x-file-name'] || 'ketentuan-pengerjaan.pdf').slice(0, 255);
    await pool.query('UPDATE external_assessment_configs SET instructions_pdf = $2, instructions_file_name = $3, updated_at = now() WHERE assessment_id = $1', [Number(req.params.assessmentId), req.body, fileName]);
    res.json({ message: 'PDF ketentuan berhasil diunggah' });
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
        }))
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
