/** Léeme: cómo poner tu contenido y qué sabe hacer el escritorio. */
export default function Notes() {
  return (
    <div className="px-6 pt-6 pb-8 text-[14px] leading-[1.7]" style={{ color: 'var(--tx-2)' }}>
      <h3 className="serif mb-1 text-[26px]" style={{ color: 'var(--tx)' }}>
        Léeme
      </h3>
      <p className="label mb-6">Cómo hacer tuyo este sitio</p>

      <Block n="01" title="Tus fotos">
        Con el sitio publicado, las fotos se suben desde el panel de administración: de cada original
        —aunque venga a 4K o más— se guardan seis anchos en tres formatos (AVIF, WebP y JPEG) y una
        miniatura diminuta que se ve mientras carga la buena. El navegador se queda con la versión que le
        toca por pantalla, así que una miniatura nunca descarga el original entero. Ahí mismo se editan
        título, sitio y año, y se reordena la galería.
        <br />
        <br />
        Sin backend, el sitio funciona igual con lo que haya en <Code>src/data/content.js</Code>: copia los
        archivos en <Code>public/photos/</Code> y pon <Code>src: '/photos/tu-archivo.jpg'</Code>. Mientras
        no haya <Code>src</Code> se dibuja un marcador generado por código, así que nunca se ve roto.
        <Code>ratio</Code> es alto/ancho: 1 cuadrada, 1.25 vertical, 0.66 apaisada.
      </Block>

      <Block n="02" title="Tus textos">
        Nombre, bio, enlaces, proyectos, pistas y relojes viven en <Code>src/data/content.js</Code>. Si hay
        backend, lo que esté en la base de datos manda y esto queda de red de seguridad. No hace falta
        tocar ningún componente.
      </Block>

      <Block n="03" title="El escritorio">
        <p>
          No hay iconos sueltos en el escritorio: todo se abre desde el dock, con las teclas 1–7 o desde
          el buscador.
        </p>
        <ul className="mt-2 space-y-1.5">
          <Row k="Dock">todas las apps; el punto dice cuál tienes delante</Row>
          <Row k="Botón dcho.">menú del escritorio</Row>
          <Row k="Arrastrar">al borde izquierdo o derecho, media pantalla; arriba, completa</Row>
          <Row k="Bordes">tirar de cualquier lado o esquina para redimensionar</Row>
          <Row k="F">reparte todas las ventanas para elegir una de un vistazo</Row>
        </ul>
        <p className="mt-3">
          Las ventanas recuerdan dónde las dejaste. En móvil, un toque en el fondo manda al gato hacia
          ahí, y en el juego el toque hace de palmada para espantarlos.
        </p>
      </Block>

      <Block n="04" title="Atajos">
        <ul className="mt-2 space-y-1.5">
          <Row k="⌘K  ·  /">buscar fotos, apps, proyectos y acciones</Row>
          <Row k="?">chuleta con todos los atajos</Row>
          <Row k="1 – 7">abrir u ocultar cada app</Row>
          <Row k="⌘W">cerrar la ventana de delante</Row>
          <Row k="← →">moverse entre fotos en el visor</Row>
          <Row k="+ − 0">zoom en el visor</Row>
          <Row k="I">ficha de la foto</Row>
          <Row k="Espacio">pase de diapositivas</Row>
          <Row k="Esc">salir del visor o del buscador</Row>
        </ul>
      </Block>

      <Block n="05" title="La consola">
        Hay un árbol de archivos de verdad, construido a partir de tu contenido, y se recorre como
        cualquier terminal: <Code>ls</Code>, <Code>cd fotos/2025</Code>, <Code>cat cruce-7-40.jpg</Code>
        (dibuja la miniatura), <Code>find gijón</Code>, <Code>abrir</Code>. También{' '}
        <Code>quien</Code>, <Code>tema claro</Code> y <Code>gato off</Code>. Tab completa comandos y
        rutas, la sugerencia en gris se acepta con →, y las flechas recuperan el historial.
      </Block>

      <Block n="06" title="Enlazar algo concreto">
        La dirección refleja lo que tienes delante: <Code>#fotos/5</Code> abre el visor en esa foto y{' '}
        <Code>#consola</Code> abre la consola. Sirve para mandarle a alguien justo lo que quieres que
        vea.
      </Block>

      <Block n="07" title="Publicar">
        En Railway: un servicio desde este repo, Postgres al lado, y las claves de Cloudflare R2 en las
        variables. El <Code>Dockerfile</Code> compila la web y la sirve junto con la API, así que es un
        único servicio. Todo el paso a paso está en el <Code>README</Code>.
        <br />
        <br />
        Sin backend también vale: <Code>npm run build</Code> dentro de <Code>frontend/</Code> genera{' '}
        <Code>dist/</Code> para Vercel, Netlify o GitHub Pages, y con{' '}
        <Code>SINGLE_FILE=1 npm run build</Code> sale un único <Code>index.html</Code> autocontenido.
      </Block>

      <p
        className="mt-8 border-t pt-5 text-[12.5px]"
        style={{ borderColor: 'var(--line)', color: 'var(--tx-3)' }}
      >
        Gestor de ventanas, dock, buscador, consola, reloj, reproductor, juego, galería y firma manuscrita
        son código propio, sin librerías de animación ni de arrastre. El gato es <em>oneko</em>: sprite y
        máquina de estados de oneko.js de adryd (MIT), a su vez port del <em>neko</em> japonés de 1989.
        Puedes esconderlo en <strong>Ver → Guardar el gato</strong>.
      </p>
    </div>
  )
}

function Block({ n, title, children }) {
  return (
    <section className="mb-6 grid grid-cols-[2rem_1fr] gap-x-3">
      <span className="label pt-1">{n}</span>
      <div>
        <h4 className="mb-1 text-[15px] font-medium" style={{ color: 'var(--tx)' }}>
          {title}
        </h4>
        <div className="max-w-[58ch]">{children}</div>
      </div>
    </section>
  )
}

function Code({ children }) {
  return (
    <code
      className="rounded px-1.5 py-0.5 text-[12.5px]"
      style={{ background: 'var(--panel-2)', color: 'var(--accent)', border: '1px solid var(--line)' }}
    >
      {children}
    </code>
  )
}

function Row({ k, children }) {
  return (
    <li className="flex items-start gap-3">
      <kbd
        className="mt-px min-w-[92px] shrink-0 rounded-md px-2 py-1 text-center text-[11px]"
        style={{ background: 'var(--panel-2)', border: '1px solid var(--line-2)', color: 'var(--tx)' }}
      >
        {k}
      </kbd>
      <span className="text-[13.5px]">{children}</span>
    </li>
  )
}
