import {
  users,
  assessments,
  bookingServices,
  psychologistAvailabilities,
  psychologistScheduleSlots,
  psychologistBookings,
  orders,
  orderItems,
  userAssessments,
  otpVerifications,
  type User,
  type UpsertUser,
  type Assessment,
  type InsertAssessment,
  type BookingService,
  type InsertBookingService,
  type PsychologistAvailability,
  type InsertPsychologistAvailability,
  type PsychologistScheduleSlot,
  type InsertPsychologistScheduleSlot,
  type PsychologistBooking,
  type InsertPsychologistBooking,
  type PsychologistBookingWithDetails,
  type Order,
  type InsertOrder,
  type OrderItem,
  type InsertOrderItem,
  type UserAssessment,
  type InsertUserAssessment,
  type OrderWithItems,
  type UserAssessmentWithDetails,
  type OtpVerification,
  type InsertOtpVerification,
} from "@workspace/db";
import { db } from "./db";
import { eq, and, or, sql, ilike, desc, gte, lte, inArray } from "drizzle-orm";

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;

  // Custom authentication operations
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: UpsertUser): Promise<User>;
  updateUserVerification(userId: string, isEmailVerified: boolean): Promise<void>;

  // OTP operations
  createOtpVerification(otp: InsertOtpVerification): Promise<OtpVerification>;
  getValidOtp(email: string, otp: string, purpose: string): Promise<OtpVerification | undefined>;
  markOtpAsUsed(id: number): Promise<void>;
  deleteExpiredOtps(): Promise<void>;

  // Assessment operations
  getAssessments(): Promise<Assessment[]>;
  getAssessment(id: number): Promise<Assessment | undefined>;
  createAssessment(assessment: InsertAssessment): Promise<Assessment>;

  // Psychologist booking operations
  getBookingServices(): Promise<BookingService[]>;
  getBookingService(id: number): Promise<BookingService | undefined>;
  createBookingService(service: InsertBookingService): Promise<BookingService>;
  getPsychologistAvailability(psychologistName: string): Promise<PsychologistAvailability[]>;
  setPsychologistAvailability(psychologistName: string, availability: Omit<InsertPsychologistAvailability, "psychologistName">[]): Promise<PsychologistAvailability[]>;
  getPsychologistScheduleSlots(psychologistName: string, startDate: string, endDate: string): Promise<PsychologistScheduleSlot[]>;
  setPsychologistScheduleSlots(psychologistName: string, slots: Omit<InsertPsychologistScheduleSlot, "psychologistName">[], updatedBy?: string): Promise<PsychologistScheduleSlot[]>;
  createPsychologistBooking(booking: InsertPsychologistBooking): Promise<PsychologistBooking>;
  getUserPsychologistBookings(userId: string): Promise<PsychologistBookingWithDetails[]>;
  getAllPsychologistBookings(): Promise<PsychologistBookingWithDetails[]>;
  searchPsychologistBookingReports(search?: string): Promise<PsychologistBookingWithDetails[]>;
  getPsychologistBookingsByProvider(psychologistName: string): Promise<PsychologistBookingWithDetails[]>;
  getPsychologistBooking(id: number): Promise<PsychologistBookingWithDetails | undefined>;
  getPsychologistBookingByOrder(orderId: number): Promise<PsychologistBookingWithDetails | undefined>;
  updatePsychologistBookingStatus(id: number, status: string): Promise<void>;
  updatePsychologistBookingReport(
    id: number,
    report: {
      meetingUrl?: string | null;
      sessionReport?: string | null;
      reportRecommendations?: string | null;
      clientReportNotes?: string | null;
      counselingHistoryNotes?: string | null;
      submit?: boolean;
    },
  ): Promise<void>;
  updatePsychologistBookingSchedule(
    id: number,
    schedule: {
      preferredDate?: string;
      preferredTime?: string;
      location?: string;
      meetingUrl?: string | null;
    },
  ): Promise<void>;

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<OrderWithItems | undefined>;
  getUserOrders(userId: string): Promise<OrderWithItems[]>;
  updateOrderStatus(id: number, status: string, paymentId?: string, paymentStatus?: string): Promise<void>;
  updateOrder(id: number, updates: Partial<Order>): Promise<void>;

  // Order item operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;

  // User assessment operations
  createUserAssessment(userAssessment: InsertUserAssessment): Promise<UserAssessment>;
  getUserAssessments(userId: string): Promise<UserAssessmentWithDetails[]>;
  getUserAssessment(userId: string, assessmentId: number): Promise<UserAssessmentWithDetails | undefined>;
  getUserAssessmentByOrder(userId: string, assessmentId: number, orderId: number): Promise<UserAssessmentWithDetails | undefined>;
  updateUserAssessmentStatus(id: number, status: string, results?: any): Promise<void>;

  // Admin operations
  getAllUsers(): Promise<User[]>;
  updateUser(userId: string, updates: Partial<User>): Promise<User>;
  resetUserPassword(userId: string, newPassword: string): Promise<void>;
  getAllUserAssessments(): Promise<UserAssessmentWithDetails[]>;
  getAssessmentStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    completedAssessments: number;
    inProgressAssessments: number;
    totalRevenue: number;
  }>;
  updateUserLastLogin(userId: string): Promise<void>;
  
  // Database access for auto-sync
  getDb(): any;
}

export class DatabaseStorage implements IStorage {
  // Database access for auto-sync
  getDb() {
    return db;
  }
  
  // User operations
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // Custom authentication operations
  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .returning();
    return user;
  }

  async updateUserVerification(userId: string, isEmailVerified: boolean): Promise<void> {
    await db
      .update(users)
      .set({ isEmailVerified, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  // OTP operations
  async createOtpVerification(otpData: InsertOtpVerification): Promise<OtpVerification> {
    const [otp] = await db
      .insert(otpVerifications)
      .values(otpData)
      .returning();
    return otp;
  }

  async getValidOtp(email: string, otp: string, purpose: string): Promise<OtpVerification | undefined> {
    const [otpRecord] = await db
      .select()
      .from(otpVerifications)
      .where(
        and(
          eq(otpVerifications.email, email),
          eq(otpVerifications.otp, otp),
          eq(otpVerifications.purpose, purpose),
          eq(otpVerifications.used, false)
        )
      );
    
    if (!otpRecord || new Date() > otpRecord.expiresAt) {
      return undefined;
    }
    
    return otpRecord;
  }

  async markOtpAsUsed(id: number): Promise<void> {
    await db
      .update(otpVerifications)
      .set({ used: true })
      .where(eq(otpVerifications.id, id));
  }

  async deleteExpiredOtps(): Promise<void> {
    await db
      .delete(otpVerifications)
      .where(eq(otpVerifications.used, true));
  }

  // Assessment operations
  async getAssessments(): Promise<Assessment[]> {
    return await db.select().from(assessments).where(eq(assessments.isActive, true));
  }

  async getAssessment(id: number): Promise<Assessment | undefined> {
    const [assessment] = await db.select().from(assessments).where(eq(assessments.id, id));
    return assessment;
  }

  async createAssessment(assessment: InsertAssessment): Promise<Assessment> {
    const [newAssessment] = await db
      .insert(assessments)
      .values(assessment)
      .returning();
    return newAssessment;
  }

  // Psychologist booking operations
  async getBookingServices(): Promise<BookingService[]> {
    return await db.select().from(bookingServices).where(eq(bookingServices.isActive, true));
  }

  async getBookingService(id: number): Promise<BookingService | undefined> {
    const [service] = await db.select().from(bookingServices).where(eq(bookingServices.id, id));
    return service;
  }

  async createBookingService(service: InsertBookingService): Promise<BookingService> {
    const [newService] = await db.insert(bookingServices).values(service).returning();
    return newService;
  }

  async getPsychologistAvailability(psychologistName: string): Promise<PsychologistAvailability[]> {
    return await db
      .select()
      .from(psychologistAvailabilities)
      .where(eq(psychologistAvailabilities.psychologistName, psychologistName))
      .orderBy(psychologistAvailabilities.dayOfWeek, psychologistAvailabilities.timeSlot);
  }

  async setPsychologistAvailability(
    psychologistName: string,
    availability: Omit<InsertPsychologistAvailability, "psychologistName">[],
  ): Promise<PsychologistAvailability[]> {
    if (availability.length === 0) {
      return this.getPsychologistAvailability(psychologistName);
    }

    await db
      .insert(psychologistAvailabilities)
      .values(
        availability.map((slot) => ({
          psychologistName,
          dayOfWeek: slot.dayOfWeek,
          timeSlot: slot.timeSlot,
          isAvailable: slot.isAvailable,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [
          psychologistAvailabilities.psychologistName,
          psychologistAvailabilities.dayOfWeek,
          psychologistAvailabilities.timeSlot,
        ],
        set: {
          isAvailable: sql`excluded.is_available`,
          updatedAt: new Date(),
        },
      });

    return this.getPsychologistAvailability(psychologistName);
  }

  async getPsychologistScheduleSlots(
    psychologistName: string,
    startDate: string,
    endDate: string,
  ): Promise<PsychologistScheduleSlot[]> {
    return await db
      .select()
      .from(psychologistScheduleSlots)
      .where(and(
        eq(psychologistScheduleSlots.psychologistName, psychologistName),
        gte(psychologistScheduleSlots.scheduleDate, startDate),
        lte(psychologistScheduleSlots.scheduleDate, endDate),
      ))
      .orderBy(psychologistScheduleSlots.scheduleDate, psychologistScheduleSlots.timeSlot);
  }

  async setPsychologistScheduleSlots(
    psychologistName: string,
    slots: Omit<InsertPsychologistScheduleSlot, "psychologistName">[],
    updatedBy?: string,
  ): Promise<PsychologistScheduleSlot[]> {
    if (slots.length === 0) {
      const today = new Date().toISOString().slice(0, 10);
      const maxDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
      return this.getPsychologistScheduleSlots(psychologistName, today, maxDate);
    }

    const dates = Array.from(new Set(slots.map((slot) => slot.scheduleDate))).sort();
    await db
      .delete(psychologistScheduleSlots)
      .where(and(
        eq(psychologistScheduleSlots.psychologistName, psychologistName),
        inArray(psychologistScheduleSlots.scheduleDate, dates),
      ));

    await db
      .insert(psychologistScheduleSlots)
      .values(
        slots.map((slot) => ({
          psychologistName,
          scheduleDate: slot.scheduleDate,
          timeSlot: slot.timeSlot,
          location: slot.location || "online",
          isAvailable: slot.isAvailable ?? true,
          isLocked: true,
          lockedAt: new Date(),
          updatedBy,
          updatedAt: new Date(),
        })),
      )
      .onConflictDoUpdate({
        target: [
          psychologistScheduleSlots.psychologistName,
          psychologistScheduleSlots.scheduleDate,
          psychologistScheduleSlots.timeSlot,
          psychologistScheduleSlots.location,
        ],
        set: {
          isAvailable: sql`excluded.is_available`,
          isLocked: true,
          lockedAt: new Date(),
          updatedBy,
          updatedAt: new Date(),
        },
      });

    return this.getPsychologistScheduleSlots(psychologistName, dates[0], dates[dates.length - 1]);
  }

  async createPsychologistBooking(booking: InsertPsychologistBooking): Promise<PsychologistBooking> {
    const [newBooking] = await db.insert(psychologistBookings).values(booking).returning();
    return newBooking;
  }

  async getUserPsychologistBookings(userId: string): Promise<PsychologistBookingWithDetails[]> {
    const results = await db
      .select({
        booking: psychologistBookings,
        service: bookingServices,
        order: orders,
      })
      .from(psychologistBookings)
      .innerJoin(bookingServices, eq(psychologistBookings.serviceId, bookingServices.id))
      .innerJoin(orders, eq(psychologistBookings.orderId, orders.id))
      .where(eq(psychologistBookings.userId, userId))
      .orderBy(psychologistBookings.createdAt);

    return results.map((row) => ({
      ...row.booking,
      service: row.service,
      order: row.order,
    }));
  }

  async getAllPsychologistBookings(): Promise<PsychologistBookingWithDetails[]> {
    const results = await db
      .select({
        booking: psychologistBookings,
        service: bookingServices,
        order: orders,
      })
      .from(psychologistBookings)
      .innerJoin(bookingServices, eq(psychologistBookings.serviceId, bookingServices.id))
      .innerJoin(orders, eq(psychologistBookings.orderId, orders.id))
      .orderBy(desc(psychologistBookings.createdAt));

    return results.map((row) => ({
      ...row.booking,
      service: row.service,
      order: row.order,
    }));
  }

  async searchPsychologistBookingReports(search?: string): Promise<PsychologistBookingWithDetails[]> {
    const trimmedSearch = search?.trim();
    const results = await db
      .select({
        booking: psychologistBookings,
        service: bookingServices,
        order: orders,
      })
      .from(psychologistBookings)
      .innerJoin(bookingServices, eq(psychologistBookings.serviceId, bookingServices.id))
      .innerJoin(orders, eq(psychologistBookings.orderId, orders.id))
      .where(
        trimmedSearch
          ? or(
              ilike(psychologistBookings.clientName, `%${trimmedSearch}%`),
              ilike(psychologistBookings.email, `%${trimmedSearch}%`),
              ilike(psychologistBookings.psychologistName, `%${trimmedSearch}%`),
            )
          : undefined,
      )
      .orderBy(desc(psychologistBookings.preferredDate), desc(psychologistBookings.createdAt));

    return results.map((row) => ({
      ...row.booking,
      service: row.service,
      order: row.order,
    }));
  }

  async getPsychologistBookingsByProvider(psychologistName: string): Promise<PsychologistBookingWithDetails[]> {
    const results = await db
      .select({
        booking: psychologistBookings,
        service: bookingServices,
        order: orders,
      })
      .from(psychologistBookings)
      .innerJoin(bookingServices, eq(psychologistBookings.serviceId, bookingServices.id))
      .innerJoin(orders, eq(psychologistBookings.orderId, orders.id))
      .where(eq(psychologistBookings.psychologistName, psychologistName))
      .orderBy(psychologistBookings.createdAt);

    return results.map((row) => ({
      ...row.booking,
      service: row.service,
      order: row.order,
    }));
  }

  async getPsychologistBooking(id: number): Promise<PsychologistBookingWithDetails | undefined> {
    const [result] = await db
      .select({
        booking: psychologistBookings,
        service: bookingServices,
        order: orders,
      })
      .from(psychologistBookings)
      .innerJoin(bookingServices, eq(psychologistBookings.serviceId, bookingServices.id))
      .innerJoin(orders, eq(psychologistBookings.orderId, orders.id))
      .where(eq(psychologistBookings.id, id));

    if (!result) return undefined;

    return {
      ...result.booking,
      service: result.service,
      order: result.order,
    };
  }

  async getPsychologistBookingByOrder(orderId: number): Promise<PsychologistBookingWithDetails | undefined> {
    const [result] = await db
      .select({
        booking: psychologistBookings,
        service: bookingServices,
        order: orders,
      })
      .from(psychologistBookings)
      .innerJoin(bookingServices, eq(psychologistBookings.serviceId, bookingServices.id))
      .innerJoin(orders, eq(psychologistBookings.orderId, orders.id))
      .where(eq(psychologistBookings.orderId, orderId));

    if (!result) return undefined;

    return {
      ...result.booking,
      service: result.service,
      order: result.order,
    };
  }

  async updatePsychologistBookingStatus(id: number, status: string): Promise<void> {
    await db
      .update(psychologistBookings)
      .set({
        status,
        paidAt: status === "paid" ? new Date() : undefined,
        updatedAt: new Date(),
      })
      .where(eq(psychologistBookings.id, id));
  }

  async updatePsychologistBookingReport(
    id: number,
    report: {
      meetingUrl?: string | null;
      sessionReport?: string | null;
      reportRecommendations?: string | null;
      clientReportNotes?: string | null;
      counselingHistoryNotes?: string | null;
      submit?: boolean;
    },
  ): Promise<void> {
    const hasClientReport = Boolean(report.clientReportNotes || report.reportRecommendations);
    const updates: Partial<typeof psychologistBookings.$inferInsert> = {
      updatedAt: new Date(),
    };
    if (report.meetingUrl !== undefined) updates.meetingUrl = report.meetingUrl || null;
    if (report.sessionReport !== undefined) updates.sessionReport = report.sessionReport || null;
    if (report.reportRecommendations !== undefined) updates.reportRecommendations = report.reportRecommendations || null;
    if (report.clientReportNotes !== undefined) updates.clientReportNotes = report.clientReportNotes || null;
    if (report.counselingHistoryNotes !== undefined) updates.counselingHistoryNotes = report.counselingHistoryNotes || null;
    if (report.submit && hasClientReport) updates.reportSubmittedAt = new Date();

    await db
      .update(psychologistBookings)
      .set(updates)
      .where(eq(psychologistBookings.id, id));
  }

  async updatePsychologistBookingSchedule(
    id: number,
    schedule: {
      preferredDate?: string;
      preferredTime?: string;
      location?: string;
      meetingUrl?: string | null;
    },
  ): Promise<void> {
    await db
      .update(psychologistBookings)
      .set({
        preferredDate: schedule.preferredDate,
        preferredTime: schedule.preferredTime,
        location: schedule.location,
        meetingUrl: schedule.meetingUrl || null,
        updatedAt: new Date(),
      })
      .where(eq(psychologistBookings.id, id));
  }

  // Order operations
  async createOrder(order: InsertOrder): Promise<Order> {
    const [newOrder] = await db
      .insert(orders)
      .values(order)
      .returning();
    return newOrder;
  }

  async getOrder(id: number): Promise<OrderWithItems | undefined> {
    const [order] = await db
      .select()
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(assessments, eq(orderItems.assessmentId, assessments.id))
      .where(eq(orders.id, id));

    if (!order) return undefined;

    const orderWithItems = await db
      .select({
        order: orders,
        orderItem: orderItems,
        assessment: assessments,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(assessments, eq(orderItems.assessmentId, assessments.id))
      .where(eq(orders.id, id));

    const result: OrderWithItems = {
      ...orderWithItems[0].order,
      orderItems: orderWithItems
        .filter(row => row.orderItem && row.assessment)
        .map(row => ({
          ...row.orderItem!,
          assessment: row.assessment!,
        })),
    };

    return result;
  }

  async getUserOrders(userId: string): Promise<OrderWithItems[]> {
    const orderData = await db
      .select({
        order: orders,
        orderItem: orderItems,
        assessment: assessments,
      })
      .from(orders)
      .leftJoin(orderItems, eq(orders.id, orderItems.orderId))
      .leftJoin(assessments, eq(orderItems.assessmentId, assessments.id))
      .where(eq(orders.userId, userId));

    const ordersMap = new Map<number, OrderWithItems>();

    for (const row of orderData) {
      if (!ordersMap.has(row.order.id)) {
        ordersMap.set(row.order.id, {
          ...row.order,
          orderItems: [],
        });
      }

      if (row.orderItem && row.assessment) {
        ordersMap.get(row.order.id)!.orderItems.push({
          ...row.orderItem,
          assessment: row.assessment,
        });
      }
    }

    return Array.from(ordersMap.values());
  }

  async updateOrderStatus(id: number, status: string, paymentId?: string, paymentStatus?: string): Promise<void> {
    const updateData: any = { status, updatedAt: new Date() };
    if (paymentId) updateData.paymentId = paymentId;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;

    await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id));
  }

  async updateOrderPayment(id: number, paymentData: {
    paymentStatus?: string;
    paymentMethod?: string;

    paidAt?: Date;
    paidAmount?: number;
  }): Promise<void> {
    const updateData: any = { 
      updatedAt: new Date(),
      ...paymentData
    };

    await db
      .update(orders)
      .set(updateData)
      .where(eq(orders.id, id));
  }

  async updateOrder(id: number, updates: Partial<Order>): Promise<void> {
    await db.update(orders)
      .set({
        ...updates,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));
  }

  // Order item operations
  async createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem> {
    const [newOrderItem] = await db
      .insert(orderItems)
      .values(orderItem)
      .returning();
    return newOrderItem;
  }

  // User assessment operations
  async createUserAssessment(userAssessment: InsertUserAssessment): Promise<UserAssessment> {
    const [newUserAssessment] = await db
      .insert(userAssessments)
      .values(userAssessment)
      .returning();
    return newUserAssessment;
  }

  async getUserAssessments(userId: string): Promise<UserAssessmentWithDetails[]> {
    const results = await db
      .select({
        userAssessment: userAssessments,
        assessment: assessments,
      })
      .from(userAssessments)
      .leftJoin(assessments, eq(userAssessments.assessmentId, assessments.id))
      .where(eq(userAssessments.userId, userId));

    return results.map(row => ({
      ...row.userAssessment,
      assessment: row.assessment!,
    }));
  }

  async getUserAssessment(userId: string, assessmentId: number): Promise<UserAssessmentWithDetails | undefined> {
    const [result] = await db
      .select({
        userAssessment: userAssessments,
        assessment: assessments,
      })
      .from(userAssessments)
      .leftJoin(assessments, eq(userAssessments.assessmentId, assessments.id))
      .where(and(
        eq(userAssessments.userId, userId),
        eq(userAssessments.assessmentId, assessmentId)
      ));

    if (!result) return undefined;

    return {
      ...result.userAssessment,
      assessment: result.assessment!,
    };
  }

  async getUserAssessmentByOrder(userId: string, assessmentId: number, orderId: number): Promise<UserAssessmentWithDetails | undefined> {
    const [result] = await db
      .select({
        userAssessment: userAssessments,
        assessment: assessments,
      })
      .from(userAssessments)
      .leftJoin(assessments, eq(userAssessments.assessmentId, assessments.id))
      .where(and(
        eq(userAssessments.userId, userId),
        eq(userAssessments.assessmentId, assessmentId),
        eq(userAssessments.orderId, orderId)
      ));

    if (!result) return undefined;

    return {
      ...result.userAssessment,
      assessment: result.assessment!,
    };
  }

  async updateUserAssessmentStatus(id: number, status: string, results?: any): Promise<void> {
    const updateData: any = { status };
    if (results) updateData.results = results;
    if (status === 'completed') updateData.completedAt = new Date();

    await db
      .update(userAssessments)
      .set(updateData)
      .where(eq(userAssessments.id, id));
  }

  // Admin operations
  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).orderBy(users.createdAt);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<User> {
    const [user] = await db
      .update(users)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user;
  }

  async resetUserPassword(userId: string, newPassword: string): Promise<void> {
    const bcrypt = await import('bcryptjs');
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await db
      .update(users)
      .set({ password: hashedPassword, updatedAt: new Date() })
      .where(eq(users.id, userId));
  }

  async getAllUserAssessments(): Promise<UserAssessmentWithDetails[]> {
    const results = await db
      .select({
        userAssessment: userAssessments,
        assessment: assessments,
        user: users,
      })
      .from(userAssessments)
      .leftJoin(assessments, eq(userAssessments.assessmentId, assessments.id))
      .leftJoin(users, eq(userAssessments.userId, users.id))
      .orderBy(userAssessments.createdAt);

    return results.map(row => ({
      ...row.userAssessment,
      assessment: row.assessment!,
      user: row.user ? {
        id: row.user.id,
        email: row.user.email,
        firstName: row.user.firstName,
        lastName: row.user.lastName,
        whatsappNumber: row.user.whatsappNumber,
      } : undefined,
    }));
  }

  async getAssessmentStats(): Promise<{
    totalUsers: number;
    activeUsers: number;
    completedAssessments: number;
    inProgressAssessments: number;
    totalRevenue: number;
    assessmentTypeStats: {
      type: string;
      name: string;
      count: number;
      revenue: number;
      completedCount: number;
      inProgressCount: number;
    }[];
  }> {
    const totalUsersResult = await db.select().from(users);
    const activeUsersResult = await db.select().from(users).where(eq(users.isActive, true));
    const completedAssessmentsResult = await db.select().from(userAssessments).where(eq(userAssessments.status, 'completed'));
    const inProgressAssessmentsResult = await db.select().from(userAssessments).where(
      or(
        eq(userAssessments.status, 'in_progress'),
        eq(userAssessments.status, 'available')
      )
    );
    const totalRevenueResults = await db.select().from(orders);

    // Get assessment type statistics based on order items (actual purchases)
    const orderItemsWithDetails = await db
      .select({
        orderItem: orderItems,
        assessment: assessments,
        order: orders
      })
      .from(orderItems)
      .innerJoin(assessments, eq(orderItems.assessmentId, assessments.id))
      .innerJoin(orders, eq(orderItems.orderId, orders.id));

    // Get user assessments with assessment details to calculate completion stats
    const userAssessmentsWithDetails = await db
      .select({
        userAssessment: userAssessments,
        assessment: assessments
      })
      .from(userAssessments)
      .innerJoin(assessments, eq(userAssessments.assessmentId, assessments.id));

    // Calculate stats by assessment type (based on actual purchases/order items)
    const typeStats = new Map<string, { type: string; name: string; count: number; revenue: number; completedCount: number; inProgressCount: number }>();
    
    orderItemsWithDetails.forEach(item => {
      const type = item.assessment.type;
      const name = item.assessment.name;
      const price = parseFloat(item.assessment.price);
      
      if (!typeStats.has(type)) {
        typeStats.set(type, { type, name, count: 0, revenue: 0, completedCount: 0, inProgressCount: 0 });
      }
      
      const current = typeStats.get(type)!;
      current.count += 1;
      current.revenue += price;
    });

    // Add completion stats for each assessment type
    userAssessmentsWithDetails.forEach(item => {
      const type = item.assessment.type;
      
      if (typeStats.has(type)) {
        const current = typeStats.get(type)!;
        if (item.userAssessment.status === 'completed') {
          current.completedCount += 1;
        } else if (item.userAssessment.status === 'in_progress' || item.userAssessment.status === 'available') {
          current.inProgressCount += 1;
        }
      }
    });

    const assessmentTypeStats = Array.from(typeStats.values());

    return {
      totalUsers: totalUsersResult.length,
      activeUsers: activeUsersResult.length,
      completedAssessments: completedAssessmentsResult.length,
      inProgressAssessments: inProgressAssessmentsResult.length,
      totalRevenue: totalRevenueResults.reduce((sum, order) => sum + parseFloat(order.totalAmount || '0'), 0),
      assessmentTypeStats,
    };
  }

  async updateUserLastLogin(userId: string): Promise<void> {
    await db
      .update(users)
      .set({ lastLoginAt: new Date() })
      .where(eq(users.id, userId));
  }
}

export const storage = new DatabaseStorage();
