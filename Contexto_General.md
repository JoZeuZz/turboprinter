# Turboprinter - Contexto General

## Propósito
Aplicación full-stack para la creación automatizada de videos cortos (tipo TikTok/Reels) a partir de guiones o temas dinámicos utilizando inteligencia artificial, síntesis de voz, clips de stock (Pexels) y subtítulos dinámicos quemados con FFmpeg.

## Arquitectura y Tecnologías
- **Frontend**: React (Vite, Tailwind CSS, Lucide Icons, Lucide React).
- **Backend**: Express (Node.js en TypeScript compilado a CJS vía esbuild).
- **Motor de Video**: FFmpeg nativo que realiza la concatenación de clips, mezcla de audio (música de fondo + narración) y quemado de subtítulos mediante filtros ASS complejos (`libass`).
- **Persistencia**: Sistema de base de datos integrado en JSON / almacenamiento local por carpetas (`storage/renders`).