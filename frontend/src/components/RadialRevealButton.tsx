import * as React from 'react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useAnimate, useReducedMotion, type AnimationPlaybackControls, type Transition } from 'framer-motion'

const radiusFromPercent = (width: number, height: number, percent: number) =>
  (Math.min(width, height) / 2) * (Math.max(0, Math.min(100, percent)) / 100)

export type RadialRevealButtonProps = {
  label?: string
  children?: React.ReactNode
  className?: string
  id?: string
  type?: 'button' | 'submit' | 'reset'
  disabled?: boolean
  onClick?: React.MouseEventHandler<HTMLButtonElement>
  ariaLabel?: string
  padding?: string
  rounded?: number
  fill?: string
  textColor?: string
  hoverFill?: string
  hoverTextColor?: string
  addIcon?: boolean
  icon?: string
  iconSide?: 'left' | 'right'
  gap?: number
  borderColor?: string
  transition?: Transition
  style?: React.CSSProperties
}

const DEFAULT_TRANSITION: Transition = {
  type: 'tween',
  ease: 'easeInOut',
  duration: 0.45,
}

const useIsoLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect

export default function RadialRevealButton({
  label,
  children,
  className = '',
  id,
  type = 'button',
  disabled = false,
  onClick,
  ariaLabel,
  padding = '10px 20px',
  rounded = 8,
  fill = 'var(--bg-panel, #0d1716)',
  textColor = 'var(--text-primary, #e7f4ef)',
  hoverFill = 'var(--accent, #21e6c1)',
  hoverTextColor = 'var(--bg-deep, #07100f)',
  addIcon = false,
  icon = '→',
  iconSide = 'left',
  gap = 8,
  borderColor = 'var(--border-strong, #1d7770)',
  transition = DEFAULT_TRANSITION,
  style,
}: RadialRevealButtonProps) {
  const [scope, animate] = useAnimate()
  const overlayRef = useRef<HTMLSpanElement>(null)
  const animationRef = useRef<AnimationPlaybackControls | null>(null)
  const reducedMotion = useReducedMotion()
  const [size, setSize] = useState({ width: 0, height: 0 })
  const clip = useRef({ radius: 0, x: 100, y: 100, max: 160 })
  const content = children ?? label

  useIsoLayoutEffect(() => {
    const element = scope.current as HTMLElement | null
    if (!element) return

    const readSize = () => {
      setSize((current) =>
        current.width === element.offsetWidth && current.height === element.offsetHeight
          ? current
          : { width: element.offsetWidth, height: element.offsetHeight },
      )
    }

    readSize()
    const observer = new ResizeObserver(readSize)
    observer.observe(element)
    return () => observer.disconnect()
  }, [scope])

  const radius = radiusFromPercent(size.width, size.height, rounded)

  const applyClip = () => {
    const overlay = overlayRef.current
    if (!overlay) return
    const { radius: clipRadius, x, y } = clip.current
    const value = `circle(${clipRadius}% at ${x}% ${y}%)`
    overlay.style.clipPath = value
    ;(overlay.style as CSSStyleDeclaration & { webkitClipPath?: string }).webkitClipPath = value
  }

  const anchorToPointer = (event: React.PointerEvent) => {
    const overlay = overlayRef.current
    if (!overlay) return
    const bounds = overlay.getBoundingClientRect()
    if (!bounds.width || !bounds.height) return

    const x = event.clientX - bounds.left
    const y = event.clientY - bounds.top
    const unit = Math.hypot(bounds.width, bounds.height) / Math.SQRT2
    const farthestCorner = Math.max(
      Math.hypot(x, y),
      Math.hypot(bounds.width - x, y),
      Math.hypot(x, bounds.height - y),
      Math.hypot(bounds.width - x, bounds.height - y),
    )

    clip.current.x = (x / bounds.width) * 100
    clip.current.y = (y / bounds.height) * 100
    clip.current.max = (farthestCorner / unit) * 100 + 2
  }

  const growTo = (target: number) => {
    animationRef.current?.stop()
    if (reducedMotion) {
      clip.current.radius = target
      applyClip()
      return
    }

    animationRef.current = animate(clip.current.radius, target, {
      ...(transition as object),
      onUpdate: (value: number) => {
        clip.current.radius = value
        applyClip()
      },
    })
  }

  useIsoLayoutEffect(() => {
    applyClip()
    return () => animationRef.current?.stop()
  }, [])

  const faceStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: addIcon && content ? gap : 0,
    flexDirection: iconSide === 'right' ? 'row-reverse' : 'row',
    padding,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
  }

  const renderContent = () => (
    <>
      {addIcon && <span aria-hidden>{icon}</span>}
      {content}
    </>
  )

  return (
    <button
      ref={scope}
      id={id}
      type={type}
      className={`radial-reveal-button ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      aria-label={ariaLabel}
      onPointerEnter={(event) => {
        if (disabled) return
        anchorToPointer(event)
        applyClip()
        growTo(clip.current.max)
      }}
      onPointerLeave={(event) => {
        if (disabled) return
        if (clip.current.radius >= clip.current.max - 0.5) {
          anchorToPointer(event)
          clip.current.radius = clip.current.max
          applyClip()
        }
        growTo(0)
      }}
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: radius,
        border: `1px solid ${borderColor}`,
        backgroundColor: fill,
        color: textColor,
        fontFamily: 'var(--font-mono, monospace)',
        fontWeight: 600,
        textDecoration: 'none',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        overflow: 'hidden',
        boxSizing: 'border-box',
        userSelect: 'none',
        ...style,
      }}
    >
      <span style={{ ...faceStyle, color: textColor }}>{renderContent()}</span>
      <span
        ref={overlayRef}
        aria-hidden
        style={{
          ...faceStyle,
          position: 'absolute',
          inset: 0,
          backgroundColor: hoverFill,
          color: hoverTextColor,
          pointerEvents: 'none',
          borderRadius: Math.max(0, radius - 1),
          clipPath: 'circle(0% at 100% 100%)',
          WebkitClipPath: 'circle(0% at 100% 100%)',
        }}
      >
        {renderContent()}
      </span>
    </button>
  )
}
