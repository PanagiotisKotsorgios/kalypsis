import { Navigate, Route, Routes } from "react-router-dom";
import { LandingPage } from "./pages/LandingPage";
import { CustomSoftwarePage } from "./pages/CustomSoftwarePage";
import { LoginPage } from "./pages/LoginPage";
import { RegisterPage } from "./pages/RegisterPage";
import { PricingPage } from "./pages/PricingPage";
import { ContactPage } from "./pages/ContactPage";
import { FaqPage } from "./pages/FaqPage";
import { CompanyComingSoonPage } from "./pages/CompanyComingSoonPage";
import type { NavItem } from "./components/AppLayout";
import type { Role } from "./auth/AuthContext";

export const navByRole: Partial<Record<Role, NavItem[]>> = {
  PlatformAdmin: [],
  PlatformEmployee: [],
  AgencyAdmin: [],
  AgencyOfficeAdmin: [],
  AgencyUser: [],
  Producer: [],
  Customer: [],
  FederationAdmin: [],
  FederationEmployee: [],
  ClubManager: [],
};

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/pricing" element={<PricingPage />} />
      <Route path="/contact" element={<ContactPage />} />
      <Route path="/faq" element={<FaqPage />} />
      <Route path="/custom-software-solutions" element={<CustomSoftwarePage />} />
      <Route path="/company/*" element={<CompanyComingSoonPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
