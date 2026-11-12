import { lazy, Suspense, type ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from '@/store/auth';
import { Spinner } from '@/components/ui';
import PublicLayout from '@/layouts/PublicLayout';
import DashboardLayout from '@/layouts/DashboardLayout';
import Landing from '@/pages/public/Landing';
import type { Role } from '@/types';

// Kod bo'linishi (code splitting): dashboardlar va og'ir sahifalar alohida yuklanadi
const Catalog = lazy(() => import('@/pages/public/Catalog'));
const ProductDetail = lazy(() => import('@/pages/public/ProductDetail'));
const Farmers = lazy(() => import('@/pages/public/Farmers').then((m) => ({ default: m.FarmersPage })));
const FarmerDetail = lazy(() => import('@/pages/public/Farmers').then((m) => ({ default: m.FarmerDetailPage })));
const About = lazy(() => import('@/pages/public/About'));
const NotFound = lazy(() => import('@/pages/public/About').then((m) => ({ default: m.NotFound })));
const AuthPage = lazy(() => import('@/pages/auth/AuthPage'));
const Cart = lazy(() => import('@/pages/buyer/Cart'));
const Checkout = lazy(() => import('@/pages/buyer/Checkout'));
const CheckoutSuccess = lazy(() => import('@/pages/buyer/Checkout').then((m) => ({ default: m.CheckoutSuccess })));
const PaymentResult = lazy(() => import('@/pages/buyer/Checkout').then((m) => ({ default: m.PaymentResult })));
const SandboxPay = lazy(() => import('@/pages/buyer/Checkout').then((m) => ({ default: m.SandboxPay })));

const acc = () => import('@/pages/buyer/Account');
const BuyerOverview = lazy(() => acc().then((m) => ({ default: m.BuyerOverview })));
const BuyerOrders = lazy(() => acc().then((m) => ({ default: m.BuyerOrders })));
const OrderDetail = lazy(() => acc().then((m) => ({ default: m.OrderDetail })));
const Receipt = lazy(() => acc().then((m) => ({ default: m.Receipt })));
const Favorites = lazy(() => acc().then((m) => ({ default: m.Favorites })));
const Addresses = lazy(() => acc().then((m) => ({ default: m.Addresses })));
const MyReviews = lazy(() => acc().then((m) => ({ default: m.MyReviews })));
const Support = lazy(() => acc().then((m) => ({ default: m.Support })));

const sh = () => import('@/pages/shared/Shared');
const Notifications = lazy(() => sh().then((m) => ({ default: m.NotificationsPage })));
const Messages = lazy(() => sh().then((m) => ({ default: m.MessagesPage })));
const Settings = lazy(() => import('@/pages/shared/Settings').then((m) => ({ default: m.SettingsPage })));
const Help = lazy(() => import('@/pages/shared/Help'));
const rep = () => import('@/pages/shared/Reports');
const CategoryReports = lazy(() => rep().then((m) => ({ default: m.CategoryReports })));
const CategoryReportDetail = lazy(() => rep().then((m) => ({ default: m.CategoryReportDetail })));

const ctr = () => import('@/pages/contracts/Contracts');
const ContractsList = lazy(() => ctr().then((m) => ({ default: m.ContractsList })));
const ContractNew = lazy(() => ctr().then((m) => ({ default: m.ContractNew })));
const ContractDetail = lazy(() => ctr().then((m) => ({ default: m.ContractDetail })));
const ContractVerify = lazy(() => ctr().then((m) => ({ default: m.ContractVerify })));
const wal = () => import('@/pages/wallet/Wallet');
const WalletPage = lazy(() => wal().then((m) => ({ default: m.WalletPage })));
const AdminWallet = lazy(() => wal().then((m) => ({ default: m.AdminWallet })));
const ContactAdmin = lazy(() => wal().then((m) => ({ default: m.ContactAdmin })));
const MapPage = lazy(() => import('@/pages/maps/Maps').then((m) => ({ default: m.MapPage })));
const SalesPoints = lazy(() => import('@/pages/maps/Maps').then((m) => ({ default: m.SalesPointsPage })));

const SellerDashboard = lazy(() => import('@/pages/seller/SellerDashboard').then((m) => ({ default: m.SellerDashboard })));
const SellerProducts = lazy(() => import('@/pages/seller/SellerProducts').then((m) => ({ default: m.SellerProducts })));
const ProductForm = lazy(() => import('@/pages/seller/ProductForm').then((m) => ({ default: m.ProductForm })));
const SellerOrders = lazy(() => import('@/pages/seller/SellerOrders').then((m) => ({ default: m.SellerOrders })));
const SellerOrderDetail = lazy(() => import('@/pages/seller/SellerOrders').then((m) => ({ default: m.SellerOrderDetail })));
const DeliveryZones = lazy(() => import('@/pages/seller/DeliveryZones').then((m) => ({ default: m.DeliveryZones })));
const Promotions = lazy(() => import('@/pages/seller/Promotions').then((m) => ({ default: m.Promotions })));
const SellerReviews = lazy(() => import('@/pages/seller/SellerReviews').then((m) => ({ default: m.SellerReviews })));
const Earnings = lazy(() => import('@/pages/seller/Earnings').then((m) => ({ default: m.Earnings })));
const FarmProfile = lazy(() => import('@/pages/seller/FarmProfile').then((m) => ({ default: m.FarmProfile })));

const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard').then((m) => ({ default: m.AdminDashboard })));
const AdminUsers = lazy(() => import('@/pages/admin/AdminUsers').then((m) => ({ default: m.AdminUsers })));
const AdminProducts = lazy(() => import('@/pages/admin/AdminProducts').then((m) => ({ default: m.AdminProducts })));
const AdminCategories = lazy(() => import('@/pages/admin/AdminCategories').then((m) => ({ default: m.AdminCategories })));
const AdminOrders = lazy(() => import('@/pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders })));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments').then((m) => ({ default: m.AdminPayments })));
const AdminComplaints = lazy(() => import('@/pages/admin/AdminComplaints').then((m) => ({ default: m.AdminComplaints })));
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews').then((m) => ({ default: m.AdminReviews })));
const AdminAudit = lazy(() => import('@/pages/admin/AdminAudit').then((m) => ({ default: m.AdminAudit })));

const apps = () => import('@/pages/applications/Applications');
const SellerApplications = lazy(() => apps().then((m) => ({ default: m.SellerApplications })));
const ApplicationNew = lazy(() => apps().then((m) => ({ default: m.ApplicationNew })));
const SellerApplicationView = lazy(() => apps().then((m) => ({ default: m.SellerApplicationView })));
const AdminApplications = lazy(() => apps().then((m) => ({ default: m.AdminApplications })));
const AdminApplicationDetail = lazy(() => apps().then((m) => ({ default: m.AdminApplicationDetail })));
const bo = () => import('@/pages/admin/Backoffice');
const AdminUserDetail = lazy(() => bo().then((m) => ({ default: m.AdminUserDetail })));
const AdminSanctions = lazy(() => bo().then((m) => ({ default: m.AdminSanctions })));
const stf = () => import('@/pages/seller/Staff');
const StaffPage = lazy(() => stf().then((m) => ({ default: m.StaffPage })));
const WorkPage = lazy(() => stf().then((m) => ({ default: m.WorkPage })));
const rb = () => import('@/pages/shared/ReportBuilder');
const ReportView = lazy(() => rb().then((m) => ({ default: m.ReportViewPage })));
const ReportExport = lazy(() => rb().then((m) => ({ default: m.ReportExportPage })));

function Loader() {
  return <div className="flex min-h-[50vh] items-center justify-center"><Spinner className="h-8 w-8" /></div>;
}

/** Frontend tekshiruvi faqat UX uchun — haqiqiy ruxsat backendda (RBAC) tekshiriladi */
function RequireAuth({ roles, children }: { roles?: Role[]; children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (loading) return <Loader />;
  if (!user) return <Navigate to={`/auth?next=${encodeURIComponent(loc.pathname + loc.search)}`} replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<Loader />}>
      <Routes>
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/pay/sandbox/:id" element={<RequireAuth><SandboxPay /></RequireAuth>} />
        <Route element={<PublicLayout />}>
          <Route index element={<Landing />} />
          <Route path="catalog" element={<Catalog />} />
          <Route path="product/:slug" element={<ProductDetail />} />
          <Route path="farmers" element={<Farmers />} />
          <Route path="farmers/:slug" element={<FarmerDetail />} />
          <Route path="about" element={<About />} />
          <Route path="help" element={<Help />} />
          <Route path="map" element={<MapPage />} />
          <Route path="c/:publicId" element={<ContractVerify />} />
          <Route path="cart" element={<RequireAuth roles={['BUYER', 'SELLER']}><Cart /></RequireAuth>} />
          <Route path="checkout" element={<RequireAuth roles={['BUYER', 'SELLER']}><Checkout /></RequireAuth>} />
          <Route path="checkout/success/:id" element={<RequireAuth><CheckoutSuccess /></RequireAuth>} />
          <Route path="checkout/result" element={<RequireAuth><PaymentResult /></RequireAuth>} />
        </Route>

        <Route element={<RequireAuth><DashboardLayout /></RequireAuth>}>
          {/* kabinet ichidagi xarita va yo'riqnoma — yon menyu saqlanadi */}
          <Route path="panel/map" element={<MapPage />} />
          <Route path="panel/help" element={<Help />} />
          <Route path="work" element={<WorkPage />} />
          <Route path="messages" element={<Messages />} />
          <Route path="messages/:id" element={<Messages />} />
          <Route path="contracts" element={<ContractsList />} />
          <Route path="contracts/new" element={<ContractNew />} />
          <Route path="contracts/:id" element={<ContractDetail />} />
          <Route path="contact-admin" element={<RequireAuth roles={['BUYER', 'SELLER']}><ContactAdmin /></RequireAuth>} />
          <Route path="wallet" element={<RequireAuth roles={['SELLER']}><WalletPage /></RequireAuth>} />
          <Route path="account">
            <Route index element={<BuyerOverview />} />
            <Route path="orders" element={<BuyerOrders />} />
            <Route path="orders/:id" element={<OrderDetail />} />
            <Route path="receipt/:id" element={<Receipt />} />
            <Route path="favorites" element={<Favorites />} />
            <Route path="addresses" element={<Addresses />} />
            <Route path="reviews" element={<MyReviews />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="support" element={<Support />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="seller" element={<RequireAuth roles={['SELLER']}><SellerOutlet /></RequireAuth>}>
            <Route index element={<SellerDashboard />} />
            <Route path="products" element={<SellerProducts />} />
            <Route path="products/new" element={<ProductForm />} />
            <Route path="products/:id/edit" element={<ProductForm />} />
            <Route path="orders" element={<SellerOrders />} />
            <Route path="orders/:id" element={<SellerOrderDetail />} />
            <Route path="delivery" element={<DeliveryZones />} />
            <Route path="points" element={<SalesPoints />} />
            <Route path="staff" element={<StaffPage />} />
            <Route path="applications" element={<SellerApplications />} />
            <Route path="applications/new/:kind" element={<ApplicationNew />} />
            <Route path="applications/:id" element={<SellerApplicationView />} />
            <Route path="reports/view/:kind" element={<ReportView />} />
            <Route path="reports/export" element={<ReportExport />} />
            <Route path="promotions" element={<Promotions />} />
            <Route path="reviews" element={<SellerReviews />} />
            <Route path="earnings" element={<Earnings />} />
            <Route path="reports" element={<CategoryReports />} />
            <Route path="reports/:slug" element={<CategoryReportDetail />} />
            <Route path="profile" element={<FarmProfile />} />
            <Route path="notifications" element={<Notifications />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="admin" element={<RequireAuth roles={['ADMIN']}><SellerOutlet /></RequireAuth>}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="users/:id" element={<AdminUserDetail />} />
            <Route path="sellers" element={<Navigate to="/admin/applications" replace />} />
            <Route path="applications" element={<AdminApplications />} />
            <Route path="applications/:id" element={<AdminApplicationDetail />} />
            <Route path="sanctions" element={<AdminSanctions />} />
            <Route path="reports/view/:kind" element={<ReportView />} />
            <Route path="reports/export" element={<ReportExport />} />
            <Route path="products" element={<AdminProducts />} />
            <Route path="categories" element={<AdminCategories />} />
            <Route path="orders" element={<AdminOrders />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="wallet" element={<AdminWallet />} />
            <Route path="complaints" element={<AdminComplaints />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="settings" element={<Settings />} />
            <Route path="audit" element={<AdminAudit />} />
            <Route path="reports" element={<CategoryReports />} />
            <Route path="reports/:slug" element={<CategoryReportDetail />} />
            <Route path="account" element={<Navigate to="/admin/settings" replace />} />
            <Route path="notifications" element={<Notifications />} />
          </Route>
        </Route>
        <Route element={<PublicLayout />}>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

function SellerOutlet() {
  return <Outlet />;
}
