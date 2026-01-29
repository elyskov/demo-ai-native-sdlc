"use client"

import { forwardRef, useEffect, useId, useImperativeHandle, useMemo, useRef, useState } from 'react'

export type MermaidViewerHandle = {
  resetView: () => void
  zoomIn: () => void
  zoomOut: () => void
}

type MermaidViewerProps = {
  code: string
  className?: string
  fallbackClassName?: string
  ariaLabel?: string
}

type SvgPanZoomInstance = {
  destroy: () => void
  resize: () => void
  fit: () => void
  center: () => void
  zoomBy: (scale: number) => void
}

type SvgPanZoomFactory = (svg: SVGElement, options?: Record<string, unknown>) => SvgPanZoomInstance

function getThemeMode(): 'dark' | 'light' {
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light'
}

function cssVarToCommaHsl(cssVarValue: string): string | null {
  // shadcn/tailwind stores values like: "0 0% 96.1%".
  const parts = cssVarValue
    .trim()
    .split(/\s+/)
    .filter(Boolean)

  if (parts.length < 3) return null

  const [h, s, l] = parts
  // Mermaid's color parser is stricter than CSS; use comma-separated hsl().
  return `hsl(${h}, ${s}, ${l})`
}

function readThemeHslVar(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName)
  return cssVarToCommaHsl(raw) ?? fallback
}

export const MermaidViewer = forwardRef<MermaidViewerHandle, MermaidViewerProps>(
  ({ code, className, fallbackClassName, ariaLabel }, ref) => {
    const id = useId()
    const wrapperRef = useRef<HTMLDivElement>(null)
    const svgContainerRef = useRef<HTMLDivElement>(null)
    const panZoomRef = useRef<SvgPanZoomInstance | null>(null)

    const [themeMode, setThemeMode] = useState<'dark' | 'light' | null>(null)
    const [error, setError] = useState<string | null>(null)

    const normalizedCode = useMemo(() => (code ?? '').trim(), [code])

    useImperativeHandle(ref, () => ({
      resetView() {
        if (!panZoomRef.current) return
        panZoomRef.current.resize()
        panZoomRef.current.fit()
        panZoomRef.current.center()
      },
      zoomIn() {
        panZoomRef.current?.zoomBy(1.1)
      },
      zoomOut() {
        panZoomRef.current?.zoomBy(0.9)
      },
    }))

    useEffect(() => {
      setThemeMode(getThemeMode())

      if (typeof MutationObserver === 'undefined') {
        return
      }

      const observer = new MutationObserver(() => {
        setThemeMode(getThemeMode())
      })

      observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
      return () => observer.disconnect()
    }, [])

    useEffect(() => {
      if (!svgContainerRef.current) return

      // Clean up any previous pan-zoom instance/SVG content.
      try {
        panZoomRef.current?.destroy()
      } catch {
        // ignore
      }
      panZoomRef.current = null
      svgContainerRef.current.innerHTML = ''

      setError(null)

      if (!normalizedCode) {
        setError('No diagram content to render.')
        return
      }

      if (themeMode === null) {
        return
      }

      const fallbackBg = themeMode === 'dark' ? 'hsl(0, 0%, 3.9%)' : 'hsl(0, 0%, 100%)'
      const fallbackFg = themeMode === 'dark' ? 'hsl(0, 0%, 98%)' : 'hsl(0, 0%, 3.9%)'
      const themeVariables: Record<string, string> = {
        background: readThemeHslVar('--background', fallbackBg),
        primaryColor: readThemeHslVar('--card', fallbackBg),
        primaryTextColor: readThemeHslVar('--card-foreground', fallbackFg),
        primaryBorderColor: readThemeHslVar('--border', readThemeHslVar('--input', fallbackFg)),
        lineColor: readThemeHslVar('--foreground', fallbackFg),
        secondaryColor: readThemeHslVar('--muted', fallbackBg),
        tertiaryColor: readThemeHslVar('--accent', fallbackBg),
        textColor: readThemeHslVar('--foreground', fallbackFg),
        noteTextColor: readThemeHslVar('--foreground', fallbackFg),
        fontFamily:
          'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji", "Segoe UI Emoji"',
      }

      let cancelled = false

      const render = async () => {
        try {
          const mermaidModule = (await import('mermaid')) as unknown as {
            default: {
              initialize: (config: Record<string, unknown>) => void
              render: (
                id: string,
                text: string,
              ) => Promise<{ svg: string; bindFunctions?: (element: Element) => void }>
            }
          }

          const mermaid = mermaidModule.default

          mermaid.initialize({
            startOnLoad: false,
            securityLevel: 'strict',
            theme: 'base',
            themeVariables,
            // Helps keep shapes readable in dark mode when mermaid chooses defaults.
            darkMode: themeMode === 'dark',
          })

          const renderId = `mermaid-${id.replace(/[:]/g, '')}-${Date.now()}`
          const { svg, bindFunctions } = await mermaid.render(renderId, normalizedCode)

          if (cancelled) return
          if (!svgContainerRef.current) return

          svgContainerRef.current.innerHTML = svg
          bindFunctions?.(svgContainerRef.current)

          const svgEl = svgContainerRef.current.querySelector('svg') as SVGElement | null
          if (!svgEl) {
            setError('Mermaid rendered, but no SVG was produced.')
            return
          }

          // Ensure the SVG is responsive and can be fit/centered.
          // Mermaid sometimes emits inline styles like `max-width: 480px;` which can
          // cause the diagram to only use a fraction of the available width.
          svgEl.style.maxWidth = '100%'
          svgEl.style.width = '100%'
          svgEl.style.height = '100%'
          svgEl.style.display = 'block'

          svgEl.setAttribute('width', '100%')
          svgEl.setAttribute('height', '100%')

          const svgPanZoomModule = (await import('svg-pan-zoom')) as unknown as { default?: SvgPanZoomFactory }
          const svgPanZoom = svgPanZoomModule.default

          if (!svgPanZoom) {
            setError('Failed to load svg-pan-zoom.')
            return
          }

          if (cancelled) return

          panZoomRef.current = svgPanZoom(svgEl, {
            controlIconsEnabled: false,
            panEnabled: false,
            zoomEnabled: true,
            dblClickZoomEnabled: false,
            mouseWheelZoomEnabled: false,
            preventMouseEventsDefault: true,
          })

          // Initial fit-to-view.
          panZoomRef.current.resize()
          panZoomRef.current.fit()
          panZoomRef.current.center()
        } catch (e) {
          const message = e instanceof Error ? e.message : 'Unknown render error'
          setError(message)
        }
      }

      void render()

      const wrapper = wrapperRef.current
      const ro: ResizeObserver | null =
        wrapper && typeof ResizeObserver !== 'undefined'
          ? new ResizeObserver(() => {
              if (!panZoomRef.current) return
              try {
                panZoomRef.current.resize()
              } catch {
                // ignore
              }
            })
          : null

      if (wrapper && ro) {
        ro.observe(wrapper)
      }

      return () => {
        cancelled = true
        ro?.disconnect()
        try {
          panZoomRef.current?.destroy()
        } catch {
          // ignore
        }
        panZoomRef.current = null
      }
    }, [id, normalizedCode, themeMode])

    if (error) {
      return (
        <div ref={wrapperRef} className={fallbackClassName} aria-label={ariaLabel ?? 'Mermaid diagram (fallback)'}>
          <div className="text-sm text-muted-foreground">Couldn’t render diagram: {error}</div>
          <pre className="mt-3 max-h-full overflow-auto whitespace-pre-wrap break-words font-mono text-sm">{code}</pre>
        </div>
      )
    }

    return (
      <div ref={wrapperRef} className={className} aria-label={ariaLabel ?? 'Mermaid diagram'}>
        <div ref={svgContainerRef} className="h-full w-full" />
      </div>
    )
  },
)

MermaidViewer.displayName = 'MermaidViewer'
