"use client"

import { useEffect } from "react"

export function MarketingScrollReveal() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return
    if (!("IntersectionObserver" in window)) return

    const page = document.querySelector<HTMLElement>(".marketing-page")
    if (!page) return

    const targets = Array.from(page.querySelectorAll<HTMLElement>("[data-scroll-reveal]"))
    for (const target of targets) {
      if (target.getBoundingClientRect().top > window.innerHeight * 0.9) {
        target.dataset.revealPending = "true"
      }
    }

    const observer = new IntersectionObserver(
      (entries, currentObserver) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue
          const target = entry.target as HTMLElement
          delete target.dataset.revealPending
          target.dataset.revealed = "true"
          currentObserver.unobserve(target)
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -64px 0px" }
    )

    for (const target of targets) observer.observe(target)
    return () => observer.disconnect()
  }, [])

  return null
}
