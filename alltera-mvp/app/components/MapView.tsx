"use client";

import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import { Lead } from "@/lib/types";

L.Icon.Default.mergeOptions({
  iconRetinaUrl:
    "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png",
  iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png",
  shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png"
});

export function MapView({ leads }: { leads: Lead[] }) {
  const center = leads[0]
    ? ([leads[0].latitude, leads[0].longitude] as [number, number])
    : ([38.7223, -9.1393] as [number, number]);

  return (
    <MapContainer
      key={`${center[0]}-${center[1]}-${leads.length}`}
      className="map"
      center={center}
      zoom={leads.length ? 12 : 7}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {leads.map((lead) => (
        <Marker key={lead.id} position={[lead.latitude, lead.longitude]}>
          <Popup>
            <strong>{lead.name}</strong>
            <br />
            {lead.clientType} - {lead.locality}
            <br />
            Prioridade: {lead.priority}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
