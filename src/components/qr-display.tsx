"use client"

import { QRCodeSVG } from "qrcode.react"
import { Card, CardContent } from "@/components/ui/card"

interface QrDisplayProps {
  value: string
  size?: number
}

export function QrDisplay({ value, size = 160 }: QrDisplayProps) {
  return (
    <Card className="border-border/50 bg-white">
      <CardContent className="flex items-center justify-center p-4">
        <QRCodeSVG
          value={value}
          size={size}
          level="M"
          bgColor="#ffffff"
          fgColor="#0a0a0a"
        />
      </CardContent>
    </Card>
  )
}
