import {
  users,
  assessments,
  orders,
  orderItems,
  userAssessments,
  otpVerifications,
  type User,
  type UpsertUser,
  type Assessment,
  type InsertAssessment,
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
} from "@shared/schema";
import { db } from "./db";
import { eq, and, sql } from "drizzle-orm";

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

  // Order operations
  createOrder(order: InsertOrder): Promise<Order>;
  getOrder(id: number): Promise<OrderWithItems | undefined>;
  getUserOrders(userId: string): Promise<OrderWithItems[]>;
  updateOrderStatus(id: number, status: string, paymentId?: string, paymentStatus?: string): Promise<void>;

  // Order item operations
  createOrderItem(orderItem: InsertOrderItem): Promise<OrderItem>;

  // User assessment operations
  createUserAssessment(userAssessment: InsertUserAssessment): Promise<UserAssessment>;
  getUserAssessments(userId: string): Promise<UserAssessmentWithDetails[]>;
  getUserAssessment(userId: string, assessmentId: number): Promise<UserAssessmentWithDetails | undefined>;
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
}

export class DatabaseStorage implements IStorage {
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
    }[];
  }> {
    const totalUsersResult = await db.select().from(users);
    const activeUsersResult = await db.select().from(users).where(eq(users.isActive, true));
    const completedAssessmentsResult = await db.select().from(userAssessments).where(eq(userAssessments.status, 'completed'));
    const inProgressAssessmentsResult = await db.select().from(userAssessments).where(eq(userAssessments.status, 'in_progress'));
    const totalRevenueResults = await db.select().from(orders);

    // Get assessment type statistics (including both completed and in-progress assessments)
    const allPurchasedAssessmentsWithDetails = await db
      .select({
        userAssessment: userAssessments,
        assessment: assessments,
        order: orders
      })
      .from(userAssessments)
      .innerJoin(assessments, eq(userAssessments.assessmentId, assessments.id))
      .innerJoin(orders, eq(userAssessments.orderId, orders.id));

    // Calculate stats by assessment type (all purchased assessments)
    const typeStats = new Map<string, { type: string; name: string; count: number; revenue: number }>();
    
    allPurchasedAssessmentsWithDetails.forEach(item => {
      const type = item.assessment.type;
      const name = item.assessment.name;
      const price = parseFloat(item.assessment.price);
      
      if (!typeStats.has(type)) {
        typeStats.set(type, { type, name, count: 0, revenue: 0 });
      }
      
      const current = typeStats.get(type)!;
      current.count += 1;
      current.revenue += price;
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
