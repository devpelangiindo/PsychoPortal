import { Link } from "wouter";
import { Facebook, Twitter, Linkedin } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-gradient-to-r from-green-600 to-green-700 text-white py-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-2xl font-bold mb-4">Rumah Psikologi Indonesia</h3>
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
          
          <div>
            <h4 className="text-lg font-semibold mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Kebijakan Privasi
                </a>
              </li>
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Syarat Layanan
                </a>
              </li>
              <li>
                <a href="#" className="text-green-50 hover:text-white transition-colors">
                  Kepatuhan HIPAA
                </a>
              </li>
            </ul>
          </div>
        </div>
        
        <div className="border-t border-white/20 mt-12 pt-8 text-center">
          <p className="text-green-50">
            &copy; 2024 Rumah Psikologi Indonesia. Seluruh hak cipta dilindungi.
          </p>
        </div>
      </div>
    </footer>
  );
}
