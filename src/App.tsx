/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Home from './pages/Home.tsx';
import CustomerMenu from './pages/CustomerMenu.tsx';
import OwnerDashboard from './pages/OwnerDashboard.tsx';
import RestaurantSetup from './pages/RestaurantSetup.tsx';
import PublicRedirect from './pages/PublicRedirect.tsx';
import JoinRestaurant from './pages/JoinRestaurant.tsx';
import CeoDashboard from './pages/CeoDashboard.tsx';

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-neutral-50 font-sans text-neutral-900">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/menu/:restaurantId/:tableNo" element={<CustomerMenu />} />
          <Route path="/dashboard" element={<OwnerDashboard />} />
          <Route path="/setup" element={<RestaurantSetup />} />
          <Route path="/q/:qrId" element={<PublicRedirect />} />
          <Route path="/join/:restaurantId" element={<JoinRestaurant />} />
          <Route path="/ceo" element={<CeoDashboard />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}

