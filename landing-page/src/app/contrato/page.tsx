import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Contrato de Adhesión para Negocios | Rabbitty',
  description:
    'Términos y condiciones de afiliación de negocios a Rabbitty: recompensas Bunz, POS, paquetes, obligaciones, responsabilidad y firma electrónica.',
};

const VERSION = '2026-11-04';

const SECTIONS: Array<{ title: string; paragraphs: string[]; bullets?: string[] }> = [
  {
    title: 'Partes y aceptación',
    paragraphs: [
      'Este Contrato de Adhesión (el “Contrato”) se celebra entre Rabbitty Inc. y sus entidades operativas en México (“Rabbitty”) y la persona física o moral que registra un negocio en la plataforma (el “Afiliado”).',
      'La aceptación se realiza electrónicamente al completar el alta, marcar la casilla correspondiente y firmar con el nombre completo del representante legal. El registro de fecha, hora, versión del Contrato, firma y datos de conexión constituye evidencia del consentimiento.',
      'El Afiliado declara tener capacidad legal y contar con facultades suficientes para obligar a su negocio. Si actúa en representación de una persona moral, declara ser su representante legal autorizado.',
    ],
  },
  {
    title: 'Objeto',
    paragraphs: [
      'Rabbitty pone a disposición del Afiliado herramientas de punto de venta, administración, lealtad y cobro, así como la posibilidad de emitir recompensas denominadas “Bunz” a sus clientes dentro de la red Rabbitty.',
      'El Afiliado podrá operar el POS, administrar menú o catálogo, personal, sucursales y reportes, y participar en campañas y programas de la red, sujeto a las reglas del programa vigentes.',
    ],
  },
  {
    title: 'Naturaleza de los Bunz',
    paragraphs: [
      'Los Bunz son unidades promocionales de lealtad. No son dinero de curso legal, divisas, valores, instrumentos financieros, depósitos, inversiones ni activos virtuales con expectativa de rendimiento.',
      'Los Bunz no son convertibles a efectivo, no generan intereses ni rendimientos y solo pueden canjearse en los comercios y bajo las condiciones del programa. Su valor y reglas pueden cambiar con aviso al Afiliado y a los usuarios.',
      'El Afiliado no podrá presentar los Bunz como dinero, inversión, ahorro garantizado o mecanismo de captación. Queda prohibido simular transacciones, crear cuentas falsas o manipular el programa.',
    ],
  },
  {
    title: 'Obligaciones del Afiliado',
    paragraphs: [
      'El Afiliado es el único responsable de su operación, productos, servicios, precios, calidad, garantías, atención al cliente y del cumplimiento de las leyes que le resulten aplicables.',
    ],
    bullets: [
      'Proporcionar información veraz, completa y actualizada de su negocio, sucursales, representantes y datos de contacto.',
      'Cumplir obligaciones fiscales, laborales, sanitarias, de protección al consumidor y de propiedad intelectual.',
      'Honrar las recompensas, promociones y precios ofrecidos a los clientes, sin discriminación ni cargos ocultos.',
      'No realizar transacciones simuladas, duplicadas o fraudulentas, ni usar el POS o los Bunz para fines distintos al programa de lealtad.',
      'Resguardar sus credenciales, PIN y accesos, y notificar de inmediato cualquier uso no autorizado.',
      'Atender reclamaciones de clientes relacionadas con sus productos o servicios.',
    ],
  },
  {
    title: 'Obligaciones de Rabbitty',
    paragraphs: [
      'Rabbitty prestará la plataforma y el soporte con esfuerzo razonable, mantendrá medidas de seguridad y privacidad, y notificará cambios relevantes del servicio o del programa.',
      'Rabbitty no garantiza disponibilidad ininterrumpida ni ausencia de errores. Podrá realizar mantenimientos, actualizaciones o suspensiones temporales por seguridad, cumplimiento o causas técnicas.',
    ],
  },
  {
    title: 'Paquetes, crédito y pagos',
    paragraphs: [
      'Los paquetes de crédito y las condiciones comerciales se muestran en el alta y en el panel del Afiliado. El crédito respalda la emisión de Bunz y está sujeto a límites, reglas de riesgo y verificación.',
      'Los pagos por paquetes, membresías o servicios se realizan por los medios habilitados. Salvo que la ley disponga lo contrario, los pagos no son reembolsables. Los impuestos son responsabilidad del Afiliado.',
      'Rabbitty podrá ajustar límites, suspender emisiones o solicitar información adicional para prevenir fraude o cumplir obligaciones regulatorias.',
    ],
  },
  {
    title: 'Recompensas y relación con los clientes',
    paragraphs: [
      'El Afiliado define el porcentaje de recompensa dentro de los rangos permitidos por la plataforma; el mínimo vigente es 10%. Las recompensas se aplican conforme a las reglas mostradas al cliente y al Afiliado.',
      'La relación comercial, la entrega de productos o servicios y cualquier reclamación del consumidor son responsabilidad exclusiva del Afiliado. Rabbitty no es proveedor, fabricante, distribuidor ni garante de esos productos o servicios.',
      'Los clientes conservan sus derechos como consumidores conforme a la legislación mexicana. Nada en este Contrato limita esos derechos.',
    ],
  },
  {
    title: 'Datos personales y confidencialidad',
    paragraphs: [
      'El tratamiento de datos personales se rige por el Aviso de Privacidad de Rabbitty. El Afiliado debe contar con las bases legales para los datos de sus clientes y colaboradores que capture en la plataforma.',
      'Cada parte protegerá la información confidencial de la otra y solo la usará para operar el programa. Esta obligación sobrevive a la terminación del Contrato.',
    ],
  },
  {
    title: 'Propiedad intelectual',
    paragraphs: [
      'Las marcas, software, diseños, contenidos y materiales de Rabbitty son propiedad de Rabbitty o de sus licenciantes. El Afiliado recibe una licencia limitada, revocable y no exclusiva para usar la plataforma y los materiales del programa.',
      'El Afiliado no podrá registrar, copiar, modificar, sublicenciar ni explotar la propiedad intelectual de Rabbitty sin autorización escrita. El Afiliado conserva la titularidad de su marca y contenidos, y otorga a Rabbitty una licencia para mostrarlos en la plataforma.',
    ],
  },
  {
    title: 'Limitación de responsabilidad e indemnización',
    paragraphs: [
      'En la máxima medida permitida por la ley, Rabbitty no será responsable por daños indirectos, incidentales, especiales, punitivos o por lucro cesante, pérdida de datos, interrupciones de terceros, fuerza mayor o hechos fuera de su control razonable.',
      'La responsabilidad total de Rabbitty derivada de este Contrato se limita al monto efectivamente pagado por el Afiliado por el paquete o servicio en los tres meses anteriores al evento.',
      'El Afiliado indemnizará y sacará en paz y a salvo a Rabbitty frente a reclamaciones, sanciones, daños y gastos (incluidos honorarios legales razonables) derivados de su operación, productos, servicios, incumplimiento legal, datos de clientes, fraude o violación de este Contrato.',
    ],
  },
  {
    title: 'Vigencia, suspensión y terminación',
    paragraphs: [
      'El Contrato entra en vigor al aceptarse y permanece vigente mientras el Afiliado opere en la red, salvo terminación.',
      'Rabbitty podrá suspender o terminar el acceso de forma inmediata ante fraude, riesgo, incumplimiento grave, requerimiento legal o conducta que afecte a la red o a los usuarios. El Afiliado podrá solicitar la baja cuando lo desee.',
      'Al terminar, se liquidarán las cantidades pendientes y se desactivarán los accesos. Las obligaciones de confidencialidad, propiedad intelectual, indemnización y las que por su naturaleza deban sobrevivir, continuarán vigentes.',
    ],
  },
  {
    title: 'Modificaciones y notificaciones',
    paragraphs: [
      'Rabbitty podrá actualizar este Contrato por cambios legales, operativos o de producto. La versión vigente y su fecha se publicarán en este sitio y se notificarán por los medios de contacto registrados.',
      'Las notificaciones se entenderán recibidas en el correo o teléfono registrados por el Afiliado. Es responsabilidad del Afiliado mantenerlos actualizados.',
    ],
  },
  {
    title: 'Ley aplicable y jurisdicción',
    paragraphs: [
      'Este Contrato se rige por las leyes de los Estados Unidos Mexicanos. Para controversias, las partes se someten a los tribunales competentes de Guadalajara, Jalisco, renunciando a cualquier otro fuero que pudiera corresponderles, sin perjuicio de los derechos irrenunciables del consumidor.',
      'Contacto legal y de privacidad: legal@rabbitty.me · privacidad@rabbitty.me.',
    ],
  },
];

export default function ContratoPage() {
  return (
    <div className="min-h-screen bg-[#07070F] text-white">
      <header className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
        <div className="mx-auto flex h-20 max-w-4xl items-center justify-between px-6">
          <Link href="/" className="text-sm font-bold text-white/60 hover:text-white">
            ← Volver al inicio
          </Link>
          <div className="flex items-center gap-2.5">
            <span className="text-sm font-black tracking-tight">RABBITTY</span>
            <span className="rounded-full border border-pink-500/30 bg-pink-500/15 px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider text-pink-300">
              Legal México
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-6 py-12">
        <p className="m-0 text-[10px] font-black uppercase tracking-[0.25em] text-pink-400">
          Negocios afiliados
        </p>
        <h1 className="m-0 mt-2 text-3xl font-black tracking-tight sm:text-4xl">
          Contrato de Adhesión
        </h1>
        <p className="m-0 mt-2 text-sm text-white/50">
          Versión {VERSION} · Vigente desde el {VERSION}
        </p>

        <div className="mt-10 space-y-8">
          {SECTIONS.map((section, index) => (
            <section key={section.title} className="border-t border-white/10 pt-6">
              <div className="mb-3 flex items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-[11px] font-black text-pink-400">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <h2 className="m-0 text-xl font-black tracking-tight">{section.title}</h2>
              </div>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph.slice(0, 32)} className="mt-3 text-[14px] leading-[1.8] text-white/65">
                  {paragraph}
                </p>
              ))}
              {section.bullets && (
                <ul className="mt-3 list-disc space-y-2 pl-5 text-[13.5px] leading-relaxed text-white/60">
                  {section.bullets.map((bullet) => (
                    <li key={bullet}>{bullet}</li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        <div className="mt-12 rounded-3xl border border-pink-500/30 bg-pink-500/[0.08] p-6">
          <p className="m-0 text-sm font-black text-white">Aceptación electrónica</p>
          <p className="m-0 mt-2 text-[13px] leading-relaxed text-white/65">
            Al enviar tu alta declaras que leíste y aceptas este Contrato, el Aviso de Privacidad y
            la Política de Bunz. La firma con tu nombre completo, la fecha, la versión del Contrato
            y los datos de conexión quedan registrados como evidencia de tu consentimiento.
          </p>
          <Link
            href="/negocios"
            className="mt-4 inline-flex rounded-2xl bg-pink-500 px-5 py-3 text-sm font-black text-white hover:bg-pink-400"
          >
            Volver al alta de negocio
          </Link>
        </div>
      </main>
    </div>
  );
}
