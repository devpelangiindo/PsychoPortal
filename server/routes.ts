import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getSession } from "./replitAuth";
import type { UserAssessmentWithDetails } from "@shared/schema";
import { insertOrderSchema, insertOrderItemSchema, insertUserAssessmentSchema, registerSchema, loginSchema, otpVerificationSchema } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { randomBytes } from "crypto";
import { AuthUtils } from "./authUtils";
import { emailService } from "./emailService";

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

    req.user = { claims: { sub: decoded.userId }, email: decoded.email };
    next();
  } catch (error) {
    return res.status(401).json({ message: "Unauthorized" });
  }
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

      const results = userAssessment.results as any;
      const assessmentType = userAssessment.assessment.type;

      // Header
      doc.fontSize(20).font('Helvetica-Bold')
         .text('LAPORAN HASIL ASESMEN', { align: 'center' });
      
      doc.fontSize(16).font('Helvetica-Bold')
         .text('Rumah Psikologi Indonesia', { align: 'center' });

      doc.moveDown(2);

      // Assessment Info
      doc.fontSize(14).font('Helvetica-Bold')
         .text('Informasi Asesmen', { underline: true });
      
      doc.moveDown(0.5);
      
      doc.fontSize(12).font('Helvetica')
         .text(`Nama Asesmen: ${userAssessment.assessment.name}`)
         .text(`Tanggal Selesai: ${new Date(userAssessment.completedAt!).toLocaleDateString('id-ID')}`)
         .text(`Durasi: ${userAssessment.assessment.duration}`)
         .text(`Rentang Usia: ${userAssessment.assessment.ageRange}`);

      doc.moveDown(1.5);

      // Results Section
      if (assessmentType === 'learning') {
        const { scores, dominantStyle } = results;
        
        doc.fontSize(14).font('Helvetica-Bold')
           .text('HASIL INVENTORI GAYA BELAJAR', { underline: true });
        
        doc.moveDown(0.5);
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text(`Gaya Belajar Dominan: ${dominantStyle.toUpperCase()}`);
        
        doc.moveDown(0.5);
        
        doc.fontSize(12).font('Helvetica')
           .text('Skor Detail:')
           .text(`• Visual: ${scores.visual || 0}`)
           .text(`• Auditori: ${scores.auditori || 0}`)
           .text(`• Kinestetik: ${scores.kinestetik || 0}`);
        
        doc.moveDown(1);
        
        doc.fontSize(12).font('Helvetica-Bold')
           .text('Interpretasi:');
        
        doc.fontSize(12).font('Helvetica');
        const interpretation = dominantStyle === 'visual' 
          ? 'Anda belajar terbaik melalui melihat dan mengamati. Lebih mudah memahami informasi melalui diagram, grafik, dan presentasi visual.'
          : dominantStyle === 'auditori' 
          ? 'Anda belajar terbaik melalui mendengar dan berbicara. Lebih mudah memahami informasi melalui penjelasan lisan dan diskusi.'
          : 'Anda belajar terbaik melalui praktik langsung dan gerakan. Lebih mudah memahami informasi melalui aktivitas hands-on.';
        
        doc.text(interpretation, { align: 'justify' });
        
      } else if (assessmentType === 'sensory') {
        const { totalScore, interpretation, sectionScores, participantInfo, responses } = results;
        
        doc.fontSize(14).font('Helvetica-Bold')
           .text('HASIL ASESMEN PROFIL SENSORIS', { underline: true });
        
        doc.moveDown(0.5);

        // Participant Info - Enhanced
        if (participantInfo && Object.keys(participantInfo).length > 0) {
          doc.fontSize(12).font('Helvetica-Bold')
             .text('INFORMASI PARTISIPAN', { underline: true });
          
          doc.moveDown(0.3);
          
          doc.fontSize(11).font('Helvetica')
             .text(`Nama Anak: ${participantInfo.childName || '-'}`)
             .text(`Tanggal Lahir: ${participantInfo.childBirthDate || '-'}`)
             .text(`Jenis Kelamin: ${participantInfo.childGender || '-'}`)
             .text(`Nama Orang Tua: ${participantInfo.parentName || '-'}`)
             .text(`Hubungan: ${participantInfo.relationship || '-'}`)
             .text(`Usia Orang Tua: ${participantInfo.parentAge || '-'}`)
             .text(`Pendidikan: ${participantInfo.parentEducation || '-'}`)
             .text(`Pekerjaan: ${participantInfo.parentOccupation || '-'}`)
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
        
        doc.fontSize(11).font('Helvetica')
           .text(`Interpretasi: ${interpretation}`);
        
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
              name: 'Pemrosesan Perencanaan Gerakan',
              description: 'Kemampuan merencanakan dan melaksanakan gerakan motorik',
              normal: [6, 12],
              lowThreshold: '≤5 (Kesulitan perencanaan motorik)',
              highThreshold: '≥13 (Mencari tantangan motorik kompleks)'
            },
            'H': {
              name: 'Pemrosesan Energi Tubuh',
              description: 'Regulasi energi dan tonus otot untuk aktivitas sehari-hari',
              normal: [7, 13],
              lowThreshold: '≤6 (Tonus rendah - mudah lelah)',
              highThreshold: '≥14 (Mencari input proprioseptif kuat)'
            },
            'I': {
              name: 'Modulasi Tonus Tubuh dan Endurance',
              description: 'Modulasi tingkat kewaspadaan dan daya tahan tubuh',
              normal: [6, 12],
              lowThreshold: '≤5 (Tingkat aktivitas rendah)',
              highThreshold: '≥13 (Hiperaktif - sulit mengatur diri)'
            },
            'J': {
              name: 'Modulasi Gerakan dan Tingkat Aktivitas',
              description: 'Regulasi gerakan dan respons terhadap input vestibular',
              normal: [3, 7],
              lowThreshold: '≤2 (Under-responsive terhadap gerakan)',
              highThreshold: '≥8 (Mencari gerakan intens berlebihan)'
            },
            'K': {
              name: 'Modulasi Input Sensoris - Respons Emosional',
              description: 'Regulasi respons emosional terhadap stimulasi sensoris',
              normal: [5, 11],
              lowThreshold: '≤4 (Under-responsive secara emosional)',
              highThreshold: '≥12 (Over-responsive secara emosional)'
            },
            'L': {
              name: 'Modulasi Input Visual - Respons Emosional',
              description: 'Regulasi respons emosional terhadap stimulasi visual',
              normal: [2, 6],
              lowThreshold: '≤1 (Under-responsive terhadap visual)',
              highThreshold: '≥7 (Over-responsive terhadap visual)'
            },
            'M': {
              name: 'Modulasi Input Taktil - Respons Emosional',
              description: 'Regulasi respons emosional terhadap sentuhan',
              normal: [4, 8],
              lowThreshold: '≤3 (Under-responsive terhadap sentuhan)',
              highThreshold: '≥9 (Over-responsive terhadap sentuhan)'
            },
            'N': {
              name: 'Regulasi Threshold untuk Respons Umum',
              description: 'Threshold umum untuk merespons stimulasi sensoris',
              normal: [12, 18],
              lowThreshold: '≤11 (Threshold tinggi - butuh stimulasi kuat)',
              highThreshold: '≥19 (Threshold rendah - mudah terstimulasi)'
            }
          };
          
          Object.entries(sectionScores).forEach(([section, score]: [string, any]) => {
            const detail = sectionDetails[section as keyof typeof sectionDetails];
            if (detail) {
              doc.fontSize(11).font('Helvetica-Bold')
                 .text(`${detail.name}: ${score}`, { continued: false });
              
              // Determine threshold category
              let category = 'Normal';
              let categoryColor = 'black';
              if (score <= detail.normal[0] - 1) {
                category = 'Hipersensitif (Ambang Rendah)';
                categoryColor = 'red';
              } else if (score >= detail.normal[1] + 1) {
                category = 'Hiposensitif (Ambang Tinggi)';
                categoryColor = 'blue';
              }
              
              doc.fontSize(10).font('Helvetica')
                 .text(`  Kategori: ${category}`)
                 .text(`  ${detail.description}`)
                 .text(`  Rentang Normal: ${detail.normal[0]}-${detail.normal[1]}`);
              
              if (category !== 'Normal') {
                doc.text(`  ${category === 'Hipersensitif (Ambang Rendah)' ? detail.lowThreshold : detail.highThreshold}`);
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
            }
          };
          
          Object.entries(sectionScores).forEach(([section, score]: [string, any]) => {
            const detail = sectionDetailsForRecommendations[section as keyof typeof sectionDetailsForRecommendations];
            if (detail) {
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

      doc.moveDown(2);

      // Footer
      doc.fontSize(10).font('Helvetica')
         .text('Laporan ini dibuat secara otomatis oleh sistem Rumah Psikologi Indonesia.', { align: 'center' })
         .text('Untuk konsultasi lebih lanjut, silakan hubungi profesional terkait.', { align: 'center' });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

export async function registerRoutes(app: Express): Promise<Server> {
  try {
    // Session middleware for custom authentication
    app.use(getSession());

    // Initialize default assessments
    await initializeAssessments();
  } catch (error) {
    console.error('Failed to initialize routes:', error);
    throw error;
  }

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
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(401).json({ message: "Unauthorized" });
    }
  });

  // Custom Authentication Routes
  
  // Register new user
  app.post('/api/auth/register', async (req, res) => {
    try {
      const validatedData = registerSchema.parse(req.body);
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(validatedData.email);
      if (existingUser) {
        return res.status(400).json({ message: "Email sudah terdaftar" });
      }

      // Validate WhatsApp number
      if (!AuthUtils.isValidWhatsAppNumber(validatedData.whatsappNumber)) {
        return res.status(400).json({ message: "Nomor WhatsApp tidak valid" });
      }

      // Hash password
      const hashedPassword = await AuthUtils.hashPassword(validatedData.password);
      
      // Generate user ID
      const userId = AuthUtils.generateUserId();
      
      // Normalize WhatsApp number
      const normalizedWhatsApp = AuthUtils.normalizeWhatsAppNumber(validatedData.whatsappNumber);

      // Create user (automatically verified)
      const newUser = await storage.createUser({
        id: userId,
        email: validatedData.email,
        password: hashedPassword,
        firstName: validatedData.firstName,
        lastName: validatedData.lastName,
        whatsappNumber: normalizedWhatsApp,
        authProvider: 'custom',
        isEmailVerified: true
      });

      // Generate tokens for immediate login
      const accessToken = AuthUtils.generateAccessToken(newUser.id, newUser.email);
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
      const accessToken = AuthUtils.generateAccessToken(user.id, user.email);
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

      // Generate tokens
      const accessToken = AuthUtils.generateAccessToken(user.id, user.email);
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
          isEmailVerified: user.isEmailVerified
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

  // Logout
  app.post('/api/auth/logout', async (req, res) => {
    try {
      // Destroy session
      (req as any).session.destroy((err: any) => {
        if (err) {
          console.error("Session destroy error:", err);
          return res.status(500).json({ message: "Gagal logout" });
        }
        res.json({ message: "Logout berhasil" });
      });
    } catch (error) {
      console.error("Logout error:", error);
      res.status(500).json({ message: "Gagal logout" });
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
    } else {
      console.log(`Found ${existingAssessments.length} existing assessments`);
    }
  } catch (error) {
    console.error("Error initializing assessments:", error);
    throw error; // Re-throw to prevent silent failures
  }
}
