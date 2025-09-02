import * as React from "react"

import { cn } from "@/lib/utils"

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <div className={cn("md-text-field", className)}>
        <textarea
          className="flex min-h-[80px] w-full bg-transparent border-none outline-none px-4 py-3 text-sm placeholder:text-[rgb(var(--md-sys-color-on-surface-variant))] disabled:cursor-not-allowed disabled:opacity-50 resize-vertical"
          ref={ref}
          {...props}
        />
      </div>
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }