import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  serial,
  decimal,
  integer,
  boolean,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Session storage table (required for Replit Auth)
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table (supports both Replit Auth and custom auth)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  password: varchar("password"), // For custom auth (hashed)
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  whatsappNumber: varchar("whatsapp_number"),
  psychologistProfileName: varchar("psychologist_profile_name", { length: 255 }),
  profileImageUrl: varchar("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  authProvider: varchar("auth_provider").default("custom"), // 'replit' or 'custom'
  role: varchar("role").default("user"), // 'user', 'admin', 'internal', 'psychologist'
  isActive: boolean("is_active").default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// OTP verification table
export const otpVerifications = pgTable("otp_verifications", {
  id: serial("id").primaryKey(),
  email: varchar("email").notNull(),
  otp: varchar("otp", { length: 6 }).notNull(),
  purpose: varchar("purpose").notNull(), // 'email_verification', 'password_reset'
  expiresAt: timestamp("expires_at").notNull(),
  used: boolean("used").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Assessment products
export const assessments = pgTable("assessments", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: varchar("duration", { length: 50 }).notNull(),
  ageRange: varchar("age_range", { length: 50 }).notNull(),
  type: varchar("type", { length: 100 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Psychologist booking service catalog
export const bookingServices = pgTable("booking_services", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  duration: varchar("duration", { length: 50 }).notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// User orders
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  paymentId: varchar("payment_id"),
  paymentStatus: varchar("payment_status", { length: 50 }).default("pending"),
  paymentMethod: varchar("payment_method", { length: 50 }),
  // Using Midtrans payment gateway
  paidAt: timestamp("paid_at"),
  paidAmount: decimal("paid_amount", { precision: 10, scale: 2 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Psychologist appointment bookings
export const psychologistBookings = pgTable("psychologist_bookings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  serviceId: integer("service_id").notNull().references(() => bookingServices.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  clientName: varchar("client_name", { length: 255 }).notNull(),
  birthDate: varchar("birth_date", { length: 20 }),
  email: varchar("email", { length: 255 }).notNull(),
  whatsappNumber: varchar("whatsapp_number", { length: 50 }).notNull(),
  mainConcern: text("main_concern"),
  concernHistory: text("concern_history"),
  consultationType: varchar("consultation_type", { length: 50 }),
  childName: varchar("child_name", { length: 255 }),
  childBirthDate: varchar("child_birth_date", { length: 20 }),
  previousDiagnosis: text("previous_diagnosis"),
  preferredDate: varchar("preferred_date", { length: 20 }).notNull(),
  preferredTime: varchar("preferred_time", { length: 20 }).notNull(),
  psychologistName: varchar("psychologist_name", { length: 255 }),
  psychologistFee: decimal("psychologist_fee", { precision: 10, scale: 2 }),
  location: varchar("location", { length: 50 }),
  status: varchar("status", { length: 50 }).notNull().default("pending_payment"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Order items
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// User assessment access
export const userAssessments = pgTable("user_assessments", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  assessmentId: integer("assessment_id").notNull().references(() => assessments.id),
  orderId: integer("order_id").notNull().references(() => orders.id),
  status: varchar("status", { length: 50 }).notNull().default("available"), // available, in_progress, completed
  results: jsonb("results"),
  completedAt: timestamp("completed_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  orders: many(orders),
  userAssessments: many(userAssessments),
  psychologistBookings: many(psychologistBookings),
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  orderItems: many(orderItems),
  userAssessments: many(userAssessments),
  psychologistBookings: many(psychologistBookings),
}));

export const bookingServicesRelations = relations(bookingServices, ({ many }) => ({
  psychologistBookings: many(psychologistBookings),
}));

export const psychologistBookingsRelations = relations(psychologistBookings, ({ one }) => ({
  user: one(users, {
    fields: [psychologistBookings.userId],
    references: [users.id],
  }),
  service: one(bookingServices, {
    fields: [psychologistBookings.serviceId],
    references: [bookingServices.id],
  }),
  order: one(orders, {
    fields: [psychologistBookings.orderId],
    references: [orders.id],
  }),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  assessment: one(assessments, {
    fields: [orderItems.assessmentId],
    references: [assessments.id],
  }),
}));

export const assessmentsRelations = relations(assessments, ({ many }) => ({
  orderItems: many(orderItems),
  userAssessments: many(userAssessments),
}));

export const userAssessmentsRelations = relations(userAssessments, ({ one }) => ({
  user: one(users, {
    fields: [userAssessments.userId],
    references: [users.id],
  }),
  assessment: one(assessments, {
    fields: [userAssessments.assessmentId],
    references: [assessments.id],
  }),
  order: one(orders, {
    fields: [userAssessments.orderId],
    references: [orders.id],
  }),
}));

// Insert schemas
export const insertUserSchema = createInsertSchema(users);
export const insertAssessmentSchema = createInsertSchema(assessments);
export const insertBookingServiceSchema = createInsertSchema(bookingServices);
export const insertPsychologistBookingSchema = createInsertSchema(psychologistBookings);
export const insertOrderSchema = createInsertSchema(orders);
export const insertOrderItemSchema = createInsertSchema(orderItems);
export const insertUserAssessmentSchema = createInsertSchema(userAssessments);
export const insertOtpVerificationSchema = createInsertSchema(otpVerifications);

// Custom validation schemas
export const registerSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
  confirmPassword: z.string().min(8, "Konfirmasi password minimal 8 karakter"),
  firstName: z.string().min(1, "Nama depan wajib diisi"),
  lastName: z.string().min(1, "Nama belakang wajib diisi"),
  whatsappNumber: z.string().min(10, "Nomor WhatsApp tidak valid"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Konfirmasi password tidak sesuai",
  path: ["confirmPassword"],
});

export const loginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(1, "Password wajib diisi"),
});

export const otpVerificationSchema = z.object({
  email: z.string().email("Email tidak valid"),
  otp: z.string().length(6, "OTP harus 6 digit"),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email("Email tidak valid"),
});

export const adminLoginSchema = z.object({
  email: z.string().email("Email tidak valid"),
  password: z.string().min(6, "Password minimal 6 karakter"),
});

export const userUpdateSchema = z.object({
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  whatsappNumber: z.string().optional(),
  isActive: z.boolean().optional(),
  role: z.enum(["user", "admin", "internal", "psychologist"]).optional(),
  psychologistProfileName: z.string().optional().nullable(),
});

export const passwordResetSchema = z.object({
  userId: z.string(),
  newPassword: z.string().min(6, "Password minimal 6 karakter"),
});

// Types
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type OtpVerification = typeof otpVerifications.$inferSelect;
export type InsertOtpVerification = z.infer<typeof insertOtpVerificationSchema>;
export type Assessment = typeof assessments.$inferSelect;
export type InsertAssessment = z.infer<typeof insertAssessmentSchema>;
export type BookingService = typeof bookingServices.$inferSelect;
export type InsertBookingService = z.infer<typeof insertBookingServiceSchema>;
export type PsychologistBooking = typeof psychologistBookings.$inferSelect;
export type InsertPsychologistBooking = z.infer<typeof insertPsychologistBookingSchema>;
export type Order = typeof orders.$inferSelect;
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type OrderItem = typeof orderItems.$inferSelect;
export type InsertOrderItem = z.infer<typeof insertOrderItemSchema>;
export type UserAssessment = typeof userAssessments.$inferSelect;
export type InsertUserAssessment = z.infer<typeof insertUserAssessmentSchema>;

// Custom auth types
export type RegisterRequest = z.infer<typeof registerSchema>;
export type LoginRequest = z.infer<typeof loginSchema>;
export type OtpVerificationRequest = z.infer<typeof otpVerificationSchema>;
export type ForgotPasswordRequest = z.infer<typeof forgotPasswordSchema>;
export type AdminLoginRequest = z.infer<typeof adminLoginSchema>;
export type UserUpdateRequest = z.infer<typeof userUpdateSchema>;
export type PasswordResetRequest = z.infer<typeof passwordResetSchema>;

// Order with items type
export type OrderWithItems = Order & {
  orderItems: (OrderItem & {
    assessment: Assessment;
  })[];
};

// User assessment with assessment details
export type UserAssessmentWithDetails = UserAssessment & {
  assessment: Assessment;
  user?: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    whatsappNumber: string | null;
  };
};

export type PsychologistBookingWithDetails = PsychologistBooking & {
  service: BookingService;
  order: Order;
};
