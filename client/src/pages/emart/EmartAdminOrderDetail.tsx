import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/contexts/LanguageContext";

type OrderItem = {
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
};

type Order = {
  id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  userId: string;
  total: number;
  createdAt?: any;
  items?: OrderItem[];
  address?: string;
  phone?: string;
  userEmail?: string;
};

const getCreatedAtMs = (createdAt: any) => {
  if (!createdAt) return 0;
  if (typeof createdAt.toMillis === "function") return createdAt.toMillis();
  const d = new Date(createdAt);
  const ms = d.getTime();
  return Number.isFinite(ms) ? ms : 0;
};

const canTransition = (current: Order["status"], next: Order["status"]) => {
  if (current === "pending") return next === "shipped" || next === "cancelled";
  if (current === "shipped") return next === "delivered" || next === "cancelled";
  return false;
};

export default function EmartAdminOrderDetail() {
  const { user } = useAuth() as any;
  const { t, language } = useLanguage();
  const { orderId } = useParams();
  const navigate = useNavigate();

  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login", { replace: true });
      return;
    }
    if (!orderId) return;

    getDoc(doc(db, "orders", orderId))
      .then((snap) => {
        if (!snap.exists()) {
          navigate("/emart/admin", { replace: true });
          return;
        }
        setOrder({ id: snap.id, ...(snap.data() as any) } as Order);
      })
      .finally(() => setLoading(false));
  }, [user, orderId, navigate]);

  const deliveryDateIso = useMemo(() => {
    if (!order?.createdAt) return null;
    const ms = getCreatedAtMs(order.createdAt);
    if (!ms) return null;
    return new Date(ms + 7 * 24 * 60 * 60 * 1000).toISOString();
  }, [order?.createdAt]);

  const createdAtText = useMemo(() => {
    if (!order?.createdAt) return "Unknown";
    const ms = getCreatedAtMs(order.createdAt);
    if (!ms) return "Unknown";
    return new Date(ms).toLocaleString(language === "hi" ? "hi-IN" : "en-IN");
  }, [order?.createdAt]);

  const setStatus = async (status: Order["status"]) => {
    if (!orderId || !order) return;
    if (!canTransition(order.status, status)) return;
    await updateDoc(doc(db, "orders", orderId), { status });
    setOrder((prev) => (prev ? { ...prev, status } : prev));
  };

  if (loading) return <div className="p-8">{t("emart.loadingOrder")}</div>;
  if (!order) return null;

  const canShip = canTransition(order.status, "shipped");
  const canDeliver = canTransition(order.status, "delivered");
  const canCancel = canTransition(order.status, "cancelled");

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">
          Order #{order.id.slice(0, 8).toUpperCase()}
        </h1>
        <Button variant="outline" onClick={() => navigate("/emart/admin")}>
          {t("emart.back")}
        </Button>
      </div>

      <Card className="p-4 space-y-2">
        <div>User: {order.userId}</div>
        {order.userEmail ? <div>Email: {order.userEmail}</div> : null}
        <div>Total: Rs {order.total}</div>
        <div>Status: {order.status}</div>
        <div>{t("emart.placedOn")}: {createdAtText}</div>
        {deliveryDateIso ? <div>{t("emart.estimatedDelivery")}: {new Date(deliveryDateIso).toLocaleDateString(language === "hi" ? "hi-IN" : "en-IN")}</div> : null}
        <div>Address: {order.address}</div>
        <div>Phone: {order.phone}</div>
      </Card>

      <Card className="p-4 space-y-3">
        <div className="font-semibold">{t("emart.items")}</div>
        {(order.items || []).length === 0 ? (
          <div className="text-sm text-muted-foreground">{t("emart.noItemsOrder")}</div>
        ) : (
          <div className="space-y-2">
            {order.items?.map((it, idx) => (
              <div
                key={`${it.name}-${idx}`}
                className="flex items-center justify-between border rounded p-3"
              >
                <div className="min-w-0">
                  <div className="font-medium truncate">{it.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Qty: {it.quantity} | Rs {it.price}
                  </div>
                </div>
                <div className="font-medium">Rs {it.price * it.quantity}</div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-4 flex gap-2 flex-wrap">
        {canShip && (
          <Button onClick={() => setStatus("shipped")}>{t("emart.markShipped")}</Button>
        )}
        {canDeliver && (
          <Button onClick={() => setStatus("delivered")}>{t("emart.markDelivered")}</Button>
        )}
        {canCancel && (
          <Button variant="destructive" onClick={() => setStatus("cancelled")}>
            {t("emart.cancel")}
          </Button>
        )}
        {!(canShip || canDeliver || canCancel) && (
          <div className="text-sm text-muted-foreground">
            {t("emart.noActions")}
          </div>
        )}
      </Card>
    </div>
  );
}

