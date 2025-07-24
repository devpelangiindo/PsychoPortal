import { Link } from "wouter";
import { Facebook, Instagram } from "lucide-react";
import { FaWhatsapp } from "react-icons/fa";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-green-600 to-green-700 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8 lg:gap-12">
          <div>
            <div className="flex items-center space-x-3 mb-4">
              <img 
                src={logoPath} 
                alt="Rumah Psikologi Pelangi Indonesia" 
                className="h-12 w-12 object-contain"
              />
              <h3 className="font-bold text-[20px] leading-tight">
                Rumah Psikologi<br />
                Pelangi Indonesia
              </h3>
            </div>
            <p className="text-green-50 mb-4">
              Platform asesmen psikologi profesional untuk praktisi dan peneliti modern.
            </p>
            <div className="flex space-x-4">
              <a href="#" className="text-green-100 hover:text-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
              <a href="https://www.instagram.com/rumahpsikologi_pi/" target="_blank" rel="noopener noreferrer" className="text-green-100 hover:text-white transition-colors">
                <Instagram className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Asesmen</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/assessments" className="text-green-50 hover:text-white transition-colors">
                  Profil Sensori
                </Link>
              </li>
              <li>
                <Link href="/assessments" className="text-green-50 hover:text-white transition-colors">
                  Inventori Gaya Belajar
                </Link>
              </li>
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Asesmen Kustom
                </a>
              </li>
            </ul>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Alamat</h4>
            <div className="space-y-4">
              <div className="text-green-50">
                <p className="font-medium mb-1">Cabang Sleman</p>
                <p className="text-sm leading-relaxed">
                  Jl. Colombo No. 8, Samirono Baru, Caturtunggal, Depok, Sleman, Yogyakarta, 55281
                </p>
              </div>
              <div className="text-green-50">
                <p className="font-medium mb-1">Cabang Bantul</p>
                <p className="text-sm leading-relaxed">
                  Jl. Mgr. Sugiyo Pranoto No. 14, Melikan Kidul, Bantul, Bantul, Yogyakarta, 55711
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <h5 className="text-md font-medium mb-3">Bantuan</h5>
              <ul className="space-y-2">
                <li>
                  <a href="https://wa.me/6281991466546" target="_blank" rel="noopener noreferrer" className="text-green-50 hover:text-white transition-colors">
                    <div className="flex items-center">
                      <FaWhatsapp className="w-4 h-4 mr-2" />
                      <div>
                        <div className="text-sm">Penjadwalan Konsultasi Online</div>
                        <div className="text-xs text-green-100">081991466546</div>
                      </div>
                    </div>
                  </a>
                </li>
                <li>
                  <a href="https://wa.me/628812715451" target="_blank" rel="noopener noreferrer" className="text-green-50 hover:text-white transition-colors">
                    <div className="flex items-center">
                      <FaWhatsapp className="w-4 h-4 mr-2" />
                      <div>
                        <div className="text-sm">Dukungan Teknis</div>
                        <div className="text-xs text-green-100">08812715451</div>
                      </div>
                    </div>
                  </a>
                </li>
              </ul>
            </div>
          </div>
          
          
        </div>
        
        <div className="border-t border-white/20 mt-12 pt-8 text-center">
          <p className="text-green-50">© 2025 Rumah Psikologi Pelangi Indonesia. Seluruh hak cipta dilindungi.</p>
        </div>
      </div>
    </footer>
  );
}
