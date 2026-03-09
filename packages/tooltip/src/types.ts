export type TooltipPosition = 'top' | 'right' | 'bottom' | 'left' | 'auto'

export interface TooltipOptions {
  content: string | Node
  position?: TooltipPosition
  delay?: number
  offset?: number
  disabled?: boolean
  showWhen?: () => boolean
  /** Whether focus/blur events trigger the tooltip (default: true) */
  triggerOnFocus?: boolean
}

export type TooltipInput = string | TooltipOptions
