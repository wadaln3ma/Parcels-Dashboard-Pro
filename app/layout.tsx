
import './globals.css';
import 'leaflet/dist/leaflet.css';
import 'leaflet-draw/dist/leaflet.draw.css';

export const metadata = { title: 'Parcel Dashboard Pro', description: 'Next.js + PostGIS + Leaflet' };
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (<html lang="en"><body className="text-slate-900">{children}</body></html>);
}
