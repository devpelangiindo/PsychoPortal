import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import type { UserAssessmentWithDetails } from "@shared/schema";
import { insertOrderSchema, insertOrderItemSchema, insertUserAssessmentSchema } from "@shared/schema";
import { z } from "zod";

// PDF Generation Function
function generatePdfContent(userAssessment: UserAssessmentWithDetails): string {
  const results = userAssessment.results as any;
  const assessmentType = userAssessment.assessment.type;
  
  // Create a simple PDF content structure
  let content = `
    LAPORAN HASIL ASESMEN
    
    Nama Asesmen: ${userAssessment.assessment.name}
    Tanggal Selesai: ${new Date(userAssessment.completedAt!).toLocaleDateString('id-ID')}
    
    `;

  if (assessmentType === 'learning') {
    const { scores, dominantStyle } = results;
    content += `
    HASIL INVENTORI GAYA BELAJAR
    
    Gaya Belajar Dominan: ${dominantStyle.toUpperCase()}
    
    Skor Detail:
    - Visual: ${scores.visual || 0}
    - Auditori: ${scores.auditori || 0}
    - Kinestetik: ${scores.kinestetik || 0}
    
    Interpretasi:
    ${dominantStyle === 'visual' ? 'Anda belajar terbaik melalui melihat dan mengamati.' :
      dominantStyle === 'auditori' ? 'Anda belajar terbaik melalui mendengar dan berbicara.' :
      'Anda belajar terbaik melalui praktik langsung dan gerakan.'}
    `;
  } else if (assessmentType === 'sensory') {
    const { totalScore, interpretation, sectionScores } = results;
    content += `
    HASIL ASESMEN PROFIL SENSORIS
    
    Skor Total: ${totalScore}
    Interpretasi: ${interpretation}
    
    Skor Per Bagian:
    ${Object.entries(sectionScores || {}).map(([section, score]: [string, any]) => 
      `- ${section}: ${score}`
    ).join('\n')}
    `;
  }

  content += `
    
    Laporan ini dibuat secara otomatis oleh sistem Rumah Psikologi Indonesia.
    Untuk konsultasi lebih lanjut, silakan hubungi profesional terkait.
  `;

  // For demo purposes, return base64 encoded content
  // In production, you'd use a proper PDF library like PDFKit
  const base64Content = Buffer.from(content).toString('base64');
  return base64Content;
}

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

      // Demo payment simulation - no real money is charged
      const paymentId = `demo_payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Update order with demo payment info
      await storage.updateOrderStatus(orderId, 'completed', paymentId, 'demo_paid');

      // Create user assessments for completed order
      console.log(`Creating user assessments for order ${orderId}, user ${order.userId}`);
      for (const item of order.orderItems) {
        console.log(`Creating user assessment for assessment ${item.assessmentId}`);
        const userAssessment = await storage.createUserAssessment({
          userId: order.userId,
          assessmentId: item.assessmentId,
          orderId: order.id,
          status: 'available',
        });
        console.log(`Created user assessment:`, userAssessment);
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
      console.log(`Fetching user assessments for user: ${userId}`);
      const userAssessments = await storage.getUserAssessments(userId);
      console.log(`Found ${userAssessments.length} user assessments:`, userAssessments);
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
      const { responses, participantInfo, currentSection, currentStep, notApplicable, comments } = req.body;

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
        currentSection: currentSection !== undefined ? currentSection : existingResults.currentSection || 0,
        currentStep: currentStep !== undefined ? currentStep : existingResults.currentStep || 0,
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
      const id = parseInt(req.params.id);
      const { results } = req.body;
      
      await storage.updateUserAssessmentStatus(id, 'completed', results);
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
      const pdfContent = generatePdfContent(userAssessment);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="Hasil_${userAssessment.assessment.name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf"`);
      res.send(Buffer.from(pdfContent, 'base64'));
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
      const shareToken = require('crypto').randomBytes(32).toString('hex');
      
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

  const httpServer = createServer(app);
  return httpServer;
}

async function initializeAssessments() {
  try {
    const existingAssessments = await storage.getAssessments();
    
    if (existingAssessments.length === 0) {
      // Create default assessments
      await storage.createAssessment({
        name: "Asesmen Profil Sensoris",
        description: "Evaluasi komprehensif pola dan preferensi pemrosesan sensoris. Mengidentifikasi ambang batas sensoris individu dan respons perilaku di berbagai sistem sensoris.",
        price: "400000",
        duration: "30-45 menit",
        ageRange: "Usia 3-65+",
        type: "sensory",
        isActive: true,
      });

      await storage.createAssessment({
        name: "Inventori Gaya Belajar",
        description: "Mengidentifikasi preferensi belajar individu dan pendekatan pendidikan yang optimal. Menilai modalitas belajar visual, auditori, kinestetik, dan membaca/menulis.",
        price: "200000",
        duration: "20-30 menit",
        ageRange: "Usia 12+",
        type: "learning",
        isActive: true,
      });

      console.log("Asesmen default berhasil dibuat");
    }
  } catch (error) {
    console.error("Error initializing assessments:", error);
  }
}
