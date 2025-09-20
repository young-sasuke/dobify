'use client';

import Image from "next/image"
import { Mail, Phone, MapPin, Facebook, Twitter, Instagram } from "lucide-react"

export default function Footer() {
  return (
<footer className="row-start-3 mt-auto bg-gray-900 text-white pt-6 pb-[max(1rem,env(safe-area-inset-bottom))] w-full">
      <div className="container mx-auto px-3 sm:px-4 lg:px-6 py-8 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
          {/* Company Info */}
          <div className="lg:col-span-2">
            <div className="flex items-center mb-4">
              {/* Same logo as navbar */}
              <Image
                src="/brand/dobify-logo.jpg"
                alt="Dobify"
                width={260}
                height={96}
                className="h-auto max-h-12 sm:max-h-14 lg:max-h-16 w-auto object-contain"
                priority={false}
              />
            </div>

            <p className="text-gray-300 text-sm sm:text-base mb-4 sm:mb-6 max-w-md">
              Professional ironing and laundry services delivered to your doorstep. Quality care for all your garments
              with convenient pickup and delivery.
            </p>
            <div className="flex gap-3 sm:gap-4">
              <button aria-label="Facebook" className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors duration-200">
                <Facebook className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button aria-label="Twitter" className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors duration-200">
                <Twitter className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <button aria-label="Instagram" className="w-8 h-8 sm:w-10 sm:h-10 bg-gray-800 rounded-full flex items-center justify-center hover:bg-blue-600 transition-colors duration-200">
                <Instagram className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
          </div>

          {/* Quick Links */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Quick Links</h3>
            <ul className="space-y-2 text-sm sm:text-base">
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">About Us</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">Services</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">Pricing</a></li>
              <li><a href="#" className="text-gray-300 hover:text-white transition-colors duration-200">Contact</a></li>
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h3 className="font-semibold text-base sm:text-lg mb-3 sm:mb-4">Contact Us</h3>
            <div className="space-y-2 sm:space-y-3 text-sm sm:text-base">
              <div className="flex items-center gap-2 sm:gap-3 text-gray-300">
                <Phone className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span>+91 98765 43210</span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 text-gray-300">
                <Mail className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span>support@ironxpress.com</span>
              </div>
              <div className="flex items-start gap-2 sm:gap-3 text-gray-300">
                <MapPin className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0 mt-0.5" />
                <span>Gurgaon, Haryana, India</span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-800 mt-8 sm:mt-12 pt-6 sm:pt-8 text-center">
          <p className="text-gray-400 text-xs sm:text-sm">© 2024 Dobify. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
