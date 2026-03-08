export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left' | 'auto'

export interface TooltipOptions {
  content: string | Node
  position?: TooltipPosition
  delay?: number
  offset?: number
  disabled?: boolean
  showWhen?: () => boolean
}

export type TooltipInput = string | TooltipOptions
