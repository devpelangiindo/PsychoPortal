import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import { insertOrderSchema, insertOrderItemSchema, insertUserAssessmentSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth middleware
  await setupAuth(app);

  // Initialize default assessments
  await initializeAssessments();

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

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
      res.json(orders);
    } catch (error) {
      console.error("Error fetching orders:", error);
      res.status(500).json({ message: "Failed to fetch orders" });
    }
  });

  app.get('/api/orders/:id', isAuthenticated, async (req: any, res) => {
    try {
      const orderId = parseInt(req.params.id);
      const order = await storage.getOrder(orderId);
      
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      // Check if user owns this order
      if (order.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(order);
    } catch (error) {
      console.error("Error fetching order:", error);
      res.status(500).json({ message: "Failed to fetch order" });
    }
  });

  // Payment routes
  app.post('/api/payments/create', isAuthenticated, async (req: any, res) => {
    try {
      const { orderId, paymentMethod } = req.body;
      
      if (!orderId) {
        return res.status(400).json({ message: "Order ID is required" });
      }

      const order = await storage.getOrder(orderId);
      if (!order) {
        return res.status(404).json({ message: "Order not found" });
      }

      if (order.userId !== req.user.claims.sub) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Xendit payment creation would go here
      // For now, we'll simulate a successful payment
      const paymentId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update order with payment info
      await storage.updateOrderStatus(orderId, 'completed', paymentId, 'paid');

      // Create user assessments for completed order
      for (const item of order.orderItems) {
        await storage.createUserAssessment({
          userId: order.userId,
          assessmentId: item.assessmentId,
          orderId: order.id,
          status: 'available',
        });
      }

      res.json({
        paymentId,
        status: 'completed',
        redirectUrl: '/dashboard'
      });
    } catch (error) {
      console.error("Error creating payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // User assessment routes
  app.get('/api/user-assessments', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const userAssessments = await storage.getUserAssessments(userId);
      res.json(userAssessments);
    } catch (error) {
      console.error("Error fetching user assessments:", error);
      res.status(500).json({ message: "Failed to fetch user assessments" });
    }
  });

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

  app.post('/api/user-assessments/:id/complete', isAuthenticated, async (req: any, res) => {
    try {
      const id = parseInt(req.params.id);
      const { results } = req.body;
      
      await storage.updateUserAssessmentStatus(id, 'completed', results);
      res.json({ message: 'Assessment completed' });
    } catch (error) {
      console.error("Error completing assessment:", error);
      res.status(500).json({ message: "Failed to complete assessment" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

async function initializeAssessments() {
  try {
    const existingAssessments = await storage.getAssessments();
    
    if (existingAssessments.length === 0) {
      // Create default assessments
      await storage.createAssessment({
        name: "Sensory Profile Assessment",
        description: "Comprehensive evaluation of sensory processing patterns and preferences. Identifies individual sensory thresholds and behavioral responses across multiple sensory systems.",
        price: "49.99",
        duration: "30-45 minutes",
        ageRange: "Ages 3-65+",
        type: "sensory",
        isActive: true,
      });

      await storage.createAssessment({
        name: "Learning Style Inventory",
        description: "Identifies individual learning preferences and optimal educational approaches. Assesses visual, auditory, kinesthetic, and reading/writing learning modalities.",
        price: "39.99",
        duration: "20-30 minutes",
        ageRange: "Ages 12+",
        type: "learning",
        isActive: true,
      });

      console.log("Default assessments created successfully");
    }
  } catch (error) {
    console.error("Error initializing assessments:", error);
  }
}
