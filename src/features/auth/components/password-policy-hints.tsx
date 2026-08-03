import { Check } from 'lucide-react'

import { passwordPolicyRules } from '@/features/auth/lib/auth-schemas'

// Un solo checklist para registro y restablecimiento. Vivía duplicado en la
// página de registro, donde además era decorativo: mostraba reglas que el
// esquema no exigía. Ahora se dibuja desde `passwordPolicyRules`, que es la
// misma fuente que valida `passwordSchema`, así que lo que se ve y lo que se
// exige no pueden separarse.
export function PasswordPolicyHints({ value }: { value: string }) {
  return (
    <ul className="flex flex-wrap gap-x-2 gap-y-1 pt-0.5">
      {passwordPolicyRules.map((rule) => {
        const passed = rule.test(value)

        return (
          <li
            key={rule.short}
            className={
              passed
                ? 'inline-flex items-center gap-1 rounded-pill bg-emerald-50 px-1.5 py-0.5 text-[11px] leading-4 font-medium text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'inline-flex items-center gap-1 rounded-pill bg-(--app-surface-elevated) px-1.5 py-0.5 text-[11px] leading-4 text-(--app-text-subtle)'
            }
          >
            <Check
              className={passed ? 'size-3 text-emerald-600 dark:text-emerald-400' : 'size-3 text-(--app-text-subtle)/60'}
              strokeWidth={3}
            />
            {rule.short}
          </li>
        )
      })}
    </ul>
  )
}
