import { Metadata } from 'next';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, ShieldCheck, Lock, AlertCircle, Sparkles, Scale } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Aviso de Privacidad y Términos de Servicio | Rabbitty México 2026',
  description: 'Términos y Condiciones, Aviso de Privacidad y Política de Tratamiento de Datos Personales de Rabbitty conforme a la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP) en México.',
};

export default function PrivacyPage() {
  const lastUpdated = '18 de Octubre de 2026';

  return (
    <div className="min-h-screen bg-[#07070F] text-white selection:bg-[#E91E63] selection:text-white">
      {/* Background Glows */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-[#E91E63]/10 rounded-full blur-[140px] pointer-events-none" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-[#9C27B0]/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <header className="z-10 border-b border-white/10 backdrop-blur-xl bg-black/40 sticky top-0">
        <div className="max-w-5xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="inline-flex items-center gap-2 text-white/60 hover:text-white transition-colors text-sm font-semibold">
            <ArrowLeft size={18} />
            <span>Volver al inicio</span>
          </Link>
          <div className="flex items-center gap-2.5">
            <Image src="/icon_ra.png" alt="Rabbitty" width={28} height={28} className="object-contain" />
            <span className="font-black tracking-tight text-white">Rabbitty</span>
            <span className="text-[11px] font-black uppercase tracking-wider bg-[#E91E63]/20 text-[#E91E63] px-2.5 py-0.5 rounded-full border border-[#E91E63]/30">
              Legal México 2026
            </span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="relative z-10 max-w-4xl mx-auto px-6 py-14">
        {/* Title Section */}
        <div className="mb-12">
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-semibold text-white/70 mb-4">
            <ShieldCheck size={14} className="text-[#E91E63]" />
            Apego a LFPDPPP y Regulaciones de Consumo PROFECO (México 2026)
          </div>
          <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-4 text-white">
            Aviso de Privacidad Integral y Términos de Servicio
          </h1>
          <p className="text-white/60 text-base leading-relaxed">
            Última actualización y entrada en vigor: <strong className="text-white">{lastUpdated}</strong>.
            En Rabbitty garantizamos la transparencia, seguridad y confidencialidad de tus datos, protegiendo tanto a nuestros usuarios («Rabbitters») como a nuestros negocios locales afiliados.
          </p>
        </div>

        {/* Quick Summary Pill Box */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-14">
          <div className="p-5 rounded-2xl bg-white/3 border border-white/10 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-[#E91E63]/15 flex items-center justify-center text-[#E91E63] mb-1">
              <Lock size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Tus Datos Son Tuyos</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              No comercializamos ni vendemos información personal a intermediarios o brokers de datos.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/3 border border-white/10 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-purple-500/15 flex items-center justify-center text-purple-400 mb-1">
              <Sparkles size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Bunz = Recompensas</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Los Bunz son unidades de lealtad y puntos promocionales no canjeables por dinero en efectivo de curso legal.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-white/3 border border-white/10 flex flex-col gap-2">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center text-emerald-400 mb-1">
              <Scale size={20} />
            </div>
            <h3 className="font-bold text-sm text-white">Derechos ARCO</h3>
            <p className="text-xs text-white/50 leading-relaxed">
              Acceso, Rectificación, Cancelación y Oposición garantizados con respuesta en menos de 72 horas hábiles.
            </p>
          </div>
        </div>

        {/* Legal Body Sections */}
        <div className="space-y-12 text-white/80 text-[15px] leading-[1.8]">

          {/* Section 1 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                01
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Identidad y Domicilio del Responsable</h2>
            </div>
            <p>
              El presente documento establece las condiciones de uso y la política de privacidad de la plataforma <strong>Rabbitty</strong> (operada en territorio mexicano por Rabbitty Technologies y sus entidades vinculadas, en adelante «Rabbitty», «nosotros» o «la Plataforma»).
            </p>
            <p className="mt-3">
              Rabbitty es el sujeto responsable del tratamiento y resguardo de los datos personales recabados a través de nuestro sitio web oficial (<code>rabbitty.me</code>), aplicaciones móviles nativas para iOS y Android, y la integración de Telegram Mini App.
            </p>
            <p className="mt-3">
              <strong>Canal de Atención Oficial y Oficial de Privacidad:</strong> Correo electrónico:{' '}
              <a href="mailto:privacidad@rabbitty.me" className="text-[#E91E63] font-semibold underline underline-offset-4 hover:text-[#ff3d7f]">
                privacidad@rabbitty.me
              </a> / <a href="mailto:legal@rabbitty.me" className="text-[#E91E63] font-semibold underline underline-offset-4 hover:text-[#ff3d7f]">
                legal@rabbitty.me
              </a>.
            </p>
          </section>

          {/* Section 2 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                02
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Datos Personales Recabados</h2>
            </div>
            <p>
              En cumplimiento del principio de proporcionalidad y minimización establecido en la <em>Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP)</em> y su Reglamento, recabamos únicamente los datos necesarios para brindar la experiencia de recompensas y geolocalización:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-white/70">
              <li>
                <strong className="text-white">Identificación y Perfil:</strong> Nombre de usuario, identificador de Telegram (Telegram User ID / Chat ID en caso de utilizar este canal), dirección de correo electrónico y foto de perfil si el usuario la suministra voluntariamente.
              </li>
              <li>
                <strong className="text-white">Datos de Operación y Transaccionalidad:</strong> Historial de visitas a cafeterías y comercios afiliados, registros de escaneo de códigos QR, folios de tickets procesados, saldo y movimientos de puntos «Bunz», niveles en el programa de gamificación y códigos de referidos.
              </li>
              <li>
                <strong className="text-white">Datos de Geolocalización:</strong> Coordenadas aproximadas o precisas de tu dispositivo (únicamente mientras la aplicación está en uso y previa autorización expresa) para mostrarte los comercios afiliados y Happy Hours cercanos.
              </li>
              <li>
                <strong className="text-white">Acceso a Cámara:</strong> Uso del sensor de cámara estrictamente para el escaneo de códigos QR en mostrador o tickets de compra. <em>Rabbitty no almacena imágenes de la galería personal de los usuarios sin su acción directa.</em>
              </li>
              <li>
                <strong className="text-white">Datos de Negocios Afiliados:</strong> Nombre comercial, Razón Social, RFC (en caso de facturación de paquetes promocionales), dirección física de la sucursal, horarios de atención, menús y datos de contacto del responsable operativo.
              </li>
            </ul>
          </section>

          {/* Section 3 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                03
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Finalidades del Tratamiento de Datos</h2>
            </div>
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-white/2 border border-white/5">
                <h4 className="font-bold text-white mb-1">Finalidades Primarias (Indispensables):</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-white/70">
                  <li>Creación, autenticación y administración de la cuenta del usuario o comercio.</li>
                  <li>Acreditación y débito de puntos promocionales «Bunz» por consumos válidos.</li>
                  <li>Prevención de fraudes, escaneos duplicados o manipulación de tickets comerciales.</li>
                  <li>Validación de límites de crédito y balance de promociones entre comercios y clientes.</li>
                  <li>Atención a solicitudes de soporte, incidencias y reclamos técnicos.</li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-white/2 border border-white/5">
                <h4 className="font-bold text-white mb-1">Finalidades Secundarias (Opcionales):</h4>
                <ul className="list-disc pl-5 space-y-1 text-sm text-white/70">
                  <li>Envío de notificaciones de promociones, Happy Hours y nuevas cafeterías afiliadas.</li>
                  <li>Métricas de telemetría agregadas y anónimas para evaluar el impacto de zonas comerciales.</li>
                </ul>
                <p className="text-xs text-white/50 mt-2">
                  Puedes revocar en cualquier momento el consentimiento para finalidades secundarias desactivando las notificaciones en tu dispositivo o escribiéndonos a <span className="text-white">privacidad@rabbitty.me</span>.
                </p>
              </div>
            </div>
          </section>

          {/* Section 4 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                04
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Naturaleza Jurídica de los Puntos «Bunz»</h2>
            </div>
            <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-200/90 text-sm leading-relaxed mb-4">
              <div className="flex items-center gap-2 font-black text-amber-300 mb-1.5 text-base">
                <AlertCircle size={18} />
                Aviso Importante sobre Tokens y Puntos de Fidelidad
              </div>
              Los puntos «Bunz» son unidades promocionales y de fidelización interna emitidas exclusivamente para incentivar el consumo en la red de comercios asociados a Rabbitty. 
            </div>
            <ul className="list-disc pl-6 space-y-2 text-white/70">
              <li>
                <strong>No constituyen moneda de curso legal:</strong> Los Bunz no son dinero fiat, divisas extranjeras, valores bursátiles ni activos de captación financiera bancaria protegidos por el IPAB ni la CNBV.
              </li>
              <li>
                <strong>No convertibles a efectivo:</strong> No podrán ser canjeados directamente por dinero en efectivo de curso legal ante Rabbitty ni ante los negocios afiliados, salvo en promociones o descuentos en productos definidos por cada comercio.
              </li>
              <li>
                <strong>Vigencia y Reglas de Caducidad:</strong> Los Bunz acreditados no expiran mientras la cuenta permanezca activa. Cuentas inactivas por más de 12 meses consecutivos podrán ser sujetas a depuración previa notificación de 30 días naturales.
              </li>
            </ul>
          </section>

          {/* Section 5 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                05
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Ejercicio de Derechos ARCO</h2>
            </div>
            <p>
              Usted tiene el derecho inalienable de <strong>Acceder</strong> a sus datos personales en nuestro poder; <strong>Rectificarlos</strong> en caso de ser inexactos o incompletos; <strong>Cancelarlos</strong> cuando considere que no se requieren para las finalidades señaladas; u <strong>Oponerse</strong> al tratamiento de los mismos para fines específicos (Derechos ARCO).
            </p>
            <p className="mt-3">
              Para ejercer cualquiera de sus derechos ARCO o solicitar la eliminación total de su cuenta y registros:
            </p>
            <div className="mt-3 p-4 rounded-xl bg-white/4 border border-white/10 text-sm">
              <p className="font-semibold text-white mb-2">Procedimiento de Solicitud:</p>
              <ol className="list-decimal pl-5 space-y-1 text-white/70">
                <li>Envíe un correo a <strong className="text-white">privacidad@rabbitty.me</strong> con el asunto «Solicitud ARCO - [Su Nombre o Usuario]».</li>
                <li>Adjunte una copia digital de su identificación oficial para validar titularidad.</li>
                <li>Describa puntualmente los datos sobre los que desea ejercer el derecho (ej. eliminación total de cuenta).</li>
                <li>Rabbitty dará respuesta en un plazo no mayor a <strong>72 horas hábiles</strong> y ejecutará la resolución en los plazos previstos por la Ley mexicana.</li>
              </ol>
            </div>
          </section>

          {/* Section 6 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                06
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Reglas de Conducta y Prevención de Abusos</h2>
            </div>
            <p>
              Para mantener la equidad entre comercios locales y usuarios, queda estrictamente prohibido:
            </p>
            <ul className="list-disc pl-6 mt-3 space-y-2 text-white/70">
              <li>Escanear tickets de consumo ajenos o sustraídos sin haber realizado el consumo real.</li>
              <li>Generar cuentas automatizadas («bots») para la acumulación fraudulenta de puntos de bienvenida o referidos.</li>
              <li>Incurrir en colusión entre dependientes de sucursal y clientes para simular transacciones.</li>
            </ul>
            <p className="mt-3 text-sm text-white/60">
              Rabbitty se reserva el derecho de auditar, congelar preventivamente saldos de Bunz o dar de baja definitiva las cuentas que infrinjan estas directrices de buena fe.
            </p>
          </section>

          {/* Section 7 */}
          <section className="border-t border-white/10 pt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-xs font-black text-[#E91E63]">
                07
              </div>
              <h2 className="text-2xl font-black text-white tracking-tight">Modificaciones al Presente Aviso</h2>
            </div>
            <p>
              Rabbitty se reserva el derecho de efectuar en cualquier momento modificaciones o actualizaciones al presente Aviso de Privacidad y Términos de Servicio, motivadas por reformas legislativas, criterios de autoridades reguladoras (INAI, PROFECO) o mejoras tecnológicas de la Plataforma.
            </p>
            <p className="mt-3">
              Cualquier cambio sustancial será notificado oportunamente mediante banner visible en la aplicación o publicación prioritaria en <code>rabbitty.me/privacy</code> con al menos 5 días de anticipación a su entrada en vigor.
            </p>
          </section>

        </div>

        {/* Bottom Contact Card */}
        <div className="mt-16 p-8 rounded-3xl bg-linear-to-r from-[#E91E63]/15 to-purple-600/15 border border-[#E91E63]/30 flex flex-col md:flex-row items-center justify-between gap-6">
          <div>
            <h3 className="text-xl font-black text-white mb-1">¿Tienes dudas legales o de privacidad?</h3>
            <p className="text-sm text-white/70">
              Nuestro equipo legal y de protección de datos en México está a tu disposición directa.
            </p>
          </div>
          <a
            href="mailto:privacidad@rabbitty.me"
            className="px-6 py-3 rounded-full bg-[#E91E63] hover:bg-[#D81B60] text-white font-bold text-sm transition-transform active:scale-95 shrink-0 shadow-lg shadow-[#E91E63]/30"
          >
            Contactar al Oficial de Privacidad
          </a>
        </div>
      </main>

      {/* Mini Footer */}
      <footer className="border-t border-white/10 py-8 text-center text-xs text-white/40">
        <p>© 2026 Rabbitty Corp. Todos los derechos reservados. Ciudad de México y Guadalajara, México.</p>
      </footer>
    </div>
  );
}
