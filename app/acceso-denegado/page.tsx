/**
 * OT-514: Página de acceso denegado
 */

export default function AccesoDenegadoPage() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: 'linear-gradient(135deg, #0F172A 0%, #7f1d1d 100%)' }}>
      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl shadow-2xl p-8 text-center">
          <div className="inline-block bg-red-100 rounded-full p-4 mb-4">
            <svg className="w-16 h-16 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>

          <h1 className="text-2xl font-bold text-gray-900 mb-2">Acceso Denegado</h1>

          <p className="text-gray-600 mb-6">
            Tu categoría de usuario no tiene acceso al catálogo mayorista.
          </p>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6 text-left">
            <p className="text-sm text-gray-700">
              <strong>Acceso permitido solo para:</strong>
            </p>
            <ul className="mt-2 space-y-1 text-sm text-gray-600">
              <li>• Usuarios con categoría <strong>VENDEDOR</strong></li>
              <li>• Usuarios con categoría <strong>ADMIN</strong></li>
            </ul>
          </div>

          <a
            href="/login"
            className="inline-block bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
          >
            Volver al login
          </a>
        </div>
      </div>
    </div>
  )
}
