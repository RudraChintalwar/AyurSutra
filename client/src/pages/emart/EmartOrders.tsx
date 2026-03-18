import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { 
  Package, 
  CheckCircle, 
  XCircle, 
  Calendar,
  X,
  Truck,
  ShoppingBag,
  ChevronLeft
} from "lucide-react";
import { toast } from "sonner";
import { collection, query, where, getDocs, updateDoc, doc, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
  imageUrl: string;
  prescription?: boolean;
};

type Order = {
  id: string;
  userId: string;
  items: OrderItem[];
  total: number;
  status: 'pending' | 'shipped' | 'delivered' | 'cancelled';
  createdAt: Timestamp;
  deliveryDate: string;
  address: string;
  phone: string;
};

export default function EmartOrders() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user === null) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user?.uid) {
      const fetchOrders = async () => {
        try {
          const q = query(collection(db, "orders"), where("userId", "==", user.uid));
          const querySnapshot = await getDocs(q);
          const ordersData = querySnapshot.docs.map(docSnapshot => {
            const data = docSnapshot.data();
            // Calculate mock delivery date (7 days from order creation)
            const createdAtDate = data.createdAt ? data.createdAt.toDate() : new Date();
            const deliveryDateObj = new Date(createdAtDate.getTime() + 7 * 24 * 60 * 60 * 1000);
            
            return {
              id: docSnapshot.id,
              ...data,
              deliveryDate: deliveryDateObj.toISOString(),
            };
          }) as Order[];
          
          // Sort by newest first
          ordersData.sort((a, b) => {
             const tA = a.createdAt ? a.createdAt.toMillis() : 0;
             const tB = b.createdAt ? b.createdAt.toMillis() : 0;
             return tB - tA;
          });
          
          setOrders(ordersData);
        } catch (error) {
          console.error("Error fetching orders:", error);
          toast.error("Failed to load orders");
        } finally {
          setLoading(false);
        }
      };
      
      fetchOrders();
    }
  }, [user?.uid]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm("Are you sure you want to cancel this order?")) return;

    try {
      await updateDoc(doc(db, "orders", orderId), {
        status: "cancelled"
      });
      setOrders(orders.map(order => 
        order.id === orderId ? { ...order, status: "cancelled" } : order
      ));
      toast.success("Order cancelled successfully");
    } catch (error) {
      console.error("Error cancelling order:", error);
      toast.error("Failed to cancel order");
    }
  };

  const formatDate = (dateString?: string, timestamp?: Timestamp) => {
    let dateObj;
    if (timestamp) {
        dateObj = timestamp.toDate();
    } else if (dateString) {
        dateObj = new Date(dateString);
    } else {
        return "Unknown Date";
    }

    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    };
    return dateObj.toLocaleDateString('en-IN', options);
  };

  const getStatusBadge = (status: Order['status']) => {
    switch (status) {
      case 'delivered':
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-green-100 text-green-800 border border-green-200">Delivered</span>;
      case 'cancelled':
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-100 text-red-800 border border-red-200">Cancelled</span>;
      case 'shipped':
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-100 text-blue-800 border border-blue-200">Shipped</span>;
      default:
        return <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-200">Processing</span>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-5xl">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold font-playfair text-gray-900 flex items-center">
            <ShoppingBag className="w-8 h-8 mr-3 text-primary" />
            My Orders
          </h1>
          <button 
            onClick={() => navigate('/emart/products')}
            className="flex items-center text-muted-foreground hover:text-primary transition-colors font-medium text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Continue Shopping
          </button>
        </div>

        {orders.length === 0 ? (
          <div className="bg-white rounded-2xl shadow-sm border border-border p-10 text-center max-w-md mx-auto mt-12">
            <div className="mx-auto w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-border">
              <Package className="w-10 h-10 text-gray-400" />
            </div>
            <h2 className="text-2xl font-bold font-playfair text-gray-900 mb-3">No Orders Found</h2>
            <p className="text-muted-foreground mb-8">You haven't placed any orders with AyurVeda Mart yet.</p>
            <Link 
              to="/emart/products" 
              className="inline-block bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-sm"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-6">
            {orders.map(order => {
              const deliveryDate = new Date(order.deliveryDate);
              const today = new Date();
              const daysDifference = Math.floor((deliveryDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

              return (
                <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                  <div className="p-6 md:p-8">
                    {/* Header */}
                    <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4 mb-6 border-b border-border pb-6">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-bold font-mono text-gray-900">
                            #{order.id.slice(0, 8).toUpperCase()}
                          </h3>
                          {getStatusBadge(order.status)}
                        </div>
                        <p className="text-sm text-muted-foreground font-medium flex items-center">
                          <Calendar className="w-3.5 h-3.5 mr-1.5" />
                          Placed on {formatDate(undefined, order.createdAt)}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-bold font-playfair text-gray-900">₹{order.total.toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mt-1">
                          {order.items.reduce((sum, item) => sum + item.quantity, 0)} Items
                        </p>
                      </div>
                    </div>

                    {/* Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                      <div className="bg-gray-50/50 p-5 rounded-xl border border-border">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center text-sm uppercase tracking-wider">
                          <Truck className="w-4 h-4 mr-2 text-primary" />
                          Delivery Information
                        </h4>
                        <div className="space-y-3">
                          <p className="text-sm text-gray-700 leading-relaxed">
                            <span className="block text-xs font-bold text-muted-foreground uppercase mb-1">Address</span>
                            {order.address}
                          </p>
                          <p className="text-sm text-gray-700">
                            <span className="block text-xs font-bold text-muted-foreground uppercase mb-1">Contact</span>
                            {order.phone}
                          </p>
                        </div>
                      </div>

                      <div className="bg-gray-50/50 p-5 rounded-xl border border-border">
                        <h4 className="font-semibold text-gray-900 mb-4 flex items-center text-sm uppercase tracking-wider">
                          <Calendar className="w-4 h-4 mr-2 text-primary" />
                          Status Tracking
                        </h4>
                        {order.status === 'cancelled' ? (
                          <div className="flex items-start text-red-600 bg-red-50 p-3 rounded-lg border border-red-100">
                            <XCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium leading-relaxed">This order was cancelled and will not be delivered.</p>
                          </div>
                        ) : order.status === 'delivered' ? (
                          <div className="flex items-start text-green-700 bg-green-50 p-3 rounded-lg border border-green-100">
                            <CheckCircle className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                            <p className="text-sm font-medium leading-relaxed">Package delivered successfully.</p>
                          </div>
                        ) : (
                          <div>
                            <p className="text-sm font-semibold text-gray-900 mb-1">Expected Delivery</p>
                            <p className="text-primary font-bold mb-3">{formatDate(order.deliveryDate)}</p>
                            <p className={`text-xs font-medium px-2.5 py-1 w-fit rounded ${
                              daysDifference > 0 ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                            }`}>
                              {daysDifference > 0 
                                ? `${daysDifference} days remaining` 
                                : 'Arriving today'}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Items */}
                    <div>
                      <h4 className="font-bold text-gray-900 mb-4">Items Ordered</h4>
                      <div className="space-y-4">
                        {order.items.map(item => (
                          <div key={item.id} className="flex items-center bg-white border border-border p-4 rounded-xl">
                            <div className="w-16 h-16 bg-gray-50 border border-border rounded-lg p-2 mr-4 flex items-center justify-center flex-shrink-0">
                              <img 
                                src={item.imageUrl} 
                                alt={item.name} 
                                className="max-h-full max-w-full object-contain mix-blend-multiply"
                              />
                            </div>
                            <div className="flex-1">
                              <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-1">{item.name}</h3>
                              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Qty: {item.quantity}</p>
                            </div>
                            <div className="font-bold text-gray-900">
                              ₹{(item.price * item.quantity).toLocaleString()}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {order.status === 'pending' && (
                      <div className="mt-8 pt-6 border-t border-border flex justify-end">
                        <button
                          onClick={() => handleCancelOrder(order.id)}
                          className="px-5 py-2.5 rounded-xl flex items-center bg-white border border-red-200 text-red-600 font-semibold hover:bg-red-50 hover:border-red-300 transition-colors text-sm shadow-sm"
                        >
                          <X className="w-4 h-4 mr-2" />
                          Cancel Order
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
