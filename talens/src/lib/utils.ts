export function cn(...classes: Array<string | false | null | undefined>) {
    return classes.filter(Boolean).join(' ')
}

// Small helper to safely join class names. Replace with `tailwind-merge` or `clsx` if needed.
