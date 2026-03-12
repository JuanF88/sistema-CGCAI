'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'react-toastify'
import DataTable from 'react-data-table-component'
import {
  Eye,
  EyeOff,
  Edit2,
  Trash2,
  Send,
  UserRound,
  ShieldCheck,
  Building2,
  GraduationCap,
  Phone,
  BriefcaseBusiness,
} from 'lucide-react'
import styles from './CSS/VistaAdministrarUsuarios.module.css'

const FORMULARIO_INICIAL = {
  usuario_id: null,
  nombre: '',
  apellido: '',
  email: '',
  password: '',
  rol: '',
  estado: 'activo',
  tipo_personal: '',
  dependencia_id: '',
  estudios: '',
  tipo_estudio: '',
  celular: '',
}

const ROLES = [
  { value: 'auditor', label: 'Auditor' },
  { value: 'admin', label: 'Administrador' },
  { value: 'gestor', label: 'Gestor' },
  { value: 'visualizador', label: 'Visualizador' },
]

const TIPOS_PERSONAL = [
  { value: 'ops', label: 'OPS' },
  { value: 'docente', label: 'Docente' },
  { value: 'administrativo', label: 'Administrativo' },
  { value: 'otro', label: 'Otro' },
]

const TIPOS_ESTUDIO = [
  { value: 'profesional', label: 'Profesional' },
  { value: 'magister', label: 'Magíster' },
  { value: 'profesional especializado', label: 'Profesional especializado' },
  { value: 'doctor', label: 'Doctor' },
]

const ESTADOS = [
  { value: 'activo', label: 'Activo' },
  { value: 'inactivo', label: 'Inactivo' },
]

const normalize = (s) =>
  (s || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

export default function VistaAdministrarUsuarios() {
  const [usuarios, setUsuarios] = useState([])
  const [dependencias, setDependencias] = useState([])
  const [mostrarModal, setMostrarModal] = useState(false)
  const [editando, setEditando] = useState(false)
  const [mostrarPassword, setMostrarPassword] = useState(false)
  const [guardando, setGuardando] = useState(false)

  const [busqueda, setBusqueda] = useState('')

  const [credOpen, setCredOpen] = useState(false)
  const [credUsuario, setCredUsuario] = useState(null)
  const [credPassword, setCredPassword] = useState('')
  const [credBody, setCredBody] = useState('')
  const [credSubject, setCredSubject] = useState('')

  const [eliminandoId, setEliminandoId] = useState(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [usuarioAEliminar, setUsuarioAEliminar] = useState(null)

  const [formulario, setFormulario] = useState(FORMULARIO_INICIAL)

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [resUsuarios, resDependencias] = await Promise.all([
          fetch('/api/usuarios'),
          fetch('/api/dependencias'),
        ])

        const dataUsuarios = await resUsuarios.json()
        const dataDependencias = await resDependencias.json()

        if (!resUsuarios.ok) {
          throw new Error(dataUsuarios?.error || 'No se pudieron cargar los usuarios')
        }

        if (!resDependencias.ok) {
          throw new Error(dataDependencias?.error || 'No se pudieron cargar las dependencias')
        }

        setUsuarios(Array.isArray(dataUsuarios) ? dataUsuarios : [])
        setDependencias(Array.isArray(dataDependencias) ? dataDependencias : [])
      } catch (error) {
        toast.error(error.message || 'Error cargando datos iniciales')
      }
    }

    fetchData()
  }, [])

  const getDependenciaNombre = (dependenciaId) => {
    if (!dependenciaId) return 'Sin asignar'
    const match = dependencias.find((dep) => String(dep.dependencia_id) === String(dependenciaId))
    return match?.nombre || 'Sin asignar'
  }

  const plantillaCredenciales = ({ nombre, apellido, email, password }) => {
    return `Buen día ${nombre} ${apellido},

    Te comparto tus credenciales de acceso:

    Usuario: ${email}
    Contraseña: ${password}

    Puedes ingresar aquí: https://sistema-cgcai.vercel.app/

    Saludos.`
  }

  const abrirCredenciales = (usuario) => {
    const pwd = usuario.password || ''
    setCredUsuario(usuario)
    setCredPassword(pwd)

    const subject = 'Credenciales de acceso'
    const body = plantillaCredenciales({
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      email: usuario.email || '',
      password: pwd || '*** (edita antes de enviar)',
    })

    setCredSubject(subject)
    setCredBody(body)
    setCredOpen(true)
  }

  const cerrarCredenciales = () => {
    setCredOpen(false)
    setCredUsuario(null)
    setCredPassword('')
    setCredBody('')
    setCredSubject('')
  }

  const copiarCredenciales = async () => {
    try {
      await navigator.clipboard.writeText(credBody)
      toast.success('Texto copiado al portapapeles')
    } catch {
      toast.error('No se pudo copiar')
    }
  }

  const abrirGmailCompose = () => {
    if (!credUsuario?.email) {
      toast.error('Falta el correo del usuario.')
      return
    }

    const to = encodeURIComponent(credUsuario.email)
    const su = encodeURIComponent(credSubject)
    const bo = encodeURIComponent(credBody)
    const url = `https://mail.google.com/mail/?view=cm&fs=1&to=${to}&su=${su}&body=${bo}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormulario((prev) => ({ ...prev, [name]: value }))
  }

  const validarFormulario = () => {
    if (!formulario.nombre.trim()) {
      toast.error('El nombre es obligatorio.')
      return false
    }
    if (!formulario.apellido.trim()) {
      toast.error('El apellido es obligatorio.')
      return false
    }
    if (!formulario.email.trim()) {
      toast.error('El correo es obligatorio.')
      return false
    }
    if (!formulario.rol) {
      toast.error('Selecciona un rol.')
      return false
    }
    if (!editando && !formulario.password.trim()) {
      toast.error('La contraseña es obligatoria para crear el usuario.')
      return false
    }
    return true
  }

  const buildPayload = () => {
    const payload = {
      nombre: formulario.nombre.trim(),
      apellido: formulario.apellido.trim(),
      email: formulario.email.trim(),
      rol: formulario.rol,
      estado: formulario.estado || 'activo',
      tipo_personal: formulario.tipo_personal || null,
      dependencia_id: formulario.dependencia_id ? Number(formulario.dependencia_id) : null,
      estudios: formulario.estudios.trim() || null,
      tipo_estudio: formulario.tipo_estudio || null,
      celular: formulario.celular.trim() || null,
    }

    if (!editando || formulario.password.trim()) {
      payload.password = formulario.password
    }

    return payload
  }

  const solicitarEliminacion = (usuario) => {
    setUsuarioAEliminar(usuario)
    setConfirmOpen(true)
  }

  const confirmarEliminacion = async () => {
    if (!usuarioAEliminar) return

    try {
      setEliminandoId(usuarioAEliminar.usuario_id)
      const res = await fetch(`/api/usuarios?id=${usuarioAEliminar.usuario_id}`, { method: 'DELETE' })

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        throw new Error(err?.error || 'Error al eliminar')
      }

      setUsuarios((prev) => prev.filter((u) => u.usuario_id !== usuarioAEliminar.usuario_id))
      toast.success('Usuario eliminado')
      setConfirmOpen(false)
      setUsuarioAEliminar(null)
    } catch (e) {
      toast.error(e.message || 'No se pudo eliminar')
    } finally {
      setEliminandoId(null)
    }
  }

  const cancelarEliminacion = () => {
    setConfirmOpen(false)
    setUsuarioAEliminar(null)
  }

  const handleSubmit = async () => {
    if (!validarFormulario()) return

    try {
      setGuardando(true)

      let res
      if (editando) {
        if (!formulario.usuario_id) {
          toast.error('No se especificó el ID del usuario a actualizar.')
          return
        }

        res = await fetch(`/api/usuarios?id=${formulario.usuario_id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        })
      } else {
        res = await fetch('/api/usuarios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload()),
        })
      }

      if (!res.ok) {
        const err = await res.json().catch(() => null)
        toast.error('Error al guardar: ' + (err?.error || 'Desconocido'))
        return
      }

      const data = await res.json()
      setUsuarios((prev) =>
        editando
          ? prev.map((u) => (u.usuario_id === data.usuario_id ? data : u))
          : [...prev, data]
      )

      cerrarModal()
      toast.success(editando ? 'Usuario actualizado con éxito' : 'Usuario creado con éxito')
    } catch {
      toast.error('Error inesperado al guardar')
    } finally {
      setGuardando(false)
    }
  }

  const abrirEdicion = (usuario) => {
    setFormulario({
      usuario_id: usuario.usuario_id ?? null,
      nombre: usuario.nombre || '',
      apellido: usuario.apellido || '',
      email: usuario.email || '',
      password: usuario.password || '',
      rol: usuario.rol || '',
      estado: usuario.estado || 'activo',
      tipo_personal: usuario.tipo_personal || '',
      dependencia_id: usuario.dependencia_id ? String(usuario.dependencia_id) : '',
      estudios: usuario.estudios || '',
      tipo_estudio: usuario.tipo_estudio || '',
      celular: usuario.celular || '',
    })
    setEditando(true)
    setMostrarModal(true)
    setMostrarPassword(false)
  }

  const abrirNuevo = () => {
    setFormulario(FORMULARIO_INICIAL)
    setEditando(false)
    setMostrarModal(true)
    setMostrarPassword(false)
  }

  const cerrarModal = () => {
    setFormulario(FORMULARIO_INICIAL)
    setMostrarModal(false)
    setEditando(false)
    setMostrarPassword(false)
  }

  const usuariosVista = useMemo(() => {
    const q = normalize(busqueda)
    if (!q) return usuarios

    return usuarios.filter((u) => {
      const nombreCompleto = `${u.nombre || ''} ${u.apellido || ''}`
      const dependenciaNombre = getDependenciaNombre(u.dependencia_id)

      return (
        normalize(nombreCompleto).includes(q) ||
        normalize(u.email).includes(q) ||
        normalize(u.rol).includes(q) ||
        normalize(u.estado).includes(q) ||
        normalize(u.tipo_personal).includes(q) ||
        normalize(u.tipo_estudio).includes(q) ||
        normalize(u.estudios).includes(q) ||
        normalize(u.celular).includes(q) ||
        normalize(dependenciaNombre).includes(q)
      )
    })
  }, [usuarios, busqueda, dependencias])

  const columnas = [
    {
      name: 'ID',
      selector: (row) => row.usuario_id,
      sortable: true,
      width: '80px',
    },
    {
      name: 'Nombre',
      selector: (row) => `${row.nombre} ${row.apellido}`,
      sortable: true,
      grow: 1.4,
    },
    {
      name: 'Email',
      selector: (row) => row.email,
      sortable: true,
      grow: 1.4,
    },
    {
      name: 'Rol',
      selector: (row) => row.rol,
      sortable: true,
    },
    {
      name: 'Tipo',
      selector: (row) => row.tipo_personal || 'Sin definir',
      sortable: true,
    },
    {
      name: 'Organismo / Área',
      selector: (row) => getDependenciaNombre(row.dependencia_id),
      sortable: true,
      grow: 1.3,
    },
    {
      name: 'Estado',
      selector: (row) => row.estado,
      sortable: true,
    },
    {
      name: 'Acciones',
      width: '280px',
      cell: (row) => (
        <div className={styles.actionButtons}>
          <button
            onClick={() => abrirEdicion(row)}
            className={styles.btnEdit}
            title="Editar usuario"
          >
            <Edit2 size={14} />
          </button>

          <button
            onClick={() => solicitarEliminacion(row)}
            disabled={eliminandoId === row.usuario_id}
            className={`${styles.btnDelete} ${eliminandoId === row.usuario_id ? styles.btnDisabled : ''}`}
            title="Eliminar usuario"
          >
            <Trash2 size={14} />
          </button>

          <button
            onClick={() => abrirCredenciales(row)}
            className={styles.btnCredentials}
            title="Enviar credenciales"
          >
            <Send size={14} />
          </button>
        </div>
      ),
    },
  ]

  const stats = useMemo(() => {
    const total = usuarios.length
    const activos = usuarios.filter((u) => u.estado === 'activo').length
    const inactivos = usuarios.filter((u) => u.estado === 'inactivo').length
    const auditores = usuarios.filter((u) => u.rol === 'auditor').length
    const admins = usuarios.filter((u) => u.rol === 'admin').length
    const gestores = usuarios.filter((u) => u.rol === 'gestor').length
    return { total, activos, inactivos, auditores, admins, gestores }
  }, [usuarios])

  return (
    <div className={styles.container}>
      <div className={styles.modernHeader}>
        <div className={styles.headerContent}>
          <div className={styles.headerLeft}>
            <div className={styles.headerIcon}>👥</div>
            <div className={styles.headerInfo}>
              <h1 className={styles.headerTitle}>Administrar Usuarios</h1>
              <p className={styles.headerSubtitle}>Gestión de usuarios del sistema de auditoría</p>
            </div>
          </div>
          <div className={styles.headerRight}>
            <button className={styles.modernAddBtn} onClick={abrirNuevo} title="Crear nuevo usuario">
              <span className={styles.addIcon}>+</span>
              <span>Nuevo Usuario</span>
            </button>
          </div>
        </div>
      </div>

      <div className={styles.kpiGrid}>
        <div className={`${styles.kpiCard} ${styles.kpiCardBlue}`}>
          <div className={styles.kpiIcon}>👥</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Total Usuarios</div>
            <div className={styles.kpiValue}>{stats.total}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardGreen}`}>
          <div className={styles.kpiIcon}>✅</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Usuarios Activos</div>
            <div className={styles.kpiValue}>{stats.activos}</div>
            <div className={styles.kpiProgress}>
              <div className={styles.kpiProgressTrack}>
                <div className={styles.kpiProgressFill} style={{ width: `${stats.total > 0 ? (stats.activos / stats.total) * 100 : 0}%` }} />
              </div>
              <span className={styles.kpiPercent}>{stats.total > 0 ? Math.round((stats.activos / stats.total) * 100) : 0}%</span>
            </div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardOrange}`}>
          <div className={styles.kpiIcon}>⚠️</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Usuarios Inactivos</div>
            <div className={styles.kpiValue}>{stats.inactivos}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardPurple}`}>
          <div className={styles.kpiIcon}>🔍</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Auditores</div>
            <div className={styles.kpiValue}>{stats.auditores}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardIndigo}`}>
          <div className={styles.kpiIcon}>🔑</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Administradores</div>
            <div className={styles.kpiValue}>{stats.admins}</div>
          </div>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCardCyan}`}>
          <div className={styles.kpiIcon}>📄</div>
          <div className={styles.kpiContent}>
            <div className={styles.kpiLabel}>Gestores</div>
            <div className={styles.kpiValue}>{stats.gestores}</div>
          </div>
        </div>
      </div>

      <div className={styles.tableCard}>
        <div className={styles.tableHeader}>
          <h3 className={styles.tableTitle}>Listado de Usuarios</h3>
          <div className={styles.searchBox}>
            <input
              type="text"
              placeholder="Buscar por nombre, correo, rol, tipo o área..."
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              className={styles.searchInput}
            />
            {busqueda && (
              <button onClick={() => setBusqueda('')} className={styles.clearBtn}>
                ✖
              </button>
            )}
          </div>
        </div>

        <div className={styles.tableWrapper}>
          <DataTable
            columns={columnas}
            data={usuariosVista}
            pagination
            highlightOnHover
            responsive
            striped
            noDataComponent="No hay usuarios registrados."
            customStyles={{
              headRow: {
                style: {
                  backgroundColor: '#f8fafc',
                  borderBottom: '2px solid #e5e7eb',
                  fontWeight: '700',
                  fontSize: '13px',
                  color: '#475569',
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                },
              },
              rows: {
                style: {
                  fontSize: '14px',
                  color: '#1e293b',
                  '&:hover': {
                    backgroundColor: '#f1f5f9',
                  },
                },
              },
            }}
          />
        </div>
      </div>

      {mostrarModal && (
        <div className={styles.modalOverlay}>
          <div className={styles.userModal}>
            <div className={styles.modalTopbar}>
              <div>
                <div className={styles.modalEyebrow}>{editando ? 'Edición avanzada' : 'Alta de usuario'}</div>
                <h3 className={styles.modalTitle}>{editando ? 'Editar perfil de usuario' : 'Crear nuevo usuario'}</h3>
                <p className={styles.modalSubtitle}>
                  Completa los datos personales, de acceso y perfil profesional en una sola vista.
                </p>
              </div>
              <button className={styles.modalClose} type="button" onClick={cerrarModal} aria-label="Cerrar formulario">
                ×
              </button>
            </div>

            <div className={styles.modalSummary}>
              <div className={styles.summaryCard}>
                <UserRound size={18} />
                <div>
                  <strong>{formulario.nombre || 'Nuevo'} {formulario.apellido || 'usuario'}</strong>
                  <span>{formulario.email || 'Sin correo definido'}</span>
                </div>
              </div>
              <div className={styles.summaryChip}>{editando ? 'Modo edición' : 'Modo creación'}</div>
              <div className={styles.summaryChip}>{formulario.rol || 'Sin rol'}</div>
              <div className={styles.summaryChip}>{formulario.estado || 'activo'}</div>
            </div>

            <div className={styles.modalGrid}>
              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}><UserRound size={18} /></div>
                  <div>
                    <h4 className={styles.sectionTitle}>Información personal</h4>
                    <p className={styles.sectionText}>Datos básicos para identificar y contactar al usuario.</p>
                  </div>
                </div>

                <div className={styles.fieldsGridTwo}>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Nombre</span>
                    <input name="nombre" value={formulario.nombre} onChange={handleChange} className={styles.fieldInput} placeholder="Ej. Andrea" />
                  </label>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Apellido</span>
                    <input name="apellido" value={formulario.apellido} onChange={handleChange} className={styles.fieldInput} placeholder="Ej. Pérez" />
                  </label>
                </div>

                <div className={styles.fieldsGridTwo}>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Correo electrónico</span>
                    <input type="email" name="email" value={formulario.email} onChange={handleChange} className={styles.fieldInput} placeholder="usuario@correo.com" />
                  </label>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Celular</span>
                    <div className={styles.fieldWithIcon}>
                      <Phone size={16} className={styles.fieldIcon} />
                      <input name="celular" value={formulario.celular} onChange={handleChange} className={styles.fieldInputIcon} placeholder="3001234567" />
                    </div>
                  </label>
                </div>

                <label className={styles.fieldBlock}>
                  <span className={styles.fieldLabel}>Organismo / Área Universitaria</span>
                  <div className={styles.fieldWithIcon}>
                    <Building2 size={16} className={styles.fieldIcon} />
                    <select name="dependencia_id" value={formulario.dependencia_id} onChange={handleChange} className={styles.fieldInputIcon}>
                      <option value="">Seleccione una dependencia</option>
                      {dependencias.map((dep) => (
                        <option key={dep.dependencia_id} value={dep.dependencia_id}>
                          {dep.nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                </label>
              </section>

              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}><ShieldCheck size={18} /></div>
                  <div>
                    <h4 className={styles.sectionTitle}>Acceso al sistema</h4>
                    <p className={styles.sectionText}>Configuración de rol, estado y credenciales del usuario.</p>
                  </div>
                </div>

                <div className={styles.fieldsGridTwo}>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Rol</span>
                    <select name="rol" value={formulario.rol} onChange={handleChange} className={styles.fieldInput}>
                      <option value="">Seleccione un rol</option>
                      {ROLES.map((rol) => (
                        <option key={rol.value} value={rol.value}>{rol.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Estado</span>
                    <select name="estado" value={formulario.estado} onChange={handleChange} className={styles.fieldInput}>
                      {ESTADOS.map((estado) => (
                        <option key={estado.value} value={estado.value}>{estado.label}</option>
                      ))}
                    </select>
                  </label>
                </div>

                <label className={styles.fieldBlock}>
                  <span className={styles.fieldLabel}>Contraseña</span>
                  <div className={styles.passwordWrap}>
                    <input
                      type={mostrarPassword ? 'text' : 'password'}
                      name="password"
                      value={formulario.password}
                      onChange={handleChange}
                      className={styles.fieldInputPassword}
                      autoComplete="new-password"
                      placeholder={editando ? 'Deja la actual o escribe una nueva' : 'Define una contraseña segura'}
                    />
                    <button
                      type="button"
                      onClick={() => setMostrarPassword((v) => !v)}
                      className={styles.passwordToggle}
                      aria-label={mostrarPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                    >
                      {mostrarPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </div>
                  <span className={styles.fieldHelp}>
                    {editando ? 'Puedes conservar la actual o reemplazarla si necesitas actualizar credenciales.' : 'Este campo es obligatorio al crear el usuario.'}
                  </span>
                </label>
              </section>

              <section className={styles.formSection}>
                <div className={styles.sectionHeader}>
                  <div className={styles.sectionIcon}><BriefcaseBusiness size={18} /></div>
                  <div>
                    <h4 className={styles.sectionTitle}>Perfil profesional</h4>
                    <p className={styles.sectionText}>Información complementaria para clasificar mejor a los auditores y usuarios.</p>
                  </div>
                </div>

                <div className={styles.fieldsGridTwo}>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Tipo de personal</span>
                    <select name="tipo_personal" value={formulario.tipo_personal} onChange={handleChange} className={styles.fieldInput}>
                      <option value="">Seleccione un tipo</option>
                      {TIPOS_PERSONAL.map((tipo) => (
                        <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.fieldBlock}>
                    <span className={styles.fieldLabel}>Tipo de estudio</span>
                    <div className={styles.fieldWithIcon}>
                      <GraduationCap size={16} className={styles.fieldIcon} />
                      <select name="tipo_estudio" value={formulario.tipo_estudio} onChange={handleChange} className={styles.fieldInputIcon}>
                        <option value="">Seleccione un nivel</option>
                        {TIPOS_ESTUDIO.map((tipo) => (
                          <option key={tipo.value} value={tipo.value}>{tipo.label}</option>
                        ))}
                      </select>
                    </div>
                  </label>
                </div>

                <label className={styles.fieldBlock}>
                  <span className={styles.fieldLabel}>Estudios</span>
                  <textarea
                    name="estudios"
                    value={formulario.estudios}
                    onChange={handleChange}
                    className={styles.fieldTextarea}
                    rows={4}
                    placeholder="Ej. Contaduría Pública, Especialización en Control Interno, Maestría en Auditoría..."
                  />
                  <span className={styles.fieldHelp}>Puedes registrar programa, énfasis o trayectoria académica relevante.</span>
                </label>
              </section>
            </div>

            <div className={styles.modalActions}>
              <button onClick={cerrarModal} className={styles.secondaryButton} type="button">
                Cancelar
              </button>
              <button onClick={handleSubmit} className={styles.primaryButton} type="button" disabled={guardando}>
                {guardando ? 'Guardando...' : editando ? 'Actualizar usuario' : 'Crear usuario'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={cancelarEliminacion} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-start gap-3">
              <div className="shrink-0 rounded-full bg-red-100 p-2">
                <span className="text-red-600 text-xl">⚠️</span>
              </div>
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-gray-800">Eliminar usuario</h3>
                <p className="text-sm text-gray-600">
                  Vas a eliminar a{' '}
                  <span className="font-medium">
                    {usuarioAEliminar?.nombre} {usuarioAEliminar?.apellido}
                  </span>{' '}
                  ({usuarioAEliminar?.email}). Esta acción no se puede deshacer.
                </p>
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                onClick={cancelarEliminacion}
                className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarEliminacion}
                disabled={eliminandoId === usuarioAEliminar?.usuario_id}
                className={`px-4 py-2 rounded text-white ${eliminandoId === usuarioAEliminar?.usuario_id ? 'bg-red-300 cursor-not-allowed' : 'bg-red-600 hover:bg-red-700'}`}
              >
                {eliminandoId === usuarioAEliminar?.usuario_id ? 'Eliminando…' : 'Eliminar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {credOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-xl w-full max-w-xl space-y-4">
            <h3 className="text-xl font-bold text-gray-800">Enviar credenciales</h3>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Para</label>
                <input
                  type="email"
                  value={credUsuario?.email || ''}
                  readOnly
                  className="w-full border p-2 rounded bg-gray-50"
                />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Asunto</label>
                <input
                  type="text"
                  value={credSubject}
                  onChange={(e) => setCredSubject(e.target.value)}
                  className="w-full border p-2 rounded"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Contraseña a incluir</label>
              <input
                type="text"
                placeholder="Escribe la contraseña (o temporal)"
                value={credPassword}
                onChange={(e) => {
                  const pwd = e.target.value
                  setCredPassword(pwd)
                  const nuevoBody = plantillaCredenciales({
                    nombre: credUsuario?.nombre || '',
                    apellido: credUsuario?.apellido || '',
                    email: credUsuario?.email || '',
                    password: pwd || '*** (edita antes de enviar)',
                  })
                  setCredBody(nuevoBody)
                }}
                className="w-full border p-2 rounded"
              />
              <p className="text-xs text-gray-500 mt-1">
                Nota: si tu API no devuelve la contraseña, puedes definir una temporal y obligar el cambio al primer ingreso.
              </p>
            </div>

            <div>
              <label className="block text-sm text-gray-600 mb-1">Cuerpo</label>
              <textarea
                rows={8}
                value={credBody}
                onChange={(e) => setCredBody(e.target.value)}
                className="w-full border p-2 rounded font-mono"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={cerrarCredenciales} className="px-4 py-2 rounded border border-gray-300 text-gray-700 hover:bg-gray-50">
                Cerrar
              </button>
              <button onClick={copiarCredenciales} className="px-4 py-2 rounded bg-gray-800 text-white hover:bg-gray-900">
                Copiar cuerpo
              </button>
              <button onClick={abrirGmailCompose} className="px-4 py-2 rounded bg-emerald-600 text-white hover:bg-emerald-700">
                Abrir en Gmail
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}