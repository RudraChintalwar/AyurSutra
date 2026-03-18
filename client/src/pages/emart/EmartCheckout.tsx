import React, { useEffect, useState } from "react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { toast } from "sonner";
import { 
  ShoppingCart, 
  ChevronLeft,
  Truck,
  Shield,
  Medal,
  User,
  Phone,
  Calendar,
  CreditCard,
  MapPin,
  CheckCircle2,
  Package
} from "lucide-react";

export default function EmartCheckout() {
  const { cart, clearCart } = useCart();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    age: "",
    address: "",
    paymentMethod: "cod"
  });

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user === null) navigate("/login");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user && formData.name === "") {
      setFormData(prev => ({
        ...prev,
        name: user.name || "",
        phone: user.phone || "",
        age: user.age ? String(user.age) : ""
      }));
    }
  }, [user]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (cart.length === 0 && !orderPlaced) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-24 pb-12 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-border p-10 max-w-md text-center">
          <div className="mx-auto w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6">
            <ShoppingCart className="w-10 h-10 text-gray-400" />
          </div>
          <h2 className="text-2xl font-bold font-playfair text-gray-900 mb-3">Your cart is empty</h2>
          <p className="text-muted-foreground mb-8">Please add some products to proceed to checkout.</p>
          <Link 
            to="/emart/products" 
            className="inline-block bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-sm"
          >
            Browse Products
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 500 ? 0 : 50;
  const total = subtotal + deliveryFee;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) return;
    setIsSubmitting(true);

    try {
      const docRef = await addDoc(collection(db, "orders"), {
        userId: user?.uid,
        userEmail: user?.email,
        ...formData,
        items: cart,
        subtotal,
        deliveryFee,
        total,
        status: "pending",
        createdAt: serverTimestamp()
      });

      setOrderId(docRef.id);
      setOrderPlaced(true);
      setShowSuccessModal(true);
    } catch (err: any) {
      console.error("Order failed:", err);
      toast.error("Failed to place order: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSuccessModalClose = () => {
    clearCart();
    setShowSuccessModal(false);
    navigate("/emart/orders");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-24 pb-12">
      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 bg-white/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in duration-300">
          <div className="bg-white rounded-2xl shadow-xl border border-border max-w-md w-full p-10 text-center animate-in zoom-in-95 duration-300">
            <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-50 mb-6 border border-green-100">
              <CheckCircle2 className="h-10 w-10 text-green-500" />
            </div>
            <h2 className="text-3xl font-bold font-playfair text-gray-900 mb-3">Order Confirmed!</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for trusting AyurVeda Mart. Your medicines will be delivered soon.
            </p>
            {orderId && (
              <div className="bg-gray-50 border border-border rounded-lg p-3 mb-8">
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold mb-1">Order ID</p>
                <p className="font-mono font-medium text-gray-900">{orderId}</p>
              </div>
            )}
            <button
              onClick={handleSuccessModalClose}
              className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold hover:bg-primary/90 transition-all shadow-sm"
            >
              View My Orders
            </button>
          </div>
        </div>
      )}

      <div className="container mx-auto px-4 max-w-6xl">
        <div className="flex justify-start mb-6">
          <button 
            onClick={() => navigate('/emart/cart')}
            className="flex items-center text-muted-foreground hover:text-primary transition-colors font-medium text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back to Cart
          </button>
        </div>

        {!showSuccessModal && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Checkout Form */}
            <div className="lg:w-2/3">
              <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
                <div className="p-6 md:p-10">
                  <h1 className="text-2xl font-bold font-playfair text-gray-900 mb-8 pb-4 border-b border-border">
                    Delivery Information
                  </h1>

                  <form onSubmit={handleSubmit} className="space-y-8">
                    <div className="space-y-5">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-700">Full Name</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <User className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <input
                              type="text"
                              name="name"
                              placeholder="Enter your full name"
                              value={formData.name}
                              onChange={handleChange}
                              required
                              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm font-medium"
                            />
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-sm font-semibold text-gray-700">Mobile Number</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                              <Phone className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <input
                              type="tel"
                              name="phone"
                              placeholder="10-digit mobile number"
                              value={formData.phone}
                              onChange={handleChange}
                              required
                              className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm font-medium"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2 max-w-xs">
                        <label className="text-sm font-semibold text-gray-700">Age</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <Calendar className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <input
                            type="number"
                            name="age"
                            placeholder="Patient's age"
                            min="1"
                            max="120"
                            value={formData.age}
                            onChange={handleChange}
                            required
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm font-medium"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-sm font-semibold text-gray-700">Delivery Address</label>
                        <div className="relative">
                          <div className="absolute top-3.5 left-0 pl-3.5 flex items-start pointer-events-none">
                            <MapPin className="w-4 h-4 text-muted-foreground" />
                          </div>
                          <textarea
                            name="address"
                            placeholder="House No., Building Name, Street, Area, Landmark, City, Pincode"
                            value={formData.address}
                            onChange={handleChange}
                            required
                            rows={3}
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-border rounded-xl focus:ring-2 focus:ring-primary focus:bg-white transition-all text-sm font-medium resize-y"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-border">
                      <h2 className="text-xl font-bold font-playfair text-gray-900 mb-6">Payment Method</h2>
                      <div className="space-y-4">
                        <div className="flex items-center p-5 border-2 border-primary bg-primary/5 rounded-xl transition-all cursor-pointer">
                          <input
                            type="radio"
                            id="cod"
                            name="paymentMethod"
                            value="cod"
                            checked={formData.paymentMethod === "cod"}
                            onChange={() => setFormData({ ...formData, paymentMethod: "cod" })}
                            className="w-5 h-5 text-primary border-gray-300 focus:ring-primary accent-primary"
                          />
                          <label htmlFor="cod" className="ml-3 flex items-center w-full cursor-pointer">
                            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center mr-3">
                              <CreditCard className="w-5 h-5 text-gray-700" />
                            </div>
                            <div>
                              <span className="block text-gray-900 font-bold">Cash on Delivery</span>
                              <span className="block text-xs text-muted-foreground mt-0.5">Pay when your order arrives</span>
                            </div>
                          </label>
                        </div>
                        
                        <div className="flex items-center p-5 border border-border bg-gray-50 rounded-xl opacity-60 cursor-not-allowed">
                          <input
                            type="radio"
                            disabled
                            className="w-5 h-5 text-gray-400 border-gray-300"
                          />
                          <label className="ml-3 flex items-center w-full cursor-not-allowed">
                            <div className="w-10 h-10 rounded-full bg-white border border-border flex items-center justify-center mr-3">
                              <Shield className="w-5 h-5 text-gray-400" />
                            </div>
                            <div>
                              <span className="block text-gray-500 font-bold">Online Payment</span>
                              <span className="block text-xs text-gray-400 mt-0.5">Coming soon</span>
                            </div>
                          </label>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6">
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className={`w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold uppercase tracking-wider text-sm transition-all shadow-md ${
                          isSubmitting ? 'opacity-70 cursor-not-allowed shadow-none' : 'hover:bg-primary/95 hover:shadow-lg active:scale-[0.99]'
                        }`}
                      >
                        {isSubmitting ? (
                          <span className="flex items-center justify-center">
                            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                            Processing...
                          </span>
                        ) : 'Confirm Order'}
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:w-1/3">
              <div className="bg-gray-50/50 rounded-2xl p-6 lg:p-8 border border-border sticky top-24">
                <h2 className="text-xl font-bold font-playfair text-gray-900 mb-6">Order Summary</h2>

                <div className="space-y-4 mb-6 max-h-64 overflow-y-auto custom-scrollbar pr-2">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-16 h-16 bg-white border border-border rounded-lg p-2 flex-shrink-0 flex items-center justify-center">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="max-h-full max-w-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <h3 className="text-sm font-semibold text-gray-900 line-clamp-2 leading-tight mb-1">{item.name}</h3>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-muted-foreground font-medium">Qty: {item.quantity}</span>
                          <span className="font-bold text-gray-900">₹{(item.price * item.quantity).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-6 border-t border-border mb-6 text-sm">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span className="font-semibold text-gray-900">₹{subtotal.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span>Delivery</span>
                    <span className="font-semibold">
                      {deliveryFee === 0 ? (
                        <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded font-bold text-[10px] uppercase tracking-wider">Free</span>
                      ) : (
                        `₹${deliveryFee.toLocaleString()}`
                      )}
                    </span>
                  </div>
                  {subtotal < 500 && (
                    <div className="text-xs text-orange-600 bg-orange-50 px-3 py-2 rounded-lg mt-2 font-medium">
                      Add ₹{(500 - subtotal).toLocaleString()} more for free delivery
                    </div>
                  )}
                </div>
                
                <div className="border-t border-border pt-4">
                  <div className="flex justify-between items-end">
                    <span className="font-bold text-gray-900">Total</span>
                    <span className="text-2xl font-bold font-playfair text-primary">₹{total.toLocaleString()}</span>
                  </div>
                </div>

                {/* Trust Badges */}
                <div className="grid grid-cols-2 gap-3 mt-8">
                  <div className="flex items-center p-3 bg-white rounded-xl border border-border shadow-sm">
                    <Truck className="w-6 h-6 text-primary mr-3 flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Fast<br/>Delivery</span>
                  </div>
                  <div className="flex items-center p-3 bg-white rounded-xl border border-border shadow-sm">
                    <Shield className="w-6 h-6 text-accent mr-3 flex-shrink-0" />
                    <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider leading-tight">Secure<br/>Checkout</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
