import React, { useEffect, useState } from "react";
import { doc, getDoc, collection, query, where, limit, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { toast } from "sonner";
import { 
  ShoppingCart, 
  Heart, 
  Share2, 
  Star, 
  ChevronLeft,
  Pill,
  Leaf,
  Stethoscope,
  HeartPulse,
  ShieldCheck,
  Shield,
  Activity,
  Truck,
  Medal,
  CheckCircle,
  X,
  ChevronDown,
  ChevronUp,
  Package
} from "lucide-react";

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  imageUrl: string;
  category: string;
  brand?: string;
  prescription?: boolean;
  rating?: number;
  discount?: number;
  expiry?: string;
}

const getCategoryIcon = (category: string) => {
  switch(category) {
    case 'Classical Medicines': return Pill;
    case 'Proprietary Formulations': return Activity;
    case 'Oils & Ghritas': return Leaf;
    case 'Herbal Supplements': return Leaf;
    case 'Personal Care': return HeartPulse;
    case 'Immunity Boosters': return ShieldCheck;
    default: return Package;
  }
};

export default function EmartProductDetail() {
  const { productId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const { addToCart, updateQuantity, removeFromCart, cart } = useCart();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [qty, setQty] = useState(1);
  const [expandedDetails, setExpandedDetails] = useState({
    description: true,
    specifications: false,
    shipping: false,
    reviews: false
  });
  const [wishlist, setWishlist] = useState(false);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [showCartPopup, setShowCartPopup] = useState(false);

  const translateCategory = (category: string) => {
    const categoryMap: Record<string, string> = {
      'Classical Medicines': t('emart.cat.classical'),
      'Proprietary Formulations': t('emart.cat.proprietary'),
      'Oils & Ghritas': t('emart.cat.oils'),
      'Herbal Supplements': t('emart.cat.supplements'),
      'Personal Care': t('emart.cat.personal'),
      'Immunity Boosters': t('emart.cat.immunity'),
    };
    return categoryMap[category] || category;
  };

  useEffect(() => {
    if (!authLoading && user === null) navigate("/login");
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && productId) {
      const fetchProduct = async () => {
        try {
          setLoading(true);
          const ref = doc(db, "products", productId);
          const snap = await getDoc(ref);
          
          if (snap.exists()) {
            const productData = { id: snap.id, ...snap.data() } as Product;
            setProduct(productData);
            
            // Fetch related products
            const q = query(
              collection(db, "products"),
              where("category", "==", productData.category),
              limit(4)
            );
            
            const relatedSnapshot = await getDocs(q);
            setRelatedProducts(
              relatedSnapshot.docs
                .map(doc => ({ id: doc.id, ...doc.data() } as Product))
                .filter(p => p.id !== productId)
            );
          }
        } catch (error) {
          console.error("Error fetching product:", error);
          toast.error(t("emart.product.failedLoad"));
        } finally {
          setLoading(false);
        }
      };
      fetchProduct();
    }
  }, [user, productId]);

  const handleAddToCart = () => {
    if (!product) return;
    
    // Check if prescription required
    if (product.prescription) {
      toast.info(t("emart.product.prescriptionInfo"));
      // We will still add to cart, but they will be prompted at checkout
    }
    
    addToCart({
      id: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.imageUrl,
      quantity: qty,
      prescription: product.prescription,
      maxQuantity: product.stock
    });
    
    toast.success(t("emart.product.addedToCart", { qty, name: product.name }));
    setShowCartPopup(true);
  };

  const toggleDetailsSection = (section: keyof typeof expandedDetails) => {
    setExpandedDetails(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: product?.name,
        text: t("emart.product.shareText", { name: product?.name }),
        url: window.location.href,
      }).catch(() => {
        toast.success(t("common.linkCopied"));
        navigator.clipboard.writeText(window.location.href);
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success(t("common.linkCopied"));
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-20 pb-12 flex justify-center">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mt-20"></div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-24 pb-12 flex items-center justify-center">
        <div className="text-center p-8 bg-white rounded-2xl shadow-sm border border-border max-w-md mx-auto">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold font-playfair mb-4">{t("emart.product.notFoundTitle")}</h2>
          <p className="text-muted-foreground mb-8">{t("emart.product.notFoundDesc")}</p>
          <button 
            onClick={() => navigate('/emart/products')}
            className="inline-block bg-primary text-primary-foreground px-6 py-3 rounded-xl font-medium hover:bg-primary/90 transition-all shadow-sm"
          >
            {t("emart.cart.continueShopping")}
          </button>
        </div>
      </div>
    );
  }

  const CategoryIcon = getCategoryIcon(product.category);
  const totalCartItems = cart.reduce((total, item) => total + item.quantity, 0);
  const cartSubtotal = cart.reduce((total, item) => total + (item.price * item.quantity), 0);
  const cartItem = cart.find(item => item.id === product.id);

  return (
    <div className={`min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 pt-24 pb-12 ${showCartPopup ? 'overflow-hidden' : ''}`}>
      {/* Cart Popup Modal */}
      {showCartPopup && (
        <>
          <div className="fixed inset-0 bg-white/60 backdrop-blur-sm z-40 transition-opacity" onClick={() => setShowCartPopup(false)}></div>
          
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] flex flex-col pointer-events-auto border border-border">
              <div className="p-6 border-b border-border flex justify-between items-center bg-gray-50/50 rounded-t-2xl">
                <h3 className="text-xl font-bold font-playfair flex items-center">
                  <ShoppingCart className="w-5 h-5 mr-2 text-primary" />
                  {t("emart.cart.title")} ({totalCartItems} {t("emart.cart.items")})
                </h3>
                <button 
                  onClick={() => setShowCartPopup(false)}
                  className="p-2 hover:bg-gray-200 rounded-full transition-colors text-muted-foreground"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar flex-1">
                <div className="space-y-6">
                  {cart.map(item => (
                    <div key={item.id} className="flex gap-4">
                      <div className="w-20 h-20 rounded-xl bg-gray-50 border border-border flex items-center justify-center p-2 flex-shrink-0">
                        <img 
                          src={item.imageUrl} 
                          alt={item.name} 
                          className="max-h-full max-w-full object-contain mix-blend-multiply"
                        />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start gap-2">
                          <h4 className="font-semibold text-sm leading-tight line-clamp-2">{item.name}</h4>
                          <button
                            onClick={() => removeFromCart(item.id)}
                            className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                        <p className="text-primary font-bold mt-1 text-sm">₹{item.price.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</p>
                        
                        <div className="flex items-center justify-between mt-3">
                          <div className="flex items-center border border-border rounded-lg bg-white overflow-hidden shadow-sm h-8">
                            <button 
                              onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                              className="px-2.5 h-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-r border-border"
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={1}
                              max={item.maxQuantity || 10}
                              value={item.quantity}
                              onChange={(e) => {
                                const value = Math.max(1, Math.min(item.maxQuantity || 10, Number(e.target.value)));
                                updateQuantity(item.id, isNaN(value) ? 1 : value);
                              }}
                              className="w-10 text-center text-sm font-medium border-0 focus:ring-0 p-0"
                            />
                            <button 
                              onClick={() => updateQuantity(item.id, Math.min(item.maxQuantity || 10, item.quantity + 1))}
                              className="px-2.5 h-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-l border-border"
                            >
                              +
                            </button>
                          </div>
                          <p className="font-bold text-sm">₹{(item.price * item.quantity).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-6 border-t border-border bg-gray-50/50 rounded-b-2xl">
                <div className="flex justify-between text-sm mb-2 text-muted-foreground">
                  <span>{t("common.subtotal")}:</span>
                  <span className="font-semibold text-gray-900">₹{cartSubtotal.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span>
                </div>
                <div className="flex justify-between text-sm mb-4 text-muted-foreground">
                  <span>{t("common.delivery")}:</span>
                  <span className="font-semibold text-green-600">{cartSubtotal >= 500 ? t("common.free").toUpperCase() : '₹50.00'}</span>
                </div>
                <div className="flex justify-between text-lg font-bold mb-4 border-t border-border/50 pt-2 text-gray-900">
                  <span>{t("common.total")}:</span>
                  <span>₹{(cartSubtotal >= 500 ? cartSubtotal : cartSubtotal + 50).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span>
                </div>
                
                {cartSubtotal < 500 && (
                  <div className="mb-4 bg-orange-50 border border-orange-100 text-orange-800 text-xs px-3 py-2 rounded-lg flex items-center">
                    <Truck className="w-3.5 h-3.5 mr-2 flex-shrink-0" />
                    {t("emart.checkout.addMoreForFree", { amount: (500 - cartSubtotal).toLocaleString(language === "hi" ? "hi-IN" : "en-IN") })}
                  </div>
                )}
                
                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCartPopup(false)}
                    className="flex-1 py-3 border border-border rounded-xl font-medium hover:bg-white transition-colors text-sm shadow-sm"
                  >
                    {t("common.continue")}
                  </button>
                  <button
                    onClick={() => {
                      setShowCartPopup(false);
                      navigate('/emart/cart');
                    }}
                    className="flex-1 py-3 bg-primary text-primary-foreground rounded-xl font-medium hover:bg-primary/90 transition-all shadow-sm text-sm"
                  >
                    {t("emart.product.viewCart")}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <div className="container mx-auto px-4 max-w-6xl">
        <button 
          onClick={() => navigate('/emart/products')}
          className="flex items-center text-muted-foreground hover:text-primary mb-6 transition-colors font-medium text-sm w-fit"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          {t("emart.product.backToCatalog")}
        </button>

        <div className="bg-white rounded-2xl shadow-sm border border-border overflow-hidden mb-12">
          <div className="flex flex-col lg:flex-row">
            {/* Gallery */}
            <div className="lg:w-1/2 p-6 lg:p-10 border-b lg:border-b-0 lg:border-r border-border flex flex-col justify-center">
              <div className="relative aspect-square max-h-[400px] w-full bg-gradient-to-br from-gray-50 to-white rounded-2xl flex items-center justify-center p-8">
                <img 
                  src={product.imageUrl} 
                  alt={product.name} 
                  className="max-h-full max-w-full object-contain mix-blend-multiply"
                />
                {product.prescription && (
                  <div className="absolute top-4 left-4 bg-red-100/90 text-red-800 backdrop-blur-sm px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider flex items-center shadow-sm">
                    <Pill className="w-3.5 h-3.5 mr-1.5" />
                    {t("emart.rxRequired")}
                  </div>
                )}
                {product.discount && (
                  <div className="absolute top-4 right-4 bg-accent text-white px-3 py-1.5 rounded-full text-xs font-bold shadow-sm">
                    {product.discount}% OFF
                  </div>
                )}
              </div>
              
              <div className="grid grid-cols-3 gap-3 mt-8">
                <div className="flex flex-col items-center justify-center p-3 bg-green-50/50 rounded-xl border border-green-100/50">
                  <Truck className="w-5 h-5 text-green-600 mb-1.5" />
                  <span className="text-[10px] font-medium text-center uppercase tracking-wider">{t("emart.product.freeDelivery")}</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 bg-primary/5 rounded-xl border border-primary/10">
                  <ShieldCheck className="w-5 h-5 text-primary mb-1.5" />
                  <span className="text-[10px] font-medium text-center uppercase tracking-wider">{t("emart.ayushApproved")}</span>
                </div>
                <div className="flex flex-col items-center justify-center p-3 bg-orange-50/50 rounded-xl border border-orange-100/50">
                  <Medal className="w-5 h-5 text-accent mb-1.5" />
                  <span className="text-[10px] font-medium text-center uppercase tracking-wider">{t("emart.home.feature.authentic.title")}</span>
                </div>
              </div>
            </div>

            {/* Info */}
            <div className="lg:w-1/2 p-6 lg:p-10 flex flex-col">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="flex items-center mb-3">
                    <CategoryIcon className="w-4 h-4 mr-2 text-primary" />
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{translateCategory(product.category)}</span>
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-playfair font-bold text-gray-900 leading-tight">{product.name}</h1>
                  {product.brand && (
                    <p className="text-primary font-medium mt-2 flex items-center">
                      <Shield className="w-3.5 h-3.5 mr-1.5" />
                      {product.brand}
                    </p>
                  )}
                </div>
                <div className="flex space-x-2 mt-2">
                  <button 
                    onClick={() => setWishlist(!wishlist)}
                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${wishlist ? 'text-red-500 bg-red-50 border border-red-100' : 'text-gray-500 border border-border hover:text-red-500 hover:border-red-200 hover:bg-red-50'}`}
                  >
                    <Heart className={`w-5 h-5 ${wishlist ? 'fill-current' : ''}`} />
                  </button>
                  <button 
                    onClick={handleShare}
                    className="w-10 h-10 rounded-full flex items-center justify-center text-gray-500 border border-border hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all"
                  >
                    <Share2 className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {product.rating && (
                <div className="flex items-center mb-6 pt-2">
                  <div className="flex text-yellow-400">
                    {[...Array(5)].map((_, i) => (
                      <Star key={i} className={`w-4 h-4 ${i < product.rating! ? 'fill-current' : 'text-gray-200 fill-gray-200'}`} />
                    ))}
                  </div>
                  <span className="text-sm font-medium ml-2">{product.rating.toFixed(1)}</span>
                  <span className="mx-2 text-border">•</span>
                  <span className="text-sm text-primary hover:underline cursor-pointer">{t("emart.product.readReviews")}</span>
                </div>
              )}

              <div className="mb-8 pt-4 border-t border-border">
                <div className="flex items-end gap-3 flex-wrap">
                  {product.discount ? (
                     <>
                      <span className="text-4xl font-bold font-playfair tracking-tight text-gray-900">₹{product.price.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span>
                      <span className="text-lg text-muted-foreground line-through font-medium mb-1">₹{Math.round(product.price * (1 + product.discount/100)).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span>
                      <span className="bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded mb-2">{t("emart.product.saveAmount", { amount: (product.price * product.discount / 100).toLocaleString(language === "hi" ? "hi-IN" : "en-IN") })}</span>
                     </>
                  ) : (
                    <span className="text-4xl font-bold font-playfair tracking-tight text-gray-900">₹{product.price.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-2">{t("emart.cart.taxInclusive")}</p>
              </div>

              <div className="mb-8">
                {product.stock > 0 ? (
                  <div className="flex items-center text-green-600 bg-green-50 w-fit px-3 py-1.5 rounded-full text-sm font-medium mb-4">
                    <CheckCircle className="w-4 h-4 mr-1.5" />
                    {t("emart.product.inStock")}
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 bg-red-50 w-fit px-3 py-1.5 rounded-full text-sm font-medium mb-4">
                    <X className="w-4 h-4 mr-1.5" />
                    {t("emart.product.outOfStock")}
                  </div>
                )}

                <div className="flex gap-4 mb-4">
                  <div className="flex items-center border border-border rounded-xl bg-white shadow-sm h-12 w-32">
                    <button 
                      onClick={() => setQty(prev => Math.max(1, prev - 1))}
                      className="px-4 h-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-r border-border rounded-l-xl"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={product.stock}
                      value={qty}
                      onChange={(e) => {
                        const value = Math.max(1, Math.min(product.stock, Number(e.target.value)));
                        setQty(isNaN(value) ? 1 : value);
                      }}
                      className="w-full text-center font-semibold border-0 focus:ring-0 p-0"
                    />
                    <button 
                      onClick={() => setQty(prev => Math.min(product.stock, prev + 1))}
                      className="px-4 h-full bg-gray-50 hover:bg-gray-100 text-gray-600 transition-colors border-l border-border rounded-r-xl"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={handleAddToCart}
                    disabled={product.stock <= 0}
                    className={`flex-1 h-12 rounded-xl text-white font-bold flex items-center justify-center transition-all shadow-md ${
                      product.stock <= 0 ? 'bg-gray-300 text-gray-500 cursor-not-allowed shadow-none' : 'bg-primary hover:bg-primary/90 hover:shadow-lg active:scale-[0.98]'
                    }`}
                  >
                    <ShoppingCart className="w-5 h-5 mr-2" />
                    {product.stock <= 0 ? t("emart.product.unavailable") : cartItem ? t("emart.product.updateCart") : t("emart.product.addToCart")}
                  </button>
                </div>

                {product.prescription && (
                  <div className="bg-red-50 border border-red-100 p-3 rounded-xl flex items-start gap-3 mt-4">
                    <Pill className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-red-800 leading-relaxed font-medium">
                      {t("emart.product.requiresPrescription")}
                    </p>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 border-t border-border/50">
                <div className="bg-gray-50 rounded-xl p-4 flex gap-4 items-center">
                  <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                    <Truck className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-gray-900 mb-0.5">{t("emart.product.fastDeliveryTitle")}</h4>
                    <p className="text-xs text-muted-foreground">{t("emart.product.fastDeliveryDesc")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Accordions */}
          <div className="border-t border-border bg-gray-50/30">
            <div className="divide-y divide-border">
              {/* Description */}
              <div>
                <button 
                  className="w-full px-6 lg:px-10 py-5 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  onClick={() => toggleDetailsSection('description')}
                >
                  <h3 className="text-lg font-bold font-playfair text-gray-900">{t("emart.product.ayurDescription")}</h3>
                  {expandedDetails.description ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </button>
                {expandedDetails.description && (
                  <div className="px-6 lg:px-10 pb-8 pt-2">
                    <div className="prose prose-sm md:prose-base max-w-none text-muted-foreground prose-p:leading-relaxed">
                      <p>{product.description}</p>
                      <ul className="mt-6 space-y-2 marker:text-primary">
                        <li>{t("emart.product.descBullet1")}</li>
                        <li>{t("emart.product.descBullet2")}</li>
                        <li>{t("emart.product.descBullet3")}</li>
                        {product.prescription && (
                          <li>{t("emart.product.descBullet4")}</li>
                        )}
                      </ul>
                    </div>
                  </div>
                )}
              </div>

              {/* Specifications */}
              <div>
                <button 
                  className="w-full px-6 lg:px-10 py-5 flex justify-between items-center hover:bg-gray-50 transition-colors"
                  onClick={() => toggleDetailsSection('specifications')}
                >
                  <h3 className="text-lg font-bold font-playfair text-gray-900">{t("emart.product.keySpecs")}</h3>
                  {expandedDetails.specifications ? <ChevronUp className="w-5 h-5 text-muted-foreground" /> : <ChevronDown className="w-5 h-5 text-muted-foreground" />}
                </button>
                {expandedDetails.specifications && (
                  <div className="px-6 lg:px-10 pb-8 pt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-4">
                      {product.brand && (
                        <div className="flex justify-between border-b border-border border-dashed pb-2">
                          <span className="text-muted-foreground text-sm">{t("emart.brand")}</span>
                          <span className="font-semibold text-sm text-gray-900">{product.brand}</span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-border border-dashed pb-2">
                        <span className="text-muted-foreground text-sm">{t("emart.categories")}</span>
                        <span className="font-semibold text-sm text-gray-900">{translateCategory(product.category)}</span>
                      </div>
                      {product.expiry && (
                        <div className="flex justify-between border-b border-border border-dashed pb-2">
                          <span className="text-muted-foreground text-sm">{t("emart.product.shelfLife")}</span>
                          <span className="font-semibold text-sm text-gray-900">
                            {new Date(product.expiry).toLocaleDateString(language === "hi" ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between border-b border-border border-dashed pb-2">
                        <span className="text-muted-foreground text-sm">{t("emart.product.vegetarian")}</span>
                        <span className="font-semibold text-sm text-gray-900">{t("common.yes")} (100%)</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Related */}
        {relatedProducts.length > 0 && (
          <div className="mb-12">
            <h2 className="text-2xl font-bold font-playfair text-gray-900 mb-6">{t("emart.product.frequentlyBought")}</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6">
              {relatedProducts.map((p) => (
                <Link key={p.id} to={`/emart/products/${p.id}`} className="group">
                  <div className="bg-white rounded-2xl border border-border overflow-hidden hover:shadow-lg transition-all hover:-translate-y-1 h-full flex flex-col">
                    <div className="h-40 bg-gray-50 p-4 flex items-center justify-center mix-blend-multiply">
                      <img src={p.imageUrl} alt={p.name} className="max-h-full max-w-full object-contain group-hover:scale-110 transition-transform duration-500" />
                    </div>
                    <div className="p-4 flex-1 flex flex-col">
                      <h3 className="font-semibold text-sm text-gray-900 mb-1 line-clamp-2 group-hover:text-primary transition-colors">{p.name}</h3>
                      <div className="mt-auto pt-3 flex justify-between items-center">
                        <span className="font-bold text-primary">₹{p.price.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</span>
                        {p.rating && (
                          <div className="flex items-center text-xs text-muted-foreground font-medium">
                            <Star className="w-3 h-3 text-yellow-400 fill-current mr-1" />
                            {p.rating.toFixed(1)}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
