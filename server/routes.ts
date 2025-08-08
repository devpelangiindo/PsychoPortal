import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getSession } from "./replitAuth";
import type { UserAssessmentWithDetails } from "@shared/schema";
import { insertOrderSchema, insertOrderItemSchema, insertUserAssessmentSchema, registerSchema, loginSchema, otpVerificationSchema, adminLoginSchema, userUpdateSchema, passwordResetSchema } from "@shared/schema";
import { z } from "zod";
import PDFDocument from "pdfkit";
import { randomBytes } from "crypto";
import { AuthUtils } from "./authUtils";
import { emailService } from "./emailService";
import path from "path";
import fs from "fs";
// Using Midtrans payment gateway
import { createMidtransTransaction, handleMidtransCallback, checkTransactionStatus, getMidtransPaymentStatus } from "./midtrans";

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
      const logoPath = path.join(process.cwd(), 'server', 'assets', 'logo.png');
      
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
         .text(`Tanggal Selesai: ${new Date(userAssessment.completedAt!).toLocaleDateString('id-ID')}`)
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
             .text(`Tanggal Lahir: ${participantInfo.childBirthDate || '-'}`)
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
      
      // Remove password from response for security
      const { password, ...safeUser } = user;
      res.json(safeUser);
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
      
      // Remove confirmPassword from data before saving to database
      const { confirmPassword, ...userData } = validatedData;
      
      // Check if user already exists
      const existingUser = await storage.getUserByEmail(userData.email);
      if (existingUser) {
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

      // Create user (automatically verified)
      const newUser = await storage.createUser({
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

  // Payment routes - Enhanced with proper Midtrans integration
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

      console.log(`🔄 Creating Midtrans payment for order ${orderId}`);

      // Get user details for customer info
      const user = await storage.getUserById(order.userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      // Create Midtrans transaction ID with timestamp
      const timestamp = Date.now();
      const midtransOrderId = `order_${orderId}_${timestamp}`;
      
      // Prepare Midtrans transaction data
      const itemDetails = order.orderItems.map(item => ({
        id: `assessment_${item.assessmentId}`,
        name: `Assessment ${item.assessmentId}`,
        price: parseInt(item.price),
        quantity: 1
      }));

      const transactionData = {
        orderId: midtransOrderId,
        amount: parseInt(order.totalAmount),
        customerDetails: {
          first_name: user.firstName,
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
        orderId: orderId
      });
    } catch (error) {
      console.error("❌ Error creating Midtrans payment:", error);
      res.status(500).json({ message: "Failed to create payment" });
    }
  });

  // Direct access for free assessments (bypass payment)
  app.post('/api/assessments/:assessmentId/direct-access', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const assessmentId = parseInt(req.params.assessmentId);
      
      // Verify assessment exists and is free
      const assessment = await storage.getAssessment(assessmentId);
      if (!assessment) {
        return res.status(404).json({ message: "Asesmen tidak ditemukan" });
      }
      
      if (parseFloat(assessment.price) !== 0) {
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
      
      // For free assessments, we need to create a "virtual" order to satisfy the schema
      // Create a free order first
      const freeOrder = await storage.createOrder({
        userId,
        totalAmount: '0.00',
        status: 'completed'
      });
      
      // Create order item for the free assessment
      await storage.createOrderItem({
        orderId: freeOrder.id,
        assessmentId,
        price: '0.00'
      });
      
      // Create user assessment with the free order
      const userAssessmentData = {
        userId,
        assessmentId,
        orderId: freeOrder.id,
        status: 'purchased' as const
      };
      
      console.log(`🎁 Creating free direct access for user ${userId}, assessment ${assessmentId}`);
      const userAssessmentId = await storage.createUserAssessment(userAssessmentData);
      
      res.json({ 
        message: "Akses gratis berhasil dibuat",
        userAssessmentId
      });
      
    } catch (error) {
      console.error("Error creating direct access for free assessment:", error);
      res.status(500).json({ message: "Gagal membuat akses gratis" });
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

  // Admin login route
  app.post('/api/admin/login', async (req, res) => {
    try {
      const validatedData = adminLoginSchema.parse(req.body);
      
      // Get user by email
      const user = await storage.getUserByEmail(validatedData.email);
      if (!user || user.role !== 'admin') {
        return res.status(401).json({ message: "Kredensial admin tidak valid" });
      }

      // Verify password
      const isValidPassword = await AuthUtils.comparePassword(validatedData.password, user.password || '');
      if (!isValidPassword) {
        return res.status(401).json({ message: "Kredensial admin tidak valid" });
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

  // Update user
  app.patch('/api/admin/users/:userId', isAuthenticated, isAdmin, async (req, res) => {
    try {
      const userId = req.params.userId;
      const updates = userUpdateSchema.parse(req.body);
      
      const updatedUser = await storage.updateUser(userId, updates);
      
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
        const order = await storage.getOrder(numericOrderId);
        if (order) {
          console.log(`💳 Processing Midtrans payment completion for order ${numericOrderId}`);
          
          // Update order to completed
          await storage.updateOrderStatus(numericOrderId, 'completed', orderId, 'paid');
          console.log(`✅ Order ${numericOrderId} status updated to completed`);
          
          // Create user assessments
          for (const item of order.orderItems) {
            const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, order.id);
            if (!existingAssessment) {
              await storage.createUserAssessment({
                userId: order.userId,
                assessmentId: item.assessmentId,
                orderId: order.id,
                status: 'available'
              });
              console.log(`📚 Created assessment ${item.assessmentId} for user ${order.userId}`);
            } else {
              console.log(`⏭️ Assessment ${item.assessmentId} already exists for order ${order.id}`);
            }
          }
          
          console.log(`🎉 Midtrans: Order ${numericOrderId} completed successfully`);
        } else {
          console.log(`❌ Order ${numericOrderId} not found`);
        }
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
        await storage.updateOrderStatus(numericOrderId, 'completed', workingOrderId, 'paid');
        
        // Create user assessments if payment is successful
        for (const item of order.orderItems) {
          const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, order.id);
          if (!existingAssessment) {
            await storage.createUserAssessment({
              userId: order.userId,
              assessmentId: item.assessmentId,
              orderId: order.id,
              status: 'available'
            });
            console.log(`📚 Created assessment ${item.assessmentId} for user ${order.userId}`);
          }
        }
        
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
        
        // Create user assessments if they don't exist for this specific order
        if (order.orderItems) {
          for (const item of order.orderItems) {
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
      
      // Update order status to completed
      await storage.updateOrderStatus(orderId, 'completed', `midtrans_sim_${orderId}`, 'paid');
      console.log(`✅ Order ${orderId} status updated to completed via Midtrans simulation`);
      
      // Create user assessments for completed order
      if (order.orderItems) {
        for (const item of order.orderItems) {
          // Check if assessment exists for THIS SPECIFIC ORDER (allow multiple instances)
          const existingAssessment = await storage.getUserAssessmentByOrder(order.userId, item.assessmentId, orderId);
          if (!existingAssessment) {
            await storage.createUserAssessment({
              userId: order.userId,
              assessmentId: item.assessmentId,
              orderId: orderId,
              status: 'available' as const
            });
            assessmentsCreated++;
            console.log(`📚 Created assessment ${item.assessmentId} for user ${order.userId} order ${orderId}`);
          } else {
            console.log(`⏭️ Assessment ${item.assessmentId} already exists for order ${orderId}`);
          }
        }
      }
      
      res.json({ 
        message: 'Midtrans payment simulated successfully',
        orderId,
        status: 'completed',
        assessmentsCreated
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
      const { autoSyncOrders } = await import('./auto-sync');
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
  } catch (error) {
    console.error("Error initializing assessments:", error);
    throw error; // Re-throw to prevent silent failures
  }
}
