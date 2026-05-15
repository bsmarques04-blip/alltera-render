import Link from "next/link";
import { BarChart3, CalendarDays, MapPinned } from "lucide-react";

export function AppHeader() {
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link className="brand" href="/">
          <span className="brand-mark">A</span>
          <span>
            <strong>Alltera</strong>
            <span>Apoio a decisao comercial</span>
          </span>
        </Link>

        <nav className="nav" aria-label="Navegacao principal">
          <Link href="/">
            <MapPinned size={18} />
            Leads
          </Link>
          <Link href="/planeamento">
            <CalendarDays size={18} />
            Planeamento
          </Link>
          <Link href="/dashboard">
            <BarChart3 size={18} />
            Dashboard
          </Link>
        </nav>
      </div>
    </header>
  );
}
