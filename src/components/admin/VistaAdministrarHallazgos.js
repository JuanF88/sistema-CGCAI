'use client'

import { useEffect, useState } from 'react'
import DataTable from 'react-data-table-component'

import { saveAs } from 'file-saver'
import ExcelJS from 'exceljs'
import { supabase } from '@/lib/supabaseClient'

import { Dialog } from '@headlessui/react' // Asegúrate de tenerlo instalado con: npm install @headlessui/react
import { CloudUpload } from 'lucide-react' // npm install lucide-react

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
        setEstaCargando(true)
        setProgresoCarga(0)
        setCancelarCarga(false)

        const file = e.target.files[0]
        if (!file) return

        const workbook = new ExcelJS.Workbook()
        await workbook.xlsx.load(await file.arrayBuffer())
        const worksheet = workbook.getWorksheet('Hallazgos') || workbook.worksheets[0]

        const rows = worksheet.getSheetValues().slice(2) // Omitir encabezado

        // 1. Filtrar solo filas válidas
        const filasValidas = rows.filter(row => {
            const [
                ,
                ,
                anioRaw,
                ,
                ,
                dependenciaNombre,
                tipo,
                ,
                ,
                ,
                descripcion
            ] = row || []

            return anioRaw && dependenciaNombre && tipo && descripcion
        })

        const totalValidas = filasValidas.length
        let procesadas = 0

        for (const [index, row] of rows.entries()) {
            if (cancelarCarga) {
                alert('Carga cancelada por el usuario.')
                break
            }

            const [
                ,
                informeId,
                anioRaw,
                semestreRaw,
                auditorRaw,
                dependenciaNombre,
                tipo,
                iso,
                capitulo,
                numeral,
                descripcion
            ] = row

            if (!tipo || !descripcion || !dependenciaNombre || !anioRaw) continue

            const anio = parseInt(anioRaw.toString().trim())

            // Buscar dependencia
            const { data: depData } = await supabase
                .from('dependencias')
                .select('dependencia_id')
                .ilike('nombre', dependenciaNombre.toString().trim())
                .maybeSingle()

            if (!depData) {
                console.warn(`Dependencia "${dependenciaNombre}" no encontrada, fila ignorada.`)
                continue
            }

            // Buscar o crear informe
            const { data: existingInforme } = await supabase
                .from('informes_auditoria')
                .select('id')
                .eq('dependencia_id', depData.dependencia_id)
                .gte('fecha_auditoria', `${anio}-01-01`)
                .lte('fecha_auditoria', `${anio}-12-31`)
                .maybeSingle()

            let informeIdUsar = existingInforme?.id

            if (!informeIdUsar) {
                const { data: nuevoInforme, error: insertError } = await supabase
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
                    .select()
                    .single()

                if (insertError || !nuevoInforme) {
                    console.error(`Error creando informe:`, insertError?.message)
                    continue
                }

                informeIdUsar = nuevoInforme.id
            }

            // Buscar ISO
            const { data: isoData } = await supabase
                .from('iso')
                .select('id')
                .eq('iso', iso?.toString().trim())
                .maybeSingle()

            if (!isoData) {
                console.warn(`ISO "${iso}" no encontrado, fila ignorada.`)
                continue
            }

            const { data: capData } = await supabase
                .from('capitulos')
                .select('id')
                .eq('capitulo', capitulo?.toString().trim())
                .eq('iso_id', isoData.id)
                .maybeSingle()

            if (!capData) {
                console.warn(`Capítulo "${capitulo}" no encontrado, fila ignorada.`)
                continue
            }

            const { data: numData } = await supabase
                .from('numerales')
                .select('id')
                .eq('numeral', numeral?.toString().trim())
                .eq('capitulo_id', capData.id)
                .maybeSingle()

            if (!numData) {
                console.warn(`Numeral "${numeral}" no encontrado, fila ignorada.`)
                continue
            }

            // Determinar tabla destino
            const tipoNormalizado = tipo?.toString().trim().toLowerCase()
            let tableName = 'no_conformidades'

            if (tipoNormalizado.includes('fortaleza')) {
                tableName = 'fortalezas'
            } else if (tipoNormalizado.includes('mejora')) {
                tableName = 'oportunidades_mejora'
            }

            const { error: insertError } = await supabase.from(tableName).insert({
                informe_id: informeIdUsar,
                descripcion: descripcion?.toString().trim(),
                iso_id: isoData.id,
                capitulo_id: capData.id,
                numeral_id: numData.id
            })

            if (insertError) {
                console.error(`Error insertando en ${tableName}:`, insertError.message)
                continue
            }

            // ✅ Actualizar progreso real
            procesadas++
            setProgresoCarga(Math.round((procesadas / totalValidas) * 100))
            await new Promise(resolve => setTimeout(resolve, 30))
        }

        await fetchHallazgos()
        setEstaCargando(false)
        setArchivoExcel(null)
        setIsModalOpen(false)
        setProgresoCarga(100)

        if (!cancelarCarga) alert('Importación completada correctamente.')
    }



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
