// src/app/(dashboard)/ofertas/page.tsx
"use client"

import { useEffect, useMemo, useState } from "react"
import { CvUploadDropzone } from "@/components/cv/cv-upload-dropzone"
import { OfertaCard, type OfertaCardData } from "@/components/ofertas/oferta-card"
import {
  OfertaFiltros,
  type OfertaFiltrosState,
} from "@/components/ofertas/oferta-filtros"

const FILTROS_INICIALES: OfertaFiltrosState = {
  ciudad: null,
  modalidades: [],
  salarioMin: null,
  fechaPublicacion: "cualquiera",
}

export default function OfertasPage() {
  const [ofertas, setOfertas] = useState<OfertaCardData[]>([])
  const [cargando, setCargando] = useState(true)
  const [subiendoCv, setSubiendoCv] = useState(false)
  const [errorCarga, setErrorCarga] = useState<string | null>(null)
  const [filtros, setFiltros] = useState<OfertaFiltrosState>(FILTROS_INICIALES)

  useEffect(() => {
    const controller = new AbortController()

    async function cargarOfertas() {
      setCargando(true)
      setErrorCarga(null)
      try {
        // Incluye filtros como query params derivados de `filtros`.
        const res = await fetch("/api/ofertas", { signal: controller.signal })
        if (!res.ok) throw new Error("No se pudieron cargar las ofertas")
        const data: OfertaCardData[] = await res.json()
        setOfertas(data)
      } catch (err) {
        if ((err as Error).name !== "AbortError") {
          setErrorCarga("No se pudieron cargar las ofertas. Intenta de nuevo.")
        }
      } finally {
        setCargando(false)
      }
    }

    cargarOfertas()
    return () => controller.abort()
  }, [])

  const ciudadesDisponibles = useMemo(() => {
    const set = new Set(
      ofertas.map((o) => o.locationCity).filter((c): c is string => !!c)
    )
    return Array.from(set).sort()
  }, [ofertas])

  const ofertasFiltradas = useMemo(() => {
    return ofertas.filter((o) => {
      if (filtros.ciudad && o.locationCity !== filtros.ciudad) return false
      if (
        filtros.modalidades.length > 0 &&
        o.modality &&
        !filtros.modalidades.includes(o.modality)
      ) {
        return false
      }
      if (filtros.salarioMin && (o.salaryMax ?? o.salaryMin ?? 0) < filtros.salarioMin) {
        return false
      }
      return true
    })
  }, [ofertas, filtros])

  async function handleCvUpload(file: File) {
    setSubiendoCv(true)
    try {
      const formData = new FormData()
      formData.append("file", file)
      const res = await fetch("/api/cv/parse", {
        method: "POST",
        body: formData,
      })
      if (!res.ok) throw new Error("Error al procesar el CV")
      // TODO: refrescar match scores con el nuevo CV parseado
    } catch {
      setErrorCarga("No se pudo procesar el CV. Intenta con otro archivo.")
    } finally {
      setSubiendoCv(false)
    }
  }

  function handleOfertaAplicada(offerId: string) {
    setOfertas((prev) =>
      prev.map((o) => (o.id === offerId ? { ...o, applicationId: "pending" } : o))
    )
  }

  return (
    <div className="flex flex-col gap-6 p-6">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Ofertas para ti
          </h1>
          <p className="text-sm text-muted-foreground">
            {cargando
              ? "Buscando las mejores coincidencias..."
              : `${ofertasFiltradas.length} ofertas encontradas`}
          </p>
        </div>
        <CvUploadDropzone
          onFileSelected={handleCvUpload}
          isUploading={subiendoCv}
          className="lg:w-96"
        />
      </header>

      {errorCarga && (
        <p className="rounded-2xl bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {errorCarga}
        </p>
      )}

      <div className="flex flex-col gap-6 lg:flex-row">
        <OfertaFiltros
          ciudades={ciudadesDisponibles}
          value={filtros}
          onChange={setFiltros}
        />

        <div className="grid flex-1 grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {cargando &&
            Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="h-64 animate-pulse rounded-3xl border border-border bg-muted/40"
              />
            ))}

          {!cargando && ofertasFiltradas.length === 0 && (
            <p className="col-span-full py-12 text-center text-sm text-muted-foreground">
              No encontramos ofertas con esos filtros. Prueba ajustándolos.
            </p>
          )}

          {!cargando &&
            ofertasFiltradas.map((oferta) => (
              <OfertaCard
                key={oferta.id}
                oferta={oferta}
                onAplicar={handleOfertaAplicada}
              />
            ))}
        </div>
      </div>
    </div>
  )
}
