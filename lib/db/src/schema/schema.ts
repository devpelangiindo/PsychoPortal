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
  profileImageUrl: varchar("profile_image_url"),
  isEmailVerified: boolean("is_email_verified").default(false),
  authProvider: varchar("auth_provider").default("custom"), // 'replit' or 'custom'
  role: varchar("role").default("user"), // 'user', 'admin', 'internal'
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
}));

export const ordersRelations = relations(orders, ({ one, many }) => ({
  user: one(users, {
    fields: [orders.userId],
    references: [users.id],
  }),
  orderItems: many(orderItems),
  userAssessments: many(userAssessments),
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
  role: z.enum(["user", "admin", "internal"]).optional(),
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

// ========================
// CMS Tables
// ========================

export const cmsPages = pgTable("cms_pages", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  content: text("content"),
  excerpt: text("excerpt"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  metaTitle: varchar("meta_title", { length: 255 }),
  metaDescription: text("meta_description"),
  featuredImage: varchar("featured_image", { length: 500 }),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cmsPosts = pgTable("cms_posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  content: text("content"),
  excerpt: text("excerpt"),
  category: varchar("category", { length: 100 }),
  tags: text("tags"),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  featuredImage: varchar("featured_image", { length: 500 }),
  author: varchar("author", { length: 100 }),
  publishedAt: timestamp("published_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cmsTeamMembers = pgTable("cms_team_members", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  role: varchar("role", { length: 255 }).notNull(),
  bio: text("bio"),
  photo: varchar("photo", { length: 500 }),
  email: varchar("email", { length: 255 }),
  linkedIn: varchar("linked_in", { length: 500 }),
  orderIndex: integer("order_index").default(0),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const cmsServices = pgTable("cms_services", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  description: text("description"),
  shortDescription: text("short_description"),
  icon: varchar("icon", { length: 100 }),
  featuredImage: varchar("featured_image", { length: 500 }),
  price: varchar("price", { length: 100 }),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  orderIndex: integer("order_index").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCmsPageSchema = createInsertSchema(cmsPages).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCmsPage = z.infer<typeof insertCmsPageSchema>;
export type CmsPage = typeof cmsPages.$inferSelect;

export const insertCmsPostSchema = createInsertSchema(cmsPosts).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCmsPost = z.infer<typeof insertCmsPostSchema>;
export type CmsPost = typeof cmsPosts.$inferSelect;

export const insertCmsTeamMemberSchema = createInsertSchema(cmsTeamMembers).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCmsTeamMember = z.infer<typeof insertCmsTeamMemberSchema>;
export type CmsTeamMember = typeof cmsTeamMembers.$inferSelect;

export const insertCmsServiceSchema = createInsertSchema(cmsServices).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCmsService = z.infer<typeof insertCmsServiceSchema>;
export type CmsService = typeof cmsServices.$inferSelect;

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
