import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@supabase/supabase-js'
 
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY)
const SERPER_API_KEY = process.env.SERPER_API_KEY
 
// 24 provincias divididas en 3 grupos de 8, se rota cada dia
const GRUPOS_PROVINCIAS = [
  ['Madrid', 'Barcelona', 'Valencia', 'Sevilla', 'Málaga', 'Alicante', 'Bilbao', 'Zaragoza'],
  ['Murcia', 'Palma de Mallorca', 'Las Palmas de Gran Canaria', 'Córdoba', 'Valladolid', 'Vigo', 'Granada', 'Vitoria-Gasteiz'],
  ['Santander', 'Pamplona', 'Almería', 'San Sebastián', 'Burgos', 'Albacete', 'Gijón', 'Badajoz'],
  ['Toledo', 'Lleida', 'Tarragona', 'Girona', 'Castellón', 'Huelva', 'Jaén', 'Cáceres'],
  ['Logroño', 'Salamanca', 'Teruel', 'Huesca', 'Cuenca', 'Guadalajara', 'Soria', 'Segovia'],
  ['Ávila', 'Zamora', 'Palencia', 'León', 'Lugo', 'Ourense', 'Pontevedra', 'A Coruña'],
  ['Santa Cruz de Tenerife', 'Ibiza', 'Menorca', 'Ceuta', 'Melilla', 'Mérida', 'Ciudad Real', 'Albacete']
]
 
function getGrupoHoy() {
  return GRUPOS_PROVINCIAS.flat()
}
 
async function buscarEnGoogle(query) {
  console.log(`🔍 Buscando: ${query}`)
  const response = await fetch('https://google.serper.dev/search', {
    method: 'POST',
    headers: {
      'X-API-KEY': SERPER_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ q: query, gl: 'es', hl: 'es', num: 5 })
  })
  const data = await response.json()
  return data.organic || []
}
 
function limpiarJSON(texto) {
  return texto
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()
}
 
async function buscarInstalacionesEnProvincia(provincia) {
  console.log(`\n📍 Procesando ${provincia}...`)
 
  const resultados = await buscarEnGoogle(`pistas pickleball ${provincia} España club instalaciones`)
  const resultados2 = await buscarEnGoogle(`pickleball ${provincia} donde jugar federacion`)
  const resultados3 = await buscarEnGoogle(`pickleball ${provincia} torneo club 2026`)
  const resultados4 = await buscarEnGoogle(`"pickleball" "${provincia}" pistas reservar`)

  const todosResultados = [...resultados, ...resultados2, ...resultados3, ...resultados4]
 
  if (todosResultados.length === 0) {
    console.log(`No se encontraron resultados para ${provincia}`)
    return []
  }
 
  const contexto = todosResultados.map(r => `
Titulo: ${r.title}
URL: ${r.link}
Descripcion: ${r.snippet}
`).join('\n---\n')
 
const mensaje = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 4000,
    messages: [{
      role: 'user',
      content: `Analiza estos resultados de búsqueda reales de Google sobre instalaciones de pickleball en ${provincia}, España:
 
${contexto}
 
Extrae SOLO las instalaciones que aparecen claramente mencionadas en estos resultados. NO inventes nada que no esté en los resultados.
 
Para cada instalación encontrada, devuelve un JSON array con este formato exacto:
[
  {
    "nombre": "nombre exacto del club o instalación",
    "direccion": "dirección si aparece en los resultados, sino null",
    "ciudad": "ciudad",
    "provincia": "${provincia}",
    "latitud": coordenada_real_aproximada,
    "longitud": coordenada_real_aproximada,
    "tipo": "privado" o "público",
    "telefono": "teléfono si aparece, sino null",
    "email": "email si aparece, sino null",
    "web": "URL exacta del resultado si es la web del club, sino null",
    "descripcion": "descripción breve basada en lo que dicen los resultados",
    "num_pistas": número_si_se_menciona_sino_null,
    "fuente_url": "URL del resultado donde encontraste esta info"
  }
]
 
Reglas importantes:
- Solo incluye instalaciones que claramente tengan pistas de pickleball (no solo padel)
- Usa coordenadas reales aproximadas de la ciudad/barrio mencionado
- Si no tienes suficiente info para una instalación, no la incluyas
- Devuelve SOLO el JSON array, sin texto adicional ni markdown`
    }]
  })
 
  try {
    const texto = limpiarJSON(mensaje.content[0].text)
    const instalaciones = JSON.parse(texto)
    console.log(`✅ ${instalaciones.length} instalaciones encontradas en ${provincia}`)
    return Array.isArray(instalaciones) ? instalaciones : []
  } catch (e) {
    console.error(`Error parseando instalaciones de ${provincia}:`, e.message)
    return []
  }
}
 
async function buscarEventosInstalacion(instalacion) {
  const resultados = await buscarEnGoogle(
    `torneo pickleball ${instalacion.ciudad} ${new Date().getFullYear()} inscripcion`
  )
 
  if (resultados.length === 0) return []
 
  const contexto = resultados.map(r => `
Titulo: ${r.title}
URL: ${r.link}
Descripcion: ${r.snippet}
`).join('\n---\n')
 
  const mensaje = await anthropic.messages.create({
    model: 'claude-opus-4-5',
    max_tokens: 1000,
    messages: [{
      role: 'user',
      content: `Analiza estos resultados de búsqueda sobre torneos/eventos de pickleball en ${instalacion.ciudad}, España:
 
${contexto}
 
Extrae SOLO los eventos o torneos futuros que aparezcan claramente en estos resultados. NO inventes nada.
La fecha de hoy es ${new Date().toISOString().split('T')[0]}.
 
Devuelve un JSON array con este formato:
[
  {
    "nombre": "nombre del evento",
    "descripcion": "descripción breve",
    "fecha_inicio": "YYYY-MM-DD",
    "fecha_fin": "YYYY-MM-DD o null",
    "precio": número_o_null,
    "url_inscripcion": "URL si aparece, sino null"
  }
]
 
Reglas:
- Solo eventos con fecha futura a hoy
- Solo si la información es clara y verificable en los resultados
- Devuelve SOLO el JSON array, sin texto adicional ni markdown
- Si no hay eventos claros, devuelve []`
    }]
  })
 
  try {
    const texto = limpiarJSON(mensaje.content[0].text)
    const eventos = JSON.parse(texto)
    return Array.isArray(eventos) ? eventos : []
  } catch (e) {
    console.error(`Error parseando eventos:`, e.message)
    return []
  }
}
 
async function guardarInstalacion(instalacion) {
  const { data: existente } = await supabase
    .from('instalaciones')
    .select('id')
    .eq('nombre', instalacion.nombre)
    .eq('ciudad', instalacion.ciudad)
    .single()
 
  if (existente) {
    const { data } = await supabase
      .from('instalaciones')
      .update({ ...instalacion, actualizado_en: new Date().toISOString() })
      .eq('id', existente.id)
      .select()
      .single()
    console.log(`🔄 Actualizada: ${instalacion.nombre}`)
    return data
  } else {
    const { data } = await supabase
      .from('instalaciones')
      .insert(instalacion)
      .select()
      .single()
    console.log(`✨ Nueva: ${instalacion.nombre}`)
    return data
  }
}
 
async function guardarEventos(instalacionId, eventos) {
  await supabase.from('eventos').delete().eq('instalacion_id', instalacionId)
  if (eventos.length > 0) {
    const eventosConId = eventos.map(e => ({ ...e, instalacion_id: instalacionId }))
    await supabase.from('eventos').insert(eventosConId)
    console.log(`📅 ${eventos.length} eventos guardados`)
  }
}
 
async function main() {
  console.log('🏓 Iniciando actualización de instalaciones de pickleball en España...')
  console.log(`📅 Fecha: ${new Date().toLocaleString('es-ES')}`)
 
  const provinciasHoy = getGrupoHoy()
  console.log(`🗺️  Provincias de hoy: ${provinciasHoy.join(', ')}`)
 
  let totalInstalaciones = 0
  let totalEventos = 0
 
  for (const provincia of provinciasHoy) {
    try {
      const instalaciones = await buscarInstalacionesEnProvincia(provincia)
 
      for (const instalacion of instalaciones) {
        const guardada = await guardarInstalacion(instalacion)
        if (guardada) {
          totalInstalaciones++
          const eventos = await buscarEventosInstalacion(instalacion)
          await guardarEventos(guardada.id, eventos)
          totalEventos += eventos.length
        }
        await new Promise(r => setTimeout(r, 1000))
      }
 
      await new Promise(r => setTimeout(r, 3000))
 
    } catch (error) {
      console.error(`Error procesando ${provincia}:`, error.message)
    }
  }
 
  console.log(`\n✅ Actualización completada:`)
  console.log(`   📍 ${totalInstalaciones} instalaciones procesadas`)
  console.log(`   📅 ${totalEventos} eventos encontrados`)
}
 
main()