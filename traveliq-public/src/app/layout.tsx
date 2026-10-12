import type { Metadata } from 'next';
import './globals.css';
export const metadata: Metadata = {
  title: 'TravelIQ | Agency intelligence',
  description: 'A considered workspace for bookings, finances and travel intelligence.',
};
export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
