import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { db } from "@/lib/firebase";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  updateDoc,
} from "firebase/firestore";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useLanguage } from "@/contexts/LanguageContext";

type Product = {
  id: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  category: string;
  imageUrl?: string;
  brand?: string;
  prescription?: boolean;
  discount?: number;
  expiry?: string;
};

type OrderItem = {
  id?: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl?: string;
  prescription?: boolean;
};

type Order = {
  id: string;
  status: "pending" | "shipped" | "delivered" | "cancelled";
  userId: string;
  total: number;
  createdAt?: any;
  items?: OrderItem[];
  userEmail?: string;
  address?: string;
  phone?: string;
  deliveryDate?: string;
};

const emptyProduct = (): Omit<Product, "id"> => ({
  name: "",
  description: "",
  price: 0,
  stock: 0,
  category: "",
  imageUrl: "",
  brand: "",
  prescription: false,
  discount: undefined,
  expiry: "",
});

export default function EmartAdminDashboard() {
  const { user } = useAuth() as any;
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  // Product search
  const [productQuery, setProductQuery] = useState("");

  // Product CRUD form
  const [editingProductId, setEditingProductId] = useState<string | null>(null);
  const [productForm, setProductForm] = useState<Omit<Product, "id">>(emptyProduct());
  const [productSaving, setProductSaving] = useState(false);

  // Order listing behavior parity
  const [orderQuery, setOrderQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | Order["status"]>("all");
  const [page, setPage] = useState(1);
  const pageSize = 12;

  const getCreatedAtMs = (o: Order) => {
    const c = o.createdAt as any;
    if (!c) return 0;
    if (typeof c.toMillis === "function") return c.toMillis();
    const d = new Date(c);
    const ms = d.getTime();
    return Number.isFinite(ms) ? ms : 0;
  };

  const computeDeliveryDate = (o: Order) => {
    const ms = getCreatedAtMs(o);
    if (!ms) return null;
    const d = new Date(ms + 7 * 24 * 60 * 60 * 1000);
    return d.toISOString();
  };

  const refreshAll = async () => {
    const [pSnap, oSnap] = await Promise.all([
      getDocs(collection(db, "products")),
      getDocs(collection(db, "orders")),
    ]);

    setProducts(pSnap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })));
    setOrders(
      oSnap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
        deliveryDate: computeDeliveryDate({ id: d.id, ...(d.data() as any) } as Order),
      }))
    );
    setLoading(false);
  };

  useEffect(() => {
    if (!user || user.role !== "admin") {
      navigate("/login", { replace: true });
      return;
    }
    refreshAll().catch(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, navigate]);

  const filteredProducts = useMemo(() => {
    const q = productQuery.trim().toLowerCase();
    if (!q) return products;
    return products.filter((p) => `${p.name} ${p.category}`.toLowerCase().includes(q));
  }, [products, productQuery]);

  const ordersWithDerived = useMemo(() => {
    return [...orders]
      .map((o) => {
        const deliveryDate = o.deliveryDate || computeDeliveryDate(o) || undefined;
        return { ...o, deliveryDate };
      })
      .sort((a, b) => getCreatedAtMs(b) - getCreatedAtMs(a));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders]);

  const filteredOrders = useMemo(() => {
    const q = orderQuery.trim().toLowerCase();
    return ordersWithDerived.filter((o) => {
      if (statusFilter !== "all" && o.status !== statusFilter) return false;
      if (!q) return true;
      return (
        o.id.toLowerCase().includes(q) ||
        (o.userId || "").toLowerCase().includes(q) ||
        (o.userEmail || "").toLowerCase().includes(q)
      );
    });
  }, [ordersWithDerived, orderQuery, statusFilter]);

  const pagedOrders = filteredOrders.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.max(1, Math.ceil(filteredOrders.length / pageSize));

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { pending: 0, shipped: 0, delivered: 0, cancelled: 0 };
    for (const o of orders) {
      counts[o.status] = (counts[o.status] || 0) + 1;
    }
    return counts as Record<Order["status"], number>;
  }, [orders]);

  const getStatusBadge = (status: Order["status"]) => {
    switch (status) {
      case "delivered":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-green-100 text-green-800 border border-green-200">Delivered</span>;
      case "cancelled":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-red-100 text-red-800 border border-red-200">Cancelled</span>;
      case "shipped":
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-200">Shipped</span>;
      default:
        return <span className="px-2 py-1 rounded-full text-xs font-bold bg-orange-100 text-orange-800 border border-orange-200">Pending</span>;
    }
  };

  const canTransition = (current: Order["status"], next: Order["status"]) => {
    if (current === "pending") return next === "shipped" || next === "cancelled";
    if (current === "shipped") return next === "delivered" || next === "cancelled";
    return false; // delivered/cancelled are terminal
  };

  const updateOrder = async (orderId: string, status: Order["status"]) => {
    setLoading(true);
    try {
      await updateDoc(doc(db, "orders", orderId), { status });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
    } finally {
      setLoading(false);
    }
  };

  const resetProductForm = () => {
    setEditingProductId(null);
    setProductForm(emptyProduct());
  };

  const startEditProduct = (p: Product) => {
    setEditingProductId(p.id);
    setProductForm({
      name: p.name || "",
      description: p.description || "",
      price: Number(p.price) || 0,
      stock: Number(p.stock) || 0,
      category: p.category || "",
      imageUrl: p.imageUrl || "",
      brand: p.brand || "",
      prescription: Boolean(p.prescription),
      discount: p.discount,
      expiry: p.expiry || "",
    });
  };

  const saveProduct = async () => {
    if (productSaving) return;
    setProductSaving(true);
    try {
      const payload: Omit<Product, "id"> = {
        ...productForm,
        name: productForm.name.trim(),
        description: productForm.description?.trim(),
        category: productForm.category.trim(),
        imageUrl: productForm.imageUrl?.trim(),
        brand: productForm.brand?.trim(),
        price: Number(productForm.price) || 0,
        stock: Number(productForm.stock) || 0,
        prescription: Boolean(productForm.prescription),
      };

      if (!payload.name || !payload.category) {
        throw new Error("Product `name` and `category` are required.");
      }

      if (editingProductId) {
        await updateDoc(doc(db, "products", editingProductId), payload as any);
      } else {
        await addDoc(collection(db, "products"), payload as any);
      }

      await refreshAll();
      resetProductForm();
    } finally {
      setProductSaving(false);
    }
  };

  const deleteProduct = async (productId: string) => {
    const ok = confirm("Delete this product? This cannot be undone.");
    if (!ok) return;
    await deleteDoc(doc(db, "products", productId));
    await refreshAll();
    resetProductForm();
  };

  if (loading) return <div className="p-8">{t("emart.loadingAdmin")}</div>;

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("emart.adminTitle")}</h1>
        <Button onClick={() => navigate("/emart")}>{t("emart.backStore")}</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">Products: {products.length}</Card>
        <Card className="p-4">{t("emart.orders")}: {orders.length}</Card>
        <Card className="p-4">Pending: {statusCounts.pending}</Card>
      </div>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">{t("emart.productsCrud")}</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder={t("emart.searchProducts")}
            />

            <div className="space-y-2 max-h-[260px] overflow-auto pr-2">
              {filteredProducts.slice(0, 30).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between border rounded p-3 gap-2"
                >
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <div className="text-sm text-muted-foreground truncate">
                      {p.category} | Rs {p.price} | stock {p.stock}
                    </div>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <Button size="sm" variant="outline" onClick={() => startEditProduct(p)}>
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => deleteProduct(p.id)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="text-sm text-muted-foreground">{t("emart.noProductsMatch")}</div>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              {editingProductId ? `Editing: ${editingProductId.slice(0, 8)}` : t("emart.createProduct")}
            </div>

            <div className="space-y-2">
              <Input
                value={productForm.name}
                onChange={(e) => setProductForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Name *"
              />
              <Input
                value={productForm.category}
                onChange={(e) => setProductForm((p) => ({ ...p, category: e.target.value }))}
                placeholder="Category *"
              />
              <Input
                type="number"
                value={productForm.price}
                onChange={(e) => setProductForm((p) => ({ ...p, price: Number(e.target.value) }))}
                placeholder="Price"
              />
              <Input
                type="number"
                value={productForm.stock}
                onChange={(e) => setProductForm((p) => ({ ...p, stock: Number(e.target.value) }))}
                placeholder="Stock"
              />
              <Input
                value={productForm.imageUrl || ""}
                onChange={(e) => setProductForm((p) => ({ ...p, imageUrl: e.target.value }))}
                placeholder="Image URL"
              />
              <Input
                value={productForm.brand || ""}
                onChange={(e) => setProductForm((p) => ({ ...p, brand: e.target.value }))}
                placeholder="Brand"
              />
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={Boolean(productForm.prescription)}
                  onChange={(e) => setProductForm((p) => ({ ...p, prescription: e.target.checked }))}
                />
                <div className="text-sm">Prescription required</div>
              </div>
              <Textarea
                value={productForm.description || ""}
                onChange={(e) => setProductForm((p) => ({ ...p, description: e.target.value }))}
                placeholder="Description"
                rows={3}
              />

              <div className="flex gap-2">
                <Button onClick={saveProduct} disabled={productSaving}>
                  {editingProductId ? "Save Changes" : "Create Product"}
                </Button>
                {editingProductId && (
                  <Button variant="outline" onClick={resetProductForm} disabled={productSaving}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card className="p-4 space-y-4">
        <h2 className="font-semibold">Orders</h2>

        <div className="flex flex-col md:flex-row gap-3">
          <Input
            value={orderQuery}
            onChange={(e) => {
              setOrderQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Search orders by id or user..."
          />

          <div className="flex gap-2">
            {(["all", "pending", "shipped", "delivered", "cancelled"] as const).map((s) => (
              <Button
                key={s}
                size="sm"
                variant={statusFilter === s ? "default" : "outline"}
                onClick={() => {
                  setStatusFilter(s as any);
                  setPage(1);
                }}
              >
                {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
                {s !== "all" ? ` (${statusCounts[s as any] || 0})` : ""}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2 max-h-[420px] overflow-auto pr-2">
          {pagedOrders.map((o) => (
            <div
              key={o.id}
              className="flex items-start justify-between border rounded p-3 gap-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="font-medium truncate">#{o.id.slice(0, 8).toUpperCase()}</div>
                  {getStatusBadge(o.status)}
                </div>
                <div className="text-sm text-muted-foreground truncate">
                  user: {o.userId} | Rs {o.total}
                </div>
                <div className="text-xs text-muted-foreground">
                  {o.createdAt?.toDate ? (
                    <>Placed: {o.createdAt.toDate().toLocaleString("en-IN")}</>
                  ) : (
                    <>Placed: {o.createdAt ? new Date(o.createdAt).toLocaleString("en-IN") : "Unknown"}</>
                  )}
                  {o.deliveryDate ? <> | Delivery: {new Date(o.deliveryDate).toLocaleDateString("en-IN")}</> : null}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(`/emart/admin/orders/${o.id}`)}
                >
                  Open
                </Button>

                {canTransition(o.status, "shipped") && (
                  <Button size="sm" onClick={() => updateOrder(o.id, "shipped")}>
                    Ship
                  </Button>
                )}
                {canTransition(o.status, "delivered") && (
                  <Button size="sm" onClick={() => updateOrder(o.id, "delivered")}>
                    Deliver
                  </Button>
                )}
                {canTransition(o.status, "cancelled") && (
                  <Button size="sm" variant="destructive" onClick={() => updateOrder(o.id, "cancelled")}>
                    Cancel
                  </Button>
                )}
              </div>
            </div>
          ))}

          {pagedOrders.length === 0 && (
            <div className="text-sm text-muted-foreground">No orders match your filter.</div>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            Page {page} / {totalPages} (showing {pagedOrders.length} of {filteredOrders.length})
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Prev
            </Button>
            <Button size="sm" variant="outline" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              Next
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

