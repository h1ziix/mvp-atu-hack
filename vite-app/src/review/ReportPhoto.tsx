import { useState } from "react"
import { ArrowUpRight, ImageOff } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { dateLabel } from "./model"

export function ReportPhoto({
  url,
  waste,
  date,
}: {
  url: string
  waste: string
  date: string
}) {
  const [thumbnailFailed, setThumbnailFailed] = useState(false)
  const [previewFailed, setPreviewFailed] = useState(false)
  const label = waste || "Взвешивание"

  return (
    <Dialog onOpenChange={(open) => open && setPreviewFailed(false)}>
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-12 w-16 overflow-hidden bg-muted p-0"
            aria-label={`Открыть фото: ${label}, ${dateLabel(date)}`}
          />
        }
      >
        {thumbnailFailed ? (
          <ImageOff
            className="size-4 text-muted-foreground"
            aria-hidden="true"
          />
        ) : (
          <img
            src={url}
            alt=""
            width={64}
            height={48}
            loading="lazy"
            decoding="async"
            referrerPolicy="no-referrer"
            className="size-full object-cover"
            onError={() => setThumbnailFailed(true)}
          />
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader className="pr-8">
          <DialogTitle className="text-base">Фото взвешивания</DialogTitle>
          <DialogDescription className="wrap-anywhere">
            {label} · {dateLabel(date)}
          </DialogDescription>
        </DialogHeader>
        {previewFailed ? (
          <div
            role="status"
            className="grid min-h-36 place-content-center justify-items-center gap-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground"
          >
            <ImageOff className="size-5" aria-hidden="true" />
            Не удалось загрузить фото.
          </div>
        ) : (
          <img
            src={url}
            alt={`Фото взвешивания: ${label}`}
            referrerPolicy="no-referrer"
            className="mx-auto max-h-[66dvh] w-full rounded-lg bg-muted object-contain"
            onError={() => setPreviewFailed(true)}
          />
        )}
        <DialogFooter>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "outline", size: "lg" })}
          >
            Открыть оригинал <ArrowUpRight aria-hidden="true" />
          </a>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
