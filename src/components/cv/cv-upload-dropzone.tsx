// src/components/cv/cv-upload-dropzone.tsx
"use client"

import { useCallback, useRef, useState } from "react"
import { UploadCloud, FileText, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

const ALLOWED_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
]

interface CvUploadDropzoneProps {
  onFileSelected: (file: File) => void | Promise<void>
  isUploading?: boolean
  className?: string
}

export function CvUploadDropzone({
  onFileSelected,
  isUploading = false,
  className,
}: CvUploadDropzoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFile = useCallback(
    (file: File | undefined) => {
      if (!file) return
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError("Sube un archivo PDF o DOCX.")
        return
      }
      if (file.size > 8 * 1024 * 1024) {
        setError("El archivo supera el límite de 8MB.")
        return
      }
      setError(null)
      void onFileSelected(file)
    },
    [onFileSelected]
  )

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <div
        onClick={() => !isUploading && inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFile(e.dataTransfer.files?.[0])
        }}
        role="button"
        tabIndex={0}
        aria-label="Subir CV en PDF o DOCX"
        className={cn(
          "flex cursor-pointer items-center gap-3 rounded-3xl border border-dashed px-4 py-3 text-sm transition-colors",
          isDragging
            ? "border-ring bg-ring/10"
            : "border-border bg-background hover:bg-muted",
          isUploading && "pointer-events-none opacity-70"
        )}
      >
        {isUploading ? (
          <Loader2 className="size-5 shrink-0 animate-spin text-muted-foreground" />
        ) : (
          <UploadCloud className="size-5 shrink-0 text-muted-foreground" />
        )}
        <div className="min-w-0">
          <p className="truncate font-medium text-foreground">
            {isUploading
              ? "Analizando tu CV..."
              : "Arrastra tu CV o haz clic para subirlo"}
          </p>
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <FileText className="size-3" />
            PDF o DOCX, máx. 8MB
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.docx"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
