import React, { useId } from 'react'
import { motion, useMotionValue, type MotionValue } from 'framer-motion'

/**
 * Adapted from Magic UI Orbiting Circles (MIT)
 * https://github.com/magicuidesign/magicui/blob/main/apps/www/registry/magicui/orbiting-circles.tsx
 *
 * Icons stay upright (bottom side down): rotate → translateY → counter-rotate.
 * Optional scrollAngle degrees shift position on the ring without tipping icons.
 */
export interface OrbitingCirclesProps {
  className?: string
  children?: React.ReactNode
  reverse?: boolean
  duration?: number
  radius?: number
  path?: boolean
  iconSize?: number
  speed?: number
  scrollAngle?: MotionValue<number>
}

function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(' ')
}

export function OrbitingCircles({
  className,
  children,
  reverse,
  duration = 20,
  radius = 160,
  path = true,
  iconSize = 30,
  speed = 1,
  scrollAngle,
}: OrbitingCirclesProps) {
  const calculatedDuration = duration / speed
  const count = React.Children.count(children)
  const uid = useId().replace(/:/g, '')
  const ringId = `mmt-orbit-ring-${uid}`
  const zeroScroll = useMotionValue(0)
  const scroll = scrollAngle ?? zeroScroll

  return (
    <>
      {path ? (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          version="1.1"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <defs>
            <linearGradient id={ringId} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.6" />
              <stop offset="35%" stopColor="#818cf8" stopOpacity="0.5" />
              <stop offset="70%" stopColor="#a78bfa" stopOpacity="0.5" />
              <stop offset="100%" stopColor="#f472b6" stopOpacity="0.6" />
            </linearGradient>
          </defs>
          <circle
            cx="50%"
            cy="50%"
            r={radius}
            fill="none"
            stroke={`url(#${ringId})`}
            strokeWidth="1"
            strokeDasharray="4 6"
            opacity="0.7"
          />
        </svg>
      ) : null}
      {React.Children.map(children, (child, index) => {
        const angle = count > 0 ? (360 / count) * index : 0
        return (
          <motion.div
            key={index}
            style={
              {
                '--duration': calculatedDuration,
                '--radius': radius,
                '--angle': angle,
                '--scroll-angle': scroll,
                '--icon-size': `${iconSize}px`,
                width: iconSize,
                height: iconSize,
                marginLeft: -iconSize / 2,
                marginTop: -iconSize / 2,
              } as React.CSSProperties
            }
            className={cx(
              'animate-orbit absolute left-1/2 top-1/2 flex transform-gpu items-center justify-center rounded-full',
              reverse && '[animation-direction:reverse]',
              className,
            )}
          >
            {child}
          </motion.div>
        )
      })}
    </>
  )
}
