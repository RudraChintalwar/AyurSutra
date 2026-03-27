import React, { useEffect, useState } from 'react';
import { collection, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useCart } from '@/contexts/CartContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { 
  ShoppingCart, 
  Search, 
  Filter, 
  ChevronDown, 
  ChevronUp,
  HeartPulse,
  Pill,
  Stethoscope,
  Truck,
  Phone,
  Star,
  Leaf,
  ShieldCheck,
  Package,
  Activity,
  Droplet
} from 'lucide-react';

type Product = {
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
};

export default function EmartProducts() {
  const { user, loading: authLoading } = useAuth();
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [selectedBrands, setSelectedBrands] = useState<string[]>([]);
  const [sortOption, setSortOption] = useState<string>('featured');
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [prescriptionOnly, setPrescriptionOnly] = useState(false);
  const [expandedFilters, setExpandedFilters] = useState({
    category: true,
    price: true,
    brand: true,
    prescription: true
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && user === null) navigate('/login');
  }, [user, authLoading, navigate]);

  useEffect(() => {
    if (user && user.uid) {
      const fetchProducts = async () => {
        try {
          const snapshot = await getDocs(collection(db, 'products'));
          const productList = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
          })) as Product[];
          setProducts(productList);
        } catch (error) {
          console.error("Error fetching products:", error);
        } finally {
          setLoading(false);
        }
      };
      fetchProducts();
    }
  }, [user]);

  const toggleFilterSection = (section: keyof typeof expandedFilters) => {
    setExpandedFilters(prev => ({
      ...prev,
      [section]: !prev[section]
    }));
  };

  const handleBrandToggle = (brand: string) => {
    setSelectedBrands(prev =>
      prev.includes(brand)
        ? prev.filter(b => b !== brand)
        : [...prev, brand]
    );
  };

  const resetFilters = () => {
    setSelectedCategory(null);
    setSearchTerm('');
    setPriceRange([0, 10000]);
    setSelectedBrands([]);
    setPrescriptionOnly(false);
  };

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

  const filteredProducts = products.filter(product => {
    const matchesCategory = selectedCategory ? product.category === selectedCategory : true;
    const matchesSearch = product.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPrice = product.price >= priceRange[0] && product.price <= priceRange[1];
    const matchesBrand = selectedBrands.length === 0 || (product.brand && selectedBrands.includes(product.brand));
    const matchesPrescription = !prescriptionOnly || product.prescription;
    
    return matchesCategory && matchesSearch && matchesPrice && matchesBrand && matchesPrescription;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    switch (sortOption) {
      case 'price-low':
        return a.price - b.price;
      case 'price-high':
        return b.price - a.price;
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'rating':
        return (b.rating || 0) - (a.rating || 0);
      default:
        return 0;
    }
  });

  const { cart } = useCart();

  if (authLoading || loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  const categories = Array.from(new Set(products.map(p => p.category)));
  const brands = Array.from(new Set(products.filter(p => p.brand).map(p => p.brand as string)));

  // Ayurvedic-focused categories
  const ayurCategories = [
    { name: 'Classical Medicines', icon: Pill, color: 'text-amber-600' },
    { name: 'Proprietary Formulations', icon: Activity, color: 'text-primary' },
    { name: 'Oils & Ghritas', icon: Droplet, color: 'text-yellow-600' },
    { name: 'Herbal Supplements', icon: Leaf, color: 'text-green-600' },
    { name: 'Personal Care', icon: HeartPulse, color: 'text-pink-600' },
    { name: 'Immunity Boosters', icon: ShieldCheck, color: 'text-blue-600' }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-orange-50 font-inter text-gray-900 pt-20">

      {/* Trust Indicators */}
      <div className="bg-white/80 backdrop-blur border-y border-border sticky top-0 z-40">
        <div className="container mx-auto px-4 py-3">
          <div className="flex flex-wrap items-center justify-center gap-6 text-sm">
            <div className="flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-green-600" />
              <span className="font-medium">{t("emart.ayushApproved")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Leaf className="w-4 h-4 text-primary" />
              <span className="font-medium">{t("emart.hundredAyurvedic")}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Truck className="w-4 h-4 text-accent" />
              <span className="font-medium">{t("emart.expressDelivery")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        
        {/* Top Header / Search */}
        <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-3xl font-playfair font-bold text-gray-900">{t("emart.productCatalog")}</h1>
            <div className="flex items-center text-sm text-muted-foreground mt-2">
              <Link to="/emart" className="hover:text-primary transition-colors">{t("emart.title")}</Link>
              <span className="mx-2">/</span>
              <span>{t("emart.allProducts")}</span>
              {selectedCategory && (
                <>
                  <span className="mx-2">/</span>
                  <span className="text-primary font-medium">{translateCategory(selectedCategory)}</span>
                </>
              )}
            </div>
          </div>
          
          <div className="flex items-center w-full md:w-auto gap-4">
            <div className="relative flex-1 md:w-80">
              <input
                type="text"
                placeholder={t("emart.searchRemedies")}
                className="w-full border border-border rounded-full py-2.5 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-primary shadow-sm bg-white"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
              <Search className="absolute left-4 top-3 w-4 h-4 text-muted-foreground" />
            </div>
            <button 
              onClick={() => navigate('/emart/cart')}
              className="relative p-2.5 bg-white border border-border rounded-full shadow-sm hover:border-primary transition-colors text-gray-700"
            >
              <ShoppingCart className="w-5 h-5" />
              {cart.reduce((total, item) => total + item.quantity, 0) > 0 && (
                <span className="absolute -top-1 -right-1 bg-accent text-white text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {cart.reduce((total, item) => total + item.quantity, 0)}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-8">
          {/* Desktop Filters */}
          <aside className="hidden lg:block w-72 space-y-6 flex-shrink-0">
            <div className="bg-white rounded-2xl shadow-sm border border-border p-6 sticky top-24">
              <h3 className="font-bold text-xl mb-6 flex items-center font-playfair">
                <Filter className="w-5 h-5 mr-3 text-primary" />
                {t("emart.filters")}
              </h3>
              
              {/* Categories Filter */}
              <div className="mb-6 border-b border-border pb-4">
                <div 
                  className="flex justify-between items-center cursor-pointer mb-3 group"
                  onClick={() => toggleFilterSection('category')}
                >
                  <h4 className="font-semibold group-hover:text-primary transition-colors">{t("emart.categories")}</h4>
                  {expandedFilters.category ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
                {expandedFilters.category && (
                  <div className="space-y-1.5">
                    <button
                      onClick={() => setSelectedCategory(null)}
                      className={`flex items-center w-full py-2 px-3 rounded-xl transition-colors text-sm ${!selectedCategory ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-50'}`}
                    >
                      <Package className="w-4 h-4 mr-3" />
                      {t("emart.allCategories")}
                    </button>
                    {/* Combine dynamic categories with our custom icons layer */}
                    {categories.map(cat => {
                      const matchedCat = ayurCategories.find(ac => ac.name === cat);
                      const IconComponent = matchedCat ? matchedCat.icon : Leaf;
                      const iconColor = matchedCat ? matchedCat.color : 'text-gray-500';
                      return (
                        <button
                          key={cat}
                          onClick={() => setSelectedCategory(cat)}
                          className={`flex items-center w-full py-2 px-3 rounded-xl transition-colors text-sm ${selectedCategory === cat ? 'bg-primary/10 text-primary font-medium' : 'hover:bg-gray-50'}`}
                        >
                          <IconComponent className={`w-4 h-4 mr-3 ${selectedCategory === cat ? 'text-primary' : iconColor}`} />
                          <span className="text-left">{translateCategory(cat)}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
              
              {/* Price Range */}
              <div className="mb-6 border-b border-border pb-4">
                <div 
                  className="flex justify-between items-center cursor-pointer mb-3 group"
                  onClick={() => toggleFilterSection('price')}
                >
                  <h4 className="font-semibold group-hover:text-primary transition-colors">{t("emart.priceRange")}</h4>
                  {expandedFilters.price ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
                {expandedFilters.price && (
                  <div className="space-y-4 px-2">
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      step="100"
                      value={priceRange[1]}
                      onChange={e => setPriceRange([priceRange[0], parseInt(e.target.value)])}
                      className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary"
                    />
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span className="bg-gray-100 px-2 py-1.5 rounded-md">₹0</span>
                      <span className="bg-primary/10 text-primary px-2 py-1.5 rounded-md">{t("emart.upTo")} ₹{priceRange[1]}</span>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Brands */}
              {brands.length > 0 && (
                <div className="mb-6 border-b border-border pb-4">
                  <div 
                    className="flex justify-between items-center cursor-pointer mb-3 group"
                    onClick={() => toggleFilterSection('brand')}
                  >
                    <h4 className="font-semibold group-hover:text-primary transition-colors">{t("emart.brands")}</h4>
                    {expandedFilters.brand ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                  {expandedFilters.brand && (
                    <div className="space-y-2 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                      {brands.map(brand => (
                        <label key={brand} className="flex items-center space-x-3 cursor-pointer group">
                          <input
                            type="checkbox"
                            checked={selectedBrands.includes(brand)}
                            onChange={() => handleBrandToggle(brand)}
                            className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary accent-primary"
                          />
                          <span className="text-sm group-hover:text-primary transition-colors">{brand}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prescription */}
              <div className="mb-6">
                <label className="flex items-center space-x-3 cursor-pointer group">
                  <input
                    type="checkbox"
                    checked={prescriptionOnly}
                    onChange={(e) => setPrescriptionOnly(e.target.checked)}
                    className="w-4 h-4 text-primary rounded border-gray-300 focus:ring-primary accent-primary"
                  />
                  <span className="text-sm font-medium group-hover:text-primary transition-colors">{t("emart.vaidyaPrescriptionOnly")}</span>
                </label>
              </div>

              {/* Clear */}
              <button 
                onClick={resetFilters}
                className="w-full bg-gray-100 text-gray-700 font-medium py-2.5 rounded-xl hover:bg-gray-200 transition-colors text-sm"
              >
                {t("emart.resetFilters")}
              </button>
            </div>
          </aside>

          {/* Product Listing */}
          <main className="flex-1">
            {/* Sort Header */}
            <div className="bg-white rounded-xl shadow-sm p-4 mb-6 border border-border flex flex-col sm:flex-row justify-between items-center gap-4">
              <p className="text-sm font-medium">
                {t("common.showing")} <span className="font-bold text-gray-900">{sortedProducts.length}</span> {t("emart.productsLower")}
              </p>
              <div className="flex items-center space-x-3">
                <label htmlFor="sort" className="text-sm font-medium text-muted-foreground whitespace-nowrap">{t("emart.sortBy")}</label>
                <select
                  id="sort"
                  value={sortOption}
                  onChange={e => setSortOption(e.target.value)}
                  className="bg-gray-50 border border-border rounded-lg py-2 px-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  <option value="featured">{t("emart.sort.featured")}</option>
                  <option value="price-low">{t("emart.sort.priceLowHigh")}</option>
                  <option value="price-high">{t("emart.sort.priceHighLow")}</option>
                  <option value="name-asc">{t("emart.sort.nameAZ")}</option>
                  <option value="rating">{t("emart.sort.highestRated")}</option>
                </select>
                <button 
                  onClick={() => setMobileFiltersOpen(true)}
                  className="lg:hidden p-2 bg-gray-50 border border-border rounded-lg"
                >
                  <Filter className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Grid */}
            {sortedProducts.length === 0 ? (
              <div className="bg-white rounded-2xl shadow-sm p-16 text-center border border-border">
                <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Search className="w-10 h-10 text-gray-400" />
                </div>
                <h3 className="text-2xl font-playfair font-bold mb-3">{t("emart.noProductsFound")}</h3>
                <p className="text-muted-foreground mb-8 max-w-md mx-auto">{t("emart.noProductsFoundDesc")}</p>
                <button 
                  onClick={resetFilters}
                  className="bg-primary text-primary-foreground py-2.5 px-8 rounded-xl font-medium hover:bg-primary/90 transition-colors"
                >
                  {t("emart.resetFiltering")}
                </button>
              </div>
            ) : (
              <div className="grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
                {sortedProducts.map(product => (
                  <Link key={product.id} to={`/emart/products/${product.id}`} className="group h-full">
                    <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-border h-full flex flex-col hover:-translate-y-1">
                      {/* Image */}
                      <div className="relative aspect-square p-6 flex justify-center items-center bg-gradient-to-br from-gray-50 to-white">
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          className="max-h-full max-w-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-500"
                        />
                        {product.prescription && (
                          <div className="absolute top-3 left-3 bg-red-100/90 text-red-700 text-[10px] uppercase font-bold px-2.5 py-1 rounded-full flex items-center shadow-sm backdrop-blur-sm">
                            <Pill className="w-3 h-3 mr-1" />
                            {t("emart.rxRequired")}
                          </div>
                        )}
                        {product.discount && (
                          <div className="absolute top-3 right-3 bg-accent text-white text-xs font-bold px-2 py-1 rounded-md shadow-sm">
                            {product.discount}% OFF
                          </div>
                        )}
                      </div>
                      
                      {/* Details */}
                      <div className="p-5 flex-1 flex flex-col border-t border-border/50">
                        {product.brand && (
                          <p className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">{product.brand}</p>
                        )}
                        <h2 className="font-semibold text-gray-900 mb-2 line-clamp-2 leading-tight group-hover:text-primary transition-colors">{product.name}</h2>
                        
                        {product.rating && (
                          <div className="flex items-center mb-3">
                            <div className="flex items-center space-x-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star 
                                  key={i} 
                                  className={`w-3.5 h-3.5 ${i < product.rating! ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'}`} 
                                />
                              ))}
                            </div>
                            <span className="text-xs text-muted-foreground ml-2 font-medium">{product.rating.toFixed(1)}</span>
                          </div>
                        )}
                        
                        <div className="mt-auto pt-4 flex items-end justify-between">
                          <div>
                            {product.discount ? (
                              <div className="flex items-baseline space-x-2">
                                <p className="text-xl font-bold text-gray-900">₹{product.price.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</p>
                                <p className="text-sm text-muted-foreground line-through font-medium">₹{Math.round(product.price * (1 + product.discount/100)).toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</p>
                              </div>
                            ) : (
                               <p className="text-xl font-bold text-gray-900">₹{product.price.toLocaleString(language === "hi" ? "hi-IN" : "en-IN")}</p>
                            )}
                          </div>
                          
                          <div className="w-10 h-10 rounded-full bg-primary/5 group-hover:bg-primary flex flex-shrink-0 items-center justify-center transition-colors">
                            <ShoppingCart className="w-4 h-4 text-primary group-hover:text-white transition-colors" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
