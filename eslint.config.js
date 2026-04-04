import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'

const tailwindClassHelperNames = new Set(['cn', 'clsx'])
const canonicalUtilityMappings = new Map([
  ['w-[296px]', 'w-74'],
  ['w-[110px]', 'w-27.5'],
  ['sm:w-[126px]', 'sm:w-31.5'],
  ['max-w-[1200px]', 'max-w-300'],
  ['rounded-[20px]', 'rounded-panel'],
  ['rounded-[16px]', 'rounded-2xl'],
  ['lg:pl-[var(--shell-sidebar-width)]', 'lg:pl-(--shell-sidebar-width)']
])

function canonicalizeTailwindToken(token) {
  const fixes = []
  let nextToken = token

  const importantSegments = nextToken.split(':')
  const importantUtility = importantSegments.at(-1)

  if (importantUtility && importantUtility.startsWith('!')) {
    const canonicalUtility = `${importantUtility.slice(1)}!`
    const canonicalToken = [...importantSegments.slice(0, -1), canonicalUtility].join(':')

    fixes.push({
      from: nextToken,
      to: canonicalToken
    })

    nextToken = canonicalToken
  }

  const heightSegments = nextToken.split(':')
  const heightUtility = heightSegments.at(-1)
  const heightMatch = heightUtility?.match(/^(h|min-h|max-h)-\[(\d+(?:\.\d+)?)rem\](!)?$/)

  if (heightMatch) {
    const remValue = Number(heightMatch[2])
    const scaleValue = remValue * 4

    if (Number.isInteger(scaleValue)) {
      const canonicalUtility = `${heightMatch[1]}-${scaleValue}${heightMatch[3] ?? ''}`
      const canonicalToken = [...heightSegments.slice(0, -1), canonicalUtility].join(':')

      fixes.push({
        from: nextToken,
        to: canonicalToken
      })

      nextToken = canonicalToken
    }
  }

  const directUtilityMatch = canonicalUtilityMappings.get(nextToken)

  if (directUtilityMatch) {
    fixes.push({
      from: nextToken,
      to: directUtilityMatch
    })

    nextToken = directUtilityMatch
  }

  return {
    token: nextToken,
    fixes
  }
}

function canonicalizeTailwindClassValue(value) {
  const fixes = []
  const nextValue = value
    .split(/(\s+)/)
    .map((part) => {
      if (part.trim().length === 0) {
        return part
      }

      const result = canonicalizeTailwindToken(part)
      fixes.push(...result.fixes)
      return result.token
    })
    .join('')

  return {
    value: nextValue,
    fixes
  }
}

function escapeForQuote(value, quote) {
  return value.replaceAll('\\', '\\\\').replaceAll(quote, `\\${quote}`)
}

const canonicalTailwindPlugin = {
  rules: {
    'canonical-utility-syntax': {
      meta: {
        type: 'suggestion',
        fixable: 'code',
        docs: {
          description: 'enforce canonical Tailwind utility syntax for important modifiers and height scale utilities'
        },
        schema: []
      },
      create(context) {
        const sourceCode = context.sourceCode

        function reportIfNeeded(node, value) {
          const result = canonicalizeTailwindClassValue(value)

          if (result.value === value || result.fixes.length === 0) {
            return
          }

          const suggestions = result.fixes
            .map((fix) => `\`${fix.from}\` -> \`${fix.to}\``)
            .join(', ')

          context.report({
            node,
            message: `Use canonical Tailwind utility syntax: ${suggestions}.`,
            fix(fixer) {
              if (node.type === 'Literal') {
                const raw = sourceCode.getText(node)
                const quote = raw.startsWith("'") ? "'" : '"'
                return fixer.replaceText(node, `${quote}${escapeForQuote(result.value, quote)}${quote}`)
              }

              if (node.type === 'TemplateLiteral' && node.expressions.length === 0) {
                return fixer.replaceText(node, `\`${result.value.replaceAll('\\', '\\\\').replaceAll('`', '\\`')}\``)
              }

              return null
            }
          })
        }

        function inspectExpression(node) {
          if (!node) {
            return
          }

          switch (node.type) {
            case 'Literal':
              if (typeof node.value === 'string') {
                reportIfNeeded(node, node.value)
              }
              break
            case 'TemplateLiteral':
              if (node.expressions.length === 0) {
                reportIfNeeded(node, node.quasis[0]?.value.cooked ?? '')
              }
              break
            case 'ArrayExpression':
              node.elements.forEach((element) => {
                if (element) {
                  inspectExpression(element)
                }
              })
              break
            case 'ConditionalExpression':
              inspectExpression(node.consequent)
              inspectExpression(node.alternate)
              break
            case 'LogicalExpression':
              inspectExpression(node.left)
              inspectExpression(node.right)
              break
            case 'CallExpression':
              if (node.callee.type === 'Identifier' && tailwindClassHelperNames.has(node.callee.name)) {
                node.arguments.forEach((argument) => inspectExpression(argument))
              }
              break
            case 'TSAsExpression':
            case 'TSSatisfiesExpression':
              inspectExpression(node.expression)
              break
            case 'ParenthesizedExpression':
              inspectExpression(node.expression)
              break
            default:
              break
          }
        }

        function isClassNameLike(name) {
          return /ClassName$/.test(name)
        }

        return {
          JSXAttribute(node) {
            if (node.name.type !== 'JSXIdentifier' || node.name.name !== 'className' || !node.value) {
              return
            }

            if (node.value.type === 'Literal' && typeof node.value.value === 'string') {
              reportIfNeeded(node.value, node.value.value)
              return
            }

            if (node.value.type === 'JSXExpressionContainer' && node.value.expression.type !== 'CallExpression') {
              inspectExpression(node.value.expression)
            }
          },
          CallExpression(node) {
            if (node.callee.type === 'Identifier' && tailwindClassHelperNames.has(node.callee.name)) {
              node.arguments.forEach((argument) => inspectExpression(argument))
            }
          },
          VariableDeclarator(node) {
            if (node.id.type === 'Identifier' && isClassNameLike(node.id.name) && node.init) {
              inspectExpression(node.init)
            }
          },
          Property(node) {
            const propertyName =
              node.key.type === 'Identifier'
                ? node.key.name
                : typeof node.key.value === 'string'
                  ? node.key.value
                  : null

            if (propertyName && isClassNameLike(propertyName)) {
              inspectExpression(node.value)
            }
          }
        }
      }
    }
  }
}

export default tseslint.config(
  {
    ignores: ['dist', 'coverage', 'node_modules', 'supabase/functions']
  },
  js.configs.recommended,
  {
    files: ['public/sw.js'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        ...globals.serviceworker
      }
    }
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node
      }
    }
  },
  {
    files: ['**/*.{ts,tsx}'],
    extends: tseslint.configs.recommendedTypeChecked,
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.serviceworker
      },
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    plugins: {
      canonicalTailwind: canonicalTailwindPlugin,
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'canonicalTailwind/canonical-utility-syntax': 'error',
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }]
    }
  }
)
