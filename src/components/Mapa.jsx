import { useEffect, useState } from 'react'
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet'
import { supabase } from '../lib/supabase'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'
 
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
})
 
export default function Mapa() {
  const [instalaciones, setInstalaciones] = useState([])
  const [busqueda, setBusqueda] = useState('')
  const [cargando, setCargando] = useState(true)
 
  useEffect(() => {
    cargarInstalaciones()
  }, [])
 
  async function cargarInstalaciones() {
    const { data, error } = await supabase
      .from('instalaciones')
      .select(`*, eventos(*)`)
    if (error) console.error(error)
    else setInstalaciones(data)
    setCargando(false)
  }
 
  const instalacionesFiltradas = instalaciones.filter(i =>
    i.nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.ciudad?.toLowerCase().includes(busqueda.toLowerCase()) ||
    i.provincia?.toLowerCase().includes(busqueda.toLowerCase())
  )
 
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{
        background: '#1a1a2e',
        padding: '12px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: '20px',
        zIndex: 1000
      }}>
        <h1 style={{ color: '#00d4aa', margin: 0, fontSize: '1.3rem' }}>
          🏓 Pickleball España
        </h1>
        <input
          type="text"
          placeholder="Buscar pista, ciudad o provincia..."
          value={busqueda}
          onChange={e => setBusqueda(e.target.value)}
          style={{
            flex: 1,
            maxWidth: '400px',
            padding: '8px 16px',
            borderRadius: '20px',
            border: 'none',
            fontSize: '0.95rem',
            outline: 'none'
          }}
        />
        <span style={{ color: '#aaa', fontSize: '0.85rem' }}>
          {instalacionesFiltradas.length} instalaciones
        </span>
      </div>
 
      {cargando ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f0f0f0' }}>
          <p>Cargando mapa...</p>
        </div>
      ) : (
        <MapContainer
          center={[40.416775, -3.703790]}
          zoom={6}
          style={{ flex: 1 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {instalacionesFiltradas.map(instalacion => (
            instalacion.latitud && instalacion.longitud && (
              <Marker
                key={instalacion.id}
                position={[instalacion.latitud, instalacion.longitud]}
              >
                <Popup maxWidth={300}>
                  <div style={{ minWidth: '200px' }}>
                    <h3 style={{ margin: '0 0 8px', color: '#1a1a2e' }}>{instalacion.nombre}</h3>
                    <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>📍 {instalacion.direccion}, {instalacion.ciudad}</p>
                    {instalacion.telefono && <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>📞 {instalacion.telefono}</p>}
                    {instalacion.web && (
                      <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                        🌐 <a href={instalacion.web} target="_blank" rel="noreferrer">Web</a>
                      </p>
                    )}
                    {instalacion.num_pistas && <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>🎾 {instalacion.num_pistas} pistas</p>}
                    {instalacion.eventos && instalacion.eventos.length > 0 && (
                      <div style={{ marginTop: '10px', borderTop: '1px solid #eee', paddingTop: '8px' }}>
                        <strong style={{ fontSize: '0.85rem' }}>📅 Próximos eventos:</strong>
                        {instalacion.eventos.map(evento => (
                          <div key={evento.id} style={{ marginTop: '6px', fontSize: '0.8rem', background: '#f5f5f5', padding: '6px', borderRadius: '6px' }}>
                            <strong>{evento.nombre}</strong>
                            <br />
                            {evento.fecha_inicio} {evento.fecha_fin && `→ ${evento.fecha_fin}`}
                            {evento.precio && <span> · {evento.precio}€</span>}
                            {evento.url_inscripcion && (
                              <><br /><a href={evento.url_inscripcion} target="_blank" rel="noreferrer">Inscribirse</a></>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Popup>
              </Marker>
            )
          ))}
        </MapContainer>
      )}
    </div>
  )
}