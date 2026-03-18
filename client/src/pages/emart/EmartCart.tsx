import React, { useEffect } from "react";
import { useCart } from "@/contexts/CartContext";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { 
  ShoppingCart, 
  Trash2, 
  ChevronLeft,
  Plus,
  Minus,
  Truck,
  Shield,
  Medal,
  Pill
} from "lucide-react";

export default function EmartCart() {
  const { cart, updateQuantity, removeFromCart, clearCart } = useCart();
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user === null) navigate("/login");
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const deliveryFee = subtotal >= 500 ? 0 : 50;
  const total = subtotal + deliveryFee;

  const handleQuantityChange = (id: string, newQuantity: number) => {
    if (newQuantity < 1) return;
    const cartItem = cart.find(item => item.id === id);
    if (cartItem && cartItem.maxQuantity && newQuantity > cartItem.maxQuantity) {
      toast.error(`Maximum ${cartItem.maxQuantity} allowed per order`);
      return;
    }
    updateQuantity(id, newQuantity);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-24 pb-12">
      <div className="container mx-auto px-4 max-w-6xl">
        {/* Back Button */}
        <div className="flex justify-between items-center mb-6">
          <button 
            onClick={() => navigate('/emart/products')}
            className="flex items-center text-muted-foreground hover:text-primary transition-colors font-medium text-sm"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Continue Shopping
          </button>
          
          {cart.length > 0 && (
            <button
              onClick={() => {
                clearCart();
                toast.success("Cart cleared successfully");
              }}
              className="text-red-500 hover:text-red-700 text-sm flex items-center bg-red-50 px-3 py-1.5 rounded-lg border border-red-100 transition-colors font-medium"
            >
              <Trash2 className="w-4 h-4 mr-1.5" />
              Clear Cart
            </button>
          )}
        </div>

        {/* Main Cart Section */}
        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden">
          <div className="p-6 md:p-10">
            <h1 className="text-3xl font-bold font-playfair text-gray-900 mb-8 flex items-center">
              <ShoppingCart className="w-8 h-8 mr-3 text-primary" />
              Your Shopping Cart ({cart.reduce((total, item) => total + item.quantity, 0)} items)
            </h1>

            {cart.length === 0 ? (
              <div className="text-center py-16 px-4">
                <div className="mx-auto w-24 h-24 bg-gray-50 rounded-full flex items-center justify-center mb-6 border border-border">
                  <ShoppingCart className="w-10 h-10 text-gray-300" />
                </div>
                <h2 className="text-2xl font-playfair font-bold text-gray-900 mb-3">Your cart is empty</h2>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">Looks like you haven't added any Ayurvedic remedies to your cart yet.</p>
                <Link 
                  to="/emart/products" 
                  className="inline-block bg-primary text-primary-foreground px-8 py-3.5 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-sm"
                >
                  Browse Products
                </Link>
              </div>
            ) : (
              <div className="flex flex-col lg:flex-row gap-10">
                {/* Cart Items */}
                <div className="lg:w-2/3">
                  <div className="divide-y divide-border">
                    {cart.map((item) => (
                      <div key={item.id} className="py-6 flex flex-col sm:flex-row gap-6">
                        <div className="flex-shrink-0">
                          <div className="w-28 h-28 bg-gray-50 rounded-xl border border-border p-3 flex items-center justify-center">
                            <img 
                              src={item.imageUrl} 
                              alt={item.name} 
                              className="max-h-full max-w-full object-contain mix-blend-multiply"
                            />
                          </div>
                        </div>
                        <div className="flex-1 flex flex-col">
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <h2 className="font-semibold text-lg text-gray-900 leading-tight mb-1">{item.name}</h2>
                              {item.brand && (
                                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{item.brand}</p>
                              )}
                              {item.prescription && (
                                <div className="inline-flex items-center mt-2 px-2.5 py-1 bg-red-50 text-red-700 text-[10px] font-bold uppercase tracking-wider rounded border border-red-100">
                                  <Pill className="w-3 h-3 mr-1" />
                                  Rx Required
                                </div>
                              )}
                            </div>
                            <p className="font-bold text-lg text-primary">₹{(item.price * item.quantity).toLocaleString()}</p>
                          </div>
                          
                          <div className="flex items-end justify-between mt-auto pt-4">
                            <div className="flex items-center">
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mr-3">Qty:</span>
                              <div className="flex items-center border border-border rounded-lg bg-white overflow-hidden shadow-sm h-9">
                                <button 
                                  onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                  className="px-3 h-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-r border-border flex items-center justify-center"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <input
                                  type="number"
                                  min={1}
                                  max={item.maxQuantity || 10}
                                  value={item.quantity}
                                  onChange={(e) => handleQuantityChange(item.id, parseInt(e.target.value) || 1)}
                                  className="w-12 text-center text-sm font-semibold border-0 focus:ring-0 p-0"
                                />
                                <button 
                                  onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                  className="px-3 h-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-l border-border flex items-center justify-center"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                            
                            <button
                              onClick={() => {
                                removeFromCart(item.id);
                                toast.success(`${item.name} removed from cart`);
                              }}
                              className="text-muted-foreground hover:text-red-500 text-sm flex items-center font-medium transition-colors"
                            >
                              <Trash2 className="w-4 h-4 mr-1.5" />
                              Remove
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Order Summary */}
                <div className="lg:w-1/3">
                  <div className="bg-gray-50/50 rounded-2xl p-6 lg:p-8 border border-border sticky top-24">
                    <h2 className="text-xl font-bold font-playfair text-gray-900 mb-6">Order Summary</h2>
                    
                    <div className="space-y-4 mb-6">
                      <div className="flex justify-between text-muted-foreground text-sm">
                        <span>Cart Subtotal</span>
                        <span className="font-semibold text-gray-900">₹{subtotal.toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground text-sm">
                        <span>Delivery Fee</span>
                        <span className="font-semibold text-gray-900">
                          {deliveryFee === 0 ? (
                            <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded font-bold text-xs uppercase tracking-wider">Free</span>
                          ) : (
                            `₹${deliveryFee.toLocaleString()}`
                          )}
                        </span>
                      </div>
                    </div>
                    
                    {subtotal < 500 && (
                      <div className="mb-6 bg-orange-50 border border-orange-100 text-orange-800 text-xs px-3 py-2.5 rounded-lg flex items-start">
                        <Truck className="w-4 h-4 mr-2 flex-shrink-0 mt-0.5" />
                        <p>Add <strong>₹{(500 - subtotal).toLocaleString()}</strong> more to your cart to get free delivery.</p>
                      </div>
                    )}
                    
                    <div className="border-t border-border pt-4 mb-8">
                      <div className="flex justify-between items-end">
                        <span className="font-bold text-gray-900">Total Amount</span>
                        <div className="text-right">
                          <span className="text-2xl font-bold font-playfair text-primary">₹{total.toLocaleString()}</span>
                          <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Inclusive of all taxes</p>
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => navigate("/emart/checkout")}
                      className="w-full py-4 bg-primary text-primary-foreground rounded-xl font-bold shadow-sm hover:shadow-md hover:bg-primary/95 transition-all text-sm uppercase tracking-wider"
                    >
                      Proceed to Checkout
                    </button>

                    {/* Trust Badges */}
                    <div className="grid grid-cols-3 gap-3 mt-8">
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border shadow-sm">
                        <Truck className="w-5 h-5 text-primary mb-2" />
                        <span className="text-[10px] text-center font-semibold text-muted-foreground uppercase tracking-wider">Fast Delivery</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border shadow-sm">
                        <Shield className="w-5 h-5 text-accent mb-2" />
                        <span className="text-[10px] text-center font-semibold text-muted-foreground uppercase tracking-wider">Secure Payment</span>
                      </div>
                      <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-border shadow-sm">
                        <Medal className="w-5 h-5 text-green-600 mb-2" />
                        <span className="text-[10px] text-center font-semibold text-muted-foreground uppercase tracking-wider">Quality Assured</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
