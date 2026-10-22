import { cn } from "cn"

export type CollagePiece = {
  slot: string
  name: string
  image: string
  category: string
}

const paint = ["下装", "半裙", "套装", "连衣裙", "上衣", "外套", "鞋", "配饰"]

const frame: Record<string, string> = {
  下装: "left-[18%] right-[18%] top-[46%] bottom-[12%]",
  半裙: "left-[16%] right-[16%] top-[44%] bottom-[14%]",
  套装: "left-[8%] right-[8%] top-[3%] bottom-[6%]",
  连衣裙: "left-[12%] right-[12%] top-[5%] bottom-[10%]",
  上衣: "left-[16%] right-[16%] top-[7%] h-[44%]",
  外套: "left-[11%] right-[11%] top-[4%] h-[52%]",
  鞋: "left-[30%] right-[30%] bottom-[2%] h-[12%]",
  配饰: "right-[6%] top-[8%] h-[16%] w-[22%]",
}

export function collagePieces(pieces: CollagePiece[]) {
  const slots = new Set(pieces.map((piece) => piece.slot))
  const hidden = new Set<string>()
  if (slots.has("套装")) {
    for (const slot of ["上衣", "外套", "下装", "半裙", "连衣裙"]) {
      hidden.add(slot)
    }
  } else if (slots.has("连衣裙")) {
    for (const slot of ["上衣", "下装", "半裙"]) {
      hidden.add(slot)
    }
  }
  return paint.flatMap((slot) => {
    if (hidden.has(slot)) {
      return []
    }
    const piece = pieces.find((item) => item.slot === slot)
    return piece ? [piece] : []
  })
}

export function Collage({
  pieces,
  empty = "把衣服拖到这里",
  className,
}: {
  pieces: CollagePiece[]
  empty?: string
  className?: string
}) {
  const shown = collagePieces(pieces)
  return (
    <div
      className={cn(
        "relative mx-auto aspect-[3/4] w-full max-w-sm overflow-hidden rounded-[24px] bg-muted",
        className,
      )}
    >
      {shown.length === 0 ? (
        <p className="absolute inset-0 flex items-center justify-center px-6 text-center text-[17px] text-muted-foreground">
          {empty}
        </p>
      ) : (
        shown.map((piece) => (
          <div key={piece.slot} className={cn("absolute", frame[piece.slot])}>
            {piece.image ? (
              <img src={piece.image} alt={piece.name} className="h-full w-full object-contain" />
            ) : (
              <div className="flex h-full items-center justify-center text-[17px]">
                {piece.category}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  )
}
