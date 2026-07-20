import { Link } from "react-router-dom";

export function Privacy() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between py-12 px-6 sm:px-12 md:px-24">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Política de Privacidad
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Última actualización: Julio 20, 2026</p>
        </header>

        <section className="space-y-4 text-zinc-300 leading-relaxed text-sm">
          <p>
            En <strong>Generator AI videos</strong> nos tomamos muy en serio su privacidad. Esta Política de
            Privacidad describe cómo recopilamos, utilizamos y protegemos su información cuando utiliza nuestra plataforma.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">1. Información que Recopilamos</h2>
          <p>
            Para habilitar las funciones de publicación automatizada en TikTok, solicitamos acceso a través del
            flujo oficial de OAuth. Únicamente guardamos los tokens necesarios y datos de perfil público mínimos
            (como su nombre de canal y avatar) requeridos para realizar el servicio solicitado. No recopilamos datos
            personales adicionales de forma encubierta.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">2. Uso de la Información</h2>
          <p>
            Utilizamos la información recopilada exclusivamente para:
          </p>
          <ul className="list-disc pl-5 space-y-1">
            <li>Habilitar la autenticación de su cuenta de TikTok.</li>
            <li>Subir los videos generados directamente a su cuenta de TikTok según lo decida en la interfaz.</li>
            <li>Mostrar los detalles mínimos de la cuenta activa en su panel de administración local.</li>
          </ul>

          <h2 className="text-lg font-bold text-white mt-6">3. Almacenamiento Seguro</h2>
          <p>
            Todos los tokens de sesión de las APIs externas se encriptan y guardan en el archivo de configuración local de la
            plataforma o en almacenamiento privado del backend. Nunca compartiremos estos tokens ni sus datos con terceros bajo ninguna circunstancia.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">4. Revocación de Accesos</h2>
          <p>
            Puede desvincular sus cuentas en cualquier momento desde la sección de Ajustes dentro de esta misma plataforma,
            lo cual eliminará de inmediato todos los tokens de acceso de nuestros servidores. Asimismo, puede revocar la
            autorización en la sección de seguridad de su cuenta de TikTok.
          </p>
        </section>

        <footer className="pt-8 border-t border-zinc-800 flex justify-between items-center text-xs text-zinc-500">
          <span>© 2026 Generator AI videos. Todos los derechos reservados.</span>
          <Link to="/" className="text-cyan-400 hover:underline">
            Volver al Inicio
          </Link>
        </footer>
      </div>
    </div>
  );
}
