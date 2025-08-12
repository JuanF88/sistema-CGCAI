'use client'

import { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'

import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { supabase } from '@/lib/supabaseClient'

import { Dialog } from '@headlessui/react' // Asegúrate de tenerlo instalado con: npm install @headlessui/react
import { CloudUpload } from 'lucide-react' // npm install lucide-react
import { toast } from 'react-toastify'


export const exportarExcel = async (hallazgos) => {
    const workbook = new ExcelJS.Workbook()
    const worksheet = workbook.addWorksheet('Hallazgos')

    // Encabezados
    worksheet.addRow([
        'Informe ID', 'Año', 'Semestre', 'Auditor', 'Dependencia',
        'Tipo de Hallazgo', 'ISO', 'Capítulo', 'Numeral', 'Descripción'
    ])

    for (const hallazgo of hallazgos) {
        const informe = Array.isArray(hallazgo.informes_auditoria)
            ? hallazgo.informes_auditoria[0]
            : hallazgo.informes_auditoria

        const fecha = new Date(informe?.fecha_auditoria)
        const anio = fecha.getFullYear()
        const semestre = fecha.getMonth() < 6 ? '1' : '2'
        const auditor = `${informe?.usuarios?.nombre || ''} ${informe?.usuarios?.apellido || ''}`
        const dependencia = informe?.dependencias?.nombre || ''
        const tipo = hallazgo.tipo || inferirTipoDesdeTabla(hallazgo)
        const iso = hallazgo.iso?.iso || ''
        const capitulo = hallazgo.capitulos?.capitulo || ''
        const numeral = hallazgo.numerales?.numeral || ''
        const descripcion = hallazgo.descripcion || ''

        worksheet.addRow([
            hallazgo.informe_id,
            anio,
            semestre,
            auditor,
            dependencia,
            tipo,
            iso,
            capitulo,
            numeral,
            descripcion
        ])
    }

    const buffer = await workbook.xlsx.writeBuffer()
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    saveAs(blob, 'reporte_hallazgos.xlsx')
}

// Función auxiliar para deducir el tipo si no está explícito
function inferirTipoDesdeTabla(hallazgo) {
    if (hallazgo?.tipo) return hallazgo.tipo
    if (hallazgo?.hasOwnProperty('fortaleza_id')) return 'Fortalezas'
    if (hallazgo?.hasOwnProperty('oportunidad_mejora_id')) return 'Oportunidades de Mejora'
    if (hallazgo?.hasOwnProperty('no_conformidad_id')) return 'No Conformidades'
    return 'N/A'
}

export default function VistaHallazgosAdmin() {
    const [hallazgos, setHallazgos] = useState([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [dragOver, setDragOver] = useState(false)

    const [archivoExcel, setArchivoExcel] = useState(null)
    const [progresoCarga, setProgresoCarga] = useState(0)
    const [estaCargando, setEstaCargando] = useState(false)
    const [cancelarCarga, setCancelarCarga] = useState(false)

    const fetchHallazgos = async () => {
        const res = await fetch('/api/hallazgos')
        const data = await res.json()
        setHallazgos(data)
    }

    useEffect(() => {
        fetchHallazgos()
    }, [])

    useEffect(() => {
        const fetchHallazgos = async () => {
            const res = await fetch('/api/hallazgos')
            const data = await res.json()
            console.log('Hallazgos recibidos:', data)
            setHallazgos(data)
        }

        fetchHallazgos()
    }, [])


const handleUploadExcel = async (e) => {
  setEstaCargando(true);
  setProgresoCarga(0);
  setCancelarCarga(false);

  const norm = (v) => (v == null ? '' : String(v))
    .replace(/\u00A0/g, ' ')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  const cellToString = (v) => {
    if (v == null) return '';
    if (typeof v === 'object') {
      if ('text' in v && v.text) return String(v.text);
      if ('result' in v && v.result != null) return String(v.result);
      if ('richText' in v && Array.isArray(v.richText))
        return v.richText.map(t => t.text ?? '').join('');
      if ('hyperlink' in v && v.hyperlink) return String(v.hyperlink);
      if ('formula' in v && v.formula) return String(v.result ?? '');
    }
    return String(v);
  };

  const read = (row, idx) => cellToString(row?.[idx]);

  try {
    const file = e.target.files[0];
    if (!file) return;

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(await file.arrayBuffer());
    const worksheet = workbook.getWorksheet('Hallazgos') || workbook.worksheets[0];

    const all = worksheet.getSheetValues();
    if (!all || all.length < 2) {
      toast.error('La hoja está vacía o no se pudo leer.');
      return;
    }

    let headerRowIdx = 1;
    for (let i = 1; i < Math.min(all.length, 6); i++) {
      const r = all[i];
      if (!Array.isArray(r)) continue;
      const joined = norm(r.map(cellToString).join(' | '));
      if (
        joined.includes('informe id') &&
        (joined.includes('año') || joined.includes('ano')) &&
        joined.includes('dependencia') &&
        (joined.includes('tipo de hallazgo') || joined.includes('tipo')) &&
        joined.includes('descripcion')
      ) {
        headerRowIdx = i;
        break;
      }
    }

    const headerRaw = (all[headerRowIdx] || []).map(cellToString);
    const findCol = (...aliases) => {
      const idx = headerRaw.findIndex(h => {
        const H = norm(h);
        return aliases.some(a => H === a || H.includes(a));
      });
      return idx >= 0 ? idx : null;
    };

    const cAno          = findCol('año', 'ano');
    const cDependencia  = findCol('dependencia');
    const cTipo         = findCol('tipo de hallazgo', 'tipo');
    const cISO          = findCol('iso');
    const cCapitulo     = findCol('capitulo', 'capítulo');
    const cNumeral      = findCol('numeral');
    const cDescripcion  = findCol('descripcion', 'descripción');

    if (cAno == null || cDependencia == null || cTipo == null || cDescripcion == null) {
      toast.error('No se pudieron detectar correctamente las columnas clave (Año, Dependencia, Tipo, Descripción).');
      return;
    }

    const rows = (all.slice(headerRowIdx + 1) || []).filter(Array.isArray);
    const filasValidas = rows.filter(r => {
      const anioRaw = read(r, cAno);
      const dep     = read(r, cDependencia);
      const tipo    = read(r, cTipo);
      const desc    = read(r, cDescripcion);
      return norm(anioRaw) && norm(dep) && norm(tipo) && norm(desc);
    });

    if (filasValidas.length === 0) {
      toast.error('No se encontraron filas válidas en el Excel (revisa Año, Dependencia, Tipo y Descripción).');
      return;
    }

    let procesadas = 0;
    let insertadas = 0;
    const totalValidas = filasValidas.length;

    for (const r of rows) {
      if (cancelarCarga) { 
        toast('Carga cancelada por el usuario.');
        break;
      }

      const anioRaw           = read(r, cAno);
      const dependenciaNombre = read(r, cDependencia);
      const tipo              = read(r, cTipo);
      const iso               = cISO != null ? read(r, cISO) : '';
      const capitulo          = cCapitulo != null ? read(r, cCapitulo) : '';
      const numeral           = cNumeral != null ? read(r, cNumeral) : '';
      const descripcion       = read(r, cDescripcion);

      if (!norm(anioRaw) || !norm(dependenciaNombre) || !norm(tipo) || !norm(descripcion)) continue;

      const anio = parseInt(norm(anioRaw), 10);
      if (!Number.isFinite(anio)) continue;

      const depNombre = (dependenciaNombre ?? '').toString().trim();
      const tipoStr   = (tipo ?? '').toString().trim();
      const isoStr    = (iso ?? '').toString().trim();
      const capStr    = (capitulo ?? '').toString().trim();
      const numStr    = (numeral ?? '').toString().trim();
      const descStr   = (descripcion ?? '').toString().trim();

      const { data: depData } = await supabase
        .from('dependencias')
        .select('dependencia_id')
        .ilike('nombre', depNombre)
        .limit(1)
        .maybeSingle();
      if (!depData) continue;

      const { data: existingInforme } = await supabase
        .from('informes_auditoria')
        .select('id')
        .eq('dependencia_id', depData.dependencia_id)
        .gte('fecha_auditoria', `${anio}-01-01`)
        .lte('fecha_auditoria', `${anio}-12-31`)
        .limit(1)
        .maybeSingle();

      let informeIdUsar = existingInforme?.id;
      if (!informeIdUsar) {
        const { data: nuevoInforme } = await supabase
          .from('informes_auditoria')
          .insert({
            fecha_auditoria: `${anio}-07-01`,
            fecha_seguimiento: `${anio}-07-01`,
            usuario_id: 1,
            dependencia_id: depData.dependencia_id,
            asistencia_tipo: 'Digital',
            auditores_acompanantes: ['N/A'],
            objetivo: 'Registro automático de hallazgos históricos',
            criterios: 'Importación Excel',
            conclusiones: 'N/A',
            recomendaciones: 'N/A'
          })
          .select('id')
          .single();
        if (!nuevoInforme) continue;
        informeIdUsar = nuevoInforme.id;
      }

      const { data: isoData } = await supabase
        .from('iso')
        .select('id')
        .eq('iso', isoStr)
        .limit(1)
        .maybeSingle();
      if (!isoData) continue;

      const { data: capData } = await supabase
        .from('capitulos')
        .select('id')
        .eq('capitulo', capStr)
        .eq('iso_id', isoData.id)
        .limit(1)
        .maybeSingle();
      if (!capData) continue;

      const { data: numData } = await supabase
        .from('numerales')
        .select('id')
        .eq('numeral', numStr)
        .eq('capitulo_id', capData.id)
        .limit(1)
        .maybeSingle();
      if (!numData) continue;

      let tableName = 'no_conformidades';
      if (tipoStr.toLowerCase().includes('fortaleza')) tableName = 'fortalezas';
      else if (tipoStr.toLowerCase().includes('mejora')) tableName = 'oportunidades_mejora';

      const { error: insertErr } = await supabase.from(tableName).insert({
        informe_id: informeIdUsar,
        descripcion: descStr,
        iso_id: isoData.id,
        capitulo_id: capData.id,
        numeral_id: numData.id
      });
      if (insertErr) continue;

      insertadas++;
      procesadas++;
      setProgresoCarga(Math.round((procesadas / totalValidas) * 100));
      await new Promise(res => setTimeout(res, 10));
    }

    await fetchHallazgos();
    setProgresoCarga(100);
    if (!cancelarCarga) {
      toast.success(`Importación completada: ${insertadas} de ${totalValidas} filas insertadas.`);
    }

  } catch (err) {
    console.error('Error general en importación:', err);
    toast.error('Ocurrió un error leyendo el Excel o durante la importación. Revisa la consola.');
  } finally {
    setEstaCargando(false);
    setArchivoExcel(null);
    setIsModalOpen(false);
  }
};


    const columnas = [
        { name: 'Informe ID', selector: row => row.informe_id, sortable: true },
        {
            name: 'Año',
            selector: row => {
                const auditoria = Array.isArray(row.informes_auditoria)
                    ? row.informes_auditoria[0]
                    : row.informes_auditoria

                const fecha = auditoria?.fecha_auditoria
                return fecha ? new Date(fecha).getFullYear() : 'N/A'
            },
            sortable: true
        },
        {
            name: 'Semestre',
            sortable: true,
            selector: row => {
                const auditoria = Array.isArray(row.informes_auditoria)
                    ? row.informes_auditoria[0]
                    : row.informes_auditoria

                const fecha = auditoria?.fecha_auditoria
                if (!fecha) return 'N/A'

                const mes = new Date(fecha).getMonth() + 1
                return mes <= 6 ? '1' : '2'
            }
        },
        {
            name: 'Auditor',
            sortable: true,
            cell: row => {
                const auditor = Array.isArray(row.informes_auditoria)
                    ? row.informes_auditoria[0]
                    : row.informes_auditoria

                const nombre = auditor?.usuarios?.nombre || ''
                const apellido = auditor?.usuarios?.apellido || ''
                return <span>{`${nombre} ${apellido}`}</span>
            }
        },
        {
            name: 'Dependencia',
            sortable: true,
            cell: row => {
                const auditor = Array.isArray(row.informes_auditoria)
                    ? row.informes_auditoria[0]
                    : row.informes_auditoria

                return <span>{auditor?.dependencias?.nombre || ''}</span>
            }
        },
        {
            name: 'Tipo',
            selector: row => row.tipo,
            sortable: true
        },
        {
            name: 'ISO',
            selector: row => row.iso?.iso || '',
            sortable: true,
        },
        {
            name: 'Capítulo',
            selector: row => row.capitulos?.capitulo || '',
            sortable: true
        },
        {
            name: 'Numeral',
            selector: row => row.numerales?.numeral || '',
            sortable: true
        },
        {
            name: 'Descripción',
            selector: row => row.descripcion,
            wrap: true,
        },
    ]

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-700">Reporte de Hallazgos</h2>

            <div className="flex justify-between items-center mb-4 gap-4">
                <button
                    onClick={() => setIsModalOpen(true)}
                    disabled={estaCargando}
                    className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                >
                    <CloudUpload size={18} />
                    Cargar Excel
                </button>

                <button
                    onClick={() => exportarExcel(hallazgos)}
                    disabled={estaCargando}
                    className="bg-emerald-600 text-white px-4 py-2 rounded hover:bg-emerald-700 disabled:opacity-50"
                >
                    Descargar Excel
                </button>
            </div>

            <DataTable
                columns={columnas}
                data={hallazgos}
                keyField="key"
                pagination
                highlightOnHover
                responsive
                striped
                noDataComponent="No hay hallazgos registrados."
            />

            <Dialog open={isModalOpen} onClose={() => setIsModalOpen(false)} className="relative z-50">
                <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
                <div className="fixed inset-0 flex items-center justify-center p-4">
                    <Dialog.Panel
                        className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md border"
                        onDragOver={(e) => {
                            e.preventDefault()
                            setDragOver(true)
                        }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={async (e) => {
                            e.preventDefault()
                            setDragOver(false)
                            const file = e.dataTransfer.files[0]
                            if (file) await handleUploadExcel({ target: { files: [file] } })
                            setIsModalOpen(false)
                        }}
                    >
                        <Dialog.Title className="text-lg font-bold mb-4">Subir archivo Excel</Dialog.Title>
                        <div
                            className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${dragOver ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                                }`}
                        >
                            <p className="text-gray-600">Arrastra y suelta tu archivo aquí</p>
                            <p className="text-sm text-gray-400 mb-2">o</p>

                            <input
                                type="file"
                                accept=".xlsx"
                                onChange={(e) => setArchivoExcel(e.target.files[0])}
                                className="block w-full text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-600 file:text-white hover:file:bg-blue-700 cursor-pointer"
                                disabled={estaCargando}
                            />

                            {archivoExcel && !estaCargando && (
                                <div className="mt-4 flex gap-2 justify-center">
                                    <button
                                        onClick={() => {
                                            setCancelarCarga(false)
                                            handleUploadExcel({ target: { files: [archivoExcel] } })
                                        }}
                                        className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                                    >
                                        Confirmar Carga
                                    </button>

                                    <button
                                        onClick={() => {
                                            setArchivoExcel(null)
                                            setIsModalOpen(false)
                                        }}
                                        className="bg-red-600 text-white px-4 py-2 rounded hover:bg-red-700"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            )}
                        </div>

                        {estaCargando && (
                            <>
                                <div className="mt-4">
                                    <div className="w-full bg-gray-200 rounded-full h-4">
                                        <div
                                            className="bg-blue-600 h-4 rounded-full transition-all duration-200"
                                            style={{ width: `${progresoCarga}%` }}
                                        ></div>
                                    </div>
                                    <p className="text-sm text-center text-gray-600 mt-1">{progresoCarga}% completado</p>
                                </div>

                                <div className="mt-4 flex justify-center">
                                    <button
                                        onClick={() => setCancelarCarga(true)}
                                        className="bg-yellow-600 text-white px-4 py-2 rounded hover:bg-yellow-700"
                                    >
                                        Detener carga
                                    </button>
                                </div>
                            </>
                        )}
                    </Dialog.Panel>
                </div>
            </Dialog>
        </div>
    )


}
