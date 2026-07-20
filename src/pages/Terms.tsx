import { Link } from "react-router-dom";

export function Terms() {
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col justify-between py-12 px-6 sm:px-12 md:px-24">
      <div className="max-w-3xl mx-auto space-y-8">
        <header className="border-b border-zinc-800 pb-6">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            Términos de Servicio
          </h1>
          <p className="mt-2 text-sm text-zinc-400">Última actualización: Julio 20, 2026</p>
        </header>

        <section className="space-y-4 text-zinc-300 leading-relaxed text-sm">
          <p>
            Bienvenido a <strong>Generator AI videos</strong> (o "nuestra plataforma"). Al acceder o utilizar
            nuestro servicio, usted acepta cumplir y estar sujeto a estos Términos de Servicio.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">1. Uso de la Plataforma</h2>
          <p>
            Esta aplicación permite a los usuarios automatizar la generación de videos y compartirlos en
            redes sociales autorizadas, como TikTok y YouTube, a través de sus respectivas APIs públicas.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">2. Cuentas e Integraciones de Terceros</h2>
          <p>
            Nuestra aplicación facilita la conexión opcional con servicios de terceros. Usted conserva el
            control absoluto sobre sus credenciales y tokens de acceso. Al vincular su cuenta de TikTok,
            autoriza a la aplicación a interactuar con dicha plataforma únicamente en su nombre y bajo sus
            propias directrices.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">3. Responsabilidad del Contenido</h2>
          <p>
            Usted es el único responsable de los videos generados, cargados o publicados a través de la plataforma.
            Se compromete a no utilizar el servicio para crear ni difundir material ilegal, ofensivo, difamatorio
            o que infrinja los derechos de propiedad intelectual de terceros o las pautas comunitarias de TikTok.
          </p>

          <h2 className="text-lg font-bold text-white mt-6">4. Modificaciones del Servicio</h2>
          <p>
            Nos reservamos el derecho de modificar o suspender, de forma temporal o permanente, el servicio o cualquier
            parte del mismo con o sin previo aviso.
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
