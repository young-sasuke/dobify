"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { isOrderCancellable, normalizeOrderStatus } from "@/lib/order";

type Props = {
  orderId: string;
  status?: string | null;                 // pass order.order_status (or status)
  onCancelled?: () => void;              // parent ko local state patch karna ho
  className?: string;
  size?: "sm" | "default" | "lg";
};

export default function CancelOrderButton({
  orderId,
  status,
  onCancelled,
  className,
  size = "sm",
}: Props) {
  const [localStatus, setLocalStatus] = useState(() => normalizeOrderStatus(status));
  const [loading, setLoading] = useState(false);

  // agar cancellable hi nahi, to button mat dikhao
  if (!isOrderCancellable(localStatus)) return null;

  const handleCancel = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/orders/cancel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: orderId }), // ⚠️ aapke API ke hisaab se
      });

      const json = await res.json().catch(() => ({} as any));

      if (!res.ok) {
        toast.error(json?.error || "Unable to cancel order");
        return;
        }

      // success → local status update (button turant hide ho jayega)
      setLocalStatus("cancelled");
      toast.success("Order cancelled");
      onCancelled?.();
    } catch {
      toast.error("Network error while cancelling");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      variant="destructive"
      size={size}
      className={className}
      disabled={loading}
      onClick={handleCancel}
    >
      {loading ? "Cancelling…" : "Cancel Order"}
    </Button>
  );
}
