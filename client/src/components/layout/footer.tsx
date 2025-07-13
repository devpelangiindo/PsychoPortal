import { Link } from "wouter";
import { Facebook, Twitter, Linkedin } from "lucide-react";
import logoPath from "@assets/Logo_Rumah_Psikologi_Pelangi_Indonesia_1752037860440.png";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-green-600 to-green-700 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-3 gap-8">
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
                <Twitter className="w-5 h-5" />
              </a>
              <a href="#" className="text-green-100 hover:text-white transition-colors">
                <Linkedin className="w-5 h-5" />
              </a>
              <a href="#" className="text-green-100 hover:text-white transition-colors">
                <Facebook className="w-5 h-5" />
              </a>
            </div>
          </div>
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Asesmen</h4>
            <ul className="space-y-2">
              <li>
                <Link href="/assessments" className="text-green-50 hover:text-white transition-colors">
                  Profil Sensoris
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
            <h4 className="text-lg font-semibold mb-4">Bantuan</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Pusat Bantuan
                </a>
              </li>
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Hubungi Kami
                </a>
              </li>
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Dukungan Teknis
                </a>
              </li>
            </ul>
          </div>
          
          
        </div>
        
        <div className="border-t border-white/20 mt-12 pt-8 text-center">
          <p className="text-green-50">© 2025 Rumah Psikologi Pelangi Indonesia. Seluruh hak cipta dilindungi.</p>
        </div>
      </div>
    </footer>
  );
}
