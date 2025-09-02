import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          // Material 3 text area styling
          "flex min-h-[120px] w-full rounded-xl border-2 border-input bg-background px-4 py-3 text-base",
          "ring-offset-background placeholder:text-muted-foreground",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20",
          "disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-muted",
          // Material 3 transition effects
          "transition-all duration-200 ease-out",
          // Material 3 elevation
          "shadow-sm focus-visible:shadow-md",
          // Resize behavior
          "resize-vertical",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }