import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { HomePage } from './pages/HomePage.jsx';
import { ItemDetailPage } from './pages/ItemDetailPage.jsx';
import { LayoutPage } from './pages/LayoutPage.jsx';
import { CarryInPage } from './pages/CarryInPage.jsx';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/items/:id" element={<ItemDetailPage />} />
        <Route path="/layout" element={<LayoutPage />} />
        <Route path="/carry" element={<CarryInPage />} />
      </Routes>
    </BrowserRouter>
  );
}
