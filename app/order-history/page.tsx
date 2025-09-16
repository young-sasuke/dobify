"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import CancelOrderButton from "@/components/orders/CancelOrderButton";
import OrderDetailsSheet from "@/components/orders/OrderDetailsSheet";

import {
  ArrowLeft,
  Package,
  Clock,
  CheckCircle,
  XCircle,
  Calendar,
  MapPin,
  RefreshCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";

type OrderItem = {
  id?: string | number;
  name?: string;
  serviceName?: string; // e.g. "Steam Iron (+₹15)"
  price?: number;       // base price
  servicePrice?: number; // add-on price
  quantity?: number;
  qty?: number;          // some payloads use qty
  image?: string;
};

interface Order {
  id: string;
  total_amount: string | number;
  order_status: string;
  pickup_date: string;
  delivery_date: string | null;
  payment_method: string | null;
  payment_status: string | null;
  delivery_address: string | null;
  created_at: string;
  pickup_slot_display_time: string | null;
  delivery_slot_display_time: string | null;
  items?: OrderItem[] | null;        // <<— JSONB from orders table
  delivery_fee?: number | null;      // if you add it later, it’ll be used
  discount?: number | null;          // optional
  tax?: number | null;               // optional
}

export default function OrderHistoryPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // details panel state
  const [openDetailsFor, setOpenDetailsFor] = useState<string | null>(null);

  useEffect(() => {
    loadOrderHistory();

    // Refresh when tab regains focus (good fallback if Realtime is off)
    const onFocus = () => loadOrderHistory(true);
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    // Setup Supabase Realtime subscription for current user
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const channel = supabase
        .channel(`orders:user:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setOrders((prev) => {
              const exists = prev.some((o) => o.id === (payload.new as any).id);
              if (exists) return prev;
              return [payload.new as Order, ...prev];
            });
          }
        )
        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "orders",
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            setOrders((prev) =>
              prev.map((o) =>
                o.id === (payload.new as any).id ? { ...o, ...(payload.new as any) } : o
              )
            );
          }
        )
        .subscribe();

      return () => {
        try { supabase.removeChannel(channel); } catch {}
      };
    })();
  }, []);

 async function loadOrderHistory(silent = false) {
  try {
    if (!silent) setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.push("/login");
      return;
    }

    const { data, error } = await supabase
      .from("orders")
      .select(`
        id,
        total_amount,
        order_status,
        pickup_date,
        delivery_date,
        payment_method,
        payment_status,
        delivery_address,
        created_at,
        pickup_slot_display_time,
        delivery_slot_display_time
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) throw error;

    setOrders((data ?? []) as Order[]);
  } catch (error) {
    console.error("Error loading orders:", error);
    if (!silent) toast.error("Error loading order history");
  } finally {
    if (!silent) setLoading(false);
  }
}


  const getStatusColor = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "delivered":
        return "bg-green-100 text-green-800";
      case "confirmed":
      case "picked_up":
        return "bg-blue-100 text-blue-800";
      case "processing":
        return "bg-yellow-100 text-yellow-800";
      case "cancelled":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch ((status || "").toLowerCase()) {
      case "delivered":
        return <CheckCircle className="w-4 h-4" />;
      case "cancelled":
        return <XCircle className="w-4 h-4" />;
      case "processing":
      case "confirmed":
        return <RefreshCcw className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });

  const formatCurrency = (amount: string | number) =>
    new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(
      Number(amount || 0)
    );


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="p-2">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Order History</h1>
              <p className="text-sm text-gray-600">View your past orders</p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6 max-w-3xl">
        {orders.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Package className="w-12 h-12 text-gray-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">No Orders Yet</h2>
            <p className="text-gray-600 mb-6">You haven&apos;t placed any orders yet.</p>
            <Button onClick={() => router.push("/")} className="bg-blue-600 hover:bg-blue-700">
              Start Shopping
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {orders.map((order) => (
              <Card key={order.id} className="rounded-2xl border bg-white shadow-sm hover:shadow-md transition-shadow">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        Order #{order.id}
                      </h3>
                      <p className="text-sm text-gray-600">{formatDate(order.created_at)}</p>
                    </div>
                    <Badge className={`${getStatusColor(order.order_status)} flex items-center gap-1 capitalize`}>
                      {getStatusIcon(order.order_status)}
                      {order.order_status}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Total */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Total Amount</span>
                    <span className="font-semibold text-gray-900">
                      {formatCurrency(order.total_amount)}
                    </span>
                  </div>

                  <Separator />

                  {/* Pickup / Delivery / Address */}
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-blue-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Pickup</p>
                        <p className="text-xs text-gray-600">
                          {formatDate(order.pickup_date)}
                          {order.pickup_slot_display_time && (
                            <span className="ml-2">{order.pickup_slot_display_time}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <Calendar className="w-4 h-4 text-green-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Delivery</p>
                        <p className="text-xs text-gray-600">
                          {order.delivery_date ? formatDate(order.delivery_date) : "—"}
                          {order.delivery_slot_display_time && (
                            <span className="ml-2">{order.delivery_slot_display_time}</span>
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <MapPin className="w-4 h-4 text-gray-600 mt-0.5" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">Delivery Address</p>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {order.delivery_address || "—"}
                        </p>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => setOpenDetailsFor(order.id)}
                    >
                      View Details
                    </Button>

                    {/* Cancel (auto-hides on success) */}
                    <CancelOrderButton
                      orderId={order.id}
                      status={order.order_status}
                      size="sm"
                      onCancelled={() =>
                        setOrders((prev) =>
                          prev.map((o) =>
                            o.id === order.id ? { ...o, order_status: "Cancelled" } : o
                          )
                        )
                      }
                    />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Details sheet */}
      {openDetailsFor && (
        <OrderDetailsSheet
          orderId={openDetailsFor}
          open={!!openDetailsFor}
          onOpenChange={(o) => setOpenDetailsFor(o ? openDetailsFor : null)}
        />
      )}
    </div>
  );
}
