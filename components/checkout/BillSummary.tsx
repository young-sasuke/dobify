"use client"

import React from "react"

export type BillSummaryProps = {
  subtotal: number
  deliveryFee?: number
  expressFee?: number
  discount?: number
  tax?: number
  total: number
}

function formatINR(n: number) {
  try {
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(n)
  } catch {
    return `₹${n.toFixed(2)}`
  }
}

export default function BillSummary({ subtotal, deliveryFee = 0, expressFee = 0, discount = 0, tax = 0, total }: BillSummaryProps) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-6">
      <h3 className="font-semibold text-gray-900 text-sm sm:text-base mb-4">Bill Summary</h3>
      <div className="space-y-3">
        <div className="flex justify-between text-sm sm:text-base">
          <span>Subtotal</span>
          <span>{formatINR(subtotal)}</span>
        </div>
        {deliveryFee > 0 && (
          <div className="flex justify-between text-sm sm:text-base">
            <span>Delivery Fee</span>
            <span>{formatINR(deliveryFee)}</span>
          </div>
        )}
        {expressFee > 0 && (
          <div className="flex justify-between text-sm sm:text-base">
            <span>Express Fee</span>
            <span>{formatINR(expressFee)}</span>
          </div>
        )}
        {discount > 0 && (
          <div className="flex justify-between text-sm sm:text-base text-green-600">
            <span>Discount</span>
            <span>-{formatINR(discount)}</span>
          </div>
        )}
        {tax > 0 && (
          <div className="flex justify-between text-sm sm:text-base">
            <span>Tax</span>
            <span>{formatINR(tax)}</span>
          </div>
        )}
        <div className="border-t pt-3">
          <div className="flex items-center justify-between">
            <span className="text-lg sm:text-xl font-bold text-gray-900">Total</span>
            <span className="text-xl sm:text-2xl font-bold text-blue-600">{formatINR(total)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

